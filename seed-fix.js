/**
 * HurraMotor ERP — Seed Veri Düzeltme Scripti
 * Tarih: 10 Haziran 2026
 * Kapsam: Madde 5 öncesi veri bütünlüğü düzeltmeleri
 *
 * Kullanım: Tarayıcı konsoluna yapıştır (admin girişi yapılmışken)
 *
 * Düzeltmeler:
 * 1. Transfer çift taraflılık: 5 transfer kaydının tip transfer->transfer_giris
 * 2. Üretim Deposu negatif stok: 9 ürün için Ana Depo->UD transfer çifti eklendi
 * 3. Ana Depo mamul negatif stok: uretim girişi eklendi (3001, 3002)
 * 4. Diğer negatif stoklar: giris/iade kayıtları eklendi (1020, 1005-Karantina)
 * 5. Ziraat TRY hesabı açılış bakiyesi: 0 -> 3.000.000 TL
 */
(function seedFix() {
  const ts = () => Date.now();

  // FIX 1: Transfer cift taraflilik
  const sh = JSON.parse(localStorage.getItem('hm_sh') || '[]');
  const fixIds = [45, 47, 49, 51, 158];
  let f1 = 0;
  sh.forEach(r => { if (fixIds.includes(r.id)) { r.tip = 'transfer_giris'; f1++; } });
  console.log('Fix1: ' + f1 + ' transfer->transfer_giris');

  // FIX 2+3+4: Negatif stok giris kayitlari
  let maxId = Math.max(...sh.map(r => r.id));
  const newRecs = [];
  const add = (obj) => { maxId++; newRecs.push({ id: maxId, ...obj, sil: false, cat: ts() }); };
  const tar = '2026-01-01';

  const uretimFixes = [
    { urunId: 1001, deficit: 23 }, { urunId: 1002, deficit: 20 },
    { urunId: 1004, deficit: 18 }, { urunId: 1005, deficit: 5  },
    { urunId: 1007, deficit: 23 }, { urunId: 1009, deficit: 18 },
    { urunId: 1010, deficit: 18 }, { urunId: 1014, deficit: 18 },
    { urunId: 1017, deficit: 18 },
  ];
  uretimFixes.forEach(f => {
    const ref = 'SEED-FIX-' + f.urunId;
    add({ urunId: f.urunId, depoId: 1, hedefDepoId: 2, tip: 'transfer',       miktar: f.deficit, tar, ack: 'Seed fix - Uretim Deposu eksik transfer', refNo: ref, birimFiyat: 0, par: 'TRY', onay: true });
    add({ urunId: f.urunId, depoId: 2,                  tip: 'transfer_giris', miktar: f.deficit, tar, ack: 'Seed fix - Uretim Deposu eksik transfer', refNo: ref, birimFiyat: 0, par: 'TRY', onay: true });
  });

  add({ urunId: 3001, depoId: 1, tip: 'uretim', miktar: 15, tar, ack: 'Seed fix - Anka A8 uretim girisi',    refNo: 'SEED-FIX-3001',  birimFiyat: 0, par: 'TRY', onay: true });
  add({ urunId: 3002, depoId: 1, tip: 'uretim', miktar: 5,  tar, ack: 'Seed fix - Casper Pro uretim girisi', refNo: 'SEED-FIX-3002',  birimFiyat: 0, par: 'TRY', onay: true });
  add({ urunId: 1020, depoId: 1, tip: 'giris',  miktar: 4,  tar, ack: 'Seed fix - Epoksi boya stok girisi',  refNo: 'SEED-FIX-1020',  birimFiyat: 0, par: 'TRY', onay: true });
  add({ urunId: 1005, depoId: 4, tip: 'giris',  miktar: 1,  tar, ack: 'Seed fix - Karantina sasi girisi',    refNo: 'SEED-FIX-1005K', birimFiyat: 0, par: 'TRY', onay: true });

  localStorage.setItem('hm_sh', JSON.stringify([...sh, ...newRecs]));
  console.log('Fix2-4: ' + newRecs.length + ' kayit eklendi');

  // FIX 5: Ziraat TRY acilis bakiyesi
  const hesaplar = JSON.parse(localStorage.getItem('hm_hesap') || '[]');
  const h001 = hesaplar.find(h => h.id === 'H001');
  if (h001 && (h001.acilisBAkiyesi || 0) < 3000000) {
    h001.acilisBAkiyesi = 3000000;
    localStorage.setItem('hm_hesap', JSON.stringify(hesaplar));
    console.log('Fix5: H001 acilis bakiyesi -> 3.000.000 TRY');
  }

  console.log('=== seed-fix.js TAMAMLANDI ===');
})();
