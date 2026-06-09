-- ============================================================
-- HurraMotor ERP — Migration 004: Satın Alma & Üretim
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE sa_durum AS ENUM (
  'taslak','onay_bekliyor','onaylandi','siparis_verildi',
  'kismi_teslim','tamamlandi','iptal'
);

CREATE TYPE uretim_durum AS ENUM (
  'planlandi','hazirlaniyor','uretimde','kalite_kontrol',
  'tamamlandi','iptal','bekliyor'
);

CREATE TYPE kalite_durum AS ENUM (
  'bekliyor','gecti','reddedildi','kosullu_kabul'
);

-- ────────────────────────────────────────────────────────────
-- 1. SATIN ALMA EMİRLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE satinalma_emirleri (
  id              BIGSERIAL PRIMARY KEY,
  no              TEXT NOT NULL UNIQUE,      -- 'SA-2026-0001'
  tedarikci_id    INT REFERENCES cariler(id) ON DELETE SET NULL,
  durum           sa_durum NOT NULL DEFAULT 'taslak',
  siparis_tarihi  DATE,
  teslim_tarihi   DATE,
  par             para_birimi NOT NULL DEFAULT 'USD',
  kur             NUMERIC(15,6) DEFAULT 1,
  toplam_tutar    NUMERIC(15,2) DEFAULT 0,
  toplam_try      NUMERIC(15,2) DEFAULT 0,
  kdv_tutar       NUMERIC(15,2) DEFAULT 0,
  nakliye         NUMERIC(15,2) DEFAULT 0,
  indirim         NUMERIC(15,2) DEFAULT 0,
  genel_toplam    NUMERIC(15,2) DEFAULT 0,
  depo_id         INT REFERENCES depolar(id) ON DELETE SET NULL,
  not             TEXT,
  onay_notu       TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  onaylayan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  onay_tarihi     TIMESTAMPTZ,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sa_durum      ON satinalma_emirleri(durum);
CREATE INDEX idx_sa_tedarikci  ON satinalma_emirleri(tedarikci_id);
CREATE INDEX idx_sa_tarih      ON satinalma_emirleri(siparis_tarihi DESC);

-- FK from lotlar.satin_alma_id
ALTER TABLE lotlar
  ADD CONSTRAINT fk_lot_sa FOREIGN KEY (satin_alma_id)
  REFERENCES satinalma_emirleri(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. SATIN ALMA SATIRLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE satinalma_satirlar (
  id              BIGSERIAL PRIMARY KEY,
  sa_id           BIGINT NOT NULL REFERENCES satinalma_emirleri(id) ON DELETE CASCADE,
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  miktar          NUMERIC(15,4) NOT NULL,
  birim           TEXT NOT NULL DEFAULT 'adet',
  birim_fiyat     NUMERIC(15,4) NOT NULL DEFAULT 0,
  par             para_birimi NOT NULL DEFAULT 'USD',
  kdv_orani       NUMERIC(5,2) DEFAULT 18,
  kdv_tutar       NUMERIC(15,2) DEFAULT 0,
  toplam          NUMERIC(15,2) DEFAULT 0,
  teslim_miktar   NUMERIC(15,4) DEFAULT 0,
  teslim_durum    TEXT DEFAULT 'bekliyor',   -- 'bekliyor','kismi','tam'
  lot_id          BIGINT REFERENCES lotlar(id) ON DELETE SET NULL,
  not             TEXT
);

CREATE INDEX idx_sa_sat_sa   ON satinalma_satirlar(sa_id);
CREATE INDEX idx_sa_sat_urun ON satinalma_satirlar(urun_id);

-- ────────────────────────────────────────────────────────────
-- 3. ÜRETİM EMİRLERİ
-- ────────────────────────────────────────────────────────────
CREATE TABLE uretim_emirleri (
  id              BIGSERIAL PRIMARY KEY,
  no              TEXT NOT NULL UNIQUE,      -- 'UE-2026-0001'
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  bom_id          INT REFERENCES bom(id) ON DELETE SET NULL,
  hedef_adet      NUMERIC(15,4) NOT NULL DEFAULT 1,
  tamamlanan_adet NUMERIC(15,4) DEFAULT 0,
  durum           uretim_durum NOT NULL DEFAULT 'planlandi',
  kalite_durum    kalite_durum NOT NULL DEFAULT 'bekliyor',
  oncelik         SMALLINT DEFAULT 3,        -- 1=acil, 5=dusuk
  bas_tarihi      DATE,
  bit_tarihi      DATE,
  gercek_bas      TIMESTAMPTZ,
  gercek_bit      TIMESTAMPTZ,
  malzeme_depo_id INT REFERENCES depolar(id) ON DELETE SET NULL,
  hedef_depo_id   INT REFERENCES depolar(id) ON DELETE SET NULL,
  -- İşçilik & Maliyet
  iscilik_saati   NUMERIC(10,2) DEFAULT 0,
  iscilik_maliyet NUMERIC(15,2) DEFAULT 0,
  malzeme_maliyet NUMERIC(15,2) DEFAULT 0,
  toplam_maliyet  NUMERIC(15,2) DEFAULT 0,
  -- Kalite
  kk_notu         TEXT,
  kk_tarihi       TIMESTAMPTZ,
  kk_yapan_id     UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  -- Genel
  not             TEXT,
  olusturan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncelleme_tarihi   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ue_durum   ON uretim_emirleri(durum);
CREATE INDEX idx_ue_urun    ON uretim_emirleri(urun_id);
CREATE INDEX idx_ue_tarih   ON uretim_emirleri(bas_tarihi);

-- ────────────────────────────────────────────────────────────
-- 4. ÜRETİM MALZEME ÇEKME (rezerve & fiili)
-- ────────────────────────────────────────────────────────────
CREATE TABLE uretim_malzeme (
  id              BIGSERIAL PRIMARY KEY,
  uretim_id       BIGINT NOT NULL REFERENCES uretim_emirleri(id) ON DELETE CASCADE,
  urun_id         INT NOT NULL REFERENCES urunler(id) ON DELETE RESTRICT,
  planlanan_miktar NUMERIC(15,4) NOT NULL DEFAULT 0,
  rezerve_miktar  NUMERIC(15,4) DEFAULT 0,
  kullanilan_miktar NUMERIC(15,4) DEFAULT 0,
  fire_miktar     NUMERIC(15,4) DEFAULT 0,
  lot_id          BIGINT REFERENCES lotlar(id) ON DELETE SET NULL,
  depo_id         INT REFERENCES depolar(id) ON DELETE SET NULL,
  durum           TEXT DEFAULT 'bekliyor'    -- 'bekliyor','rezerve','kullanildi'
);

CREATE INDEX idx_ue_mal_uretim ON uretim_malzeme(uretim_id);

-- ────────────────────────────────────────────────────────────
-- 5. KALİTE KONTROL KAYITLARI
-- ────────────────────────────────────────────────────────────
CREATE TABLE kalite_kontrol (
  id              BIGSERIAL PRIMARY KEY,
  uretim_id       BIGINT REFERENCES uretim_emirleri(id) ON DELETE SET NULL,
  urun_id         INT NOT NULL REFERENCES urunler(id),
  lot_id          BIGINT REFERENCES lotlar(id) ON DELETE SET NULL,
  tarih           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kontrol_tipi    TEXT NOT NULL DEFAULT 'giris', -- 'giris','uretim_sonu','sevk'
  durum           kalite_durum NOT NULL DEFAULT 'bekliyor',
  muayene_miktari NUMERIC(15,4) DEFAULT 0,
  kabul_miktari   NUMERIC(15,4) DEFAULT 0,
  ret_miktari     NUMERIC(15,4) DEFAULT 0,
  red_nedeni      TEXT,
  not             TEXT,
  yapan_id        UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS kalite_kontrol, uretim_malzeme, uretim_emirleri,
--   satinalma_satirlar, satinalma_emirleri CASCADE;
-- DROP TYPE IF EXISTS kalite_durum, uretim_durum, sa_durum;
