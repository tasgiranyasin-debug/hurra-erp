/**
 * nav.js — HurraMotor ERP Global Sidebar Navigation
 * v1.0 — Mobile-first, config-driven, permission-aware
 */

/* ─────────────────────────────────────────────────────────
   MENU CONFIG — tek kaynak; eklemek için buraya satır yeter
───────────────────────────────────────────────────────── */
const MENU_CONFIG = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    href: 'dashboard.html',
    single: true,
    menuGroup: null
  },
  {
    id: 'operasyon',
    label: 'Operasyon',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/></svg>',
    menuGroup: 'operasyon',
    items: [
      { id: 'cariler',   href: 'cariler.html',   label: 'Cariler',        icon: '\u{1F465}', menuGroup: 'cariler' },
      { id: 'satinalma', href: 'satinalma.html', label: 'Satın Alma', icon: '\u{1F6D2}', menuGroup: 'satin_alma' },
      { id: 'ithalat',   href: 'ithalat.html',   label: 'İthalat',    icon: '\u{1F6A2}', menuGroup: 'ithalat' },
      { id: 'ceksenet',  href: 'ceksenet.html',  label: 'Çek / Senet', icon: '\u{1F4C4}', menuGroup: 'finans' },
      { id: 'seri',      href: 'seri.html',       label: 'Seri No / Lot',  icon: '\u{1F522}', menuGroup: 'stok' }
    ]
  },
  {
    id: 'finans',
    label: 'Finans',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    menuGroup: 'finans',
    items: [
      { id: 'kasa',  href: 'kasa.html',  label: 'Kasa',          icon: '\u{1F4B0}', menuGroup: 'finans' },
      { id: 'banka', href: 'banka.html', label: 'Banka',         icon: '\u{1F3E6}', menuGroup: 'finans' },
      { id: 'kur',   href: 'kur.html',   label: 'Kur Yönetimi', icon: '\u{1F4B1}', menuGroup: 'finans' },
      { id: 'kredi', href: 'kredi.html', label: 'Kredi & Borç', icon: '\u{1F4B3}', menuGroup: 'finans' },
      { id: 'nakit', href: 'nakit.html', label: 'Nakit Akışı', icon: '\u{1F4B5}', menuGroup: 'finans' }
    ]
  },
  {
    id: 'uretim',
    label: 'Üretim',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    menuGroup: 'uretim',
    items: [
      { id: 'uretim',      href: 'uretim.html',      label: 'Üretim Emirleri', icon: '\u{1F3ED}', menuGroup: 'uretim' },
      { id: 'bom',         href: 'bom.html',          label: 'Reçeteler (BOM)', icon: '\u{1F4CB}', menuGroup: 'uretim' },
      { id: 'urun-ailesi', href: 'urun-ailesi.html', label: 'Ürün Aileleri', icon: '\u{1F5C2}', menuGroup: 'uretim' }
    ]
  },
  {
    id: 'stok',
    label: 'Stok',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    menuGroup: 'stok',
    items: [
      { id: 'stok', href: 'stok.html', label: 'Stok Yönetimi', icon: '\u{1F4E6}', menuGroup: 'stok' }
    ]
  },
  {
    id: 'ik',
    label: 'İnsan Kaynakları',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    menuGroup: 'personel',
    items: [
      { id: 'personel', href: 'personel.html', label: 'Personel',  icon: '\u{1F464}', menuGroup: 'personel' },
      { id: 'varlik',   href: 'varlik.html',   label: 'Varlıklar', icon: '\u{1F3D7}', menuGroup: 'personel' }
    ]
  },
  {
    id: 'dokumanlar',
    label: 'Dokümanlar',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    menuGroup: 'sistem',
    items: [
      { id: 'evrak',    href: 'evrak.html',    label: 'Evrak',       icon: '\u{1F4C1}', menuGroup: 'sistem' },
      { id: 'bildirim', href: 'bildirim.html', label: 'Bildirimler', icon: '\u{1F514}', menuGroup: 'sistem' }
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    menuGroup: 'sistem',
    items: [
      { id: 'ai',         href: 'ai.html',         label: 'Global ERP AI', icon: '\u{1F916}', menuGroup: 'sistem' },
      { id: 'ai-asistan', href: 'ai-asistan.html', label: 'AI Asistan',    icon: '\u{1F9E0}', menuGroup: 'sistem' }
    ]
  },
  {
    id: 'yonetim',
    label: 'Yönetim',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>',
    menuGroup: 'yonetim',
    items: [
      { id: 'ayarlar', href: 'ayarlar.html', label: 'Ayarlar',         icon: '⚙️', menuGroup: 'yonetim' },
      { id: 'admin',   href: 'admin.html',   label: 'Yönetici Paneli', icon: '\u{1F6E1}', menuGroup: 'yonetim', adminOnly: true },
      { id: 'saglik',  href: 'saglik.html',  label: 'Sistem Sağlığı', icon: '❤️', menuGroup: 'sistem' }
    ]
  }
];

