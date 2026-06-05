// ══════════════════════════════════════════════════════════════
// HURRA ERP — PDF CORE v1.0
// Tüm PDF belgelerinin ortak tasarım sistemi
// ══════════════════════════════════════════════════════════════

const PDF_VERSION = 'Hurra ERP v1.0';

// ── Renk paleti ──
const PDF_COLORS = {
  primary:   '#1d4ed8',   // Hurra Mavisi
  primaryBg: '#dbeafe',   // Mavi zemin
  primaryLt: '#eff6ff',   // Çok açık mavi
  dark:      '#0f172a',   // Başlık metni
  mid:       '#334155',   // Normal metin
  dim:       '#64748b',   // Soluk metin
  muted:     '#94a3b8',   // Çok soluk
  border:    '#e2e8f0',   // Tablo border
  borderMd:  '#cbd5e1',   // Orta border
  zemin:     '#f8fafc',   // Tablo zemin
  success:   '#166534',
  successBg: '#dcfce7',
  warning:   '#854d0e',
  warningBg: '#fef9c3',
  danger:    '#991b1b',
  dangerBg:  '#fee2e2',
  purple:    '#6b21a8',
  purpleBg:  '#f3e8ff',
};

// ── Ortak CSS ──
const PDF_BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Inter', Arial, 'Helvetica Neue', sans-serif;
    font-size: 11px;
    color: ${PDF_COLORS.mid};
    background: #fff;
    padding: 32px 36px;
    max-width: 794px;
    margin: 0 auto;
  }
  /* Tipografi */
  h1 { font-size:22px; font-weight:800; color:${PDF_COLORS.dark}; letter-spacing:-.02em; }
  h2 { font-size:14px; font-weight:700; color:${PDF_COLORS.dark}; margin-bottom:8px; }
  h3 { font-size:12px; font-weight:600; color:${PDF_COLORS.dim}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
  strong { font-weight:600; color:${PDF_COLORS.dark}; }
  .muted { color:${PDF_COLORS.muted}; }
  .dim   { color:${PDF_COLORS.dim}; }
  .mono  { font-family:'JetBrains Mono','Courier New',monospace; }
  /* Layout */
  .flex  { display:flex; }
  .flex-between { display:flex; justify-content:space-between; align-items:flex-start; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  /* Kutular */
  .box {
    border:1px solid ${PDF_COLORS.border};
    border-radius:6px;
    padding:12px 14px;
    margin-bottom:14px;
  }
  .box-blue {
    border:1px solid #bfdbfe;
    border-radius:6px;
    padding:12px 14px;
    background:${PDF_COLORS.primaryLt};
    margin-bottom:14px;
  }
  .box-header {
    background:${PDF_COLORS.zemin};
    border-bottom:1px solid ${PDF_COLORS.border};
    padding:8px 14px;
    border-radius:6px 6px 0 0;
    font-size:9px;
    font-weight:700;
    color:${PDF_COLORS.dim};
    text-transform:uppercase;
    letter-spacing:.08em;
  }
  /* Tablolar */
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  thead tr { background:${PDF_COLORS.primary}; }
  thead th {
    padding:7px 10px;
    font-size:9.5px;
    font-weight:700;
    color:#fff;
    text-align:left;
    letter-spacing:.04em;
  }
  tbody tr:nth-child(even) { background:${PDF_COLORS.zemin}; }
  tbody tr:hover { background:#f0f9ff; }
  tbody td {
    padding:6px 10px;
    border-bottom:1px solid ${PDF_COLORS.border};
    vertical-align:middle;
  }
  .num { text-align:right; font-family:'JetBrains Mono','Courier New',monospace; }
  .center { text-align:center; }
  tfoot tr { background:${PDF_COLORS.zemin}; }
  tfoot td { padding:6px 10px; font-weight:600; border-top:2px solid ${PDF_COLORS.borderMd}; }
  /* Rozetler */
  .badge {
    display:inline-block;
    padding:2px 7px;
    border-radius:99px;
    font-size:9px;
    font-weight:700;
  }
  .badge-blue   { background:${PDF_COLORS.primaryBg}; color:${PDF_COLORS.primary}; }
  .badge-green  { background:${PDF_COLORS.successBg}; color:${PDF_COLORS.success}; }
  .badge-yellow { background:${PDF_COLORS.warningBg}; color:${PDF_COLORS.warning}; }
  .badge-red    { background:${PDF_COLORS.dangerBg};  color:${PDF_COLORS.danger}; }
  .badge-purple { background:${PDF_COLORS.purpleBg};  color:${PDF_COLORS.purple}; }
  .badge-gray   { background:#f3f4f6; color:#374151; }
  /* Bilgi satırı */
  .info-row {
    display:flex;
    justify-content:space-between;
    padding:4px 0;
    border-bottom:1px solid ${PDF_COLORS.border};
    font-size:11px;
  }
  .info-row:last-child { border-bottom:none; }
  .info-lbl { color:${PDF_COLORS.dim}; }
  .info-val { font-weight:600; color:${PDF_COLORS.dark}; text-align:right; }
  /* Toplam kutusu */
  .total-box {
    border:2px solid ${PDF_COLORS.primary};
    border-radius:6px;
    overflow:hidden;
    width:300px;
    margin-left:auto;
    margin-bottom:14px;
  }
  .total-row {
    display:flex;
    justify-content:space-between;
    padding:6px 12px;
    border-bottom:1px solid ${PDF_COLORS.border};
    font-size:11px;
  }
  .total-row:last-child { border-bottom:none; }
  .total-grand {
    background:${PDF_COLORS.primary};
    color:#fff;
    font-weight:700;
    font-size:13px;
    padding:8px 12px;
    display:flex;
    justify-content:space-between;
  }
  /* İmza alanı */
  .sign-row {
    display:grid;
    gap:32px;
    margin-top:32px;
    padding-top:12px;
    border-top:1px solid ${PDF_COLORS.border};
  }
  .sign-box { text-align:center; }
  .sign-line {
    border-top:1px solid ${PDF_COLORS.dark};
    margin-bottom:5px;
    margin-top:40px;
  }
  .sign-lbl { font-size:10px; color:${PDF_COLORS.dim}; }
  /* Ayırıcı */
  .divider {
    border:none;
    border-top:1px solid ${PDF_COLORS.border};
    margin:14px 0;
  }
  .divider-bold {
    border:none;
    border-top:2px solid ${PDF_COLORS.primary};
    margin:14px 0;
  }
  @media print {
    body { padding:12px 16px; }
    .no-print { display:none; }
  }
`;

// ── Header ─────────────────────────────────────────────────
function pdfHeader(docTitle, docNo, docDate, statusBadge=''){
  const marka = (typeof firmaMarka === 'function') ? firmaMarka() : 'HURRA';
  const unvan = (typeof firmaUnvan === 'function') ? firmaUnvan() : 'Hurra Motor';
  const logoData = localStorage.getItem('hm_logo');
  const logoHTML = logoData
    ? `<img src="${logoData}" style="height:36px;object-fit:contain;margin-bottom:4px">`
    : `<div style="font-size:26px;font-weight:900;color:${PDF_COLORS.primary};letter-spacing:-.03em;line-height:1">${marka}</div>`;
  const slogan = (typeof getAy === 'function') ? (getAy('slogan')||'') : '';

  return `
  <div class="flex-between" style="margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid ${PDF_COLORS.primary}">
    <div>
      ${logoHTML}
      ${slogan ? `<div style="font-size:9px;color:${PDF_COLORS.dim};margin-top:2px;letter-spacing:.05em">${slogan}</div>` : ''}
      <div style="font-size:9px;color:${PDF_COLORS.muted};margin-top:6px">${unvan}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;font-weight:700;color:${PDF_COLORS.dim};text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">${docTitle}</div>
      <div style="font-size:20px;font-weight:800;color:${PDF_COLORS.dark};font-family:'JetBrains Mono','Courier New',monospace;letter-spacing:-.01em">${docNo}</div>
      ${docDate ? `<div style="font-size:10px;color:${PDF_COLORS.dim};margin-top:3px">${docDate}</div>` : ''}
      ${statusBadge ? `<div style="margin-top:6px">${statusBadge}</div>` : ''}
    </div>
  </div>`;
}

// ── Footer ──────────────────────────────────────────────────
function pdfFooter(extra=''){
  const unvan = (typeof firmaUnvan === 'function') ? firmaUnvan() : 'Hurra Motor';
  const tarih = new Date().toLocaleDateString('tr-TR', {day:'2-digit',month:'long',year:'numeric'});
  const saat  = new Date().toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
  return `
  <div style="margin-top:28px;padding-top:10px;border-top:1px solid ${PDF_COLORS.border};
    display:flex;justify-content:space-between;align-items:flex-end;font-size:9px;color:${PDF_COLORS.muted}">
    <div>${unvan}</div>
    <div style="text-align:center">${extra}</div>
    <div style="text-align:right">${tarih} ${saat} · ${PDF_VERSION}</div>
  </div>`;
}

// ── Pencere aç & yazdır ─────────────────────────────────────
function pdfOpen(html, title='Belge'){
  const full = `<!DOCTYPE html><html lang="tr"><head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${PDF_BASE_CSS}</style>
  </head><body>
  ${html}
  <script>
    // Fontlar yüklenince yazdır
    if(document.fonts){
      document.fonts.ready.then(()=>{
        setTimeout(()=>window.print(), 300);
      });
    } else {
      setTimeout(()=>window.print(), 1000);
    }
  <\/script>
  </body></html>`;
  const w = window.open('','_blank','width=960,height=800,scrollbars=yes');
  if(!w){ alert('Popup engellendi. Tarayıcı izinlerini kontrol edin.'); return; }
  w.document.write(full);
  w.document.close();
}

// ── Yardımcı: bilgi kutusu ──────────────────────────────────
function pdfInfoBox(baslik, satirlar){
  return `<div class="box">
    <div style="font-size:9px;font-weight:700;color:${PDF_COLORS.primary};text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${PDF_COLORS.border}">${baslik}</div>
    ${satirlar.map(([lbl,val])=>
      val ? `<div class="info-row"><span class="info-lbl">${lbl}</span><span class="info-val">${val}</span></div>` : ''
    ).filter(Boolean).join('')}
  </div>`;
}

// ── Yardımcı: toplam kutusu ─────────────────────────────────
function pdfTotalBox(kalemler, grandLbl, grandVal){
  return `<div class="total-box">
    ${kalemler.map(([lbl,val,bold])=>
      `<div class="total-row" ${bold?'style="font-weight:600"':''}>
        <span>${lbl}</span>
        <span class="mono">${val}</span>
      </div>`
    ).join('')}
    <div class="total-grand">
      <span>${grandLbl}</span>
      <span class="mono">${grandVal}</span>
    </div>
  </div>`;
}

// ── Yardımcı: imza satırı ───────────────────────────────────
function pdfSignRow(imzalar){
  return `<div class="sign-row" style="grid-template-columns:repeat(${imzalar.length},1fr)">
    ${imzalar.map(lbl=>`<div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-lbl">${lbl}</div>
    </div>`).join('')}
  </div>`;
}
