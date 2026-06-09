-- ============================================================
-- HurraMotor ERP — Migration 002: Finans (Cari, Kasa, Banka)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE cari_tip    AS ENUM ('tedarikci', 'musteri', 'hem_hem', 'diger');
CREATE TYPE hareket_yon AS ENUM ('giris', 'cikis', 'devir');
CREATE TYPE cs_tip      AS ENUM ('cek', 'senet');
CREATE TYPE cs_yon      AS ENUM ('alacak', 'borc');
CREATE TYPE cs_durum    AS ENUM ('bekliyor', 'tahsil', 'odendi', 'protesto', 'iptal', 'ciro');

-- ────────────────────────────────────────────────────────────
-- 1. CARİ GRUPLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE cari_gruplar (
  id    SERIAL PRIMARY KEY,
  ad    TEXT NOT NULL UNIQUE,
  aktif BOOLEAN NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 2. CARİLER
-- ────────────────────────────────────────────────────────────
CREATE TABLE cariler (
  id            SERIAL PRIMARY KEY,
  ad            TEXT NOT NULL,
  kisa          TEXT,                        -- kısa/görüntü adı
  tip           cari_tip NOT NULL DEFAULT 'tedarikci',
  grup_id       INT REFERENCES cari_gruplar(id) ON DELETE SET NULL,
  vergi_no      TEXT,
  vergi_dairesi TEXT,
  ulke          TEXT DEFAULT 'Türkiye',
  sehir         TEXT,
  adres         TEXT,
  telefon       TEXT,
  email         TEXT,
  web           TEXT,
  iban          TEXT,
  varsayilan_par para_birimi DEFAULT 'TRY',
  kredi_limiti  NUMERIC(15,2),
  arsiv         BOOLEAN NOT NULL DEFAULT FALSE,
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  not           TEXT,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cariler_tip       ON cariler(tip);
CREATE INDEX idx_cariler_ad_trgm   ON cariler USING gin(ad gin_trgm_ops);
CREATE INDEX idx_cariler_kisa_trgm ON cariler USING gin(kisa gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- 3. CARİ HAREKETLER (açık hesap)
-- ────────────────────────────────────────────────────────────
CREATE TABLE cari_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  cari_id       INT NOT NULL REFERENCES cariler(id) ON DELETE RESTRICT,
  tarih         DATE NOT NULL,
  tip           TEXT NOT NULL,               -- 'fatura','odeme','iade','devir',...
  yon           hareket_yon NOT NULL,
  tutar         NUMERIC(15,2) NOT NULL,
  par           para_birimi NOT NULL DEFAULT 'TRY',
  kur           NUMERIC(15,6) DEFAULT 1,
  tutar_try     NUMERIC(15,2) GENERATED ALWAYS AS (tutar * kur) STORED,
  aciklama      TEXT,
  belge_no      TEXT,
  referans_tip  TEXT,                        -- 'satinalma','fatura','uretim',...
  referans_id   TEXT,
  sil           BOOLEAN NOT NULL DEFAULT FALSE,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cari_hrt_cari   ON cari_hareketler(cari_id);
CREATE INDEX idx_cari_hrt_tarih  ON cari_hareketler(tarih DESC);
CREATE INDEX idx_cari_hrt_tip    ON cari_hareketler(tip);

-- ────────────────────────────────────────────────────────────
-- 4. KASALAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE kasalar (
  id    SERIAL PRIMARY KEY,
  ad    TEXT NOT NULL UNIQUE,
  kod   TEXT NOT NULL UNIQUE,
  par   para_birimi NOT NULL DEFAULT 'TRY',
  aktif BOOLEAN NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 5. KASA HAREKETLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE kasa_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  kasa_id       INT NOT NULL REFERENCES kasalar(id) ON DELETE RESTRICT,
  tarih         DATE NOT NULL,
  yon           hareket_yon NOT NULL,
  tutar         NUMERIC(15,2) NOT NULL,
  par           para_birimi NOT NULL DEFAULT 'TRY',
  kur           NUMERIC(15,6) DEFAULT 1,
  tutar_try     NUMERIC(15,2) GENERATED ALWAYS AS (tutar * kur) STORED,
  tip           TEXT,                        -- 'nakit','virman','tahsilat','odeme'
  aciklama      TEXT,
  cari_id       INT REFERENCES cariler(id) ON DELETE SET NULL,
  belge_no      TEXT,
  sil           BOOLEAN NOT NULL DEFAULT FALSE,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kasa_hrt_kasa  ON kasa_hareketler(kasa_id);
CREATE INDEX idx_kasa_hrt_tarih ON kasa_hareketler(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- 6. BANKALAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE bankalar (
  id            SERIAL PRIMARY KEY,
  ad            TEXT NOT NULL,
  banka_adi     TEXT,
  sube          TEXT,
  hesap_no      TEXT,
  iban          TEXT,
  par           para_birimi NOT NULL DEFAULT 'TRY',
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. BANKA HAREKETLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE banka_hareketler (
  id            BIGSERIAL PRIMARY KEY,
  banka_id      INT NOT NULL REFERENCES bankalar(id) ON DELETE RESTRICT,
  tarih         DATE NOT NULL,
  yon           hareket_yon NOT NULL,
  tutar         NUMERIC(15,2) NOT NULL,
  par           para_birimi NOT NULL DEFAULT 'TRY',
  kur           NUMERIC(15,6) DEFAULT 1,
  tutar_try     NUMERIC(15,2) GENERATED ALWAYS AS (tutar * kur) STORED,
  aciklama      TEXT,
  cari_id       INT REFERENCES cariler(id) ON DELETE SET NULL,
  dekont_no     TEXT,
  sil           BOOLEAN NOT NULL DEFAULT FALSE,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banka_hrt_banka ON banka_hareketler(banka_id);
CREATE INDEX idx_banka_hrt_tarih ON banka_hareketler(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- 8. ÇEK / SENET
-- ────────────────────────────────────────────────────────────
CREATE TABLE cek_senet (
  id            BIGSERIAL PRIMARY KEY,
  seri          TEXT,
  no            TEXT NOT NULL,
  tip           cs_tip NOT NULL,
  yon           cs_yon NOT NULL,
  durum         cs_durum NOT NULL DEFAULT 'bekliyor',
  cari_id       INT REFERENCES cariler(id) ON DELETE SET NULL,
  kese_id       INT,                         -- portföy/kese (ileride)
  tutar         NUMERIC(15,2) NOT NULL,
  par           para_birimi NOT NULL DEFAULT 'TRY',
  vade          DATE NOT NULL,
  duzenleme     DATE,
  aciklama      TEXT,
  banka         TEXT,
  sube          TEXT,
  hesap         TEXT,
  ciro_cari_id  INT REFERENCES cariler(id) ON DELETE SET NULL,
  sil           BOOLEAN NOT NULL DEFAULT FALSE,
  olusturan_id  UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_vade   ON cek_senet(vade);
CREATE INDEX idx_cs_durum  ON cek_senet(durum);
CREATE INDEX idx_cs_cari   ON cek_senet(cari_id);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS cek_senet, banka_hareketler, bankalar,
--   kasa_hareketler, kasalar, cari_hareketler, cariler,
--   cari_gruplar CASCADE;
-- DROP TYPE IF EXISTS cs_durum, cs_yon, cs_tip, hareket_yon, cari_tip;