/* ─────────────────────────────────────────────────────────
   STATE KEY — hangi gruplar açık
───────────────────────────────────────────────────────── */
const NAV_STATE_KEY = 'hm_nav_open';

function _navGetOpen() {
  try { return JSON.parse(localStorage.getItem(NAV_STATE_KEY) || '{}'); }
  catch(e) { return {}; }
}

function _navSetOpen(groupId, open) {
  const s = _navGetOpen();
  if (open) s[groupId] = 1; else delete s[groupId];
  localStorage.setItem(NAV_STATE_KEY, JSON.stringify(s));
}

/* ─────────────────────────────────────────────────────────
   PERMISSION HELPERS
───────────────────────────────────────────────────────── */
function _navMenuVisible(group) {
  const curUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const isAdmin = curUser && curUser.role === 'admin';
  if (group.adminOnly && !isAdmin) return false;
  const izinAktif = typeof IZIN !== 'undefined';
  if (!izinAktif) return true;
  if (!group.menuGroup) return true;
  return IZIN.menu(group.menuGroup);
}

function _navPageVisible(item) {
  const curUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const isAdmin = curUser && curUser.role === 'admin';
  if (item.adminOnly && !isAdmin) return false;
  const izinAktif = typeof IZIN !== 'undefined';
  if (!izinAktif) return true;
  if (item.menuGroup && !IZIN.menu(item.menuGroup)) return false;
  return IZIN.sayfa(item.id);
}

/* ─────────────────────────────────────────────────────────
   RENDER SIDEBAR HTML
───────────────────────────────────────────────────────── */
function buildSidebarNav(pageId) {
  const openState = _navGetOpen();
  const chv = '<svg class="sb-nav-chv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  return MENU_CONFIG.map(function(group) {
    if (!_navMenuVisible(group)) return '';

    /* ── Single link (Dashboard) ── */
    if (group.single) {
      var active = group.id === pageId;
      return '<a href="' + group.href + '" class="sb-nav-item' + (active ? ' sb-nav-active' : '') + '">' +
        '<span class="sb-nav-icon">' + group.icon + '</span>' +
        '<span class="sb-nav-label">' + group.label + '</span>' +
        '</a>';
    }

    /* ── Group with children ── */
    var visItems = group.items.filter(function(i) { return _navPageVisible(i); });
    if (visItems.length === 0) return '';

    var isActive = visItems.some(function(i) { return i.id === pageId; });
    var isOpen = isActive || !!openState[group.id];

    var children = visItems.map(function(item) {
      var active = item.id === pageId;
      return '<a href="' + item.href + '" class="sb-nav-child' + (active ? ' sb-nav-active' : '') + '">' +
        '<span class="sb-nav-child-icon">' + item.icon + '</span>' +
        '<span class="sb-nav-label">' + item.label + '</span>' +
        '</a>';
    }).join('');

    return '<div class="sb-nav-group' + (isOpen ? ' open' : '') + '" data-group="' + group.id + '">' +
      '<button class="sb-nav-btn' + (isActive ? ' sb-nav-active' : '') + '" onclick="_navToggle(\'' + group.id + '\')">' +
        '<span class="sb-nav-icon">' + group.icon + '</span>' +
        '<span class="sb-nav-label">' + group.label + '</span>' +
        '<span class="sb-nav-chv-wrap">' + chv + '</span>' +
      '</button>' +
      '<div class="sb-nav-children">' + children + '</div>' +
      '</div>';
  }).join('');
}

