/* ============================================================
   HURRA MOTOR ERP — core.js  v3.3
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
function fmt(n, dec=2){ if(typeof dec!=="number") dec=2; return Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function fmtTL(n){ return fmt(n) + ' ₺'; }
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

function setSession(remember){
  const hours = remember ? 24 * 30 : 8;
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(SESSION_KEY);
  store.setItem(SESSION_KEY, JSON.stringify({
    exp: Date.now() + hours * 3600 * 1000,
    user: SESSION_USER,
    remember: !!remember
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
    KUR.USD = parseFloat((1 / data.rates.USD).toFixed(4));
    KUR.EUR = parseFloat((1 / data.rates.EUR).toFixed(4));
    KUR.CNY = parseFloat((1 / data.rates.CNY).toFixed(4));
    localStorage.setItem(KUR_CACHE_KEY, JSON.stringify({ ts: Date.now(), kur: KUR }));
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

function urunStok(urunId, depoId=null){
  const hrtler = ldS('sh').filter(h => h.urunId === urunId && !h.sil);
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

/** Tek çağrıyla tüm örnek verileri yükle */
function ornekVerileriYukle(){
  stokVeriYukle();
  kategoriVeriYukle();
  urunAilesiVeriYukle();
  bomVeriYukle();
}

// ══════════════════════════════════════════════════════════════
//  13. NAVİGASYON & UI YARDIMCILARI
// ══════════════════════════════════════════════════════════════

const NAV_GROUPS = [
  { single:true,  id:'dashboard',  href:'dashboard.html',  label:'🏠 Dashboard' },
  { label:'💰 Finans', ids:['kasa','cariler','ceksenet'], items:[
    { id:'kasa',     href:'kasa.html',      label:'💰 Kasa' },
    { id:'cariler',  href:'cariler.html',   label:'👥 Cariler' },
    { id:'ceksenet', href:'ceksenet.html',  label:'📄 Çek/Senet' },
  ]},
  { single:true,  id:'satinalma',  href:'satinalma.html',  label:'🛒 Satın Alma' },
  { label:'📦 Stok', ids:['stok','seri','urun-ailesi','bom'], items:[
    { id:'stok',        href:'stok.html',        label:'📦 Stok' },
    { id:'seri',        href:'seri.html',         label:'🔢 Seri No' },
    { id:'urun-ailesi', href:'urun-ailesi.html',  label:'🗂️ Ürün Ailesi' },
    { id:'bom',         href:'bom.html',          label:'📋 Reçeteler' },
  ]},
  { single:true,  id:'uretim',   href:'uretim.html',   label:'🏭 Üretim' },
  { single:true,  id:'ayarlar',  href:'ayarlar.html',  label:'⚙️ Ayarlar' },
  { single:true,  id:'admin',    href:'admin.html',    label:'🛡️ Yönetici', adminOnly:true },
];

function buildNav(activeId){
  const nav = document.getElementById('main-nav');
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
  const visGroups = NAV_GROUPS.filter(g => !g.adminOnly || isAdmin);
  nav.innerHTML = visGroups.map(g => {
    if(g.single){
      return `<a href="${g.href}" class="hnav${g.id===activeId?' nav-active':''}">${g.label}</a>`;
    }
    const on = g.ids.includes(activeId);
    return `<div class="nav-g"><button class="nav-g-btn${on?' on':''}">${g.label}${chv}</button><div class="nav-dd">${g.items.map(i=>`<a href="${i.href}" class="${i.id===activeId?'nav-active':''}">${i.label}</a>`).join('')}</div></div>`;
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
  'dashboard':    null,         // herkes
  'cariler':      'cariler',
  'kasa':         'kasa',
  'ceksenet':     'ceksenet',
  'satinalma':    'satinalma',
  'stok':         'stok',
  'seri':         'seri',
  'urun-ailesi':  'urun_ailesi',
  'bom':          'bom',
  'uretim':       'uretim',
  'ayarlar':      'ayarlar',
  'admin':        'admin'
};

function getUsers(){
  const list = ld('users');
  if(list && list.length) return list;
  // Varsayılan admin kullanıcısı
  return [{ id:'u1', username:'hurramotor', role:'admin', ad:'Sistem Yöneticisi', aktif:true, olusturma: ts() }];
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
  store.setItem(SESSION_KEY, JSON.stringify({
    exp: Date.now() + hours * 3600 * 1000,
    user: username,
    username: username,
    remember: !!remember
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

function logUserAction(username, action, detay=''){
  const logs = ld('user_logs') || [];
  logs.unshift({ ts: ts(), username, action, detay, ip:'local' });
  if(logs.length > 1000) logs.length = 1000;
  sv('user_logs', logs);
}

function getUserLogs(){ return ld('user_logs') || []; }

