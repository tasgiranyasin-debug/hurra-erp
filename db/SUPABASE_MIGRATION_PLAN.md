# HurraMotor ERP — Supabase/PostgreSQL Migration Planı

## Genel Bakış

**Hedef:** localStorage tabanlı client-side ERP'yi Supabase (PostgreSQL) tabanlı gerçek bir veritabanına taşımak.  
**Yaklaşım:** Kademeli geçiş — sistem önce localStorage'la çalışmaya devam eder, ardından Supabase aktive edilir.

---

## Migration Dosyaları

| Dosya | İçerik | Tablo Sayısı |
|-------|--------|-------------|
| `001_core_auth.sql` | Kullanıcılar, Kur, Sistem Ayarları, Loglar | 5 |
| `002_finans.sql` | Cari, Kasa, Banka, Çek/Senet | 8 |
| `003_stok.sql` | Ürün, Depo, Stok, Lot, Seri, BOM | 13 |
| `004_satinalma_uretim.sql` | SA Emirleri, Üretim, Kalite | 5 |
| `005_ithalat_maliyet.sql` | İthalat, Masraf, Maliyet | 9 |
| `006_personel_varlik.sql` | Departman, Personel, Varlık, Bakım | 6 |
| `007_onay_bildirim_dokuman.sql` | Onay Akışı, Bildirim, Doküman | 7 |
| `008_ai_logs.sql` | AI Loglar, KPI, Dashboard, Hata | 6 |
| `009_seed_data.sql` | Başlangıç verileri + RLS politikaları | — |

**Toplam: 59 tablo**

---

## Tablo → localStorage Eşlemesi

| PostgreSQL Tablosu | localStorage Key |
|--------------------|-----------------|
| `kullanicilar` | `hm_kullanici` |
| `cariler` | `hm_cari` |
| `urunler` | `hm_urun` |
| `depolar` | `hm_depo` |
| `stok_hareketler` | `hm_sh` / `hm_stok` |
| `bom` + `bom_satirlar` | `hm_bom` |
| `lotlar` | `hm_lot` |
| `seri_numaralar` | `hm_seri` |
| `satinalma_emirleri` | `hm_sa` |
| `uretim_emirleri` | `hm_ue` |
| `ithalat_dosyalari` | `hm_import` |
| `personel` | `hm_personel` |
| `varliklar` | `hm_varlik` |
| `bildirimler` | `hm_bildirim` |
| `onay_talepleri` | `hm_onay` |
| `dokumanlar` | `hm_dokuman` |
| `kasalar` + `kasa_hareketler` | `hm_kasa` + `hm_kasa_hrk` |
| `bankalar` + `banka_hareketler` | `hm_banka` + `hm_banka_hrk` |
| `cek_senet` | `hm_cs` |
| `sistem_ayarlari` | `hm_ayar` |

---

## Temel Tasarım Kararları

**UUID vs SERIAL:**
- `kullanicilar.id` → UUID (Supabase Auth uyumlu)
- `kullanicilar.supabase_uid` → ayrı UUID kolon (Auth bridge)
- Diğer tüm tablolar → SERIAL

**Para birimi:**
- `para_birimi` enum: TRY, USD, EUR, GBP, CNY
- Dövizli tutarlar için `tutar_try GENERATED ALWAYS AS (tutar * kur) STORED`
- `kur_gecmisi` tablosu günlük kur anlık görüntülerini saklar

**Tam metin arama:**
- `pg_trgm` extension aktif
- `cariler.ad`, `urunler.ad` için GIN trigram indexleri

**Stok bakiyesi:**
- Anlık bakiye `stok_hareketler` aggregation ile hesaplanır
- PostgreSQL view veya materialized view önerilir (performans için)

**BOM yapısı:**
- `bom.aktif_revizyon` aktif revizyonu işaret eder
- `bom_satirlar` hem BOM hem revizyon ID'sine bağlı
- `urunler.bom_id` FK ile mamul ↔ BOM ilişkisi

**Personel maliyet:**
- `personel.isveren_toplam GENERATED ALWAYS AS (brut_maas * (1 + isveren_sgk)) STORED`

**Onay akışı:**
- `onay_sablonlari.adimlar` JSONB array: `[{sira, rol, onaylayan_id, tur}]`
- Her talebin adımları `onay_adimlar`'da ayrı satır

---

## Supabase Kurulum Adımları

