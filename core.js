/* ============================================================
   HURRA MOTOR ERP — core.js  v3.0
   Tüm sayfalar bu dosyayı <script src="core.js"> ile yükler.
   Sıra: cariler → satinalma → stok → seri → ürün ailesi → BOM → üretim
   ============================================================ */
'use strict';

// ══════════════════════════════════════════════════════════════
//  1. VERİ KATMANI — TÜM DB ANAHTARLARI
// ══════════════════════════════════════════════════════════════

/** Cari & finans modülü */
const DB = {
  c:    'hm_c',      // cariler
  h:    'hm_h',      // cari hareketler
  b:    'hm_b',      // bankalar
  bh:   'hm_bh',     // banka hareketleri
  log:  'hm_log',    // işlem log
  gr:   'hm_gr',     // cari gruplar
  tl:   'hm_tl',     // talepler
  kasa: 'hm_kasa',   // kasa tanımları
  kh:   'hm_kh',     // kasa hareketleri
  ay:   'hm_ay',     // ayarlar
  cs:   'hm_cs',     // çek/senet
};

/** Stok modülü */
const STOK_DB = {
  urun:  'hm_urun',  // ürün kartları (genişletilmiş)
  depo:  'hm_depo',  // depolar
  sh:    'hm_sh',    // stok hareketleri
  tr:    'hm_tr',    // transfer belgeleri
  seri:  'hm_seri',  // seri numaraları
};

/** Satın alma modülü */
const SA_DB_KEY = 'hm_sa';

/** ── YENİ: Ürün ailesi, BOM, Üretim modülleri ── */
const URUN_AILESI_DB = 'hm_urun_ailesi'; // ürün aileleri / kategoriler
const BOM_DB         = 'hm_bom';         // Bill of Materials (reçeteler)
const URETIM_DB      = 'hm_uretim';      // üretim emirleri

// ── Generic ld/sv (cari/finans için) ──────────────────────────
function ld(k){
  try{ return JSON.parse(localStorage.getItem(DB[k])) || []; }
  catch{ return []; }
}
function sv(k, v){ localStorage.setItem(DB[k], JSON.stringify(v)); }
function ldObj(k, def={}){
  try{ return JSON.parse(localStorage.getItem(DB[k])) || def; }
  catch{ return def; }
}

// ── Stok ld/sv ────────────────────────────────────────────────
function ldS(k){
  try{ return JSON.parse(localStorage.getItem(STOK_DB[k])) || []; }
  catch{ return []; }
}
function svS(k, v){ localStorage.setItem(STOK_DB[k], JSON.stringify(v)); }

// ── Satın alma ld/sv ──────────────────────────────────────────
function ldSA(){ try{ return JSON.parse(localStorage.getItem(SA_DB_KEY)) || []; } catch{ return []; } }
function svSA(v){ localStorage.setItem(SA_DB_KEY, JSON.stringify(v)); }

// ── Ürün ailesi ld/sv ─────────────────────────────────────────
function ldUA(){ try{ return JSON.parse(localStorage.getItem(URUN_AILESI_DB)) || []; } catch{ return []; } }
function svUA(v){ localStorage.setItem(URUN_AILESI_DB, JSON.stringify(v)); }

// ── BOM ld/sv ─────────────────────────────────────────────────
function ldBOM(){ try{ return JSON.parse(localStorage.getItem(BOM_DB)) || []; } catch{ return []; } }
function svBOM(v){ localStorage.setItem(BOM_DB, JSON.stringify(v)); }

// ── Üretim ld/sv ──────────────────────────────────────────────
function ldURT(){ try{ return JSON.parse(localStorage.getItem(URETIM_DB)) || []; } catch{ return []; } }
function svURT(v){ localStorage.setItem(URETIM_DB, JSON.stringify(v)); }

// ══════════════════════════════════════════════════════════════
//  2. YARDIMCI FONKSİYONLAR
// ══════════════════════════════════════════════════════════════

