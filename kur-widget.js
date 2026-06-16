/**
 * kur-widget.js — HurraMotor ERP Canlı Kur Göstergesi
 * v2.0 — Döviz.com (ExchangeRate-API) primary + TCMB fallback + window._KW_SOURCE
 *
 * Kaynak zinciri:
 *   1. open.er-api.com  → window._KW_SOURCE = 'Döviz.com'
 *   2. frankfurter.app  → window._KW_SOURCE = 'TCMB'
 *   3. hm_kur_cache     → window._KW_SOURCE = null (eski veri)
 *   4. hm_kur_gecmis    → window._KW_SOURCE = null
 *   5. "Kur alınamadı" uyarısı
 *
 * Form butonları window._KW_SOURCE ve window._KW_KUR kullanır.
 * kurKaynagi etiketleri: 'Döviz.com' | 'TCMB' | 'Banka' | 'Manuel' | 'Gümrük'
 * KRITIK: kurBul() fonksiyonuna dokunmaz — geçmiş işlem kurları etkilenmez.
 */

(function(global){
  'use strict';

  var KW_TS_KEY    = 'hm_kur_widget_ts';
  var KW_CACHE_KEY = 'hm_kur_cache';
  var KW_GECMIS_KEY= 'hm_kur_gecmis';

  /* ── Global export — form butonları okur ─────────────── */
  global._KW_SOURCE = null; // 'Döviz.com' | 'TCMB' | null
  global._KW_KUR    = null; // { USD, EUR, CNY }

  /* ── Yardımcılar ─────────────────────────────────────── */

  function _pad(n){ return n < 10 ? '0'+n : ''+n; }

  function _hhMM(ts){
    var d = new Date(ts || Date.now());
    return _pad(d.getHours())+':'+_pad(d.getMinutes());
  }

  function _withTimeout(promise, ms){
    return new Promise(function(resolve, reject){
      var t = setTimeout(function(){ reject(new Error('timeout')); }, ms);
      promise.then(
        function(v){ clearTimeout(t); resolve(v); },
        function(e){ clearTimeout(t); reject(e); }
      );
    });
  }

  function _kurCache(){
    try{ return JSON.parse(localStorage.getItem(KW_CACHE_KEY)||'null'); }
    catch(e){ return null; }
  }

  function _kurGecmis(){
    try{ return JSON.parse(localStorage.getItem(KW_GECMIS_KEY)||'[]'); }
    catch(e){ return []; }
  }

  /* ── Ağ katmanı 1: open.er-api.com → 'Döviz.com' ────── */

  function _fetchPrimary(){
    return _withTimeout(
      fetch('https://open.er-api.com/v6/latest/TRY').then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      }).then(function(d){
        if(d.result !== 'success') throw new Error('API hata');
        var rates = d.rates || {};
        return {
          USD: rates.USD ? parseFloat((1/rates.USD).toFixed(4)) : null,
          EUR: rates.EUR ? parseFloat((1/rates.EUR).toFixed(4)) : null,
          CNY: rates.CNY ? parseFloat((1/rates.CNY).toFixed(4)) : null
        };
      }),
      8000
    );
  }

  /* ── Ağ katmanı 2: frankfurter.app → 'TCMB' ─────────── */

  function _fetchFrankfurter(){
    return _withTimeout(
      fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,CNY').then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      }).then(function(d){
        var rates = d.rates || {};
        return {
          USD: rates.USD ? parseFloat((1/rates.USD).toFixed(4)) : null,
          EUR: rates.EUR ? parseFloat((1/rates.EUR).toFixed(4)) : null,
          CNY: rates.CNY ? parseFloat((1/rates.CNY).toFixed(4)) : null
        };
      }),
      8000
    );
  }

  /* ── Ağ fetch zinciri ────────────────────────────────── */

  function _fetchNetwork(){
    return _fetchPrimary().then(function(kur){
      if(kur && kur.USD) return { kur: kur, kaynak: 'Döviz.com', ts: Date.now() };
      throw new Error('boş');
    }).catch(function(){
      return _fetchFrankfurter().then(function(kur){
        if(kur && kur.USD) return { kur: kur, kaynak: 'TCMB', ts: Date.now() };
        throw new Error('boş');
      });
    });
  }

  /* ── Yerel fallback: cache → gecmis → stub ───────────── */

  function _resolveLocal(){
    var c = _kurCache();
    if(c && c.kur){
      var k = c.kur.KUR || c.kur;
      if(k && k.USD) return { kur: k, kaynak: 'Önbellek', ts: c.ts, isLocal: true };
    }

    var g = _kurGecmis();
    if(g.length > 0){
      var son = g[0];
      var kur4 = { USD: son.USD, EUR: son.EUR, CNY: son.CNY };
      if(son.tipler && son.tipler.TCMB){
        var t = son.tipler.TCMB;
        kur4 = { USD: t.USD||kur4.USD, EUR: t.EUR||kur4.EUR, CNY: t.CNY||kur4.CNY };
      }
      if(kur4.USD) return { kur: kur4, kaynak: 'Geçmiş', ts: null, isLocal: true };
    }

    if(global.KUR && global.KUR.USD){
      return { kur: global.KUR, kaynak: 'Varsayılan', ts: null, isLocal: true };
    }

    return null;
  }

  /* ── DOM güncelle ────────────────────────────────────── */

  function _render(result, refreshing){
    var strip = document.querySelector('.kur-strip');
    if(!strip) return;

    if(!result){
      ['usd','eur','cny'].forEach(function(p){
        var el = document.getElementById('kv-'+p);
        if(el) el.textContent = '—';
      });
      _setLabel('⚠️ Kur alınamadı', true, null);
      _ensureControls(strip);
      return;
    }

    var k = result.kur;
    [['usd',k.USD],['eur',k.EUR],['cny',k.CNY]].forEach(function(pair){
      var el = document.getElementById('kv-'+pair[0]);
      if(el){
        el.textContent = pair[1] ? pair[1].toFixed(4) : '—';
        el.style.opacity = refreshing ? '0.5' : '1';
      }
    });

    if(!result.isLocal){
      global._KW_SOURCE = result.kaynak;
      global._KW_KUR    = { USD: k.USD, EUR: k.EUR, CNY: k.CNY };
      if(global.KUR){
        if(k.USD) global.KUR.USD = k.USD;
        if(k.EUR) global.KUR.EUR = k.EUR;
        if(k.CNY) global.KUR.CNY = k.CNY;
      }
      try{
        localStorage.setItem(KW_CACHE_KEY, JSON.stringify({ kur: k, ts: result.ts }));
        if(result.ts) localStorage.setItem(KW_TS_KEY, String(result.ts));
      } catch(e){}
    } else {
      global._KW_SOURCE = null;
      global._KW_KUR    = { USD: k.USD, EUR: k.EUR, CNY: k.CNY };
    }

    _setLabel(null, false, result);
    _ensureControls(strip);
  }

  /* ── Durum etiketi ───────────────────────────────────── */

  function _setLabel(msg, isWarn, result){
    var el = document.getElementById('kw-ts');
    if(!el) return;

    if(msg){
      el.textContent = msg;
      el.style.color = isWarn ? 'var(--err,#e53)' : 'var(--t3)';
      el.title = '';
      return;
    }

    el.style.color = 'var(--t3)';
    var r = result || {};
    var label = '';

    if(r.isLocal){
      label = '⚠️ ' + (r.kaynak || 'Önbellek');
      el.title = 'İnternet bağlantısı yok — yerel veri gösteriliyor';
    } else {
      var tsVal = r.ts || parseInt(localStorage.getItem(KW_TS_KEY)||'0') || 0;
      if(tsVal) label = 'Son güncelleme: ' + _hhMM(tsVal);
      if(r.kaynak === 'Döviz.com'){
        label += (label ? ' · ' : '') + '📡 Döviz.com';
        el.title = 'Kaynak: open.er-api.com (canlı piyasa kuru)';
      } else if(r.kaynak){
        label += (label ? ' · ' : '') + r.kaynak;
        el.title = 'Kaynak: frankfurter.app (TCMB referans)';
      }
    }

    el.textContent = label;
  }

  /* ── Kontroller ──────────────────────────────────────── */

  function _ensureControls(strip){
    if(document.getElementById('kw-refresh')) return;

    var ts = document.createElement('span');
    ts.id = 'kw-ts';
    ts.style.cssText = 'font-size:10px;color:var(--t3);white-space:nowrap;align-self:center;padding-left:4px;cursor:default';

    var btn = document.createElement('button');
    btn.id = 'kw-refresh';
    btn.title = 'Döviz.com\'dan kurları güncelle';
    btn.textContent = '↻';
    btn.style.cssText = [
      'background:none','border:none','cursor:pointer',
      'color:var(--t3)','font-size:14px','padding:0 4px',
      'line-height:1','border-radius:var(--Rs,4px)',
      'transition:color .12s,transform .3s'
    ].join(';');
    btn.onmouseenter = function(){ this.style.color = 'var(--bl)'; };
    btn.onmouseleave = function(){ this.style.color = 'var(--t3)'; };
    btn.onclick = function(){ _refresh(); };

    strip.appendChild(ts);
    strip.appendChild(btn);
  }

  /* ── Spin ─────────────────────────────────────────────── */

  function _spin(on){
    var btn = document.getElementById('kw-refresh');
    if(!btn) return;
    btn.disabled = on;
    btn.style.transition = on ? 'transform .6s linear' : 'color .12s,transform .3s';
    btn.style.transform  = on ? 'rotate(360deg)' : 'rotate(0deg)';
  }

  /* ── Refresh ──────────────────────────────────────────── */

  function _refresh(){
    _spin(true);
    var local = _resolveLocal();
    if(local) _render(local, true);
    try{ localStorage.removeItem(KW_CACHE_KEY); } catch(e){}

    _fetchNetwork().then(function(result){
      _render(result, false);
      _spin(false);
    }).catch(function(){
      var fallback = _resolveLocal();
      _render(fallback || null, false);
      _spin(false);
    });
  }

  /* ── Init ─────────────────────────────────────────────── */

  function _init(){
    var local = _resolveLocal();
    _render(local, !!local);

    _fetchNetwork().then(function(result){
      _render(result, false);
    }).catch(function(){
      var fallback = _resolveLocal();
      if(!fallback) _render(null, false);
    });
  }

  /* ── CSS ──────────────────────────────────────────────── */

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
      '#kw-refresh:hover{color:var(--bl)!important}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Boot ─────────────────────────────────────────────── */

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ _injectCSS(); _init(); });
  } else {
    _injectCSS(); _init();
  }

})(window);
