/**
 * HurraMotor ERP — İşlem Akış Motoru (Workflow Engine)  v1.0
 * ============================================================
 * İki katmanlı kontrol:
 *   1. İş akışı kuralı  — durum sırası + veri koşulları
 *   2. Yetki kuralı     — IZIN.islem() + IZIN.onay() + IZIN.ai()
 *
 * Public API:
 *   WF.canDo(type, entity, action)         → {ok, reason, blockedBy}
 *   WF.canView(type, entity, action)       → {ok, reason}
 *   WF.nextSteps(type, entity)             → [{label, action, ok, reason, urgent}]
 *   WF.badge(durum)                        → HTML
 *   WF.progress(type, entity)              → HTML
 *   WF.stepsPanel(type, entity)            → HTML
 *   WF.btn(label, fn, type, entity, action, cls, fnArg) → HTML (smart button)
 *   WF.guard(type, entity, action)         → boolean (alert+return false if blocked)
 *   WF.aiCheck(type, entity, action)       → {ok, reason}
 *   WF.toast(type, entity, afterAction)    → floating next-steps toast
 * ============================================================
 */
(function (global) {
  'use strict';

  // ── Durum etiketleri ────────────────────────────────────
  var DUR_LABEL = {
    taslak:         { txt: 'Taslak',          cls: 'wf-bek',  ico: '\u{1F4DD}' },
    onay_bekliyor:  { txt: 'Onay Bekliyor',   cls: 'wf-onay', ico: '⏳' },
    onaylandi:      { txt: 'Onaylandi',        cls: 'wf-haz',  ico: '✅' },
    kismi:          { txt: 'Kismi Teslim',     cls: 'wf-dev',  ico: '\u{1F4E6}' },
    tamamlandi:     { txt: 'Tamamlandi',       cls: 'wf-tam',  ico: '\u{1F3C1}' },
    iptal:          { txt: 'Iptal',            cls: 'wf-ipt',  ico: '✗' },
    planlandi:      { txt: 'Planlandi',        cls: 'wf-bek',  ico: '\u{1F4CB}' },
    hazirlaniyor:   { txt: 'Hazirlaniyor',     cls: 'wf-haz',  ico: '⚙️' },
    uretimde:       { txt: 'Uretimde',         cls: 'wf-dev',  ico: '\u{1F3ED}' },
    kalite_kontrol: { txt: 'Kalite Kontrol',   cls: 'wf-onay', ico: '\u{1F50D}' },
    gumrukte:       { txt: 'Gumrukte',         cls: 'wf-dev',  ico: '\u{1F6A2}' },
    bekliyor:       { txt: 'Bekliyor',         cls: 'wf-bek',  ico: '⏸' },
    blokeli:        { txt: 'Blokeli',          cls: 'wf-blk',  ico: '\u{1F534}' },
    stok:           { txt: 'Stokta',           cls: 'wf-tam',  ico: '✅' },
    rezerve:        { txt: 'Rezerve',          cls: 'wf-onay', ico: '\u{1F512}' },
    satis:          { txt: 'Satildi',          cls: 'wf-ipt',  ico: '\u{1F4E4}' },
    servis:         { txt: 'Serviste',         cls: 'wf-dev',  ico: '\u{1F527}' },
    aktif:          { txt: 'Aktif',            cls: 'wf-tam',  ico: '✅' },
    pasif:          { txt: 'Pasif',            cls: 'wf-ipt',  ico: '❌' },
  };

  // ── Akış tanımları ──────────────────────────────────────
  var FLOWS = {

    satinalma: {
      initial: 'taslak',
      terminal: ['tamamlandi', 'iptal'],
      steps: ['taslak', 'onay_bekliyor', 'onaylandi', 'kismi', 'tamamlandi'],
      transitions: [
        {
          action: 'onayaGonder',
          label: 'Onaya Gonder',
          from: ['taslak'],
          to: 'onay_bekliyor',
          izinKey: 'sa.ekle',
          onayKey: null,
          guards: [
            { fn: function(e){ return (e.kalemler||[]).length > 0; }, reason: 'En az bir kalem gerekli' },
            { fn: function(e){ return !!(e.cariId||e.tedBilgi); }, reason: 'Tedarikci secilmemis' },
          ],
          nextTips: ['Onaylayi siparis inceleyecek', 'Onay icin bildirim gonderildi'],
        },
        {
          action: 'onayla',
          label: 'Onayla',
          from: ['onay_bekliyor'],
          to: 'onaylandi',
          izinKey: 'sa.onayla',
          onayKey: 'satinalma',
          guards: [],
          nextTips: ['Tedarikçiye siparis bildirimi yapin', 'Mal kabul icin depoyu hazirlayin'],
          urgent: true,
        },
        {
          action: 'reddet',
          label: 'Reddet',
          from: ['onay_bekliyor'],
          to: 'taslak',
          izinKey: 'sa.onayla',
          onayKey: 'satinalma',
          guards: [],
          nextTips: ['Siparisi duzenleyerek tekrar onaya gonderin'],
        },
        {
          action: 'malKabul',
          label: 'Mal Kabul',
          from: ['onaylandi', 'kismi'],
          to: null,
          izinKey: 'stok.ekle',
          onayKey: null,
          guards: [],
          nextTips: ['Gelen mallari stok sayimina ekleyin', 'Seri no takibi varsa kaydedin'],
        },
        {
          action: 'revize',
          label: 'Revize Et',
          from: ['onaylandi'],
          to: 'onay_bekliyor',
          izinKey: 'sa.ekle',
          onayKey: null,
          guards: [
            { fn: function(e){ return !e.kilitli; }, reason: 'Siparis kilitli — revize edilemez' },
          ],
          nextTips: ['Degisiklikleri yapip tekrar onaya gonderin'],
        },
        {
          action: 'iptal',
          label: 'Iptal Et',
          from: ['taslak', 'onay_bekliyor'],
          to: 'iptal',
          izinKey: 'sa.iptal',
          onayKey: null,
          guards: [],
          nextTips: [],
        },
      ],
    },

    uretim: {
      initial: 'taslak',
      terminal: ['tamamlandi', 'iptal'],
      steps: ['taslak', 'planlandi', 'hazirlaniyor', 'uretimde', 'kalite_kontrol', 'tamamlandi'],
      transitions: [
        {
          action: 'planla',
          label: 'Planla',
          from: ['taslak'],
          to: 'planlandi',
          izinKey: 'uretim.baslat',
          onayKey: null,
          guards: [
            { fn: function(e){ return !!(e.mamulId||e.urunId); }, reason: 'Mamul secilmemis' },
            { fn: function(e){ return (e.adet||0) > 0; }, reason: 'Adet sifir olamaz' },
          ],
          nextTips: ['BOM listesini kontrol edin', 'Hammadde stoklarini dogrulayin'],
        },
        {
          action: 'hazirlamaAl',
          label: 'Hazirlamaya Al',
          from: ['taslak', 'planlandi'],
          to: 'hazirlaniyor',
          izinKey: 'uretim.baslat',
          onayKey: null,
          guards: [],
          nextTips: ['Hammaddeleri uretim hattina tasiyin', 'Is emrini acin'],
          urgent: true,
        },
        {
          action: 'uretimeAl',
          label: 'Uretime Al',
          from: ['hazirlaniyor', 'onaylandi'],
          to: 'uretimde',
          izinKey: 'uretim.baslat',
          onayKey: null,
          guards: [],
          nextTips: ['Uretim surecini baslatın', 'Ilerlemeyi gunluk kaydedin'],
          urgent: true,
        },
        {
          action: 'kaliteKontrol',
          label: 'Kalite Kontrole Al',
          from: ['uretimde'],
          to: 'kalite_kontrol',
          izinKey: 'uretim.tamamla',
          onayKey: null,
          guards: [],
          nextTips: ['Kalite testlerini tamamlayin', 'Hatali urunleri ayiklayin'],
          urgent: true,
        },
        {
          action: 'tamamla',
          label: 'Tamamla',
          from: ['kalite_kontrol'],
          to: 'tamamlandi',
          izinKey: 'uretim.tamamla',
          onayKey: 'uretim',
          guards: [],
          nextTips: ['Mamulleri stoka ekleyin', 'Seri numaralarini kaydedin'],
        },
        {
          action: 'iptal',
          label: 'Iptal Et',
          from: ['taslak', 'planlandi', 'hazirlaniyor'],
          to: 'iptal',
          izinKey: 'uretim.iptal',
          onayKey: null,
          guards: [],
          nextTips: [],
        },
      ],
    },

    ithalat: {
      initial: 'taslak',
      terminal: ['tamamlandi', 'iptal'],
      steps: ['taslak', 'onay_bekliyor', 'onaylandi', 'gumrukte', 'kismi', 'tamamlandi'],
      transitions: [
        {
          action: 'onayaGonder',
          label: 'Onaya Gonder',
          from: ['taslak'],
          to: 'onay_bekliyor',
          izinKey: 'ithalat.ekle',
          onayKey: null,
          guards: [
            { fn: function(e){ return (e.urunler||e.kalemler||[]).length > 0; }, reason: 'En az bir urun gerekli' },
          ],
          nextTips: ['Onaylayiciya bildirim gonderildi'],
        },
        {
          action: 'onayla',
          label: 'Onayla',
          from: ['onay_bekliyor'],
          to: 'onaylandi',
          izinKey: 'onay.ver',
          onayKey: 'ithalat',
          guards: [],
          nextTips: ['Tedarikciye proforma fatura isteyin', 'Nakliye takibini baslatın'],
          urgent: true,
        },
        {
          action: 'gumrugeGonder',
          label: "Gumruge Gonderildi",
          from: ['onaylandi'],
          to: 'gumrukte',
          izinKey: 'ithalat.duzenle',
          onayKey: null,
          guards: [],
          nextTips: ['Gumruk beyannamesi takibini yapin', 'Gumruk masraflarini kaydedin'],
        },
        {
          action: 'malKabul',
          label: 'Mal Kabul',
          from: ['gumrukte', 'onaylandi'],
          to: null,
          izinKey: 'stok.ekle',
          onayKey: null,
          guards: [],
          nextTips: ['Gelen mallari stoka ekleyin', 'Kalite kontrolu yapin'],
        },
        {
          action: 'iptal',
          label: 'Iptal Et',
          from: ['taslak', 'onay_bekliyor'],
          to: 'iptal',
          izinKey: 'ithalat.ekle',
          onayKey: null,
          guards: [],
          nextTips: [],
        },
      ],
    },

    stok: {
      initial: 'aktif',
      terminal: ['pasif'],
      steps: ['aktif', 'pasif'],
      transitions: [
        { action: 'ekle',     label: 'Stok Ekle', from: ['aktif'], to: 'aktif', izinKey: 'stok.ekle',    onayKey: null, guards: [], nextTips: ['Barkod etiketini yapistirin', 'Depo konumunu kaydedin'] },
        { action: 'duzenle', label: 'Duzenle',   from: ['aktif'], to: 'aktif', izinKey: 'stok.duzenle', onayKey: null, guards: [], nextTips: [] },
        { action: 'sayim',   label: 'Sayim Yap', from: ['aktif'], to: 'aktif', izinKey: 'stok.sayim',   onayKey: null, guards: [], nextTips: ['Sayim farklari varsa aciklama girin'] },
        { action: 'pasifYap',label: 'Pasife Al', from: ['aktif'], to: 'pasif', izinKey: 'stok.sil',     onayKey: null, guards: [], nextTips: [] },
      ],
    },

    cariler: {
      initial: 'aktif',
      terminal: ['pasif'],
      steps: ['aktif', 'pasif'],
      transitions: [
        { action: 'ekle',    label: 'Cari Ekle', from: ['aktif'], to: 'aktif', izinKey: 'cari.ekle',    onayKey: null, guards: [], nextTips: ['Odeme kosullarini belirleyin', 'Banka bilgilerini ekleyin'] },
        { action: 'duzenle',label: 'Duzenle',   from: ['aktif'], to: 'aktif', izinKey: 'cari.duzenle', onayKey: null, guards: [], nextTips: [] },
        { action: 'pasifYap',label: 'Pasife Al',from: ['aktif'], to: 'pasif', izinKey: 'cari.sil',     onayKey: null, guards: [], nextTips: [] },
      ],
    },
  };

  // ── CSS enjeksiyonu ─────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('wf-style')) return;
    var s = document.createElement('style');
    s.id = 'wf-style';
    s.textContent = [
      '.wf-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap}',
      '.wf-bek{background:#f1f5f9;color:#475569}.wf-onay{background:#fef9c3;color:#854d0e}',
      '.wf-haz{background:#dcfce7;color:#166534}.wf-dev{background:#dbeafe;color:#1e40af}',
      '.wf-tam{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}.wf-ipt{background:#fee2e2;color:#991b1b}',
      '.wf-blk{background:#fce7f3;color:#9d174d}',
      '.wf-progress{display:flex;align-items:center;margin:8px 0}',
      '.wf-ps{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;position:relative}',
      '.wf-ps:not(:last-child)::after{content:"";position:absolute;right:calc(-50% + 8px);top:8px;width:calc(100% - 16px);height:2px;background:#e2e8f0;z-index:0}',
      '.wf-ps.done::after{background:#22c55e}.wf-ps.active::after{background:#3b82f6}',
      '.wf-ps-dot{width:16px;height:16px;border-radius:50%;background:#e2e8f0;z-index:1;border:2px solid #fff;flex-shrink:0}',
      '.wf-ps.done .wf-ps-dot{background:#22c55e}.wf-ps.active .wf-ps-dot{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.2)}',
      '.wf-ps.terminal .wf-ps-dot{background:#ef4444}',
      '.wf-ps-lbl{font-size:9px;color:#94a3b8;text-align:center;line-height:1.2;max-width:60px}',
      '.wf-ps.active .wf-ps-lbl{color:#3b82f6;font-weight:700}.wf-ps.done .wf-ps-lbl{color:#22c55e}',
      '.wf-next-panel{background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;margin:10px 0}',
      '.wf-next-panel h4{margin:0 0 6px;font-size:12px;color:#0369a1;display:flex;align-items:center;gap:5px}',
      '.wf-next-step{display:flex;align-items:center;gap:6px;padding:5px 8px;background:#fff;border-radius:6px;margin:3px 0;font-size:12px;border:1px solid #e0f2fe}',
      '.wf-next-step.ok{color:#0f172a}.wf-next-step.blocked{color:#94a3b8}',
      '.wf-next-step .wf-ns-why{font-size:10px;color:#ef4444;margin-left:auto}',
      '.wf-next-step.urgent-step{border-left:3px solid #f59e0b!important}',
      '.wf-btn-wrap{position:relative;display:inline-flex}',
      '.wf-btn-blocked{opacity:.45;cursor:not-allowed!important;pointer-events:none}',
      '.wf-btn-tooltip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;font-size:11px;padding:6px 10px;border-radius:6px;white-space:normal;text-align:center;z-index:9999;pointer-events:none;opacity:0;transition:opacity .15s;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,.25);min-width:160px;max-width:240px}',
      '.wf-btn-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1e293b}',
      '.wf-btn-trigger{display:inline-flex}.wf-btn-trigger:hover .wf-btn-tooltip{opacity:1}',
      '.wf-toast{position:fixed;bottom:20px;right:20px;background:#fff;border:1px solid #bae6fd;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:14px 16px;max-width:320px;z-index:99999;animation:wf-slide-in .25s ease}',
      '.wf-toast-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700;font-size:13px;color:#0369a1}',
      '.wf-toast-close{cursor:pointer;color:#94a3b8;font-size:18px;line-height:1}',
      '.wf-toast-item{display:flex;align-items:flex-start;gap:6px;font-size:12px;padding:3px 0;color:#0f172a}',
      '.wf-toast-item::before{content:"→";color:#38bdf8;font-weight:700;flex-shrink:0}',
      '@keyframes wf-slide-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Yardımcı ────────────────────────────────────────────
  function _flow(type)  { return FLOWS[type] || null; }
  function _tr(type, action) { var f = _flow(type); return f ? (f.transitions.find(function(t){ return t.action===action; })||null) : null; }
  function _dur(e)     { return e.durum || e.status || 'taslak'; }
  function _hasIZIN()  { return typeof IZIN !== 'undefined'; }

  // ── canDo ────────────────────────────────────────────────
  function canDo(type, entity, action) {
    var f = _flow(type);
    if (!f) return { ok:false, reason:'Bilinmeyen modul: '+type, blockedBy:'state' };
    var tr = _tr(type, action);
    if (!tr) return { ok:false, reason:'Tanimsiz aksiyon: '+action, blockedBy:'state' };
    var dur = _dur(entity);
    if (tr.from.indexOf(dur) === -1) {
      var fromL = tr.from.map(function(x){ return (DUR_LABEL[x]||{txt:x}).txt; }).join(' veya ');
      return { ok:false, reason:'Bu islem icin kayit "'+fromL+'" durumunda olmali (su an: '+(DUR_LABEL[dur]||{txt:dur}).txt+')', blockedBy:'state' };
    }
    for (var i=0; i<(tr.guards||[]).length; i++) {
      var g = tr.guards[i];
      if (!g.fn(entity)) return { ok:false, reason:g.reason, blockedBy:'data' };
    }
    if (_hasIZIN()) {
      if (tr.izinKey && !IZIN.islem(tr.izinKey)) {
        var kim = IZIN.kim(); return { ok:false, reason:'Bu islem icin yetkiniz yok (rol: '+(kim.rol||'?')+')', blockedBy:'permission' };
      }
      if (tr.onayKey && !IZIN.onay(tr.onayKey)) {
        var kim2 = IZIN.kim(); return { ok:false, reason:'Onay yetkisi yok (rol: '+(kim2.rol||'?')+')', blockedBy:'permission' };
      }
    }
    return { ok:true, reason:null, blockedBy:null };
  }

  // ── canView ─────────────────────────────────────────────
  function canView(type, entity, action) {
    var tr = _tr(type, action);
    if (!tr) return { ok:false, reason:'Tanimsiz aksiyon' };
    if (_hasIZIN() && tr.izinKey && !IZIN.islem(tr.izinKey)) return { ok:false, reason:'Goruntuleme yetkiniz yok' };
    return { ok:true, reason:null };
  }

  // ── nextSteps ────────────────────────────────────────────
  function nextSteps(type, entity) {
    var f = _flow(type); if (!f) return [];
    var dur = _dur(entity);
    if (f.terminal.indexOf(dur) !== -1) return [];
    return f.transitions.filter(function(tr){ return tr.from.indexOf(dur) !== -1; }).map(function(tr){
      var r = canDo(type, entity, tr.action);
      return { label:tr.label, action:tr.action, ok:r.ok, reason:r.reason, blockedBy:r.blockedBy, urgent:!!tr.urgent, nextTips:tr.nextTips||[] };
    });
  }

  // ── aiCheck ─────────────────────────────────────────────
  function aiCheck(type, entity, action) {
    var base = canDo(type, entity, action);
    if (!base.ok) return base;
    if (_hasIZIN()) {
      if (!IZIN.ai('sorgu')) return { ok:false, reason:'AI sorgu yetkisi yok', blockedBy:'permission' };
      var tr = _tr(type, action);
      if (tr && tr.onayKey && !IZIN.ai('oneri')) return { ok:false, reason:'AI oneri/onay yetkisi yok', blockedBy:'permission' };
    }
    return { ok:true, reason:null, blockedBy:null };
  }

  // ── guard ────────────────────────────────────────────────
  function guard(type, entity, action) {
    var r = canDo(type, entity, action);
    if (!r.ok) {
      if (typeof toast === 'function') toast(r.reason, 'error');
      else alert('🔒 Islem engellendi\n\n'+r.reason);
      return false;
    }
    return true;
  }

  // ── badge ────────────────────────────────────────────────
  function badge(durum) {
    var d = DUR_LABEL[durum] || { txt:durum, cls:'wf-bek', ico:'•' };
    return '<span class="wf-badge '+d.cls+'">'+d.ico+' '+d.txt+'</span>';
  }

  // ── progress ─────────────────────────────────────────────
  function progress(type, entity) {
    var f = _flow(type); if (!f) return '';
    var dur = _dur(entity), steps = f.steps, curIdx = steps.indexOf(dur);
    var isTerminal = f.terminal.indexOf(dur) !== -1;
    return '<div class="wf-progress">'+steps.map(function(s,i){
      var done   = i < curIdx || (isTerminal && s === dur);
      var active = s === dur && !isTerminal;
      var term   = f.terminal.indexOf(s) !== -1;
      var cls    = done ? 'done' : (active ? 'active' : (term ? 'terminal' : ''));
      var lbl    = (DUR_LABEL[s]||{txt:s}).txt;
      return '<div class="wf-ps '+cls+'"><div class="wf-ps-dot"></div><div class="wf-ps-lbl">'+lbl+'</div></div>';
    }).join('')+'</div>';
  }

  // ── stepsPanel ───────────────────────────────────────────
  function stepsPanel(type, entity) {
    var steps = nextSteps(type, entity); if (!steps.length) return '';
    var items = steps.map(function(s){
      var cls    = s.ok ? 'ok' : 'blocked';
      var urgent = s.urgent ? 'urgent-step' : '';
      var ico    = s.ok ? '▶' : '⛔';
      var why    = s.ok ? '' : '<span class="wf-ns-why">🔒 '+(s.blockedBy==='permission'?'Yetki yok':'Uygun degil')+'</span>';
      return '<div class="wf-next-step '+cls+' '+urgent+'" title="'+(s.reason||'')+'"><span>'+ico+'</span><span>'+s.label+'</span>'+why+'</div>';
    }).join('');
    return '<div class="wf-next-panel"><h4>🗺 Sonraki Adimlar</h4>'+items+'</div>';
  }

  // ── btn ──────────────────────────────────────────────────
  function btn(label, fn, type, entity, action, cls, fnArg) {
    var r = canDo(type, entity, action);
    var arg = (fnArg !== undefined) ? fnArg : (entity.id || '');
    var argStr = (typeof arg === 'string') ? ("'"+arg+"'") : arg;
    if (r.ok) return '<button class="'+(cls||'btn btn-pri btn-sm')+'" onclick="'+fn+'('+argStr+')">'+label+'</button>';
    var byLabel = r.blockedBy==='permission' ? '🔐 Yetki eksik' : (r.blockedBy==='data' ? '📋 Veri eksik' : '⏱ Sira bekliyor');
    var tip = ('Neden pasif? '+byLabel+': '+r.reason).replace(/"/g,'&quot;');
    return '<span class="wf-btn-wrap wf-btn-trigger"><button class="'+(cls||'btn btn-pri btn-sm')+' wf-btn-blocked" disabled title="'+tip+'">🔒 '+label+'</button><div class="wf-btn-tooltip"><strong>Neden pasif?</strong><br>'+byLabel+'<br><em>'+r.reason+'</em></div></span>';
  }

  // ── toast ────────────────────────────────────────────────
  function wfToast(type, entity, afterAction) {
    var el = document.getElementById('wf-floating-toast');
    if (el) el.remove();
    var tips = [];
    if (afterAction) { var tr = _tr(type, afterAction); if (tr) tips = tr.nextTips||[]; }
    var okSteps = nextSteps(type, entity).filter(function(s){ return s.ok; });
    if (!tips.length && !okSteps.length) return;
    var tipsHtml = tips.map(function(t){ return '<div class="wf-toast-item">'+t+'</div>'; }).join('');
    var stepsHtml = okSteps.slice(0,3).map(function(s){ return '<div class="wf-toast-item" style="color:#3b82f6">'+s.label+'</div>'; }).join('');
    var div = document.createElement('div');
    div.id = 'wf-floating-toast'; div.className = 'wf-toast';
    div.innerHTML = '<div class="wf-toast-header">🗺 Sonraki Adimlar <span class="wf-toast-close" onclick="document.getElementById(\'wf-floating-toast\')?.remove()">\xD7</span></div>'+tipsHtml+(stepsHtml ? '<div style="margin-top:6px;font-size:10px;color:#94a3b8;font-weight:600">YAPILACAKLAR</div>'+stepsHtml : '');
    document.body.appendChild(div);
    setTimeout(function(){ if (div.parentNode) div.remove(); }, 8000);
  }

  // ── Init ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectCSS);
  } else {
    _injectCSS();
  }

  // ── Public API ───────────────────────────────────────────
  global.WF = { canDo:canDo, canView:canView, nextSteps:nextSteps, aiCheck:aiCheck, guard:guard, badge:badge, progress:progress, stepsPanel:stepsPanel, btn:btn, toast:wfToast, FLOWS:FLOWS, DUR_LABEL:DUR_LABEL };

})(window);
