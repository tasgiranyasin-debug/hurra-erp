-- ============================================================
-- Migration 010: Kritik Tablolar için Row Level Security
-- HurraMotor ERP — Madde 3 QA Fix
-- Tarih: 2026-06-09
-- ============================================================
-- 009'da sadece 8 tablo RLS'liydi.
-- Bu migration eksik kalan 51 tablodan en kritik olanlarını ekler.
-- ============================================================

-- ── KASA & BANKA (mali veri) ──────────────────────────────
ALTER TABLE kasalar              ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasa_hareketler      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankalar             ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_hareketler     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cek_senet            ENABLE ROW LEVEL SECURITY;

CREATE POLICY kasa_auth ON kasalar          FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY kasa_hrkt_auth ON kasa_hareketler FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY banka_auth ON bankalar        FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY banka_hrkt_auth ON banka_hareketler FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY ceksenet_auth ON cek_senet    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── MALİYET (hassas fiyat verisi) ────────────────────────
ALTER TABLE urun_maliyetler      ENABLE ROW LEVEL SECURITY;
ALTER TABLE maliyet_merkezleri   ENABLE ROW LEVEL SECURITY;
ALTER TABLE genel_giderler       ENABLE ROW LEVEL SECURITY;

CREATE POLICY urun_maliyet_auth ON urun_maliyetler FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY mal_merkez_auth ON maliyet_merkezleri FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY genel_gider_auth ON genel_giderler FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── PERSONEL (maas/sgk verisi) ───────────────────────────
ALTER TABLE personel             ENABLE ROW LEVEL SECURITY;
ALTER TABLE departmanlar         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pozisyonlar          ENABLE ROW LEVEL SECURITY;

CREATE POLICY personel_auth ON personel         FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY dept_auth ON departmanlar         FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY poz_auth ON pozisyonlar           FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── ONAY & LOG (denetim izleri) ──────────────────────────
ALTER TABLE onay_talepleri       ENABLE ROW LEVEL SECURITY;
ALTER TABLE onay_adimlar         ENABLE ROW LEVEL SECURITY;
ALTER TABLE islem_loglari        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kullanici_loglari    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hata_loglar          ENABLE ROW LEVEL SECURITY;

CREATE POLICY onay_talep_auth ON onay_talepleri  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY onay_adim_auth ON onay_adimlar     FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY islem_log_auth ON islem_loglari    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY kull_log_auth ON kullanici_loglari FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY hata_log_auth ON hata_loglar       FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── İTHALAT (ticari sır) ─────────────────────────────────
ALTER TABLE konteynerler         ENABLE ROW LEVEL SECURITY;
ALTER TABLE yukleme_listeleri    ENABLE ROW LEVEL SECURITY;
ALTER TABLE masraf_kalemleri     ENABLE ROW LEVEL SECURITY;

CREATE POLICY konteyner_auth ON konteynerler       FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY yukleme_auth ON yukleme_listeleri    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY masraf_auth ON masraf_kalemleri      FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── STOK (BOM & lot) ─────────────────────────────────────
ALTER TABLE bom                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_revizyonlar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_satirlar         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotlar               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_hareketler       ENABLE ROW LEVEL SECURITY;

CREATE POLICY bom_auth ON bom                  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY bom_rev_auth ON bom_revizyonlar  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY bom_sat_auth ON bom_satirlar     FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY lot_auth ON lotlar               FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY lot_hrkt_auth ON lot_hareketler  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── VARLIK ───────────────────────────────────────────────
ALTER TABLE varliklar            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bakim_kayitlari      ENABLE ROW LEVEL SECURITY;

CREATE POLICY varlik_auth ON varliklar             FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY bakim_auth ON bakim_kayitlari        FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── AI LOGLAR ────────────────────────────────────────────
ALTER TABLE ai_analiz_loglar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tavsiyeler        ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_log_auth ON ai_analiz_loglar  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY ai_tav_auth ON ai_tavsiyeler     FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- NOT: Şu anki politikalar "authenticated kullanıcı her şeyi görebilir"
-- kuralıyla çalışmaktadır. Bu, unauthenticated (anon key) erişimini engeller.
--
-- Gelecek adım (Madde 4 — Bayi Portalı):
-- Bayi rolü için per-row tenant izolasyonu:
--   USING (firma_id = auth.jwt() ->> 'firma_id')
-- ============================================================
