-- ============================================================
-- HurraMotor ERP — Migration 003: Stok, BOM, Seri, Lot
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE urun_tipi   AS ENUM ('hammadde','yari_mamul','mamul','yardimci','sarf','hizmet');
CREATE TYPE depo_tipi   AS ENUM ('ana','uretim','kk','karantina','transit','servis','yedek','diger');
CREATE TYPE sh_tip      AS ENUM (
  'giris','cikis','transfer_cikis','transfer_giris',
  'uretim_rezerve','uretim_kullanim','uretim_cikti',
  'fire','iade','sayim','duzeltme'
);

-- ────────────────────────────────────────────────────────────
-- 1. KATEGORİLER (teknik sınıf)
-- ────────────────────────────────────────────────────────────
CREATE TABLE kategoriler (
  id            SERIAL PRIMARY KEY,
  sistem_kodu   TEXT NOT NULL UNIQUE,
  ad            TEXT NOT NULL,
  aciklama      TEXT,
  renk          TEXT DEFAULT '#6b7280',
  simge         TEXT DEFAULT '📦',
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. ÜRÜN AİLELERİ (ticari/pazarlama)
-- ────────────────────────────────────────────────────────────
CREATE TABLE urun_aileleri (
  id            SERIAL PRIMARY KEY,
  kod           TEXT NOT NULL UNIQUE,
  ad            TEXT NOT NULL,
  ust_aile_id   INT REFERENCES urun_aileleri(id) ON DELETE SET NULL,
  aciklama      TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. ÜRÜNLER
-- ────────────────────────────────────────────────────────────
CREATE TABLE urunler (
  id              SERIAL PRIMARY KEY,
  kod             TEXT NOT NULL UNIQUE,
  barkod          TEXT UNIQUE,
  ad              TEXT NOT NULL,
  marka           TEXT,
  model           TEXT,
  uretici_kodu    TEXT,
  urun_tipi       urun_tipi NOT NULL DEFAULT 'hammadde',
  kategori_id     INT REFERENCES kategoriler(id) ON DELETE SET NULL,
  aile_id         INT REFERENCES urun_aileleri(id) ON DELETE SET NULL,
  ust_urun_id     INT REFERENCES urunler(id) ON DELETE SET NULL,
  birim           TEXT NOT NULL DEFAULT 'adet',
  alis_fiyat      NUMERIC(15,4) DEFAULT 0,
  satis_fiyat     NUMERIC(15,4) DEFAULT 0,
  par             para_birimi NOT NULL DEFAULT 'USD',
  kdv             NUMERIC(5,2) DEFAULT 18,
  min_stok        NUMERIC(15,4) DEFAULT 0,
  max_stok        NUMERIC(15,4),
  seri_takip      BOOLEAN NOT NULL DEFAULT FALSE,
  lot_takip       BOOLEAN NOT NULL DEFAULT FALSE,
  agirlik_kg      NUMERIC(10,4),
  hacim_lt        NUMERIC(10,4),
  boyut           JSONB,                     -- {en, boy, yukseklik}
  renk            TEXT,
  varyant         JSONB,                     -- {renk, voltaj, ...}
  fiziksel        JSONB,                     -- ek özellikler
  aktif           BOOLEAN NOT NULL DEFAULT TRUE,
  arsiv           BOOLEAN NOT NULL DEFAULT FALSE,
  notlar          TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_urunler_tip     ON urunler(urun_tipi);
CREATE INDEX idx_urunler_ad_trgm ON urunler USING gin(ad gin_trgm_ops);
CREATE INDEX idx_urunler_kod     ON urunler(kod);

-- ────────────────────────────────────────────────────────────
-- 4. DEPOLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE depolar (
  id            SERIAL PRIMARY KEY,
  ad            TEXT NOT NULL,
  kod           TEXT NOT NULL UNIQUE,
  depo_tipi     depo_tipi NOT NULL DEFAULT 'ana',
  konum         TEXT,
  aciklama      TEXT,
  kabul         BOOLEAN NOT NULL DEFAULT TRUE,
  sevkiyat      BOOLEAN NOT NULL DEFAULT TRUE,
  karantina     BOOLEAN NOT NULL DEFAULT FALSE,
  aktif         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 5. STOK HAREKETLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE stok_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  urun_id       INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  depo_id       INT NOT NULL REFERENCES depolar(id) ON DELETE RESTRICT,
  tarih         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tip           sh_tip NOT NULL,
  miktar        NUMERIC(15,4) NOT NULL,      -- pozitif=giriş, negatif=çıkış
  birim         TEXT NOT NULL DEFAULT 'adet',
  birim_fiyat   NUMERIC(15,4) DEFAULT 0,
  par           para_birimi DEFAULT 'TRY',
  kur           NUMERIC(15,6) DEFAULT 1,
  toplam_try    NUMERIC(15,2) DEFAULT 0,
  belge_no      TEXT,
  referans_tip  TEXT,                        -- 'uretim','satinalma','ithalat'
  referans_id   TEXT,
  lot_id        INT,                         -- FK: lotlar (migration 003)
  aciklama      TEXT,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sh_urun    ON stok_hareketler(urun_id);
CREATE INDEX idx_sh_depo    ON stok_hareketler(depo_id);
CREATE INDEX idx_sh_tarih   ON stok_hareketler(tarih DESC);
CREATE INDEX idx_sh_tip     ON stok_hareketler(tip);
CREATE INDEX idx_sh_ref     ON stok_hareketler(referans_tip, referans_id);

-- ────────────────────────────────────────────────────────────
-- 6. TRANSFER BELGELERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE transfer_belgeleri (
  id            BIGSERIAL PRIMARY KEY,
  belge_no      TEXT NOT NULL UNIQUE,
  kaynak_depo   INT NOT NULL REFERENCES depolar(id),
  hedef_depo    INT NOT NULL REFERENCES depolar(id),
  tarih         DATE NOT NULL,
  durum         TEXT NOT NULL DEFAULT 'bekliyor', -- 'bekliyor','tamamlandi','iptal'
  aciklama      TEXT,
  satirlar      JSONB,                       -- [{urun_id, miktar, birim}]
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. SERİ NUMARALAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE seri_numaralar (
  id            BIGSERIAL PRIMARY KEY,
  seri_no       TEXT NOT NULL,
  urun_id       INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  depo_id       INT REFERENCES depolar(id) ON DELETE SET NULL,
  durum         TEXT NOT NULL DEFAULT 'stokta',  -- 'stokta','satildi','uretimde','iade','hurda'
  giris_tarihi  DATE,
  cikis_tarihi  DATE,
  garanti_bitis DATE,
  lot_id        INT,
  aciklama      TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seri_no, urun_id)
);

CREATE INDEX idx_seri_urun   ON seri_numaralar(urun_id);
CREATE INDEX idx_seri_durum  ON seri_numaralar(durum);

-- ────────────────────────────────────────────────────────────
-- 8. SERİ HAREKET GEÇMİŞİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE seri_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  seri_id       BIGINT NOT NULL REFERENCES seri_numaralar(id) ON DELETE CASCADE,
  tarih         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tip           TEXT NOT NULL,               -- 'giris','cikis','uretim','satis',...
  aciklama      TEXT,
  referans_tip  TEXT,
  referans_id   TEXT,
  depo_id       INT REFERENCES depolar(id) ON DELETE SET NULL,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL
);

CREATE INDEX idx_seri_hrt_seri  ON seri_hareketler(seri_id);
CREATE INDEX idx_seri_hrt_tarih ON seri_hareketler(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- 9. LOTLAR (Parti)
-- ────────────────────────────────────────────────────────────
CREATE TABLE lotlar (
  id            BIGSERIAL PRIMARY KEY,
  lot_no        TEXT NOT NULL UNIQUE,
  urun_id       INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  tedarikci_id  INT REFERENCES cariler(id) ON DELETE SET NULL,
  satin_alma_id BIGINT,                      -- FK: satinalma_emirleri (migration 004)
  giris_tarihi  DATE NOT NULL DEFAULT CURRENT_DATE,
  son_kul_tarihi DATE,
  uretim_tarihi DATE,
  maliyet_birim NUMERIC(15,4) DEFAULT 0,
  par           para_birimi DEFAULT 'TRY',
  ithalat_id    BIGINT,                      -- FK: ithalat_dosyalari (migration 005)
  miktar_giris  NUMERIC(15,4) NOT NULL DEFAULT 0,
  durum         TEXT NOT NULL DEFAULT 'aktif', -- 'aktif','tuketildi','iptal'
  notlar        TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lotlar_urun    ON lotlar(urun_id);
CREATE INDEX idx_lotlar_lot_no  ON lotlar(lot_no);

-- ────────────────────────────────────────────────────────────
-- 10. LOT HAREKETLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE lot_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  lot_id        BIGINT NOT NULL REFERENCES lotlar(id) ON DELETE RESTRICT,
  urun_id       INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  depo_id       INT REFERENCES depolar(id) ON DELETE SET NULL,
  tarih         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tip           TEXT NOT NULL,               -- 'giris','cikis','rezerve','serbest'
  miktar        NUMERIC(15,4) NOT NULL,
  referans_tip  TEXT,
  referans_id   TEXT,
  aciklama      TEXT,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL
);

CREATE INDEX idx_lot_hrt_lot   ON lot_hareketler(lot_id);
CREATE INDEX idx_lot_hrt_tarih ON lot_hareketler(tarih DESC);

-- FK from stok_hareketler.lot_id
ALTER TABLE stok_hareketler
  ADD CONSTRAINT fk_sh_lot FOREIGN KEY (lot_id) REFERENCES lotlar(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 11. BOM (REÇETELER)
-- ────────────────────────────────────────────────────────────
CREATE TABLE bom (
  id              SERIAL PRIMARY KEY,
  kod             TEXT NOT NULL UNIQUE,
  ad              TEXT NOT NULL,
  mamul_urun_id   INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  aktif_revizyon  TEXT NOT NULL DEFAULT '1.0',
  durum           TEXT NOT NULL DEFAULT 'aktif',  -- 'aktif','pasif','taslak'
  notlar          TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bom_mamul ON bom(mamul_urun_id);

-- ────────────────────────────────────────────────────────────
-- 12. BOM REVİZYONLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE bom_revizyonlar (
  id            SERIAL PRIMARY KEY,
  bom_id        INT NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  rev           TEXT NOT NULL,               -- '1.0','1.1','2.0'
  tarih         DATE NOT NULL DEFAULT CURRENT_DATE,
  yazan_id      UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  degisiklik    TEXT,
  UNIQUE (bom_id, rev)
);

-- ────────────────────────────────────────────────────────────
-- 13. BOM SATIRLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE bom_satirlar (
  id              SERIAL PRIMARY KEY,
  bom_id          INT NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  revizyon_id     INT REFERENCES bom_revizyonlar(id) ON DELETE CASCADE,
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  miktar          NUMERIC(15,4) NOT NULL,
  birim           TEXT NOT NULL DEFAULT 'adet',
  fire_orani      NUMERIC(5,4) DEFAULT 0,    -- 0.02 = %2 fire
  opsiyonel       BOOLEAN NOT NULL DEFAULT FALSE,
  alternatif_id   INT REFERENCES urunler(id) ON DELETE SET NULL,
  not             TEXT,
  sira            SMALLINT DEFAULT 0
);

CREATE INDEX idx_bom_sat_bom   ON bom_satirlar(bom_id);
CREATE INDEX idx_bom_sat_urun  ON bom_satirlar(urun_id);

-- Mamul → BOM bağlantısı (urunler tablosuna FK ekle)
ALTER TABLE urunler ADD COLUMN bom_id INT REFERENCES bom(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS bom_satirlar, bom_revizyonlar, bom,
--   lot_hareketler, lotlar, seri_hareketler, seri_numaralar,
--   transfer_belgeleri, stok_hareketler, depolar, urunler,
--   urun_aileleri, kategoriler CASCADE;
-- DROP TYPE IF EXISTS sh_tip, depo_tipi, urun_tipi;
