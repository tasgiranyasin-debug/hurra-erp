-- ============================================================
-- HurraMotor ERP — Migration 007: Onay, Bildirim, Doküman
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE onay_durum    AS ENUM ('bekliyor','onaylandi','reddedildi','iptal','revizyon');
CREATE TYPE bildirim_tip  AS ENUM (
  'stok_kritik','stok_bitmekte','uretim_gecikme','sa_onay',
  'kk_red','cari_borc','bakim_vakti','sistem','genel'
);

-- ────────────────────────────────────────────────────────────
-- 1. ONAY AKIŞ ŞABLONLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE onay_sablonlari (
  id            SERIAL PRIMARY KEY,
  ad            TEXT NOT NULL UNIQUE,
  modul         TEXT NOT NULL,               -- 'satinalma','uretim','ithalat','genel'
  esik_tutar    NUMERIC(15,2),               -- bu tutarın üstü için tetikle
  adimlar       JSONB NOT NULL DEFAULT '[]', -- [{sira, rol, onaylayan_id?, tur}]
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. ONAY TALEPLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE onay_talepleri (
  id              BIGSERIAL PRIMARY KEY,
  sablon_id       INT REFERENCES onay_sablonlari(id) ON DELETE SET NULL,
  referans_tip    TEXT NOT NULL,             -- 'satinalma','uretim','ithalat'
  referans_id     TEXT NOT NULL,
  baslik          TEXT NOT NULL,
  aciklama        TEXT,
  tutar           NUMERIC(15,2),
  par             para_birimi DEFAULT 'TRY',
  durum           onay_durum NOT NULL DEFAULT 'bekliyor',
  olusturan_id    UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE RESTRICT,
  guncel_adim     SMALLINT DEFAULT 1,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onay_ref    ON onay_talepleri(referans_tip, referans_id);
CREATE INDEX idx_onay_durum  ON onay_talepleri(durum);

-- ────────────────────────────────────────────────────────────
-- 3. ONAY ADIM KAYITLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE onay_adimlar (
  id              BIGSERIAL PRIMARY KEY,
  talep_id        BIGINT NOT NULL REFERENCES onay_talepleri(id) ON DELETE CASCADE,
  adim_sira       SMALLINT NOT NULL DEFAULT 1,
  onaylayan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  durum           onay_durum NOT NULL DEFAULT 'bekliyor',
  aciklama_not  TEXT,
  islem_tarihi    TIMESTAMPTZ,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onay_adim_talep ON onay_adimlar(talep_id);

-- ────────────────────────────────────────────────────────────
-- 4. BİLDİRİMLER
-- ────────────────────────────────────────────────────────────
CREATE TABLE bildirimler (
  id              BIGSERIAL PRIMARY KEY,
  kullanici_id    UUID REFERENCES kullanicilar(id) ON DELETE CASCADE,
  tip             bildirim_tip NOT NULL DEFAULT 'genel',
  baslik          TEXT NOT NULL,
  mesaj           TEXT,
  veri            JSONB DEFAULT '{}',       -- bağlam verisi (urun_id, tutar, vb.)
  okundu          BOOLEAN NOT NULL DEFAULT FALSE,
  okunma_tarihi   TIMESTAMPTZ,
  kaynak_tip      TEXT,                     -- 'sistem','kullanici','otomatik'
  kaynak_id       TEXT,
  link            TEXT,                     -- ilgili modül bağlantısı
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bildirim_kullanici ON bildirimler(kullanici_id);
CREATE INDEX idx_bildirim_okundu    ON bildirimler(okundu);
CREATE INDEX idx_bildirim_tip       ON bildirimler(tip);
CREATE INDEX idx_bildirim_tarih     ON bildirimler(olusturma_tarihi DESC);

-- ────────────────────────────────────────────────────────────
-- 5. DOKÜMAN KATEGORİLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE dokuman_kategorileri (
  id      SERIAL PRIMARY KEY,
  ad      TEXT NOT NULL UNIQUE,
  ust_id  INT REFERENCES dokuman_kategorileri(id) ON DELETE SET NULL,
  simge   TEXT DEFAULT '📄',
  aktif   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO dokuman_kategorileri (ad, simge) VALUES
  ('Teknik Çizimler', '📐'),
  ('Kalite Belgeleri', '✅'),
  ('İthalat Evrakları', '🚢'),
  ('Sözleşmeler', '📝'),
  ('Sertifikalar', '🏅'),
  ('Diğer', '📁');

-- ────────────────────────────────────────────────────────────
-- 6. DOKÜMANLAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE dokumanlar (
  id              BIGSERIAL PRIMARY KEY,
  kategori_id     INT REFERENCES dokuman_kategorileri(id) ON DELETE SET NULL,
  ad              TEXT NOT NULL,
  dosya_adi       TEXT NOT NULL,             -- orijinal dosya adı
  dosya_yolu      TEXT,                      -- storage path (Supabase Storage)
  dosya_tipi      TEXT,                      -- MIME type
  boyut_kb        INT,
  versiyon        TEXT DEFAULT '1.0',
  -- Bağlam (hangi kayda bağlı)
  referans_tip    TEXT,                      -- 'urun','cari','ithalat','uretim','varlik'
  referans_id     TEXT,
  etiketler       TEXT[],
  aciklama        TEXT,
  aktif           BOOLEAN NOT NULL DEFAULT TRUE,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dok_kategori  ON dokumanlar(kategori_id);
CREATE INDEX idx_dok_ref       ON dokumanlar(referans_tip, referans_id);
CREATE INDEX idx_dok_etiket    ON dokumanlar USING gin(etiketler);

-- ────────────────────────────────────────────────────────────
-- 7. DOKÜMAN VERSİYON GEÇMİŞİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE dokuman_versiyonlar (
  id              BIGSERIAL PRIMARY KEY,
  dokuman_id      BIGINT NOT NULL REFERENCES dokumanlar(id) ON DELETE CASCADE,
  versiyon        TEXT NOT NULL,
  dosya_yolu      TEXT NOT NULL,
  degisiklik      TEXT,
  yukleyen_id     UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dok_ver_dok ON dokuman_versiyonlar(dokuman_id);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dokuman_versiyonlar, dokumanlar, dokuman_kategorileri,
--   bildirimler, onay_adimlar, onay_talepleri, onay_sablonlari CASCADE;
-- DROP TYPE IF EXISTS bildirim_tip, onay_durum;