/* ─────────────────────────────────────────────────────────
   ACCORDION TOGGLE
───────────────────────────────────────────────────────── */
function _navToggle(groupId) {
  var groupEl = document.querySelector('.sb-nav-group[data-group="' + groupId + '"]');
  if (!groupEl) return;
  var wasOpen = groupEl.classList.contains('open');
  groupEl.classList.toggle('open', !wasOpen);
  _navSetOpen(groupId, !wasOpen);
}

/* ─────────────────────────────────────────────────────────
   MOBILE HAMBURGER
───────────────────────────────────────────────────────── */
function toggleSidebar() {
  var sidebar   = document.getElementById('sidebar');
  var overlay   = document.getElementById('sidebar-overlay');
  var hamburger = document.getElementById('hamburger');
  if (!sidebar) return;
  var open = sidebar.classList.toggle('open');
  if (overlay)   overlay.classList.toggle('open', open);
  if (hamburger) hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('sb-body-lock', open);
}

function closeSidebar() {
  var sidebar   = document.getElementById('sidebar');
  var overlay   = document.getElementById('sidebar-overlay');
  var hamburger = document.getElementById('hamburger');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  if (overlay)   overlay.classList.remove('open');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sb-body-lock');
}

/* ─────────────────────────────────────────────────────────
   BRAND LOGO INJECTION
───────────────────────────────────────────────────────── */
function _navInjectLogo() {
  var bm = document.querySelector('.brand-mark');
  if (bm && !bm.querySelector('.brand-logo')) {
    var img = document.createElement('img');
    img.src = 'logo.svg';
    img.alt = 'Hurra Motor';
    img.className = 'brand-logo';
    bm.innerHTML = '';
    bm.appendChild(img);
  }
}

/* ─────────────────────────────────────────────────────────
   CLOSE SIDEBAR ON DESKTOP RESIZE
───────────────────────────────────────────────────────── */
function _navWatchResize() {
  window.addEventListener('resize', function() {
    if (window.innerWidth >= 1024) closeSidebar();
  }, { passive: true });
}

