/**
 * HurraMotor ERP — Supabase DB Abstraction Layer
 *
 * Bu modül localStorage ↔ Supabase geçiş sürecini yönetir.
 * Önce localStorage modunda çalışır, Supabase bağlantısı
 * yapıldıktan sonra otomatik olarak PostgreSQL'e geçer.
 *
 * Kullanım:
 *   const db = window.HMDB;
 *   const cariler = await db.getAll('cariler');
 *   await db.upsert('cariler', { id:1, ad:'Test' });
 */

(function(global) {
  'use strict';

  // ─────────────────────────────────────────────
  // Supabase bağlantı ayarları (değiştirilecek)
  // ─────────────────────────────────────────────
  const SUPABASE_URL = '';   // 'https://xxxx.supabase.co'
  const SUPABASE_KEY = '';   // anon public key

  // localStorage DB map (core.js DB objesiyle eşleşir)
  const LS_MAP = {
    cariler:             'hm_cari',
    urunler:             'hm_urun',
    depolar:             'hm_depo',
    stok_hareketler:     'hm_stok',
    satinalma_emirleri:  'hm_sa',
    uretim_emirleri:     'hm_ue',
    ithalat_dosyalari:   'hm_import',
    personel:            'hm_personel',
    varliklar:           'hm_varlik',
    bildirimler:         'hm_bildirim',
    onay_talepleri:      'hm_onay',
    dokumanlar:          'hm_dokuman',
    bom:                 'hm_bom',
    kategoriler:         'hm_kategori',
    kasalar:             'hm_kasa',
    kasa_hareketler:     'hm_kasa_hrk',
    bankalar:            'hm_banka',
    banka_hareketler:    'hm_banka_hrk',
    cek_senet:           'hm_cs',
    cari_hareketler:     'hm_cari_hrk',
    lotlar:              'hm_lot',
    sistem_ayarlari:     'hm_ayar',
    kullanicilar:        'hm_kullanici',
  };

  // ─────────────────────────────────────────────
  // Mod tespiti
  // ─────────────────────────────────────────────
  let _supabase = null;
  let _mode = 'localStorage'; // 'localStorage' | 'supabase'

  function isSupabaseReady() {
    return _supabase !== null && SUPABASE_URL !== '';
  }

  // ─────────────────────────────────────────────
  // Supabase bağlantısını başlat
  // ─────────────────────────────────────────────
  async function connect(url, key) {
    if (typeof supabase === 'undefined') {
      console.warn('[HMDB] Supabase CDN yüklenmemiş. localStorage modu.');
      return false;
    }
    try {
      _supabase = supabase.createClient(url || SUPABASE_URL, key || SUPABASE_KEY);
      // Bağlantı testi
      const { error } = await _supabase.from('sistem_ayarlari').select('id').limit(1);
      if (error) throw error;
      _mode = 'supabase';
      console.info('[HMDB] Supabase bağlantısı başarılı.');
      return true;
    } catch (e) {
      _supabase = null;
      console.warn('[HMDB] Supabase bağlantı hatası, localStorage moda geçildi:', e.message);
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // localStorage yardımcıları
  // ─────────────────────────────────────────────
  function lsGet(tablo) {
    const key = LS_MAP[tablo];
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  }

  function lsSet(tablo, data) {
    const key = LS_MAP[tablo];
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function lsNextId(data) {
    return data.length ? Math.max(...data.map(r => r.id || 0)) + 1 : 1;
  }

  // ─────────────────────────────────────────────
  // CRUD — localStorage modu
  // ─────────────────────────────────────────────
  function ls_getAll(tablo, filtre) {
    let rows = lsGet(tablo);
    if (filtre) {
      rows = rows.filter(r =>
        Object.entries(filtre).every(([k, v]) => r[k] === v)
      );
    }
    return rows;
  }

  function ls_getById(tablo, id) {
    return lsGet(tablo).find(r => r.id === id) || null;
  }

  function ls_insert(tablo, row) {
    const rows = lsGet(tablo);
    const newRow = { ...row, id: row.id || lsNextId(rows) };
    rows.push(newRow);
    lsSet(tablo, rows);
    return newRow;
  }

  function ls_update(tablo, id, delta) {
    const rows = lsGet(tablo);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...delta };
    lsSet(tablo, rows);
    return rows[idx];
  }

  function ls_upsert(tablo, row) {
    const rows = lsGet(tablo);
    const idx = rows.findIndex(r => r.id === row.id);
    if (idx === -1) {
      const newRow = { ...row, id: row.id || lsNextId(rows) };
      rows.push(newRow);
      lsSet(tablo, rows);
      return newRow;
    }
    rows[idx] = { ...rows[idx], ...row };
    lsSet(tablo, rows);
    return rows[idx];
  }

  function ls_delete(tablo, id) {
    const rows = lsGet(tablo).filter(r => r.id !== id);
    lsSet(tablo, rows);
    return true;
  }

  // ─────────────────────────────────────────────
  // CRUD — Supabase modu
  // ─────────────────────────────────────────────
  async function sb_getAll(tablo, filtre) {
    let q = _supabase.from(tablo).select('*');
    if (filtre) {
      Object.entries(filtre).forEach(([k, v]) => { q = q.eq(k, v); });
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function sb_getById(tablo, id) {
    const { data, error } = await _supabase.from(tablo).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function sb_insert(tablo, row) {
    const { data, error } = await _supabase.from(tablo).insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function sb_update(tablo, id, delta) {
    const { data, error } = await _supabase.from(tablo).update(delta).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function sb_upsert(tablo, row) {
    const { data, error } = await _supabase.from(tablo).upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function sb_delete(tablo, id) {
    const { error } = await _supabase.from(tablo).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // ─────────────────────────────────────────────
  // Public API (mod-bağımsız)
  // ─────────────────────────────────────────────
  const HMDB = {
    mode: () => _mode,
    isSupabase: isSupabaseReady,
    connect,

    getAll:   (tablo, filtre)  => isSupabaseReady() ? sb_getAll(tablo, filtre)  : Promise.resolve(ls_getAll(tablo, filtre)),
    getById:  (tablo, id)      => isSupabaseReady() ? sb_getById(tablo, id)     : Promise.resolve(ls_getById(tablo, id)),
    insert:   (tablo, row)     => isSupabaseReady() ? sb_insert(tablo, row)     : Promise.resolve(ls_insert(tablo, row)),
    update:   (tablo, id, d)   => isSupabaseReady() ? sb_update(tablo, id, d)   : Promise.resolve(ls_update(tablo, id, d)),
    upsert:   (tablo, row)     => isSupabaseReady() ? sb_upsert(tablo, row)     : Promise.resolve(ls_upsert(tablo, row)),
    delete:   (tablo, id)      => isSupabaseReady() ? sb_delete(tablo, id)      : Promise.resolve(ls_delete(tablo, id)),

    // Toplu silme (filtre ile)
    deleteWhere: async (tablo, filtre) => {
      if (isSupabaseReady()) {
        let q = _supabase.from(tablo).delete();
        Object.entries(filtre).forEach(([k, v]) => { q = q.eq(k, v); });
        const { error } = await q;
        if (error) throw error;
        return true;
      }
      const rows = lsGet(tablo).filter(r =>
        !Object.entries(filtre).every(([k, v]) => r[k] === v)
      );
      lsSet(tablo, rows);
      return true;
    },

    // Sayım (filtre opsiyonel)
    count: async (tablo, filtre) => {
      if (isSupabaseReady()) {
        let q = _supabase.from(tablo).select('*', { count: 'exact', head: true });
        if (filtre) Object.entries(filtre).forEach(([k, v]) => { q = q.eq(k, v); });
        const { count, error } = await q;
        if (error) throw error;
        return count;
      }
      return ls_getAll(tablo, filtre).length;
    },

    // Ham Supabase client (ileri seviye sorgular için)
    raw: () => _supabase,

    // localStorage → Supabase migrate
    migrate: async (tablo) => {
      if (!isSupabaseReady()) {
        throw new Error('Supabase bağlı değil.');
      }
      const rows = lsGet(tablo);
      if (!rows.length) return { aktarildi: 0 };
      const { data, error } = await _supabase.from(tablo).upsert(rows).select();
      if (error) throw error;
      console.info(`[HMDB] ${tablo}: ${data.length} kayıt aktarıldı.`);
      return { aktarildi: data.length };
    },

    // Tüm tabloları migrate et
    migrateAll: async () => {
      const sonuclar = {};
      for (const tablo of Object.keys(LS_MAP)) {
        try {
          sonuclar[tablo] = await HMDB.migrate(tablo);
        } catch (e) {
          sonuclar[tablo] = { hata: e.message };
        }
      }
      return sonuclar;
    },
  };

  global.HMDB = HMDB;
  console.info('[HMDB] HurraMotor DB Abstraction Layer yüklendi. Mod: localStorage');

})(window);
