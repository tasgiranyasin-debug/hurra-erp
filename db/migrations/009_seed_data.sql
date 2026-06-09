-- ============================================================
-- HurraMotor ERP — Migration 009: Seed Data
-- Tüm modüller için temel başlangıç verileri
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. SİSTEM AYARLARI (doğru kolon adları: 001_core_auth.sql ile eşleşir)
-- ────────────────────────────────────────────────────────────
UPDATE sistem_ayarlari SET
  sirket_adi    = 'HurraMotor Motosiklet San. ve Tic. A.Ş.',
  sirket_kisa   = 'HurraMotor',
  vergi_no      = '1234567890',
  vergi_dairesi = 'Atatürk V.D.',
  ulke          = 'Türkiye',
  sehir         = 'İstanbul',
  telefon       = '+90 212 000 00 00',
  email         = 'info@hurramotor.com',
  varsayilan_par= 'TRY',
  kdv_orani     = 20
WHERE id = 1;

-- ────────────────────────────────────────────────────────────
-- 2. KULLANICI — 001'de zaten eklendi, email'i güncelle
-- ────────────────────────────────────────────────────────────
UPDATE kullanicilar SET
  email = 'admin@hurramotor.com'
WHERE username = 'hurramotor';

-- ────────────────────────────────────────────────────────────
-- 3. KUR GEÇMİŞİ (tarih zorunlu)
-- ────────────────────────────────────────────────────────────
INSERT INTO kur_gecmisi (tarih, par, kur, kaynak) VALUES
  (CURRENT_DATE, 'USD', 32.50, 'manuel'),
  (CURRENT_DATE, 'EUR', 35.20, 'manuel'),
  (CURRENT_DATE, 'GBP', 41.10, 'manuel'),
  (CURRENT_DATE, 'CNY',  4.48, 'manuel')
ON CONFLICT (tarih, par) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. CARİ GRUPLAR
-- ────────────────────────────────────────────────────────────
INSERT INTO cari_gruplar (ad) VALUES
  ('Yerli Tedarikçi'),
  ('Yabancı Tedarikçi'),
  ('Ana Bayi'),
  ('Kurumsal Müşteri'),
  ('Bireysel Müşteri');

-- ────────────────────────────────────────────────────────────
-- 5. CARİLER (core.js cariVeriYukle() ile eşleşir)
-- ────────────────────────────────────────────────────────────
INSERT INTO cariler (id, ad, kisa, tip, grup_id, vergi_no, ulke, sehir, email, varsayilan_par) VALUES
  (1, 'Motopart Yedek Parça A.Ş.',      'Motopart',   'tedarikci',
      (SELECT id FROM cari_gruplar WHERE ad='Yerli Tedarikçi'),
      '1234567890', 'Türkiye', 'İstanbul', 'info@motopart.com.tr', 'TRY'),
  (2, 'Euro Chassis GmbH',              'EuroChassis', 'tedarikci',
      (SELECT id FROM cari_gruplar WHERE ad='Yabancı Tedarikçi'),
      'DE12345678', 'Almanya', 'München', 'orders@eurochassis.de', 'EUR'),
  (3, 'Bremsa Fren Sistemleri Ltd.',    'Bremsa',     'tedarikci',
      (SELECT id FROM cari_gruplar WHERE ad='Yabancı Tedarikçi'),
      'IT98765432', 'İtalya', 'Milano', 'sales@bremsa.it', 'EUR'),
  (4, 'KoreaBatt Co. Ltd.',             'KoreaBatt',  'tedarikci',
      (SELECT id FROM cari_gruplar WHERE ad='Yabancı Tedarikçi'),
      'KR11223344', 'Güney Kore', 'Seoul', 'info@koreabatt.kr', 'USD'),
  (5, 'HurraMotor Bayi İstanbul',       'HM-İst',     'musteri',
      (SELECT id FROM cari_gruplar WHERE ad='Ana Bayi'),
      '9876543210', 'Türkiye', 'İstanbul', 'bayi@hurra-ist.com', 'TRY');

-- Sequence senkronize et
SELECT setval('cariler_id_seq', (SELECT MAX(id) FROM cariler));