### 1. Proje Oluştur
```
https://supabase.com → New Project
Ad: hurramotor-erp
Region: eu-central-1 (Frankfurt) veya eu-west-2 (London)
```

### 2. Bağlantı Bilgilerini Al
Settings → API:
- `Project URL` → `SUPABASE_URL`
- `anon public key` → `SUPABASE_KEY`

### 3. Migration'ları Çalıştır
SQL Editor'de sırayla çalıştır:
```sql
-- Her dosyayı sırayla: 001 → 002 → ... → 009
```
Veya Supabase CLI ile:
```bash
supabase db push
```

### 4. Supabase Storage Bucket
```
Storage → New Bucket: "dokumanlar" (public: false)
```

### 5. Supabase Auth Ayarları
```
Authentication → Settings:
- Site URL: https://tasgiranyasin-debug.github.io/hurra-erp/
- Email provider: disable (sadece manual kullanıcı)
```

---

## DB Abstraction Layer (db/supabase.js)

`window.HMDB` global nesnesi:

```javascript
// Bağlan (opsiyonel — localStorage fallback var)
await HMDB.connect(SUPABASE_URL, SUPABASE_KEY);

// CRUD — mod bağımsız (localStorage veya Supabase)
const cariler = await HMDB.getAll('cariler');
const cari    = await HMDB.getById('cariler', 1);
const yeni    = await HMDB.insert('cariler', { ad: 'Test A.Ş.', tip: 'tedarikci' });
const gunc    = await HMDB.update('cariler', 1, { sehir: 'Ankara' });
await HMDB.delete('cariler', 1);

// Filtreli sorgular
const tedarikciler = await HMDB.getAll('cariler', { tip: 'tedarikci' });

// localStorage → Supabase toplu aktarım
const sonuclar = await HMDB.migrateAll();

// Mod sorgula
HMDB.mode(); // 'localStorage' veya 'supabase'
```

---

## core.js Entegrasyon Stratejisi

### Aşama 1 — Hazırlık (şu an)
- `db/supabase.js` oluşturuldu
- Tüm migration dosyaları hazır
- `HMDB` localStorage modda çalışıyor

### Aşama 2 — HTML entegrasyonu
Her sayfaya core.js'den önce ekle:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="db/supabase.js?v=1"></script>
```

### Aşama 3 — core.js refactor (opsiyonel)
`ld(k)` / `sv(k,v)` fonksiyonlarını HMDB wrapper'a çevir:
```javascript
// Mevcut:
function ld(k){ return JSON.parse(localStorage.getItem(DB[k])||'[]'); }

// Yeni (async-aware):
async function ldAsync(k){
  const tablo = DB_TO_TABLE[k];
  return tablo ? HMDB.getAll(tablo) : ld(k);
}
```

### Aşama 4 — Veri Aktarımı
```javascript
await HMDB.connect(url, key);
await HMDB.migrateAll(); // Tüm localStorage → Supabase
```

### Aşama 5 — Tam Geçiş
localStorage referanslarını sil, sadece HMDB kullan.

---

## Row Level Security (RLS)

`009_seed_data.sql`'de temel politikalar:
- `admin` rolü her tabloya tam erişim
- `bildirimler`: kullanıcı sadece kendi bildirimlerini görür
- `urunler`, `cariler`, `stok_hareketler`: tüm authenticated kullanıcılar okuyabilir

Gelişmiş politikalar için ek migration önerilir.

---

## Backup / Restore

Mevcut `core.js` yedekleme mantığı (`yedekAl`, `yedekYukle`) korunur.  
Supabase'e geçişte ek olarak:
```javascript
// Supabase → JSON export
const { data } = await supabase.from('urunler').select('*');
downloadJSON(data, 'urunler_backup.json');

// JSON → Supabase import
await supabase.from('urunler').upsert(jsonData);
```

---

## Tahmini Geçiş Süresi

| Aşama | Süre |
|-------|------|
| Supabase proje kurulumu | ~30 dk |
| Migration çalıştırma | ~15 dk |
| supabase.js entegrasyonu (HTML dosyaları) | ~2 saat |
| core.js async refactor | ~1-2 gün |
| Test & doğrulama | ~1 gün |
| **Toplam** | **~3-4 gün** |

---

*Oluşturma tarihi: 2026-06-09 | HurraMotor ERP Madde 2*
