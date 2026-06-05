/* ============================================================
   HURRA MOTOR ERP — core.js
   Tüm sayfalar bu dosyayı kullanır
   ============================================================ */

'use strict';

// ── VERİ KATMANI ───────────────────────────────────────────
const DB = {
  c:   'hm_c',    // cariler
  h:   'hm_h',    // hareketler
  b:   'hm_b',    // bankalar
  bh:  'hm_bh',   // banka hareketleri
  log: 'hm_log',  // log
  gr:  'hm_gr',   // gruplar
  tl:  'hm_tl',   // talepler
  kasa:'hm_kasa', // nakit kasa bakiyeleri
  kh:  'hm_kh',   // kasa hareketleri
  ay:  'hm_ay',   // ayarlar
};

function ld(k){
  try{ return JSON.parse(localStorage.getItem(DB[k]))||[]; }
  catch{ return []; }
}
function sv(k,v){ localStorage.setItem(DB[k], JSON.stringify(v)); }

function ldObj(k, def={}){
  try{ return JSON.parse(localStorage.getItem(DB[k]))||def; }
  catch{ return def; }
}

// ── YARDIMCI FONKSİYONLAR ─────────────────────────────────
function today(){
  return new Date().toISOString().split('T')[0];
}
function ts(){
  return new Date().toISOString();
}
function nid(arr){
  return arr.length ? Math.max(...arr.map(x=>x.id||0))+1 : 1;
}
function ini(str){
  return (str||'?').slice(0,2).toUpperCase();
}