-- ────────────────────────────────────────────────────────────
-- 6. KASALAR & BANKALAR
-- ────────────────────────────────────────────────────────────
INSERT INTO kasalar (ad, kod, par) VALUES
  ('Ana Kasa TRY',  'KASA-TRY', 'TRY'),
  ('Döviz Kasası USD', 'KASA-USD', 'USD'),
  ('Döviz Kasası EUR', 'KASA-EUR', 'EUR');

INSERT INTO bankalar (ad, banka_adi, sube, par) VALUES
  ('İş Bankası Merkez', 'Türkiye İş Bankası', 'Merkez', 'TRY'),
  ('Garanti USD Hesabı', 'Garanti BBVA', 'Şişli', 'USD');

-- ────────────────────────────────────────────────────────────
-- 7. KATEGORİLER (urunler.kategori_id)
-- ────────────────────────────────────────────────────────────
INSERT INTO kategoriler (sistem_kodu, ad, renk, simge) VALUES
  ('motor',      'Motor & Şanzıman',         '#ef4444', '⚙️'),
  ('elektrik',   'Elektrik & Elektronik',    '#f59e0b', '⚡'),
  ('govde',      'Gövde & Kaporta',          '#10b981', '🏍️'),
  ('fren',       'Fren Sistemi',             '#6366f1', '🔴'),
  ('susp',       'Süspansiyon & Direksiyon', '#8b5cf6', '🔩'),
  ('aks',        'Aktarma Organları',        '#06b6d4', '⚡'),
  ('aks_dis',    'Dış Aksesuarlar',          '#84cc16', '✨'),
  ('hammadde',   'Hammadde',                 '#6b7280', '🔧'),
  ('sarf',       'Sarf Malzeme',             '#f97316', '🪣');

-- ────────────────────────────────────────────────────────────
-- 8. ÜRÜN AİLELERİ
-- ────────────────────────────────────────────────────────────
INSERT INTO urun_aileleri (kod, ad) VALUES
  ('HM-250', 'HM-250 Enduro Serisi'),
  ('HM-125', 'HM-125 Naked Serisi'),
  ('AKSESUARLAR', 'Aksesuarlar & Yedek Parçalar');

