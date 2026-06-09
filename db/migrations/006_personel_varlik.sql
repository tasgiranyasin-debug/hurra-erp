-- ============================================================
-- HurraMotor ERP — Migration 006: Personel & Varlık
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. DEPARTMANLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE departmanlar (
  id            SERIAL PRIMARY KEY,
  ad            TEXT NOT NULL UNIQUE,
  kod           TEXT UNIQUE,
  yonetici_id   INT,                         -- FK: personel (sonradan)
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. POZİSYONLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE pozisyonlar (
  id              SERIAL PRIMARY KEY,
  departman_id    INT REFERENCES departmanlar(id) ON DELETE SET NULL,
  ad              TEXT NOT NULL,
  seviye          TEXT,                      -- 'uzman','mudur','direktor'
  min_maas        NUMERIC(12,2),
  max_maas        NUMERIC(12,2),
  aktif           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 3. PERSONEL
-- ────────────────────────────────────────────────────────────
CREATE TABLE personel (
  id              SERIAL PRIMARY KEY,
  sicil_no        TEXT UNIQUE,
  ad              TEXT NOT NULL,
  soyad           TEXT NOT NULL,
  tc_kimlik       TEXT UNIQUE,
  departman_id    INT REFERENCES departmanlar(id) ON DELETE SET NULL,
  pozisyon_id     INT REFERENCES pozisyonlar(id) ON DELETE SET NULL,
  kullanici_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  ise_giris       DATE,
  ise_cikis       DATE,
  dogum_tarihi    DATE,
  cinsiyet        TEXT,                      -- 'erkek','kadin','belirtilmemis'
  egitim          TEXT,
  -- İletişim
  telefon         TEXT,
  email           TEXT,
  adres           TEXT,
  -- Maaş
  brut_maas       NUMERIC(12,2) DEFAULT 0,
  net_maas        NUMERIC(12,2) DEFAULT 0,
  sgk_orani       NUMERIC(5,4) DEFAULT 0.14,
  isveren_sgk     NUMERIC(5,4) DEFAULT 0.155,
  isveren_toplam  NUMERIC(12,2)
                    GENERATED ALWAYS AS (brut_maas * (1 + isveren_sgk)) STORED,
  -- İzin
  yillik_izin_hak SMALLINT DEFAULT 14,
  kullanilan_izin SMALLINT DEFAULT 0,
  -- Dosya
  profil_foto     TEXT,
  aktif           BOOLEAN NOT NULL DEFAULT TRUE,
  notlar          TEXT,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personel_dept ON personel(departman_id);
CREATE INDEX idx_personel_aktif ON personel(aktif);

-- Departman yönetici FK (döngüsel, deferred)
ALTER TABLE departmanlar
  ADD CONSTRAINT fk_dept_yonetici FOREIGN KEY (yonetici_id)
  REFERENCES personel(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ────────────────────────────────────────────────────────────
-- 4. VARLIK KATEGORİLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE varlik_kategorileri (
  id    SERIAL PRIMARY KEY,
  ad    TEXT NOT NULL UNIQUE,
  aktif BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO varlik_kategorileri (ad) VALUES
  ('Makine & Ekipman'), ('Araç'), ('Bilgisayar & IT'),
  ('Bina & Gayrimenkul'), ('Mobilya & Demirbaş'), ('Diğer');

-- ────────────────────────────────────────────────────────────
-- 5. VARLIKLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE varliklar (
  id                BIGSERIAL PRIMARY KEY,
  varlik_no         TEXT NOT NULL UNIQUE,
  ad                TEXT NOT NULL,
  kategori_id       INT REFERENCES varlik_kategorileri(id) ON DELETE SET NULL,
  marka             TEXT,
  model             TEXT,
  seri_no           TEXT,
  satin_alma_tarihi DATE,
  satin_alma_bedel  NUMERIC(15,2) DEFAULT 0,
  par               para_birimi DEFAULT 'TRY',
  guncel_deger      NUMERIC(15,2) DEFAULT 0,
  ekonomik_omur     SMALLINT,                -- yıl
  amortisman_tipi   TEXT DEFAULT 'dogrusal', -- 'dogrusal','azalan_bakiye'
  konum             TEXT,
  sorumlu_id        INT REFERENCES personel(id) ON DELETE SET NULL,
  garanti_bitis     DATE,
  bakim_periyodu    SMALLINT,                -- gün
  son_bakim         DATE,
  sonraki_bakim     DATE,
  durum             TEXT DEFAULT 'aktif',    -- 'aktif','bakim','hurda','satildi'
  notlar            TEXT,
  olusturma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_varlik_durum    ON varliklar(durum);
CREATE INDEX idx_varlik_sonraki  ON varliklar(sonraki_bakim);

-- ────────────────────────────────────────────────────────────
-- 6. BAKIM KAYITLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE bakim_kayitlari (
  id              BIGSERIAL PRIMARY KEY,
  varlik_id       BIGINT NOT NULL REFERENCES varliklar(id) ON DELETE CASCADE,
  tarih           DATE NOT NULL,
  tip             TEXT NOT NULL DEFAULT 'periyodik', -- 'periyodik','ariza','revizyon'
  aciklama        TEXT,
  maliyet         NUMERIC(15,2) DEFAULT 0,
  par             para_birimi DEFAULT 'TRY',
  yapan_firma     TEXT,
  yapan_personel  INT REFERENCES personel(id) ON DELETE SET NULL,
  sonraki_tarih   DATE,
  aciklama_not  TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bakim_varlik ON bakim_kayitlari(varlik_id);
CREATE INDEX idx_bakim_tarih  ON bakim_kayitlari(tarih DESC);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS bakim_kayitlari, varliklar, varlik_kategorileri,
--   personel, pozisyonlar, departmanlar CASCADE;