function today(){ return new Date().toISOString().split('T')[0]; }
function ts(){ return new Date().toISOString(); }
function nid(arr){ return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1; }
function ini(str){ return (str || '?').split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase(); }
function fmt(n, dec=2){ return Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function fmtTL(n){ return fmt(n) + ' ₺'; }
function pad(n, len=2){ return String(n).padStart(len,'0'); }
function uuid(){ return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

// Tarih formatla (YYYY-MM-DD → GG.AA.YYYY)
function fmtTarih(d){
  if(!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
}

// ══════════════════════════════════════════════════════════════
//  3. OTURUM YÖNETİMİ
// ══════════════════════════════════════════════════════════════

const SESSION_KEY = 'hm_session';
const SESSION_PASS = 'Hm@2026!';
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
  const hours = remember ? 24*30 : 8;
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

window.forgotPass = function(){
  alert('Şifreniz: Hm@2026!\nKullanıcı adınız: hurramotor\n\nBu bilgileri güvenli bir yere kaydedin.');
};

// ══════════════════════════════════════════════════════════════
//  4. KURLAR
// ══════════════════════════════════════════════════════════════

let KUR = { USD:32.5, EUR:35.2, CNY:4.5 };
const KUR_CACHE_KEY = 'hm_kur_cache';
const KUR_CACHE_TTL = 15 * 60 * 1000; // 15 dakika

async function kurCek(){
  try{
    const cache = JSON.parse(localStorage.getItem(KUR_CACHE_KEY)||'null');
    if(cache && (Date.now() - cache.ts) < KUR_CACHE_TTL){
      KUR = cache.kur;
      return KUR;
    }
    // TCMB JSON proxy
    const res = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,CNY');
    if(!res.ok) throw new Error('API hatası');
    const data = await res.json();
    // frankfurter TRY→X verir, bize X→TRY lazım
    KUR.USD = parseFloat((1/data.rates.USD).toFixed(4));
    KUR.EUR = parseFloat((1/data.rates.EUR).toFixed(4));
    KUR.CNY = parseFloat((1/data.rates.CNY).toFixed(4));
    localStorage.setItem(KUR_CACHE_KEY, JSON.stringify({ ts:Date.now(), kur:KUR }));
  }catch(e){
    console.warn('Kur çekilemedi, önbellekteki/varsayılan kullanılıyor:', e.message);
    // Önbellekten al (süresi dolmuş olsa bile)
    try{
      const old = JSON.parse(localStorage.getItem(KUR_CACHE_KEY)||'null');
      if(old) KUR = old.kur;
    }catch{}
  }
  return KUR;
}

function tlCevir(tutar, par){ return tutar * (KUR[par] || 1); }

// ══════════════════════════════════════════════════════════════
//  5. STOK HESAPLAMA
// ══════════════════════════════════════════════════════════════

function urunStok(urunId, depoId=null){
  const hrtler = ldS('sh').filter(h => h.urunId === urunId && !h.sil);
  if(depoId){
    return hrtler.reduce((t, h) => {
      if(h.depoId === depoId) t += (h.yon === 'giris' ? 1 : -1) * h.miktar;
      if(h.tip === 'transfer' && h.hedefDepoId === depoId) t += h.miktar;
      if(h.tip === 'transfer' && h.depoId === depoId) t -= h.miktar;
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

/** Stok çıkışı öncesi negatif kontrol */
function stokNegatifKontrol(urunId, depoId, miktar){
  const mevcut = urunStok(urunId, depoId);
  if(mevcut - miktar < 0){
    const u = ldS('urun').find(x => x.id === urunId);
    const d = ldS('depo').find(x => x.id === depoId);
    return {
      ok: false,
      msg: `Yetersiz stok!\n${u?.ad||'Ürün'} — ${d?.ad||'Depo'}\nMevcut: ${mevcut} ${u?.birim||''}\nÇıkış: ${miktar} ${u?.birim||''}\nFark: ${mevcut-miktar} ${u?.birim||''}`
    };
  }
  return { ok: true };
}

/** Seri numarası benzersizlik kontrolü */
function seriNoBenzersizMi(no, haricId=null){
  try{
    const liste = JSON.parse(localStorage.getItem(STOK_DB.seri)) || [];
    return !liste.some(s => s.no === no && s.id !== haricId);
  }catch{ return true; }
}

// ══════════════════════════════════════════════════════════════
//  6. ÜRÜN AİLESİ YARDIMCILARI
// ══════════════════════════════════════════════════════════════

/**
 * Ürün ailesi şeması:
 * { id, kod, ad, aciklama, anaGrup, renk, simge, aktif, olusturmaTarihi }
 *
 * anaGrup örnekleri: 'Motorsiklet', 'Motor Grubu', 'Şasi & Kaporta',
 *   'Elektrik', 'Süspansiyon', 'Fren', 'Yakıt Sistemi', 'Sarf Malzeme'
 */

function urunAilesiGetir(id){
  return ldUA().find(a => a.id === id) || null;
}

function urunAilesiListesi(anaGrup=null){
  const liste = ldUA().filter(a => a.aktif !== false);
  return anaGrup ? liste.filter(a => a.anaGrup === anaGrup) : liste;
}

/** Bir ürünün ait olduğu aileyi döndürür */
function urunAilesiAd(urunAilesiId){
  const a = urunAilesiGetir(urunAilesiId);
  return a ? a.ad : '';
}

// ══════════════════════════════════════════════════════════════
//  7. BOM (MALZEME LİSTESİ / REÇETE) YARDIMCILARI
// ══════════════════════════════════════════════════════════════

/**
 * BOM şeması:
 * {
 *   id, kod, ad, mamulUrunId, revizyon, durum,        // 'taslak'|'aktif'|'pasif'
 *   satirlar: [
 *     { id, urunId, miktar, birim, not, opsiyonel }
 *   ],
 *   notlar, olusturmaTarihi, guncellemeTarihi
 * }
 */

function bomGetir(bomId){
  return ldBOM().find(b => b.id === bomId) || null;
}

function urunBomları(urunId){
  return ldBOM().filter(b => b.mamulUrunId === urunId && b.durum !== 'pasif');
}

function aktifBom(urunId){
  return ldBOM().find(b => b.mamulUrunId === urunId && b.durum === 'aktif') || null;
}

/** BOM malzeme maliyeti hesapla (ürün alış fiyatlarına göre) */
function bomMaliyet(bomId, par='TRY'){
  const bom = bomGetir(bomId);
  if(!bom) return 0;
  const urunler = ldS('urun');
  return bom.satirlar.reduce((top, s) => {
    const u = urunler.find(x => x.id === s.urunId);
    if(!u) return top;
    const fiyat = u.par === 'TRY' ? u.alisFiyat : tlCevir(u.alisFiyat, u.par);
    return top + fiyat * s.miktar;
  }, 0);
}

/** Üretim için yeterli stok var mı? */
function bomStokKontrol(bomId, adet=1, depoId=null){
  const bom = bomGetir(bomId);
  if(!bom) return { ok: false, eksikler: [] };
  const eksikler = [];
  for(const s of bom.satirlar){
    if(s.opsiyonel) continue;
    const mevcut = urunStok(s.urunId, depoId);
    const gereken = s.miktar * adet;
    if(mevcut < gereken){
      const u = ldS('urun').find(x => x.id === s.urunId);
      eksikler.push({
        urunId: s.urunId, urunAd: u?.ad||'?',
        gereken, mevcut, fark: gereken - mevcut, birim: s.birim||u?.birim||'adet'
      });
    }
  }
  return { ok: eksikler.length === 0, eksikler };
}

// ══════════════════════════════════════════════════════════════
//  8. ÜRETİM EMRİ YARDIMCILARI
// ══════════════════════════════════════════════════════════════

/**
 * Üretim emri şeması:
 * {
 *   id, ueNo,                                          // 'UE-2026-0001'
 *   urunId, urunAd, bomId, adet,
 *   durum,    // 'planlandi'|'hazirlaniyor'|'uretimde'|'tamamlandi'|'iptal'
 *   oncelik,  // 'dusuk'|'normal'|'yuksek'|'acil'
 *   planliBaslangic, planliTeslim,
 *   gercekBaslangic, gercekBitis,
 *   hedefDepoId,   // üretilen ürünün gideceği depo
 *   malzemeDepoId, // hammaddenin alınacağı depo
 *   islemler: [{ tarih, kullanici, not, durum }],
 *   olusturmaTarihi, guncellemeTarihi
 * }
 */

function uretimEmriGetir(id){
  return ldURT().find(e => e.id === id) || null;
}

function uretimEmriNo(){
  const yil = new Date().getFullYear();
  const liste = ldURT().filter(e => e.ueNo?.startsWith('UE-' + yil));
  const son = liste.length ? Math.max(...liste.map(e => parseInt(e.ueNo.split('-')[2]||0))) : 0;
  return `UE-${yil}-${pad(son+1, 4)}`;
}

function uretimDurumRenk(durum){
  return {
    planlandi:    { bg:'#dbeafe', fg:'#1e40af' },
    hazirlaniyor: { bg:'#fef9c3', fg:'#854d0e' },
    uretimde:     { bg:'#dcfce7', fg:'#166534' },
    tamamlandi:   { bg:'#f0fdf4', fg:'#15803d' },
    iptal:        { bg:'#fee2e2', fg:'#991b1b' },
  }[durum] || { bg:'#f1f5f9', fg:'#475569' };
}

function uretimDurumAd(durum){
  return {
    planlandi:'Planlandı', hazirlaniyor:'Hazırlanıyor',
    uretimde:'Üretimde', tamamlandi:'Tamamlandı', iptal:'İptal'
  }[durum] || durum;
}

// ══════════════════════════════════════════════════════════════
//  9. ÜRÜN KARTI — GENİŞLETİLMİŞ ŞEMA
// ══════════════════════════════════════════════════════════════

/**
 * Ürün kartı tam şeması (hm_urun içindeki her kayıt):
 * {
 *   // — Temel alanlar (v1) —
 *   id, kod, barkod, ad, marka, model,
 *   kategori,        // eski serbest metin kategori (geriye dönük uyumluluk)
 *   birim,           // 'adet'|'kg'|'m'|'lt'|'takım'
 *   alisFiyat, satisFiyat, par,  // 'TRY'|'USD'|'EUR'|'CNY'
 *   kdv,             // %
 *   minStok,
 *   seriTakip,       // boolean — seri no takibi açık mı?
 *   aktif,
 *   notlar,
 *   olusturmaTarihi,
 *
 *   // — v2 (stok modülü) —
 *   depoYeri,        // raf/bölge kodu
 *   agirlik,         // kg
 *   boyutlar,        // '120x80x40 mm'
 *   tedarikSuresi,   // gün
 *   tedarikciId,     // hm_c'deki cari id
 *
 *   // — v3 (ürün ailesi / BOM / üretim — YENİ) —
 *   urunTipi,        // 'hammadde'|'yardimci'|'yari_mamul'|'mamul'|'sarf'|'hizmet'
 *   urunAilesiId,    // hm_urun_ailesi kaydının id'si
 *   varyant: {       // null veya obje
 *     renk, beden, kapasite, voltaj, tip, diger
 *   },
 *   bomId,           // varsayılan/aktif BOM id (hm_bom'dan)
 * }
 *
 * urunTipi açıklamaları:
 *   hammadde   → çelik boru, alüminyum plaka, plastik granül…
 *   yardimci   → cıvata, somun, kayış, sealant…
 *   yari_mamul → işlenmiş parça (ör. işlenmiş şasi çerçevesi)
 *   mamul      → bitmiş ürün (ör. HM-250 Enduro Motorsiklet)
 *   sarf       → boya, yağ, temizleyici…
 *   hizmet     → işçilik, nakliye kalemi…
 */

/** Ürün tipi görünen adı */
function urunTipiAd(tip){
  return {
    hammadde:'Hammadde', yardimci:'Yardımcı Malzeme',
    yari_mamul:'Yarı Mamul', mamul:'Mamul',
    sarf:'Sarf Malzeme', hizmet:'Hizmet/İşçilik'
  }[tip] || tip || '—';
}

/** Ürün tipi rengi */
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

/** Ürün için varyant etiketi oluştur */
function varyantEtiket(v){
  if(!v) return '';
  const parcalar = [];
  if(v.renk)     parcalar.push(v.renk);
  if(v.beden)    parcalar.push(v.beden);
  if(v.kapasite) parcalar.push(v.kapasite);
  if(v.voltaj)   parcalar.push(v.voltaj + 'V');
  if(v.tip)      parcalar.push(v.tip);
  if(v.diger)    parcalar.push(v.diger);
  return parcalar.join(' / ');
}

/** Yeni ürün kaydı şablonu */
function yeniUrunSablonu(){
  return {
    id: null, kod:'', barkod:'', ad:'', marka:'', model:'',
    kategori:'', birim:'adet',
    alisFiyat:0, satisFiyat:0, par:'USD', kdv:18,
    minStok:0, seriTakip:false, aktif:true, notlar:'',
    depoYeri:'', agirlik:0, boyutlar:'', tedarikSuresi:0, tedarikciId:null,
    // v3 — YENİ
    urunTipi:'yardimci',
    urunAilesiId:null,
    varyant: null,
    bomId: null,
    olusturmaTarihi: ts()
  };
}

// ══════════════════════════════════════════════════════════════
//  10. ÖRNEK VERİ YÜKLEME
// ══════════════════════════════════════════════════════════════

function stokVeriYukle(){
  if(!ldS('depo').length) svS('depo',[
    {id:1,ad:'Ana Depo',kod:'DEPO-1',konum:'Antalya Fabrika',acik:'Ana üretim deposu',aktif:true},
    {id:2,ad:'Yedek Parça',kod:'DEPO-2',konum:'Antalya Fabrika',acik:'Yedek parça ve sarf',aktif:true},
    {id:3,ad:'Servis Deposu',kod:'DEPO-3',konum:'Antalya Servis',acik:'Servis merkezi deposu',aktif:true},
    {id:4,ad:'Çin Transit',kod:'DEPO-4',konum:'Guangzhou / Zhejiang',acik:"Çin'den gelen transit mallar",aktif:true},
  ]);

  if(!ldS('urun').length) svS('urun',[
    {id:1,kod:'MTR-001',barkod:'8690001000010',ad:'250cc Motor Bloğu',marka:'GZ Motor',model:'GZM-250',kategori:'Motor',birim:'adet',alisFiyat:850,satisFiyat:1200,par:'USD',kdv:18,minStok:5,seriTakip:true,aktif:true,notlar:'',urunTipi:'hammadde',urunAilesiId:null,varyant:null,bomId:null,olusturmaTarihi:ts()},
    {id:2,kod:'SAS-001',barkod:'8690001000027',ad:'Enduro Şasi Çerçevesi',marka:'HM',model:'HM-250',kategori:'Şasi',birim:'adet',alisFiyat:420,satisFiyat:650,par:'USD',kdv:18,minStok:10,seriTakip:true,aktif:true,notlar:'',urunTipi:'yari_mamul',urunAilesiId:null,varyant:{renk:'Siyah'},bomId:null,olusturmaTarihi:ts()},
    {id:3,kod:'FRN-001',barkod:'8690001000034',ad:'Ön Fren Diski 220mm',marka:'Zhejiang',model:'ZH-220',kategori:'Fren',birim:'adet',alisFiyat:45,satisFiyat:80,par:'USD',kdv:18,minStok:20,seriTakip:false,aktif:true,notlar:'',urunTipi:'yardimci',urunAilesiId:null,varyant:null,bomId:null,olusturmaTarihi:ts()},
    {id:4,kod:'ELK-001',barkod:'8690001000041',ad:'72V 45Ah Lityum Batarya',marka:'CATL',model:'CL-7245',kategori:'Elektrik',birim:'adet',alisFiyat:1100,satisFiyat:1600,par:'USD',kdv:18,minStok:8,seriTakip:true,aktif:true,notlar:'',urunTipi:'hammadde',urunAilesiId:null,varyant:{voltaj:'72',kapasite:'45Ah'},bomId:null,olusturmaTarihi:ts()},
    {id:5,kod:'MMR-001',barkod:'8690001000058',ad:'HM-250 Enduro Motorsiklet',marka:'HURRA',model:'HM-250',kategori:'Mamul',birim:'adet',alisFiyat:0,satisFiyat:4800,par:'USD',kdv:18,minStok:2,seriTakip:true,aktif:true,notlar:'Bitmiş ürün — şase+motor+elektrik montajı',urunTipi:'mamul',urunAilesiId:null,varyant:{renk:'Kırmızı/Siyah'},bomId:null,olusturmaTarihi:ts()},
    {id:6,kod:'SRF-001',barkod:'8690001000065',ad:'Motor Yağı 10W-40 (1L)',marka:'Mobil',model:'M10W40',kategori:'Sarf',birim:'lt',alisFiyat:8,satisFiyat:14,par:'USD',kdv:20,minStok:50,seriTakip:false,aktif:true,notlar:'',urunTipi:'sarf',urunAilesiId:null,varyant:null,bomId:null,olusturmaTarihi:ts()},
  ]);
}

/** Ürün ailesi örnek verisi */
function urunAilesiVeriYukle(){
  if(ldUA().length) return;
  svUA([
    {id:1,kod:'UA-001',ad:'Enduro Serisi',aciklama:'HM-250 ve üzeri Enduro model grubu',anaGrup:'Motorsiklet',renk:'#1d4ed8',simge:'🏍️',aktif:true,olusturmaTarihi:ts()},
    {id:2,kod:'UA-002',ad:'Pit Bike Serisi',aciklama:'HM-110/140 Pit Bike model grubu',anaGrup:'Motorsiklet',renk:'#dc2626',simge:'🛵',aktif:true,olusturmaTarihi:ts()},
    {id:3,kod:'UA-003',ad:'Motor & Aktarma',aciklama:'Motor bloğu, şanzıman ve bağlantı parçaları',anaGrup:'Motor Grubu',renk:'#9333ea',simge:'⚙️',aktif:true,olusturmaTarihi:ts()},
    {id:4,kod:'UA-004',ad:'Şasi & Kaporta',aciklama:'Çerçeve, plastik panel, amortisör braketleri',anaGrup:'Şasi & Kaporta',renk:'#0891b2',simge:'🔩',aktif:true,olusturmaTarihi:ts()},
    {id:5,kod:'UA-005',ad:'Elektrik & Batarya',aciklama:'Kablo demeti, kontrolcü, batarya, aydınlatma',anaGrup:'Elektrik',renk:'#f59e0b',simge:'⚡',aktif:true,olusturmaTarihi:ts()},
    {id:6,kod:'UA-006',ad:'Fren Sistemi',aciklama:'Disk, kaliper, balata, hidrolik',anaGrup:'Fren',renk:'#ef4444',simge:'🛑',aktif:true,olusturmaTarihi:ts()},
    {id:7,kod:'UA-007',ad:'Yakıt & Hava',aciklama:'Karbüratör, enjektör, filtre, depo',anaGrup:'Yakıt Sistemi',renk:'#10b981',simge:'⛽',aktif:true,olusturmaTarihi:ts()},
    {id:8,kod:'UA-008',ad:'Sarf Malzemeleri',aciklama:'Yağlar, temizleyiciler, sarf sarf sarf',anaGrup:'Sarf Malzeme',renk:'#6b7280',simge:'🪣',aktif:true,olusturmaTarihi:ts()},
  ]);
}

/** BOM örnek verisi */
function bomVeriYukle(){
  if(ldBOM().length) return;
  svBOM([
    {
      id:1, kod:'BOM-001', ad:'HM-250 Enduro — Ana Reçete',
      mamulUrunId:5, revizyon:'1.0', durum:'aktif',
      satirlar:[
        {id:1,urunId:1,miktar:1,birim:'adet',not:'250cc motor bloğu',opsiyonel:false},
        {id:2,urunId:2,miktar:1,birim:'adet',not:'Enduro şasi çerçevesi',opsiyonel:false},
        {id:3,urunId:3,miktar:2,birim:'adet',not:'Ön+arka fren diski',opsiyonel:false},
        {id:4,urunId:4,miktar:1,birim:'adet',not:'72V batarya',opsiyonel:false},
        {id:5,urunId:6,miktar:2,birim:'lt',not:'Motor yağı dolumu',opsiyonel:false},
      ],
      notlar:'Standart montaj reçetesi. Elektrik kiti ve plastikler ayrı BOM.',
      olusturmaTarihi:ts(), guncellemeTarihi:ts()
    },
  ]);
  // BOM id'sini mamul ürüne bağla
  const urunler = ldS('urun');
  const idx = urunler.findIndex(u => u.id === 5);
  if(idx > -1){ urunler[idx].bomId = 1; svS('urun', urunler); }
}

/** Tüm örnek verileri yükle (tek seferlik, ilk çalıştırmada) */
function ornekVerileriYukle(){
  stokVeriYukle();
  urunAilesiVeriYukle();
  bomVeriYukle();
}

// ══════════════════════════════════════════════════════════════
//  11. NAVİGASYON & UI YARDIMCILARI
// ══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { id:'dashboard',    href:'dashboard.html',    label:'🏠 Dashboard' },
  { id:'cariler',      href:'cariler.html',       label:'👥 Cariler' },
  { id:'kasa',         href:'kasa.html',          label:'💰 Kasa' },
  { id:'ceksenet',     href:'ceksenet.html',       label:'📄 Çek/Senet' },
  { id:'satinalma',    href:'satinalma.html',     label:'🛒 Satın Alma' },
  { id:'stok',         href:'stok.html',          label:'📦 Stok' },
  { id:'seri',         href:'seri.html',          label:'🔢 Seri No' },
  { id:'urun-ailesi',  href:'urun-ailesi.html',   label:'🗂️ Ürün Ailesi' },
  { id:'bom',          href:'bom.html',           label:'📋 Reçeteler' },
  { id:'uretim',       href:'uretim.html',        label:'🏭 Üretim' },
  { id:'ayarlar',      href:'ayarlar.html',       label:'⚙️ Ayarlar' },
];

function buildNav(activeId){
  const nav = document.getElementById('main-nav');
  if(!nav) return;
  nav.innerHTML = NAV_ITEMS.map(item =>
    `<a href="${item.href}" class="hnav${item.id===activeId?' active':''}">${item.label}</a>`
  ).join('');
}

function toast(msg, dur=2400, type='info'){
  let el = document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('show'), dur);
}

function openModal(id){ document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id)?.classList.add('hidden'); }

function toggleDark(){
  const d = document.documentElement;
  const isDark = d.getAttribute('data-theme') === 'dark';
  d.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('hm_theme', isDark ? 'light' : 'dark');
}

function applyTheme(){
  const t = localStorage.getItem('hm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
}

// ══════════════════════════════════════════════════════════════
//  12. LOG
// ══════════════════════════════════════════════════════════════

function log(modul, islem, detay=''){
  const liste = ld('log');
  liste.unshift({ id:nid(liste), ts:ts(), modul, islem, detay });
  if(liste.length > 500) liste.length = 500;
  sv('log', liste);
}

// ══════════════════════════════════════════════════════════════
//  13. BAŞLANGIÇ
// ══════════════════════════════════════════════════════════════

(function init(){
  applyTheme();
  // Oturum kontrolü (index.html ve login sayfası hariç)
  if(!location.pathname.endsWith('index.html') && location.pathname !== '/'){
    if(!checkSession()) location.href = 'index.html';
  }
  // Kurları arka planda güncelle
  kurCek().catch(()=>{});
})();
