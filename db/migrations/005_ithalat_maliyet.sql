-- ============================================================
-- HurraMotor ERP — Migration 005: İthalat & Maliyet
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE ithalat_durum AS ENUM (
  'taslak','siparis','yuklendi','yolda',
  'gumruk','mal_kabul','tamamlandi','iptal'
);

-- ────────────────────────────────────────────────────────────
-- 1. MASRAF TÜRLERİ (dinamik)
-- ────────────────────────────────────────────────────────────
CREATE TABLE masraf_turleri (
  id      SERIAL PRIMARY KEY,
  ad      TEXT NOT NULL UNIQUE,
  kod     TEXT UNIQUE,
  aktif   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO masraf_turleri (ad, kod) VALUES
  ('Navlun', 'NAVLUN'),
  ('Sigorta', 'SIGORTA'),
  ('Gümrük Vergisi', 'GUMRUK'),
  ('KDV', 'KDV'),
  ('Antrepo', 'ANTREPO'),
  ('Nakliye', 'NAKLIYE'),
  ('Ekspertiz', 'EKSPERTIZ'),
  ('Banka Masrafı', 'BANKA');

-- ────────────────────────────────────────────────────────────
-- 2. İTHALAT DOSYALARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE ithalat_dosyalari (
  id              BIGSERIAL PRIMARY KEY,
  dosya_no        TEXT NOT NULL UNIQUE,      -- 'ITH-2026-0001'
  tedarikci_id    INT REFERENCES cariler(id) ON DELETE SET NULL,
  durum           ithalat_durum NOT NULL DEFAULT 'taslak',
  -- Tarihler
  siparis_tarihi  DATE,
  yukleme_tarihi  DATE,
  tahmini_varis   DATE,
  gercek_varis    DATE,
  gumruk_tarihi   DATE,
  -- Para
  mensei_ulke     TEXT,
  yukl_liman      TEXT,
  var_liman       TEXT DEFAULT 'Mersin',
  incoterm        TEXT DEFAULT 'FOB',
  fob_usd         NUMERIC(15,2) DEFAULT 0,
  par             para_birimi NOT NULL DEFAULT 'USD',
  kur             NUMERIC(15,6) DEFAULT 1,
  -- Masraf
  toplam_masraf   NUMERIC(15,2) DEFAULT 0,
  toplam_maliyet  NUMERIC(15,2) DEFAULT 0,
  -- Referanslar
  proforma_no     TEXT,
  lc_no           TEXT,
  gumruk_beyan_no TEXT,
  aciklama_not  TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ith_durum ON ithalat_dosyalari(durum);
CREATE INDEX idx_ith_tarih ON ithalat_dosyalari(siparis_tarihi DESC);

-- FK from lotlar.ithalat_id
ALTER TABLE lotlar
  ADD CONSTRAINT fk_lot_ithalat FOREIGN KEY (ithalat_id)
  REFERENCES ithalat_dosyalari(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. KONTEYNERLER
-- ────────────────────────────────────────────────────────────
CREATE TABLE konteynerler (
  id              BIGSERIAL PRIMARY KEY,
  ithalat_id      BIGINT NOT NULL REFERENCES ithalat_dosyalari(id) ON DELETE CASCADE,
  konteyner_no    TEXT NOT NULL,
  tip             TEXT DEFAULT '20DC',       -- '20DC','40DC','40HC',...
  seal_no         TEXT,
  agirlik_kg      NUMERIC(10,2),
  cbm             NUMERIC(10,4),             -- hacim m³
  aciklama_not  TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kont_ithalat ON konteynerler(ithalat_id);

-- ────────────────────────────────────────────────────────────
-- 4. İTHALAT KALEMLERİ (yükleme listesi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE yukleme_listeleri (
  id              BIGSERIAL PRIMARY KEY,
  ithalat_id      BIGINT NOT NULL REFERENCES ithalat_dosyalari(id) ON DELETE CASCADE,
  konteyner_id    BIGINT REFERENCES konteynerler(id) ON DELETE SET NULL,
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  lot_id          BIGINT REFERENCES lotlar(id) ON DELETE SET NULL,
  siparis_miktari NUMERIC(15,4) NOT NULL DEFAULT 0,
  gelen_miktari   NUMERIC(15,4) DEFAULT 0,
  birim           TEXT DEFAULT 'adet',
  birim_fiyat_fob NUMERIC(15,4) DEFAULT 0,
  par             para_birimi DEFAULT 'USD',
  toplam_fob      NUMERIC(15,2) DEFAULT 0,
  pay_maliyet_try NUMERIC(15,2) DEFAULT 0,   -- masraf dağıtımından pay
  nihai_maliyet   NUMERIC(15,2) DEFAULT 0,
  aciklama_not  TEXT
);

CREATE INDEX idx_ykl_ithalat ON yukleme_listeleri(ithalat_id);
CREATE INDEX idx_ykl_urun    ON yukleme_listeleri(urun_id);

-- ────────────────────────────────────────────────────────────
-- 5. MASRAF KALEMLERİ (ithalata bağlı)
-- ────────────────────────────────────────────────────────────
CREATE TABLE masraf_kalemleri (
  id              BIGSERIAL PRIMARY KEY,
  ithalat_id      BIGINT NOT NULL REFERENCES ithalat_dosyalari(id) ON DELETE CASCADE,
  masraf_tur_id   INT REFERENCES masraf_turleri(id) ON DELETE SET NULL,
  ad              TEXT NOT NULL,
  tutar           NUMERIC(15,2) NOT NULL,
  par             para_birimi NOT NULL DEFAULT 'TRY',
  kur             NUMERIC(15,6) DEFAULT 1,
  tutar_try       NUMERIC(15,2) GENERATED ALWAYS AS (tutar * kur) STORED,
  dagitim_tipi    TEXT DEFAULT 'agirlik',    -- 'agirlik','deger','miktar','esit'
  aciklama_not  TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_masraf_ithalat ON masraf_kalemleri(ithalat_id);

-- ────────────────────────────────────────────────────────────
-- 6. MALİYET MERKEZLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE maliyet_merkezleri (
  id      SERIAL PRIMARY KEY,
  kod     TEXT NOT NULL UNIQUE,
  ad      TEXT NOT NULL,
  tur     TEXT DEFAULT 'uretim',             -- 'uretim','destek','genel'
  aktif   BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. GİDER TÜRLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE gider_turleri (
  id      SERIAL PRIMARY KEY,
  kod     TEXT NOT NULL UNIQUE,
  ad      TEXT NOT NULL,
  hesap   TEXT,                              -- muhasebe hesap kodu
  aktif   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 8. GENEL GİDERLER
-- ────────────────────────────────────────────────────────────
CREATE TABLE genel_giderler (
  id              BIGSERIAL PRIMARY KEY,
  donem           TEXT NOT NULL,             -- 'YYYY-MM'
  gider_tur_id    INT REFERENCES gider_turleri(id) ON DELETE SET NULL,
  merkez_id       INT REFERENCES maliyet_merkezleri(id) ON DELETE SET NULL,
  tutar           NUMERIC(15,2) NOT NULL,
  par             para_birimi NOT NULL DEFAULT 'TRY',
  aciklama        TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_genel_gider_donem ON genel_giderler(donem);

-- ────────────────────────────────────────────────────────────
-- 9. ÜRÜN MALİYET KAYITLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE urun_maliyetler (
  id              BIGSERIAL PRIMARY KEY,
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  uretim_id       BIGINT REFERENCES uretim_emirleri(id) ON DELETE SET NULL,
  donem           TEXT,                      -- 'YYYY-MM'
  malzeme         NUMERIC(15,2) DEFAULT 0,
  iscilik         NUMERIC(15,2) DEFAULT 0,
  genel_gider_pay NUMERIC(15,2) DEFAULT 0,
  ithalat_pay     NUMERIC(15,2) DEFAULT 0,
  fire            NUMERIC(15,2) DEFAULT 0,
  kk_maliyet      NUMERIC(15,2) DEFAULT 0,
  paketleme       NUMERIC(15,2) DEFAULT 0,
  toplam          NUMERIC(15,2) GENERATED ALWAYS AS
    (malzeme + iscilik + genel_gider_pay + ithalat_pay +
     fire + kk_maliyet + paketleme) STORED,
  aciklama_not  TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_urun_mal_urun ON urun_maliyetler(urun_id);
CREATE INDEX idx_urun_mal_donem ON urun_maliyetler(donem);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS urun_maliyetler, genel_giderler, gider_turleri,
--   maliyet_merkezleri, masraf_kalemleri, yukleme_listeleri,
--   konteynerler, ithalat_dosyalari, masraf_turleri CASCADE;
-- DROP TYPE IF EXISTS ithalat_durum;