/* ─────────────────────────────────────────────────────────
   INIT — single entry point called by each page
───────────────────────────────────────────────────────── */

  // Kritik layout CSS'ini inline inject et (style.css cache'ini bypass eder)
  function _navInjectCSS() {
    if (document.getElementById('hm-nav-css')) return;
    var s = document.createElement('style');
    s.id = 'hm-nav-css';
    s.textContent = [
      /* ── Layout ── */
      'body.has-sidebar{display:flex!important;flex-direction:column!important;height:100vh!important;overflow:hidden!important}',
      '.app-layout{display:flex!important;flex:1;min-height:0;overflow:hidden}',
      '.sidebar{width:220px;min-width:220px;flex-shrink:0;height:100%;background:var(--s);border-right:1px solid var(--bd);overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;padding:8px 0 16px;scrollbar-width:thin;scrollbar-color:var(--bd) transparent;transition:transform .22s cubic-bezier(.4,0,.2,1)}',
      '.main-content{flex:1;overflow-y:auto;overflow-x:hidden;min-width:0}',
      '.sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:399;opacity:0;transition:opacity .22s}',
      '.sidebar-overlay.open{opacity:1}',
      /* ── Hamburger ── */
      '.hamburger{display:none;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:var(--Rs);background:none;color:var(--t);font-size:20px;cursor:pointer;flex-shrink:0;transition:background .12s}',
      '.hamburger:hover{background:var(--s2)}',
      /* ── Nav items ── */
      '#main-nav,#nav-root{display:flex;flex-direction:column;gap:1px;padding:0 8px}',
      '.sb-nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--Rs);font-size:13px;font-weight:500;color:var(--t2);text-decoration:none;transition:background .12s,color .12s;white-space:nowrap;overflow:hidden}',
      '.sb-nav-item:hover,.sb-nav-item:hover{background:var(--s2);color:var(--t);text-decoration:none}',
      '.sb-nav-item.sb-nav-active{background:var(--bld);color:var(--bl);font-weight:600}',
      /* ── Group button ── */
      '.sb-nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:none;border-radius:var(--Rs);background:none;font-family:var(--fn);font-size:13px;font-weight:500;color:var(--t2);cursor:pointer;text-align:left;transition:background .12s,color .12s;white-space:nowrap;overflow:hidden}',
      '.sb-nav-btn:hover{background:var(--s2);color:var(--t)}',
      '.sb-nav-btn.sb-nav-active{color:var(--bl);font-weight:600}',
      '.sb-nav-group.open .sb-nav-btn{color:var(--t)}',
      /* ── Chevron ── */
      '.sb-nav-chv-wrap{margin-left:auto;display:flex;align-items:center;opacity:.5;flex-shrink:0}',
      '.sb-nav-chv{transition:transform .18s}',
      '.sb-nav-group.open .sb-nav-chv{transform:rotate(180deg)}',
      '.sb-nav-group.open .sb-nav-chv-wrap{opacity:1}',
      /* ── Icons ── */
      '.sb-nav-icon{display:flex;align-items:center;justify-content:center;width:18px;flex-shrink:0;opacity:.7}',
      '.sb-nav-btn:hover .sb-nav-icon,.sb-nav-item:hover .sb-nav-icon,.sb-nav-active .sb-nav-icon{opacity:1}',
      /* ── Children accordion ── */
      '.sb-nav-children{display:flex;flex-direction:column;gap:1px;max-height:0;overflow:hidden;transition:max-height .22s cubic-bezier(.4,0,.2,1),padding .18s;padding:0 0 0 4px}',
      '.sb-nav-group.open .sb-nav-children{max-height:500px;padding:2px 0 4px 4px}',
      '.sb-nav-child{display:flex;align-items:center;gap:9px;padding:6px 10px 6px 8px;border-radius:var(--Rs);font-size:12.5px;font-weight:400;color:var(--t2);text-decoration:none;transition:background .1s,color .1s;white-space:nowrap;overflow:hidden}',
      '.sb-nav-child:hover{background:var(--s2);color:var(--t);text-decoration:none}',
      '.sb-nav-child.sb-nav-active{background:var(--bld);color:var(--bl);font-weight:600}',
      '.sb-nav-child-icon{width:16px;text-align:center;flex-shrink:0;font-size:13px}',
      /* ── Mobile ── */
      '@media(max-width:1023px){',
        '.hamburger{display:flex!important}',
        '.sidebar{position:fixed;top:0;left:0;height:100vh;z-index:400;transform:translateX(-100%);box-shadow:4px 0 24px rgba(0,0,0,.12);padding-top:56px}',
        '.sidebar.open{transform:translateX(0)}',
        '.sidebar-overlay{display:block;pointer-events:none}',
        '.sidebar-overlay.open{pointer-events:auto}',
        'body.sb-body-lock{overflow:hidden}',
      '}',
      '@media(min-width:1024px){',
        '.hamburger{display:none!important}',
        '.sidebar{transform:none!important;position:relative!important}',
        '.sidebar-overlay{display:none!important}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

function initNav(pageId) {
  function _init() {
    _navInjectCSS();
    var navEl = document.getElementById('main-nav') || document.getElementById('nav-root');
    if (navEl) {
      navEl.innerHTML = buildSidebarNav(pageId);
    }
    _navInjectLogo();
    _navWatchResize();
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}
