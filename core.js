/* ============================================================
   HURRA MOTOR ERP — core.js  v4.0
   Değişiklikler (v3.1):
   - SESSION_PASS dosyadan kaldırıldı → çalışma zamanında doğrulama
   - Kategori (hm_kategori) ile Ürün Ailesi (hm_urun_ailesi) TAM ayrıldı
   - Ürün kartına ureticiKod eklendi
   - Ürün ailesi kaydına sistemKodu eklendi (ENDURO_X, CITY_PRO…)
   - BOM revizyonu: tek revizyon yerine revizyon GEÇMİŞİ (revizyonlar[])
   - Ortak belge no üreteci: belgeNo(prefix) → 'UE-2026-0001' formatı
   Değişiklikler (v3.2):
   - Ürün kartına ustUrunId eklendi (parent-child ürün ağacı)
   - BOM satırına alternatifUrunId + fireOrani eklendi
   - bomMaliyet() → fire dahil gerçek miktar hesaplar
   - bomStokKontrol() → fire dahil gereken miktarı kontrol eder
   - bomTamMaliyet() → malzeme + işçilik + enerji + genel gider
   - Seri kartına uretimId + uretimNo bağı eklendi
   - yeniSeriSablonu() ile seri no şablonu belgelendi
   Değişiklikler (v3.3) — Faz 1: Ürün Odaklı Yapı:
   - hazirStok(urunId, depoId?) → fiziksel mamul stoğu
   - rezerveStok(urunId) → aktif üretim emirlerinde ayrılmış parça miktarı
   - kullanilabilirStok(urunId) → hazir - rezerve
   - uretilebilirAdet(mamulId) → kullanılabilir stoklara göre üretilebilir adet
   - eksikParcalar(mamulId, hedefAdet) → eksik parça listesi
   - satisDurumu(urunId) → {kod, etiket, renk, badge}
   - seedDemoMamuller() → demo mamul + parça + BOM + stok verisi
   ============================================================ */
'use strict';

// ══════════════════════════════════════════════════════════════
//  1. VERİ KATMANI — TÜM DB ANAHTARLARI
// ══════════════════════════════════════════════════════════════

/** Cari & finans modülü */
const DB = {
  c:             'hm_c',              // cariler
  h:             'hm_h',              // cari hareketler
  b:             'hm_b',              // bankalar
  bh:            'hm_bh',             // banka hareketleri
  log:           'hm_log',            // işlem log
  gr:            'hm_gr',             // cari gruplar
  tl:            'hm_tl',             // talepler
  kasa:          'hm_kasa',           // kasa tanımları
  kh:            'hm_kh',             // kasa hareketleri
  ay:            'hm_ay',             // ayarlar
  cs:            'hm_cs',             // çek/senet
  // Yeni modüller
  stok:          'hm_urun',           // ürünler (alias for ldS('urun'))
  bom:           'hm_bom',            // reçeteler / BOM
  uretim:        'hm_uretim',         // üretim emirleri
  urun_aileleri: 'hm_urun_aileleri',  // ürün aileleri
  users:         'hm_users',          // kullanıcılar (multi-user)
  user_logs:     'hm_user_logs',      // kullanıcı giriş logları
};

/** Stok modülü */
const STOK_DB = {
  urun:        'hm_urun',        // ürün kartları
  depo:        'hm_depo',        // depolar (depoTipi alanıyla — v3.4)
  sh:          'hm_sh',          // stok hareketleri
  tr:          'hm_tr',          // transfer belgeleri
  seri:        'hm_seri',        // seri numaraları
  seri_hrt:    'hm_seri_hareket',// seri no hareket geçmişi (v3.4)
};

/**
 * Depo tipi sabitleri (v3.4)
 *
 * Depo şeması — tüm alanlar:
 * { id, ad, kod, konum, acik, aktif,
 *   depoTipi,         // aşağıdaki sabitten biri
 *   kabul,            // bool — bu depoya mal kabul yapılabilir mi?
 *   sevkiyat,         // bool — bu depodan sevkiyat yapılabilir mi?
 *   karantina,        // bool — karantina deposu mu? (giriş/çıkış kısıtlı)
 * }
 *
 * depoTipi değerleri ve anlamları:
 *   ana        → Ana hammadde/ürün deposu
 *   uretim     → Üretim hattına yakın, aktif üretim deposu
 *   kk         → Kalite Kontrol bekleyen ürünler
 *   karantina  → Reddedilen / şüpheli ürünler (giriş/çıkış onay gerektirir)
 *   transit    → Yolda / gümrükte bekleyen mal
 *   servis     → Servis merkezi deposu
 *   satis      → Satış noktası / showroom deposu
 *   yedek      → Yedek parça deposu
 */
const DEPO_TIPI = {
  ana:       { ad:'Ana Depo',          renk:'#1d4ed8', simge:'🏭' },
  uretim:    { ad:'Üretim Deposu',     renk:'#16a34a', simge:'⚙️'  },
  kk:        { ad:'Kalite Kontrol',    renk:'#7c3aed', simge:'🔍' },
  karantina: { ad:'Karantina',         renk:'#dc2626', simge:'⛔' },
  transit:   { ad:'Transit',           renk:'#d97706', simge:'🚢' },
  servis:    { ad:'Servis',            renk:'#0891b2', simge:'🔧' },
  satis:     { ad:'Satış/Showroom',    renk:'#059669', simge:'🏪' },
  yedek:     { ad:'Yedek Parça',       renk:'#6b7280', simge:'📦' },
};

/** Satın alma modülü */
const SA_DB_KEY = 'hm_sa';

// ── Lot / Parti sistemi ────────────────────────────────────────
const LOT_DB = {
  lot:        'hm_lot',          // lot/parti kayıtları
  lot_hrt:    'hm_lot_hareket',  // lot bazlı stok hareketleri
};

// ── İthalat modülü ────────────────────────────────────────────
const IMPORT_DB = {
  ithalat:    'hm_ithalat',      // ithalat dosyaları
  konteyner:  'hm_konteyner',    // konteyner/yükleme kayıtları
  masraf:     'hm_masraf',       // masraf kalemleri
  masraf_tur: 'hm_masraf_tur',   // masraf türleri (dinamik)
  yuklemelist:'hm_yukleme_list', // yükleme listeleri
};

// ── Maliyet yönetimi ──────────────────────────────────────────
const MALIYET_DB = {
  maliyet_merkezi: 'hm_maliyet_merkezi',  // maliyet merkezleri (dinamik)
  gider_tur:       'hm_gider_tur',        // gider türleri (dinamik)
  genel_gider:     'hm_genel_gider',      // aylık genel giderler
  urun_maliyet:    'hm_urun_maliyet',     // ürün bazlı maliyet kayıtları
};

// ── Personel sistemi ──────────────────────────────────────────
const PERSONEL_DB = {
  departman:  'hm_departman',    // departmanlar
  pozisyon:   'hm_pozisyon',     // pozisyonlar
  personel:   'hm_personel',     // personel kartları
};

// ── Varlık (sabit kıymet) yönetimi ───────────────────────────
const VARLIK_DB = {
  varlik:     'hm_varlik',       // varlık kartları
  bakim:      'hm_varlik_bakim', // bakım geçmişi
};

// ── Onay akışı ────────────────────────────────────────────────
const ONAY_DB = {
  akis:   'hm_onay_akis',    // onay kuralları
  talep:  'hm_onay_talep',   // bekleyen onay talepleri
};

// ── Bildirim & Görev ──────────────────────────────────────────
const BILDIRIM_DB = {
  bildirim: 'hm_bildirim',   // bildirimler
  gorev:    'hm_gorev',      // görevler
};

// ── Doküman yönetimi ──────────────────────────────────────────
const DOKUMAN_DB = {
  dokuman:  'hm_dokuman',    // doküman kayıtları
  dok_tur:  'hm_dok_tur',    // doküman türleri (dinamik)
};

// ── Kur geçmişi ───────────────────────────────────────────────
const KUR_GECMIS_DB  = 'hm_kur_gecmis';
const KUR_TIPLER_DB  = 'hm_kur_tipler';   // Manuel kur tipleri (siparis/gumruk/muhasebe/ozel)
const KUR_LOG_DB     = 'hm_kur_log';      // Kur değişiklik logu

// ── Tedarikçi performans ──────────────────────────────────────
const TEDARIKCI_PERF_DB = 'hm_tedarikci_perf';

// ── Kalite kontrol ────────────────────────────────────────────
const KK_DB = 'hm_kk';

/**
 * Kategori modülü — YENI (v3.1)
 * Ürünlerin teknik sınıflandırması: Motor, Elektrik, Fren, Şasi…
 * Ürün ailesi ile KARISTIRILMAZ.
 *
 * Şema: { id, sistemKodu, ad, aciklama, renk, simge, aktif, olusturmaTarihi }
 * sistemKodu örnekleri: 'MOTOR', 'ELEKTRIK', 'FREN', 'SASI', 'SARF'
 */
const KATEGORI_DB = 'hm_kategori';

/**
 * Ürün ailesi modülü — DOĞRU TANIMLAMA (v3.1)
 * Ticari/pazarlama gruplaması: Enduro X, City Pro, Cargo Max…
 * Kategori ile KARISTIRILMAZ.
 *
 * Şema:
 * { id, sistemKodu, ad, aciklama, renk, simge, aktif, olusturmaTarihi }
 * sistemKodu örnekleri: 'ENDURO_X', 'CITY_PRO', 'CARGO_MAX', 'DELIVERY_PRO'
 */
const URUN_AILESI_DB = 'hm_urun_ailesi';

/** BOM (reçete) modülü */
const BOM_DB = 'hm_bom';

/** Üretim emirleri modülü */
const URETIM_DB = 'hm_uretim';

// ── Generic ld/sv ─────────────────────────────────────────────
function ld(k){
  try{ return JSON.parse(localStorage.getItem(DB[k])) || []; }
  catch{ return []; }
}
function sv(k, v){ localStorage.setItem(DB[k], JSON.stringify(v)); }
function ldObj(k, def={}){
  try{ return JSON.parse(localStorage.getItem(DB[k])) || def; }
  catch{ return def; }
}

// ── Stok ──────────────────────────────────────────────────────
function ldS(k){
  try{ return JSON.parse(localStorage.getItem(STOK_DB[k])) || []; }
  catch{ return []; }
}
function svS(k, v){ localStorage.setItem(STOK_DB[k], JSON.stringify(v)); }

// ── Satın alma ────────────────────────────────────────────────
function ldSA(){ try{ return JSON.parse(localStorage.getItem(SA_DB_KEY)) || []; } catch{ return []; } }
function svSA(v){ localStorage.setItem(SA_DB_KEY, JSON.stringify(v)); }

// ── Kategori ──────────────────────────────────────────────────
function ldKAT(){ try{ return JSON.parse(localStorage.getItem(KATEGORI_DB)) || []; } catch{ return []; } }
function svKAT(v){ localStorage.setItem(KATEGORI_DB, JSON.stringify(v)); }

// ── Ürün ailesi ───────────────────────────────────────────────
function ldUA(){ try{ return JSON.parse(localStorage.getItem(URUN_AILESI_DB)) || []; } catch{ return []; } }
function svUA(v){ localStorage.setItem(URUN_AILESI_DB, JSON.stringify(v)); }

// ── BOM ───────────────────────────────────────────────────────
function ldBOM(){ try{ return JSON.parse(localStorage.getItem(BOM_DB)) || []; } catch{ return []; } }
function svBOM(v){ localStorage.setItem(BOM_DB, JSON.stringify(v)); }

// ── Üretim ────────────────────────────────────────────────────
function ldURT(){ try{ return JSON.parse(localStorage.getItem(URETIM_DB)) || []; } catch{ return []; } }
function svURT(v){ localStorage.setItem(URETIM_DB, JSON.stringify(v)); }

// ── Seri hareket ──────────────────────────────────────────────
function ldSH(){ try{ return JSON.parse(localStorage.getItem(STOK_DB.seri_hrt)) || []; } catch{ return []; } }
function svSH(v){ localStorage.setItem(STOK_DB.seri_hrt, JSON.stringify(v)); }

// ── Lot ───────────────────────────────────────────────────────
function ldLOT(){ try{ return JSON.parse(localStorage.getItem(LOT_DB.lot)) || []; } catch{ return []; } }
function svLOT(v){ localStorage.setItem(LOT_DB.lot, JSON.stringify(v)); }
function ldLOTH(){ try{ return JSON.parse(localStorage.getItem(LOT_DB.lot_hrt)) || []; } catch{ return []; } }
function svLOTH(v){ localStorage.setItem(LOT_DB.lot_hrt, JSON.stringify(v)); }

// ── İthalat ───────────────────────────────────────────────────
function ldITH(){ try{ return JSON.parse(localStorage.getItem(IMPORT_DB.ithalat)) || []; } catch{ return []; } }
function svITH(v){ localStorage.setItem(IMPORT_DB.ithalat, JSON.stringify(v)); }
function ldKON(){ try{ return JSON.parse(localStorage.getItem(IMPORT_DB.konteyner)) || []; } catch{ return []; } }
function svKON(v){ localStorage.setItem(IMPORT_DB.konteyner, JSON.stringify(v)); }
function ldMASRAF(){ try{ return JSON.parse(localStorage.getItem(IMPORT_DB.masraf)) || []; } catch{ return []; } }
function svMASRAF(v){ localStorage.setItem(IMPORT_DB.masraf, JSON.stringify(v)); }
function ldMASRAF_TUR(){ try{ return JSON.parse(localStorage.getItem(IMPORT_DB.masraf_tur)) || []; } catch{ return []; } }
function svMASRAF_TUR(v){ localStorage.setItem(IMPORT_DB.masraf_tur, JSON.stringify(v)); }
function ldYUKLEME(){ try{ return JSON.parse(localStorage.getItem(IMPORT_DB.yuklemelist)) || []; } catch{ return []; } }
function svYUKLEME(v){ localStorage.setItem(IMPORT_DB.yuklemelist, JSON.stringify(v)); }

// ── Maliyet ───────────────────────────────────────────────────
function ldMMERKEZ(){ try{ return JSON.parse(localStorage.getItem(MALIYET_DB.maliyet_merkezi)) || []; } catch{ return []; } }
function svMMERKEZ(v){ localStorage.setItem(MALIYET_DB.maliyet_merkezi, JSON.stringify(v)); }
function ldGIDER_TUR(){ try{ return JSON.parse(localStorage.getItem(MALIYET_DB.gider_tur)) || []; } catch{ return []; } }
function svGIDER_TUR(v){ localStorage.setItem(MALIYET_DB.gider_tur, JSON.stringify(v)); }
function ldGENEL_GIDER(){ try{ return JSON.parse(localStorage.getItem(MALIYET_DB.genel_gider)) || []; } catch{ return []; } }
function svGENEL_GIDER(v){ localStorage.setItem(MALIYET_DB.genel_gider, JSON.stringify(v)); }
function ldURUN_MALIYET(){ try{ return JSON.parse(localStorage.getItem(MALIYET_DB.urun_maliyet)) || []; } catch{ return []; } }
function svURUN_MALIYET(v){ localStorage.setItem(MALIYET_DB.urun_maliyet, JSON.stringify(v)); }

// ── Personel ──────────────────────────────────────────────────
function ldDEPT(){ try{ return JSON.parse(localStorage.getItem(PERSONEL_DB.departman)) || []; } catch{ return []; } }
function svDEPT(v){ localStorage.setItem(PERSONEL_DB.departman, JSON.stringify(v)); }
function ldPOZ(){ try{ return JSON.parse(localStorage.getItem(PERSONEL_DB.pozisyon)) || []; } catch{ return []; } }
function svPOZ(v){ localStorage.setItem(PERSONEL_DB.pozisyon, JSON.stringify(v)); }
function ldPER(){ try{ return JSON.parse(localStorage.getItem(PERSONEL_DB.personel)) || []; } catch{ return []; } }
function svPER(v){ localStorage.setItem(PERSONEL_DB.personel, JSON.stringify(v)); }

// ── Varlık ────────────────────────────────────────────────────
function ldVARLIK(){ try{ return JSON.parse(localStorage.getItem(VARLIK_DB.varlik)) || []; } catch{ return []; } }
function svVARLIK(v){ localStorage.setItem(VARLIK_DB.varlik, JSON.stringify(v)); }
function ldBAKIM(){ try{ return JSON.parse(localStorage.getItem(VARLIK_DB.bakim)) || []; } catch{ return []; } }
function svBAKIM(v){ localStorage.setItem(VARLIK_DB.bakim, JSON.stringify(v)); }

// ── Onay ──────────────────────────────────────────────────────
function ldONAY_AKIS(){ try{ return JSON.parse(localStorage.getItem(ONAY_DB.akis)) || []; } catch{ return []; } }
function svONAY_AKIS(v){ localStorage.setItem(ONAY_DB.akis, JSON.stringify(v)); }
function ldONAY_TALEP(){ try{ return JSON.parse(localStorage.getItem(ONAY_DB.talep)) || []; } catch{ return []; } }
function svONAY_TALEP(v){ localStorage.setItem(ONAY_DB.talep, JSON.stringify(v)); }

// ── Bildirim & Görev ──────────────────────────────────────────
function ldBILDIRIM(){ try{ return JSON.parse(localStorage.getItem(BILDIRIM_DB.bildirim)) || []; } catch{ return []; } }
function svBILDIRIM(v){ localStorage.setItem(BILDIRIM_DB.bildirim, JSON.stringify(v)); }
function ldGOREV(){ try{ return JSON.parse(localStorage.getItem(BILDIRIM_DB.gorev)) || []; } catch{ return []; } }
function svGOREV(v){ localStorage.setItem(BILDIRIM_DB.gorev, JSON.stringify(v)); }

// ── Doküman ───────────────────────────────────────────────────
function ldDOK(){ try{ return JSON.parse(localStorage.getItem(DOKUMAN_DB.dokuman)) || []; } catch{ return []; } }
function svDOK(v){ localStorage.setItem(DOKUMAN_DB.dokuman, JSON.stringify(v)); }
function ldDOK_TUR(){ try{ return JSON.parse(localStorage.getItem(DOKUMAN_DB.dok_tur)) || []; } catch{ return []; } }
function svDOK_TUR(v){ localStorage.setItem(DOKUMAN_DB.dok_tur, JSON.stringify(v)); }

// ── Kur geçmişi ───────────────────────────────────────────────
function ldKURG(){ try{ return JSON.parse(localStorage.getItem(KUR_GECMIS_DB)) || []; } catch{ return []; } }
function svKURG(v){ localStorage.setItem(KUR_GECMIS_DB, JSON.stringify(v)); }
function ldKURTIP(){ try{ return JSON.parse(localStorage.getItem(KUR_TIPLER_DB)) || {}; } catch{ return {}; } }
function svKURTIP(v){ localStorage.setItem(KUR_TIPLER_DB, JSON.stringify(v)); }
function ldKURLOG(){ try{ return JSON.parse(localStorage.getItem(KUR_LOG_DB)) || []; } catch{ return []; } }
function svKURLOG(v){ localStorage.setItem(KUR_LOG_DB, JSON.stringify(v)); }

// ── Tedarikçi performans ──────────────────────────────────────
function ldTEDARIKCI_PERF(){ try{ return JSON.parse(localStorage.getItem(TEDARIKCI_PERF_DB)) || []; } catch{ return []; } }
function svTEDARIKCI_PERF(v){ localStorage.setItem(TEDARIKCI_PERF_DB, JSON.stringify(v)); }

// ── Kalite kontrol ────────────────────────────────────────────
function ldKK(){ try{ return JSON.parse(localStorage.getItem(KK_DB)) || []; } catch{ return []; } }
function svKK(v){ localStorage.setItem(KK_DB, JSON.stringify(v)); }

// ── Depo yardımcıları ─────────────────────────────────────────
function depoGetir(id){ return ldS('depo').find(d => d.id === id) || null; }
function depoTipiAd(tip){ return DEPO_TIPI[tip]?.ad || tip || '—'; }
function depoTipiRenk(tip){ return DEPO_TIPI[tip]?.renk || '#6b7280'; }
function depoTipiSimge(tip){ return DEPO_TIPI[tip]?.simge || '📦'; }

/** Belirli tipteki depoları listele */
function depoListesiByTip(tip){
  return ldS('depo').filter(d => d.aktif !== false && d.depoTipi === tip);
}

/** Stok transferine uygun depolar (karantina hariç normal depolar) */
function transferUygunDepolar(){
  return ldS('depo').filter(d => d.aktif !== false && d.karantina !== true);
}

// ══════════════════════════════════════════════════════════════
//  2. YARDIMCI FONKSİYONLAR
// ══════════════════════════════════════════════════════════════