// Para formatla
function fmt(v, par='TRY'){
  const n = Math.abs(v||0);
  const syms = {TRY:'₺',USD:'$',EUR:'€',CNY:'¥'};
  const sym = syms[par]||par+' ';
  return sym + n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtTRY(v){
  return '₺' + Math.abs(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function sign(v){ return v>=0?'+ ':' − '; }
function signClass(v){ return v>=0?'pos':'neg'; }

// Tarih formatla
function fmtDate(d){
  if(!d) return '—';
  const parts = d.split('-');
  if(parts.length!==3) return d;
  const ay=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return `${parts[2]} ${ay[parseInt(parts[1])-1]} ${parts[0]}`;
}
function daysDiff(dateStr){
  if(!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ── KUR YÖNETİMİ ──────────────────────────────────────────
let KUR = { TRY:1, USD:32.5, EUR:35.2, CNY:4.5 };
let KUR_PREV = { ...KUR };

async function kurCek(){
  try{
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
    if(!r.ok) throw new Error();
    const d = await r.json();
    KUR_PREV = { ...KUR };
    if(d.rates?.USD) KUR.USD = +(1/d.rates.USD).toFixed(4);
    if(d.rates?.EUR) KUR.EUR = +(1/d.rates.EUR).toFixed(4);
    if(d.rates?.CNY) KUR.CNY = +(1/d.rates.CNY).toFixed(4);
    localStorage.setItem('hm_kur_cache', JSON.stringify({KUR, ts:Date.now()}));
    kurGoster();
  }catch{
    // Cache'ten yükle
    try{
      const c = JSON.parse(localStorage.getItem('hm_kur_cache'));
      if(c?.KUR){ KUR_PREV={...KUR}; Object.assign(KUR,c.KUR); kurGoster(); }
    }catch{}
  }
}

function kurGoster(){
  ['USD','EUR','CNY'].forEach(p=>{
    const vEl = document.getElementById('kv-'+p.toLowerCase());
    const dEl = document.getElementById('kd-'+p.toLowerCase());
    if(!vEl) return;
    const v = KUR[p];
    const prev = KUR_PREV[p];
    const up = v >= prev;
    vEl.textContent = v.toFixed(4);
    vEl.className = 'kv ' + (up?'up':'dn');
    if(dEl){ dEl.textContent = up?'+':'−'; dEl.className='kd '+(up?'up':'dn'); }
  });
}

// ── AYARLAR ────────────────────────────────────────────────
const AYAR_DEF = {
  // Firma (hukuki)
  unvan:'Hurra Motor Teknoloji San. ve Tic. Ltd. Şti.',
  firma:'HURRA',          // geriye uyumluluk - marka kısa adı
  vno:'',vd:'',mersis:'',ticaret:'',
  adres:'',sehir:'',posta:'',tel:'',email:'',web:'',
  // Marka
  marka:'HURRA',
  markaKisa:'HURRA',
  slogan:'Move Smart',
  markaYil: new Date().getFullYear(),
  // Muhasebe
  para:'TRY',vade:30,kdv:20,yil:'01',
  // Görünüm
  renk:'#2563eb',dark:false,ondlk:true,
  // Uyarı
  uyarGun:7,
};

function getAy(k){
  const obj = ldObj('ay', AYAR_DEF);
  return obj[k]!==undefined ? obj[k] : AYAR_DEF[k];
}
function setAy(k,v){
  const obj = ldObj('ay', AYAR_DEF);
  obj[k] = v;
  sv('ay', obj);
}

// ── TEMA ───────────────────────────────────────────────────
function temaUygula(){
  const dark = getAy('dark');
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  const btn = document.getElementById('dark-toggle');
  if(btn) btn.textContent = dark?'☀️':'🌙';
  // Renk
  const renk = getAy('renk')||'#2563eb';
  document.documentElement.style.setProperty('--bl', renk);
  // Header: marka adı göster (firma ünvanı değil)
  const nm = document.getElementById('brand-nm');
  if(nm) nm.textContent = getAy('marka')||getAy('firma')||'HURRA';
  // Logo varsa header'da göster
  const logoData = localStorage.getItem('hm_logo');
  const bm = document.querySelector('.brand-mark');
  if(bm && logoData){
    bm.innerHTML = `<img src="${logoData}" style="max-height:22px;max-width:22px;object-fit:contain">`;
  }
}
function toggleDark(){
  const cur = getAy('dark');
  setAy('dark', !cur);
  temaUygula();
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg, tip='ok'){
  let el = document.getElementById('toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${tip} show`;
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.className=`toast ${tip}`, 2800);
}

// ── MODAL ──────────────────────────────────────────────────
function modalAc(id){
  const el = document.getElementById(id);
  if(el) el.classList.remove('hidden');
}
function modalKapat(id){
  const el = document.getElementById(id);
  if(el) el.classList.add('hidden');
}
// Overlay dışına tıklayınca kapat
document.addEventListener('click', function(e){
  if(e.target.classList.contains('overlay') && !e.target.classList.contains('hidden')){
    e.target.classList.add('hidden');
  }
});
// ESC ile kapat
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    document.querySelectorAll('.overlay:not(.hidden)').forEach(o=>o.classList.add('hidden'));
  }
});

// ── AUTH ───────────────────────────────────────────────────
// Şifre SHA-256 hash olarak saklanır — kaynak kodda açık şifre yok.
// Şifreyi değiştirmek için: ayarlar.html → Güvenlik → Şifre Değiştir
const AUTH_KEY  = 'hm_auth';
const AUTH_UKEY = 'hm_credentials'; // kullanıcı adı + hash burada saklanır

// Varsayılan kimlik bilgileri (ilk kurulumda)
// Kullanıcı: hurramotor  Şifre: Hm@2026!
const DEFAULT_HASH = 'b525d782daebfc6ebbf40bef219fe5f82c2e9c827d2ca4a1e40acadb07affca8';
const DEFAULT_USER = 'hurramotor';

async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function getCredentials(){
  try{
    const c = JSON.parse(localStorage.getItem(AUTH_UKEY));
    if(c && c.user && c.hash) return c;
  }catch{}
  // Varsayılan
  return { user: DEFAULT_USER, hash: DEFAULT_HASH };
}

async function loginKontrol(girilenUser, girilenPass){
  const creds = getCredentials();
  const passHash = await sha256(girilenPass);
  return girilenUser.trim() === creds.user && passHash === creds.hash;
}

async function sifreDegistir(eskiSifre, yeniKullanici, yeniSifre){
  const creds = getCredentials();
  const eskiHash = await sha256(eskiSifre);
  if(eskiHash !== creds.hash) return {ok:false, msg:'Mevcut şifre hatalı'};
  if(!yeniSifre || yeniSifre.length < 6) return {ok:false, msg:'Yeni şifre en az 6 karakter olmalı'};
  if(!yeniKullanici || yeniKullanici.length < 3) return {ok:false, msg:'Kullanıcı adı en az 3 karakter olmalı'};
  const yeniHash = await sha256(yeniSifre);
  localStorage.setItem(AUTH_UKEY, JSON.stringify({user:yeniKullanici, hash:yeniHash}));
  return {ok:true};
}

function sessionKontrol(){
  try{
    const s1 = JSON.parse(localStorage.getItem(AUTH_KEY));
    if(s1 && s1.exp > Date.now()) return true;
  }catch{}
  try{
    const s2 = JSON.parse(sessionStorage.getItem(AUTH_KEY));
    if(s2 && s2.exp > Date.now()) return true;
  }catch{}
  return false;
}

function sessionKur(hatirla){
  const creds = getCredentials();
  const saat = hatirla ? 24*30 : 8;
  const obj = { exp: Date.now()+saat*3600*1000, user: creds.user };
  if(hatirla){
    localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
    sessionStorage.removeItem(AUTH_KEY);
  } else {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(obj));
    localStorage.removeItem(AUTH_KEY);
  }
}

function sessionSil(){
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

function cikisYap(){
  sessionSil();
  window.location.href = 'index.html';
}

function authKontrol(){
  if(!sessionKontrol()){
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── SAAT ───────────────────────────────────────────────────
function saatBaslat(){
  function guncelle(){
    const n = new Date();
    const g = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][n.getDay()];
    const ay = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][n.getMonth()];
    const s = `${g}, ${String(n.getDate()).padStart(2,'0')} ${ay} ${n.getFullYear()} — ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
    const el = document.getElementById('live-clock');
    if(el) el.textContent = s;
  }
  guncelle();
  setInterval(guncelle, 1000);
}

// ── HEADER RENDER ──────────────────────────────────────────
function headerRender(aktifSayfa){
  const pages = [
    { id:'dashboard', href:'dashboard.html', label:'Ana Sayfa' },
    { id:'cariler',   href:'cariler.html',   label:'Cariler' },
    { id:'kasa',      href:'kasa.html',      label:'Kasa' },
    { id:'stok',      href:'stok.html',      label:'📦 Stok' },
    { id:'seri',      href:'seri.html',      label:'🔢 Seri No' },
    { id:'ceksenet',  href:'ceksenet.html',  label:'📄 Çek / Senet' },
    { id:'ayarlar',   href:'ayarlar.html',   label:'⚙ Ayarlar' },
  ];
  const navEl = document.getElementById('main-nav');
  if(navEl){
    navEl.innerHTML = pages.map(p=>
      `<a href="${p.href}" class="hn ${p.id===aktifSayfa?'on':''}">${p.label}</a>`
    ).join('');
  }
  // Firma adı
  temaUygula();
  // Kur strip
  kurCek();
  // Saat
  saatBaslat();
}

// ── BAKİYE HESAPLAMA ───────────────────────────────────────
function cariHrtl(cid){
  return ld('h').filter(h=>h.cid===cid && !h.sil);
}
function cariBakC(cid){
  // Para birimi bazında bakiye
  const r={};
  cariHrtl(cid).forEach(h=>{
    if(!r[h.par]) r[h.par]=0;
    r[h.par] += (h.yon==='alacak'?1:-1)*h.tutar;
  });
  return r;
}
function cariBakTRY(cid){
  return cariHrtl(cid).reduce((t,h)=>{
    return t + (h.yon==='alacak'?1:-1)*(h.try_||h.tutar*KUR[h.par]||0);
  },0);
}

function bankaTRY(bid){
  return ld('bh').filter(h=>h.bid===bid&&!h.sil).reduce((t,h)=>{
    return t + (h.yon==='giris'?1:-1)*(h.try_||h.tutar*KUR[h.par]||0);
  },0);
}
function bankaBakC(bid){
  const r={};
  ld('bh').filter(h=>h.bid===bid&&!h.sil).forEach(h=>{
    if(!r[h.par]) r[h.par]=0;
    r[h.par] += (h.yon==='giris'?1:-1)*h.tutar;
  });
  return r;
}

function kasaBakiye(par='TRY'){
  const k = ldObj('kasa', {TRY:0,USD:0,EUR:0,CNY:0});
  return k[par]||0;
}
function kasaTumBakiye(){
  return ldObj('kasa', {TRY:0,USD:0,EUR:0,CNY:0});
}

// ── ÖDEME KONTROL ──────────────────────────────────────────
function odemeKontrol(tip, tutar, par, bankaId){
  // Çek, senet vb. → serbest
  if(['cek','senet','dbs','takas','mahsup','akreditif'].includes(tip)){
    return {ok:true};
  }
  // Nakit → kasa
  if(tip==='nakit'){
    const bk = kasaBakiye(par);
    if(bk < tutar){
      return {ok:false, msg:`Nakit kasada ${par} yetersiz! Bakiye: ${fmt(bk,par)} — Gereken: ${fmt(tutar,par)}`};
    }
  }
  // Havale → banka
  if(tip==='havale' && bankaId){
    const bk = bankaBakC(bankaId);
    const v = bk[par]||0;
    if(par!=='TRY' && v < tutar){
      return {ok:false, msg:`Banka ${par} bakiyesi yetersiz! Bakiye: ${fmt(v,par)}`};
    }
  }
  return {ok:true};
}

// Nakit hareketten kasa güncelle
function kasaGuncelle(yon, tip, tutar, par, acik){
  if(tip!=='nakit') return;
  const k = ldObj('kasa', {TRY:0,USD:0,EUR:0,CNY:0});
  if(!k[par]) k[par]=0;
  k[par] += (yon==='borc'?-1:1)*tutar;
  localStorage.setItem(DB.kasa, JSON.stringify(k));
  // Hareket kaydı
  const hrts = ld('kh');
  hrts.push({id:nid(hrts), tip:yon==='borc'?'cikis':'giris', tutar, par, tarih:today(), acik:acik||'', auto:true, sil:false, cat:ts()});
  sv('kh', hrts);
}

// ── ÖRNEK VERİ ─────────────────────────────────────────────
function veriYukle(){
  // Gruplar
  if(!ld('gr').length) sv('gr',['Çin Tedarikçi','Yerli Tedarikçi','Ana Bayi','Bayi','Banka','Diğer']);

  // Bankalar
  if(!ld('b').length) sv('b',[
    {id:1,ad:'Garanti BBVA',kod:'GARAN',sube:'Antalya Merkez',subk:'842',iban:'TR76 0006 2000 8900 0006 2973 26',swft:'TGBATRIS',par:'TRY',tip:'pos',dur:'aktif',not:'Ana TRY hesabı',pos:{1:0,2:1.2,3:1.5,4:1.8,6:2.2,9:2.8,12:3.5}},
    {id:2,ad:'Ziraat Bankası',kod:'ZRAAT',sube:'Antalya',subk:'101',iban:'TR33 0001 0017 4532 6700 1000 01',swft:'TCZBTR2A',par:'USD',tip:'havale',dur:'aktif',not:'Döviz / dış ödeme',pos:{1:0,2:1.1,3:1.4,4:1.7,6:2.0,9:2.5,12:3.2}},
    {id:3,ad:'İş Bankası',kod:'ISBTR',sube:'Konyaaltı',subk:'550',iban:'TR18 0006 4000 0011 1230 0234 56',swft:'ISBKTRIS',par:'TRY',tip:'pos',dur:'aktif',not:'POS 2',pos:{1:0,2:1.2,3:1.4,4:1.6,6:2.1,9:2.6,12:3.4}},
    {id:4,ad:'Yapı Kredi',kod:'YKBNK',sube:'Antalya Şube',subk:'320',iban:'TR40 0006 7010 0000 0097 5318 57',swft:'YAPITRIS',par:'TRY',tip:'pos',dur:'aktif',not:'',pos:{1:0,2:1.3,3:1.6,4:1.9,6:2.4,9:3.0,12:3.8}},
  ]);

  // Cariler
  if(!ld('c').length) sv('c',[
    {id:1,kod:'TED-0001',ad:'Guangzhou Motor Parts Co.',kisa:'GZ Motor',tip:'tedarikci',gr:'Çin Tedarikçi',ulke:'CN',sehir:'Guangzhou',vno:'91440101MA5D2X0P9K',par:'USD',lim:500000,vade:60,odm:['havale','akreditif'],iban:'',swft:'BKCHCNBJ',not:'Ana motor tedarikçisi',irt:'Wang Lei',irt_email:'wanglei@gzmotorparts.cn'},
    {id:2,kod:'TED-0002',ad:'ZJ Frame Manufacturing Ltd.',kisa:'ZJ Frame',tip:'tedarikci',gr:'Çin Tedarikçi',ulke:'CN',sehir:'Zhejiang',vno:'91330000MA27Y5K22P',par:'USD',lim:300000,vade:45,odm:['havale','cek'],iban:'',swft:'ICBKCNBJ',not:'Şasi ve çerçeve',irt:'Li Ming',irt_email:'liming@zjframe.cn'},
    {id:3,kod:'TED-0003',ad:'Antalya Çelik Malzeme A.Ş.',kisa:'Antalya Çelik',tip:'tedarikci',gr:'Yerli Tedarikçi',ulke:'TR',sehir:'Antalya',vno:'0730456789',par:'TRY',lim:200000,vade:30,odm:['nakit','havale','kart','cek'],iban:'TR44 0001 2009 4520 0058 0000 01',swft:'',not:'Yerli metal malzeme'},
    {id:4,kod:'MUS-0001',ad:'Moto Türkiye Paz. A.Ş.',kisa:'Moto TR',tip:'musteri',gr:'Ana Bayi',ulke:'TR',sehir:'İstanbul',vno:'4610789012',par:'TRY',lim:2000000,vade:30,odm:['cek','havale','kart'],iban:'TR66 0006 2001 7580 0006 6981 23',swft:'',not:'Türkiye ana distribütörü'},
    {id:5,kod:'MUS-0002',ad:'Adventure Moto Antalya',kisa:'Adventure Moto',tip:'musteri',gr:'Bayi',ulke:'TR',sehir:'Antalya',vno:'0730123456',par:'TRY',lim:500000,vade:30,odm:['kart','nakit','havale'],iban:'TR22 0006 4000 0019 8760 0012 34',swft:'',not:'Antalya yetkili bayi'},
    {id:6,kod:'MUS-0003',ad:'İzmir Motorsiklet Ltd.',kisa:'İzmir Moto',tip:'musteri',gr:'Bayi',ulke:'TR',sehir:'İzmir',vno:'3510987654',par:'TRY',lim:300000,vade:30,odm:['nakit','kart'],iban:'',swft:'',not:'İzmir bölge bayii'},
  ]);

  // Hareketler
  if(!ld('h').length){
    const H=(id,cid,yon,tip,t,p,kur,tar,ack,e={})=>({
      id,cid,yon,tip,tutar:t,par:p,kur,try_:t*kur,tar,ack,
      bno:e.bno||'',vad:e.vad||'',bid:e.bid||null,hes:e.hes||'',
      cno:e.cno||'',duz:e.duz||'',muh:e.muh||'',
      dur:e.dur||'',odn:e.odn||0,
      tak:e.tak||1,kom:e.kom||0,ktry:e.ktry||0,ntry:e.ntry||0,ony:e.ony||'',
      not:e.not||'',sil:false,cat:ts()
    });
    sv('h',[
      // 2025 GZ Motor
      H(1,1,'borc','havale',45000,'USD',32.1,'2025-01-08','Motor bloğu Q1 2025 1.parti',{bno:'OD-2025-001',bid:2}),
      H(2,1,'borc','havale',28500,'USD',32.3,'2025-01-25','Karbüratör seti x100',{bno:'OD-2025-002',bid:2}),
      H(3,1,'borc','akreditif',62000,'USD',32.5,'2025-02-10','Motor bloğu Q1 2.parti LC',{bno:'LC-2025-001',bid:2}),
      H(4,1,'alacak','havale',4200,'USD',32.6,'2025-02-28','Kalite farkı iadesi',{bno:'IAD-2025-001',bid:2}),
      H(5,1,'borc','havale',38000,'USD',32.8,'2025-03-15','Piston segman x200',{bno:'OD-2025-003',bid:2}),
      H(6,1,'borc','havale',71000,'USD',33.1,'2025-04-05','Motor bloğu Q2',{bno:'OD-2025-004',bid:2}),
      H(7,1,'alacak','havale',6500,'USD',33.2,'2025-04-20','Hasarlı parça iadesi',{bno:'IAD-2025-002',bid:2}),
      H(8,1,'borc','havale',25000,'USD',33.4,'2025-05-08','Aksesuar ek parça',{bno:'OD-2025-005',bid:2}),
      H(9,1,'borc','akreditif',85000,'USD',33.6,'2025-06-01','Motor bloğu Q3 LC',{bno:'LC-2025-002',bid:2}),
      H(10,1,'borc','havale',18500,'USD',33.7,'2025-07-10','Fren sistemi komponentleri',{bno:'OD-2025-006',bid:2}),
      H(11,1,'borc','havale',92000,'USD',33.9,'2025-08-05','Motor bloğu Q3 son',{bno:'OD-2025-007',bid:2}),
      H(12,1,'borc','havale',31000,'USD',34.0,'2025-09-12','Q4 ön sipariş',{bno:'OD-2025-008',bid:2}),
      H(13,1,'borc','akreditif',78000,'USD',34.1,'2025-10-03','Motor bloğu Q4 LC',{bno:'LC-2025-003',bid:2}),
      H(14,1,'alacak','havale',5200,'USD',34.2,'2025-10-18','Garanti kapsamı iade',{bno:'IAD-2025-003',bid:2}),
      H(15,1,'borc','havale',42000,'USD',34.3,'2025-11-07','Kış stok takviye',{bno:'OD-2025-009',bid:2}),
      H(16,1,'borc','havale',55000,'USD',34.4,'2025-12-02','Yıl sonu toplu sipariş',{bno:'OD-2025-010',bid:2}),
      // 2025→2026 Devir GZ Motor
      H(17,1,'borc','mahsup',0,'TRY',1,'2025-12-31','2025 yılsonu devir — bkz. detay',{bno:'DVR-2025-001',not:'Devir bakiyesi: −685.000 USD (tedarikçiye borç)'}),
      // 2025 ZJ Frame
      H(20,2,'borc','havale',38000,'USD',32.1,'2025-01-15','Şasi Q1 1.parti',{bno:'OD-2025-020',bid:2}),
      H(21,2,'borc','cek',22000,'USD',32.4,'2025-02-01','Subframe x40',{bno:'CEK-2025-001',cno:'CEK-ZJ-2025-001',duz:'ZJ Frame',dur:'tahsil',vad:'2025-03-15',odn:22000}),
      H(22,2,'borc','havale',48000,'USD',32.7,'2025-03-10','Şasi Q1 2.parti',{bno:'OD-2025-021',bid:2}),
      H(23,2,'alacak','havale',4800,'USD',32.8,'2025-03-28','Kırık çerçeve iadesi',{bno:'IAD-2025-020',bid:2}),
      H(24,2,'borc','havale',55000,'USD',33.2,'2025-05-05','Şasi Q2',{bno:'OD-2025-022',bid:2}),
      H(25,2,'borc','havale',61000,'USD',33.7,'2025-08-08','Şasi Q3',{bno:'OD-2025-023',bid:2}),
      H(26,2,'alacak','havale',6200,'USD',33.9,'2025-09-02','Kalite itiraz iadesi',{bno:'IAD-2025-021',bid:2}),
      H(27,2,'borc','havale',44000,'USD',34.0,'2025-10-15','Şasi Q4 ön',{bno:'OD-2025-024',bid:2}),
      H(28,2,'borc','cek',32000,'USD',34.2,'2025-11-20','Subframe Q4',{bno:'CEK-2025-002',cno:'CEK-ZJ-2025-002',duz:'ZJ Frame',dur:'bekliyor',vad:'2026-01-20',odn:0}),
      H(29,2,'borc','havale',38000,'USD',34.4,'2025-12-10','Yıl sonu şasi',{bno:'OD-2025-025',bid:2}),
      // 2025 Antalya Çelik
      H(40,3,'borc','nakit',8400,'TRY',1,'2025-01-10','Cıvata somun Q1',{bno:'FAT-2025-001'}),
      H(41,3,'borc','kart',16800,'TRY',1,'2025-02-05','Conta keçe toplu',{bno:'FAT-2025-002',bid:1,tak:3,kom:1.5,ktry:252,ntry:16548,ony:'111222'}),
      H(42,3,'alacak','nakit',8400,'TRY',1,'2025-02-07','Nakit ödeme',{bno:'TAH-2025-001'}),
      H(43,3,'borc','nakit',6200,'TRY',1,'2025-03-12','Yüzey koruma',{bno:'FAT-2025-003'}),
      H(44,3,'borc','kart',24500,'TRY',1,'2025-04-08','Büyük malzeme Q2',{bno:'FAT-2025-004',bid:3,tak:6,kom:2.2,ktry:539,ntry:23961,ony:'222333'}),
      H(45,3,'alacak','havale',30700,'TRY',1,'2025-04-10','EFT toplu',{bno:'TAH-2025-002',bid:1}),
      H(46,3,'borc','nakit',9800,'TRY',1,'2025-05-20','Sarf malzeme',{bno:'FAT-2025-005'}),
      H(47,3,'borc','kart',18200,'TRY',1,'2025-06-15','Güvenlik donanımı',{bno:'FAT-2025-006',bid:1,tak:3,kom:1.5,ktry:273,ntry:17927,ony:'333444'}),
      H(48,3,'alacak','nakit',9800,'TRY',1,'2025-06-17','Nakit',{bno:'TAH-2025-003'}),
      H(49,3,'borc','nakit',11200,'TRY',1,'2025-10-25','Q4 malzeme',{bno:'FAT-2025-010'}),
      H(50,3,'borc','kart',28500,'TRY',1,'2025-11-12','Büyük Q4 alım',{bno:'FAT-2025-011',bid:1,tak:6,kom:2.2,ktry:627,ntry:27873,ony:'555666'}),
      H(51,3,'borc','nakit',9600,'TRY',1,'2025-12-08','Aralık stok',{bno:'FAT-2025-012'}),
      H(52,3,'alacak','havale',49300,'TRY',1,'2025-12-10','Yıl sonu ödeme',{bno:'TAH-2025-005',bid:1}),
      // 2025 Moto TR
      H(60,4,'alacak','cek',540000,'TRY',1,'2025-01-12','Satış 6x Enduro 250',{bno:'FAT-2025-040',cno:'CEK-MT-2025-001',duz:'Moto TR',dur:'tahsil',vad:'2025-02-12',odn:540000}),
      H(61,4,'alacak','cek',405000,'TRY',1,'2025-01-28','Satış 4.5x Trail 200',{bno:'FAT-2025-041',cno:'CEK-MT-2025-002',duz:'Moto TR',dur:'tahsil',vad:'2025-03-01',odn:405000}),
      H(62,4,'alacak','havale',270000,'TRY',1,'2025-02-15','EFT Trail peşinat',{bno:'TAH-2025-040',bid:1}),
      H(63,4,'alacak','cek',630000,'TRY',1,'2025-03-05','Satış 7x Enduro Q1',{bno:'FAT-2025-042',cno:'CEK-MT-2025-003',duz:'Moto TR',dur:'tahsil',vad:'2025-04-05',odn:630000}),
      H(64,4,'borc','nakit',24000,'TRY',1,'2025-03-20','İade hasar',{bno:'IAD-2025-040'}),
      H(65,4,'alacak','cek',720000,'TRY',1,'2025-07-08','Satış 8x Enduro Q3',{bno:'FAT-2025-045',cno:'CEK-MT-2025-006',duz:'Moto TR',dur:'tahsil',vad:'2025-08-08',odn:720000}),
      H(66,4,'alacak','cek',810000,'TRY',1,'2025-10-05','Satış 9x Enduro Q4',{bno:'FAT-2025-047',cno:'CEK-MT-2025-008',duz:'Moto TR',dur:'tahsil',vad:'2025-11-05',odn:810000}),
      H(67,4,'alacak','cek',900000,'TRY',1,'2025-12-10','Satış 10x Enduro yılsonu',{bno:'FAT-2025-049',cno:'CEK-MT-2025-010',duz:'Moto TR',dur:'bekliyor',vad:'2026-01-10',odn:0}),
      // 2025 Adventure Moto
      H(80,5,'alacak','kart',108000,'TRY',1,'2025-01-18','Satış 1x Enduro+2x Pit',{bno:'FAT-2025-050',bid:1,tak:3,kom:1.5,ktry:1620,ntry:106380,ony:'600001'}),
      H(81,5,'alacak','nakit',90000,'TRY',1,'2025-02-12','Satış nakit 2x Pit',{bno:'FAT-2025-051'}),
      H(82,5,'alacak','kart',162000,'TRY',1,'2025-03-08','Satış 2x Enduro',{bno:'FAT-2025-052',bid:3,tak:6,kom:2.2,ktry:3564,ntry:158436,ony:'600002'}),
      H(83,5,'alacak','kart',216000,'TRY',1,'2025-05-20','Satış 3x Enduro',{bno:'FAT-2025-053',bid:1,tak:9,kom:3.2,ktry:6912,ntry:209088,ony:'600003'}),
      H(84,5,'alacak','kart',270000,'TRY',1,'2025-09-15','Satış 3x Enduro 250',{bno:'FAT-2025-055',bid:4,tak:12,kom:4.2,ktry:11340,ntry:258660,ony:'600005'}),
      H(85,5,'alacak','kart',324000,'TRY',1,'2025-12-20','Satış yılsonu 4x Enduro',{bno:'FAT-2025-057',bid:1,tak:9,kom:3.2,ktry:10368,ntry:313632,ony:'600007'}),
      // 2025 İzmir Moto
      H(95,6,'alacak','nakit',108000,'TRY',1,'2025-01-22','Satış 3x Pit 125',{bno:'FAT-2025-060'}),
      H(96,6,'alacak','kart',72000,'TRY',1,'2025-02-28','Satış kart Trail',{bno:'FAT-2025-061',bid:1,tak:3,kom:1.5,ktry:1080,ntry:70920,ony:'700001'}),
      H(97,6,'alacak','nakit',126000,'TRY',1,'2025-04-25','Satış Pit+Enduro',{bno:'FAT-2025-063'}),
      H(98,6,'alacak','kart',144000,'TRY',1,'2025-05-30','Satış 2x Enduro',{bno:'FAT-2025-064',bid:3,tak:6,kom:2.2,ktry:3168,ntry:140832,ony:'700002'}),
      H(99,6,'alacak','nakit',108000,'TRY',1,'2025-12-22','Satış Aralık',{bno:'FAT-2025-071'}),
      // 2026 GZ Motor
      H(110,1,'borc','havale',62000,'USD',32.9,'2026-01-08','Motor bloğu Q1 2026',{bno:'OD-2026-001',bid:2}),
      H(111,1,'borc','havale',8500,'USD',33.1,'2026-01-20','Karbüratör+valf seti',{bno:'OD-2026-002',bid:2}),
      H(112,1,'borc','havale',15000,'USD',33.4,'2026-02-05','Piston segman x50',{bno:'OD-2026-003',bid:2}),
      H(113,1,'alacak','havale',3200,'USD',33.6,'2026-02-28','Eksik parça iadesi',{bno:'IAD-2026-001',bid:2}),
      H(114,1,'borc','havale',71000,'USD',33.8,'2026-03-12','Motor bloğu Q2 ön',{bno:'OD-2026-004',bid:2}),
      H(115,1,'borc','havale',9200,'USD',34.0,'2026-04-03','Aksesuar siparişi',{bno:'OD-2026-005',bid:2}),
      H(116,1,'alacak','havale',5000,'USD',34.1,'2026-04-15','Sertifika iadesi',{bno:'IAD-2026-002',bid:2}),
      H(117,1,'borc','havale',55000,'USD',34.2,'2026-05-07','Motor bloğu Q2 son',{bno:'OD-2026-006',bid:2}),
      H(118,1,'borc','havale',12400,'USD',34.3,'2026-06-01','Yedek parça stok',{bno:'OD-2026-007',bid:2}),
      // 2026 ZJ Frame
      H(120,2,'borc','havale',42000,'USD',32.9,'2026-01-10','Şasi Q1 2026',{bno:'OD-2026-010',bid:2}),
      H(121,2,'borc','cek',18500,'USD',33.2,'2026-02-01','Subframe batch',{bno:'CEK-2026-001',cno:'CEK-ZJ-2026-001',duz:'ZJ Frame',dur:'tahsil',vad:'2026-03-15',odn:18500}),
      H(122,2,'borc','havale',35000,'USD',33.7,'2026-03-18','Şasi Q2 ön',{bno:'OD-2026-011',bid:2}),
      H(123,2,'alacak','havale',4500,'USD',33.9,'2026-04-10','Kusurlu şasi iadesi',{bno:'IAD-2026-010',bid:2}),
      H(124,2,'borc','havale',28000,'USD',34.1,'2026-05-05','Subframe son',{bno:'OD-2026-012',bid:2}),
      H(125,2,'borc','cek',22000,'USD',34.3,'2026-05-25','Şasi ek sipariş',{bno:'CEK-2026-002',cno:'CEK-ZJ-2026-002',duz:'ZJ Frame',dur:'bekliyor',vad:'2026-07-20',odn:0}),
      // 2026 Antalya Çelik
      H(130,3,'borc','nakit',6800,'TRY',1,'2026-01-05','Cıvata somun Q1',{bno:'FAT-2026-001'}),
      H(131,3,'borc','kart',14200,'TRY',1,'2026-01-18','Conta keçe toplu',{bno:'FAT-2026-002',bid:1,tak:3,kom:1.5,ktry:213,ntry:13987,ony:'789012'}),
      H(132,3,'alacak','nakit',6800,'TRY',1,'2026-01-20','Nakit ödeme',{bno:'TAH-2026-001'}),
      H(133,3,'borc','kart',22000,'TRY',1,'2026-02-25','Büyük malzeme',{bno:'FAT-2026-004',bid:1,tak:6,kom:2.4,ktry:528,ntry:21472,ony:'345678'}),
      H(134,3,'alacak','havale',27400,'TRY',1,'2026-03-01','EFT',{bno:'TAH-2026-002',bid:1}),
      H(135,3,'borc','nakit',8900,'TRY',1,'2026-03-15','Sarf malzeme',{bno:'FAT-2026-005'}),
      H(136,3,'borc','kart',18500,'TRY',1,'2026-04-10','Periyodik malzeme',{bno:'FAT-2026-006',bid:3,tak:3,kom:1.4,ktry:259,ntry:18241,ony:'901234'}),
      H(137,3,'alacak','nakit',8900,'TRY',1,'2026-04-12','Nakit',{bno:'TAH-2026-003'}),
      H(138,3,'borc','nakit',7200,'TRY',1,'2026-05-08','Güvenlik',{bno:'FAT-2026-007'}),
      H(139,3,'borc','kart',9600,'TRY',1,'2026-06-02','Haziran stok',{bno:'FAT-2026-008',bid:1,tak:2,kom:1.2,ktry:115,ntry:9485,ony:'567890'}),
      // 2026 Moto TR
      H(150,4,'alacak','cek',540000,'TRY',1,'2026-01-15','Satış 6x Enduro',{bno:'FAT-2026-020',cno:'CEK-MT-2026-001',duz:'Moto TR',dur:'tahsil',vad:'2026-02-15',odn:540000}),
      H(151,4,'alacak','cek',630000,'TRY',1,'2026-02-20','Satış 7x Enduro Q1',{bno:'FAT-2026-022',cno:'CEK-MT-2026-003',duz:'Moto TR',dur:'tahsil',vad:'2026-03-20',odn:630000}),
      H(152,4,'alacak','havale',225000,'TRY',1,'2026-02-10','EFT Trail peşinat',{bno:'TAH-2026-020',bid:1}),
      H(153,4,'alacak','cek',360000,'TRY',1,'2026-03-05','Satış 4x Trail',{bno:'FAT-2026-023',cno:'CEK-MT-2026-004',dur:'bekliyor',vad:'2026-04-30',odn:0}),
      H(154,4,'alacak','cek',720000,'TRY',1,'2026-03-18','Satış 8x Enduro Q2',{bno:'FAT-2026-024',cno:'CEK-MT-2026-005',duz:'Moto TR',dur:'tahsil',vad:'2026-04-15',odn:720000}),
      H(155,4,'alacak','havale',270000,'TRY',1,'2026-04-05','EFT Trail Q2',{bno:'TAH-2026-021',bid:1}),
      H(156,4,'alacak','cek',450000,'TRY',1,'2026-04-20','Satış 5x Pit',{bno:'FAT-2026-025',cno:'CEK-MT-2026-006',dur:'bekliyor',vad:'2026-06-30',odn:0}),
      H(157,4,'alacak','cek',810000,'TRY',1,'2026-05-08','Satış 9x Enduro Q2',{bno:'FAT-2026-026',cno:'CEK-MT-2026-007',duz:'Moto TR',dur:'tahsil',vad:'2026-06-01',odn:810000}),
      H(158,4,'alacak','cek',495000,'TRY',1,'2026-06-03','Satış 5.5x Enduro Haziran',{bno:'FAT-2026-027',cno:'CEK-MT-2026-008',dur:'bekliyor',vad:'2026-07-15',odn:0}),
      // 2026 Adventure Moto
      H(170,5,'alacak','kart',144000,'TRY',1,'2026-01-12','Satış 2x Enduro+Pit',{bno:'FAT-2026-030',bid:1,tak:6,kom:2.4,ktry:3456,ntry:140544,ony:'111222'}),
      H(171,5,'alacak','kart',216000,'TRY',1,'2026-03-10','Satış 3x Enduro',{bno:'FAT-2026-032',bid:1,tak:9,kom:3.2,ktry:6912,ntry:209088,ony:'333444'}),
      H(172,5,'alacak','havale',180000,'TRY',1,'2026-02-25','EFT Trail',{bno:'TAH-2026-030',bid:1}),
      H(173,5,'alacak','kart',252000,'TRY',1,'2026-05-05','Satış 3.5x Enduro',{bno:'FAT-2026-034',bid:4,tak:12,kom:4.2,ktry:10584,ntry:241416,ony:'555666'}),
      H(174,5,'alacak','kart',162000,'TRY',1,'2026-06-01','Satış 2x Enduro+Pit',{bno:'FAT-2026-035',bid:1,tak:9,kom:3.2,ktry:5184,ntry:156816,ony:'666777'}),
      // 2026 İzmir Moto
      H(180,6,'alacak','nakit',108000,'TRY',1,'2026-01-08','Satış 3x Pit',{bno:'FAT-2026-040'}),
      H(181,6,'alacak','nakit',72000,'TRY',1,'2026-01-25','Satış 2x Pit 50',{bno:'FAT-2026-041'}),
      H(182,6,'alacak','kart',90000,'TRY',1,'2026-02-12','Satış 1x Enduro',{bno:'FAT-2026-042',bid:1,tak:3,kom:1.5,ktry:1350,ntry:88650,ony:'777888'}),
      H(183,6,'alacak','nakit',126000,'TRY',1,'2026-03-15','Satış Pit seti',{bno:'FAT-2026-044'}),
      H(184,6,'alacak','kart',144000,'TRY',1,'2026-04-07','Satış 2x Enduro',{bno:'FAT-2026-045',bid:3,tak:6,kom:2.2,ktry:3168,ntry:140832,ony:'888999'}),
      H(185,6,'alacak','nakit',108000,'TRY',1,'2026-05-10','Satış 3x Pit',{bno:'FAT-2026-047'}),
      H(186,6,'alacak','kart',72000,'TRY',1,'2026-05-25','Satış Enduro',{bno:'FAT-2026-048',bid:1,tak:3,kom:1.5,ktry:1080,ntry:70920,ony:'999000'}),
      H(187,6,'alacak','nakit',54000,'TRY',1,'2026-06-04','Satış Haziran',{bno:'FAT-2026-049'}),
    ]);
  }

  // Banka hareketleri
  if(!ld('bh').length) sv('bh',[
    {id:1,bid:1,yon:'giris',tip:'pos',tutar:108000,par:'TRY',kur:1,try_:108000,tar:'2025-03-25',ack:'POS Tahsilat Adventure',sil:false,cat:ts()},
    {id:2,bid:1,yon:'cikis',tip:'komisyon',tutar:2592,par:'TRY',kur:1,try_:2592,tar:'2025-03-26',ack:'POS Komisyon',sil:false,cat:ts()},
    {id:3,bid:1,yon:'giris',tip:'havale',tutar:270000,par:'TRY',kur:1,try_:270000,tar:'2025-02-15',ack:'EFT Moto TR',sil:false,cat:ts()},
    {id:4,bid:1,yon:'giris',tip:'pos',tutar:162000,par:'TRY',kur:1,try_:162000,tar:'2025-03-08',ack:'POS Tahsilat Adventure',sil:false,cat:ts()},
    {id:5,bid:1,yon:'cikis',tip:'komisyon',tutar:3564,par:'TRY',kur:1,try_:3564,tar:'2025-03-09',ack:'POS Komisyon',sil:false,cat:ts()},
    {id:6,bid:1,yon:'giris',tip:'havale',tutar:540000,par:'TRY',kur:1,try_:540000,tar:'2026-02-15',ack:'EFT Moto TR çek',sil:false,cat:ts()},
    {id:7,bid:1,yon:'giris',tip:'pos',tutar:144000,par:'TRY',kur:1,try_:144000,tar:'2026-01-12',ack:'POS Adventure',sil:false,cat:ts()},
    {id:8,bid:1,yon:'cikis',tip:'komisyon',tutar:3456,par:'TRY',kur:1,try_:3456,tar:'2026-01-13',ack:'POS Komisyon',sil:false,cat:ts()},
    {id:9,bid:2,yon:'cikis',tip:'havale',tutar:45000,par:'USD',kur:32.1,try_:1444500,tar:'2025-01-08',ack:'GZ Motor ödeme',sil:false,cat:ts()},
    {id:10,bid:2,yon:'cikis',tip:'havale',tutar:38000,par:'USD',kur:32.1,try_:1219800,tar:'2025-01-15',ack:'ZJ Frame ödeme',sil:false,cat:ts()},
    {id:11,bid:2,yon:'giris',tip:'havale',tutar:4200,par:'USD',kur:32.6,try_:136920,tar:'2025-02-28',ack:'GZ Motor iade',sil:false,cat:ts()},
    {id:12,bid:2,yon:'cikis',tip:'havale',tutar:62000,par:'USD',kur:32.9,try_:2039800,tar:'2026-01-08',ack:'GZ Motor Q1',sil:false,cat:ts()},
    {id:13,bid:2,yon:'cikis',tip:'havale',tutar:42000,par:'USD',kur:32.9,try_:1381800,tar:'2026-01-10',ack:'ZJ Frame Q1',sil:false,cat:ts()},
    {id:14,bid:3,yon:'giris',tip:'pos',tutar:216000,par:'TRY',kur:1,try_:216000,tar:'2025-05-20',ack:'POS Adventure',sil:false,cat:ts()},
    {id:15,bid:3,yon:'cikis',tip:'komisyon',tutar:4752,par:'TRY',kur:1,try_:4752,tar:'2025-05-21',ack:'POS Komisyon',sil:false,cat:ts()},
  ]);

  // Kasa başlangıç
  if(!localStorage.getItem(DB.kasa)){
    localStorage.setItem(DB.kasa, JSON.stringify({TRY:75000,USD:8000,EUR:3000,CNY:0}));
    sv('kh',[
      {id:1,tip:'giris',tutar:75000,par:'TRY',tarih:'2025-01-01',acik:'Açılış bakiyesi TRY',auto:false,sil:false,cat:ts()},
      {id:2,tip:'giris',tutar:8000,par:'USD',tarih:'2025-01-01',acik:'Açılış bakiyesi USD',auto:false,sil:false,cat:ts()},
      {id:3,tip:'giris',tutar:3000,par:'EUR',tarih:'2025-01-01',acik:'Açılış bakiyesi EUR',auto:false,sil:false,cat:ts()},
    ]);
  }
}


// Belgelerde kullanım: ünvan (fatura) veya marka (header)
function firmaUnvan(){ return getAy('unvan')||getAy('firma')||'Hurra Motor'; }
function firmaMarka(){ return getAy('marka')||getAy('firma')||'HURRA'; }

// ── LOG ────────────────────────────────────────────────────
function logEkle(islem, ref, detay){
  const l = ld('log');
  l.unshift({id:nid(l), islem, ref, detay, ts:ts(), usr:'Admin'});
  if(l.length > 500) l.length = 500;
  sv('log', l);
}

// ── BAŞLAT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  veriYukle();
  temaUygula();
});

// ══════════════════════════════════════════════════════════
// STOK VERİ KATMANI
// ══════════════════════════════════════════════════════════
const STOK_DB = {
  urun:  'hm_urun',   // ürün kartları
  depo:  'hm_depo',   // depolar
  sh:    'hm_sh',     // stok hareketleri
  tr:    'hm_tr',     // transfer belgesi
};

function ldS(k){
  try{ return JSON.parse(localStorage.getItem(STOK_DB[k]))||[]; }
  catch{ return []; }
}
function svS(k,v){ localStorage.setItem(STOK_DB[k], JSON.stringify(v)); }

// Ürün stok miktarı (depo bazında)
function urunStok(urunId, depoId=null){
  const hrtler = ldS('sh').filter(h=>h.urunId===urunId && !h.sil);
  if(depoId){
    return hrtler.reduce((t,h)=>{
      if(h.depoId===depoId) t += (h.yon==='giris'?1:-1)*h.miktar;
      if(h.tip==='transfer' && h.hedefDepoId===depoId) t += h.miktar;
      if(h.tip==='transfer' && h.depoId===depoId) t -= h.miktar;
      return t;
    },0);
  }
  // Toplam stok (transfer hariç)
  return hrtler.filter(h=>h.tip!=='transfer').reduce((t,h)=>
    t+(h.yon==='giris'?1:-1)*h.miktar, 0);
}

// Depo bazında tüm stoklar
function depoStok(depoId){
  const urunler = ldS('urun').filter(u=>u.aktif!==false);
  return urunler.map(u=>({
    ...u,
    miktar: urunStok(u.id, depoId)
  })).filter(u=>u.miktar!==0);
}

// Stok uyarı listesi (min stok altında)
function stokUyarilar(){
  const urunler = ldS('urun').filter(u=>u.aktif!==false && u.minStok>0);
  return urunler.map(u=>({
    ...u,
    toplamStok: urunStok(u.id)
  })).filter(u=>u.toplamStok<=u.minStok);
}

// Örnek stok verisi
function stokVeriYukle(){
  if(!ldS('depo').length) svS('depo',[
    {id:1,ad:'Ana Depo',kod:'DEPO-1',konum:'Antalya Fabrika',acik:'Ana üretim deposu',aktif:true},
    {id:2,ad:'Yedek Parça',kod:'DEPO-2',konum:'Antalya Fabrika',acik:'Yedek parça ve sarf',aktif:true},
    {id:3,ad:'Servis Deposu',kod:'DEPO-3',konum:'Antalya Servis',acik:'Servis merkezi deposu',aktif:true},
    {id:4,ad:'Çin Transit',kod:'DEPO-4',konum:'Guangzhou / Zhejiang',acik:'Çin\'den gelen transit mallar',aktif:true},
  ]);

  if(!ldS('urun').length) svS('urun',[
    {id:1,kod:'MTR-001',barkod:'8690001000010',ad:'250cc Motor Bloğu',marka:'GZ Motor',model:'GZM-250',kategori:'Motor',birim:'adet',alisFiyat:850,satisFiyat:1200,par:'USD',kdv:18,minStok:5,aktif:true,not:'Ana motor ünitesi'},
    {id:2,kod:'MTR-002',barkod:'8690001000027',ad:'125cc Motor Bloğu',marka:'GZ Motor',model:'GZM-125',kategori:'Motor',birim:'adet',alisFiyat:480,satisFiyat:720,par:'USD',kdv:18,minStok:8,aktif:true,not:''},
    {id:3,kod:'SAS-001',barkod:'8690001000034',ad:'Enduro Şasi',marka:'ZJ Frame',model:'ZJF-250',kategori:'Şasi',birim:'adet',alisFiyat:320,satisFiyat:480,par:'USD',kdv:18,minStok:5,aktif:true,not:''},
    {id:4,kod:'SAS-002',barkod:'8690001000041',ad:'Pit Şasi',marka:'ZJ Frame',model:'ZJF-125',kategori:'Şasi',birim:'adet',alisFiyat:180,satisFiyat:280,par:'USD',kdv:18,minStok:8,aktif:true,not:''},
    {id:5,kod:'SAS-003',barkod:'8690001000058',ad:'Subframe Seti',marka:'ZJ Frame',model:'SBF-01',kategori:'Şasi',birim:'adet',alisFiyat:95,satisFiyat:145,par:'USD',kdv:18,minStok:10,aktif:true,not:''},
    {id:6,kod:'FRN-001',barkod:'8690001000065',ad:'Fren Diski Ön',marka:'GZ Motor',model:'FRD-220',kategori:'Fren',birim:'adet',alisFiyat:45,satisFiyat:85,par:'USD',kdv:18,minStok:20,aktif:true,not:''},
    {id:7,kod:'FRN-002',barkod:'8690001000072',ad:'Fren Kaliperi',marka:'GZ Motor',model:'FRK-01',kategori:'Fren',birim:'adet',alisFiyat:65,satisFiyat:120,par:'USD',kdv:18,minStok:15,aktif:true,not:''},
    {id:8,kod:'ELK-001',barkod:'8690001000089',ad:'Karbüratör',marka:'GZ Motor',model:'KRB-250',kategori:'Elektrik',birim:'adet',alisFiyat:55,satisFiyat:95,par:'USD',kdv:18,minStok:12,aktif:true,not:''},
    {id:9,kod:'ELK-002',barkod:'8690001000096',ad:'CDI Ünite',marka:'GZ Motor',model:'CDI-01',kategori:'Elektrik',birim:'adet',alisFiyat:28,satisFiyat:55,par:'USD',kdv:18,minStok:20,aktif:true,not:''},
    {id:10,kod:'YRL-001',barkod:'8690001000102',ad:'Piston Segman Seti',marka:'GZ Motor',model:'PST-250',kategori:'Motor',birim:'takım',alisFiyat:35,satisFiyat:65,par:'USD',kdv:18,minStok:25,aktif:true,not:''},
    {id:11,kod:'YRL-002',barkod:'8690001000119',ad:'Conta Seti',marka:'Antalya Çelik',model:'CNT-01',kategori:'Sarf',birim:'takım',alisFiyat:85,satisFiyat:140,par:'TRY',kdv:18,minStok:30,aktif:true,not:''},
    {id:12,kod:'YRL-003',barkod:'8690001000126',ad:'Cıvata Somun Seti',marka:'Antalya Çelik',model:'CVT-01',kategori:'Sarf',birim:'set',alisFiyat:45,satisFiyat:80,par:'TRY',kdv:18,minStok:50,aktif:true,not:''},
    {id:13,kod:'MTR-003',barkod:'8690001000133',ad:'Trail 200cc Motor',marka:'GZ Motor',model:'GZM-200',kategori:'Motor',birim:'adet',alisFiyat:620,satisFiyat:950,par:'USD',kdv:18,minStok:3,aktif:true,not:''},
    {id:14,kod:'SAS-004',barkod:'8690001000140',ad:'Trail Şasi',marka:'ZJ Frame',model:'ZJF-200',kategori:'Şasi',birim:'adet',alisFiyat:240,satisFiyat:380,par:'USD',kdv:18,minStok:3,aktif:true,not:''},
    {id:15,kod:'AKS-001',barkod:'8690001000157',ad:'Amortisör Takımı',marka:'GZ Motor',model:'AMR-01',kategori:'Süspansiyon',birim:'takım',alisFiyat:120,satisFiyat:220,par:'USD',kdv:18,minStok:10,aktif:true,not:''},
  ]);

  if(!ldS('sh').length){
    const SH=(id,urunId,depoId,yon,tip,miktar,tar,ack,e={})=>({
      id,urunId,depoId,yon,tip,miktar,tar,ack,
      birimFiyat:e.birimFiyat||0,par:e.par||'USD',
      hedefDepoId:e.hedefDepoId||null,
      refNo:e.refNo||'',cariId:e.cariId||null,
      onay:e.onay||'onaylandi',onayTarih:e.onayTarih||tar,
      not:e.not||'',sil:false,cat:ts()
    });
    svS('sh',[
      // Ana Depo girişleri
      SH(1,1,1,'giris','satin_alma',15,'2025-01-10','GZ Motor — Motor bloğu Q1',{birimFiyat:850,par:'USD',refNo:'OD-2025-001',cariId:1}),
      SH(2,2,1,'giris','satin_alma',25,'2025-01-10','GZ Motor — 125cc motor',{birimFiyat:480,par:'USD',refNo:'OD-2025-001',cariId:1}),
      SH(3,3,1,'giris','satin_alma',20,'2025-01-15','ZJ Frame — Enduro şasi',{birimFiyat:320,par:'USD',refNo:'OD-2025-020',cariId:2}),
      SH(4,4,1,'giris','satin_alma',30,'2025-01-15','ZJ Frame — Pit şasi',{birimFiyat:180,par:'USD',refNo:'OD-2025-020',cariId:2}),
      SH(5,5,1,'giris','satin_alma',40,'2025-02-01','ZJ Frame — Subframe',{birimFiyat:95,par:'USD',refNo:'OD-2025-021',cariId:2}),
      SH(6,10,1,'giris','satin_alma',100,'2025-02-10','Piston segman toplu',{birimFiyat:35,par:'USD',refNo:'OD-2025-003',cariId:1}),
      SH(7,11,1,'giris','satin_alma',80,'2025-02-15','Conta seti',{birimFiyat:85,par:'TRY',refNo:'FAT-2025-002',cariId:3}),
      SH(8,12,1,'giris','satin_alma',150,'2025-02-15','Cıvata somun',{birimFiyat:45,par:'TRY',refNo:'FAT-2025-001',cariId:3}),
      // Transfer - Ana Depo → Yedek Parça
      SH(9,6,1,'cikis','transfer',20,'2025-03-01','Transfer → Yedek Parça',{hedefDepoId:2,refNo:'TRF-2025-001'}),
      SH(10,7,1,'cikis','transfer',15,'2025-03-01','Transfer → Yedek Parça',{hedefDepoId:2,refNo:'TRF-2025-001'}),
      SH(11,8,1,'giris','satin_alma',50,'2025-03-10','Karbüratör',{birimFiyat:55,par:'USD',refNo:'OD-2025-004',cariId:1}),
      SH(12,9,1,'giris','satin_alma',80,'2025-03-10','CDI ünite',{birimFiyat:28,par:'USD',refNo:'OD-2025-004',cariId:1}),
      // Satış çıkışları
      SH(13,1,1,'cikis','satis',6,'2025-03-20','Montaj — Moto TR 6x Enduro',{birimFiyat:1200,par:'USD',refNo:'FAT-2025-040',cariId:4}),
      SH(14,3,1,'cikis','satis',6,'2025-03-20','Montaj — Enduro şasi',{birimFiyat:480,par:'USD',refNo:'FAT-2025-040',cariId:4}),
      SH(15,2,1,'cikis','satis',4,'2025-04-01','Montaj — Pit 125',{birimFiyat:720,par:'USD',refNo:'FAT-2025-041',cariId:5}),
      SH(16,4,1,'cikis','satis',4,'2025-04-01','Montaj — Pit şasi',{birimFiyat:280,par:'USD',refNo:'FAT-2025-041',cariId:5}),
      // Q2 girişleri
      SH(17,1,1,'giris','satin_alma',20,'2025-04-05','GZ Motor Q2',{birimFiyat:860,par:'USD',refNo:'OD-2025-005',cariId:1}),
      SH(18,13,1,'giris','satin_alma',10,'2025-04-05','Trail 200cc motor',{birimFiyat:620,par:'USD',refNo:'OD-2025-005',cariId:1}),
      SH(19,14,1,'giris','satin_alma',10,'2025-05-05','Trail şasi',{birimFiyat:240,par:'USD',refNo:'OD-2025-022',cariId:2}),
      SH(20,15,1,'giris','satin_alma',25,'2025-05-15','Amortisör takımı',{birimFiyat:120,par:'USD',refNo:'OD-2025-006',cariId:1}),
      // Fire / sayım
      SH(21,10,1,'cikis','fire',3,'2025-06-01','Hasarlı piston segman fire',{refNo:'FRE-2025-001',not:'Nakliye hasarı'}),
      SH(22,11,1,'cikis','fire',2,'2025-06-01','Conta fire',{refNo:'FRE-2025-001',not:'Nem hasarı'}),
      // 2026 girişleri
      SH(23,1,1,'giris','satin_alma',18,'2026-01-08','GZ Motor Q1 2026',{birimFiyat:880,par:'USD',refNo:'OD-2026-001',cariId:1}),
      SH(24,3,1,'giris','satin_alma',15,'2026-01-10','Enduro şasi Q1',{birimFiyat:330,par:'USD',refNo:'OD-2026-010',cariId:2}),
      SH(25,2,1,'giris','satin_alma',20,'2026-01-10','125cc motor Q1',{birimFiyat:500,par:'USD',refNo:'OD-2026-002',cariId:1}),
      SH(26,4,1,'giris','satin_alma',25,'2026-01-10','Pit şasi Q1',{birimFiyat:190,par:'USD',refNo:'OD-2026-010',cariId:2}),
      SH(27,1,1,'cikis','satis',7,'2026-01-15','Montaj — Moto TR 7x Enduro',{birimFiyat:1200,par:'USD',refNo:'FAT-2026-020',cariId:4}),
      SH(28,3,1,'cikis','satis',7,'2026-01-15','Montaj — Enduro şasi',{birimFiyat:480,par:'USD',refNo:'FAT-2026-020',cariId:4}),
      SH(29,13,1,'giris','satin_alma',8,'2026-02-05','Trail motor Q1',{birimFiyat:640,par:'USD',refNo:'OD-2026-003',cariId:1}),
      SH(30,14,1,'giris','satin_alma',8,'2026-03-18','Trail şasi Q2',{birimFiyat:250,par:'USD',refNo:'OD-2026-011',cariId:2}),
      SH(31,10,2,'giris','satin_alma',60,'2026-02-10','Piston segman Yedek Parça',{birimFiyat:36,par:'USD',refNo:'OD-2026-003',cariId:1}),
      SH(32,11,2,'giris','satin_alma',50,'2026-02-25','Conta seti YP',{birimFiyat:90,par:'TRY',refNo:'FAT-2026-002',cariId:3}),
      SH(33,12,2,'giris','satin_alma',100,'2026-02-25','Cıvata YP',{birimFiyat:48,par:'TRY',refNo:'FAT-2026-001',cariId:3}),
      SH(34,1,1,'cikis','satis',8,'2026-03-18','Montaj — 8x Enduro Q2',{birimFiyat:1200,par:'USD',refNo:'FAT-2026-024',cariId:4}),
      SH(35,3,1,'cikis','satis',8,'2026-03-18','Montaj — 8x Enduro şasi',{birimFiyat:480,par:'USD',refNo:'FAT-2026-024',cariId:4}),
      SH(36,15,1,'giris','satin_alma',20,'2026-04-03','Amortisör Q2',{birimFiyat:125,par:'USD',refNo:'OD-2026-005',cariId:1}),
      SH(37,8,1,'giris','satin_alma',30,'2026-04-03','Karbüratör Q2',{birimFiyat:58,par:'USD',refNo:'OD-2026-005',cariId:1}),
      SH(38,1,1,'cikis','satis',9,'2026-05-08','Montaj — 9x Enduro',{birimFiyat:1200,par:'USD',refNo:'FAT-2026-026',cariId:4}),
      SH(39,3,1,'cikis','satis',9,'2026-05-08','Montaj — şasi',{birimFiyat:480,par:'USD',refNo:'FAT-2026-026',cariId:4}),
    ]);
  }

  if(!ldS('tr').length) svS('tr',[
    {id:1,no:'TRF-2025-001',tar:'2025-03-01',kaynakId:1,hedefId:2,
     kalemler:[{urunId:6,miktar:20},{urunId:7,miktar:15}],
     acik:'Yedek parça depo takviyesi',onay:'onaylandi',
     onayci:'Admin',onayTarih:'2025-03-01',sil:false,cat:'2025-03-01T09:00:00.000Z'},
  ]);
}
