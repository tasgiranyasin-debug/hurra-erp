/**
 * kur-widget.js — HurraMotor ERP Canlı Kur Göstergesi
 * v1.0 — Tüm sayfalarda sağ üstteki kur-strip'i canlı veriye bağlar
 *
 * Bağımlılıklar: core.js (KUR global, kurCek, ldKURG, KUR_CACHE_KEY)
 * KRITIK: kurBul() fonksiyonuna dokunmaz — geçmiş işlemler etkilenmez
 */

(function(global){
  'use strict';

  var KW_TS_KEY = 'hm_kur_widget_ts'; // Son güncelleme zamanı

  /* ── Yardımcılar ─────────────────────────────────────── */

  function _pad(n){ return n < 10 ? '0' + n : '' + n; }

  function _hhMM(ts){
    var d = new Date(ts || Date.now());
    return _pad(d.getHours()) + ':' + _pad(d.getMinutes());
  }

  function _kurCache(){
    try{ return JSON.parse(localStorage.getItem('hm_kur_cache') || 'null'); }
    catch(e){ return null; }
  }

  function _kurGecmis(){
    try{ return JSON.parse(localStorage.getItem('hm_kur_gecmis') || '[]'); }
    catch(e){ return []; }
  }

  /* ── Kur değerini al — 4 katmanlı fallback ──────────── */
  /*
   * 1. global KUR (core.js kurCek() başarıyla çalıştıysa güncel)
   * 2. hm_kur_cache  (15 dk önbellek)
   * 3. hm_kur_gecmis (son kayıt)
   * 4. null → "Kur alınamadı"
   */
  function _resolveKUR(){
    // Katman 1: global KUR object (core.js doldurmuşsa)
    if(global.KUR && global.KUR.USD && global.KUR.USD !== 32.5){
      // 32.5 default/stub değer — gerçek fetch olduysa farklı olur
      return { kur: global.KUR, kaynak: 'canli', ts: Date.now() };
    }

    // Katman 2: cache
    var c = _kurCache();
    if(c && c.kur){
      var k = c.kur.KUR || c.kur;
      if(k && k.USD) return { kur: k, kaynak: 'onbellek', ts: c.ts };
    }

    // Katman 3: gecmis kaydi
    var g = _kurGecmis();
    if(g.length > 0){
      var son = g[0]; // unshift ile ekleniyor → en güncel başta
      var kur3 = { USD: son.USD, EUR: son.EUR, CNY: son.CNY };
      if(son.tipler && son.tipler.TCMB){
        var t = son.tipler.TCMB;
        kur3 = { USD: t.USD || kur3.USD, EUR: t.EUR || kur3.EUR, CNY: t.CNY || kur3.CNY };
      }
      if(kur3.USD) return { kur: kur3, kaynak: 'gecmis', ts: null };
    }

    // Katman 4: global KUR stub (her halükarda)
    if(global.KUR && global.KUR.USD){
      return { kur: global.KUR, kaynak: 'varsayilan', ts: null };
    }

    return null;
  }

  /* ── DOM güncelle ────────────────────────────────────── */

  function _render(result, refreshing){
    var strip = document.querySelector('.kur-strip');
    if(!strip) return;

    if(!result){
      // Hiçbir kaynak yoksa — sadece "alınamadı" göster
      ['usd','eur','cny'].forEach(function(p){
        var el = document.getElementById('kv-' + p);
        if(el) el.textContent = 'Kur alınamadı';
        var de = document.getElementById('kd-' + p);
        if(de) de.textContent = '';
      });
      _setTimestamp(null);
      _ensureRefreshBtn(strip);
      return;
    }

    var k = result.kur;
    var pairs = [
      { id: 'usd', val: k.USD },
      { id: 'eur', val: k.EUR },
      { id: 'cny', val: k.CNY }
    ];

    pairs.forEach(function(p){
      var el = document.getElementById('kv-' + p.id);
      if(el){
        el.textContent = p.val ? p.val.toFixed(4) : '—';
        el.style.opacity = refreshing ? '0.5' : '1';
      }
      var de = document.getElementById('kd-' + p.id);
      if(de) de.textContent = ''; // delta göstergesi rezerv alan — şimdilik boş
    });

    var tsVal = result.ts || localStorage.getItem(KW_TS_KEY);
    _setTimestamp(tsVal ? parseInt(tsVal) : null, result.kaynak);
    if(result.ts) localStorage.setItem(KW_TS_KEY, result.ts);

    _ensureRefreshBtn(strip);
  }

  /* ── Zaman damgası ───────────────────────────────────── */

  function _setTimestamp(tsMs, kaynak){
    var el = document.getElementById('kw-ts');
    if(!el) return;
    if(!tsMs){
      el.textContent = kaynak === 'gecmis' ? 'Son kayıttan' : '';
      return;
    }
    var label = 'Son güncelleme: ' + _hhMM(tsMs);
    if(kaynak && kaynak !== 'canli') label += ' (' + kaynak + ')';
    el.textContent = label;
  }

  /* ── Refresh butonu + zaman etiketi ─────────────────── */

  function _ensureRefreshBtn(strip){
    if(document.getElementById('kw-refresh')) return; // zaten var

    // Zaman etiketi
    var ts = document.createElement('span');
    ts.id = 'kw-ts';
    ts.style.cssText = 'font-size:10px;color:var(--t3);white-space:nowrap;align-self:center;padding-left:4px';

    // Refresh butonu
    var btn = document.createElement('button');
    btn.id = 'kw-refresh';
    btn.title = 'Kurları güncelle';
    btn.textContent = '↻';
    btn.style.cssText = [
      'background:none',
      'border:none',
      'cursor:pointer',
      'color:var(--t3)',
      'font-size:14px',
      'padding:0 4px',
      'line-height:1',
      'border-radius:var(--Rs,4px)',
      'transition:color .12s,transform .3s'
    ].join(';');
    btn.onmouseenter = function(){ this.style.color = 'var(--bl)'; };
    btn.onmouseleave = function(){ this.style.color = 'var(--t3)'; };
    btn.onclick = function(){ _refresh(true); };

    strip.appendChild(ts);
    strip.appendChild(btn);
  }

  /* ── Spin animasyonu ─────────────────────────────────── */

  function _spin(on){
    var btn = document.getElementById('kw-refresh');
    if(!btn) return;
    btn.style.transform = on ? 'rotate(360deg)' : 'rotate(0deg)';
    btn.disabled = on;
    btn.style.transition = on ? 'transform .6s linear' : 'color .12s,transform .3s';
  }

  /* ── Güncelle ─────────────────────────────────────────── */

  function _refresh(forceNetwork){
    _spin(true);

    // Önce mevcut değerleri soluk göster
    _render(_resolveKUR(), true);

    // core.js kurCek varsa çağır (cache bypass için TTL'yi sıfırla)
    if(forceNetwork && typeof global.kurCek === 'function'){
      // Cache'i temizle — zorla yeni fetch
      try{ localStorage.removeItem('hm_kur_cache'); } catch(e){}
      global.kurCek().then(function(){
        _render(_resolveKUR(), false);
        _spin(false);
      }).catch(function(){
        _render(_resolveKUR(), false);
        _spin(false);
      });
    } else {
      // kurCek yoksa sadece mevcut değerleri göster
      setTimeout(function(){
        _render(_resolveKUR(), false);
        _spin(false);
      }, 300);
    }
  }

  /* ── Init ─────────────────────────────────────────────── */

  function _init(){
    // İlk render — anlık mevcut değer
    _render(_resolveKUR(), false);

    // core.js kurCek tamamlanana kadar bekle
    // kurCek() zaten core.js init'te çağrılıyor; resolve edince KUR güncellenmiş olur
    // Kısa bir delay ile tekrar render — çoğu zaman kurCek tamamlanmış olacak
    setTimeout(function(){
      _render(_resolveKUR(), false);
    }, 1500);

    // Uzun delay — yavaş ağ için fallback ikinci deneme
    setTimeout(function(){
      _render(_resolveKUR(), false);
    }, 5000);
  }

  /* ── CSS enjeksiyon ──────────────────────────────────── */

  function _injectCSS(){
    if(document.getElementById('kw-css')) return;
    var s = document.createElement('style');
    s.id = 'kw-css';
    s.textContent = [
      '.kur-strip{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}',
      '.ki{display:flex;align-items:center;gap:3px}',
      '.kl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}',
      '.kd{font-size:10px;color:var(--t3)}',
      '.kv{font-family:var(--mn,"JetBrains Mono",monospace);font-size:11px;font-weight:600;color:var(--t);transition:opacity .3s}',
      '#kw-refresh:hover{color:var(--bl)!important}',
      '@keyframes kw-spin{to{transform:rotate(360deg)}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── DOM hazır olunca başlat ─────────────────────────── */

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      _injectCSS();
      _init();
    });
  } else {
    _injectCSS();
    _init();
  }

})(window);
