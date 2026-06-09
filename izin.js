/**
 * HurraMotor ERP — İzin / Permission Engine  v1.0
 * ============================================================
 * 6 izin katmanı:
 *   menu    — navigasyon görünürlüğü
 *   sayfa   — URL erişimi (guard)
 *   veri    — hassas veri alanları (maliyet, maas, kasa vb.)
 *   islem   — aksiyon butonları (ekle/düzenle/sil/onayla)
 *   onay    — onay akışı yetkileri
 *   ai      — AI sorgu & veri erişimi (veri izninden miras alır)
 *
 * Kullanım:
 *   IZIN.menu('stok')          → true/false
 *   IZIN.sayfa('kasa')         → true/false
 *   IZIN.veri('maliyet')       → true/false
 *   IZIN.islem('stok.ekle')    → true/false
 *   IZIN.onay('satinalma')     → true/false
 *   IZIN.ai('sorgu')           → true/false
 *   IZIN.guard('kasa')         → sayfayı koru (yetkisizse yönlendir)
 *   IZIN.filtrele(obj, alanlar)→ hassas alanları maskele
 *   IZIN.navFiltrele()         → menüyü gizle/göster
 *   IZIN.aiFiltrele(ctx)       → AI context'ini temizle
 * ============================================================
 */

(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // SAYFA & MENÜ ID HARİTASI
  // ──────────────────────────────────────────────────────────
  const SAYFA_DOSYA = {
    'dashboard':    'dashboard.html',
    'stok':         'stok.html',
    'bom':          'bom.html',
    'urun-ailesi':  'urun-ailesi.html',
    'seri':         'seri.html',
    'cariler':      'cariler.html',
    'kasa':         'kasa.html',
    'ceksenet':     'ceksenet.html',
    'satinalma':    'satinalma.html',
    'uretim':       'uretim.html',
    'ithalat':      'ithalat.html',
    'personel':     'personel.html',
    'varlik':       'varlik.html',
    'bildirim':     'bildirim.html',
    'evrak':        'evrak.html',
    'ai':           'ai.html',
    'ai-asistan':   'ai-asistan.html',
    'saglik':       'saglik.html',
    'admin':        'admin.html',
    'ayarlar':      'ayarlar.html',
    'sifirla':      'sifirla.html',
  };

  // Menü grubu → hangi sayfaları kapsar
  const MENU_SAYFALAR = {
    stok:       ['stok','bom','urun-ailesi','seri'],
    finans:     ['cariler','kasa','ceksenet'],
    satin_alma: ['satinalma'],
    uretim:     ['uretim'],
    ithalat:    ['ithalat'],
    personel:   ['personel','varlik'],
    sistem:     ['bildirim','evrak','ai','ai-asistan','saglik'],
    yonetim:    ['admin','ayarlar','sifirla'],
  };

  // ──────────────────────────────────────────────────────────
  // ROL ŞABLONLARI (permission presets)
  // ──────────────────────────────────────────────────────────
  const SABLON = {

    // ── ADMIN ── tam yetki
    admin: {
      menu:  { stok:true, finans:true, satin_alma:true, uretim:true, ithalat:true, personel:true, sistem:true, yonetim:true },
      sayfa: _tumSayfalar(true),
      veri:  { maliyet:true, alis_fiyat:true, satis_fiyat:true, maas:true, sgk:true,
               kasa_bakiye:true, banka_bakiye:true, ithalat_fiyat:true, kar_marji:true, cari_bakiye:true },
      islem: _tumIslemler(true),
      onay:  { satinalma:true, uretim:true, ithalat:true, genel:true },
      ai:    { sorgu:true, rapor:true, oneri:true },
    },

    // ── MUHASEBE ── finans + raporlar; stok sadece okur
    muhasebe: {
      menu:  { stok:true, finans:true, satin_alma:false, uretim:false, ithalat:true, personel:false, sistem:true, yonetim:false },
      sayfa: {
        dashboard:true, stok:true, bom:false, 'urun-ailesi':false, seri:false,
        cariler:true, kasa:true, ceksenet:true,
        satinalma:false, uretim:false,
        ithalat:true,
        personel:false, varlik:false,
        bildirim:true, evrak:true, ai:true, 'ai-asistan':true, saglik:false,
        admin:false, ayarlar:false, sifirla:false,
      },
      veri: {
        maliyet:true, alis_fiyat:true, satis_fiyat:true, maas:false, sgk:false,
        kasa_bakiye:true, banka_bakiye:true, ithalat_fiyat:true, kar_marji:true, cari_bakiye:true,
      },
      islem: {
        'stok.ekle':false,   'stok.duzenle':false, 'stok.sil':false, 'stok.sayim':false,
        'cari.ekle':true,    'cari.duzenle':true,  'cari.sil':false,
        'sa.ekle':false,     'sa.onayla':false,    'sa.iptal':false,
        'uretim.baslat':false,'uretim.tamamla':false,'uretim.iptal':false,
        'ithalat.ekle':true, 'ithalat.duzenle':true,
        'kasa.giris':true,   'kasa.cikis':true,
        'banka.giris':true,  'banka.cikis':true,
        'onay.ver':false,    'onay.reddet':false,
        'yedek.al':false,    'yedek.yukle':false,
        'kullanici.yonet':false,
      },
      onay:  { satinalma:false, uretim:false, ithalat:true, genel:false },
      ai:    { sorgu:true, rapor:true, oneri:false },
    },

    // ── DEPO MÜDÜRÜ ── stok tam; fiyat/maliyet görmez
    depo_mudur: {
      menu:  { stok:true, finans:false, satin_alma:true, uretim:true, ithalat:true, personel:false, sistem:true, yonetim:false },
      sayfa: {
        dashboard:true, stok:true, bom:true, 'urun-ailesi':true, seri:true,
        cariler:false, kasa:false, ceksenet:false,
        satinalma:true, uretim:true,
        ithalat:true,
        personel:false, varlik:true,
        bildirim:true, evrak:false, ai:true, 'ai-asistan':false, saglik:false,
        admin:false, ayarlar:false, sifirla:false,
      },
      veri: {
        maliyet:false, alis_fiyat:false, satis_fiyat:false, maas:false, sgk:false,
        kasa_bakiye:false, banka_bakiye:false, ithalat_fiyat:false, kar_marji:false, cari_bakiye:false,
      },
      islem: {
        'stok.ekle':true,    'stok.duzenle':true,  'stok.sil':false, 'stok.sayim':true,
        'cari.ekle':false,   'cari.duzenle':false, 'cari.sil':false,
        'sa.ekle':false,     'sa.onayla':false,    'sa.iptal':false,
        'uretim.baslat':true,'uretim.tamamla':true,'uretim.iptal':false,
        'ithalat.ekle':false,'ithalat.duzenle':false,
        'kasa.giris':false,  'kasa.cikis':false,
        'banka.giris':false, 'banka.cikis':false,
        'onay.ver':false,    'onay.reddet':false,
        'yedek.al':false,    'yedek.yukle':false,
        'kullanici.yonet':false,
      },
      onay:  { satinalma:false, uretim:true, ithalat:false, genel:false },
      ai:    { sorgu:true, rapor:false, oneri:false },
    },

    // ── SATIN ALMA ── SA + ithalat + tedarikçi cariler; kasa/maliyet görmez
    satin_alma: {
      menu:  { stok:true, finans:false, satin_alma:true, uretim:false, ithalat:true, personel:false, sistem:true, yonetim:false },
      sayfa: {
        dashboard:true, stok:true, bom:true, 'urun-ailesi':false, seri:false,
        cariler:true, kasa:false, ceksenet:false,
        satinalma:true, uretim:false,
        ithalat:true,
        personel:false, varlik:false,
        bildirim:true, evrak:true, ai:true, 'ai-asistan':false, saglik:false,
        admin:false, ayarlar:false, sifirla:false,
      },
      veri: {
        maliyet:false, alis_fiyat:true, satis_fiyat:false, maas:false, sgk:false,
        kasa_bakiye:false, banka_bakiye:false, ithalat_fiyat:true, kar_marji:false, cari_bakiye:true,
      },
      islem: {
        'stok.ekle':false,    'stok.duzenle':false, 'stok.sil':false, 'stok.sayim':false,
        'cari.ekle':true,     'cari.duzenle':true,  'cari.sil':false,
        'sa.ekle':true,       'sa.onayla':false,    'sa.iptal':false,
        'uretim.baslat':false,'uretim.tamamla':false,'uretim.iptal':false,
        'ithalat.ekle':true,  'ithalat.duzenle':true,
        'kasa.giris':false,   'kasa.cikis':false,
        'banka.giris':false,  'banka.cikis':false,
        'onay.ver':false,     'onay.reddet':false,
        'yedek.al':false,     'yedek.yukle':false,
        'kullanici.yonet':false,
      },
      onay:  { satinalma:true, uretim:false, ithalat:false, genel:false },
      ai:    { sorgu:true, rapor:false, oneri:true },
    },

    // ── ÜRETİM ── üretim + stok; fiyat/kasa görmez
    uretim: {
      menu:  { stok:true, finans:false, satin_alma:false, uretim:true, ithalat:false, personel:false, sistem:true, yonetim:false },
      sayfa: {
        dashboard:true, stok:true, bom:true, 'urun-ailesi':false, seri:true,
        cariler:false, kasa:false, ceksenet:false,
        satinalma:false, uretim:true,
        ithalat:false,
        personel:false, varlik:true,
        bildirim:true, evrak:false, ai:true, 'ai-asistan':false, saglik:false,
        admin:false, ayarlar:false, sifirla:false,
      },
      veri: {
        maliyet:false, alis_fiyat:false, satis_fiyat:false, maas:false, sgk:false,
        kasa_bakiye:false, banka_bakiye:false, ithalat_fiyat:false, kar_marji:false, cari_bakiye:false,
      },
      islem: {
        'stok.ekle':false,    'stok.duzenle':true,  'stok.sil':false, 'stok.sayim':false,
        'cari.ekle':false,    'cari.duzenle':false, 'cari.sil':false,
        'sa.ekle':false,      'sa.onayla':false,    'sa.iptal':false,
        'uretim.baslat':true, 'uretim.tamamla':true,'uretim.iptal':false,
        'ithalat.ekle':false, 'ithalat.duzenle':false,
        'kasa.giris':false,   'kasa.cikis':false,
        'banka.giris':false,  'banka.cikis':false,
        'onay.ver':false,     'onay.reddet':false,
        'yedek.al':false,     'yedek.yukle':false,
        'kullanici.yonet':false,
      },
      onay:  { satinalma:false, uretim:true, ithalat:false, genel:false },
      ai:    { sorgu:true, rapor:false, oneri:true },
    },

    // ── BİLGİ İŞLEM ── sistem yönetimi; finans görmez
    bilgi_islem: {
      menu:  { stok:false, finans:false, satin_alma:false, uretim:false, ithalat:false, personel:false, sistem:true, yonetim:true },
      sayfa: {
        dashboard:true, stok:false, bom:false, 'urun-ailesi':false, seri:false,
        cariler:false, kasa:false, ceksenet:false,
        satinalma:false, uretim:false,
        ithalat:false,
        personel:false, varlik:false,
        bildirim:true, evrak:false, ai:false, 'ai-asistan':false, saglik:true,
        admin:true, ayarlar:true, sifirla:false,
      },
      veri: {
        maliyet:false, alis_fiyat:false, satis_fiyat:false, maas:false, sgk:false,
        kasa_bakiye:false, banka_bakiye:false, ithalat_fiyat:false, kar_marji:false, cari_bakiye:false,
      },
      islem: {
        'stok.ekle':false,    'stok.duzenle':false, 'stok.sil':false, 'stok.sayim':false,
        'cari.ekle':false,    'cari.duzenle':false, 'cari.sil':false,
        'sa.ekle':false,      'sa.onayla':false,    'sa.iptal':false,
        'uretim.baslat':false,'uretim.tamamla':false,'uretim.iptal':false,
        'ithalat.ekle':false, 'ithalat.duzenle':false,
        'kasa.giris':false,   'kasa.cikis':false,
        'banka.giris':false,  'banka.cikis':false,
        'onay.ver':false,     'onay.reddet':false,
        'yedek.al':true,      'yedek.yukle':true,
        'kullanici.yonet':true,
      },
      onay:  { satinalma:false, uretim:false, ithalat:false, genel:false },
      ai:    { sorgu:false, rapor:false, oneri:false },
    },

    // ── READONLY ── sadece dashboard + stok görüntüleme
    readonly: {
      menu:  { stok:true, finans:false, satin_alma:false, uretim:false, ithalat:false, personel:false, sistem:false, yonetim:false },
      sayfa: {
        dashboard:true, stok:true, bom:true, 'urun-ailesi':false, seri:false,
        cariler:false, kasa:false, ceksenet:false,
        satinalma:false, uretim:false, ithalat:false,
        personel:false, varlik:false,
        bildirim:true, evrak:false, ai:false, 'ai-asistan':false, saglik:false,
        admin:false, ayarlar:false, sifirla:false,
      },
      veri: {
        maliyet:false, alis_fiyat:false, satis_fiyat:false, maas:false, sgk:false,
        kasa_bakiye:false, banka_bakiye:false, ithalat_fiyat:false, kar_marji:false, cari_bakiye:false,
      },
      islem: _tumIslemler(false),
      onay:  { satinalma:false, uretim:false, ithalat:false, genel:false },
      ai:    { sorgu:false, rapor:false, oneri:false },
    },
  };

  // ──────────────────────────────────────────────────────────
  // YARDIMCI FONKSİYONLAR
  // ──────────────────────────────────────────────────────────
  function _tumSayfalar(deger) {
    return Object.fromEntries(Object.keys(SAYFA_DOSYA).map(k => [k, deger]));
  }

  function _tumIslemler(deger) {
    const ISLEMLER = [
      'stok.ekle','stok.duzenle','stok.sil','stok.sayim',
      'cari.ekle','cari.duzenle','cari.sil',
      'sa.ekle','sa.onayla','sa.iptal',
      'uretim.baslat','uretim.tamamla','uretim.iptal',
      'ithalat.ekle','ithalat.duzenle',
      'kasa.giris','kasa.cikis',
      'banka.giris','banka.cikis',
      'onay.ver','onay.reddet',
      'yedek.al','yedek.yukle',
      'kullanici.yonet',
    ];
    return Object.fromEntries(ISLEMLER.map(k => [k, deger]));
  }

  // Derin merge — override üstteki değerleri koyar
  function _merge(base, override) {
    if (!override) return base;
    const result = {};
    for (const key of Object.keys(base)) {
      if (typeof base[key] === 'object' && !Array.isArray(base[key])) {
        result[key] = _merge(base[key], override[key] || {});
      } else {
        result[key] = key in (override || {}) ? override[key] : base[key];
      }
    }
    // override'da base'de olmayan keyler de ekle
    for (const key of Object.keys(override || {})) {
      if (!(key in result)) result[key] = override[key];
    }
    return result;
  }

  // ──────────────────────────────────────────────────────────
  // OVERRIDE SAKLAMA (localStorage)
  // ──────────────────────────────────────────────────────────
  const LS_KEY = 'hm_izin_override';

  function _overrideAl(username) {
    try {
      const tum = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return tum[username] || null;
    } catch { return null; }
  }

  function _overrideKaydet(username, izinler) {
    try {
      const tum = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      tum[username] = izinler;
      localStorage.setItem(LS_KEY, JSON.stringify(tum));
      return true;
    } catch { return false; }
  }

  function _overrideSil(username) {
    try {
      const tum = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      delete tum[username];
      localStorage.setItem(LS_KEY, JSON.stringify(tum));
      return true;
    } catch { return false; }
  }

  // ──────────────────────────────────────────────────────────
  // AKTİF KULLANICI VE İZİN HESAPLAMASı
  // ──────────────────────────────────────────────────────────
  function _aktifIzinler() {
    // Aktif kullanıcıyı core.js'den al
    const session = (() => {
      try { return JSON.parse(localStorage.getItem('hm_session') || '{}'); } catch { return {}; }
    })();

    const username = session.username || null;
    const rol = session.rol || 'readonly';

    // Rol şablonu
    const sablon = SABLON[rol] || SABLON.readonly;

    // Per-user override
    const override = username ? _overrideAl(username) : null;

    // Merge: şablon + override
    return { username, rol, izin: _merge(sablon, override) };
  }

  // ──────────────────────────────────────────────────────────
  // IZIN ENGINE (public API)
  // ──────────────────────────────────────────────────────────
  const IZIN = {

    /** Mevcut kullanıcı ve iznini döndür */
    kim() {
      return _aktifIzinler();
    },

    /** Menü grubu görünür mü? */
    menu(id) {
      const { izin } = _aktifIzinler();
      return izin.menu[id] === true;
    },

    /** Sayfaya erişim var mı? */
    sayfa(id) {
      const { izin, rol } = _aktifIzinler();
      // Admin her yere girer
      if (rol === 'admin') return true;
      return izin.sayfa[id] === true;
    },

    /** Hassas veri görülebilir mi? */
    veri(id) {
      const { izin } = _aktifIzinler();
      return izin.veri[id] === true;
    },

    /** İşlem yapılabilir mi? */
    islem(id) {
      const { izin, rol } = _aktifIzinler();
      if (rol === 'admin') return true;
      return izin.islem[id] === true;
    },

    /** Onay yetkisi var mı? */
    onay(id) {
      const { izin, rol } = _aktifIzinler();
      if (rol === 'admin') return true;
      return izin.onay[id] === true;
    },

    /** AI özelliğine erişim var mı? */
    ai(id) {
      const { izin, rol } = _aktifIzinler();
      if (rol === 'admin') return true;
      // Özel AI izni
      if (id === 'sorgu' || id === 'rapor' || id === 'oneri') {
        return izin.ai[id] === true;
      }
      // Veri tipi sorgusu: veri izninden miras al
      return izin.veri[id] === true;
    },

    /**
     * Sayfa guard — sayfaya erişim yoksa dashboard'a yönlendir.
     * Her sayfanın en başına çağrılır.
     * @param {string} sayfaId  — 'kasa', 'uretim', ...
     */
    guard(sayfaId) {
      // Giriş yapmamışsa login sayfasına
      const session = (() => {
        try { return JSON.parse(localStorage.getItem('hm_session') || '{}'); } catch { return {}; }
      })();

      if (!session.username) {
        window.location.href = 'index.html';
        return false;
      }

      if (!IZIN.sayfa(sayfaId)) {
        // 403 bildirimi göster ve dashboard'a yönlendir
        const msg = `"${sayfaId}" sayfasına erişim yetkiniz yok.`;
        if (typeof toast === 'function') {
          toast(msg, 'error');
        } else {
          alert(msg);
        }
        window.location.href = 'dashboard.html';
        return false;
      }
      return true;
    },

    /**
     * Veri nesnesinden yetkisiz alanları maskele.
     * @param {Object|Array} data  — filtrelenecek veri
     * @param {string[]} alanlar   — veri tipi → alan adı eşlemesi
     * @returns {Object|Array}     — maskelenmiş kopya
     */
    filtrele(data, alanEslesme) {
      // alanEslesme = { maliyet: ['alis_fiyat','uretim_maliyeti',...], maas: ['brut_maas',...] }
      const gizliAlanlar = new Set();
      for (const [veriTipi, alanlar] of Object.entries(alanEslesme || {})) {
        if (!IZIN.veri(veriTipi)) {
          alanlar.forEach(a => gizliAlanlar.add(a));
        }
      }
      if (gizliAlanlar.size === 0) return data;

      function maskele(obj) {
        if (Array.isArray(obj)) return obj.map(maskele);
        if (obj && typeof obj === 'object') {
          const kopya = { ...obj };
          gizliAlanlar.forEach(a => {
            if (a in kopya) kopya[a] = '—';
          });
          return kopya;
        }
        return obj;
      }
      return maskele(data);
    },

    /**
     * AI context'ini temizle — kullanıcının göremediği veriyi çıkar.
     * @param {Object} ctx  — { urunler, stok, maliyetler, kasalar, ... }
     * @returns {Object}    — temizlenmiş context
     */
    aiFiltrele(ctx) {
      if (!ctx) return {};

      // AI sorgusuna izin yok
      if (!IZIN.ai('sorgu')) return {};

      const temiz = { ...ctx };

      // Maliyet verisi
      if (!IZIN.veri('maliyet')) {
        delete temiz.maliyetler;
        delete temiz.urun_maliyetler;
        if (temiz.urunler) {
          temiz.urunler = temiz.urunler.map(u => {
            const k = { ...u };
            delete k.alis_fiyat; delete k.uretim_maliyeti; delete k.toplam_maliyet;
            return k;
          });
        }
      }

      // Maas verisi
      if (!IZIN.veri('maas')) {
        delete temiz.personel_maliyetler;
        if (temiz.personel) {
          temiz.personel = temiz.personel.map(p => {
            const k = { ...p };
            delete k.brut_maas; delete k.net_maas; delete k.isveren_toplam;
            return k;
          });
        }
      }

      // Kasa bakiyeleri
      if (!IZIN.veri('kasa_bakiye')) {
        delete temiz.kasa_ozeti;
        if (temiz.kasalar) temiz.kasalar = temiz.kasalar.map(k => ({ ...k, bakiye: '—' }));
      }

      // Banka bakiyeleri
      if (!IZIN.veri('banka_bakiye')) {
        delete temiz.banka_ozeti;
        if (temiz.bankalar) temiz.bankalar = temiz.bankalar.map(b => ({ ...b, bakiye: '—' }));
      }

      // İthalat fiyatları
      if (!IZIN.veri('ithalat_fiyat')) {
        delete temiz.ithalat_maliyetleri;
        if (temiz.ithalat) {
          temiz.ithalat = temiz.ithalat.map(i => {
            const k = { ...i };
            delete k.toplam_maliyet; delete k.masraflar;
            return k;
          });
        }
      }

      // Kar marjı
      if (!IZIN.veri('kar_marji')) {
        delete temiz.kar_analizi;
        if (temiz.urunler) {
          temiz.urunler = temiz.urunler.map(u => {
            const k = { ...u };
            delete k.satis_fiyat; delete k.kar_marji; delete k.kar_orani;
            return k;
          });
        }
      }

      return temiz;
    },

    /**
     * Navigasyon menüsünü filtrele.
     * data-izin-menu="stok" attribute'una sahip elementleri gizle/göster.
     */
    navFiltrele() {
      document.querySelectorAll('[data-izin-menu]').forEach(el => {
        const menu = el.getAttribute('data-izin-menu');
        el.style.display = IZIN.menu(menu) ? '' : 'none';
      });

      document.querySelectorAll('[data-izin-sayfa]').forEach(el => {
        const sayfa = el.getAttribute('data-izin-sayfa');
        el.style.display = IZIN.sayfa(sayfa) ? '' : 'none';
      });
    },

    /**
     * İzin gerektiren butonları devre dışı bırak/gizle.
     * data-izin-islem="stok.ekle" attribute'una sahip elementleri kontrol et.
     */
    islemFiltrele() {
      document.querySelectorAll('[data-izin-islem]').forEach(el => {
        const islemId = el.getAttribute('data-izin-islem');
        if (!IZIN.islem(islemId)) {
          el.disabled = true;
          el.style.display = 'none';
        }
      });

      document.querySelectorAll('[data-izin-veri]').forEach(el => {
        const veriId = el.getAttribute('data-izin-veri');
        if (!IZIN.veri(veriId)) {
          el.textContent = '—';
          el.classList.add('izin-gizli');
        }
      });
    },

    // ──────────────────────────────────────────────────────────
    // YÖNETİM API (admin.html için)
    // ──────────────────────────────────────────────────────────

    /** Tüm rol şablonlarını döndür */
    sablonlar() {
      return Object.keys(SABLON).map(rol => ({
        rol,
        izin: SABLON[rol],
      }));
    },

    /** Kullanıcıya özel override kaydet */
    overrideKaydet(username, izinler) {
      return _overrideKaydet(username, izinler);
    },

    /** Kullanıcının override'ını al */
    overrideAl(username) {
      return _overrideAl(username);
    },

    /** Kullanıcının override'ını sil (role default'a döner) */
    overrideSil(username) {
      return _overrideSil(username);
    },

    /** Kullanıcının tam izin matrisini döndür (şablon + override merge) */
    kullaniciIzni(username, rol) {
      const sablon = SABLON[rol] || SABLON.readonly;
      const override = _overrideAl(username);
      return _merge(sablon, override);
    },

    /** Tüm sayfa ID'lerini döndür */
    sayfaIdleri() {
      return Object.keys(SAYFA_DOSYA);
    },

    /** Tüm menü gruplarını döndür */
    menuGruplari() {
      return Object.keys(MENU_SAYFALAR);
    },

    /** Tüm veri tiplerini döndür */
    veriTipleri() {
      return ['maliyet','alis_fiyat','satis_fiyat','maas','sgk',
              'kasa_bakiye','banka_bakiye','ithalat_fiyat','kar_marji','cari_bakiye'];
    },

    /** Tüm işlem izinlerini döndür */
    islemListesi() {
      return Object.keys(_tumIslemler(false));
    },
  };

  global.IZIN = IZIN;
  console.info('[IZIN] HurraMotor Permission Engine yüklendi.');

})(window);