function today(){ return new Date().toISOString().split('T')[0]; }
function ts(){ return new Date().toISOString(); }
function nid(arr){ return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1; }
function ini(str){ return (str || '?').split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase(); }
function fmt(n, dec=2){ if(typeof dec!=="number"||isNaN(dec)||dec<0||dec>20) dec=2; dec=Math.floor(dec); return Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function fmtTL(n){ return fmt(n) + ' ₺'; }
/** Para birimiyle formatlama: fmt(n)+'  USD' → "1.234,56 USD" */
function fmtPar(n, par){ return fmt(n) + ' ' + (par||'₺'); }
function pad(n, len=2){ return String(n).padStart(len,'0'); }
function uuid(){ return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

function fmtTarih(d){
  if(!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
}

// ══════════════════════════════════════════════════════════════
//  3. BELGE NO ÜRETECİ — ORTAK (v3.1)
// ══════════════════════════════════════════════════════════════

/**
 * Tüm modüller için tek, merkezi numara üreteci.
 *
 * Kullanım:
 *   belgeNo('UE')   → 'UE-2026-0001'   (üretim emri)
 *   belgeNo('SA')   → 'SA-2026-0001'   (satın alma siparişi)
 *   belgeNo('TRF')  → 'TRF-2026-0001'  (transfer belgesi)
 *   belgeNo('MK')   → 'MK-2026-0001'   (mal kabul)
 *   belgeNo('FTR')  → 'FTR-2026-0001'  (fatura)
 *   belgeNo('BOM')  → 'BOM-2026-0001'  (reçete)
 *
 * Her prefix kendi sayacını localStorage'da tutar.
 * Format: PREFIX-YIL-SIRA (sıra 4 haneli, sıfır dolgulu)
 */
function belgeNo(prefix){
  const yil = new Date().getFullYear();
  const key = `hm_sayac_${prefix}_${yil}`;
  const son = parseInt(localStorage.getItem(key) || '0');
  const yeni = son + 1;
  localStorage.setItem(key, String(yeni));
  return `${prefix}-${yil}-${pad(yeni, 4)}`;
}

/** Mevcut son numarayı silmeden önizle (kaydetmez) */
function belgeNoOnizle(prefix){
  const yil = new Date().getFullYear();
  const key = `hm_sayac_${prefix}_${yil}`;
  const son = parseInt(localStorage.getItem(key) || '0');
  return `${prefix}-${yil}-${pad(son + 1, 4)}`;
}

// ── Geriye dönük uyumluluk için eski fonksiyonlar (yeni kod belgeNo kullansın) ──
function uretimEmriNo(){ return belgeNo('UE'); }

// ══════════════════════════════════════════════════════════════
//  4. OTURUM YÖNETİMİ
// ══════════════════════════════════════════════════════════════

/**
 * GÜVENLİK NOTU (v3.1):
 * SESSION_PASS bu dosyada artık TANIMLI DEĞİL.
 * Şifre doğrulaması index.html (login sayfası) içinde kalır ve
 * production'da sunucu tarafına taşınacak.
 *
 * Bu dosyada sadece token/session kontrolü vardır — şifrenin
 * kendisi JS kaynak kodunda bulunmaz.
 */
const SESSION_KEY  = 'hm_session';
const SESSION_USER = 'hurramotor';

function checkSession(){
  try{
    const s1 = JSON.parse(localStorage.getItem(SESSION_KEY));
    if(s1 && s1.exp > Date.now()) return true;
    const s2 = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if(s2 && s2.exp > Date.now()) return true;
  }catch{}
  return false;
}

function setSession(remember, username){
  // BUG-07 fix: setSession artık username parametresi alıyor.
  // index.html setSessionUser() kullanıyorsa bu fonksiyon çağrılmaz;
  // eski uyumluluk için username yoksa SESSION_USER fallback'e düşer.
  const u = username || SESSION_USER;
  const hours = remember ? 24 * 30 : 8;
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(SESSION_KEY);
  // BUG-IZIN fix: rol'ü kullanıcı listesinden al — izin.js session.rol okur
  const userObj = getUserByName ? getUserByName(u) : null;
  const rol = (userObj && (userObj.rol || userObj.role)) || 'admin';
  store.setItem(SESSION_KEY, JSON.stringify({
    exp: Date.now() + hours * 3600 * 1000,
    user: u,
    username: u,
    remember: !!remember,
    rol: rol
  }));
}

window.logout = function(){
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  location.href = 'index.html';
};

// ══════════════════════════════════════════════════════════════
//  5. KURLAR
// ══════════════════════════════════════════════════════════════

let KUR = { USD: 32.5, EUR: 35.2, CNY: 4.5 };
window.KUR = KUR;
const KUR_CACHE_KEY = 'hm_kur_cache';
const KUR_CACHE_TTL = 15 * 60 * 1000; // 15 dakika

async function kurCek(){
  try{
    const cache = JSON.parse(localStorage.getItem(KUR_CACHE_KEY) || 'null');
    if(cache && (Date.now() - cache.ts) < KUR_CACHE_TTL){
      KUR = cache.kur || cache.KUR || KUR;
      return KUR;
    }
    const res = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,CNY');
    if(!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    const eskiKur = { ...KUR };
    KUR.USD = parseFloat((1 / data.rates.USD).toFixed(4));
    KUR.EUR = parseFloat((1 / data.rates.EUR).toFixed(4));
    KUR.CNY = parseFloat((1 / data.rates.CNY).toFixed(4));
    localStorage.setItem(KUR_CACHE_KEY, JSON.stringify({ ts: Date.now(), kur: KUR }));
    // TCMB kurunu geçmişe kaydet + değişiklik logla
    kurKaydet({ USD: KUR.USD, EUR: KUR.EUR, CNY: KUR.CNY }, 'TCMB');
    kurDegisiklikLogla(eskiKur, { USD: KUR.USD, EUR: KUR.EUR, CNY: KUR.CNY }, 'TCMB');
  }catch(e){
    console.warn('Kur çekilemedi:', e.message);
    try{
      const old = JSON.parse(localStorage.getItem(KUR_CACHE_KEY) || 'null');
      if(old) KUR = old.kur || old.KUR || KUR;
    }catch{}
  }
  return KUR;
}

function tlCevir(tutar, par){ return tutar * (KUR[par] || 1); }

// ══════════════════════════════════════════════════════════════
//  6. STOK HESAPLAMA
// ══════════════════════════════════════════════════════════════

// Fiziksel stok — rezerve hareketleri (tip:'rezerve'|'rezerve_iptal') SAYILMAZ
const SAYLMAYAN_TIPLER = new Set(['rezerve','rezerve_iptal']);

function urunStok(urunId, depoId=null){
  const hrtler = ldS('sh').filter(h =>
    h.urunId === urunId && !h.sil && !SAYLMAYAN_TIPLER.has(h.tip)
  );
  if(depoId){
    return hrtler.reduce((t, h) => {
      if(h.depoId === depoId)         t += (h.yon === 'giris' ? 1 : -1) * h.miktar;
      if(h.tip === 'transfer' && h.hedefDepoId === depoId) t += h.miktar;
      if(h.tip === 'transfer' && h.depoId      === depoId) t -= h.miktar;
      return t;
    }, 0);
  }
  return hrtler.filter(h => h.tip !== 'transfer')
    .reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * h.miktar, 0);
}

function depoStok(depoId){
  return ldS('urun').filter(u => u.aktif !== false).map(u => ({
    ...u, miktar: urunStok(u.id, depoId)
  })).filter(u => u.miktar !== 0);
}

function stokUyarilar(){
  return ldS('urun').filter(u => u.aktif !== false && u.minStok > 0).map(u => ({
    ...u, toplamStok: urunStok(u.id)
  })).filter(u => u.toplamStok <= u.minStok);
}

function stokNegatifKontrol(urunId, depoId, miktar){
  const mevcut = urunStok(urunId, depoId);
  if(mevcut - miktar < 0){
    const u = ldS('urun').find(x => x.id === urunId);
    const d = ldS('depo').find(x => x.id === depoId);
    return {
      ok: false,
      msg: `Yetersiz stok!\n${u?.ad||'Ürün'} — ${d?.ad||'Depo'}\nMevcut: ${mevcut} ${u?.birim||''}\nÇıkış: ${miktar} ${u?.birim||''}\nFark: ${mevcut - miktar} ${u?.birim||''}`
    };
  }
  return { ok: true };
}

function seriNoBenzersizMi(no, haricId=null){
  try{
    const liste = JSON.parse(localStorage.getItem(STOK_DB.seri)) || [];
    return !liste.some(s => s.no === no && s.id !== haricId);
  }catch{ return true; }
}

// ══════════════════════════════════════════════════════════════
//  6b. ÜRÜN ODAKLI STOK KATMANI (v3.3 — Faz 1)
// ══════════════════════════════════════════════════════════════

/**
 * Hazır stok — fiziksel depodaki mamul adedi.
 * urunStok() ile aynı ama anlamsal olarak "satışa hazır" fiziksel stok.
 * @param {number} urunId
 * @param {number|null} depoId - null = tüm depolar
 * @returns {number}
 */
function hazirStok(urunId, depoId=null){
  return urunStok(urunId, depoId);
}

/**
 * Rezerve stok — aktif üretim emirlerinde (hazirlaniyor/uretimde/kalite_kontrol)
 * tüketilmek üzere ayrılmış parça/mamul miktarı.
 * @param {number} urunId
 * @param {number|string|null} excludeUretimId — bu emri hesaptan çıkar (double-counting önler)
 * @returns {number}
 */
function rezerveStok(urunId, excludeUretimId=null){
  const uretimler = (ld('uretim') || []).filter(u => !u.sil);
  const AKTIF = ['hazirlaniyor','uretimde','kalite_kontrol'];
  const bomlar = ld('bom') || [];
  let toplam = 0;

  uretimler
    .filter(u => AKTIF.includes(u.durum) && u.id !== excludeUretimId)
    .forEach(u => {
      // Bu ürün bir mamulse: emrin hedef adedi kadar rezerve
      if(u.urunId === urunId){ toplam += (u.adet || 0); return; }
      // Parça ise: bu emrin BOM'unda geçiyor mu?
      const bom = bomlar.find(b => b.mamulUrunId === u.urunId);
      if(!bom) return;
      (bom.satirlar || []).forEach(s => {
        if(s.urunId === urunId){
          const fireOrani = s.fireOrani || 0;
          toplam += Math.ceil((s.miktar || 1) * (1 + fireOrani) * (u.adet || 1));
        }
      });
    });
  return toplam;
}

/**
 * Kullanılabilir stok = hazır stok − rezerve stok (min 0)
 * excludeUretimId: mevcut emrin kendi stok kontrolünde double-counting'i önler.
 * @param {number} urunId
 * @param {number|null} depoId
 * @param {number|string|null} excludeUretimId
 * @returns {number}
 */
function kullanilabilirStok(urunId, depoId=null, excludeUretimId=null){
  return Math.max(0, hazirStok(urunId, depoId) - rezerveStok(urunId, excludeUretimId));
}

/**
 * Üretim emri hazirlaniyor'a geçmeden önce stok yeterliliğini kontrol eder.
 * excludeUretimId: mevcut emrin kendi rezervasyonunu hariç tutar (güncelleme senaryosu).
 * @param {number} mamulId
 * @param {number} adet
 * @param {number|string|null} excludeUretimId
 * @returns {{ yeterli: boolean, eksikler: Array, uyarilar: Array, sebep?: string }}
 */
function stokYeterliMi(mamulId, adet=1, excludeUretimId=null){
  const bom = (ld('bom')||[]).find(b => b.mamulUrunId === mamulId && b.aktif !== false);
  if(!bom) return { yeterli:false, eksikler:[], uyarilar:[], sebep:'BOM bulunamadı' };

  const urunler = ldS('urun');
  const eksikler = [], uyarilar = [];

  (bom.satirlar||[]).forEach(s => {
    const p = urunler.find(u => u.id === s.urunId);
    const gerekli = Math.ceil((s.miktar||1) * (1+(s.fireOrani||0)) * adet);
    const mevcut  = kullanilabilirStok(s.urunId, null, excludeUretimId);
    const ad = p?.ad || '?';
    if(mevcut < gerekli){
      eksikler.push({ urunId:s.urunId, ad, gerekli, mevcut, eksik:gerekli-mevcut });
    } else if(mevcut - gerekli < 3){
      // Yeterli ama çok az kalan — uyarı
      uyarilar.push({ urunId:s.urunId, ad, gerekli, mevcut, kalan:mevcut-gerekli });
    }
  });
  return { yeterli: eksikler.length === 0, eksikler, uyarilar };
}

/**
 * Üretilebilir adet — kullanılabilir parça stoklarına göre kaç mamul üretilebilir.
 * @param {number} mamulId
 * @returns {number}
 */
function uretilebilirAdet(mamulId){
  const bomlar = ld('bom') || [];
  const bom = bomlar.find(b => b.mamulUrunId === mamulId && b.aktif !== false);
  if(!bom || !(bom.satirlar||[]).length) return 0;
  const urunler = ldS('urun');
  let min = Infinity;
  bom.satirlar.forEach(s => {
    const p = urunler.find(u => u.id === s.urunId);
    const mevcut = p ? kullanilabilirStok(p.id) : 0;
    const fireOrani = s.fireOrani || 0;
    const etkin = (s.miktar || 1) * (1 + fireOrani);
    const adet = Math.floor(mevcut / etkin);
    if(adet < min) min = adet;
  });
  return min === Infinity ? 0 : min;
}

/**
 * Eksik parçalar — hedefAdet mamul üretmek için hangi parçalar eksik.
 * @param {number} mamulId
 * @param {number} hedefAdet
 * @returns {Array<{urunId, urunAd, urunKod, birim, gerekli, mevcut, eksik}>}
 */
function eksikParcalar(mamulId, hedefAdet=1){
  const bomlar = ld('bom') || [];
  const bom = bomlar.find(b => b.mamulUrunId === mamulId && b.aktif !== false);
  if(!bom) return [];
  const urunler = ldS('urun');
  const eksikler = [];
  bom.satirlar.forEach(s => {
    const p = urunler.find(u => u.id === s.urunId);
    const mevcut = p ? kullanilabilirStok(p.id) : 0;
    const fireOrani = s.fireOrani || 0;
    const gerekli = Math.ceil((s.miktar || 1) * (1 + fireOrani) * hedefAdet);
    if(mevcut < gerekli){
      eksikler.push({
        urunId: s.urunId,
        urunAd: p ? p.ad : '?',
        urunKod: p ? p.kod : '?',
        birim: p ? p.birim : 'adet',
        gerekli,
        mevcut,
        eksik: gerekli - mevcut
      });
    }
  });
  return eksikler;
}

// ═══════════════════════════════════════════════════════════════
// 6c. MRP LITE (v3.4)
// ═══════════════════════════════════════════════════════════════

/**
 * Son alış fiyatı — bu ürün için en son onaylı SA kaleminin birim fiyatı.
 * @param {number} urunId
 * @returns {{ fiyat: number, par: string, tarih: string|null, cariId: number|null }}
 */
function sonAlisFiyati(urunId){
  const saList = ldSA().filter(s => !s.sil && s.durum !== 'iptal');
  let sonKalem = null, sonTarih = '';
  saList.forEach(sa => {
    (sa.kalemler || []).forEach(k => {
      if(k.urunId === urunId && (sa.tar||'') >= sonTarih){
        sonTarih = sa.tar || '';
        sonKalem = { fiyat: k.birimFiyat || 0, par: sa.par || 'TRY', tarih: sa.tar, cariId: sa.cariId };
      }
    });
  });
  return sonKalem || { fiyat: 0, par: 'TRY', tarih: null, cariId: null };
}

/**
 * Son tedarikçi adı — cariId'den çözer.
 * @param {number|null} cariId
 * @returns {string}
 */
function sonTedarikciAd(cariId){
  if(!cariId) return '—';
  const c = ld('c');
  if(!c) return '—';
  const cari = c.find(x => x.id === cariId);
  return cari ? (cari.kisa || cari.ad || '—') : '—';
}

/**
 * Son tedarikçi adı — urunId üzerinden çözer (BUG-03 fix: alias for stok.html callers).
 * @param {number} urunId
 * @returns {string}
 */
function sonTedarikci(urunId){
  const saf = sonAlisFiyati(urunId);
  return sonTedarikciAd(saf?.cariId);
}

/**
 * Son alış fiyatı — sadece sayı döndürür (BUG-02 fix: number-only alias).
 * Rich object için sonAlisFiyati() kullanın.
 * @param {number} urunId
 * @returns {number}
 */
function sonAlisFiyatiSayi(urunId){
  return sonAlisFiyati(urunId)?.fiyat ?? 0;
}

/**
 * MRP Lite hesaplama — bir mamulü hedefAdet üretmek için tam tablo.
 * @param {number} mamulId
 * @param {number} hedefAdet
 * @returns {{
 *   mamul: object|null,
 *   bom: object|null,
 *   satirlar: Array,        // parça bazlı satırlar
 *   ozet: {
 *     toplamMaliyet: number,
 *     eksikMaliyet: number,
 *     eksikSay: number,
 *     yeterliSay: number,
 *     uretilebilirAdet: number
 *   }
 * }}
 */
function mrpHesapla(mamulId, hedefAdet=1){
  const urunler = ldS('urun');
  const mamul   = urunler.find(u => u.id === mamulId) || null;
  const bom     = (ld('bom') || []).find(b => b.mamulUrunId === mamulId && b.aktif !== false) || null;

  if(!bom) return { mamul, bom:null, satirlar:[], ozet:{toplamMaliyet:0,eksikMaliyet:0,eksikSay:0,yeterliSay:0,uretilebilirAdet:0} };

  let toplamMaliyet = 0, eksikMaliyet = 0, eksikSay = 0, yeterliSay = 0;

  const satirlar = (bom.satirlar || []).map(s => {
    const p = urunler.find(u => u.id === s.urunId);
    const fireOrani  = s.fireOrani || 0;
    const gerekli    = Math.ceil((s.miktar || 1) * (1 + fireOrani) * hedefAdet);
    const fiziksel   = p ? hazirStok(p.id) : 0;
    const rezerve    = p ? rezerveStok(p.id) : 0;
    const kullanilab = p ? kullanilabilirStok(p.id) : 0;
    const eksik      = Math.max(0, gerekli - kullanilab);
    const yeterli    = eksik === 0;

    const saf = sonAlisFiyati(s.urunId);
    // Fiyat önceliği: son alış → alisFiyat → 0
    const birimFiyat = saf.fiyat > 0 ? saf.fiyat : (p?.alisFiyat || 0);
    const satirMaliyeti  = birimFiyat * gerekli;
    const eksikMaliyeti  = birimFiyat * eksik;

    toplamMaliyet += satirMaliyeti;
    if(!yeterli){ eksikMaliyet += eksikMaliyeti; eksikSay++; }
    else yeterliSay++;

    return {
      urunId:     s.urunId,
      urunAd:     p?.ad    || '?',
      urunKod:    p?.kod   || '?',
      birim:      p?.birim || s.birim || 'adet',
      gerekli,
      fiziksel,
      rezerve,
      kullanilab,
      eksik,
      yeterli,
      birimFiyat,
      satirMaliyeti,
      eksikMaliyeti,
      sonTedarikci:   sonTedarikciAd(saf.cariId),
      sonAlisParite:  saf.par,
      sonAlisTarih:   saf.tarih,
      cariId:         saf.cariId
    };
  });

  // Kaç adet üretilebilir — uretilebilirAdet() ile tutarlı olsun
  const uretileb = uretilebilirAdet(mamulId);

  return {
    mamul,
    bom,
    satirlar,
    ozet: {
      toplamMaliyet,
      eksikMaliyet,
      eksikSay,
      yeterliSay,
      uretilebilirAdet: uretileb === Infinity ? 0 : uretileb
    }
  };
}

/**
 * Satış durumu — mamul için otomatik durum hesaplar.
 * @param {number} urunId
 * @returns {{kod: string, etiket: string, css: string, badge: string}}
 */
function satisDurumu(urunId){
  const u = ldS('urun').find(x => x.id === urunId);
  if(!u || u.aktif === false)
    return { kod:'pasif', etiket:'Pasif',
      css:'background:#f3f4f6;color:#6b7280',
      badge:'ds ds-pasif' };
  const hazir = hazirStok(urunId);
  const uret  = uretilebilirAdet(urunId);
  if(hazir > 0)
    return { kod:'satilabilir', etiket:'Satılabilir',
      css:'background:#dcfce7;color:#15803d',
      badge:'ds ds-tamamlandi' };
  if(uret > 0)
    return { kod:'uretilebilir', etiket:'Üretilebilir',
      css:'background:#dbeafe;color:#1d4ed8',
      badge:'ds ds-uretimde' };
  return { kod:'eksik_parca', etiket:'Eksik Parça',
    css:'background:#fee2e2;color:#b91c1c',
    badge:'ds ds-iptal' };
}

/**
 * Demo mamul verisi — sistemde hiç mamul yoksa çalışır.
 * Anka A8, Casper Pro, Enduro X, City Pro, Cargo Max + BOM + parçalar + başlangıç stoku.
 */
function seedDemoMamuller(){
  const mevcutMamuller = ldS('urun').filter(u => u.urunTipi === 'mamul' && u.aktif !== false);
  if(mevcutMamuller.length > 0) return; // zaten mamul var, seed etme

  // ── Parçalar ──────────────────────────────────────────────
  const parcaSablonlari = [
    { id:1001, kod:'MTR-72V-3000W', ad:'72V 3000W BLDC Motor',     urunTipi:'yardimci', birim:'adet', alisFiyat:4200, par:'TRY', kategori:'Motor',      seriTakip:true  },
    { id:1002, kod:'BAT-72V-40AH',  ad:'72V 40Ah Lityum Batarya',  urunTipi:'yardimci', birim:'adet', alisFiyat:8500, par:'TRY', kategori:'Batarya',    seriTakip:true  },
    { id:1003, kod:'BAT-60V-30AH',  ad:'60V 30Ah Lityum Batarya',  urunTipi:'yardimci', birim:'adet', alisFiyat:5800, par:'TRY', kategori:'Batarya',    seriTakip:true  },
    { id:1004, kod:'SAS-ALM-A8',    ad:'Anka A8 Alüminyum Şasi',   urunTipi:'yardimci', birim:'adet', alisFiyat:2800, par:'TRY', kategori:'Şasi',       seriTakip:true  },
    { id:1005, kod:'SAS-ALM-CP',    ad:'Casper Pro Çelik Şasi',    urunTipi:'yardimci', birim:'adet', alisFiyat:2200, par:'TRY', kategori:'Şasi',       seriTakip:true  },
    { id:1006, kod:'SAS-ALM-EX',    ad:'Enduro X Güçlü Şasi',      urunTipi:'yardimci', birim:'adet', alisFiyat:3200, par:'TRY', kategori:'Şasi',       seriTakip:true  },
    { id:1007, kod:'KTR-72V-FOC',   ad:'72V FOC Motor Kontrolcüsü',urunTipi:'yardimci', birim:'adet', alisFiyat:1850, par:'TRY', kategori:'Elektrik',   seriTakip:false },
    { id:1008, kod:'KTR-60V-FOC',   ad:'60V FOC Motor Kontrolcüsü',urunTipi:'yardimci', birim:'adet', alisFiyat:1200, par:'TRY', kategori:'Elektrik',   seriTakip:false },
    { id:1009, kod:'FRN-HYD-F',     ad:'Hidrolik Ön Amortisör',    urunTipi:'yardimci', birim:'adet', alisFiyat:650,  par:'TRY', kategori:'Fren',       seriTakip:false },
    { id:1010, kod:'FRN-HYD-R',     ad:'Hidrolik Arka Amortisör',  urunTipi:'yardimci', birim:'adet', alisFiyat:580,  par:'TRY', kategori:'Fren',       seriTakip:false },
    { id:1011, kod:'DSP-TFT-7',     ad:'7" TFT Dijital Gösterge',  urunTipi:'yardimci', birim:'adet', alisFiyat:420,  par:'TRY', kategori:'Elektrik',   seriTakip:false },
    { id:1012, kod:'TEK-10-CST',    ad:'10" CST Lastik (x2 set)',  urunTipi:'yardimci', birim:'set',  alisFiyat:380,  par:'TRY', kategori:'Tekerlek',   seriTakip:false },
    { id:1013, kod:'TEK-12-CST',    ad:'12" CST Off-road Lastik (x2)',urunTipi:'yardimci',birim:'set',alisFiyat:520, par:'TRY', kategori:'Tekerlek',   seriTakip:false },
    { id:1014, kod:'SRF-KABLO-SET', ad:'Kablo Demeti Seti',        urunTipi:'sarf',     birim:'set',  alisFiyat:180,  par:'TRY', kategori:'Elektrik',   seriTakip:false },
    { id:1015, kod:'SRF-CIVATA-SET',ad:'Civata & Somun Seti',      urunTipi:'sarf',     birim:'set',  alisFiyat:45,   par:'TRY', kategori:'Montaj',     seriTakip:false },
    { id:1016, kod:'MTR-60V-2000W', ad:'60V 2000W BLDC Motor',     urunTipi:'yardimci', birim:'adet', alisFiyat:2900, par:'TRY', kategori:'Motor',      seriTakip:true  },
    { id:1017, kod:'KTR-72V-CARGO', ad:'72V Yük Kontrolcüsü',      urunTipi:'yardimci', birim:'adet', alisFiyat:2100, par:'TRY', kategori:'Elektrik',   seriTakip:false },
    { id:1018, kod:'SAS-STL-CARGO', ad:'Cargo Max Yüklü Şasi',     urunTipi:'yardimci', birim:'adet', alisFiyat:3800, par:'TRY', kategori:'Şasi',       seriTakip:true  },
  ];

  // ── Mamul ürünler ─────────────────────────────────────────
  const mamulSablonlari = [
    { id:2001, kod:'ANKA-A8',    ad:'Anka A8',    urunTipi:'mamul', birim:'adet', alisFiyat:0, satisFiyat:32000, par:'TRY', kategori:'Elektrikli Scooter', seriTakip:true, minStok:2 },
    { id:2002, kod:'CASPER-PRO', ad:'Casper Pro', urunTipi:'mamul', birim:'adet', alisFiyat:0, satisFiyat:28000, par:'TRY', kategori:'Elektrikli Scooter', seriTakip:true, minStok:2 },
    { id:2003, kod:'ENDURO-X',   ad:'Enduro X',   urunTipi:'mamul', birim:'adet', alisFiyat:0, satisFiyat:36000, par:'TRY', kategori:'Elektrikli Scooter', seriTakip:true, minStok:1 },
    { id:2004, kod:'CITY-PRO',   ad:'City Pro',   urunTipi:'mamul', birim:'adet', alisFiyat:0, satisFiyat:22000, par:'TRY', kategori:'Elektrikli Scooter', seriTakip:true, minStok:3 },
    { id:2005, kod:'CARGO-MAX',  ad:'Cargo Max',  urunTipi:'mamul', birim:'adet', alisFiyat:0, satisFiyat:38000, par:'TRY', kategori:'Elektrikli Scooter', seriTakip:true, minStok:1 },
  ];

  // ── BOM satırları (mamulId → parça listesi) ───────────────
  const bomSablonlari = [
    { mamulId:2001, satirlar:[
      { urunId:1001, miktar:1, birim:'adet', fireOrani:0 },  // 72V Motor
      { urunId:1002, miktar:1, birim:'adet', fireOrani:0 },  // 72V Batarya
      { urunId:1004, miktar:1, birim:'adet', fireOrani:0 },  // Anka Şasi
      { urunId:1007, miktar:1, birim:'adet', fireOrani:0 },  // 72V Kontrolcü
      { urunId:1009, miktar:1, birim:'adet', fireOrani:0.02 }, // Ön Amort.
      { urunId:1010, miktar:1, birim:'adet', fireOrani:0.02 }, // Arka Amort.
      { urunId:1011, miktar:1, birim:'adet', fireOrani:0 },  // Gösterge
      { urunId:1012, miktar:1, birim:'set',  fireOrani:0 },  // 10" Lastik
      { urunId:1014, miktar:1, birim:'set',  fireOrani:0.05 },// Kablo Seti
      { urunId:1015, miktar:1, birim:'set',  fireOrani:0.1 }, // Civata Seti
    ]},
    { mamulId:2002, satirlar:[
      { urunId:1016, miktar:1, birim:'adet', fireOrani:0 },  // 60V Motor
      { urunId:1003, miktar:1, birim:'adet', fireOrani:0 },  // 60V Batarya
      { urunId:1005, miktar:1, birim:'adet', fireOrani:0 },  // Casper Şasi
      { urunId:1008, miktar:1, birim:'adet', fireOrani:0 },  // 60V Kontrolcü
      { urunId:1009, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1010, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1011, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1012, miktar:1, birim:'set',  fireOrani:0 },
      { urunId:1014, miktar:1, birim:'set',  fireOrani:0.05 },
      { urunId:1015, miktar:1, birim:'set',  fireOrani:0.1 },
    ]},
    { mamulId:2003, satirlar:[
      { urunId:1001, miktar:1, birim:'adet', fireOrani:0 },  // 72V Motor
      { urunId:1002, miktar:1, birim:'adet', fireOrani:0 },  // 72V Batarya
      { urunId:1006, miktar:1, birim:'adet', fireOrani:0 },  // Enduro Şasi
      { urunId:1007, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1009, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1010, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1011, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1013, miktar:1, birim:'set',  fireOrani:0 },  // 12" Off-road
      { urunId:1014, miktar:1, birim:'set',  fireOrani:0.05 },
      { urunId:1015, miktar:1, birim:'set',  fireOrani:0.1 },
    ]},
    { mamulId:2004, satirlar:[
      { urunId:1016, miktar:1, birim:'adet', fireOrani:0 },  // 60V Motor
      { urunId:1003, miktar:1, birim:'adet', fireOrani:0 },  // 60V Batarya
      { urunId:1005, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1008, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1009, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1010, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1011, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1012, miktar:1, birim:'set',  fireOrani:0 },
      { urunId:1014, miktar:1, birim:'set',  fireOrani:0.05 },
      { urunId:1015, miktar:1, birim:'set',  fireOrani:0.1 },
    ]},
    { mamulId:2005, satirlar:[
      { urunId:1001, miktar:1, birim:'adet', fireOrani:0 },  // 72V Motor
      { urunId:1002, miktar:1, birim:'adet', fireOrani:0 },  // 72V Batarya
      { urunId:1018, miktar:1, birim:'adet', fireOrani:0 },  // Cargo Şasi
      { urunId:1017, miktar:1, birim:'adet', fireOrani:0 },  // Yük Kontrolcü
      { urunId:1009, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1010, miktar:1, birim:'adet', fireOrani:0.02 },
      { urunId:1011, miktar:1, birim:'adet', fireOrani:0 },
      { urunId:1012, miktar:1, birim:'set',  fireOrani:0 },
      { urunId:1014, miktar:2, birim:'set',  fireOrani:0.05 }, // 2x kablo
      { urunId:1015, miktar:2, birim:'set',  fireOrani:0.1 },  // 2x civata
    ]},
  ];

  // ── Mevcut kayıtları yükle ve ID çakışmasını önle ─────────
  const urunList = ldS('urun');
  const bomList  = ld('bom') || [];
  const shList   = ldS('sh');
  const anaDepo  = ldS('depo').find(d => d.aktif !== false) || { id:1 };

  // Parçaları ekle (ID çakışması varsa atla)
  const mevcutIds = new Set(urunList.map(u => u.id));
  parcaSablonlari.forEach(p => {
    if(!mevcutIds.has(p.id)){
      urunList.push({ ...p, aktif:true, minStok:5, not:'Demo verisi', cat:ts() });
    }
  });
  mamulSablonlari.forEach(m => {
    if(!mevcutIds.has(m.id)){
      urunList.push({ ...m, aktif:true, not:'Demo verisi', cat:ts() });
    }
  });
  svS('urun', urunList);

  // BOM'ları ekle
  const mevcutBomIds = new Set(bomList.map(b => b.mamulUrunId));
  bomSablonlari.forEach((bs, i) => {
    if(!mevcutBomIds.has(bs.mamulId)){
      bomList.push({
        id: 3000 + i,
        mamulUrunId: bs.mamulId,
        revizyon: 'R1',
        acik: true,
        aktif: true,
        satirlar: bs.satirlar.map((s, j) => ({ ...s, id: 4000 + i*20 + j })),
        olusturma: ts(), cat: ts()
      });
    }
  });
  sv('bom', bomList);

  // Başlangıç parça stoğu (her parça için demo miktar)
  const parcaMiktarlar = {
    1001:12, 1002:8,  1003:15, 1004:5,  1005:10,
    1006:3,  1007:12, 1008:15, 1009:20, 1010:20,
    1011:18, 1012:14, 1013:4,  1014:25, 1015:30,
    1016:14, 1017:6,  1018:4
  };
  const mevcutShUrunIds = new Set(shList.map(h => h.urunId));
  Object.entries(parcaMiktarlar).forEach(([uid, miktar]) => {
    const id = parseInt(uid);
    if(!mevcutShUrunIds.has(id)){
      shList.push({
        id: nid(shList), urunId:id, depoId:anaDepo.id,
        yon:'giris', tip:'satin_alma', miktar,
        tar: today(), ack:'Demo başlangıç stoğu',
        refNo:'DEMO-INIT', birimFiyat:0, par:'TRY',
        onay:'onaylandi', sil:false, cat:ts()
      });
    }
  });
  // Demo mamul stoğu: Anka A8 x3, Casper Pro x2, City Pro x4
  const mamulMiktarlar = { 2001:3, 2002:2, 2004:4 };
  Object.entries(mamulMiktarlar).forEach(([uid, miktar]) => {
    const id = parseInt(uid);
    if(!mevcutShUrunIds.has(id)){
      shList.push({
        id: nid(shList), urunId:id, depoId:anaDepo.id,
        yon:'giris', tip:'uretim', miktar,
        tar: today(), ack:'Demo hazır mamul stoğu',
        refNo:'DEMO-MAMUL', birimFiyat:0, par:'TRY',
        onay:'onaylandi', sil:false, cat:ts()
      });
    }
  });
  svS('sh', shList);

  console.log('[HurraERP] Demo mamul verisi eklendi:', mamulSablonlari.map(m=>m.ad).join(', '));
}

// ══════════════════════════════════════════════════════════════
//  7. KATEGORİ YARDIMCILARI (v3.1 — Ürün ailesinden AYRI)
// ══════════════════════════════════════════════════════════════

/**
 * Kategori = teknik sınıflandırma.
 * Ürün formu → "Kategori" alanı buradan beslenir.
 *
 * Şema:
 * { id, sistemKodu, ad, aciklama, renk, simge, aktif, olusturmaTarihi }
 *
 * sistemKodu örnekleri:
 *   MOTOR | SASI | ELEKTRIK | FREN | SUSPANSIYON | YAKIT | SARF | MAMUL
 */

function kategoriGetir(id){
  return ldKAT().find(k => k.id === id) || null;
}

function kategoriListesi(){
  return ldKAT().filter(k => k.aktif !== false);
}

function kategoriAd(id){
  const k = kategoriGetir(id);
  return k ? k.ad : '';
}

// ══════════════════════════════════════════════════════════════
//  8. ÜRÜN AİLESİ YARDIMCILARI (v3.1 — Kategoriden AYRI)
// ══════════════════════════════════════════════════════════════

/**
 * Ürün ailesi = ticari/pazarlama gruplaması.
 * "Bu ürün hangi modelin parçası?" sorusunu yanıtlar.
 *
 * Şema:
 * { id, sistemKodu, ad, aciklama, renk, simge, aktif, olusturmaTarihi }
 *
 * sistemKodu örnekleri (slug formatı, büyük harf + alt çizgi):
 *   ENDURO_X | CITY_PRO | CARGO_MAX | DELIVERY_PRO | GENEL
 */

function urunAilesiGetir(id){
  return ldUA().find(a => a.id === id) || null;
}

function urunAilesiListesi(){
  return ldUA().filter(a => a.aktif !== false);
}

function urunAilesiAd(id){
  const a = urunAilesiGetir(id);
  return a ? a.ad : '';
}

/** sistemKodu ile aile bul (BOM/üretim sayfaları için) */
function urunAilesiByKod(sistemKodu){
  return ldUA().find(a => a.sistemKodu === sistemKodu) || null;
}

// ══════════════════════════════════════════════════════════════
//  9. BOM (MALZEME LİSTESİ / REÇETE) YARDIMCILARI
// ══════════════════════════════════════════════════════════════

/**
 * BOM şeması (v3.2 — fire oranı ve alternatif parça eklendi):
 * {
 *   id, kod, ad,
 *   mamulUrunId,
 *   aktifRevizyon,       // string — hangi revizyon aktif: '1.0'
 *   revizyonlar: [       // TÜM revizyon geçmişi
 *     {
 *       rev,             // '1.0', '1.1', '2.0'
 *       tarih,           // ISO tarih
 *       yazan,           // kullanıcı adı
 *       degisiklik,      // açıklama: 'Batarya kapasitesi güncellendi'
 *       satirlar: [
 *         {
 *           id, urunId, miktar, birim, not, opsiyonel,
 *           alternatifUrunId,  // stokta yoksa yerine kullanılacak ürün
 *           fireOrani,         // 0.00–1.00 → gerçek çekilen: miktar*(1+fire)
 *         }
 *       ],
 *
 *       // ── İLERİDE EKLENECEKLER (v4 — şimdi null/[] bırakılır) ────
 *
 *       operasyonlar: [  // Üretim adımları — bom.html'de implemente edilecek
 *         {
 *           id, sira,
 *           ad,          // 'Kaynak'|'Boya'|'Montaj'|'Elektrik'|'Test'|'Paketleme'
 *           sure,        // standart süre (dakika)
 *           makine,      // kullanılan ekipman/makine adı
 *           not
 *         }
 *       ],
 *
 *       iscilikStandartlari: {  // Operasyon başına standart süreler (dk)
 *         // Şimdi: ekMaliyetler.iscilik TRY olarak manuel girilir.
 *         // İleride: dakika × saatlik_ücret otomatik hesaplanır.
 *         // Örnek: { kaynak: 45, boya: 30, montaj: 120, test: 20 }
 *       }
 *       // ─────────────────────────────────────────────────────────
 *     }
 *   ],
 *   durum,               // 'taslak' | 'aktif' | 'pasif'
 *   notlar,
 *   olusturmaTarihi,
 *   guncellemeTarihi
 * }
 *
 * KULLANIM:
 *   Aktif satırlar:   bomAktifSatirlar(bomId)
 *   Belirli revizyon: bomRevizyon(bomId, '1.0')
 *   Maliyet (fire+):  bomMaliyet(bomId)
 *   Tam maliyet:      bomTamMaliyet(bomId, { iscilik, enerji, genelGider })
 */

function bomGetir(id){
  return ldBOM().find(b => b.id === id) || null;
}

/** Aktif revizyonun satır listesini döndür */
function bomAktifSatirlar(bomId){
  const bom = bomGetir(bomId);
  if(!bom) return [];
  const rev = bom.revizyonlar?.find(r => r.rev === bom.aktifRevizyon);
  return rev ? rev.satirlar : [];
}

/** Belirli bir revizyonun satır listesi */
function bomRevizyon(bomId, revNo){
  const bom = bomGetir(bomId);
  if(!bom) return null;
  return bom.revizyonlar?.find(r => r.rev === revNo) || null;
}

function urunBomları(urunId){
  return ldBOM().filter(b => b.mamulUrunId === urunId && b.durum !== 'pasif');
}

function aktifBom(urunId){
  return ldBOM().find(b => b.mamulUrunId === urunId && b.durum === 'aktif') || null;
}

/**
 * BOM malzeme maliyeti — fire dahil (v3.2)
 * Her satır için: miktar * (1 + fireOrani) * birim fiyat
 */
function bomMaliyet(bomId){
  const satirlar = bomAktifSatirlar(bomId);
  const urunler  = ldS('urun');
  return satirlar.reduce((top, s) => {
    const u = urunler.find(x => x.id === s.urunId);
    if(!u) return top;
    const fiyat      = u.par === 'TRY' ? u.alisFiyat : tlCevir(u.alisFiyat, u.par);
    const fireCarpan = 1 + (s.fireOrani || 0);
    return top + fiyat * s.miktar * fireCarpan;
  }, 0);
}

/**
 * TAM üretim maliyeti = malzeme + işçilik + enerji + genel gider (v3.2)
 *
 * @param {number} bomId
 * @param {object} ekMaliyetler  — opsiyonel ek kalemler (TRY)
 *   { iscilik: 500, enerji: 120, genelGider: 200 }
 * @returns {object}
 *   { malzeme, iscilik, enerji, genelGider, toplam, kalemler }
 */
function bomTamMaliyet(bomId, ekMaliyetler={}){
  const malzeme    = bomMaliyet(bomId);
  const iscilik    = ekMaliyetler.iscilik    || 0;
  const enerji     = ekMaliyetler.enerji     || 0;
  const genelGider = ekMaliyetler.genelGider || 0;
  const toplam     = malzeme + iscilik + enerji + genelGider;
  return {
    malzeme:    parseFloat(malzeme.toFixed(2)),
    iscilik:    parseFloat(iscilik.toFixed(2)),
    enerji:     parseFloat(enerji.toFixed(2)),
    genelGider: parseFloat(genelGider.toFixed(2)),
    toplam:     parseFloat(toplam.toFixed(2)),
    // Yüzde dağılım (toplam > 0 ise)
    kalemler: toplam > 0 ? {
      malzemePct:    Math.round(malzeme    / toplam * 100),
      iscilikPct:    Math.round(iscilik    / toplam * 100),
      enerjiPct:     Math.round(enerji     / toplam * 100),
      genelGiderPct: Math.round(genelGider / toplam * 100),
    } : null
  };
}

/**
 * Üretim öncesi stok yeterlilik kontrolü (v3.2)
 * - Fire oranı dahil gerçek miktar hesaplanır
 * - Ana ürün yetersizse alternatifUrunId'li ürünün stoğu kontrol edilir
 */
function bomStokKontrol(bomId, adet=1, depoId=null){
  const satirlar = bomAktifSatirlar(bomId);
  if(!satirlar.length) return { ok: false, eksikler: [] };
  const urunler  = ldS('urun');
  const eksikler = [];

  for(const s of satirlar){
    if(s.opsiyonel) continue;

    const fireCarpan  = 1 + (s.fireOrani || 0);
    const gereken     = parseFloat((s.miktar * fireCarpan * adet).toFixed(4));

    // Önce ana ürün stokunu kontrol et
    let mevcut        = urunStok(s.urunId, depoId);
    let kullanilanId  = s.urunId;

    // Ana ürün yetersiz + alternatif tanımlıysa → alternatifi dene
    if(mevcut < gereken && s.alternatifUrunId){
      const altMevcut = urunStok(s.alternatifUrunId, depoId);
      if(altMevcut >= gereken){
        mevcut       = altMevcut;
        kullanilanId = s.alternatifUrunId;
      }
    }

    if(mevcut < gereken){
      const u    = urunler.find(x => x.id === s.urunId);
      const uAlt = s.alternatifUrunId ? urunler.find(x => x.id === s.alternatifUrunId) : null;
      eksikler.push({
        urunId:           s.urunId,
        urunAd:           u?.ad || '?',
        alternatifUrunId: s.alternatifUrunId || null,
        alternatifAd:     uAlt?.ad || null,
        fireOrani:        s.fireOrani || 0,
        gereken,
        mevcut:           urunStok(s.urunId, depoId),
        fark:             parseFloat((gereken - urunStok(s.urunId, depoId)).toFixed(4)),
        birim:            s.birim || u?.birim || 'adet'
      });
    }
  }
  return { ok: eksikler.length === 0, eksikler };
}

/**
 * BOM'a yeni revizyon ekle.
 * Eski revizyonlar korunur, yeni revizyon aktif yapılır.
 *
 * @param {number} bomId
 * @param {Array}  yeniSatirlar  — yeni satır dizisi
 * @param {string} degisiklik    — değişiklik açıklaması
 * @param {string} yazan         — kullanıcı
 * @returns {object} güncellenmiş BOM
 */
function bomRevizyonEkle(bomId, yeniSatirlar, degisiklik='', yazan=SESSION_USER){
  const liste = ldBOM();
  const idx   = liste.findIndex(b => b.id === bomId);
  if(idx < 0) return null;
  const bom   = liste[idx];

  // Bir sonraki revizyon numarasını belirle (major.minor)
  const mevcut = bom.aktifRevizyon || '1.0';
  const [maj, min] = mevcut.split('.').map(Number);
  const yeniRev = `${maj}.${min + 1}`;

  bom.revizyonlar = bom.revizyonlar || [];
  bom.revizyonlar.push({
    rev: yeniRev,
    tarih: ts(),
    yazan,
    degisiklik: degisiklik || `Revizyon ${yeniRev}`,
    satirlar: yeniSatirlar
  });
  bom.aktifRevizyon   = yeniRev;
  bom.guncellemeTarihi = ts();

  liste[idx] = bom;
  svBOM(liste);
  return bom;
}

// ══════════════════════════════════════════════════════════════
//  10. ÜRETİM EMRİ YARDIMCILARI
// ══════════════════════════════════════════════════════════════

/**
 * Üretim emri şeması (v3.3):
 * {
 *   id, ueNo,              // belgeNo('UE') → 'UE-2026-0001'
 *   urunId, urunAd,
 *   bomId,
 *   bomRevizyon,           // hangi BOM revizyonu kullanıldı — üretim başlayınca kilitlenir
 *   adet,
 *   durum,                 // bkz. URETIM_DURUM_SIRASI
 *   oncelik,               // 'dusuk'|'normal'|'yuksek'|'acil'
 *   sorumluPersonel,       // üretimden sorumlu personel adı (v3.3)
 *   kkPersonel,            // kalite kontrol yapan personel adı (v3.3)
 *   planliBaslangic, planliTeslim,
 *   gercekBaslangic, gercekBitis,
 *   hedefDepoId,           // üretilen mamulün gideceği depo
 *   malzemeDepoId,         // hammaddenin çekileceği depo
 *   ekMaliyetler: { iscilik, enerji, genelGider },  // TRY
 *   islemler: [{ tarih, kullanici, not, durum }],
 *   olusturmaTarihi, guncellemeTarihi
 * }
 *
 * ── DURUM AKIŞI ────────────────────────────────────────────────
 *   planlandi → hazirlaniyor → uretimde → kalite_kontrol → tamamlandi
 *                                                        ↘ iptal (herhangi adımda)
 * ─────────────────────────────────────────────────────────────
 */

/** Üretim durumlarının sıralı listesi (akış sırası) */
const URETIM_DURUM_SIRASI = [
  'planlandi', 'hazirlaniyor', 'uretimde', 'kalite_kontrol', 'tamamlandi'
];

/**
 * Seri numarası kartı şeması (v3.3 — depoId eklendi):
 * {
 *   id, tip,              // 'sase'|'motor'|'batarya'|'kontrolcu'|'ekipman'
 *   no,                   // seri numarası string'i
 *   urunId,               // hangi ürün kartına ait
 *   durum,                // 'stokta'|'satildi'|'serviste'|'iptal'
 *   depoId,               // şu an hangi depoda (v3.3)
 *                         // durum='stokta' → depoId dolu olmalı
 *                         // durum='satildi' → depoId null
 *
 *   // Üretim bağı (v3.2)
 *   uretimId,             // hm_uretim kaydının id'si (null = manuel giriş)
 *   uretimNo,             // 'UE-2026-0042' (gösterim için)
 *
 *   // Satış/tedarik bilgisi
 *   cariId,               // tedarikçi veya müşteri cari id
 *   satisTarihi,
 *   garantiBitis,
 *   sonKullanici: { ad, telefon, adres },
 *   notlar,
 *   olusturmaTarihi, guncellemeTarihi
 * }
 */

/** Yeni seri numarası kaydı şablonu */
function yeniSeriSablonu(tip='sase'){
  return {
    id: null,
    tip,
    no: '',
    urunId: null,
    durum: 'stokta',
    depoId: null,          // v3.3: hangi depoda
    // Üretim bağı (v3.2)
    uretimId:  null,
    uretimNo:  null,
    // Satış/tedarik
    cariId:      null,
    satisTarihi: null,
    garantiBitis: null,
    sonKullanici: { ad:'', telefon:'', adres:'' },
    notlar: '',
    olusturmaTarihi: ts(),
    guncellemeTarihi: ts()
  };
}

function uretimEmriGetir(id){
  return ldURT().find(e => e.id === id) || null;
}

function uretimDurumRenk(durum){
  return {
    planlandi:       { bg:'#dbeafe', fg:'#1e40af' },
    hazirlaniyor:    { bg:'#fef9c3', fg:'#854d0e' },
    uretimde:        { bg:'#dcfce7', fg:'#166534' },
    kalite_kontrol:  { bg:'#f3e8ff', fg:'#6b21a8' },   // v3.3
    tamamlandi:      { bg:'#f0fdf4', fg:'#15803d' },
    iptal:           { bg:'#fee2e2', fg:'#991b1b' },
  }[durum] || { bg:'#f1f5f9', fg:'#475569' };
}

function uretimDurumAd(durum){
  return {
    planlandi:      'Planlandı',
    hazirlaniyor:   'Hazırlanıyor',
    uretimde:       'Üretimde',
    kalite_kontrol: 'Kalite Kontrol',   // v3.3
    tamamlandi:     'Tamamlandı',
    iptal:          'İptal'
  }[durum] || durum;
}

/**
 * Bir üretim emrinin bir sonraki geçerli durumunu döndürür.
 * @param {string} mevcutDurum
 * @returns {string|null} sonrakiDurum veya null (son adımda/iptal)
 */
function uretimSonrakiDurum(mevcutDurum){
  if(mevcutDurum === 'iptal') return null;
  const idx = URETIM_DURUM_SIRASI.indexOf(mevcutDurum);
  if(idx < 0 || idx === URETIM_DURUM_SIRASI.length - 1) return null;
  return URETIM_DURUM_SIRASI[idx + 1];
}

/**
 * Tamamlanan üretim emrini seri no kartlarına bağla (v3.2)
 * Üretim "tamamlandı" durumuna geçince çağrılır.
 *
 * @param {number} uretimId   — üretim emri id
 * @param {Array}  seriNolar  — bu üretimde oluşan seri no string dizisi
 *                              örn: ['HM2026-0001','HM2026-0002']
 * @returns {number} güncellenen seri kartı sayısı
 */
function uretimSeriKartlariBagla(uretimId, seriNolar=[]){
  const uretim = uretimEmriGetir(uretimId);
  if(!uretim) return 0;

  const seriListesi = JSON.parse(localStorage.getItem(STOK_DB.seri) || '[]');
  let guncellenen   = 0;

  for(const no of seriNolar){
    const idx = seriListesi.findIndex(s => s.no === no);
    if(idx < 0) continue;
    seriListesi[idx].uretimId       = uretimId;
    seriListesi[idx].uretimNo       = uretim.ueNo;
    seriListesi[idx].guncellemeTarihi = ts();
    guncellenen++;
  }

  if(guncellenen > 0)
    localStorage.setItem(STOK_DB.seri, JSON.stringify(seriListesi));

  return guncellenen;
}

/**
 * Bir üretim emrine bağlı tüm seri kartlarını döndürür.
 * @param {number} uretimId
 * @returns {Array} seri no kartları
 */
function uretimSeriKartlari(uretimId){
  try{
    const liste = JSON.parse(localStorage.getItem(STOK_DB.seri) || '[]');
    return liste.filter(s => s.uretimId === uretimId);
  }catch{ return []; }
}

// ══════════════════════════════════════════════════════════════
//  10b. SERİ NO HAREKET GEÇMİŞİ (v3.4)
// ══════════════════════════════════════════════════════════════

/**
 * Seri no hareket şeması (hm_seri_hareket):
 * {
 *   id,
 *   seriId,          // hm_seri kaydının id'si
 *   seriNo,          // seri numarası string'i (gösterim kolaylığı)
 *   tip,             // hareket tipi — bkz. SERI_HAREKET_TIP
 *   oncekiDurum,     // hareket öncesi durum/depo
 *   yeniDurum,       // hareket sonrası durum/depo
 *   oncekiDepoId,    // null = dışarıdan geliyor / depoda değildi
 *   yeniDepoId,      // null = satış/iptal ile depodan çıktı
 *   ilgiliId,        // bağlı kayıt id'si (uretimId, cariId, trId…)
 *   ilgiliNo,        // gösterim için: 'UE-2026-0001', 'SA-2026-0003'
 *   kullanici,
 *   not,
 *   tarih            // ISO timestamp
 * }
 *
 * SERI_HAREKET_TIP değerleri:
 *   giris_transit    → Çin'den mal kabul, transit depoya giriş
 *   karantina_girs   → Transit → Karantina
 *   kk_girs          → Karantina → Kalite Kontrol
 *   kk_onay          → KK geçti → Ana/Üretim Depoya
 *   kk_red           → KK reddedildi → geri Karantina
 *   uretim_girs      → Üretim emrine bağlandı (depoda rezerve edildi)
 *   uretim_cikis     → Üretimde kullanıldı / mamule dönüştü
 *   uretim_tamam     → Mamul olarak üretim deposuna girdi
 *   transfer         → Depo değişimi
 *   satis            → Müşteriye teslim / satış
 *   iade             → Müşteriden iade
 *   servis_girs      → Servise girdi
 *   servis_cikis     → Servisten çıktı
 *   iptal            → Seri no iptal edildi
 */
const SERI_HAREKET_TIP = {
  giris_transit:  { ad:'Giriş (Transit)',       renk:'#d97706' },
  karantina_girs: { ad:'Karantina Girişi',      renk:'#dc2626' },
  kk_girs:        { ad:'Kalite Kontrol Girişi', renk:'#7c3aed' },
  kk_onay:        { ad:'KK Onaylandı',          renk:'#16a34a' },
  kk_red:         { ad:'KK Reddedildi',         renk:'#dc2626' },
  uretim_girs:    { ad:'Üretim Rezerve',        renk:'#0891b2' },
  uretim_cikis:   { ad:'Üretimde Kullanıldı',   renk:'#0891b2' },
  uretim_tamam:   { ad:'Mamul Üretildi',        renk:'#16a34a' },
  transfer:       { ad:'Depo Transferi',        renk:'#1d4ed8' },
  satis:          { ad:'Satış',                 renk:'#059669' },
  iade:           { ad:'İade',                  renk:'#d97706' },
  servis_girs:    { ad:'Servise Girdi',         renk:'#6b7280' },
  servis_cikis:   { ad:'Servisten Çıktı',       renk:'#6b7280' },
  iptal:          { ad:'İptal',                 renk:'#9ca3af' },
};

/**
 * Seri no hareketi kaydet.
 * Her durum/konum değişikliğinde çağrılır.
 *
 * @param {number} seriId
 * @param {string} tip        — SERI_HAREKET_TIP anahtarı
 * @param {object} detay      — { oncekiDepoId, yeniDepoId, oncekiDurum, yeniDurum,
 *                               ilgiliId, ilgiliNo, not, kullanici }
 * @returns {object} oluşturulan hareket kaydı
 */
function seriHareketEkle(seriId, tip, detay={}){
  const seriListesi = JSON.parse(localStorage.getItem(STOK_DB.seri) || '[]');
  const seri        = seriListesi.find(s => s.id === seriId);
  if(!seri) return null;

  const liste = ldSH();
  const hrt = {
    id:            nid(liste),
    seriId,
    seriNo:        seri.no,
    tip,
    oncekiDurum:   detay.oncekiDurum   ?? seri.durum,
    yeniDurum:     detay.yeniDurum     ?? seri.durum,
    oncekiDepoId:  detay.oncekiDepoId  ?? seri.depoId ?? null,
    yeniDepoId:    detay.yeniDepoId    ?? null,
    ilgiliId:      detay.ilgiliId      ?? null,
    ilgiliNo:      detay.ilgiliNo      ?? null,
    kullanici:     detay.kullanici     ?? SESSION_USER,
    not:           detay.not           ?? '',
    tarih:         ts()
  };
  liste.unshift(hrt); // en yeni başta
  svSH(liste);

  // Seri kartını da güncelle
  const idx = seriListesi.findIndex(s => s.id === seriId);
  if(idx > -1){
    if(detay.yeniDurum)  seriListesi[idx].durum  = detay.yeniDurum;
    if(detay.yeniDepoId !== undefined) seriListesi[idx].depoId = detay.yeniDepoId;
    seriListesi[idx].guncellemeTarihi = ts();
    localStorage.setItem(STOK_DB.seri, JSON.stringify(seriListesi));
  }

  return hrt;
}

/**
 * Bir seri numarasının tüm hareket geçmişini döndürür (en yeni önce).
 * @param {number} seriId
 * @returns {Array}
 */
function seriHareketleri(seriId){
  return ldSH().filter(h => h.seriId === seriId);
}

/**
 * Bir seri numarasının şu an hangi konumda olduğunu özetle.
 * @param {number} seriId
 * @returns {{ durum, depoAd, sonHareket }}
 */
function seriKonum(seriId){
  try{
    const seriListesi = JSON.parse(localStorage.getItem(STOK_DB.seri) || '[]');
    const seri = seriListesi.find(s => s.id === seriId);
    if(!seri) return null;
    const depo = seri.depoId ? depoGetir(seri.depoId) : null;
    const sonHrt = ldSH().find(h => h.seriId === seriId) || null;
    return {
      durum:       seri.durum,
      depoId:      seri.depoId || null,
      depoAd:      depo?.ad || null,
      depoTipi:    depo?.depoTipi || null,
      sonHareket:  sonHrt
    };
  }catch{ return null; }
}

// ══════════════════════════════════════════════════════════════
//  11. ÜRÜN KARTI — TAM ŞEMA (v3.1)
// ══════════════════════════════════════════════════════════════

/**
 * Ürün kartı tam şeması:
 * {
 *   // — Temel (v1) —
 *   id, kod, barkod, ad, marka, model,
 *   birim,        // 'adet'|'kg'|'m'|'lt'|'takım'
 *   alisFiyat, satisFiyat, par, kdv,
 *   minStok, seriTakip, aktif, notlar,
 *
 *   // — Tedarik (v2) —
 *   ureticiKod,     // üreticinin verdiği parça numarası (v3.1 — EKLENDİ)
 *   depoYeri,       // raf/bölge kodu
 *   agirlik,        // kg
 *   boyutlar,       // '120x80x40 mm'
 *   tedarikSuresi,  // gün
 *   tedarikciId,    // hm_c'deki cari id
 *
 *   // — Sınıflandırma (v3) —
 *   urunTipi,       // 'hammadde'|'yardimci'|'yari_mamul'|'mamul'|'sarf'|'hizmet'
 *   kategoriId,     // hm_kategori.id  (teknik sınıf: Motor, Elektrik…)
 *   urunAilesiId,   // hm_urun_ailesi.id (ticari aile: Enduro X, City Pro…)
 *   varyant: { renk, beden, kapasite, voltaj, tip, diger },  // null veya obje
 *   bomId,          // varsayılan/aktif BOM (hm_bom.id)
 *
 *   // — Ürün ağacı (v3.2) —
 *   ustUrunId,      // KATEGORİ HİYERARŞİSİ için parent ürün id'si
 *                   // null = bağımsız / kök ürün
 *
 *   // ── ÖNEMLİ: ustUrunId ile BOM'un görevleri NET AYRI ──────
 *   //
 *   //   ustUrunId  → "Bu parça hangi ürün ailesine/kategorisine ait?"
 *   //                Katalog/kategori ağacı. Statik. Nadiren değişir.
 *   //                Örnek: Fren kaliperi → Fren Sistemi kategorisi
 *   //
 *   //   BOM satirlar → "Bu mamulü üretmek için hangi parçalar lazım?"
 *   //                  Üretim/reçete ilişkisi. Revizyonlu. Sık değişir.
 *   //                  Örnek: HM-250 reçetesi → Motor + Şasi + Batarya
 *   //
 *   //   Aynı parçayı hem ustUrunId hem BOM'a koyma.
 *   //   Motor'un ustUrunId'si null kalır; BOM'daki satır zaten
 *   //   üretim ilişkisini tanımlar.
 *   // ──────────────────────────────────────────────────────────
 *
 *   olusturmaTarihi, guncellemeTarihi
 * }
 *
 * ── ALAN FARKLARI ─────────────────────────────────────────────
 *   v3.1 YENİ: ureticiKod, kategoriId
 *   v3.2 YENİ: ustUrunId  (parent-child ürün ağacı)
 *   KORUNAN  : kategori   (eski kayıtlarla geriye dönük uyumluluk)
 * ─────────────────────────────────────────────────────────────
 */

function urunTipiAd(tip){
  return {
    hammadde:   'Hammadde',
    yardimci:   'Yardımcı Malzeme',
    yari_mamul: 'Yarı Mamul',
    mamul:      'Mamul',
    sarf:       'Sarf Malzeme',
    hizmet:     'Hizmet/İşçilik'
  }[tip] || tip || '—';
}

function urunTipiRenk(tip){
  return {
    hammadde:   { bg:'#dbeafe', fg:'#1e40af' },
    yardimci:   { bg:'#f3e8ff', fg:'#6b21a8' },
    yari_mamul: { bg:'#fef9c3', fg:'#854d0e' },
    mamul:      { bg:'#dcfce7', fg:'#166534' },
    sarf:       { bg:'#ffedd5', fg:'#9a3412' },
    hizmet:     { bg:'#f1f5f9', fg:'#475569' },
  }[tip] || { bg:'#f1f5f9', fg:'#64748b' };
}

function varyantEtiket(v){
  if(!v) return '';
  const p = [];
  if(v.renk)     p.push(v.renk);
  if(v.beden)    p.push(v.beden);
  if(v.kapasite) p.push(v.kapasite);
  if(v.voltaj)   p.push(v.voltaj + 'V');
  if(v.tip)      p.push(v.tip);
  if(v.diger)    p.push(v.diger);
  return p.join(' / ');
}

/** Yeni ürün kaydı şablonu — tüm alanları sıfır değerle */
function yeniUrunSablonu(){
  return {
    id: null, kod:'', barkod:'', ad:'', marka:'', model:'',
    birim:'adet',
    alisFiyat:0, satisFiyat:0, par:'USD', kdv:18,
    minStok:0, seriTakip:false, aktif:true, notlar:'',
    // Tedarik
    ureticiKod:'',
    depoYeri:'', agirlik:0, boyutlar:'', tedarikSuresi:0, tedarikciId:null,
    // Sınıflandırma
    urunTipi:'yardimci',
    kategoriId: null,
    urunAilesiId: null,
    varyant: null,
    bomId: null,
    // Ürün ağacı (v3.2)
    ustUrunId: null,   // null = kök ürün; dolu = alt parça/bileşen
    olusturmaTarihi: ts(),
    guncellemeTarihi: ts()
  };
}

/**
 * Bir ürünün doğrudan alt ürünlerini döndürür (tek seviye).
 * @param {number} urunId
 * @returns {Array} alt ürün kartları
 */
function altUrunler(urunId){
  return ldS('urun').filter(u => u.ustUrunId === urunId && u.aktif !== false);
}

/**
 * Bir ürünün tüm torunlarını (alt + alt'ın altı…) derinlik-önce döndürür.
 * Döngüsel referans koruması: ziyaret edilenleri takip eder.
 * @param {number} urunId
 * @returns {Array} { urun, seviye } dizisi
 */
function urunAgaci(urunId, _ziyaret=new Set(), _seviye=0){
  if(_ziyaret.has(urunId)) return [];
  _ziyaret.add(urunId);
  const sonuc = [];
  for(const alt of altUrunler(urunId)){
    sonuc.push({ urun: alt, seviye: _seviye });
    sonuc.push(...urunAgaci(alt.id, _ziyaret, _seviye + 1));
  }
  return sonuc;
}

/**
 * Bir ürünün kök (en üst) ürününü bulur.
 * @param {number} urunId
 * @returns {object} kök ürün kartı
 */
function kokUrun(urunId){
  const urunler = ldS('urun');
  let u = urunler.find(x => x.id === urunId);
  const ziyaret = new Set();
  while(u && u.ustUrunId && !ziyaret.has(u.id)){
    ziyaret.add(u.id);
    u = urunler.find(x => x.id === u.ustUrunId);
  }
  return u || null;
}

// ══════════════════════════════════════════════════════════════
//  12. ÖRNEK VERİ YÜKLEME
// ══════════════════════════════════════════════════════════════

function stokVeriYukle(){
  if(!ldS('depo').length) svS('depo',[
    {id:1,ad:'Ana Depo',        kod:'DEPO-1',konum:'Antalya Fabrika',  acik:'Ana hammadde ve mamul deposu', depoTipi:'ana',       kabul:true, sevkiyat:true, karantina:false,aktif:true},
    {id:2,ad:'Üretim Deposu',   kod:'DEPO-2',konum:'Antalya Fabrika',  acik:'Üretim hattı yan depo',        depoTipi:'uretim',    kabul:false,sevkiyat:false,karantina:false,aktif:true},
    {id:3,ad:'Kalite Kontrol',  kod:'DEPO-3',konum:'Antalya Fabrika',  acik:'KK bekleyen ürünler',          depoTipi:'kk',        kabul:true, sevkiyat:false,karantina:false,aktif:true},
    {id:4,ad:'Karantina',       kod:'DEPO-4',konum:'Antalya Fabrika',  acik:'Reddedilen/şüpheli ürünler',   depoTipi:'karantina', kabul:false,sevkiyat:false,karantina:true, aktif:true},
    {id:5,ad:'Çin Transit',     kod:'DEPO-5',konum:'Guangzhou / ZJ',   acik:"Çin'den gelen transit mal",    depoTipi:'transit',   kabul:true, sevkiyat:false,karantina:false,aktif:true},
    {id:6,ad:'Servis Deposu',   kod:'DEPO-6',konum:'Antalya Servis',   acik:'Servis merkezi deposu',        depoTipi:'servis',    kabul:true, sevkiyat:true, karantina:false,aktif:true},
    {id:7,ad:'Yedek Parça',     kod:'DEPO-7',konum:'Antalya Fabrika',  acik:'Yedek parça ve sarf deposu',   depoTipi:'yedek',     kabul:true, sevkiyat:true, karantina:false,aktif:true},
  ]);

  if(!ldS('urun').length) svS('urun',[
    {id:1,kod:'MTR-001',barkod:'8690001000010',ad:'250cc Motor Bloğu',      marka:'GZ Motor',model:'GZM-250', birim:'adet',alisFiyat:850,  satisFiyat:1200,par:'USD',kdv:18,minStok:5,  seriTakip:true, aktif:true,notlar:'',ureticiKod:'GZM250-BLOK',  urunTipi:'hammadde',  kategoriId:1,urunAilesiId:null,varyant:null,                         bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
    {id:2,kod:'SAS-001',barkod:'8690001000027',ad:'Enduro Şasi Çerçevesi',  marka:'HM',      model:'HM-250',  birim:'adet',alisFiyat:420,  satisFiyat:650, par:'USD',kdv:18,minStok:10, seriTakip:true, aktif:true,notlar:'',ureticiKod:'HM250-SASI',   urunTipi:'yari_mamul',kategoriId:2,urunAilesiId:1,   varyant:{renk:'Siyah'},      bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
    {id:3,kod:'FRN-001',barkod:'8690001000034',ad:'Ön Fren Diski 220mm',    marka:'Zhejiang',model:'ZH-220',  birim:'adet',alisFiyat:45,   satisFiyat:80,  par:'USD',kdv:18,minStok:20, seriTakip:false,aktif:true,notlar:'',ureticiKod:'ZH220-DISK',   urunTipi:'yardimci',  kategoriId:3,urunAilesiId:null,varyant:null,                         bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
    {id:4,kod:'ELK-001',barkod:'8690001000041',ad:'72V 45Ah Lityum Batarya',marka:'CATL',    model:'CL-7245', birim:'adet',alisFiyat:1100, satisFiyat:1600,par:'USD',kdv:18,minStok:8,  seriTakip:true, aktif:true,notlar:'',ureticiKod:'CL7245-BAT',   urunTipi:'hammadde',  kategoriId:4,urunAilesiId:null,varyant:{voltaj:'72',kapasite:'45Ah'},bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
    {id:5,kod:'MMR-001',barkod:'8690001000058',ad:'HM-250 Enduro Motorsiklet',marka:'HURRA', model:'HM-250',  birim:'adet',alisFiyat:0,    satisFiyat:4800,par:'USD',kdv:18,minStok:2,  seriTakip:true, aktif:true,notlar:'Bitmiş ürün',ureticiKod:'HM250-ENDURO',urunTipi:'mamul',  kategoriId:5,urunAilesiId:1,   varyant:{renk:'Kırmızı/Siyah'},bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
    {id:6,kod:'SRF-001',barkod:'8690001000065',ad:'Motor Yağı 10W-40 (1L)', marka:'Mobil',  model:'M10W40',birim:'lt',  alisFiyat:8,   satisFiyat:14,  par:'USD',kdv:20,minStok:50, seriTakip:false,aktif:true,notlar:'',ureticiKod:'MOB-10W40-1L', urunTipi:'sarf',      kategoriId:6,urunAilesiId:null,varyant:null,bomId:null,ustUrunId:null,olusturmaTarihi:ts(),guncellemeTarihi:ts()},
  ]);
}

/**
 * Kategori örnek verisi (v3.1)
 * Teknik sınıflandırma — Ürün ailesinden BAĞIMSIZ
 */
function kategoriVeriYukle(){
  if(ldKAT().length) return;
  svKAT([
    {id:1,sistemKodu:'MOTOR',      ad:'Motor & Aktarma',   aciklama:'Motor bloğu, şanzıman, kavrama',       renk:'#7c3aed',simge:'⚙️', aktif:true,olusturmaTarihi:ts()},
    {id:2,sistemKodu:'SASI',       ad:'Şasi & Kaporta',    aciklama:'Çerçeve, plastik panel, braketi',     renk:'#0369a1',simge:'🔩',aktif:true,olusturmaTarihi:ts()},
    {id:3,sistemKodu:'FREN',       ad:'Fren Sistemi',      aciklama:'Disk, kaliper, balata, hidrolik',      renk:'#dc2626',simge:'🛑',aktif:true,olusturmaTarihi:ts()},
    {id:4,sistemKodu:'ELEKTRIK',   ad:'Elektrik & Batarya',aciklama:'Kablo demeti, kontrolcü, batarya',    renk:'#d97706',simge:'⚡',aktif:true,olusturmaTarihi:ts()},
    {id:5,sistemKodu:'MAMUL',      ad:'Bitmiş Ürün',       aciklama:'Satışa hazır komple araç',            renk:'#16a34a',simge:'🏍️',aktif:true,olusturmaTarihi:ts()},
    {id:6,sistemKodu:'SARF',       ad:'Sarf Malzeme',      aciklama:'Yağ, temizleyici, conta, yapıştırıcı',renk:'#6b7280',simge:'🪣',aktif:true,olusturmaTarihi:ts()},
    {id:7,sistemKodu:'SUSPANSIYON',ad:'Süspansiyon',       aciklama:'Amortisör, yay, salıncak',            renk:'#0891b2',simge:'🔧',aktif:true,olusturmaTarihi:ts()},
    {id:8,sistemKodu:'YAKIT',      ad:'Yakıt & Hava',      aciklama:'Karbüratör, filtre, depo, boru',      renk:'#059669',simge:'⛽',aktif:true,olusturmaTarihi:ts()},
  ]);
}

/**
 * Ürün ailesi örnek verisi (v3.1)
 * Ticari/pazarlama gruplaması — Kategoriden BAĞIMSIZ
 */
function urunAilesiVeriYukle(){
  if(ldUA().length) return;
  svUA([
    {id:1,sistemKodu:'ENDURO_X',      ad:'Enduro X',       aciklama:'HM-250 ve üzeri off-road enduro serisi',      renk:'#1d4ed8',simge:'🏍️',aktif:true,olusturmaTarihi:ts()},
    {id:2,sistemKodu:'CITY_PRO',      ad:'City Pro',       aciklama:'Şehir içi elektrikli motorsiklet serisi',     renk:'#0e7490',simge:'🛵',aktif:true,olusturmaTarihi:ts()},
    {id:3,sistemKodu:'CARGO_MAX',     ad:'Cargo Max',      aciklama:'Yük ve ticari kullanım serisi',               renk:'#78350f',simge:'📦',aktif:true,olusturmaTarihi:ts()},
    {id:4,sistemKodu:'DELIVERY_PRO',  ad:'Delivery Pro',   aciklama:'Kurye ve teslimat araçları serisi',           renk:'#15803d',simge:'🚀',aktif:true,olusturmaTarihi:ts()},
    {id:5,sistemKodu:'GENEL',         ad:'Genel / Ortak',  aciklama:'Belirli bir aileye bağlı olmayan parçalar',   renk:'#6b7280',simge:'🔩',aktif:true,olusturmaTarihi:ts()},
  ]);
}

/** BOM örnek verisi (v3.1 — revizyon geçmişiyle) */
function bomVeriYukle(){
  if(ldBOM().length) return;
  const satirlar_v1_0 = [
    {id:1,urunId:1,miktar:1,  birim:'adet',not:'250cc motor bloğu',          opsiyonel:false,alternatifUrunId:null,fireOrani:0},
    {id:2,urunId:2,miktar:1,  birim:'adet',not:'Enduro şasi çerçevesi',       opsiyonel:false,alternatifUrunId:null,fireOrani:0},
    {id:3,urunId:3,miktar:2,  birim:'adet',not:'Ön+arka fren diski',          opsiyonel:false,alternatifUrunId:null,fireOrani:0.02},
    {id:4,urunId:4,miktar:1,  birim:'adet',not:'72V 45Ah batarya (alt: 60Ah)',opsiyonel:false,alternatifUrunId:null,fireOrani:0},
    {id:5,urunId:6,miktar:2,  birim:'lt',  not:'Motor yağı dolumu',           opsiyonel:false,alternatifUrunId:null,fireOrani:0.05},
  ];
  svBOM([{
    id:1, kod:'BOM-2026-0001', ad:'HM-250 Enduro — Ana Reçete',
    mamulUrunId:5,
    aktifRevizyon:'1.0',
    satirlar: satirlar_v1_0,           // top-level: mrpHesapla ve diğer fonksiyonlar bunu okur
    revizyonlar:[{
      rev:'1.0',
      tarih:ts(),
      yazan:SESSION_USER,
      degisiklik:'İlk yayın',
      satirlar: satirlar_v1_0
    }],
    durum:'aktif',
    notlar:'Standart montaj reçetesi. Elektrik kiti ve plastikler ayrı BOM.',
    olusturmaTarihi:ts(), guncellemeTarihi:ts()
  }]);
  // Mamul ürüne BOM bağla
  const urunler = ldS('urun');
  const idx     = urunler.findIndex(u => u.id === 5);
  if(idx > -1){ urunler[idx].bomId = 1; svS('urun', urunler); }
}

/** Örnek cari/tedarikçi verilerini yükle */
function cariVeriYukle(){
  if(ld('c').length) return;
  sv('c', [
    { id:1, ad:'Motopart Yedek Parça A.Ş.', kisa:'Motopart', tip:'tedarikci',
      vergiNo:'1234567890', vergiDairesi:'Kadıköy',
      ulke:'Türkiye', sehir:'İstanbul', adres:'Kadıköy Sanayi Sit. B-12',
      telefon:'0216 555 01 01', email:'satis@motopart.com.tr',
      not:'Ana motor parçaları tedarikçisi', aktif:true, olusturmaTarihi:ts() },
    { id:2, ad:'Euro Chassis GmbH', kisa:'EuroChassis', tip:'tedarikci',
      vergiNo:'DE987654321', vergiDairesi:'Hamburg',
      ulke:'Almanya', sehir:'Hamburg', adres:'Industriestr. 44, Hamburg',
      telefon:'+49 40 555 2020', email:'orders@eurochassis.de',
      not:'İthal şasi tedarikçisi', aktif:true, olusturmaTarihi:ts() },
    { id:3, ad:'Bremsa Fren Sistemleri Ltd.', kisa:'Bremsa', tip:'tedarikci',
      vergiNo:'9876543210', vergiDairesi:'Bursa',
      ulke:'Türkiye', sehir:'Bursa', adres:'Organize Sanayi Bölgesi 5. Cad.',
      telefon:'0224 555 03 03', email:'info@bremsa.com.tr',
      not:'Fren diski ve sistem tedarikçisi', aktif:true, olusturmaTarihi:ts() },
    { id:4, ad:'KoreaBatt Co. Ltd.', kisa:'KoreaBatt', tip:'tedarikci',
      vergiNo:'KR-12345678', vergiDairesi:'Seoul',
      ulke:'Güney Kore', sehir:'Seoul', adres:'123 Battery-ro, Gangnam-gu',
      telefon:'+82 2 555 4444', email:'export@koreabatt.kr',
      not:'Lityum batarya tedarikçisi', aktif:true, olusturmaTarihi:ts() },
    { id:5, ad:'HurraMotor Bayi İstanbul', kisa:'HM-İst', tip:'musteri',
      vergiNo:'5555555555', vergiDairesi:'Şişli',
      ulke:'Türkiye', sehir:'İstanbul', adres:'Şişli Motorsiklet Çarşısı No:8',
      telefon:'0212 555 05 05', email:'istanbul@hurrabayi.com.tr',
      not:'Yetkili İstanbul bayisi', aktif:true, olusturmaTarihi:ts() },
  ]);
}

/** Tek çağrıyla tüm örnek verileri yükle */
function ornekVerileriYukle(){
  stokVeriYukle();
  kategoriVeriYukle();
  urunAilesiVeriYukle();
  bomVeriYukle();
  cariVeriYukle();
}

// ══════════════════════════════════════════════════════════════
//  13. NAVİGASYON & UI YARDIMCILARI
// ══════════════════════════════════════════════════════════════

const NAV_GROUPS = [
  { single:true, id:'dashboard', href:'dashboard.html', label:'🏠 Dashboard', menuGroup:null },
  { label:'💰 Finans', ids:['kasa','cariler','ceksenet','kur'], menuGroup:'finans', items:[
    { id:'kasa',     href:'kasa.html',      label:'💰 Kasa' },
    { id:'cariler',  href:'cariler.html',   label:'👥 Cariler' },
    { id:'ceksenet', href:'ceksenet.html',  label:'📄 Çek/Senet' },
    { id:'kur',      href:'kur.html',       label:'💱 Kur Yönetimi' },
  ]},
  { label:'🛒 Satın Alma', ids:['satinalma','ithalat'], menuGroup:'satin_alma', items:[
    { id:'satinalma', href:'satinalma.html', label:'🛒 Yerli Satın Alma', menuGroup:'satin_alma' },
    { id:'ithalat',   href:'ithalat.html',   label:'🚢 İthalat Yönetimi',  menuGroup:'ithalat' },
  ]},
  { label:'📦 Stok', ids:['stok','seri','urun-ailesi','bom'], menuGroup:'stok', items:[
    { id:'stok',        href:'stok.html',        label:'📦 Stok' },
    { id:'seri',        href:'seri.html',         label:'🔢 Seri No' },
    { id:'urun-ailesi', href:'urun-ailesi.html',  label:'🗂️ Ürün Ailesi' },
    { id:'bom',         href:'bom.html',          label:'📋 Reçeteler' },
  ]},
  { label:'🏭 Üretim & AI', ids:['uretim','evrak','ai-asistan','ai'], menuGroup:'uretim', items:[
    { id:'uretim',     href:'uretim.html',     label:'🏭 Üretim Yönetimi', menuGroup:'uretim' },
    { id:'evrak',      href:'evrak.html',       label:'🤖 AI Evrak Asistanı', menuGroup:'sistem' },
    { id:'ai-asistan', href:'ai-asistan.html',  label:'🧠 AI Operasyon Merkezi', menuGroup:'sistem' },
    { id:'ai',         href:'ai.html',          label:'🤖 AI Merkezi (v4.0)', menuGroup:'sistem' },
  ]},
  { label:'👥 İK & Varlık', ids:['personel','varlik'], menuGroup:'personel', items:[
    { id:'personel', href:'personel.html', label:'👥 Personel Yönetimi' },
    { id:'varlik',   href:'varlik.html',   label:'🏗️ Varlık Yönetimi' },
  ]},
  { single:true, id:'bildirim', href:'bildirim.html', label:'🔔 Bildirimler', menuGroup:'sistem' },
  { single:true, id:'saglik',   href:'saglik.html',   label:'❤️ Sistem Sağlığı', menuGroup:'sistem' },
  { single:true, id:'ayarlar',  href:'ayarlar.html',  label:'⚙️ Ayarlar', menuGroup:'yonetim' },
  { single:true, id:'admin',    href:'admin.html',    label:'🛡️ Yönetici Paneli', menuGroup:'yonetim', adminOnly:true },
];

function buildNav(activeId){
  const nav = document.getElementById('main-nav') || document.getElementById('nav-root');
  if(!nav) return;
  if(!document.getElementById('nav-dd-css')){
    const s = document.createElement('style');
    s.id = 'nav-dd-css';
    s.textContent = `
      .nav-g{position:relative;display:inline-flex}
      /* top:100% + padding-top:8px = görsel boşluk ama hover kesintisiz */
      .nav-dd{position:absolute;top:100%;left:0;background:var(--s);border:1px solid var(--bd);border-radius:var(--R);min-width:168px;box-shadow:0 6px 20px rgba(0,0,0,.13);display:none;z-index:500;padding:8px 4px 4px 4px}
      .nav-g.open .nav-dd{display:block}
      /* hover bridge: button ile dropdown arasındaki boşluğu kapatır */
      .nav-g::after{content:'';position:absolute;top:100%;left:0;right:0;height:8px}
      .nav-g-btn{background:none;border:none;color:var(--t2);font-family:var(--fn);font-size:12px;font-weight:500;padding:5px 10px;border-radius:var(--Rs);cursor:pointer;transition:all .12s;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
      .nav-g-btn:hover,.nav-g.open .nav-g-btn{background:var(--s2);color:var(--t)}
      .nav-g-btn.on{background:var(--bld);color:var(--bl);font-weight:600}
      .nav-g-chv{transition:transform .15s;opacity:.6}
      .nav-g.open .nav-g-chv{transform:rotate(180deg);opacity:1}
      .nav-dd a{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:5px;font-size:12px;font-weight:500;color:var(--t2);text-decoration:none;transition:all .1s;white-space:nowrap}
      .nav-dd a:hover{background:var(--s2);color:var(--t);text-decoration:none}
      .nav-dd a.nav-active{background:var(--bld);color:var(--bl)}
      .hnav{display:inline-flex;align-items:center;padding:5px 10px;border-radius:var(--Rs);font-size:12px;font-weight:500;color:var(--t2);text-decoration:none;transition:all .12s;white-space:nowrap}
      .hnav:hover{background:var(--s2);color:var(--t);text-decoration:none}
      .hnav.nav-active{background:var(--bld);color:var(--bl);font-weight:600}
    `;
    document.head.appendChild(s);
  }
  const chv = `<svg class="nav-g-chv" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3.5 5,6.5 8,3.5"/></svg>`;
  // adminOnly menü öğelerini yetki kontrolüne göre filtrele
  const curUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const isAdmin = curUser && curUser.role === 'admin';
  // IZIN entegrasyonu — izin.js yüklüyse kullan, yoksa eski davranış
  const izinAktif = typeof IZIN !== 'undefined';
  function _menuGoster(g) {
    if (g.adminOnly && !isAdmin) return false;
    if (!izinAktif) return true;
    if (!g.menuGroup) return true;  // dashboard vb.
    return IZIN.menu(g.menuGroup);
  }
  function _sayfaGoster(id) {
    if (!izinAktif) return true;
    return IZIN.sayfa(id);
  }
  const visGroups = NAV_GROUPS.filter(g => _menuGoster(g));
  nav.innerHTML = visGroups.map(g => {
    if(g.single){
      if (!_sayfaGoster(g.id)) return '';
      return `<a href="${g.href}" class="hnav${g.id===activeId?' nav-active':''}">${g.label}</a>`;
    }
    // Dropdown grubundaki görünür item'ları filtrele
    const visItems = g.items.filter(i => {
      if (i.menuGroup && !IZIN.menu(i.menuGroup)) return false;
      return _sayfaGoster(i.id);
    });
    if (visItems.length === 0) return '';
    const on = g.ids.includes(activeId);
    return `<div class="nav-g"><button class="nav-g-btn${on?' on':''}">${g.label}${chv}</button><div class="nav-dd">${visItems.map(i=>`<a href="${i.href}" class="${i.id===activeId?'nav-active':''}">${i.label}</a>`).join('')}</div></div>`;
  }).join('');
  // JS hover — CSS :hover yerine JS delay ile stabil dropdown
  let _closeTimer;
  nav.querySelectorAll('.nav-g').forEach(g => {
    g.addEventListener('mouseenter', () => {
      clearTimeout(_closeTimer);
      nav.querySelectorAll('.nav-g').forEach(x => x.classList.remove('open'));
      g.classList.add('open');
    });
    g.addEventListener('mouseleave', () => {
      _closeTimer = setTimeout(() => g.classList.remove('open'), 180);
    });
    // dropdown'a girilirse timer iptal
    const dd = g.querySelector('.nav-dd');
    if(dd){
      dd.addEventListener('mouseenter', () => clearTimeout(_closeTimer));
      dd.addEventListener('mouseleave', () => {
        _closeTimer = setTimeout(() => g.classList.remove('open'), 180);
      });
    }
  });
  // nav dışına çıkılırsa tüm dropdownları kapat
  nav.addEventListener('mouseleave', () => {
    _closeTimer = setTimeout(() => {
      nav.querySelectorAll('.nav-g').forEach(x => x.classList.remove('open'));
    }, 200);
  });
  nav.addEventListener('mouseenter', () => clearTimeout(_closeTimer));
}

function toast(msg, dur=2400, type='info'){
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id)?.classList.add('hidden');    }

function toggleDark(){
  const d     = document.documentElement;
  const dark  = d.getAttribute('data-theme') === 'dark';
  d.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('hm_theme', dark ? 'light' : 'dark');
}

function applyTheme(){
  document.documentElement.setAttribute(
    'data-theme',
    localStorage.getItem('hm_theme') || 'light'
  );
}

// ══════════════════════════════════════════════════════════════
//  14. LOG
// ══════════════════════════════════════════════════════════════

function log(modul, islem, detay=''){
  const liste = ld('log');
  liste.unshift({ id: nid(liste), ts: ts(), modul, islem, detay });
  if(liste.length > 500) liste.length = 500;
  sv('log', liste);
}

// ══════════════════════════════════════════════════════════════
//  15. BAŞLANGIÇ
// ══════════════════════════════════════════════════════════════

(function init(){
  applyTheme();
  if(!location.pathname.endsWith('index.html') && location.pathname !== '/'){
    if(!checkSession()) location.href = 'index.html';
  }
  kurCek().catch(() => {});
})();

// ══════════════════════════════════════════════════════════════
// 16. EKSİK FONKSİYON DÜZELTMELERİ (v3.2 → v3.3 uyum katmanı)
// HTML sayfaları bu isimleri kullanıyor ama core'da farklı adlar vardı.
// ══════════════════════════════════════════════════════════════

// ── Oturum alias'ları ──────────────────────────────────────────
/** index.html, dashboard ve tüm sayfalarda kullanılan oturum kontrolü */
function sessionKontrol(){ return checkSession(); }

/** index.html'de oturum açma sonrası çağrılır */
function sessionKur(remember){ return setSession(remember); }

/** Çıkış butonu (tüm sayfalarda onclick="cikisYap()") */
function cikisYap(){ window.logout(); }

// ── Para formatı alias ─────────────────────────────────────────
/** fmtTL ile aynı; tüm sayfalarda fmtTRY kullanılıyor */
function fmtTRY(n){ return fmtTL(n); }

// ── Navigasyon alias ──────────────────────────────────────────
/** buildNav ile aynı; tüm sayfalarda headerRender çağrılıyor */
function headerRender(activeId){ return buildNav(activeId); }

// ── Kasa bakiye ───────────────────────────────────────────────
/**
 * Nakit kasa bakiyesini döviz bazında döndürür.
 * Kasa bakiyesi hareketlerden değil, doğrudan hm_kasa
 * anahtarından (object) okunur — kasaHrtKaydet buraya yazar.
 * @returns {{ TRY: number, USD: number, EUR: number, ... }}
 */
function kasaTumBakiye(){
  try{ return JSON.parse(localStorage.getItem(DB.kasa)) || {}; }
  catch{ return {}; }
}

/** Belirli bir para biriminin nakit kasa bakiyesi */
function kasaBakiye(par){
  return kasaTumBakiye()[par] || 0;
}

// ── Banka bakiye ──────────────────────────────────────────────
/**
 * Bir bankanın para birimi bazında bakiyesini döndürür.
 * @param {number} bankaId
 * @returns {{ TRY: number, USD: number, EUR: number, ... }}
 */
function bankaBakC(bankaId){
  const hrts = ld('bh').filter(h => h.bid === bankaId && !h.sil);
  const bak = {};
  hrts.forEach(h => {
    const p = h.par || 'TRY';
    if(!bak[p]) bak[p] = 0;
    bak[p] += (h.yon === 'giris' ? 1 : -1) * (h.tutar || 0);
  });
  return bak;
}

/**
 * Bir bankanın TRY cinsinden toplam bakiyesi.
 * @param {number} bankaId
 * @returns {number}
 */
function bankaTRY(bankaId){
  const hrts = ld('bh').filter(h => h.bid === bankaId && !h.sil);
  return hrts.reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * (h.try_ || 0), 0);
}

// ── Cari bakiye ───────────────────────────────────────────────
/**
 * Bir carinin TRY net bakiyesi.
 * Pozitif = biz alacaklıyız (müşteri borçlu).
 * Negatif = biz borçluyuz (tedarikçiye borcumuz var).
 * @param {number} cariId
 * @returns {number}
 */
function cariBakTRY(cariId){
  const hs = ld('h').filter(h => h.cid === cariId && !h.sil);
  const alacak = hs.filter(h => h.yon === 'alacak').reduce((t, h) => t + (h.try_ || 0), 0);
  const borc   = hs.filter(h => h.yon === 'borc').reduce((t, h) => t + (h.try_ || 0), 0);
  return alacak - borc;
}

// ── Veri yükleme yardımcıları ─────────────────────────────────
/** Dashboard DOMContentLoaded'da çağrılır; cari örnek verisi yoksa no-op */
function veriYukle(){ /* Cari verileri kullanıcı tarafından girilir — örnek veri yok */ }

/** Satın alma sayfası ve dashboard için — örnek veri yoksa no-op */
function saVeriYukle(){ /* Satın alma verileri kullanıcı tarafından girilir */ }

// ── Şifre yönetimi ────────────────────────────────────────────
/**
 * SHA-256 hash üretir (Web Crypto API).
 * @param {string} text
 * @returns {Promise<string>} hex string
 */
async function sha256(text){
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/**
 * Giriş doğrulama — index.html tarafından çağrılır.
 * Şifre hm_ay.__pwHash'e SHA-256 olarak saklanır.
 * İlk girişte (hash henüz yok) varsayılan şifre: hurra2026
 * @param {string} user
 * @param {string} pass
 * @returns {Promise<boolean>}
 */
async function loginKontrol(user, pass){
  if(user !== SESSION_USER) return false;
  const ay  = ldObj('ay');
  const stored = ay.__pwHash;
  const input  = await sha256(pass);
  if(!stored){
    // İlk kullanım — varsayılan şifre: hurra2026
    const def = await sha256('hurra2026');
    return input === def;
  }
  return input === stored;
}

/**
 * Şifre değiştirme — ayarlar.html sifreDegistirAsync tarafından çağrılır.
 * @param {string} eski — mevcut şifre
 * @param {string} user — kullanıcı adı (SESSION_USER ile eşleşmeli)
 * @param {string} yeni — yeni şifre
 * @returns {Promise<{ok:boolean, msg:string}>}
 */
async function sifreDegistir(eski, user, yeni){
  if(user !== SESSION_USER) return { ok:false, msg:'Kullanıcı adı yanlış' };
  const gecerli = await loginKontrol(user, eski);
  if(!gecerli) return { ok:false, msg:'Mevcut şifre yanlış' };
  if(yeni.length < 6) return { ok:false, msg:'Yeni şifre en az 6 karakter olmalı' };
  const hash = await sha256(yeni);
  const ay = ldObj('ay');
  ay.__pwHash = hash;
  sv('ay', ay);
  return { ok:true, msg:'Şifre güncellendi' };
}


// ══════════════════════════════════════════════════════════════
// 17. MODAL, LOG, AYAR VE DİĞER EKSİK FONKSİYONLAR
// ══════════════════════════════════════════════════════════════

// ── Oturum kimlik bilgileri ───────────────────────────────────
/**
 * Aktif oturumun kullanıcı adını döndürür.
 * ayarlar.html guvenlikHTML() tarafından çağrılır.
 * @returns {{ user: string }}
 */
function getCredentials(){
  try{
    const s = JSON.parse(localStorage.getItem(SESSION_KEY))
           || JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if(s && s.user) return { user: s.user };
  }catch{}
  return { user: SESSION_USER };
}

// ── Modal alias'ları ──────────────────────────────────────────
/** Tüm sayfalar modalAc/modalKapat kullanıyor, core'da openModal/closeModal var */
function modalAc(id){ return openModal(id); }
function modalKapat(id){ return closeModal(id); }

// ── Log alias ─────────────────────────────────────────────────
/**
 * logEkle(modul, cariId, detay)
 * core.js'deki log(modul, islem, detay) fonksiyonuna uyar.
 * cariId'yi islem olarak geçirir.
 */
function logEkle(modul, cariId, detay){
  log(modul, cariId != null ? String(cariId) : '', detay || {});
}

// ── Cari bakiye (döviz bazlı) ─────────────────────────────────
/**
 * Bir carinin tüm para birimleri için net bakiyesini döndürür.
 * Pozitif = biz alacaklıyız, Negatif = biz borçluyuz.
 * @param {number} cariId
 * @returns {{ TRY: number, USD: number, EUR: number, ... }}
 */
function cariBakC(cariId){
  const hs = ld('h').filter(h => h.cid === cariId && !h.sil);
  const bak = {};
  hs.forEach(h => {
    const p = h.par || 'TRY';
    if(!bak[p]) bak[p] = 0;
    bak[p] += (h.yon === 'alacak' ? 1 : -1) * (h.tutar || 0);
  });
  return bak;
}

// ── Kasa güncelle ─────────────────────────────────────────────
/**
 * Nakit kasa bakiyesini günceller ve otomatik kasa hareketi kaydeder.
 * cariler.html, ceksenet.html gibi modüllerden çağrılır.
 *
 * @param {string} yon      'alacak' → kasa artar | 'borc' → kasa azalır
 * @param {string} tip      'nakit' (şimdilik sadece nakit destekleniyor)
 * @param {number} tutar    Miktar
 * @param {string} par      Para birimi: 'TRY', 'USD', 'EUR', 'CNY'
 * @param {string} acik     Açıklama
 */
function kasaGuncelle(yon, tip, tutar, par, acik){
  if(!tutar || tutar <= 0) return;
  const kasa = kasaTumBakiye();
  if(!kasa[par]) kasa[par] = 0;
  kasa[par] += (yon === 'alacak' ? 1 : -1) * tutar;
  localStorage.setItem(DB.kasa, JSON.stringify(kasa));

  // Otomatik kasa hareketi
  const hrts = ld('kh');
  hrts.push({
    id: nid(hrts),
    tip: yon === 'alacak' ? 'giris' : 'cikis',
    tutar, par,
    tarih: today(),
    acik: acik || '',
    bno: '',
    auto: true,
    sil: false,
    cat: ts()
  });
  sv('kh', hrts);
}

// ── Ödeme bakiye kontrolü ─────────────────────────────────────
/**
 * Ödeme yapılmadan önce kasa/banka bakiyesi yeterli mi kontrol eder.
 * cariler.html kasaKontrolAnlik ve hrtKaydet'te kullanılır.
 *
 * @param {string} tip      'nakit' | 'havale' | 'kart' | 'cek' | 'senet'
 * @param {number} tutar
 * @param {string} par      Para birimi
 * @param {number|null} bankaId
 * @returns {{ ok: boolean, msg: string }}
 */
function odemeKontrol(tip, tutar, par, bankaId){
  if(!tutar || tutar <= 0) return { ok: true, msg: '' };
  if(tip === 'nakit'){
    const bk = kasaBakiye(par);
    if(bk < tutar){
      return {
        ok: false,
        msg: `Yetersiz kasa bakiyesi! Mevcut: ${fmt(bk, par)} ${par} — Gereken: ${fmt(tutar, par)} ${par}`
      };
    }
  } else if(tip === 'havale' || tip === 'kart'){
    if(bankaId){
      const bk = bankaTRY(bankaId);
      const gerek = tutar * (KUR[par] || 1);
      if(bk < gerek){
        const banka = ld('b').find(b => b.id === bankaId);
        return {
          ok: false,
          msg: `Yetersiz banka bakiyesi! ${banka ? banka.ad : 'Banka'}: ${fmtTL(bk)} — Gereken: ${fmtTL(gerek)}`
        };
      }
    }
  }
  return { ok: true, msg: '' };
}

// ── Satın alma numara üreteci ──────────────────────────────────
/**
 * Yeni bir satın alma sipariş numarası üretir.
 * Format: SA-2026-0001
 */
function saNoUret(){ return belgeNo('SA'); }

// ── Ayarlar yardımcıları ──────────────────────────────────────
/**
 * Varsayılan ayarlar nesnesi.
 * ayarlar.html AYAR_DEF referansını buradan alır.
 */
var AYAR_DEF = {
  unvan: 'Hurra Motor Sanayi ve Ticaret A.Ş.',
  vno: '', vd: '', mersis: '', ticaret: '',
  tel: '', email: '', web: '', adres: '', sehir: '', posta: '',
  marka: 'HurraMotor', markaKisa: 'HURRA', slogan: '', markaYil: new Date().getFullYear(),
  firma: 'HurraMotor',
  para: 'TRY', yil: '01',
  kdv: 18, odemeVadesi: 30,
  dark: false, renk: '#2563eb',
  bildirim_stok: true, bildirim_cs: true, bildirim_risk: true
};

/**
 * hm_ay'dan bir ayar değeri okur.
 * @param {string} key
 * @param {*} def  Varsayılan değer (key yoksa döner)
 */
function getAy(key, def){
  const ay = ldObj('ay', AYAR_DEF);
  return ay[key] !== undefined ? ay[key] : (def !== undefined ? def : AYAR_DEF[key]);
}

/**
 * hm_ay'a bir ayar değeri yazar.
 * @param {string} key
 * @param {*} val
 */
function setAy(key, val){
  const ay = ldObj('ay', AYAR_DEF);
  ay[key] = val;
  sv('ay', ay);
}

// ── Tema uygulama ─────────────────────────────────────────────
/**
 * Geçerli tema ayarını (hm_ay.dark + hm_ay.renk) ekrana uygular.
 * ayarlar.html temaUygula() çağırır; core.js applyTheme() ile uyumlu.
 */
function temaUygula(){
  const dark = getAy('dark', false);
  const renk = getAy('renk', '#2563eb');
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('hm_theme', dark ? 'dark' : 'light');
  if(renk) document.documentElement.style.setProperty('--bl', renk);
}

// ── Firma bilgileri ───────────────────────────────────────────
/**
 * Ayarlardan firma kısa marka adını döndürür.
 * PDF ve ekstre başlıklarında kullanılır.
 * @returns {string}
 */
function firmaMarka(){
  return getAy('marka', 'HURRA') || getAy('markaKisa', 'HURRA') || 'HURRA';
}

/**
 * Ayarlardan firma tam hukuki ünvanını döndürür.
 * @returns {string}
 */
function firmaUnvan(){
  return getAy('unvan', 'Hurra Motor') || 'Hurra Motor';
}

// ══════════════════════════════════════════════════════════════
// 18. ÇOK KULLANICILI YETKİ SİSTEMİ
// ══════════════════════════════════════════════════════════════

const ROLES_DEF = {
  admin:       { label:'Sistem Yöneticisi', color:'#7c3aed', permissions:['*'] },
  muhasebe:    { label:'Muhasebe',           color:'#0891b2', permissions:['cariler','kasa','ceksenet','finans_rapor','tahsilat','odeme'] },
  depo_mudur:  { label:'Depo Müdürü',        color:'#059669', permissions:['stok','depo','transfer','seri','sayim','mal_kabul'] },
  satin_alma:  { label:'Satın Alma',          color:'#d97706', permissions:['satinalma','tedarikci','mal_kabul','fiyat'] },
  uretim:      { label:'Üretim Sorumlusu',    color:'#dc2626', permissions:['uretim','bom','urun_ailesi','kalite'] },
  bilgi_islem: { label:'Bilgi İşlem',         color:'#6b7280', permissions:['log','yedek','kullanici_destek','teknik'] }
};

// Sayfa → izin eşlemesi
const PAGE_PERMS = {
  'dashboard':    null,
  'cariler':      'cariler',
  'kasa':         'kasa',
  'ceksenet':     'ceksenet',
  'satinalma':    'satinalma',
  'ithalat':      'satinalma',     // ithalat = satın alma modülü
  'stok':         'stok',
  'seri':         'seri',
  'urun-ailesi':  'urun_ailesi',
  'bom':          'bom',
  'uretim':       'uretim',
  'ayarlar':      'ayarlar',
  'admin':        'admin',
  'evrak':        null,
  'ai-asistan':   null,
  'personel':     null,            // İK — tüm kullanıcılar görür
  'varlik':       null,            // Varlık — tüm kullanıcılar görür
  'bildirim':     null,            // Bildirimler — tüm kullanıcılar
  'ai':           null,            // AI Merkezi — tüm kullanıcılar
  'saglik':       null,            // Sistem Sağlığı — tüm kullanıcılar
};

function getUsers(){
  const list = ld('users');
  if(list && list.length) return list;
  // Varsayılan admin kullanıcısı (rol hem 'rol' hem 'role' ile uyumlu)
  return [{ id:'u1', username:'hurramotor', rol:'admin', role:'admin', ad:'Sistem Yöneticisi', aktif:true, olusturma: ts() }];
}

function saveUsers(list){ sv('users', list); }

function getUserByName(username){
  return getUsers().find(u => u.username === username);
}

/**
 * Aktif oturumdaki kullanıcı objesini döndürür.
 * Session token'dan user adını okur, users listesinde arar.
 */
function getCurrentUser(){
  try{
    const s = JSON.parse(localStorage.getItem(SESSION_KEY))
           || JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if(s && s.username) return getUserByName(s.username) || null;
    if(s && s.user)     return getUserByName(s.user)     || null;
  }catch{}
  return null;
}

/**
 * Verilen izne sahip mi?
 * admin rolü her şeye erişir (* wildcard).
 */
function hasPermission(perm){
  const u = getCurrentUser();
  if(!u) return false;
  const role = ROLES_DEF[u.role];
  if(!role) return false;
  if(role.permissions.includes('*')) return true;
  return role.permissions.includes(perm);
}

/**
 * Sayfaya erişim yetkisi var mı?
 * pageId: 'kasa', 'stok', 'admin' vs.
 */
function canAccess(pageId){
  const perm = PAGE_PERMS[pageId];
  if(perm === null || perm === undefined) return true; // herkese açık
  const u = getCurrentUser();
  if(!u) return false;
  const role = ROLES_DEF[u.role];
  if(!role) return false;
  if(role.permissions.includes('*')) return true;
  return role.permissions.includes(perm);
}

/**
 * Yetki yoksa erişim engelle ve dashboard'a yönlendir.
 * Her sayfa başında çağrılabilir.
 */
function yetkiKontrol(pageId){
  if(!canAccess(pageId)){
    alert('Bu sayfaya erişim yetkiniz yok.');
    location.href = 'dashboard.html';
    return false;
  }
  return true;
}

/**
 * setSession güncellendi: username de kaydeder
 */
function setSessionUser(username, remember){
  const hours = remember ? 24 * 30 : 8;
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(SESSION_KEY);
  // BUG-IZIN fix: rol'ü kullanıcı listesinden al — izin.js session.rol okur
  const userObj = getUserByName(username);
  const rol = (userObj && (userObj.rol || userObj.role)) || 'admin';
  store.setItem(SESSION_KEY, JSON.stringify({
    exp: Date.now() + hours * 3600 * 1000,
    user: username,
    username: username,
    remember: !!remember,
    rol: rol
  }));
  // giriş logu
  logUserAction(username, 'giris');
}

/**
 * Çok kullanıcılı giriş kontrolü.
 * hm_users listesinde kullanıcı varsa hash ile kontrol.
 * Yoksa eski tek kullanıcı loginKontrol fallback.
 */
async function loginKontrolMulti(username, pass){
  const users = getUsers();
  const u = users.find(x => x.username === username && x.aktif !== false);
  if(!u){
    // Fallback: eski tek kullanıcı sistemi
    return await loginKontrol(username, pass);
  }
  const inputHash = await sha256(pass);
  if(!u.pwHash){
    // Hash yok: varsayılan şifre 'hurra2026'
    const defHash = await sha256('hurra2026');
    return inputHash === defHash;
  }
  return inputHash === u.pwHash;
}

// ══════════════════════════════════════════════════════════════
//  15. YEDEKLEME / GERİ YÜKLEME (Faz 6)
// ══════════════════════════════════════════════════════════════

function erpBackup(){
  const KEYS = [
    // Stok
    STOK_DB.urun, STOK_DB.sh, STOK_DB.depo, STOK_DB.seri, STOK_DB.seri_hrt, STOK_DB.tr,
    // Finans
    'hm_c', 'hm_h', 'hm_kh', 'hm_kasa', 'hm_cs', 'hm_log', 'hm_gr',
    // Banka
    'hm_b', 'hm_bh',
    // Üretim & BOM
    'hm_bom', 'hm_uretim',
    // Satın alma
    SA_DB_KEY,
    // Kullanıcı
    'hm_users', 'hm_user_logs',
    // Ayarlar
    'hm_ay',
    // AI & Evrak
    'hm_evrak', 'hm_ailog',
    // Lot
    LOT_DB.lot, LOT_DB.lot_hrt,
    // İthalat
    IMPORT_DB.ithalat, IMPORT_DB.konteyner, IMPORT_DB.masraf, IMPORT_DB.masraf_tur, IMPORT_DB.yuklemelist,
    // Maliyet
    MALIYET_DB.maliyet_merkezi, MALIYET_DB.gider_tur, MALIYET_DB.genel_gider, MALIYET_DB.urun_maliyet,
    // Personel
    PERSONEL_DB.departman, PERSONEL_DB.pozisyon, PERSONEL_DB.personel,
    // Varlık
    VARLIK_DB.varlik, VARLIK_DB.bakim,
    // Onay
    ONAY_DB.akis, ONAY_DB.talep,
    // Bildirim & Görev
    BILDIRIM_DB.bildirim, BILDIRIM_DB.gorev,
    // Doküman
    DOKUMAN_DB.dokuman, DOKUMAN_DB.dok_tur,
    // Diğer
    KUR_GECMIS_DB, TEDARIKCI_PERF_DB, KK_DB,
    // Ürün ailesi & Kategori
    URUN_AILESI_DB, KATEGORI_DB,
    // Seri no
    'hm_seri',
  ];
  const snap = { version:'4.0', tarih: new Date().toISOString(), veri:{} };
  KEYS.forEach(k => {
    try { const v = localStorage.getItem(k); if(v) snap.veri[k] = JSON.parse(v); } catch{}
  });
  return snap;
}

function erpRestore(snap){
  if(!snap || !snap.veri) return false;
  Object.entries(snap.veri).forEach(([k,v]) => {
    if(v !== null && v !== undefined) localStorage.setItem(k, JSON.stringify(v));
  });
  return true;
}

// ══════════════════════════════════════════════════════════════
//  16. AI YARDIMCI FONKSİYONLARI (Faz 8)
// ══════════════════════════════════════════════════════════════

/** Stok Analizi — kritik ve bitmekte olan ürünler */
function aiStokAnaliz(){
  const urunler = ldS('urun').filter(u => u.aktif !== false);
  const kritik = [], bitmekte = [], rezerveYuk = [];
  urunler.forEach(u => {
    const fizik     = urunStok(u.id);
    const rez       = rezerveStok(u.id);
    const kullan    = Math.max(0, fizik - rez);
    const minStok   = u.minStok || 0;
    if(minStok > 0 && fizik <= minStok)
      kritik.push({ ...u, fizik, rez, kullan, eksik: minStok - fizik });
    if(minStok > 0 && fizik > minStok && fizik <= minStok * 1.3)
      bitmekte.push({ ...u, fizik, rez, kullan });
    if(rez > 0 && rez >= fizik * 0.5)
      rezerveYuk.push({ ...u, fizik, rez, oran: Math.round(rez/fizik*100) });
  });
  return { kritik, bitmekte, rezerveYuk };
}

/** MRP Önerileri — eksik parça olan mamulleri listeler */
function aiMrpOneri(hedefAdet=10){
  const mamuller = ldS('urun').filter(u => u.urunTipi==='mamul' && u.aktif!==false);
  const oneriler = [];
  mamuller.forEach(m => {
    const mrp = mrpHesapla(m.id, hedefAdet);
    if(mrp.bom && mrp.ozet.eksikSay > 0){
      oneriler.push({
        mamul: m, hedefAdet,
        uretilebilir: mrp.ozet.uretilebilirAdet,
        eksikSay: mrp.ozet.eksikSay,
        eksikMaliyet: mrp.ozet.eksikMaliyet,
        eksikler: mrp.satirlar.filter(s => !s.yeterli)
      });
    }
  });
  return oneriler.sort((a,b) => b.eksikMaliyet - a.eksikMaliyet);
}

/** Üretim Analizi */
function aiUretimAnaliz(){
  const bugun = new Date().toISOString().slice(0,10);
  const uretimler = (ld('uretim')||[]).filter(u => !u.sil);
  const aktifDurumlar = ['planlandi','hazirlaniyor','uretimde','kalite_kontrol'];
  const bekleyen    = uretimler.filter(u => u.durum==='planlandi');
  const hazirlaniyor= uretimler.filter(u => u.durum==='hazirlaniyor');
  const uretimde    = uretimler.filter(u => u.durum==='uretimde');
  const kalite      = uretimler.filter(u => u.durum==='kalite_kontrol');
  const tamamlandi  = uretimler.filter(u => u.durum==='tamamlandi');
  const geciken     = uretimler.filter(u =>
    aktifDurumlar.includes(u.durum) && u.bitTarihi && u.bitTarihi < bugun
  );
  const toplamAktif = uretimler.filter(u => aktifDurumlar.includes(u.durum));
  return { bekleyen, hazirlaniyor, uretimde, kalite, tamamlandi, geciken, toplamAktif };
}

/** Finans Analizi — kasa, yaklaşan vadeler */
function aiFinansAnaliz(){
  const bugun   = new Date().toISOString().slice(0,10);
  const otuz    = new Date(Date.now()+30*864e5).toISOString().slice(0,10);

  // Kasa toplam
  const kasaHrtler = ld('kh') || [];
  const kasaBakiye = kasaHrtler.filter(h=>!h.sil)
    .reduce((t,h) => t + (h.yon==='giris'?1:-1)*h.tutar*(KUR[h.par]||1), 0);

  // Bekleyen senetler/çekler (30 gün)
  const senetler = (ld('sen')||[]).filter(s =>
    !s.sil && !['tahsil','odendi','iptal'].includes(s.durum) &&
    s.vade >= bugun && s.vade <= otuz
  );
  const vadesiGecen = (ld('sen')||[]).filter(s =>
    !s.sil && !['tahsil','odendi','iptal'].includes(s.durum) && s.vade < bugun
  );

  // SA bekleyen
  const saBekleyen = ldSA().filter(s => !s.sil && ['siparis','onaylandi'].includes(s.durum));

  return { kasaBakiye, senetler, vadesiGecen, saBekleyen };
}

/** Türkçe doğal dil komut ayrıştırıcı */
function aiKomutParse(metin){
  if(!metin || !metin.trim()) return null;
  const m = metin.trim();
  const ml = m.toLowerCase();

  const intents = [
    { intent:'stok_goster',     rx:[/\bstok\b/,/kaç adet/,/ne kadar\s+var/,/stokta/] },
    { intent:'uretim_olustur',  rx:[/\büret\b/,/imal\s+et/,/üretim\s+emri/,/\badet\s+üret/] },
    { intent:'sa_olustur',      rx:[/satın\s+al/,/sipariş\s+ver/,/temin\s+et/,/talep\s+oluştur/] },
    { intent:'cari_odeme',      rx:[/ödeme\s+yaptım/,/eft\s+yaptım/,/havale\s+yaptım/,/gönderdim/] },
    { intent:'cari_tahsilat',   rx:[/tahsil\s+ettim/,/fatura\s+geldi/,/ödedi/,/aldım/] },
    { intent:'mrp_sorgula',     rx:[/ne\s+lazım/,/eksik\s+parça/,/mrp/,/ihtiyaç\s+listesi/] },
    { intent:'rapor',           rx:[/rapor/,/özet\s+ver/,/durumu\s+nedir/,/analiz\s+et/] },
    { intent:'stok_sorgula',    rx:[/\bvar\s+mı\b/,/kaç\s+tane/,/bakiye/] },
  ];

  let intent = 'bilinmiyor';
  for(const p of intents){
    if(p.rx.some(rx => rx.test(ml))){ intent = p.intent; break; }
  }

  // Miktar
  const mikEşleş = m.match(/(\d[\d.]*)\s*(?:adet|tane|ad\.?|pcs?)?/i);
  const miktar = mikEşleş ? parseFloat(mikEşleş[1]) : null;

  // Tutar (TL/TRY/USD/EUR)
  const tutEşleş = m.match(/([0-9][0-9.,]*)\s*(?:TL|TRY|₺|USD|\$|EUR|€)/i);
  const tutar = tutEşleş ? parseFloat(tutEşleş[1].replace(/\./g,'').replace(',','.')) : null;

  // Cari tahmin — büyük harfli kelime grupları
  const cariEşleş = m.match(/([A-ZÇŞĞÜÖİ][A-Za-zÇŞĞÜÖİçşğüöı]+(?:\s+[A-Za-zÇŞĞÜÖİçşğüöı]+){0,3})/);
  const cariTahmin = cariEşleş ? cariEşleş[1].trim() : null;

  // Ürün tahmin — ld('hm_urun') içinden eşleştir
  const urunler = ldS('urun');
  const urunTahmin = urunler.find(u =>
    ml.includes((u.ad||'').toLowerCase()) || ml.includes((u.kod||'').toLowerCase())
  ) || null;

  return { intent, miktar, tutar, cariTahmin, urunTahmin, orijinal: m };
}

/** AI log yaz — doğrudan localStorage (DB lookup değil) */
function aiLog(tip, girdi, cikti, durum='ok'){
  let logs; try { logs = JSON.parse(localStorage.getItem('hm_ailog'))||[]; } catch{ logs=[]; }
  logs.unshift({ id:nid(logs), ts:ts(), tip, girdi, cikti, durum });
  if(logs.length > 500) logs.length = 500;
  localStorage.setItem('hm_ailog', JSON.stringify(logs));
}
/** AI log oku */
function ldAiLog(){ try{ return JSON.parse(localStorage.getItem('hm_ailog'))||[]; }catch{ return []; } }

/** Evrak localStorage yönetimi */
function ldEvrak(){ try{ return JSON.parse(localStorage.getItem('hm_evrak'))||[]; }catch{ return []; } }
function svEvrak(v){ localStorage.setItem('hm_evrak', JSON.stringify(v)); }

function evrakKaydet(evrak){
  const liste = ldEvrak();
  if(!evrak.id) evrak.id = nid(liste);
  if(!evrak.cat) evrak.cat = ts();
  const idx = liste.findIndex(e => e.id === evrak.id);
  if(idx >= 0) liste[idx] = evrak; else liste.unshift(evrak);
  svEvrak(liste);
  return evrak;
}

// ══════════════════════════════════════════════════════════════

function logUserAction(username, action, detay=''){
  const logs = ld('user_logs') || [];
  logs.unshift({ ts: ts(), username, action, detay, ip:'local' });
  if(logs.length > 1000) logs.length = 1000;
  sv('user_logs', logs);
}

function getUserLogs(){ return ld('user_logs') || []; }

// ══════════════════════════════════════════════════════════════
//  17. LOT / PARTİ BAZLI MALİYET SİSTEMİ (v4.0)
// ══════════════════════════════════════════════════════════════
/**
 * Lot şeması:
 * { id, lotNo, urunId, urunAd, miktar, kalanMiktar,
 *   birimMaliyet, paraBirimi, maliyetTRY,
 *   tedarikciId, saId, ithalatId,  // kaynak belgeler
 *   girisDepoId, girisTarihi,
 *   lotTipi,        // 'satin_alma'|'ithalat'|'uretim'|'iade'|'sayim'
 *   maliyetYontemi, // 'fifo'|'agirlikli_ortalama'
 *   durum,          // 'aktif'|'tuketildi'|'iptal'
 *   not, cat }
 */

const LOT_TIPI = { satin_alma:'Satın Alma', ithalat:'İthalat', uretim:'Üretim', iade:'İade', sayim:'Sayım' };
const MALIYET_YONTEMI = { fifo:'FIFO', agirlikli_ortalama:'Ağırlıklı Ortalama' };

/** Ürün için aktif lot listesi (FIFO — en eski önce) */
function lotListesi(urunId){
  return ldLOT()
    .filter(l => l.urunId === urunId && l.durum === 'aktif' && (l.kalanMiktar||0) > 0)
    .sort((a,b) => (a.girisTarihi||'') < (b.girisTarihi||'') ? -1 : 1);
}

/** FIFO maliyet hesabı: N adet için toplam TL maliyeti */
function fifoBirimMaliyet(urunId, adet=1){
  const lotlar = lotListesi(urunId);
  if(!lotlar.length) return 0;
  let kalan = adet, toplam = 0;
  for(const l of lotlar){
    const kullan = Math.min(kalan, l.kalanMiktar||0);
    toplam += kullan * (l.maliyetTRY || l.birimMaliyet || 0);
    kalan  -= kullan;
    if(kalan <= 0) break;
  }
  return adet > 0 ? toplam / adet : 0;
}

/** Ağırlıklı ortalama maliyet */
function ortalamaLotMaliyet(urunId){
  const lotlar = ldLOT().filter(l => l.urunId === urunId && l.durum === 'aktif' && (l.kalanMiktar||0)>0);
  if(!lotlar.length) return 0;
  const topMiktar = lotlar.reduce((t,l) => t + (l.kalanMiktar||0), 0);
  const topMaliyet = lotlar.reduce((t,l) => t + (l.kalanMiktar||0) * (l.maliyetTRY||0), 0);
  return topMiktar > 0 ? topMaliyet / topMiktar : 0;
}

/** Lot oluştur (mal kabul, satın alma, ithalat sonrası çağrılır) */
function lotOlustur({ urunId, urunAd='', miktar, birimMaliyet, paraBirimi='TRY',
                      maliyetTRY=null, tedarikciId=null, saId=null, ithalatId=null,
                      girisDepoId=null, girisTarihi=null, lotTipi='satin_alma', not='' }){
  const liste = ldLOT();
  const yil   = new Date().getFullYear();
  const sira  = liste.filter(l => l.lotNo?.startsWith(`LOT-${yil}`)).length + 1;
  const lot = {
    id: nid(liste),
    lotNo: `LOT-${yil}-${pad(sira,4)}`,
    urunId, urunAd, miktar, kalanMiktar: miktar,
    birimMaliyet, paraBirimi,
    maliyetTRY: maliyetTRY ?? (paraBirimi==='TRY' ? birimMaliyet : tlCevir(birimMaliyet, paraBirimi)),
    tedarikciId, saId, ithalatId,
    girisDepoId, girisTarihi: girisTarihi || today(),
    lotTipi, durum:'aktif', not, cat: ts()
  };
  liste.push(lot);
  svLOT(liste);
  return lot;
}

/** Lot tüketimi (FIFO sırasıyla) — üretim veya çıkış */
function lotTuket(urunId, adet, referansId=null, referansNo=''){
  const lotlar   = lotListesi(urunId);
  let   kalan    = adet;
  const tuketimler = [];
  const liste    = ldLOT();

  for(const l of lotlar){
    if(kalan <= 0) break;
    const kullan = Math.min(kalan, l.kalanMiktar);
    const idx    = liste.findIndex(x => x.id === l.id);
    if(idx < 0) continue;
    liste[idx].kalanMiktar -= kullan;
    if(liste[idx].kalanMiktar <= 0) liste[idx].durum = 'tuketildi';
    tuketimler.push({ lotId:l.id, lotNo:l.lotNo, kullanilan:kullan, birimMaliyet:l.maliyetTRY||0 });
    kalan -= kullan;
  }
  svLOT(liste);

  // Lot hareket kaydet
  const hrtListe = ldLOTH();
  tuketimler.forEach(t => {
    hrtListe.push({
      id: nid(hrtListe), lotId:t.lotId, lotNo:t.lotNo, urunId,
      tip:'cikis', miktar:t.kullanilan,
      referansId, referansNo,
      tarih: ts(), cat: ts()
    });
  });
  svLOTH(hrtListe);
  return tuketimler;
}

// ══════════════════════════════════════════════════════════════
//  18. MALİYET TÜRLERİ & KUR GEÇMİŞİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Ürün maliyet kaydı şeması (hm_urun_maliyet):
 * { id, urunId, tarih, tip, maliyet, paraBirimi, maliyetTRY,
 *   aciklama, lotId, ithalatId, cat }
 *
 * tip: 'ham'|'tahmini'|'son_gercek'|'ortalama_gercek'|'gercek'
 */
const MALIYET_TIP = {
  ham:             'Ham Maliyet',
  tahmini:         'Tahmini Maliyet',
  son_gercek:      'Son Gerçek Maliyet',
  ortalama_gercek: 'Ortalama Gerçek Maliyet',
  gercek:          'Gerçek Maliyet',
};

function urunMaliyetKaydet({ urunId, tarih=null, tip='gercek', maliyet, paraBirimi='TRY',
                             maliyetTRY=null, aciklama='', lotId=null, ithalatId=null }){
  const liste = ldURUN_MALIYET();
  const kayit = {
    id: nid(liste), urunId, tarih: tarih||today(), tip, maliyet, paraBirimi,
    maliyetTRY: maliyetTRY ?? (paraBirimi==='TRY' ? maliyet : tlCevir(maliyet, paraBirimi)),
    aciklama, lotId, ithalatId, cat: ts()
  };
  liste.unshift(kayit);
  svURUN_MALIYET(liste);
  return kayit;
}

function urunMaliyetleri(urunId, tip=null){
  return ldURUN_MALIYET().filter(m => m.urunId===urunId && (!tip||m.tip===tip));
}

function sonGercekMaliyet(urunId){
  const k = ldURUN_MALIYET().filter(m=>m.urunId===urunId && m.tip==='son_gercek')
               .sort((a,b) => b.tarih > a.tarih ? 1 : -1)[0];
  return k ? k.maliyetTRY : 0;
}

/**
 * Kur geçmişi kaydet
 * @param {Object} kurObj  — { USD: 32.5, EUR: 35.2, CNY: 4.5 }
 * @param {string} tip     — 'TCMB' | 'siparis' | 'gumruk' | 'muhasebe' | 'ozel'
 */
function kurKaydet(kurObj, tip = 'TCMB'){
  const gecmis = ldKURG();
  const tarih  = today();
  // Bugünkü kaydı bul veya yeni oluştur
  const idx = gecmis.findIndex(g => g.tarih === tarih);
  if(idx >= 0){
    if(!gecmis[idx].tipler) gecmis[idx].tipler = {};
    gecmis[idx].tipler[tip] = { ...kurObj };
    // Geriye dönük uyumluluk: TCMB kuru top-level'da da tut
    if(tip === 'TCMB') Object.assign(gecmis[idx], kurObj);
  } else {
    const entry = { tarih, ts: ts(), tipler: { [tip]: { ...kurObj } } };
    if(tip === 'TCMB') Object.assign(entry, kurObj); // top-level backward compat
    gecmis.unshift(entry);
  }
  if(gecmis.length > 365) gecmis.length = 365;
  svKURG(gecmis);
  // Manuel kur tiplerini ayrıca kaydet
  const tipler = ldKURTIP();
  tipler[tip] = { ...kurObj, guncelleme: tarih };
  svKURTIP(tipler);
}

/**
 * Belirli tarihteki kur — tarihe en yakın geçmiş kuru döner
 * @param {string} tarih  — 'YYYY-MM-DD'
 * @param {string} par    — 'USD' | 'EUR' | 'CNY'
 * @param {string} tip    — 'TCMB' | 'siparis' | 'gumruk' | 'muhasebe' | 'ozel'
 */
function kurBul(tarih, par, tip = 'TCMB'){
  const gecmis = ldKURG();
  for(const g of gecmis){
    if(g.tarih <= tarih){
      // Yeni yapı: tipler objesi içinde ara
      if(g.tipler && g.tipler[tip] && g.tipler[tip][par]) return g.tipler[tip][par];
      // Eski yapı: top-level backward compat (sadece TCMB için)
      if(tip === 'TCMB' && g[par]) return g[par];
    }
  }
  // Geçmiş yoksa: önce manuel tipler, sonra live KUR
  const tipler = ldKURTIP();
  if(tipler[tip] && tipler[tip][par]) return tipler[tip][par];
  return KUR[par] || 1;
}

/**
 * TL'ye çevir — geçmiş tarihe göre kur kullanır
 * Mevcut tlCevir(tutar, par) fonksiyonu bozulmaz; bu ek fonksiyondur.
 * @param {number} tutar
 * @param {string} par
 * @param {string} tarih  — tarih verilirse kurBul, verilmezse live KUR
 * @param {string} tip    — 'TCMB' | 'siparis' | 'gumruk' | 'muhasebe' | 'ozel'
 */
function tlCevirTarih(tutar, par, tarih, tip = 'TCMB'){
  if(!tutar) return 0;
  if(par === 'TRY' || !par) return tutar;
  const kur = tarih ? kurBul(tarih, par, tip) : (KUR[par] || 1);
  return tutar * kur;
}

/**
 * Kur değişikliğini logla
 * @param {Object} eskiKur  — önceki kur { USD, EUR, CNY }
 * @param {Object} yeniKur  — yeni kur
 * @param {string} tip
 */
function kurDegisiklikLogla(eskiKur, yeniKur, tip = 'TCMB'){
  const log = ldKURLOG();
  const degisen = Object.keys(yeniKur).filter(k => eskiKur[k] !== yeniKur[k]);
  if(!degisen.length) return; // hiçbir şey değişmemişse loglama
  log.unshift({ tarih: today(), ts: ts(), tip, eski: { ...eskiKur }, yeni: { ...yeniKur }, degisen });
  if(log.length > 500) log.length = 500;
  svKURLOG(log);
}

/** Bugün için tüm kur tiplerini döner { TCMB:{...}, siparis:{...}, ... } */
function kurTipleriBugün(){
  return ldKURTIP();
}

/** Belirtilen kur tipinin bugünkü değerini döner */
function kurTipiAl(tip, par){
  const tipler = ldKURTIP();
  return tipler[tip]?.[par] || KUR[par] || 1;
}

// ══════════════════════════════════════════════════════════════
//  19. İTHALAT YÖNETİMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * İthalat dosyası şeması (hm_ithalat):
 * { id, ithNo, saId, konteynerNo, tedarikciId,
 *   durum: 'siparis'|'yuklemede'|'gumruk'|'limanda'|'ic_nakliye'|'mal_kabul'|'masraf_dagitim'|'tamamlandi',
 *   yuklemeTarihi, etaTarihi, gumrukTarihi, limanTarihi, malKabulTarihi,
 *   siparisDoviz, gumrukKuru, muhasebeKuru,
 *   kalemler: [{urunId, urunAd, miktar, birimFiyat, paraBirimi, agirlik, hacim}],
 *   masraflar: [{masrafTurId, masrafTurAd, tutar, paraBirimi, dagitimYontemi, dagitildi}],
 *   dagitimSonucu: [{urunId, lotId, maliyetPayi}],
 *   evraklar: [{tip, ad, dosyaUrl, eklenmeTarihi}],
 *   not, cat }
 *
 * Durum akışı:
 * siparis → yuklemede → gumruk → limanda → ic_nakliye → mal_kabul → masraf_dagitim → tamamlandi
 */

const ITHALAT_DURUM = {
  siparis:        { ad:'Siparişte',       renk:'#dbeafe', fg:'#1d4ed8', sira:1 },
  yuklemede:      { ad:'Yüklemede',       renk:'#fef9c3', fg:'#854d0e', sira:2 },
  gumruk:         { ad:'Gümrükte',        renk:'#f3e8ff', fg:'#6b21a8', sira:3 },
  limanda:        { ad:'Limanda',         renk:'#ffedd5', fg:'#9a3412', sira:4 },
  ic_nakliye:     { ad:'İç Nakliye',      renk:'#fce7f3', fg:'#9d174d', sira:5 },
  mal_kabul:      { ad:'Mal Kabul',       renk:'#dcfce7', fg:'#166534', sira:6 },
  masraf_dagitim: { ad:'Masraf Dağıtımı', renk:'#dbeafe', fg:'#1e40af', sira:7 },
  tamamlandi:     { ad:'Tamamlandı',      renk:'#f0fdf4', fg:'#15803d', sira:8 },
  iptal:          { ad:'İptal',           renk:'#fee2e2', fg:'#991b1b', sira:9 },
};

/** Masraf dağıtım yöntemleri */
const DAGITIM_YONTEMI = {
  adet:    { ad:'Adede Göre',        varsayilan:['navlun'] },
  agirlik: { ad:'Ağırlığa Göre',     varsayilan:['navlun'] },
  hacim:   { ad:'Hacme Göre',        varsayilan:['navlun'] },
  deger:   { ad:'Ürün Değerine Göre', varsayilan:['gumruk','sigorta'] },
  manuel:  { ad:'Manuel',            varsayilan:[] },
};

/** Masraf dağıtımı hesapla */
function masrafDagit(ithalatId){
  const ith = ldITH().find(i => i.id === ithalatId);
  if(!ith || !ith.kalemler?.length) return null;

  const urunler = ldS('urun');
  const kalemler = ith.kalemler.map(k => {
    const u = urunler.find(x => x.id === k.urunId);
    return {
      ...k,
      degerTRY: (k.birimFiyat||0) * (k.miktar||0) * (KUR[k.paraBirimi]||1),
      agirlik: k.agirlik || (u?.agirlik||0) * (k.miktar||0),
      hacim:   k.hacim   || (u?.hacim_m3||0) * (k.miktar||0),
    };
  });

  const toplamAdet    = kalemler.reduce((t,k) => t+(k.miktar||0), 0);
  const toplamDeger   = kalemler.reduce((t,k) => t+(k.degerTRY||0), 0);
  const toplamAgirlik = kalemler.reduce((t,k) => t+(k.agirlik||0), 0);
  const toplamHacim   = kalemler.reduce((t,k) => t+(k.hacim||0), 0);

  const masrafPaylar = {}; // urunId → toplam masraf payı
  kalemler.forEach(k => { masrafPaylar[k.urunId] = 0; });

  (ith.masraflar || []).forEach(m => {
    const tutarTRY = (m.tutar||0) * (KUR[m.paraBirimi]||1);
    const yon = m.dagitimYontemi || 'deger';

    kalemler.forEach(k => {
      let pay = 0;
      if(yon === 'adet'    && toplamAdet    > 0) pay = tutarTRY * (k.miktar||0)    / toplamAdet;
      if(yon === 'agirlik' && toplamAgirlik > 0) pay = tutarTRY * (k.agirlik||0)   / toplamAgirlik;
      if(yon === 'hacim'   && toplamHacim   > 0) pay = tutarTRY * (k.hacim||0)     / toplamHacim;
      if(yon === 'deger'   && toplamDeger   > 0) pay = tutarTRY * (k.degerTRY||0)  / toplamDeger;
      if(yon === 'manuel'  ) pay = (m.manuelPaylar?.[k.urunId]||0);
      masrafPaylar[k.urunId] = (masrafPaylar[k.urunId]||0) + pay;
    });
  });

  return kalemler.map(k => ({
    urunId: k.urunId,
    urunAd: k.urunAd || urunler.find(u=>u.id===k.urunId)?.ad || '?',
    miktar: k.miktar,
    birimMalFiyat: k.birimFiyat,
    parcaMaliyetTRY: k.degerTRY,
    masrafPayiTRY: masrafPaylar[k.urunId]||0,
    masrafPayiPerAdet: k.miktar > 0 ? (masrafPaylar[k.urunId]||0)/k.miktar : 0,
    toplamMaliyetTRY: (k.degerTRY||0) + (masrafPaylar[k.urunId]||0),
    birimMaliyetTRY: k.miktar > 0 ? ((k.degerTRY||0)+(masrafPaylar[k.urunId]||0))/k.miktar : 0,
  }));
}

// ══════════════════════════════════════════════════════════════
//  20. PERSONEL SİSTEMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Personel şeması (hm_personel):
 * { id, sicilNo, ad, soyad, tcNo, dogumTarihi,
 *   departmanId, pozisyonId, yoneticisiId,
 *   iseGirisTarihi, istenCikisTarihi,
 *   brutMaas, paraBirimi,      // aylık brüt maaş
 *   sgkIsci,                   // SGK işçi payı (oranı veya sabit)
 *   sgkIsveren,                // SGK işveren payı
 *   gelirVergisi, damgaVergisi,
 *   netMaas,                   // hesaplanır
 *   isverenToplamMaliyet,      // hesaplanır
 *   saatlikMaliyet,            // hesaplanır
 *   calismaGunu,               // aylık standart çalışma günü
 *   gunlukCalisma,             // saat/gün
 *   aktif, notlar, cat }
 */

const SGK_ORAN = {
  isci_ssk: 0.14,      // işçi SSK payı
  isci_issizlik: 0.01, // işçi işsizlik
  isveren_ssk: 0.205,  // işveren SSK
  isveren_issizlik: 0.02,
  isveren_is_kazasi: 0.015, // iş kazası (sektöre göre değişir)
};

function personelMaliyetHesapla(brutMaas, calismaGunu=22, gunlukSaat=8){
  const sgkIsci     = brutMaas * (SGK_ORAN.isci_ssk + SGK_ORAN.isci_issizlik);
  const sgkIsveren  = brutMaas * (SGK_ORAN.isveren_ssk + SGK_ORAN.isveren_issizlik + SGK_ORAN.isveren_is_kazasi);
  const gelirVergisi= (brutMaas - sgkIsci) * 0.15; // basit %15 tahmini
  const damgaVergisi= brutMaas * 0.00759;
  const netMaas     = brutMaas - sgkIsci - gelirVergisi - damgaVergisi;
  const isverenToplamMaliyet = brutMaas + sgkIsveren;
  const saatlikMaliyet = isverenToplamMaliyet / (calismaGunu * gunlukSaat);
  return {
    brutMaas: parseFloat(brutMaas.toFixed(2)),
    sgkIsci: parseFloat(sgkIsci.toFixed(2)),
    sgkIsveren: parseFloat(sgkIsveren.toFixed(2)),
    gelirVergisi: parseFloat(gelirVergisi.toFixed(2)),
    damgaVergisi: parseFloat(damgaVergisi.toFixed(2)),
    netMaas: parseFloat(netMaas.toFixed(2)),
    isverenToplamMaliyet: parseFloat(isverenToplamMaliyet.toFixed(2)),
    saatlikMaliyet: parseFloat(saatlikMaliyet.toFixed(4)),
    calismaGunu, gunlukSaat,
  };
}

function personelGetir(id){ return ldPER().find(p => p.id === id) || null; }
function aktifPersoneller(){ return ldPER().filter(p => p.aktif !== false && !p.istenCikisTarihi); }
function departmanAd(id){ return ldDEPT().find(d=>d.id===id)?.ad || '—'; }
function pozisyonAd(id){ return ldPOZ().find(p=>p.id===id)?.ad || '—'; }

// ══════════════════════════════════════════════════════════════
//  21. VARLIK (SABİT KIYMET) YÖNETİMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Varlık şeması (hm_varlik):
 * { id, varlikNo, ad, tip, marka, model, seriNo,
 *   tip: 'makine'|'arac'|'demirbaş'|'bilgisayar'|'diger',
 *   alisTarihi, alisFiyat, paraBirimi,
 *   departmanId, konumDepoId, sorumluPersonelId,
 *   amortismanOrani,   // yıllık %
 *   ekonomikOmur,      // yıl
 *   sonBakimTarihi, sonrakiBakimTarihi, bakimPeriyodu,
 *   durum: 'aktif'|'bakim'|'ariza'|'hurda'|'devredildi',
 *   notlar, cat }
 */

const VARLIK_TIP = {
  makine:    { ad:'Makine/Ekipman', simge:'⚙️' },
  arac:      { ad:'Araç',          simge:'🚗' },
  demirbaş:  { ad:'Demirbaş',      simge:'🖥️' },
  bilgisayar:{ ad:'Bilgisayar/BT', simge:'💻' },
  diger:     { ad:'Diğer',         simge:'📦' },
};

function varlikNetDeger(varlik){
  if(!varlik?.alisFiyat || !varlik?.alisTarihi) return 0;
  const yillar = (new Date() - new Date(varlik.alisTarihi)) / (365.25*24*3600*1000);
  const oran   = varlik.amortismanOrani || 0;
  const net    = varlik.alisFiyat * Math.max(0, 1 - (oran/100) * yillar);
  return Math.max(0, parseFloat(net.toFixed(2)));
}

function varlikGetir(id){ return ldVARLIK().find(v => v.id === id) || null; }
function aktifVarliklar(){ return ldVARLIK().filter(v => v.durum !== 'hurda' && v.durum !== 'devredildi'); }

function bakimKaydet({ varlikId, tip, tarih, maliyet, yapan, not='' }){
  const liste = ldBAKIM();
  const kayit = { id:nid(liste), varlikId, tip, tarih:tarih||today(), maliyet:maliyet||0, yapan, not, cat:ts() };
  liste.unshift(kayit);
  svBAKIM(liste);
  // Varlığın son bakım tarihini güncelle
  const vList = ldVARLIK();
  const idx   = vList.findIndex(v=>v.id===varlikId);
  if(idx>=0){ vList[idx].sonBakimTarihi=kayit.tarih; svVARLIK(vList); }
  return kayit;
}

// ══════════════════════════════════════════════════════════════
//  22. ONAY AKIŞI MOTORu (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Onay kuralı şeması (hm_onay_akis):
 * { id, ad, islemTipi, koşul: {minTutar, maxTutar, paraBirimi, roller},
 *   adimlar: [{sira, onayCiRol, onayCiUsername, zorunlu}],
 *   aktif }
 *
 * islemTipi: 'satinalma'|'ithalat'|'uretim'|'stok_cikis'|'genel'
 *
 * Onay talebi şeması (hm_onay_talep):
 * { id, kuralId, islemTipi, islemId, islemNo,
 *   tutar, paraBirimi, talep_eden, aciklama,
 *   adimlar: [{sira, onayCi, durum, tarih, not}],
 *   mevcut_adim, genel_durum: 'bekliyor'|'onaylandi'|'reddedildi',
 *   cat }
 */

function onayTalepOlustur({ kuralId, islemTipi, islemId, islemNo='', tutar=0, paraBirimi='TRY', talep_eden='', aciklama='' }){
  const kural  = ldONAY_AKIS().find(k=>k.id===kuralId && k.aktif!==false);
  if(!kural) return null;
  const adimler = (kural.adimlar||[]).map((a,i) => ({
    sira:i+1, onayCi:a.onayCiUsername||'', rol:a.onayCiRol||'admin',
    durum:'bekliyor', tarih:null, not:''
  }));
  const talep = {
    id:nid(ldONAY_TALEP()), kuralId, islemTipi, islemId, islemNo,
    tutar, paraBirimi, talep_eden, aciklama,
    adimlar, mevcut_adim:1, genel_durum:'bekliyor', cat:ts()
  };
  const liste = ldONAY_TALEP();
  liste.unshift(talep);
  svONAY_TALEP(liste);
  bildirimEkle({ tip:'onay', baslik:`Onay Bekliyor: ${islemNo||islemTipi}`, mesaj:aciklama, ilgiliId:talep.id, hedef:'admin' });
  return talep;
}

function onayIsle(talepId, kullanici, durum='onaylandi', not=''){
  const liste = ldONAY_TALEP();
  const idx   = liste.findIndex(t=>t.id===talepId);
  if(idx<0) return null;
  const talep = liste[idx];
  const adimIdx = talep.adimlar.findIndex(a=>a.sira===talep.mevcut_adim && a.durum==='bekliyor');
  if(adimIdx<0) return null;
  talep.adimlar[adimIdx].durum  = durum;
  talep.adimlar[adimIdx].tarih  = ts();
  talep.adimlar[adimIdx].not    = not;
  talep.adimlar[adimIdx].yapan  = kullanici;
  if(durum==='reddedildi'){
    talep.genel_durum = 'reddedildi';
  } else {
    const sonrakiAdim = talep.adimlar.find(a=>a.sira>talep.mevcut_adim);
    if(sonrakiAdim){ talep.mevcut_adim = sonrakiAdim.sira; }
    else { talep.genel_durum = 'onaylandi'; }
  }
  liste[idx] = talep;
  svONAY_TALEP(liste);
  return talep;
}

function bekleyenOnaylar(kullanici=null){
  return ldONAY_TALEP().filter(t => {
    if(t.genel_durum !== 'bekliyor') return false;
    const adim = t.adimlar.find(a=>a.sira===t.mevcut_adim);
    if(!adim) return false;
    if(kullanici && adim.onayCi && adim.onayCi !== kullanici) return false;
    return true;
  });
}

// ══════════════════════════════════════════════════════════════
//  23. BİLDİRİM SİSTEMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Bildirim şeması (hm_bildirim):
 * { id, tip, baslik, mesaj, ilgiliId, ilgiliUrl, hedef,
 *   okundu, olusturmaTarihi }
 *
 * tip: 'onay'|'stok_uyari'|'teslim'|'gorev'|'evrak'|'sistem'|'bilgi'
 */
function bildirimEkle({ tip='bilgi', baslik, mesaj='', ilgiliId=null, ilgiliUrl='', hedef='admin' }){
  const liste = ldBILDIRIM();
  liste.unshift({ id:nid(liste), tip, baslik, mesaj, ilgiliId, ilgiliUrl, hedef, okundu:false, olusturmaTarihi:ts() });
  if(liste.length > 500) liste.length = 500;
  svBILDIRIM(liste);
}

function bildirimOku(id){
  const liste = ldBILDIRIM();
  const idx   = liste.findIndex(b=>b.id===id);
  if(idx>=0){ liste[idx].okundu=true; liste[idx].okunmaTarihi=ts(); svBILDIRIM(liste); }
}

function bildirimTumunuOku(){
  const liste = ldBILDIRIM().map(b=>({...b,okundu:true}));
  svBILDIRIM(liste);
}

function okunmamisBildirimler(hedef=null){
  return ldBILDIRIM().filter(b => !b.okundu && (!hedef||b.hedef===hedef||b.hedef==='tum'));
}

// ══════════════════════════════════════════════════════════════
//  24. GÖREV YÖNETİMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Görev şeması (hm_gorev):
 * { id, baslik, aciklama, atananKullanici, atayan,
 *   oncelik: 'dusuk'|'normal'|'yuksek'|'acil',
 *   durum: 'bekliyor'|'devam_ediyor'|'tamamlandi'|'iptal',
 *   bitis_tarihi, tamamlanma_tarihi,
 *   ilgiliTip, ilgiliId, ilgiliNo,
 *   notlar: [], cat }
 */
function gorevOlustur({ baslik, aciklama='', atananKullanici, atayan='',
                        oncelik='normal', bitis_tarihi=null,
                        ilgiliTip=null, ilgiliId=null, ilgiliNo='' }){
  const liste  = ldGOREV();
  const gorev  = {
    id:nid(liste), baslik, aciklama, atananKullanici, atayan, oncelik,
    durum:'bekliyor', bitis_tarihi, tamamlanma_tarihi:null,
    ilgiliTip, ilgiliId, ilgiliNo, notlar:[], cat:ts()
  };
  liste.unshift(gorev);
  svGOREV(liste);
  bildirimEkle({ tip:'gorev', baslik:`Yeni Görev: ${baslik}`, hedef:atananKullanici });
  return gorev;
}

function gorevGuncelle(id, degerler){
  const liste = ldGOREV();
  const idx   = liste.findIndex(g=>g.id===id);
  if(idx<0) return null;
  liste[idx] = { ...liste[idx], ...degerler };
  if(degerler.durum==='tamamlandi') liste[idx].tamamlanma_tarihi = ts();
  svGOREV(liste);
  return liste[idx];
}

function bekleyenGorevler(kullanici=null){
  return ldGOREV().filter(g =>
    ['bekliyor','devam_ediyor'].includes(g.durum) &&
    (!kullanici || g.atananKullanici===kullanici)
  );
}

// ══════════════════════════════════════════════════════════════
//  25. DOKÜMAN YÖNETİMİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Doküman şeması (hm_dokuman):
 * { id, ad, tip, dosyaUrl, dosyaBoyutu, dosyaTipi,
 *   ilgiliTip: 'cari'|'sa'|'ithalat'|'uretim'|'varlik'|'personel'|'diger',
 *   ilgiliId, ilgiliNo, zorunlu, gecerlilikTarihi,
 *   yukleyen, yuklemeTarihi, not, cat }
 */
function dokumanEkle({ ad, tip, dosyaUrl='', dosyaBoyutu=0, dosyaTipi='',
                       ilgiliTip, ilgiliId, ilgiliNo='', zorunlu=false,
                       gecerlilikTarihi=null, yukleyen='', not='' }){
  const liste = ldDOK();
  const dok = {
    id:nid(liste), ad, tip, dosyaUrl, dosyaBoyutu, dosyaTipi,
    ilgiliTip, ilgiliId, ilgiliNo, zorunlu, gecerlilikTarihi,
    yukleyen, yuklemeTarihi:today(), not, cat:ts()
  };
  liste.unshift(dok);
  svDOK(liste);
  return dok;
}

function ilgiliDokumanlar(ilgiliTip, ilgiliId){
  return ldDOK().filter(d=>d.ilgiliTip===ilgiliTip && d.ilgiliId===ilgiliId);
}

function eksikZorunluDokumanlar(){
  // Zorunlu doküman türleri tanımlıysa eksikleri bul
  const turler = ldDOK_TUR().filter(t=>t.zorunlu && t.aktif!==false);
  const eksikler = [];
  turler.forEach(t => {
    // Her ilgili kayıt tipi için kontrol et
    // Şimdilik ithalat + satın alma için kontrol
    if(t.ilgiliTip === 'ithalat'){
      ldITH().filter(i=>i.durum!=='tamamlandi'&&i.durum!=='iptal').forEach(ith => {
        const var_ = ldDOK().some(d=>d.ilgiliId===ith.id && d.tip===t.sistemKodu);
        if(!var_) eksikler.push({ tur:t.ad, ilgiliTip:'ithalat', ilgiliId:ith.id, ilgiliNo:ith.ithNo });
      });
    }
  });
  return eksikler;
}

// ══════════════════════════════════════════════════════════════
//  26. KALITE KONTROL (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * KK kaydı şeması (hm_kk):
 * { id, kkNo, tip: 'giris'|'uretim'|'sevkiyat',
 *   ilgiliTip, ilgiliId, ilgiliNo,
 *   urunId, urunAd, lotId, miktar,
 *   kontrol_tarihi, kontrol_eden,
 *   durum: 'bekliyor'|'gecti'|'koşullu'|'reddedildi',
 *   kabul_miktar, red_miktar,
 *   bulgular: [{alan, sonuc, not}],
 *   karantina_depoId, hedef_depoId,
 *   not, cat }
 */

const KK_DURUM = {
  bekliyor:    { ad:'Bekliyor',      renk:'#dbeafe', fg:'#1d4ed8' },
  gecti:       { ad:'KK Geçti',      renk:'#dcfce7', fg:'#15803d' },
  kosullu:     { ad:'Koşullu Onay',  renk:'#fef9c3', fg:'#854d0e' },
  reddedildi:  { ad:'Reddedildi',    renk:'#fee2e2', fg:'#991b1b' },
};

function kkKaydet({ tip='giris', ilgiliTip, ilgiliId, ilgiliNo='',
                    urunId, urunAd='', lotId=null, miktar=0,
                    kontrol_eden='', not='' }){
  const liste = ldKK();
  const yil   = new Date().getFullYear();
  const sira  = liste.filter(k=>k.kkNo?.startsWith(`KK-${yil}`)).length+1;
  const kayit = {
    id:nid(liste), kkNo:`KK-${yil}-${pad(sira,4)}`, tip, ilgiliTip, ilgiliId, ilgiliNo,
    urunId, urunAd, lotId, miktar, kontrol_tarihi:today(), kontrol_eden,
    durum:'bekliyor', kabul_miktar:0, red_miktar:0, bulgular:[], not, cat:ts()
  };
  liste.unshift(kayit);
  svKK(liste);
  return kayit;
}

// ══════════════════════════════════════════════════════════════
//  27. TEDARİKÇİ PERFORMANS (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Tedarikçi performans kaydı (hm_tedarikci_perf):
 * { id, cariId, cariAd, donem,   // 'YYYY-MM'
 *   teslim: {planlanan, gercek, gecikme_gun},
 *   kalite: {toplam, kabul, red, oranPct},
 *   fiyat:  {tahmini, gercek, sapma},
 *   iade_adet, puan,   // 0–100
 *   cat }
 */

function tedarikciPerformansHesapla(cariId, donem=null){
  const d = donem || new Date().toISOString().slice(0,7);
  const saList = ldSA().filter(s => s.cariId===cariId && !s.sil && s.tar?.startsWith(d.slice(0,4)));

  const teslimler = saList.map(s => {
    const plan  = s.teslimTarihi || s.tarTeslim;
    const gercek= s.malKabulTarihi;
    const fark  = (plan && gercek) ? Math.round((new Date(gercek)-new Date(plan))/864e5) : 0;
    return { plan, gercek, gecikme: Math.max(0,fark) };
  });

  const kkler = ldKK().filter(k=>k.ilgiliTip==='sa' &&
    saList.some(s=>s.id===k.ilgiliId));
  const kkToplam = kkler.reduce((t,k)=>t+(k.miktar||0),0);
  const kkKabul  = kkler.reduce((t,k)=>t+(k.kabul_miktar||0),0);
  const kkRed    = kkler.reduce((t,k)=>t+(k.red_miktar||0),0);

  const gecikme   = teslimler.filter(t=>t.gecikme>0).length;
  const zamaninda = teslimler.length - gecikme;
  const kaliteOran= kkToplam > 0 ? Math.round(kkKabul/kkToplam*100) : 100;
  const zamanOran = teslimler.length > 0 ? Math.round(zamaninda/teslimler.length*100) : 100;

  // Basit puan: %60 kalite + %40 zamanlılık
  const puan = Math.round(kaliteOran*0.6 + zamanOran*0.4);

  return {
    cariId, donem:d,
    teslim: { planlanan:teslimler.length, zamaninda, gecikme, gecikme_gun:teslimler.reduce((t,x)=>t+x.gecikme,0) },
    kalite: { toplam:kkToplam, kabul:kkKabul, red:kkRed, oranPct:kaliteOran },
    puan,
    cat: ts()
  };
}

// ══════════════════════════════════════════════════════════════
//  28. SİSTEM SAĞLIK MERKEZİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * ERP sistemi kapsamlı sağlık denetimi.
 * Sadece hataları değil, çözüm önerilerini de döndürür.
 */
function sistemSaglikDenetimi(){
  const bulgular = [];
  const ekle = (seviye, kategori, baslik, detay='', oneri='') =>
    bulgular.push({ seviye, kategori, baslik, detay, oneri, zaman:ts() });

  // 1. Eksik BOM kontrolü
  const mamuller = ldS('urun').filter(u=>u.urunTipi==='mamul'&&u.aktif!==false);
  mamuller.forEach(m => {
    const bom = ldBOM().find(b=>b.mamulUrunId===m.id && b.aktif!==false);
    if(!bom) ekle('hata','bom', `BOM Eksik: ${m.ad}`, `${m.kod} için aktif reçete yok`,
      `bom.html sayfasından ${m.ad} için reçete oluşturun`);
    else if(!(bom.satirlar||[]).length) ekle('uyari','bom', `BOM Boş: ${m.ad}`, 'Reçete var ama satır yok',
      `bom.html'den ${m.ad} reçetesine malzeme ekleyin`);
  });

  // 2. Kritik stok kontrolü
  const kritikler = stokUyarilar();
  kritikler.forEach(u => ekle('uyari','stok', `Kritik Stok: ${u.ad}`,
    `Mevcut: ${u.toplamStok} ${u.birim||'adet'}, Min: ${u.minStok}`,
    `stok.html'den stok hareketi veya satın alma talebi oluşturun`));

  // 3. Negatif stok kontrolü
  ldS('urun').forEach(u => {
    if(urunStok(u.id) < 0) ekle('hata','stok', `Negatif Stok: ${u.ad}`,
      `${urunStok(u.id)} ${u.birim||'adet'}`,
      'Stok düzeltme hareketi girin');
  });

  // 4. Bekleyen onaylar
  const onaylar = bekleyenOnaylar();
  if(onaylar.length > 0) ekle('bilgi','onay', `${onaylar.length} Bekleyen Onay`,
    onaylar.map(o=>o.islemNo).join(', '),
    'admin.html veya bildirimler sayfasından onaylayın');

  // 5. Geciken üretim emirleri
  const bugun = today();
  const geciken = (ld('uretim')||[]).filter(u =>
    !u.sil && ['hazirlaniyor','uretimde','kalite_kontrol'].includes(u.durum) &&
    u.planliTeslim && u.planliTeslim < bugun
  );
  geciken.forEach(u => ekle('uyari','uretim', `Geciken Üretim: ${u.ueNo}`,
    `Planlı teslim: ${u.planliTeslim}`,
    `uretim.html'den emri güncelleyin veya tamamlayın`));

  // 6. Bekleyen mal kabul
  const bekMalKabul = ldSA().filter(s=>s.durum==='onaylandi'&&!s.sil);
  if(bekMalKabul.length > 0) ekle('bilgi','satinalma', `${bekMalKabul.length} SA Mal Kabul Bekliyor`,
    bekMalKabul.map(s=>s.saNo).join(', '),
    'satinalma.html → Mal Kabul sekmesine gidin');

  // 7. Eksik seri no — tamamlanmış üretimlerde seri no eksik
  const tamUretimler = (ld('uretim')||[]).filter(u=>u.durum==='tamamlandi'&&!u.sil&&u.adet>0);
  tamUretimler.forEach(u => {
    const seriSay = uretimSeriKartlari(u.id).length;
    if(seriSay < u.adet) ekle('uyari','seri',
      `Eksik Seri No: ${u.ueNo}`, `${seriSay}/${u.adet} seri no girilmiş`,
      `seri.html'den eksik seri numaralarını ekleyin`);
  });

  // 8. Lot maliyet tutarsızlığı
  ldS('urun').forEach(u => {
    const lotMiktar = ldLOT().filter(l=>l.urunId===u.id&&l.durum==='aktif').reduce((t,l)=>t+l.kalanMiktar,0);
    const fizMiktar = urunStok(u.id);
    if(Math.abs(lotMiktar - fizMiktar) > 0.01 && (lotMiktar > 0 || fizMiktar > 0)){
      ekle('bilgi','lot', `Lot/Stok Uyumsuzluğu: ${u.ad}`,
        `Lot toplam: ${lotMiktar}, Fiziksel stok: ${fizMiktar}`,
        'Lot sistemine geçişte veri senkronizasyonu yapılmalı');
    }
  });

  // 9. Doküman eksiklikleri
  const eksikDok = eksikZorunluDokumanlar();
  eksikDok.forEach(e => ekle('uyari','dokuman', `Zorunlu Doküman Eksik: ${e.tur}`,
    `${e.ilgiliTip} #${e.ilgiliNo}`,
    'İlgili sayfadan dokümanı yükleyin'));

  const ozet = {
    hata:  bulgular.filter(b=>b.seviye==='hata').length,
    uyari: bulgular.filter(b=>b.seviye==='uyari').length,
    bilgi: bulgular.filter(b=>b.seviye==='bilgi').length,
    toplam: bulgular.length,
    saglik: bulgular.filter(b=>b.seviye==='hata').length === 0 ? 'iyi' : 'sorunlu',
  };

  // — Modül istatistikleri (saglik.html için)
  const urunler   = ldS('urun');
  const uretimler = ld('uretim')||[];
  const ithalatlar= ldITH()||[];
  const personeller= ldPER()||[];
  const varliklar = ldVARLIK()||[];
  const bildirimler= ldBILDIRIM()||[];

  const aktifUretim  = uretimler.filter(u=>!u.sil&&['hazirlaniyor','uretimde','kalite_kontrol'].includes(u.durum)).length;
  const aktifIthalat = ithalatlar.filter(i=>!i.sil&&i.durum!=='tamamlandi').length;
  const aktifPersonel= personeller.filter(p=>!p.sil&&p.aktif!==false).length;
  const toplamVarlik = varliklar.filter(v=>!v.sil).length;
  const okunmamisBildirim = bildirimler.filter(b=>!b.sil&&!b.okundu).length;
  const kritikStokSay= stokUyarilar().length;

  const toplamKayit = urunler.length + uretimler.filter(u=>!u.sil).length +
    ithalatlar.filter(i=>!i.sil).length + personeller.filter(p=>!p.sil).length +
    varliklar.filter(v=>!v.sil).length;

  // Skor hesabı: 100 - (hata*20) - (uyari*5), min 0
  const genelSkor = Math.max(0, 100 - ozet.hata * 20 - ozet.uyari * 5);

  const sorunlar  = bulgular.filter(b=>b.seviye==='hata').map(b=>`${b.baslik}: ${b.detay}`);
  const uyariMsj  = bulgular.filter(b=>b.seviye==='uyari').map(b=>`${b.baslik}: ${b.detay}`);
  const olumlu    = [];
  if(!ozet.hata)  olumlu.push('Kritik hata bulunmadı');
  if(!kritikStokSay) olumlu.push('Tüm ürünler yeterli stok seviyesinde');
  if(!aktifUretim||aktifUretim<5) olumlu.push('Üretim emirleri kontrol altında');

  return {
    bulgular, ozet,
    // saglik.html uyumlu alanlar
    genelSkor,
    toplamKayit,
    kritikSorunlar: sorunlar,
    sorunlar,
    uyarilar: uyariMsj,
    olumlu,
    stok:     { durum: kritikStokSay>0?'uyari':'ok', urunSayisi: urunler.filter(u=>u.aktif!==false).length, uyari: kritikStokSay>0?`${kritikStokSay} kritik stok`:'—' },
    uretim:   { durum: geciken.length>0?'uyari':'ok', aktifEmir: aktifUretim, uyari: geciken.length>0?`${geciken.length} geciken emir`:'—' },
    ithalat:  { durum:'ok', aktif: aktifIthalat, uyari:'—' },
    personel: { durum:'ok', aktif: aktifPersonel, uyari:'—' },
    varlik:   { durum:'ok', toplam: toplamVarlik, uyari:'—' },
    bildirim: { durum: okunmamisBildirim>10?'uyari':'ok', okunmamis: okunmamisBildirim, uyari: okunmamisBildirim>10?`${okunmamisBildirim} okunmamış`:'—' },
  };
}

// ══════════════════════════════════════════════════════════════
//  29. NAKİT AKIM TAHMİNİ (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Günlük, haftalık, aylık, 3-6-12 aylık nakit akış tahmini.
 * Mevcut kasa + banka + beklenen giriş/çıkışlardan hesaplanır.
 */
function nakitAkimTahmini(donem='aylik'){
  // Sayısal parametre verilirse (örn. 6 ay) → aylık dizi döner
  if(typeof donem === 'number'){
    const aySayisi = Math.max(1, Math.min(24, donem));
    const base = nakitAkimTahmini('aylik');          // tek dönem özeti al
    const aylikGiren = (base.tahminiGiris || 0) / aySayisi;
    const aylikCikan = (base.tahminiCikis || 0) / aySayisi;
    return Array.from({length: aySayisi}, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      const ayAd = d.toLocaleDateString('tr-TR', {month:'short', year:'numeric'});
      return {
        ay: ayAd,
        giren: aylikGiren,
        cikan: aylikCikan,
        net:   aylikGiren - aylikCikan,
        girisDetay: {
          'Tahsilat': ((base.detay?.gelecekTahsilat||0) / aySayisi)
        },
        cikisDetay: {
          'SA Ödemeleri': ((base.detay?.saOdemeler||0) / aySayisi),
          'Personel':     ((base.detay?.personelGider||0) / aySayisi),
          'Çek/Senet':    ((base.detay?.gelecekOdeme||0) / aySayisi)
        }
      };
    });
  }
  const bugun = new Date();
  const kasaBakiye = (ld('kh')||[]).filter(h=>!h.sil)
    .reduce((t,h)=>t+(h.yon==='giris'?1:-1)*(h.tutar||0)*(KUR[h.par||'TRY']||1), 0);
  const bankaBakiye = (ld('bh')||[]).filter(h=>!h.sil)
    .reduce((t,h)=>t+(h.yon==='giris'?1:-1)*(h.tutar||0)*(KUR[h.par||'TRY']||1), 0);
  const baslangicBakiye = kasaBakiye + bankaBakiye;

  const gunSayisi = { gunluk:1, haftalik:7, aylik:30, uc_aylik:90, alti_aylik:180, yillik:365 }[donem] || 30;

  // Bekleyen SA ödemeleri (çıkış)
  const saOdemeler = ldSA().filter(s=>!s.sil&&!['iptal','tamamlandi'].includes(s.durum))
    .reduce((t,s)=>{
      const tutar = (s.toplamTutar||s.toplamTRY||0);
      return t + tutar;
    }, 0);

  // Bekleyen çek/senet tahsilatları (giriş)
  const hedef = new Date(bugun.getTime() + gunSayisi*864e5).toISOString().slice(0,10);
  const bugStr = bugun.toISOString().slice(0,10);
  const gelecekTahsilat = (ld('cs')||[]).filter(s=>
    !s.sil && s.yon==='alacak' && !['tahsil','iptal'].includes(s.durum) &&
    s.vade >= bugStr && s.vade <= hedef
  ).reduce((t,s)=>t+(s.tutar||0)*(KUR[s.par||'TRY']||1), 0);

  const gelecekOdeme = (ld('cs')||[]).filter(s=>
    !s.sil && s.yon==='borc' && !['odendi','iptal'].includes(s.durum) &&
    s.vade >= bugStr && s.vade <= hedef
  ).reduce((t,s)=>t+(s.tutar||0)*(KUR[s.par||'TRY']||1), 0);

  // Personel gider tahmini (aylık baz)
  const aylikPersonelGider = ldPER().filter(p=>p.aktif!==false)
    .reduce((t,p)=>t+(p.isverenToplamMaliyet||p.brutMaas||0), 0);
  const donemPersonelGider = aylikPersonelGider * (gunSayisi/30);

  const tahminiGiris  = gelecekTahsilat;
  const tahminiCikis  = gelecekOdeme + donemPersonelGider;
  const netAkim       = tahminiGiris - tahminiCikis;
  const tahminiKapanis= baslangicBakiye + netAkim;

  return {
    donem, gunSayisi, baslangicBakiye, tahminiGiris, tahminiCikis, netAkim, tahminiKapanis,
    detay: {
      kasaBakiye, bankaBakiye, saOdemeler, gelecekTahsilat, gelecekOdeme,
      personelGider: donemPersonelGider,
    },
    uyari: tahminiKapanis < 0 ? 'Negatif bakiye riski!' : null,
  };
}

// ══════════════════════════════════════════════════════════════
//  30. GERÇEK MAMUL MALİYETİ HESAPLAYICI (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Formül:
 * Gerçek Mamul Maliyeti =
 *   Parça Maliyeti (FIFO lot bazlı)
 *   + İthalat Payı
 *   + İşçilik (saatlik_maliyet × üretim_süresi)
 *   + Genel Gider Payı
 *   + Fire Maliyeti
 *   + Kalite Kontrol Maliyeti
 *   + Paketleme
 */
function gercekMamulMaliyeti(uretimId){
  const uretim = ldURT().find(u=>u.id===uretimId);
  if(!uretim) return null;

  const bom    = ldBOM().find(b=>b.mamulUrunId===uretim.urunId && b.aktif!==false);
  const satirlar = bom?.satirlar || [];

  // Parça maliyeti — FIFO lot bazlı
  let parcaMaliyet = 0;
  satirlar.forEach(s => {
    const fireM = 1 + (s.fireOrani||0);
    const adet  = Math.ceil((s.miktar||1) * fireM * (uretim.adet||1));
    parcaMaliyet += fifoBirimMaliyet(s.urunId, adet) * adet;
  });

  // İşçilik
  const iscilikSure = uretim.iscilikSure || 0; // toplam adam-saat
  const saatlikUcret= uretim.saatlikUcret || 0;
  const iscilik     = iscilikSure * saatlikUcret;

  // Ek maliyetler
  const ekler = uretim.ekMaliyetler || {};
  const enerji     = ekler.enerji     || 0;
  const genelGider = ekler.genelGider || 0;
  const paketleme  = ekler.paketleme  || 0;
  const kalite     = ekler.kalite     || 0;

  const toplam    = parcaMaliyet + iscilik + enerji + genelGider + paketleme + kalite;
  const birimMaliyet = uretim.adet > 0 ? toplam / uretim.adet : 0;

  return {
    uretimId, mamulId:uretim.urunId, adet:uretim.adet||1,
    parcaMaliyet, iscilik, enerji, genelGider, paketleme, kalite,
    toplam: parseFloat(toplam.toFixed(2)),
    birimMaliyet: parseFloat(birimMaliyet.toFixed(2)),
    dagitim: {
      parcaPct:   toplam>0 ? Math.round(parcaMaliyet/toplam*100) : 0,
      iscilikPct: toplam>0 ? Math.round(iscilik/toplam*100) : 0,
      enerjiPct:  toplam>0 ? Math.round(enerji/toplam*100) : 0,
    }
  };
}

// ══════════════════════════════════════════════════════════════
//  31. GLOBAL FLOATING AI ASISTAN COMPONENT (v4.0)
// ══════════════════════════════════════════════════════════════

/**
 * Her sayfada sağ alt köşede çalışan, sayfa farkındalıklı global AI widget.
 * Çağrım: buildGlobalAI('pageId'); — sayfanın body onload veya DOMContentLoaded'ında
 */
function buildGlobalAI(pageId='dashboard'){
  if(document.getElementById('global-ai-widget')) return;
  // IZIN kontrolü — AI erişim yoksa widget oluşturma
  if(typeof IZIN !== 'undefined' && !IZIN.ai('sorgu')) return;

  // Sayfa bazlı bağlam
  const sayfaBaglam = {
    dashboard:   { ad:'Dashboard', sistem:() => `Stok:${ldS('urun').length} ürün. Üretim:${(ld('uretim')||[]).filter(u=>['uretimde','hazirlaniyor'].includes(u.durum)).length} aktif.` },
    stok:        { ad:'Stok',      sistem:() => `${ldS('urun').length} ürün. ${stokUyarilar().length} kritik stok uyarısı.` },
    satinalma:   { ad:'Satın Alma',sistem:() => `${ldSA().filter(s=>s.durum==='onay_bekliyor').length} onay bekliyor.` },
    ithalat:     { ad:'İthalat',   sistem:() => `${ldITH().filter(i=>i.durum!=='tamamlandi'&&i.durum!=='iptal').length} aktif ithalat.` },
    uretim:      { ad:'Üretim',    sistem:() => { const a=aiUretimAnaliz(); return `${a.uretimde.length} üretimde, ${a.bekleyen.length} planlandı.`; } },
    personel:    { ad:'Personel',  sistem:() => `${aktifPersoneller().length} aktif personel.` },
    varlik:      { ad:'Varlık',    sistem:() => `${aktifVarliklar().length} aktif varlık.` },
    bildirim:    { ad:'Bildirimler',sistem:()=> `${okunmamisBildirimler().length} okunmamış bildirim.` },
  };
  const baglamFn = sayfaBaglam[pageId]?.sistem || (() => 'ERP sistemi aktif.');
  const sayfaAd  = sayfaBaglam[pageId]?.ad || pageId;

  const css = `
  #global-ai-widget{position:fixed;bottom:20px;right:20px;z-index:9999;font-family:var(--fn,'system-ui')}
  #gai-btn{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
    border:none;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,.4);
    display:flex;align-items:center;justify-content:center;transition:transform .2s;position:relative}
  #gai-btn:hover{transform:scale(1.08)}
  #gai-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;
    font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;
    display:flex;align-items:center;justify-content:center;display:none}
  #gai-panel{position:absolute;bottom:62px;right:0;width:340px;
    background:var(--s,#fff);border:1px solid var(--bd,#e5e7eb);
    border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.15);
    display:none;flex-direction:column;overflow:hidden;max-height:480px}
  #gai-panel.open{display:flex}
  #gai-header{padding:14px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
    color:#fff;display:flex;justify-content:space-between;align-items:center}
  #gai-header h4{margin:0;font-size:13px;font-weight:600}
  #gai-header span{font-size:11px;opacity:.8}
  #gai-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
  .gai-msg{padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.5;max-width:90%}
  .gai-msg.user{background:#6366f1;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .gai-msg.ai{background:var(--s2,#f8fafc);color:var(--t,#1e293b);align-self:flex-start;border-bottom-left-radius:4px;border:1px solid var(--bd,#e5e7eb)}
  #gai-quick{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bd,#e5e7eb)}
  .gai-q{background:var(--bld,#eff6ff);color:var(--bl,#2563eb);border:none;
    border-radius:20px;padding:4px 10px;font-size:11px;cursor:pointer;transition:.1s}
  .gai-q:hover{opacity:.8}
  #gai-inp-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--bd,#e5e7eb)}
  #gai-inp{flex:1;border:1px solid var(--bd,#e5e7eb);border-radius:8px;
    padding:7px 10px;font-size:12px;background:var(--s,#fff);color:var(--t,#1e293b);outline:none}
  #gai-inp:focus{border-color:#6366f1}
  #gai-send{background:#6366f1;color:#fff;border:none;border-radius:8px;
    width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  `;

  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);

  const wrap = document.createElement('div');
  wrap.id = 'global-ai-widget';
  wrap.innerHTML = `
    <div id="gai-panel">
      <div id="gai-header">
        <h4>🧠 ERP AI Asistan</h4>
        <span>${sayfaAd} sayfası</span>
      </div>
      <div id="gai-msgs">
        <div class="gai-msg ai">Merhaba! ${sayfaAd} sayfasında yardımcı olabilirim.<br><small style="opacity:.7">${baglamFn()}</small></div>
      </div>
      <div id="gai-quick">
        <button class="gai-q" onclick="gaiSor('Sistem durumu nedir?')">📊 Durum</button>
        <button class="gai-q" onclick="gaiSor('Kritik uyarılar var mı?')">⚠️ Uyarılar</button>
        <button class="gai-q" onclick="gaiSor('Bugün ne yapmalıyım?')">📋 Görevler</button>
        <button class="gai-q" onclick="gaiSor('Nakit durumu nasıl?')">💰 Nakit</button>
      </div>
      <div id="gai-inp-row">
        <input id="gai-inp" type="text" placeholder="Soru sorun..." onkeydown="if(event.key==='Enter')gaiGonder()">
        <button id="gai-send" onclick="gaiGonder()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
    </div>
    <button id="gai-btn" onclick="gaiToggle()">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <div id="gai-badge"></div>
    </button>
  `;
  document.body.appendChild(wrap);

  // Okunmamış bildirim rozeti
  const bildirimSay = okunmamisBildirimler().length;
  if(bildirimSay > 0){
    const badge = document.getElementById('gai-badge');
    if(badge){ badge.textContent = bildirimSay > 9 ? '9+' : bildirimSay; badge.style.display='flex'; }
  }

  window.gaiToggle = function(){
    const panel = document.getElementById('gai-panel');
    panel?.classList.toggle('open');
  };

  window.gaiSor = function(metin){
    const inp = document.getElementById('gai-inp');
    if(inp){ inp.value = metin; gaiGonder(); }
  };

  window.gaiGonder = function(){
    const inp = document.getElementById('gai-inp');
    const txt = inp?.value?.trim();
    if(!txt) return;
    inp.value = '';
    const msgs = document.getElementById('gai-msgs');
    if(!msgs) return;

    // Kullanıcı mesajı
    const userDiv = document.createElement('div');
    userDiv.className = 'gai-msg user';
    userDiv.textContent = txt;
    msgs.appendChild(userDiv);

    // AI yanıt
    const aiDiv = document.createElement('div');
    aiDiv.className = 'gai-msg ai';
    aiDiv.textContent = '…';
    msgs.appendChild(aiDiv);
    msgs.scrollTop = msgs.scrollHeight;

    // Kural tabanlı cevap motoru
    setTimeout(() => {
      aiDiv.innerHTML = gaiCevapla(txt, pageId, baglamFn());
      msgs.scrollTop = msgs.scrollHeight;
      aiLog('global_ai', txt, aiDiv.textContent, 'ok');
    }, 300);
  };
}

/** Global AI kural tabanlı cevap motoru */
function gaiCevapla(soru, sayfaId, baglam){
  // ── IZIN guard: AI sorgu yetkisi yok ──
  if(typeof IZIN !== 'undefined' && !IZIN.ai('sorgu')){
    return '🔒 Bu hesabın AI sorgulama yetkisi yok. Yöneticinizle iletişime geçin.';
  }
  const s = soru.toLowerCase();
  const _izinVeri = (tip) => typeof IZIN === 'undefined' || IZIN.veri(tip);

  if(/durum|özet|nasıl/.test(s)) return `📊 Sistem Durumu:<br>${baglam}<br>Sağlık: ${sistemSaglikDenetimi().ozet.saglik === 'iyi' ? '✅ İyi' : '⚠️ Sorun var'}`;
  if(/uyar|kritik|sorun|hata/.test(s)){
    const d = sistemSaglikDenetimi();
    if(!d.bulgular.length) return '✅ Sistemde kritik sorun bulunamadı.';
    return `⚠️ ${d.ozet.hata} hata, ${d.ozet.uyari} uyarı:<br>` +
      d.bulgular.slice(0,3).map(b=>`• ${b.baslik}`).join('<br>');
  }
  if(/nakit|kasa|para|banka/.test(s)){
    if(!_izinVeri('kasa_bakiye') && !_izinVeri('banka_bakiye'))
      return '🔒 Nakit/kasa verilerine erişim yetkiniz yok.';
    const n = nakitAkimTahmini('aylik');
    return `💰 30 Günlük Nakit Tahmini:<br>Başlangıç: ${fmtTL(n.baslangicBakiye)}<br>Beklenen Giriş: ${fmtTL(n.tahminiGiris)}<br>Beklenen Çıkış: ${fmtTL(n.tahminiCikis)}<br>Net: ${fmtTL(n.netAkim)}${n.uyari?'<br>⚠️ '+n.uyari:''}`;
  }
  if(/görev|yapmalı|ne var/.test(s)){
    const gorevler = bekleyenGorevler();
    const onaylar  = bekleyenOnaylar();
    if(!gorevler.length && !onaylar.length) return '✅ Bekleyen görev veya onay yok.';
    let yanit = '';
    if(onaylar.length) yanit += `📋 ${onaylar.length} bekleyen onay var.<br>`;
    if(gorevler.length) yanit += `✔ ${gorevler.length} görev var: ${gorevler.slice(0,2).map(g=>g.baslik).join(', ')}`;
    return yanit;
  }
  if(/stok|eksik|parça/.test(s)){
    const analiz = aiStokAnaliz();
    let stokYanit = `📦 Stok Özeti:<br>Kritik: ${analiz.kritik.length} ürün<br>Bitmekte: ${analiz.bitmekte.length} ürün<br>MRP Önerisi: ${aiMrpOneri(5).length} mamul için parça eksik`;
    if(_izinVeri('maliyet')) stokYanit += `<br>💰 Maliyet analizi: Stok sayfasından görüntüleyebilirsiniz.`;
    return stokYanit;
  }
  if(/maliyet|fiyat|kar|kâr|marj/.test(s)){
    if(!_izinVeri('maliyet') && !_izinVeri('kar_marji'))
      return '🔒 Maliyet ve fiyat verilerine erişim yetkiniz yok.';
    return `💰 Maliyet bilgisi için Stok → Maliyet sekmesine gidin.`;
  }
  if(/maas|maaş|personel.*ücret|sgk/.test(s)){
    if(!_izinVeri('maas')) return '🔒 Personel maaş verilerine erişim yetkiniz yok.';
    const p = aktifPersoneller();
    return `👥 ${p.length} aktif personel. Detaylar için Personel sayfasına gidin.`;
  }
  if(/üretim|emri/.test(s)){
    const a = aiUretimAnaliz();
    return `🏭 Üretim Özeti:<br>Planlandı: ${a.bekleyen.length}<br>Üretimde: ${a.uretimde.length}<br>Kalite KT: ${a.kalite.length}<br>Geciken: ${a.geciken.length}`;
  }
  if(/bildirim|mesaj/.test(s)){
    const oku = okunmamisBildirimler();
    return oku.length ? `🔔 ${oku.length} okunmamış bildirim var.<br>${oku.slice(0,3).map(b=>b.baslik).join('<br>')}` : '✅ Yeni bildirim yok.';
  }
  if(/git|aç|geç/.test(s)){
    const linkler = { dashboard:'dashboard.html', stok:'stok.html', satinalma:'satinalma.html',
      uretim:'uretim.html', ithalat:'ithalat.html', personel:'personel.html',
      bildirim:'bildirim.html', admin:'admin.html' };
    for(const [k,v] of Object.entries(linkler)){
      if(s.includes(k)) return `<a href="${v}" style="color:#6366f1;text-decoration:underline">→ ${k} sayfasına git</a>`;
    }
  }
  // Komut ayrıştırıcıya dön
  const komut = aiKomutParse(soru);
  if(komut && komut.intent !== 'bilinmiyor') return `${komut.intent} komutu algılandı. İlgili sayfaya gidin veya ilgili butona tıklayın.`;
  return `Anladım: "${soru.substring(0,40)}${soru.length>40?'…':''}". Daha spesifik bir soru sormayı deneyin veya ilgili sayfaya gidin.`;
}

// ══════════════════════════════════════════════════════════════
//  32. MASRAF TÜRLERİ SEED (v4.0)
// ══════════════════════════════════════════════════════════════
function seedMasrafTurleri(){
  if(ldMASRAF_TUR().length > 0) return;
  const turler = [
    { id:1, kod:'navlun',    ad:'Navlun',              dagitimYontemi:'hacim',   aktif:true },
    { id:2, kod:'gumruk',    ad:'Gümrük Vergisi',      dagitimYontemi:'deger',   aktif:true },
    { id:3, kod:'sigorta',   ad:'Sigorta',              dagitimYontemi:'deger',   aktif:true },
    { id:4, kod:'liman',     ad:'Liman Masrafı',        dagitimYontemi:'adet',    aktif:true },
    { id:5, kod:'ic_nakliye',ad:'İç Nakliye',           dagitimYontemi:'agirlik', aktif:true },
    { id:6, kod:'antrepo',   ad:'Antrepo/Depolama',     dagitimYontemi:'adet',    aktif:true },
    { id:7, kod:'acente',    ad:'Gümrük Acentesi',      dagitimYontemi:'manuel',  aktif:true },
    { id:8, kod:'fumigasyon',ad:'Fumigasyon',            dagitimYontemi:'adet',    aktif:true },
    { id:9, kod:'test',      ad:'Test/Sertifikasyon',   dagitimYontemi:'adet',    aktif:true },
    { id:10,kod:'diger',     ad:'Diğer Masraf',         dagitimYontemi:'deger',   aktif:true },
  ];
  svMASRAF_TUR(turler);
}

function seedMaliyetMerkezleri(){
  if(ldMMERKEZ().length > 0) return;
  const merkezler = [
    { id:1, kod:'URETIM',    ad:'Üretim',       aktif:true },
    { id:2, kod:'SATIS',     ad:'Satış',        aktif:true },
    { id:3, kod:'IK',        ad:'İnsan Kaynakları', aktif:true },
    { id:4, kod:'YONETIM',   ad:'Yönetim',      aktif:true },
    { id:5, kod:'ITHALAT',   ad:'İthalat',      aktif:true },
    { id:6, kod:'DEPO',      ad:'Depo & Lojistik', aktif:true },
  ];
  svMMERKEZ(merkezler);
}

function seedGiderTurleri(){
  if(ldGIDER_TUR().length > 0) return;
  const turler = [
    { id:1, kod:'personel',  ad:'Personel Gideri', maliyetMerkeziId:3, aktif:true },
    { id:2, kod:'kira',      ad:'Kira',            maliyetMerkeziId:4, aktif:true },
    { id:3, kod:'elektrik',  ad:'Elektrik',        maliyetMerkeziId:1, aktif:true },
    { id:4, kod:'su',        ad:'Su',              maliyetMerkeziId:1, aktif:true },
    { id:5, kod:'dogalgaz',  ad:'Doğalgaz',        maliyetMerkeziId:1, aktif:true },
    { id:6, kod:'internet',  ad:'İnternet/Telefon',maliyetMerkeziId:4, aktif:true },
    { id:7, kod:'arac',      ad:'Araç Gideri',     maliyetMerkeziId:6, aktif:true },
    { id:8, kod:'bakim',     ad:'Makine Bakım',    maliyetMerkeziId:1, aktif:true },
    { id:9, kod:'sigorta',   ad:'Sigorta',         maliyetMerkeziId:4, aktif:true },
    { id:10,kod:'diger',     ad:'Diğer Gider',     maliyetMerkeziId:4, aktif:true },
  ];
  svGIDER_TUR(turler);
}

