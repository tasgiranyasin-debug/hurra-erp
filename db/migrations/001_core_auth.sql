-- ============================================================
-- HurraMotor ERP — Migration 001: Core Auth & Settings
-- ============================================================
-- UP migration — run in order
-- DOWN: see bottom of file

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy search for cariler/urun

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE kullanici_rol AS ENUM (
  'admin', 'muhasebe', 'depo_mudur', 'satin_alma',
  'uretim', 'bilgi_islem', 'readonly'
);

CREATE TYPE para_birimi AS ENUM ('TRY', 'USD', 'EUR', 'GBP', 'CNY');

-- ────────────────────────────────────────────────────────────
-- 1. SİSTEM AYARLARI (tek satır)
-- ────────────────────────────────────────────────────────────
CREATE TABLE sistem_ayarlari (
  id            SERIAL PRIMARY KEY,
  sirket_adi    TEXT    NOT NULL DEFAULT 'HurraMotor',
  sirket_kisa   TEXT    NOT NULL DEFAULT 'HM',
  ulke          TEXT    NOT NULL DEFAULT 'Türkiye',
  sehir         TEXT,
  vergi_no      TEXT,
  vergi_dairesi TEXT,
  telefon       TEXT,
  email         TEXT,
  adres         TEXT,
  logo_url      TEXT,
  varsayilan_par para_birimi NOT NULL DEFAULT 'TRY',
  kdv_orani     NUMERIC(5,2) NOT NULL DEFAULT 18,
  -- Güvenlik
  pw_hash       TEXT,
  -- Metadata
  olusturma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tek satır garanti
INSERT INTO sistem_ayarlari DEFAULT VALUES;

-- ────────────────────────────────────────────────────────────
-- 2. KULLANICILAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE kullanicilar (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT NOT NULL UNIQUE,
  ad            TEXT NOT NULL,
  email         TEXT,
  rol           kullanici_rol NOT NULL DEFAULT 'readonly',
  pw_hash       TEXT,                        -- SHA-256 / bcrypt
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  supabase_uid  UUID UNIQUE,                 -- Supabase Auth entegrasyonu
  olusturma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  son_giris     TIMESTAMPTZ
);

CREATE INDEX idx_kullanicilar_username ON kullanicilar(username);

-- Varsayılan admin
INSERT INTO kullanicilar (username, ad, rol)
VALUES ('hurramotor', 'Sistem Yöneticisi', 'admin');

-- ────────────────────────────────────────────────────────────
-- 3. KULLANICI GİRİŞ LOGLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE kullanici_loglari (
  id            BIGSERIAL PRIMARY KEY,
  kullanici_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  username      TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  basarili      BOOLEAN NOT NULL DEFAULT TRUE,
  tarih         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kullanici_loglari_tarih ON kullanici_loglari(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- 4. İŞLEM LOGLARI (Audit Trail)
-- ────────────────────────────────────────────────────────────
CREATE TABLE islem_loglari (
  id            BIGSERIAL PRIMARY KEY,
  kullanici_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  username      TEXT,
  tablo         TEXT,                        -- hangi tablo etkilendi
  islem         TEXT NOT NULL,               -- CREATE/UPDATE/DELETE/LOGIN/...
  kayit_id      TEXT,                        -- etkilenen kaydın id'si
  ozet          TEXT,
  detay         JSONB,
  tarih         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_islem_loglari_tarih    ON islem_loglari(tarih DESC);
CREATE INDEX idx_islem_loglari_tablo    ON islem_loglari(tablo);
CREATE INDEX idx_islem_loglari_kullanici ON islem_loglari(kullanici_id);

-- ────────────────────────────────────────────────────────────
-- 5. KUR GEÇMİŞİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE kur_gecmisi (
  id            BIGSERIAL PRIMARY KEY,
  tarih         DATE NOT NULL,
  par           para_birimi NOT NULL,
  kur           NUMERIC(15,6) NOT NULL,      -- 1 birim yabancı = X TRY
  kaynak        TEXT DEFAULT 'manuel',       -- 'tcmb', 'api', 'manuel'
  olusturma     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tarih, par)
);

CREATE INDEX idx_kur_gecmisi_tarih ON kur_gecmisi(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS kur_gecmisi, islem_loglari, kullanici_loglari,
--   kullanicilar, sistem_ayarlari CASCADE;
-- DROP TYPE IF EXISTS para_birimi, kullanici_rol;
-- DROP EXTENSION IF EXISTS pg_trgm, "uuid-ossp";
