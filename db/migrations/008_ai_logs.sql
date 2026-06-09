-- ============================================================
-- HurraMotor ERP — Migration 008: AI & Sistem Logları
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. AI ANALİZ LOGLAR
-- Tüm AI fonksiyonlarının (aiStokAnaliz, aiMrpOneri, vb.)
-- çıktısını ve parametrelerini kayıt altına alır.
-- ────────────────────────────────────────────────────────────
CREATE TABLE ai_analiz_loglar (
  id              BIGSERIAL PRIMARY KEY,
  fonksiyon       TEXT NOT NULL,             -- 'aiStokAnaliz','aiMrpOneri',..
  kullanici_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  parametreler    JSONB DEFAULT '{}',
  sonuc           JSONB,
  sure_ms         INT,                       -- çalışma süresi ms
  hata            TEXT,                      -- varsa hata mesajı
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_log_fonk  ON ai_analiz_loglar(fonksiyon);
CREATE INDEX idx_ai_log_tarih ON ai_analiz_loglar(olusturma_tarihi DESC);

-- ────────────────────────────────────────────────────────────
-- 2. AI TAVSİYE KAYITLARI
-- Sistemin ürettiği önerilerin takibi (MRP, stok, vb.)
-- ────────────────────────────────────────────────────────────
CREATE TABLE ai_tavsiyeler (
  id              BIGSERIAL PRIMARY KEY,
  tip             TEXT NOT NULL,             -- 'mrp','stok','uretim','nakit'
  baslik          TEXT NOT NULL,
  aciklama        TEXT,
  oncelik         TEXT DEFAULT 'normal',     -- 'kritik','yuksek','normal','dusuk'
  veri            JSONB DEFAULT '{}',        -- öneri detayı
  uygulandi       BOOLEAN NOT NULL DEFAULT FALSE,
  uygulama_tarihi TIMESTAMPTZ,
  uygulayan_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  gecerlilik_son  TIMESTAMPTZ,              -- öneri geçerlilik süresi
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_tav_tip      ON ai_tavsiyeler(tip);
CREATE INDEX idx_ai_tav_oncelik  ON ai_tavsiyeler(oncelik);
CREATE INDEX idx_ai_tav_uygulandi ON ai_tavsiyeler(uygulandi);

-- ────────────────────────────────────────────────────────────
-- 3. DASHBOARD WIDGET KAYITLARI
-- Her kullanıcının dashboard konfigürasyonunu saklar.
-- ────────────────────────────────────────────────────────────
CREATE TABLE dashboard_widgetlar (
  id              SERIAL PRIMARY KEY,
  kullanici_id    UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  widget_id       TEXT NOT NULL,             -- 'stok_ozet','kpi_ciro', vb.
  gorunum_adi     TEXT,
  sira            SMALLINT DEFAULT 0,
  ayarlar         JSONB DEFAULT '{}',        -- boyut, renk, zaman aralığı
  aktif           BOOLEAN NOT NULL DEFAULT TRUE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kullanici_id, widget_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. KPI GEÇMİŞİ (dönemsel anlık görüntü)
-- ────────────────────────────────────────────────────────────
CREATE TABLE kpi_gecmis (
  id              BIGSERIAL PRIMARY KEY,
  donem           TEXT NOT NULL,             -- 'YYYY-MM'
  kpi_kodu        TEXT NOT NULL,             -- 'ciro_try','siparis_adet', vb.
  deger           NUMERIC(20,4),
  hedef           NUMERIC(20,4),
  birim           TEXT DEFAULT 'TRY',        -- 'TRY','adet','%'
  notlar          TEXT,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (donem, kpi_kodu)
);

CREATE INDEX idx_kpi_donem ON kpi_gecmis(donem DESC);
CREATE INDEX idx_kpi_kod   ON kpi_gecmis(kpi_kodu);

-- ────────────────────────────────────────────────────────────
-- 5. HATA LOGLAR (client-side JS hataları da buraya)
-- ────────────────────────────────────────────────────────────
CREATE TABLE hata_loglar (
  id              BIGSERIAL PRIMARY KEY,
  kullanici_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  sayfa           TEXT,                      -- URL / modül adı
  fonksiyon       TEXT,
  hata_mesaji     TEXT NOT NULL,
  stack_trace     TEXT,
  tarayici        TEXT,
  seviye          TEXT DEFAULT 'hata',       -- 'hata','uyari','bilgi'
  cozuldu         BOOLEAN DEFAULT FALSE,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hata_sayfa  ON hata_loglar(sayfa);
CREATE INDEX idx_hata_tarih  ON hata_loglar(olusturma_tarihi DESC);
CREATE INDEX idx_hata_coz    ON hata_loglar(cozuldu);

-- ────────────────────────────────────────────────────────────
-- 6. VERI AKTARIM LOGLAR (localStorage → Supabase geçişi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE veri_aktarim_loglar (
  id              BIGSERIAL PRIMARY KEY,
  tablo           TEXT NOT NULL,
  islem_tipi      TEXT NOT NULL DEFAULT 'import', -- 'import','export','sync'
  kayit_sayisi    INT DEFAULT 0,
  basarili        INT DEFAULT 0,
  hatali          INT DEFAULT 0,
  hata_detay      JSONB DEFAULT '{}',
  baslama         TIMESTAMPTZ,
  bitis           TIMESTAMPTZ,
  kullanici_id    UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- DOWN
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS veri_aktarim_loglar, hata_loglar, kpi_gecmis,
--   dashboard_widgetlar, ai_tavsiyeler, ai_analiz_loglar CASCADE;