-- ────────────────────────────────────────────────────────────
-- 9. ÜRÜNLER (core.js urunVeriYukle() ile eşleşir — 6 ürün)
-- ────────────────────────────────────────────────────────────
INSERT INTO urunler (
  id, kod, ad, urun_tipi, kategori_id, aile_id,
  birim, alis_fiyat, satis_fiyat, par, kdv, min_stok, lot_takip
) VALUES
  (1, 'HM-FRAME-250',  'HM-250 Şase Çerçevesi',     'yari_mamul',
      (SELECT id FROM kategoriler WHERE sistem_kodu='govde'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'adet', 850, 1200, 'USD', 18, 10, TRUE),
  (2, 'HM-ENG-250CC',  '250cc Motor Bloğu',          'hammadde',
      (SELECT id FROM kategoriler WHERE sistem_kodu='motor'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'adet', 1200, 0, 'USD', 18, 5, TRUE),
  (3, 'HM-BRAKE-F',    'Ön Fren Seti (Disk+Kaliper)','hammadde',
      (SELECT id FROM kategoriler WHERE sistem_kodu='fren'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'takım', 280, 0, 'EUR', 18, 20, FALSE),
  (4, 'HM-BATT-12V',   '12V Akü (12Ah)',             'hammadde',
      (SELECT id FROM kategoriler WHERE sistem_kodu='elektrik'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'adet', 45, 0, 'USD', 18, 15, FALSE),
  (5, 'HM-250-ENDURO', 'HM-250 Enduro Motosiklet',   'mamul',
      (SELECT id FROM kategoriler WHERE sistem_kodu='govde'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'adet', 0, 125000, 'TRY', 18, 2, TRUE),
  (6, 'HM-SUSP-FORK',  'Ön Amortisör Takımı',        'hammadde',
      (SELECT id FROM kategoriler WHERE sistem_kodu='susp'),
      (SELECT id FROM urun_aileleri WHERE kod='HM-250'),
      'takım', 310, 0, 'EUR', 18, 8, FALSE);

SELECT setval('urunler_id_seq', (SELECT MAX(id) FROM urunler));

-- ────────────────────────────────────────────────────────────
-- 10. DEPOLAR (7 depo — core.js depoVeriYukle() eşleşir)
-- ────────────────────────────────────────────────────────────
INSERT INTO depolar (id, ad, kod, depo_tipi, konum) VALUES
  (1, 'Ana Depo',           'D-ANA',     'ana',      'İstanbul, Fabrika'),
  (2, 'Üretim Hattı',       'D-URETIM',  'uretim',   'İstanbul, Fabrika'),
  (3, 'Kalite Kontrol',     'D-KK',      'kk',       'İstanbul, Fabrika'),
  (4, 'Karantina Deposu',   'D-KAR',     'karantina','İstanbul, Fabrika'),
  (5, 'Transit / Gümrük',   'D-TRANSIT', 'transit',  'Mersin Liman'),
  (6, 'Servis Deposu',      'D-SERVIS',  'servis',   'İstanbul, Servis'),
  (7, 'Yedek Parça Deposu', 'D-YEDEK',   'yedek',    'İstanbul, Fabrika');

SELECT setval('depolar_id_seq', (SELECT MAX(id) FROM depolar));

-- ────────────────────────────────────────────────────────────
-- 11. BOM (core.js bomVeriYukle() eşleşir)
-- ────────────────────────────────────────────────────────────
INSERT INTO bom (id, kod, ad, mamul_urun_id, aktif_revizyon) VALUES
  (1, 'BOM-2026-0001', 'HM-250 Enduro — Ana Reçete', 5, '1.0');

SELECT setval('bom_id_seq', 1);

INSERT INTO bom_revizyonlar (bom_id, rev, tarih, degisiklik) VALUES
  (1, '1.0', CURRENT_DATE, 'İlk yayın');

-- BOM satirlar (5 bileşen)
INSERT INTO bom_satirlar (bom_id, revizyon_id, urun_id, miktar, birim, fire_orani, sira) VALUES
  (1, (SELECT id FROM bom_revizyonlar WHERE bom_id=1 AND rev='1.0'), 1, 1,    'adet',  0.00, 1),  -- Şase
  (1, (SELECT id FROM bom_revizyonlar WHERE bom_id=1 AND rev='1.0'), 2, 1,    'adet',  0.01, 2),  -- Motor
  (1, (SELECT id FROM bom_revizyonlar WHERE bom_id=1 AND rev='1.0'), 3, 1,    'takım', 0.00, 3),  -- Fren
  (1, (SELECT id FROM bom_revizyonlar WHERE bom_id=1 AND rev='1.0'), 4, 1,    'adet',  0.02, 4),  -- Akü
  (1, (SELECT id FROM bom_revizyonlar WHERE bom_id=1 AND rev='1.0'), 6, 1,    'takım', 0.00, 5);  -- Süsp.

-- Mamülü BOM'a bağla
UPDATE urunler SET bom_id = 1 WHERE id = 5;

-- ────────────────────────────────────────────────────────────
-- 12. MASRAF TÜRLERİ (005 migration zaten ekliyor, ek yok)
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 13. MALİYET MERKEZLERİ
-- ────────────────────────────────────────────────────────────
INSERT INTO maliyet_merkezleri (kod, ad, tur) VALUES
  ('MC-URETIM', 'Üretim', 'uretim'),
  ('MC-KALITE', 'Kalite Kontrol', 'destek'),
  ('MC-LOJISTIK', 'Lojistik & Depo', 'destek'),
  ('MC-GENEL', 'Genel Yönetim', 'genel');

-- ────────────────────────────────────────────────────────────
-- 14. GİDER TÜRLERİ
-- ────────────────────────────────────────────────────────────
INSERT INTO gider_turleri (kod, ad, hesap) VALUES
  ('PERSONEL',  'Personel Giderleri', '740'),
  ('ELEKTRIK',  'Elektrik & Enerji',  '741'),
  ('NAKLIYE',   'Nakliye & Kargo',    '742'),
  ('KIRA',      'Kira',               '730'),
  ('AMORTISMAN','Amortisman',         '730'),
  ('DIGER',     'Diğer Giderler',     '750');

-- ────────────────────────────────────────────────────────────
-- 15. DEPARTMANLAR & POZİSYONLAR
-- ────────────────────────────────────────────────────────────
INSERT INTO departmanlar (ad, kod) VALUES
  ('Üretim',         'URETIM'),
  ('Satın Alma',     'SATINALMA'),
  ('Kalite Kontrol', 'KK'),
  ('Depo & Lojistik','DEPO'),
  ('Finans',         'FINANS'),
  ('Yönetim',        'YONETIM');

INSERT INTO pozisyonlar (departman_id, ad, seviye) VALUES
  ((SELECT id FROM departmanlar WHERE kod='URETIM'),    'Üretim Operatörü', 'uzman'),
  ((SELECT id FROM departmanlar WHERE kod='URETIM'),    'Üretim Şefi',      'mudur'),
  ((SELECT id FROM departmanlar WHERE kod='SATINALMA'), 'Satın Alma Uzmanı','uzman'),
  ((SELECT id FROM departmanlar WHERE kod='KK'),        'KK Teknikeri',     'uzman'),
  ((SELECT id FROM departmanlar WHERE kod='FINANS'),    'Muhasebe Uzmanı',  'uzman'),
  ((SELECT id FROM departmanlar WHERE kod='YONETIM'),   'Genel Müdür',      'direktor');

-- ────────────────────────────────────────────────────────────
-- 16. ONAY ŞABLONLARI
-- ────────────────────────────────────────────────────────────
INSERT INTO onay_sablonlari (ad, modul, esik_tutar, adimlar) VALUES
  ('Satın Alma Onayı (>50K TRY)', 'satinalma', 50000,
   '[{"sira":1,"rol":"mudur","tur":"zorunlu"},{"sira":2,"rol":"admin","tur":"zorunlu"}]'),
  ('İthalat Onayı', 'ithalat', NULL,
   '[{"sira":1,"rol":"admin","tur":"zorunlu"}]'),
  ('Üretim Emri Onayı', 'uretim', NULL,
   '[{"sira":1,"rol":"mudur","tur":"zorunlu"}]');

-- ────────────────────────────────────────────────────────────
-- 17. DOKÜMAN KATEGORİLERİ — zaten migration 007'de seed edildi
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 18. ROW LEVEL SECURITY (temel politikalar)
-- ────────────────────────────────────────────────────────────
-- Tüm tablolarda RLS etkinleştir
ALTER TABLE kullanicilar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cariler           ENABLE ROW LEVEL SECURITY;
ALTER TABLE urunler           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_hareketler   ENABLE ROW LEVEL SECURITY;
ALTER TABLE satinalma_emirleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE uretim_emirleri   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ithalat_dosyalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE bildirimler       ENABLE ROW LEVEL SECURITY;

-- Admin her şeyi görür
CREATE POLICY admin_full ON kullanicilar     FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM kullanicilar k WHERE k.supabase_uid = auth.uid() AND k.rol='admin')
);

-- Kullanıcılar sadece kendi bildirimlerini görür
CREATE POLICY bildirim_sahip ON bildirimler FOR ALL TO authenticated
  USING (kullanici_id IN (
    SELECT id FROM kullanicilar WHERE supabase_uid = auth.uid()
  ));

-- Genel okuma (tüm authenticated kullanıcılar)
CREATE POLICY okuma_urun ON urunler FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY okuma_cari ON cariler FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY okuma_stok ON stok_hareketler FOR SELECT TO authenticated USING (TRUE);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- Bu seed migration'ı geri almak için ilgili tabloları TRUNCATE edin.
-- DELETE FROM bom_satirlar; DELETE FROM bom_revizyonlar; DELETE FROM bom;
-- DELETE FROM urunler; DELETE FROM depolar; DELETE FROM cariler; ...
