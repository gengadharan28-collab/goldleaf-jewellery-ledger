/* Unified Retail Stock & Tagging Module:
 * Brings Lot Entry, Tagging, Sold Tags, Issue/Receipt/Metal/Stock Journal Vouchers,
 * 5 Stock Verification workflows (By Group, By Product, By Counter, RFID, RFID Audit),
 * 4 Reorder workflows (Entry By Weight, Entry By Size, Entry By Default, Weight Range),
 * 4 Gift Item workflows (Gift Item, Gift Purchase Item, Gift Item Lot Entry, Gift Item Tagging),
 * and Opening Stock under ONE single Stock & Tagging roof.
 */
const RV_TABS = [
  ['group-list','By Product Group'],
  ['group-create','Product Group Create'],
  ['product-list','By Product'],
  ['product-create','Product Create'],
  ['counter-list','By Counter'],
  ['counter-create','Counter Create'],
  ['rfid-list','RFID Verification'],
  ['rfid-audit','RFID Audit']
];

const RV_ROOF_SECTIONS = [
  {
    heading: 'Tagging & Movement',
    items: [
      ['lot-entry', 'Lot Entry'],
      ['tagging', 'Tagging'],
      ['sold', 'Sold Tags']
    ]
  },
  {
    heading: 'Vouchers',
    items: [
      ['issue-voucher', 'Issue Voucher'],
      ['receipt-voucher', 'Receipt Voucher'],
      ['metal-voucher', 'Metal Voucher'],
      ['stock-journal', 'Stock Journal']
    ]
  },
  {
    heading: 'Verification',
    items: [
      ['verify-group', 'By Product Group'],
      ['verify-product', 'By Product'],
      ['verify-counter', 'By Counter'],
      ['verify-rfid', 'RFID Stock Verification'],
      ['verify-audit', 'RFID Verification Audit']
    ]
  },
  {
    heading: 'Re-order',
    items: [
      ['reorder-weight', 'Entry By Weight'],
      ['reorder-size', 'Entry By Size'],
      ['reorder-default', 'Entry By Default'],
      ['weight-range', 'Weight Range']
    ]
  },
  {
    heading: 'Gift Items & Opening',
    items: [
      ['gift-item', 'Gift Item'],
      ['gift-purchase', 'Gift Purchase Item'],
      ['gift-lot', 'Gift Item Lot Entry'],
      ['gift-tagging', 'Gift Item Tagging'],
      ['opening-stock', 'Opening Stock']
    ]
  }
];

let rvTab = 'group-list', rvDraft = null, rvSearch = '', rvDate = '', rvRfidFrom = '', rvRfidTo = '';
let rvStockPage = 'tagging';
let rvTagTab = 'tagging', rvSoldSearch = '', rvSoldDate = '';
let rvTagShowCreate = false, rvTagListSearch = '', rvTagListFrom = '', rvTagListTo = '', rvTagListGroup = '', rvTagListMetal = '', rvTagListStatus = '', rvTagHiddenCols = new Set(['Di.Carat','Di.Pcs','Reference 1']), rvSelectedTagIds = new Set();
let rvVoucherState = { showForm: false, editId: '', search: '', from: '', to: '', metal: '', showCancel: false, detailMode: false, hiddenCols: new Set() };
let rvReorderState = { showForm: false, editId: '', search: '', group: '' };
let rvGiftState = { showForm: false, editId: '', search: '', from: '', to: '', prefillLotId: '' };

const rvToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const rvCustomDocs = kind => (db.retailDocuments || []).filter(d => d && (d.kind === kind || d.type === kind));
const rvRows = () => rvCustomDocs('retail-stock-verification');
const rvTags = () => rcDocs('retail-tagging').filter(t => (t.status || 'In stock') === 'In stock');
const rvNum = x => Number(x) || 0;
const rvWeight = t => rvNum(t.grossWeight || t.weight);
const rvQty = t => rvNum(t.pieces) || 1;
const rvStats = a => ({ tags: a.length, qty: a.reduce((s, t) => s + rvQty(t), 0), weight: a.reduce((s, t) => s + rvWeight(t), 0) });
const rvF = x => rvNum(x).toFixed(3);
const rvDateText = x => String(x || '').slice(0, 10);

function rvProductGroups() {
  return [...new Set([...rvCustomDocs('retail-product-group').map(x => x.name), ...rcDocs('retail-product').map(x => x.group), ...rcDocs('retail-tagging').map(x => x.group)].filter(Boolean))].sort();
}
function rvProducts(group) {
  return [...new Set([...rcDocs('retail-product').filter(x => !group || x.group === group).map(x => x.name), ...rcDocs('retail-tagging').filter(x => !group || x.group === group).map(x => x.product)].filter(Boolean))].sort();
}
function rvCounters() {
  const fromMasters = rvCustomDocs('retail-master-item').filter(m => m.masterCat === 'Branches & Counters').map(m => m.name);
  return [...new Set([...fromMasters, ...rcDocs('retail-tagging').map(x => x.counter || x.location)].filter(Boolean))].sort();
}
function rvOptions(a, selected = '', placeholder = 'Select') {
  return '<option value="">' + placeholder + '</option>' + a.map(x => '<option value="' + esc(x) + '" ' + (String(x) === String(selected) ? 'selected' : '') + '>' + esc(x) + '</option>').join('');
}
function rvCsvDownload(filename, lines) {
  const csv = lines.map(a => a.map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function rvSaveCustomDoc(kind, row, msg) {
  if (!Array.isArray(db.retailDocuments)) db.retailDocuments = [];
  const now = new Date().toISOString();
  const clean = Object.assign({}, row);
  if (!clean.id) delete clean.id;
  const saved = Object.assign({ id: crypto.randomUUID(), type: kind, accountType: 'customer', createdAt: row.createdAt || now }, clean, { type: kind, updatedAt: now });
  if (typeof RC_SQL_KINDS !== 'undefined' && RC_SQL_KINDS.has(kind)) saved.kind = kind;
  else delete saved.kind;
  const i = db.retailDocuments.findIndex(x => x && x.id === saved.id);
  if (i < 0) db.retailDocuments.unshift(saved); else db.retailDocuments[i] = saved;
  const p = save();
  rvRefreshStockHub();
  if (typeof rcSaveStatus === 'function') rcSaveStatus(p, msg); else say(msg + ' saved.');
  return saved;
}
window.rvDeleteCustomDoc = function(id, label = 'Record') {
  if (!confirm('Delete this ' + label.toLowerCase() + '?')) return;
  if (!Array.isArray(db.deletedRetailDocumentIds)) db.deletedRetailDocumentIds = [];
  if (id && !db.deletedRetailDocumentIds.includes(String(id))) db.deletedRetailDocumentIds.push(String(id));
  db.retailDocuments = (db.retailDocuments || []).filter(x => x && x.id !== id);
  save();
  rvRefreshStockHub();
  say(label + ' deleted.');
};

// ======================== TAG INVENTORY LISTS PANEL (INSIDE TAGGING) ========================
window.rvToggleSelectTag = function(id, checked) {
  if (checked) rvSelectedTagIds.add(id); else rvSelectedTagIds.delete(id);
  const btn = document.getElementById('rvBulkPrintBtn');
  if (btn) btn.textContent = '🖨 Print Selected QR (' + rvSelectedTagIds.size + ')';
};
window.rvToggleSelectAllTags = function(checked) {
  document.querySelectorAll('input[data-rv-tag-chk]').forEach(chk => {
    chk.checked = checked;
    if (checked) rvSelectedTagIds.add(chk.dataset.rvTagChk); else rvSelectedTagIds.delete(chk.dataset.rvTagChk);
  });
  const btn = document.getElementById('rvBulkPrintBtn');
  if (btn) btn.textContent = '🖨 Print Selected QR (' + rvSelectedTagIds.size + ')';
};
window.rvPrintSelectedTags = function() {
  const selected = rcDocs('retail-tagging').filter(t => rvSelectedTagIds.has(t.id));
  if (!selected.length) return say('Select one or more tags in the table first.');
  if (window.rcPrintTagBatch) window.rcPrintTagBatch(selected);
};
window.rvExportTagsCsv = function() {
  const lines = [['Tag Code','Date','Lot','Product','Group','Metal','Pcs','Gross g','Less g','Net g','Purity %','Rate','Total','HUID','Counter','Status']];
  rcDocs('retail-tagging').forEach(t => lines.push([t.tagCode, t.tagDate || '', t.lotEntry || '', t.product || '', t.group || '', t.metalType || 'Gold', rvQty(t), rvF(t.grossWeight), rvF(t.lessWeight), rvF(t.netWeight), t.purity || '', t.rate || 0, t.totalAmount || 0, t.huid || '', t.counter || t.location || '', t.status || 'In stock']));
  rvCsvDownload('tagged-inventory.csv', lines);
};

window.rvToggleTagCreate = function(open, silent = false) {
  rvTagShowCreate = !!open;
  if (!open && typeof rcTagEdit !== 'undefined') rcTagEdit = '';
  if (!silent) rvRefreshStockHub();
};
window.rvToggleTagCol = function(col, checked) {
  if (checked) rvTagHiddenCols.delete(col); else rvTagHiddenCols.add(col);
  rvRefreshStockHub();
  document.getElementById('rvTagColPicker')?.setAttribute('open', '');
};

window.rvRenderTagInventoryPanel = function(rows) {
  const groups = rvProductGroups();
  const filtered = rows.filter(t => {
    const d = String(t.tagDate || t.createdAt || '').slice(0, 10);
    if (rvTagListFrom && d < rvTagListFrom) return false;
    if (rvTagListTo && d > rvTagListTo) return false;
    if (rvTagListGroup && t.group !== rvTagListGroup) return false;
    if (rvTagListMetal && (t.metalType || 'Gold') !== rvTagListMetal) return false;
    if (rvTagListStatus && (t.status || 'In stock') !== rvTagListStatus) return false;
    if (rvTagListSearch) {
      const q = rvTagListSearch.toLowerCase();
      const hay = [t.tagCode, t.product, t.group, t.lotEntry, t.huid, t.supplier, t.counter, t.tray, t.location, t.reference1].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const totPcs = filtered.reduce((s, t) => s + rvQty(t), 0);
  const totGross = filtered.reduce((s, t) => s + rvNum(t.grossWeight), 0);
  const totNet = filtered.reduce((s, t) => s + rvNum(t.netWeight), 0);

  const allCols = ['Tag Date','Tag No','Lot No','Product','Group','Metal','Qty','Grs Wt','Net Wt','Wst','MC','Rate/G','Sales Value','Product Size','Di.Pcs','Di.Carat','HUID','Tray','Reference 1','Status'];
  const keepIdx = allCols.map((c, i) => !rvTagHiddenCols.has(c) ? i : -1).filter(i => i >= 0);
  const colPicker = '<details id="rvTagColPicker" style="position:relative;display:inline-block"><summary class="gl-dt-btn" style="padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">Display Columns (' + keepIdx.length + '/' + allCols.length + ')</summary><div style="position:absolute;right:0;z-index:40;min-width:210px;max-height:260px;overflow:auto;padding:10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--white,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);display:grid;gap:5px">'
    + allCols.map(c => '<label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" ' + (!rvTagHiddenCols.has(c) ? 'checked' : '') + ' onchange="rvToggleTagCol(\'' + esc(c) + '\',this.checked)"> ' + esc(c) + '</label>').join('')
    + '</div></details>';

  return '<section class="panel"><div class="rc-section-title" style="flex-wrap:wrap;gap:8px"><div><h2>Tagging :: Lists (' + filtered.length + ' of ' + rows.length + ' · ' + totPcs + ' pcs · Net ' + rvF(totNet) + ' g)</h2><p class="muted">Search, customize columns, bulk-print QR labels, or click ＋ Create to add tags.</p></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" id="rvBulkPrintBtn" onclick="rvPrintSelectedTags()">🖨 Print QR (' + rvSelectedTagIds.size + ')</button>' + colPicker + '<button type="button" onclick="rvExportTagsCsv()">Export CSV</button><button type="button" class="primary" onclick="rvToggleTagCreate(true)">＋ Create</button></div></div>'
    + '<div class="rv-filters">'
    + '<label>Search<input type="search" value="' + esc(rvTagListSearch) + '" onchange="rvTagListSearch=this.value;rvRefreshStockHub()" placeholder="Tag, HUID, Lot, Product, Tray"></label>'
    + '<label>From<input type="date" value="' + esc(rvTagListFrom) + '" onchange="rvTagListFrom=this.value;rvRefreshStockHub()"></label>'
    + '<label>To<input type="date" value="' + esc(rvTagListTo) + '" onchange="rvTagListTo=this.value;rvRefreshStockHub()"></label>'
    + '<label>Group<select onchange="rvTagListGroup=this.value;rvRefreshStockHub()">' + rvOptions(groups, rvTagListGroup, 'All Groups') + '</select></label>'
    + '<label>Metal<select onchange="rvTagListMetal=this.value;rvRefreshStockHub()">' + rvOptions(['Gold','Silver','Platinum','Other'], rvTagListMetal, 'All Metals') + '</select></label>'
    + '<label>Status<select onchange="rvTagListStatus=this.value;rvRefreshStockHub()">' + rvOptions(['In stock','Reserved','Sold'], rvTagListStatus, 'All Status') + '</select></label>'
    + '<button type="button" onclick="rvTagListSearch=rvTagListFrom=rvTagListTo=rvTagListGroup=rvTagListMetal=rvTagListStatus=\'\';rvRefreshStockHub()">Reset</button>'
    + '</div>'
    + (filtered.length ? '<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th><input type="checkbox" title="Select all" onchange="rvToggleSelectAllTags(this.checked)"></th>'
      + keepIdx.map(i => '<th>' + esc(allCols[i]) + '</th>').join('') + '<th>Actions</th></tr></thead><tbody>'
      + filtered.map(t => {
        const cells = [
          esc(t.tagDate || '—'), '<b>' + esc(t.tagCode) + '</b>', esc(t.lotEntry || '—'), esc(t.product), esc(t.group || '—'),
          esc(t.metalType || 'Gold'), rvQty(t), rvF(t.grossWeight), '<b>' + rvF(t.netWeight) + '</b>',
          (t.wastage || 0) + (t.wastageMode === 'grams' ? 'g' : '%'), rateMoney(t.makingRate || 0),
          rateMoney(t.rate), '<b>' + rateMoney(t.totalAmount) + '</b>', esc(t.size || '—'),
          n(t.stonePieces || 0), rvF(t.stoneCarat || 0), esc(t.huid || '—'), esc(t.tray || '—'), esc(t.reference1 || '—'), esc(t.status || 'In stock')
        ];
        return '<tr><td><input type="checkbox" data-rv-tag-chk="' + esc(t.id) + '" ' + (rvSelectedTagIds.has(t.id) ? 'checked' : '') + ' onchange="rvToggleSelectTag(\'' + esc(t.id) + '\',this.checked)"></td>'
          + keepIdx.map(i => '<td>' + cells[i] + '</td>').join('')
          + '<td style="white-space:nowrap"><button type="button" onclick="rcEditTag(\'' + esc(t.id) + '\')">Edit</button> <button type="button" onclick="rcPrintOneTag(\'' + esc(t.id) + '\')">Print</button> <button type="button" onclick="rcDuplicateTag(\'' + esc(t.id) + '\')">Copy</button> <button type="button" class="rb-delete-btn" onclick="rcDeleteTag(\'' + esc(t.id) + '\')">Delete</button></td></tr>';
      }).join('')
      + '</tbody></table></div>' : '<p class="rv-no-tags">No tags match these filters. Click <b>＋ Create</b> to build a tag batch.</p>')
    + '</section>';
};

// ======================== STOCK VERIFICATION (5 WORKFLOWS) ========================
function rvScope(row) {
  return Array.isArray(row.stock) ? row.stock : rvTags().filter(t => (row.scope === 'group' ? t.group === row.group : row.scope === 'product' ? t.group === row.group && t.product === row.product : row.scope === 'counter' ? ((t.counter || t.location) === row.counter && (!row.group || t.group === row.group) && (!row.product || t.product === row.product)) : true));
}
function rvSnapshot(row) {
  row.stock = rvTags().filter(t => (row.scope === 'group' ? t.group === row.group : row.scope === 'product' ? t.group === row.group && t.product === row.product : row.scope === 'counter' ? ((t.counter || t.location) === row.counter && (!row.group || t.group === row.group) && (!row.product || t.product === row.product)) : true)).map(t => ({ id: t.id, tagCode: t.tagCode, rfidUid: t.rfidUid || '', product: t.product, group: t.group, counter: t.counter, location: t.location, huid: t.huid, pieces: rvQty(t), grossWeight: rvWeight(t) }));
}
function rvMarked(row) { const ids = new Set(row.verifiedIds || []); return rvScope(row).filter(t => ids.has(t.id)); }
function rvSummary(row) {
  const available = rvScope(row), verified = rvMarked(row), missing = available.filter(t => !(row.verifiedIds || []).includes(t.id));
  return { available: rvStats(available), verified: rvStats(verified), missing: rvStats(missing), invalid: (row.invalidCodes || []).length, scanned: (row.scans || []).length };
}
function rvCard(label, x) { return '<div class="rv-stat"><small>' + label + '</small><b>' + x.tags + ' tags · ' + x.qty + ' pcs</b><span>' + rvF(x.weight) + ' g</span></div>'; }

window.rvDeleteSession = function(id) {
  rvDeleteCustomDoc(id, 'Stock verification session');
};

function rvList(scope) {
  const rows = rvRows().filter(x => x.scope === scope && (!rvDate || rvDateText(x.date) === rvDate) && (!rvSearch || [x.group, x.product, x.counter, x.name].join(' ').toLowerCase().includes(rvSearch.toLowerCase()))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const title = scope === 'group' ? 'Stock Verification By Product Group' : scope === 'product' ? 'Stock Verification By Product' : 'Stock Verification By Counter';
  const body = rows.map(r => {
    const s = rvSummary(r), name = r.scope === 'counter' ? (r.counter || 'Unassigned counter') : (r.group || 'All groups') + (r.product ? ' / ' + r.product : '');
    return '<tr><td><b>' + esc(name) + '</b><small>' + esc(rvDateText(r.date)) + '</small></td><td>' + s.available.tags + ' / ' + s.available.qty + ' / ' + rvF(s.available.weight) + '</td><td>' + s.verified.tags + ' / ' + s.verified.qty + ' / ' + rvF(s.verified.weight) + '</td><td>' + s.invalid + '</td><td>' + s.missing.tags + ' / ' + s.missing.qty + ' / ' + rvF(s.missing.weight) + '</td><td><span class="rv-status">' + esc(r.status || 'In progress') + '</span></td><td style="white-space:nowrap"><button type="button" onclick="rvEdit(\'' + esc(r.id) + '\')">Open</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteSession(\'' + esc(r.id) + '\')">Delete</button></td></tr>';
  }).join('');
  return '<section class="panel"><div class="rc-section-title"><div><h2>' + title + ' :: Lists</h2><p class="muted">Available, verified, invalid and missing stock · Count / Qty / Weight g</p></div><button class="primary" type="button" onclick="rvOpen(\'' + scope + '-create\')">＋ Create</button></div><div class="rv-filters"><label>Search<input type="search" value="' + esc(rvSearch) + '" onchange="rvSearch=this.value;rvRefreshBody()" placeholder="Group, product or counter"></label><label>Verify date<input type="date" value="' + esc(rvDate) + '" onchange="rvDate=this.value;rvRefreshBody()"></label><button type="button" onclick="rvSearch=rvDate=\'\';rvRefreshBody()">Reset</button><button type="button" onclick="rvExport(\'' + scope + '\')">CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div><div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Scope / date</th><th>Available<br>Count / Qty / Weight</th><th>Verified<br>Count / Qty / Weight</th><th>Invalid</th><th>Missing<br>Count / Qty / Weight</th><th>Status</th><th>Action</th></tr></thead><tbody>' + (body || '<tr><td colspan="7" class="rv-empty">No verification sessions yet. Click ＋ Create to start.</td></tr>') + '</tbody></table></div><p class="rv-hint">' + rows.length + ' session(s). Verification records audit physical tags against stock.</p></section>';
}

window.rvOpenCameraScan = function() {
  if (typeof window.openQrScanner === 'function') {
    window.openQrScanner({
      title: 'Scan Tag / QR for Verification',
      onScan: code => {
        const inp = document.getElementById('rvScan');
        if (inp) { inp.value = code; rvScan(); }
      }
    });
  } else say('Enter or scan tag code in the input box.');
};

function rvCreate(scope) {
  const r = rvDraft || { scope, date: rvToday(), verifiedIds: [], invalidCodes: [], scans: [], status: 'In progress' }, available = rvScope(r), verified = rvMarked(r), s = rvSummary(r), group = rvProductGroups(), products = rvProducts(r.group), counters = rvCounters();
  const select = '<div class="rv-fields"><label>Verify date *<input id="rvDateInput" type="date" value="' + esc(rvDateText(r.date)) + '" onchange="rvField(\'date\',this.value)"></label>' + (scope !== 'rfid' && scope !== 'audit' ? '<label>Product group<select id="rvGroup" onchange="rvField(\'group\',this.value)">' + rvOptions(group, r.group, 'Select group') + '</select></label>' : '') + (scope === 'product' || scope === 'counter' ? '<label>Product<select onchange="rvField(\'product\',this.value)">' + rvOptions(products, r.product, 'Select product') + '</select></label>' : '') + (scope === 'counter' ? '<label>Counter *<select onchange="rvField(\'counter\',this.value)">' + rvOptions(counters, r.counter, 'Select counter') + '</select></label>' : '') + (scope === 'audit' ? '<label>Audit name *<input value="' + esc(r.name || '') + '" oninput="rvField(\'name\',this.value)" placeholder="e.g. Morning stock audit"></label>' : '') + '<label>Status<select onchange="rvField(\'status\',this.value)">' + ['In progress','Completed'].map(x => '<option ' + (r.status === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></label></div>';
  const rows = (a, checked) => a.map(t => '<tr><td>' + esc(t.tagCode || '') + '</td><td>' + esc(t.product || '') + '</td><td>' + esc(t.huid || '—') + '</td><td>' + rvQty(t) + '</td><td>' + rvF(rvWeight(t)) + '</td><td>' + (checked ? '<button type="button" onclick="rvUnscan(\'' + esc(t.id) + '\')">Undo</button>' : '—') + '</td></tr>').join('');
  const tbl = (title, a, checked) => '<section class="rv-list"><div class="rc-section-title"><h3>' + title + '</h3><strong>' + a.length + ' tags · ' + rvStats(a).qty + ' pcs · ' + rvF(rvStats(a).weight) + ' g</strong></div>' + (a.length ? '<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Tag No</th><th>Product Name</th><th>HUID</th><th>Qty</th><th>Weight g</th><th></th></tr></thead><tbody>' + rows(a, checked) + '</tbody></table></div>' : '<p class="rv-no-tags">No tags found in this selection.</p>') + '</section>';
  return '<section class="panel rv-create"><div class="rc-section-title"><div><h2>Stock Verification :: ' + (scope === 'audit' ? 'RFID Audit' : scope === 'rfid' ? 'RFID Session' : 'Create') + '</h2><p class="muted">' + (scope === 'group' ? 'By product group' : scope === 'product' ? 'By product' : scope === 'counter' ? 'By counter' : scope === 'rfid' ? 'RFID reader / keyboard scan' : 'Audit all tagged stock') + ' · Scan tag code, HUID or RFID UID to verify.</p></div><button type="button" onclick="rvOpen(\'' + (scope === 'audit' ? 'rfid-audit' : scope === 'rfid' ? 'rfid-list' : scope + '-list') + '\')">← Back to Lists</button></div>' + select + '<div class="rv-scan" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><label style="flex:1;min-width:220px">Enter or scan tag code / HUID / RFID<input id="rvScan" autocomplete="off" placeholder="Scan or type a tag, then press Enter" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rvScan()}"></label><button type="button" onclick="rvOpenCameraScan()">📷 Scan QR</button><button type="button" class="primary" onclick="rvScan()">Verify tag</button></div><div class="rv-summary">' + rvCard('Available', s.available) + rvCard('Verified', s.verified) + rvCard('Missing', s.missing) + '<div class="rv-stat"><small>Invalid scans</small><b>' + s.invalid + '</b><span>' + s.scanned + ' total scans</span></div></div>' + (r.invalidCodes?.length ? '<p class="rv-invalid">Invalid: ' + esc(r.invalidCodes.join(', ')) + '</p>' : '') + tbl('Available tags', available, false) + tbl('Verified tags', verified, true) + '<div class="rv-actions"><button type="button" onclick="rvSave(false)">Save progress</button><button type="button" class="primary" onclick="rvSave(true)">Complete verification</button><button type="button" onclick="window.print()">Print / PDF</button></div></section>';
}

function rvRfidList(audit) {
  const rows = rvRows().filter(x => x.scope === (audit ? 'audit' : 'rfid') && (!rvRfidFrom || x.date >= rvRfidFrom) && (!rvRfidTo || x.date <= rvRfidTo)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return '<section class="panel"><div class="rc-section-title"><div><h2>' + (audit ? 'RFID Stock Verification Audit :: Lists' : 'RFID Stock Verification :: Lists') + '</h2><p class="muted">' + (audit ? 'Audit name, status, scan times and tag totals' : 'Scan sessions with available, scanned and verified tag totals') + '</p></div><button class="primary" type="button" onclick="rvStart(\'' + (audit ? 'audit' : 'rfid') + '\')">＋ New ' + (audit ? 'audit' : 'session') + '</button></div><div class="rv-filters"><label>From date<input type="date" value="' + esc(rvRfidFrom) + '" onchange="rvRfidFrom=this.value;rvRefreshBody()"></label><label>To date<input type="date" value="' + esc(rvRfidTo) + '" onchange="rvRfidTo=this.value;rvRefreshBody()"></label><button type="button" onclick="rvRfidFrom=rvRfidTo=\'\';rvRefreshBody()">Reset</button><button type="button" onclick="rvExport(\'' + (audit ? 'audit' : 'rfid') + '\')">CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div><div class="rv-table-wrap"><table class="rv-table"><thead><tr>' + (audit ? '<th>Audit name</th><th>Status</th>' : '') + '<th>Date</th><th>First scan</th><th>Last scan</th><th>Available</th><th>Scanned</th><th>Verified</th><th>Action</th></tr></thead><tbody>' + (rows.map(r => { const s = rvSummary(r), scans = r.scans || []; return '<tr>' + (audit ? '<td><b>' + esc(r.name || '—') + '</b></td><td>' + esc(r.status || 'In progress') + '</td>' : '') + '<td>' + esc(rvDateText(r.date)) + '</td><td>' + esc(scans[0]?.at?.slice(11, 16) || '—') + '</td><td>' + esc(scans.at(-1)?.at?.slice(11, 16) || '—') + '</td><td>' + s.available.tags + '</td><td>' + s.scanned + '</td><td>' + s.verified.tags + '</td><td style="white-space:nowrap"><button type="button" onclick="rvEdit(\'' + esc(r.id) + '\')">Open</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteSession(\'' + esc(r.id) + '\')">Delete</button></td></tr>'; }).join('') || '<tr><td class="rv-empty" colspan="' + (audit ? 9 : 7) + '">No sessions yet. Click ＋ New to start.</td></tr>') + '</tbody></table></div></section>';
}

function rvVerificationBody() {
  const scope = rvTab.split('-')[0];
  if (rvTab.endsWith('create')) return rvCreate(scope);
  if (rvTab === 'rfid-list') return rvDraft?.scope === 'rfid' ? rvCreate('rfid') : rvRfidList(false);
  if (rvTab === 'rfid-audit') return rvDraft?.scope === 'audit' ? rvCreate('audit') : rvRfidList(true);
  return rvList(scope);
}
window.rvView = function() {
  const top = '<section class="panel rv-top"><div class="rc-section-title"><div><h2>Stock Verification</h2><p class="muted">Scan tagged stock and compare it with available inventory.</p></div><span>Retail stock</span></div><nav class="rv-tabs" aria-label="Stock verification views">' + RV_TABS.map(([k, v]) => '<button type="button" class="' + (rvTab === k ? 'active' : '') + '" onclick="rvOpen(\'' + k + '\')">' + esc(v) + '</button>').join('') + '</nav></section>';
  return top + rvVerificationBody();
};
window.rvRefreshBody = function() { rvRefreshStockHub(); };
window.rvOpen = function(tab) {
  if (!RV_TABS.some(x => x[0] === tab)) return;
  rvTab = tab; rvDraft = null;
  if (tab.startsWith('group')) rvStockPage = 'verify-group';
  else if (tab.startsWith('product')) rvStockPage = 'verify-product';
  else if (tab.startsWith('counter')) rvStockPage = 'verify-counter';
  else if (tab === 'rfid-list') rvStockPage = 'verify-rfid';
  else if (tab === 'rfid-audit') rvStockPage = 'verify-audit';
  rvRefreshStockHub();
  window.scrollTo?.(0, 0);
};
window.rvStart = function(scope) { rvDraft = { scope, date: rvToday(), verifiedIds: [], invalidCodes: [], scans: [], status: 'In progress' }; rvSnapshot(rvDraft); rvTab = scope === 'audit' ? 'rfid-audit' : 'rfid-list'; rvRefreshStockHub(); };
window.rvEdit = function(id) { const r = rvRows().find(x => x.id === id); if (!r) return; rvDraft = structuredClone(r); rvTab = r.scope === 'audit' ? 'rfid-audit' : r.scope === 'rfid' ? 'rfid-list' : r.scope + '-create'; rvRefreshStockHub(); };
window.rvField = function(key, value) {
  if (!rvDraft) rvDraft = { scope: rvTab.split('-')[0], date: rvToday(), verifiedIds: [], invalidCodes: [], scans: [], status: 'In progress' };
  if (['group','product','counter'].includes(key) && (rvDraft.scans || []).length) { say('Start a new session to change the scope after scanning.'); rvRefreshStockHub(); return; }
  rvDraft[key] = value;
  if (key === 'group') rvDraft.product = '';
  if (['group','product','counter'].includes(key)) { rvSnapshot(rvDraft); rvRefreshStockHub(); }
};
window.rvScan = function() {
  const input = document.getElementById('rvScan'), code = String(input?.value || '').trim();
  if (!code) return;
  const r = rvDraft || { scope: rvTab.split('-')[0], date: document.getElementById('rvDateInput')?.value || rvToday(), group: document.getElementById('rvGroup')?.value || '', verifiedIds: [], invalidCodes: [], scans: [], status: 'In progress' };
  rvDraft = r;
  if (!r.stock) rvSnapshot(r);
  if (r.scope === 'group' && !r.group || r.scope === 'product' && (!r.group || !r.product) || r.scope === 'counter' && !r.counter) return say('Select a verification scope before scanning.');
  const t = rvScope(r).find(x => [x.tagCode, x.huid, x.rfidUid].some(y => String(y || '').toLowerCase() === code.toLowerCase()));
  if ((r.scans || []).some(x => x.code.toLowerCase() === code.toLowerCase())) return say('This tag was already scanned.');
  r.scans.push({ code, at: new Date().toISOString(), tagId: t?.id || '' });
  if (t) r.verifiedIds.push(t.id); else r.invalidCodes.push(code);
  rvRefreshStockHub();
  document.getElementById('rvScan')?.focus();
  say(t ? 'Tag verified: ' + code : 'Tag not found in selected stock: ' + code);
};
window.rvUnscan = function(id) { if (!rvDraft) return; rvDraft.verifiedIds = (rvDraft.verifiedIds || []).filter(x => x !== id); rvDraft.scans = (rvDraft.scans || []).filter(x => x.tagId !== id); rvRefreshStockHub(); };
window.rvSave = function(complete) {
  const r = rvDraft;
  if (!r) return say('Select a scope or scan a tag first.');
  if (r.scope === 'group' && !r.group) return say('Select a product group.');
  if (r.scope === 'product' && (!r.group || !r.product)) return say('Select a group and product.');
  if (r.scope === 'counter' && !r.counter) return say('Select a counter.');
  if (r.scope === 'audit' && !String(r.name || '').trim()) return say('Enter an audit name.');
  if (complete && !confirm('Complete this verification session?')) return;
  if (!r.stock) rvSnapshot(r);
  const now = new Date().toISOString();
  const saved = { ...r, id: r.id || crypto.randomUUID(), kind: 'retail-stock-verification', accountType: 'customer', status: complete ? 'Completed' : r.status || 'In progress', createdAt: r.createdAt || now, updatedAt: now };
  const i = db.retailDocuments.findIndex(x => x.id === saved.id);
  if (i < 0) db.retailDocuments.push(saved); else db.retailDocuments[i] = saved;
  rvDraft = null;
  rvTab = saved.scope === 'audit' ? 'rfid-audit' : saved.scope === 'rfid' ? 'rfid-list' : saved.scope + '-list';
  const pending = save();
  rvRefreshStockHub();
  rcSaveStatus(pending, 'Stock verification');
};
window.rvExport = function(scope) {
  const rows = rvRows().filter(x => x.scope === scope), lines = [['Date','Scope','Group','Product','Counter','Available tags','Available qty','Available weight g','Verified tags','Verified qty','Verified weight g','Invalid','Missing tags','Missing qty','Missing weight g','Status']];
  rows.forEach(r => { const s = rvSummary(r); lines.push([r.date, r.scope, r.group || '', r.product || '', r.counter || '', s.available.tags, s.available.qty, rvF(s.available.weight), s.verified.tags, s.verified.qty, rvF(s.verified.weight), s.invalid, s.missing.tags, s.missing.qty, rvF(s.missing.weight), r.status]); });
  rvCsvDownload('stock-verification-' + scope + '.csv', lines);
};

// ======================== STOCK VOUCHERS (ISSUE / RECEIPT / METAL / STOCK JOURNAL) ========================
window.rvSaveStockVoucher = function(e, kind, prefix, label) {
  e.preventDefault(); const f = e.target; if (!f.reportValidity()) return;
  const v = Object.fromEntries(new FormData(f));
  const old = rvVoucherState.editId ? rvCustomDocs(kind).find(x => x.id === rvVoucherState.editId) : null;
  rvVoucherState.showForm = false;
  rvVoucherState.editId = '';
  rvSaveCustomDoc(kind, {
    id: old?.id || undefined,
    createdAt: old?.createdAt,
    voucherNo: String(v.voucherNo || '').trim() || old?.voucherNo || (prefix + '-' + Date.now().toString(36).toUpperCase().slice(-5)),
    date: v.date || rvToday(),
    party: String(v.party || '').trim() || 'Goldsmith / Counter',
    team: String(v.team || '').trim(),
    counter: String(v.counter || '').trim(),
    tagCode: String(v.tagCode || '').trim(),
    huid: String(v.huid || '').trim(),
    hsn: String(v.hsn || '7113').trim(),
    direction: v.direction || label,
    metal: v.metal || 'Gold',
    product: String(v.product || '').trim() || 'Ornament',
    pieces: rvNum(v.pieces || 1),
    grossWt: rvNum(v.grossWt),
    lessWt: rvNum(v.lessWt),
    netWt: rvNum(v.netWt || Math.max(0, rvNum(v.grossWt) - rvNum(v.lessWt))),
    purity: rvNum(v.purity || 91.6),
    pureWt: Number((rvNum(v.netWt || Math.max(0, rvNum(v.grossWt) - rvNum(v.lessWt))) * rvNum(v.purity || 91.6) / 100).toFixed(3)),
    targetProduct: String(v.targetProduct || '').trim(),
    targetWt: rvNum(v.targetWt),
    charges: rvNum(v.charges),
    remarks: String(v.remarks || '').trim(),
    cancelled: old?.cancelled || false,
    cancelReason: old?.cancelReason || ''
  }, label);
};

window.rvCancelStockVoucher = function(kind, id, label) {
  const r = rvCustomDocs(kind).find(x => x.id === id);
  if (!r) return;
  const reason = prompt('Enter cancellation reason for ' + r.voucherNo + ':', r.cancelReason || 'Cancelled by user');
  if (reason === null) return;
  rvSaveCustomDoc(kind, Object.assign({}, r, { cancelled: true, cancelReason: reason.trim() || 'Cancelled' }), label + ' cancelled');
};

window.rvToggleVoucherCol = function(col, checked) {
  if (checked) rvVoucherState.hiddenCols.delete(col); else rvVoucherState.hiddenCols.add(col);
  rvRefreshStockHub();
  document.getElementById('rvVchColPicker')?.setAttribute('open', '');
};

window.rvPrintStockVoucher = function(kind, id, title) {
  const r = rvCustomDocs(kind).find(x => x.id === id);
  if (!r) return;
  const rows = [[r.product || 'Jewellery', r.metal || 'Gold', String(r.pieces || 1), rvF(r.grossWt) + ' g', rvF(r.netWt) + ' g', (r.purity || 91.6) + '%', rvF(r.pureWt) + ' g', rateMoney(r.charges || 0)]];
  if (r.targetProduct) rows.push(['Output: ' + r.targetProduct, r.metal || 'Gold', '—', '—', rvF(r.targetWt) + ' g', '—', '—', '—']);
  pdfPrintModel({
    kind: 'ledger', retail: true, title: title.toUpperCase(),
    entityLabel: 'Ledger / Counter', entityName: r.party || 'Counter',
    entityDetails: [r.direction, r.counter ? 'Counter: ' + r.counter : '', r.team ? 'Team: ' + r.team : '', r.remarks].filter(Boolean).join(' · '),
    reference: r.voucherNo, date: r.date,
    heads: ['Product','Metal','Pcs','Gross Wt','Net Wt','Touch %','Pure Wt','Net Amount ₹'],
    rows,
    totals: [['Net Weight', rvF(r.netWt) + ' g', true], ['Pure Weight', rvF(r.pureWt) + ' g'], ['Net Amount', rateMoney(r.charges || 0)]]
  }, 'retail', 'classic');
};

window.rvExportVouchers = function(kind, name) {
  const lines = [['Date','Voucher No','Direction','Ledger','Team','Counter','Metal','Product','Qty','Gross g','Net g','Purity %','Pure g','Net Amount','Remarks','Status','Cancel Reason']];
  rvCustomDocs(kind).forEach(r => lines.push([r.date, r.voucherNo, r.direction || '', r.party || '', r.team || '', r.counter || '', r.metal || '', r.product || '', r.pieces || 1, rvF(r.grossWt), rvF(r.netWt), r.purity || '', rvF(r.pureWt), r.charges || 0, r.remarks || '', r.cancelled ? 'Cancelled' : 'Active', r.cancelReason || '']));
  rvCsvDownload(name + '.csv', lines);
};

function rvVoucherView(kind, title, prefix) {
  const all = rvCustomDocs(kind).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const prods = rvProducts(''), counters = rvCounters();
  const teams = rvCustomDocs('retail-master-item').filter(m => m.masterCat === 'Employees & Teams').map(m => m.name);
  const parties = [...new Set([...(db.retailSuppliers || []).map(s => s.name), ...counters, ...teams].filter(Boolean))];
  const isJournal = kind === 'retail-stock-journal', isMetal = kind === 'retail-metal-voucher';

  if (rvVoucherState.showForm || rvVoucherState.editId) {
    const ed = rvVoucherState.editId ? all.find(x => x.id === rvVoucherState.editId) : null;
    return '<section class="panel"><div class="rc-section-title"><div><h2>' + esc(title) + ' :: ' + (ed ? 'Edit (' + esc(ed.voucherNo) + ')' : 'Create') + '</h2><p class="muted">Track smith, karigar, counter, bullion and jobwork stock movements.</p></div><button type="button" onclick="rvVoucherState.showForm=false;rvVoucherState.editId=\'\';rvRefreshStockHub()">← Back to Lists</button></div>'
      + '<form class="rc-grid" onsubmit="rvSaveStockVoucher(event,\'' + kind + '\',\'' + prefix + '\',\'' + title + '\')">'
      + '<label>Voucher No.<input name="voucherNo" placeholder="Auto" value="' + esc(ed?.voucherNo || '') + '"></label>'
      + '<label>Date *<input type="date" name="date" required value="' + esc(ed?.date || rvToday()) + '"></label>'
      + (isMetal ? '<label>Direction<select name="direction"><option ' + (ed?.direction !== 'Metal Receipt' ? 'selected' : '') + '>Metal Issue</option><option ' + (ed?.direction === 'Metal Receipt' ? 'selected' : '') + '>Metal Receipt</option></select></label>' : '')
      + '<label>' + (kind.includes('issue') ? 'Ledger / Issue To' : kind.includes('receipt') ? 'Ledger / Received From' : isJournal ? 'Counter / Workshop' : 'Ledger / Visitor') + ' *<input name="party" required list="rvPartiesDl" value="' + esc(ed?.party || '') + '" placeholder="Ledger, smith or counter"><datalist id="rvPartiesDl">' + parties.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist></label>'
      + '<label>Counter<input name="counter" list="rvCtrDl" value="' + esc(ed?.counter || '') + '" placeholder="Counter"><datalist id="rvCtrDl">' + counters.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>'
      + '<label>Team / Staff<input name="team" list="rvTeamDl" value="' + esc(ed?.team || '') + '" placeholder="Team / employee"><datalist id="rvTeamDl">' + teams.map(t => '<option value="' + esc(t) + '">').join('') + '</datalist></label>'
      + '<label>Ornament / Metal<select name="metal">' + ['Gold','Silver','Diamond','Platinum'].map(m => '<option ' + (ed?.metal === m ? 'selected' : '') + '>' + m + '</option>').join('') + '</select></label>'
      + '<label>' + (isJournal ? 'Source Product' : 'Product / Bullion') + ' *<input name="product" required list="rvProdDl" value="' + esc(ed?.product || '') + '" placeholder="Select or type"><datalist id="rvProdDl">' + prods.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist></label>'
      + (isMetal ? '<label>Tag Code<input name="tagCode" value="' + esc(ed?.tagCode || '') + '"></label><label>HUID<input name="huid" value="' + esc(ed?.huid || '') + '"></label><label>HSN<input name="hsn" value="' + esc(ed?.hsn || '7113') + '"></label>' : '')
      + '<label>Total Qty<input type="number" name="pieces" min="1" step="1" value="' + (ed?.pieces || 1) + '"></label>'
      + '<label>Gross Weight (g) *<input type="number" name="grossWt" min=".001" step=".001" required value="' + (ed?.grossWt ?? '') + '" oninput="const f=this.form;if(f&&!f.netWt.dataset.manual)f.netWt.value=Math.max(0,Number(this.value||0)-Number(f.lessWt.value||0)).toFixed(3)"></label>'
      + '<label>Less / Stone Wt (g)<input type="number" name="lessWt" min="0" step=".001" value="' + (ed?.lessWt || 0) + '" oninput="const f=this.form;if(f&&!f.netWt.dataset.manual)f.netWt.value=Math.max(0,Number(f.grossWt.value||0)-Number(this.value||0)).toFixed(3)"></label>'
      + '<label>Net Weight (g) *<input type="number" name="netWt" min=".001" step=".001" required value="' + (ed?.netWt ?? '') + '" oninput="this.dataset.manual=\'1\'"></label>'
      + '<label>Touch / Purity %<input type="number" name="purity" min="1" max="100" step=".01" value="' + (ed?.purity || 91.6) + '"></label>'
      + (isJournal ? '<label>Target Product / Output<input name="targetProduct" list="rvProdDl" value="' + esc(ed?.targetProduct || '') + '" placeholder="Converted product"></label><label>Target Output Wt (g)<input type="number" name="targetWt" step=".001" value="' + (ed?.targetWt || '') + '"></label>' : '')
      + '<label>Net Amount / Charges ₹<input type="number" name="charges" min="0" step=".01" value="' + (ed?.charges || 0) + '"></label>'
      + '<label class="rc-wide">Remarks / Reference<input name="remarks" value="' + esc(ed?.remarks || '') + '"></label>'
      + '<div class="rc-actions rc-wide"><button type="button" onclick="rvVoucherState.showForm=false;rvVoucherState.editId=\'\';rvRefreshStockHub()">Cancel</button> <button class="primary" type="submit">Save ' + esc(title) + '</button></div></form></section>';
  }

  const list = all.filter(r => {
    if (!rvVoucherState.showCancel && r.cancelled) return false;
    if (rvVoucherState.from && r.date < rvVoucherState.from) return false;
    if (rvVoucherState.to && r.date > rvVoucherState.to) return false;
    if (rvVoucherState.metal && r.metal !== rvVoucherState.metal) return false;
    if (rvVoucherState.search) {
      const q = rvVoucherState.search.toLowerCase();
      if (![r.voucherNo, r.party, r.team, r.counter, r.product, r.tagCode, r.huid, r.remarks].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const heads = isMetal
    ? ['No','Date','Ornament Type','Tag Code','Product','HUID','HSN','Qty','Gross Wt','Pure Wt','Reference','Updated On','Actions']
    : isJournal
    ? ['Stock Journal No','Stock Journal Date','Counter Name','Type','Product','Total Gross Weight','Target Output','Updated On','Remarks','Actions']
    : ['Voucher No','Date','Ledger','Team','Counter','Total Qty','Gross Wt','Pure Wt','Net Amount','Remarks','Cancel Reason','Updated On','Actions'];

  const keepIdx = heads.map((h, i) => !rvVoucherState.hiddenCols.has(h) ? i : -1).filter(i => i >= 0);
  const colPicker = '<details id="rvVchColPicker" style="position:relative;display:inline-block"><summary class="gl-dt-btn" style="padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">Display Columns (' + keepIdx.length + '/' + heads.length + ')</summary><div style="position:absolute;right:0;z-index:40;min-width:205px;max-height:250px;overflow:auto;padding:10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--white,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);display:grid;gap:5px">'
    + heads.map(h => '<label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" ' + (!rvVoucherState.hiddenCols.has(h) ? 'checked' : '') + ' onchange="rvToggleVoucherCol(\'' + esc(h) + '\',this.checked)"> ' + esc(h) + '</label>').join('')
    + '</div></details>';

  const rowsHtml = list.map(r => {
    const acts = '<span style="white-space:nowrap"><button type="button" onclick="rvVoucherState.editId=\'' + esc(r.id) + '\';rvVoucherState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" onclick="rvPrintStockVoucher(\'' + kind + '\',\'' + esc(r.id) + '\',\'' + esc(title) + '\')">Print</button> '
      + (!r.cancelled ? '<button type="button" onclick="rvCancelStockVoucher(\'' + kind + '\',\'' + esc(r.id) + '\',\'' + esc(title) + '\')">Cancel</button> ' : '')
      + '<button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'' + esc(title) + '\')">Delete</button></span>';
    const cells = isMetal
      ? ['<b>' + esc(r.voucherNo) + '</b>', esc(r.date), esc(r.metal), esc(r.tagCode || '—'), esc(r.product), esc(r.huid || '—'), esc(r.hsn || '7113'), r.pieces || 1, rvF(r.grossWt) + ' g', rvF(r.pureWt) + ' g', esc(r.remarks || '—'), esc(String(r.updatedAt || '').slice(0, 10)), acts]
      : isJournal
      ? ['<b>' + esc(r.voucherNo) + '</b>', esc(r.date), esc(r.counter || r.party), esc(r.direction || 'Jobwork'), esc(r.product), '<b>' + rvF(r.grossWt) + ' g</b>', esc((r.targetProduct || '—') + ' (' + rvF(r.targetWt) + ' g)'), esc(String(r.updatedAt || '').slice(0, 10)), esc(r.remarks || '—'), acts]
      : ['<b>' + esc(r.voucherNo) + '</b>', esc(r.date), esc(r.party), esc(r.team || '—'), esc(r.counter || '—'), r.pieces || 1, rvF(r.grossWt) + ' g', '<b>' + rvF(r.pureWt) + ' g</b>', rateMoney(r.charges), esc(r.remarks || '—'), esc(r.cancelReason || '—'), esc(String(r.updatedAt || '').slice(0, 10)), acts];
    return '<tr>' + keepIdx.map(i => '<td>' + cells[i] + '</td>').join('') + '</tr>';
  }).join('');

  return '<section class="panel"><div class="rc-section-title" style="flex-wrap:wrap;gap:8px"><div><h2>' + esc(title) + ' :: ' + (rvVoucherState.detailMode ? 'Detail Lists' : 'Lists') + ' (' + list.length + ')</h2><p class="muted">Manage ' + esc(title.toLowerCase()) + ' records with team/counter tracking, cancellation, print and CSV export.</p></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" class="' + (rvVoucherState.detailMode ? 'primary' : '') + '" onclick="rvVoucherState.detailMode=!rvVoucherState.detailMode;rvRefreshStockHub()">Detail Lists</button>' + colPicker + '<button type="button" onclick="rvExportVouchers(\'' + kind + '\',\'' + prefix.toLowerCase() + '-vouchers\')">Export CSV</button><button type="button" onclick="window.print()">Print</button><button type="button" class="primary" onclick="rvVoucherState.editId=\'\';rvVoucherState.showForm=true;rvRefreshStockHub()">＋ Create</button></div></div>'
    + '<div class="rv-filters"><label>Search<input type="search" value="' + esc(rvVoucherState.search) + '" onchange="rvVoucherState.search=this.value;rvRefreshStockHub()" placeholder="Ledger, voucher no, product"></label><label>From<input type="date" value="' + esc(rvVoucherState.from) + '" onchange="rvVoucherState.from=this.value;rvRefreshStockHub()"></label><label>To<input type="date" value="' + esc(rvVoucherState.to) + '" onchange="rvVoucherState.to=this.value;rvRefreshStockHub()"></label><label>Metal<select onchange="rvVoucherState.metal=this.value;rvRefreshStockHub()">' + rvOptions(['Gold','Silver','Diamond','Platinum'], rvVoucherState.metal, 'All') + '</select></label><label style="display:inline-flex;align-items:center;gap:6px;min-width:auto;padding-bottom:6px"><input type="checkbox" ' + (rvVoucherState.showCancel ? 'checked' : '') + ' onchange="rvVoucherState.showCancel=this.checked;rvRefreshStockHub()"> Show Cancel</label><button type="button" onclick="rvVoucherState.search=rvVoucherState.from=rvVoucherState.to=rvVoucherState.metal=\'\';rvVoucherState.showCancel=false;rvVoucherState.hiddenCols.clear();rvRefreshStockHub()">Reset</button></div>'
    + (list.length ? '<div class="rv-table-wrap"><table class="rv-table"><thead><tr>' + keepIdx.map(i => '<th>' + esc(heads[i]) + '</th>').join('') + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' : '<p class="rv-no-tags">No ' + esc(title.toLowerCase()) + ' records yet. Click ＋ Create to add one.</p>') + '</section>';
}

// ======================== REORDER WORKFLOWS (4 DEDICATED PAGES) ========================
window.rvSaveWeightRange = function(e) {
  e.preventDefault(); const f = e.target; if (!f.reportValidity()) return;
  const v = Object.fromEntries(new FormData(f));
  const fromWt = rvNum(v.fromWt), toWt = rvNum(v.toWt);
  if (toWt <= fromWt) return say('To Weight must be greater than From Weight.');
  const old = rvReorderState.editId ? rvCustomDocs('retail-weight-range').find(x => x.id === rvReorderState.editId) : null;
  rvReorderState.showForm = false; rvReorderState.editId = '';
  rvSaveCustomDoc('retail-weight-range', {
    id: old?.id || undefined, createdAt: old?.createdAt,
    label: String(v.label || '').trim() || (fromWt + 'g - ' + toWt + 'g'),
    productGroup: v.productGroup || 'All Groups',
    product: String(v.product || '').trim(),
    fromWt, toWt,
    status: v.status || 'Active'
  }, 'Weight range');
};

window.rvSaveReorderRule = function(e, fixedMode) {
  e.preventDefault(); const f = e.target; if (!f.reportValidity()) return;
  const v = Object.fromEntries(new FormData(f));
  const mode = fixedMode || v.mode || 'Entry By Default';
  const old = rvReorderState.editId ? rvCustomDocs('retail-reorder-rule').find(x => x.id === rvReorderState.editId) : null;
  rvReorderState.showForm = false; rvReorderState.editId = '';
  rvSaveCustomDoc('retail-reorder-rule', {
    id: old?.id || undefined, createdAt: old?.createdAt,
    mode,
    productGroup: v.productGroup || 'General',
    product: String(v.product || '').trim(),
    size: String(v.size || '').trim() || 'Standard',
    weightRange: String(v.weightRange || '').trim() || 'All Weights',
    fromWt: rvNum(v.fromWt),
    toWt: rvNum(v.toWt),
    reorderQty: rvNum(v.reorderQty || 2),
    reorderWt: rvNum(v.reorderWt || 10),
    maxQty: rvNum(v.maxQty || 0),
    remarks: String(v.remarks || '').trim()
  }, mode);
};

function rvWeightRangePage() {
  const all = rvCustomDocs('retail-weight-range');
  const groups = rvProductGroups(), prods = rvProducts('');
  if (rvReorderState.showForm || rvReorderState.editId) {
    const ed = rvReorderState.editId ? all.find(x => x.id === rvReorderState.editId) : null;
    return '<section class="panel"><div class="rc-section-title"><div><h2>Weight Range :: ' + (ed ? 'Edit' : 'Create') + '</h2><p class="muted">Define weight slabs used in Reorder Entry By Weight and Weight-wise Stock Reports.</p></div><button type="button" onclick="rvReorderState.showForm=false;rvReorderState.editId=\'\';rvRefreshStockHub()">← Back to Lists</button></div>'
      + '<form class="rc-grid" onsubmit="rvSaveWeightRange(event)">'
      + '<label>Product Group<select name="productGroup">' + rvOptions(groups, ed?.productGroup || '', 'All Groups') + '</select></label>'
      + '<label>Product (optional)<input name="product" list="rvProdDl" value="' + esc(ed?.product || '') + '" placeholder="All products in group"><datalist id="rvProdDl">' + prods.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist></label>'
      + '<label>From Weight (g) *<input type="number" name="fromWt" min="0" step=".001" required value="' + (ed?.fromWt ?? 0) + '"></label>'
      + '<label>To Weight (g) *<input type="number" name="toWt" min=".001" step=".001" required value="' + (ed?.toWt ?? 5) + '"></label>'
      + '<label>Range Label<input name="label" value="' + esc(ed?.label || '') + '" placeholder="Auto (e.g. 0g - 5g)"></label>'
      + '<label>Status<select name="status"><option ' + (ed?.status !== 'Inactive' ? 'selected' : '') + '>Active</option><option ' + (ed?.status === 'Inactive' ? 'selected' : '') + '>Inactive</option></select></label>'
      + '<div class="rc-actions rc-wide"><button type="button" onclick="rvReorderState.showForm=false;rvReorderState.editId=\'\';rvRefreshStockHub()">Cancel</button> <button type="submit" class="primary">Save Weight Range</button></div></form></section>';
  }
  const filtered = all.filter(r => (!rvReorderState.group || r.productGroup === rvReorderState.group) && (!rvReorderState.search || [r.label, r.productGroup, r.product].join(' ').toLowerCase().includes(rvReorderState.search.toLowerCase())));
  return '<section class="panel"><div class="rc-section-title"><div><h2>Weight Range Mapping :: Lists (' + filtered.length + ')</h2><p class="muted">Configure weight slabs (From g – To g) for inventory reorder planning.</p></div><button type="button" class="primary" onclick="rvReorderState.editId=\'\';rvReorderState.showForm=true;rvRefreshStockHub()">＋ Create</button></div>'
    + '<div class="rv-filters"><label>Search<input type="search" value="' + esc(rvReorderState.search) + '" onchange="rvReorderState.search=this.value;rvRefreshStockHub()" placeholder="Range or product"></label><label>Group<select onchange="rvReorderState.group=this.value;rvRefreshStockHub()">' + rvOptions(groups, rvReorderState.group, 'All Groups') + '</select></label><button type="button" onclick="rvReorderState.search=rvReorderState.group=\'\';rvRefreshStockHub()">Reset</button></div>'
    + (filtered.length ? table(['Range Label','Product Group','Product','From Weight g','To Weight g','Status','Actions'], filtered.map(r => [
      '<b>' + esc(r.label) + '</b>', esc(r.productGroup || 'All Groups'), esc(r.product || 'All'), rvF(r.fromWt) + ' g', rvF(r.toWt) + ' g', esc(r.status || 'Active'),
      '<button type="button" onclick="rvReorderState.editId=\'' + esc(r.id) + '\';rvReorderState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Weight range\')">Delete</button>'
    ])) : '<p class="rv-no-tags">No weight ranges created yet. Click ＋ Create to add slabs like 1g–3g, 3g–6g, 6g–12g.</p>') + '</section>';
}

function rvReorderModePage(mode, reportName) {
  const all = rvCustomDocs('retail-reorder-rule').filter(r => (r.mode || 'Entry By Default') === mode);
  const groups = rvProductGroups(), prods = rvProducts('');
  const ranges = rvCustomDocs('retail-weight-range');
  const inStockTags = rvTags();

  const liveAvailable = r => {
    const matching = inStockTags.filter(t => {
      if (r.productGroup && r.productGroup !== 'General' && t.group !== r.productGroup) return false;
      if (r.product && String(t.product || '').toLowerCase() !== r.product.toLowerCase()) return false;
      if (mode === 'Entry By Size' && r.size && r.size !== 'Standard' && String(t.size || '').toLowerCase() !== r.size.toLowerCase()) return false;
      if (mode === 'Entry By Weight' && (r.fromWt > 0 || r.toWt > 0)) {
        const w = rvWeight(t);
        if (w < r.fromWt || (r.toWt > 0 && w > r.toWt)) return false;
      }
      return true;
    });
    return { qty: matching.reduce((s, t) => s + rvQty(t), 0), wt: matching.reduce((s, t) => s + rvWeight(t), 0) };
  };

  if (rvReorderState.showForm || rvReorderState.editId) {
    const ed = rvReorderState.editId ? all.find(x => x.id === rvReorderState.editId) : null;
    return '<section class="panel"><div class="rc-section-title"><div><h2>Reorder :: ' + esc(mode) + ' · ' + (ed ? 'Edit' : 'Create') + '</h2><p class="muted">Set minimum pieces and weight thresholds to flag stock shortfalls automatically.</p></div><button type="button" onclick="rvReorderState.showForm=false;rvReorderState.editId=\'\';rvRefreshStockHub()">← Back to Lists</button></div>'
      + '<form class="rc-grid" onsubmit="rvSaveReorderRule(event,\'' + esc(mode) + '\')">'
      + '<label>Product Group *<select name="productGroup" required>' + rvOptions(groups, ed?.productGroup || '', 'Select Group') + '</select></label>'
      + '<label>Product Name *<input name="product" required list="rvProdDl" value="' + esc(ed?.product || '') + '" placeholder="Product name"><datalist id="rvProdDl">' + prods.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist></label>'
      + (mode === 'Entry By Size' ? '<label>Product Size *<input name="size" required value="' + esc(ed?.size || '') + '" placeholder="e.g. 16 In, 18 In, 2.4"></label>' : '')
      + (mode === 'Entry By Weight' ? '<label>Weight Range Slab<input name="weightRange" list="rvRangeDl" value="' + esc(ed?.weightRange || '') + '" placeholder="e.g. 2g - 5g"><datalist id="rvRangeDl">' + ranges.map(r => '<option value="' + esc(r.label) + '">').join('') + '</datalist></label><label>From Wt (g)<input type="number" name="fromWt" min="0" step=".001" value="' + (ed?.fromWt || 0) + '"></label><label>To Wt (g)<input type="number" name="toWt" min="0" step=".001" value="' + (ed?.toWt || 0) + '"></label>' : '')
      + '<label>Reorder Min Qty (Pcs) *<input type="number" name="reorderQty" min="1" step="1" value="' + (ed?.reorderQty || 2) + '" required></label>'
      + '<label>Reorder Min Weight (g) *<input type="number" name="reorderWt" min=".001" step=".001" value="' + (ed?.reorderWt || 10) + '" required></label>'
      + '<label>Remarks<input name="remarks" value="' + esc(ed?.remarks || '') + '"></label>'
      + '<div class="rc-actions rc-wide"><button type="button" onclick="rvReorderState.showForm=false;rvReorderState.editId=\'\';rvRefreshStockHub()">Cancel</button> <button class="primary" type="submit">Save Reorder Rule</button></div></form></section>';
  }

  const filtered = all.filter(r => (!rvReorderState.group || r.productGroup === rvReorderState.group) && (!rvReorderState.search || [r.productGroup, r.product, r.size, r.weightRange].join(' ').toLowerCase().includes(rvReorderState.search.toLowerCase())));
  const specCol = mode === 'Entry By Size' ? 'Size' : mode === 'Entry By Weight' ? 'Weight Range' : 'Scope';

  return '<section class="panel"><div class="rc-section-title"><div><h2>Reorder :: ' + esc(mode) + ' (' + filtered.length + ')</h2><p class="muted">Live stock vs minimum reorder level with automatic shortfall calculation.</p></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\'' + esc(reportName) + '\')">📊 ' + esc(reportName) + '</button><button type="button" class="primary" onclick="rvReorderState.editId=\'\';rvReorderState.showForm=true;rvRefreshStockHub()">＋ Create</button></div></div>'
    + '<div class="rv-filters"><label>Search<input type="search" value="' + esc(rvReorderState.search) + '" onchange="rvReorderState.search=this.value;rvRefreshStockHub()" placeholder="Product or group"></label><label>Group<select onchange="rvReorderState.group=this.value;rvRefreshStockHub()">' + rvOptions(groups, rvReorderState.group, 'All Groups') + '</select></label><button type="button" onclick="rvReorderState.search=rvReorderState.group=\'\';rvRefreshStockHub()">Reset</button></div>'
    + (filtered.length ? table(['Product Group','Product',specCol,'Min Qty','Available Qty','Shortfall Qty','Min Wt g','Available Wt g','Status','Actions'], filtered.map(r => {
      const av = liveAvailable(r);
      const shortQty = Math.max(0, rvNum(r.reorderQty) - av.qty);
      const specVal = mode === 'Entry By Size' ? r.size : mode === 'Entry By Weight' ? (r.weightRange || (r.fromWt + 'g–' + r.toWt + 'g')) : 'Default';
      return [
        esc(r.productGroup), '<b>' + esc(r.product) + '</b>', esc(specVal),
        r.reorderQty, av.qty, shortQty > 0 ? '<b style="color:#b91c1c">' + shortQty + ' pcs</b>' : '0',
        rvF(r.reorderWt) + ' g', rvF(av.wt) + ' g',
        shortQty > 0 || av.wt < rvNum(r.reorderWt) ? '<span class="rco-badge rco-badge-cancel">Reorder Needed</span>' : '<span class="rco-badge rco-badge-open">Sufficient</span>',
        '<button type="button" onclick="rvReorderState.editId=\'' + esc(r.id) + '\';rvReorderState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Reorder rule\')">Delete</button>'
      ];
    })) : '<p class="rv-no-tags">No ' + esc(mode.toLowerCase()) + ' rules yet. Click ＋ Create to configure minimum stock levels.</p>') + '</section>';
}

// ======================== GIFT ITEMS (4 CONNECTED PAGES) ========================
function rvGiftMasters() {
  return rvCustomDocs('retail-gift-entry').filter(r => (r.entryType || 'Gift Item Master') === 'Gift Item Master');
}
function rvGiftPurchases() {
  return rvCustomDocs('retail-gift-entry').filter(r => r.entryType === 'Gift Purchase Item');
}
function rvGiftLots() {
  return rvCustomDocs('retail-gift-entry').filter(r => r.entryType === 'Gift Item Lot Entry');
}
function rvGiftTags() {
  return rvCustomDocs('retail-gift-entry').filter(r => r.entryType === 'Gift Item Tagging');
}
function rvGiftStockForName(name) {
  const key = String(name || '').trim().toLowerCase();
  const openQty = rvGiftMasters().filter(m => String(m.name || '').trim().toLowerCase() === key).reduce((s, m) => s + rvNum(m.qty), 0);
  const purQty = rvGiftPurchases().filter(p => String(p.name || '').trim().toLowerCase() === key).reduce((s, p) => s + rvNum(p.qty), 0);
  const issuedQty = rvGiftTags().filter(t => String(t.name || '').trim().toLowerCase() === key && t.status === 'Issued').reduce((s, t) => s + rvNum(t.qty || 1), 0);
  return { openQty, purQty, issuedQty, available: openQty + purQty - issuedQty };
}

window.rvSaveGiftItemEntry = function(e, fixedType) {
  e.preventDefault(); const f = e.target; if (!f.reportValidity()) return;
  const v = Object.fromEntries(new FormData(f));
  const entryType = fixedType || v.entryType || 'Gift Item Master';
  const old = rvGiftState.editId ? rvCustomDocs('retail-gift-entry').find(x => x.id === rvGiftState.editId) : null;
  const prefix = entryType === 'Gift Item Master' ? 'GFT' : entryType === 'Gift Purchase Item' ? 'GPUR' : entryType === 'Gift Item Lot Entry' ? 'GLOT' : 'GTAG';
  rvGiftState.showForm = false; rvGiftState.editId = ''; rvGiftState.prefillLotId = '';
  rvSaveCustomDoc('retail-gift-entry', {
    id: old?.id || undefined, createdAt: old?.createdAt,
    entryType,
    code: String(v.code || '').trim() || old?.code || (prefix + '-' + Date.now().toString(36).toUpperCase().slice(-5)),
    date: v.date || rvToday(),
    name: String(v.name || '').trim(),
    category: v.category || 'Complimentary Gift',
    supplier: String(v.supplier || '').trim(),
    lotCode: String(v.lotCode || '').trim(),
    qty: rvNum(v.qty || 1),
    weight: rvNum(v.weight),
    rate: rvNum(v.rate),
    gstPercent: rvNum(v.gstPercent),
    amount: rvNum(v.amount || (rvNum(v.qty || 1) * rvNum(v.rate) * (1 + rvNum(v.gstPercent) / 100))),
    status: v.status || old?.status || 'In stock',
    issuedTo: String(v.issuedTo || old?.issuedTo || '').trim(),
    remarks: String(v.remarks || '').trim()
  }, entryType);
};

window.rvTagFromGiftLot = function(lotId) {
  rvGiftState.prefillLotId = lotId;
  rvGiftState.editId = '';
  rvGiftState.showForm = true;
  rvStockOpen('gift-tagging');
};

window.rvIssueGiftTag = function(tagId) {
  const tag = rvGiftTags().find(t => t.id === tagId);
  if (!tag) return;
  const custDefault = (db.customers || [])[0]?.name || 'Walk-in Customer';
  const recipient = prompt('Issue gift tag ' + tag.code + ' (' + tag.name + ') to customer:', tag.issuedTo || custDefault);
  if (recipient === null) return;
  rvSaveCustomDoc('retail-gift-entry', Object.assign({}, tag, { status: 'Issued', issuedTo: recipient.trim() || 'Customer', issuedDate: rvToday() }), 'Gift tag issued');
};

function rvGiftWorkflowPage(pageKey) {
  const typeMap = {
    'gift-item': ['Gift Item Master', 'Gift Item :: Lists', 'Gift Stock Report'],
    'gift-purchase': ['Gift Purchase Item', 'Gift Purchase Item :: Lists', 'Gift Stock Report'],
    'gift-lot': ['Gift Item Lot Entry', 'Gift Item Lot Entry :: Lists', 'Gift Stock Report'],
    'gift-tagging': ['Gift Item Tagging', 'Gift Item Tagging :: Lists', 'Gift Issued Report']
  };
  const [entryType, heading, repTarget] = typeMap[pageKey] || typeMap['gift-item'];
  const all = rvCustomDocs('retail-gift-entry').filter(r => (r.entryType || 'Gift Item Master') === entryType).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const masters = rvGiftMasters();
  const lots = rvGiftLots();
  const suppliers = (db.retailSuppliers || []).map(s => s.name);

  if (rvGiftState.showForm || rvGiftState.editId) {
    const ed = rvGiftState.editId ? all.find(x => x.id === rvGiftState.editId) : null;
    const preLot = (!ed && rvGiftState.prefillLotId) ? lots.find(l => l.id === rvGiftState.prefillLotId) : null;
    const itemNameVal = ed?.name || preLot?.name || '';
    const masterMatch = masters.find(m => m.name === itemNameVal);
    return '<section class="panel"><div class="rc-section-title"><div><h2>' + esc(entryType) + ' :: ' + (ed ? 'Edit (' + esc(ed.code) + ')' : 'Create') + '</h2><p class="muted">Connected gift inventory workflow from Item Master → Purchase → Lot → Gift Tagging.</p></div><button type="button" onclick="rvGiftState.showForm=false;rvGiftState.editId=\'\';rvGiftState.prefillLotId=\'\';rvRefreshStockHub()">← Back to Lists</button></div>'
      + '<form class="rc-grid" onsubmit="rvSaveGiftItemEntry(event,\'' + esc(entryType) + '\')">'
      + '<label>' + (pageKey === 'gift-item' ? 'Item Code' : pageKey === 'gift-purchase' ? 'Purchase Invoice No.' : pageKey === 'gift-lot' ? 'Gift Lot No.' : 'Gift Tag / Barcode') + '<input name="code" placeholder="Auto" value="' + esc(ed?.code || '') + '"></label>'
      + '<label>Date *<input type="date" name="date" required value="' + esc(ed?.date || rvToday()) + '"></label>'
      + '<label>Gift Item Name *<input name="name" required list="rvGiftNamesDl" value="' + esc(itemNameVal) + '" placeholder="e.g. Silver Coin 2g, Velvet Box, Silk Bag"><datalist id="rvGiftNamesDl">' + masters.map(m => '<option value="' + esc(m.name) + '">').join('') + '</datalist></label>'
      + (pageKey === 'gift-item' ? '<label>Category<select name="category">' + ['Complimentary Gift','Silver Coin','Gold Coin','Jewellery Box / Pouch','Promo Voucher Article'].map(c => '<option ' + (ed?.category === c ? 'selected' : '') + '>' + c + '</option>').join('') + '</select></label>' : '')
      + (pageKey === 'gift-purchase' || pageKey === 'gift-lot' ? '<label>Supplier<input name="supplier" list="rvGiftSupDl" value="' + esc(ed?.supplier || '') + '" placeholder="Supplier name"><datalist id="rvGiftSupDl">' + suppliers.map(s => '<option value="' + esc(s) + '">').join('') + '</datalist></label>' : '')
      + (pageKey === 'gift-tagging' ? '<label>Gift Lot Reference<select name="lotCode"><option value="">No lot link</option>' + lots.map(l => '<option value="' + esc(l.code) + '" ' + ((ed?.lotCode || preLot?.code) === l.code ? 'selected' : '') + '>' + esc(l.code + ' · ' + l.name) + '</option>').join('') + '</select></label>' : '')
      + '<label>' + (pageKey === 'gift-item' ? 'Opening Stock Qty' : 'Quantity (Pcs) *') + '<input type="number" name="qty" min="' + (pageKey === 'gift-item' ? '0' : '1') + '" step="1" value="' + (ed?.qty ?? preLot?.qty ?? 1) + '" required></label>'
      + '<label>Weight (g)<input type="number" name="weight" min="0" step=".001" value="' + (ed?.weight ?? preLot?.weight ?? masterMatch?.weight ?? 0) + '"></label>'
      + '<label>Rate / Unit ₹<input type="number" name="rate" min="0" step=".01" value="' + (ed?.rate ?? masterMatch?.rate ?? 0) + '" oninput="const f=this.form;if(f?.amount)f.amount.value=(Number(f.qty.value||1)*Number(this.value||0)*(1+Number(f.gstPercent?.value||0)/100)).toFixed(2)"></label>'
      + (pageKey === 'gift-purchase' ? '<label>GST %<input type="number" name="gstPercent" min="0" step=".01" value="' + (ed?.gstPercent || 0) + '" oninput="const f=this.form;if(f?.amount)f.amount.value=(Number(f.qty.value||1)*Number(f.rate.value||0)*(1+Number(this.value||0)/100)).toFixed(2)"></label>' : '')
      + '<label>Total Amount ₹<input type="number" name="amount" min="0" step=".01" value="' + (ed?.amount || 0) + '"></label>'
      + (pageKey === 'gift-tagging' ? '<label>Status<select name="status"><option ' + (ed?.status !== 'Issued' ? 'selected' : '') + '>In stock</option><option ' + (ed?.status === 'Issued' ? 'selected' : '') + '>Issued</option></select></label><label>Issued To Customer<input name="issuedTo" value="' + esc(ed?.issuedTo || '') + '" placeholder="Optional customer"></label>' : '')
      + '<label class="rc-wide">Remarks<input name="remarks" value="' + esc(ed?.remarks || '') + '"></label>'
      + '<div class="rc-actions rc-wide"><button type="button" onclick="rvGiftState.showForm=false;rvGiftState.editId=\'\';rvGiftState.prefillLotId=\'\';rvRefreshStockHub()">Cancel</button> <button class="primary" type="submit">Save ' + esc(entryType) + '</button></div></form></section>';
  }

  const filtered = all.filter(r => {
    if (rvGiftState.from && r.date < rvGiftState.from) return false;
    if (rvGiftState.to && r.date > rvGiftState.to) return false;
    if (rvGiftState.search && ![r.code, r.name, r.supplier, r.lotCode, r.issuedTo, r.remarks].join(' ').toLowerCase().includes(rvGiftState.search.toLowerCase())) return false;
    return true;
  });

  let tbl = '<p class="rv-no-tags">No ' + esc(entryType.toLowerCase()) + ' records yet. Click ＋ Create to add one.</p>';
  if (filtered.length) {
    if (pageKey === 'gift-item') {
      tbl = table(['Code','Gift Item Name','Category','Opening Qty','Purchased','Issued','Available Stock','Unit Rate ₹','Actions'], filtered.map(r => {
        const st = rvGiftStockForName(r.name);
        return ['<b>' + esc(r.code) + '</b>', '<b>' + esc(r.name) + '</b>', esc(r.category || 'Complimentary Gift'), r.qty, st.purQty, st.issuedQty, '<b>' + st.available + ' pcs</b>', rateMoney(r.rate),
          '<button type="button" onclick="rvGiftState.editId=\'' + esc(r.id) + '\';rvGiftState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Gift item\')">Delete</button>'];
      }));
    } else if (pageKey === 'gift-purchase') {
      tbl = table(['Date','Invoice No','Supplier','Gift Item','Qty','Weight g','Rate ₹','GST %','Total ₹','Actions'], filtered.map(r => [
        esc(r.date), '<b>' + esc(r.code) + '</b>', esc(r.supplier || '—'), '<b>' + esc(r.name) + '</b>', r.qty, rvF(r.weight) + ' g', rateMoney(r.rate), (r.gstPercent || 0) + '%', '<b>' + rateMoney(r.amount) + '</b>',
        '<button type="button" onclick="rvGiftState.editId=\'' + esc(r.id) + '\';rvGiftState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Gift purchase\')">Delete</button>'
      ]));
    } else if (pageKey === 'gift-lot') {
      const tags = rvGiftTags();
      tbl = table(['Date','Lot No','Supplier','Gift Item','Lot Qty','Tagged Qty','Pending Qty','Weight g','Actions'], filtered.map(r => {
        const tQty = tags.filter(t => t.lotCode === r.code).reduce((s, t) => s + rvNum(t.qty || 1), 0);
        return [esc(r.date), '<b>' + esc(r.code) + '</b>', esc(r.supplier || '—'), '<b>' + esc(r.name) + '</b>', r.qty, tQty, Math.max(0, r.qty - tQty), rvF(r.weight) + ' g',
          '<button type="button" class="primary" onclick="rvTagFromGiftLot(\'' + esc(r.id) + '\')">＋ Tag Lot</button> <button type="button" onclick="rvGiftState.editId=\'' + esc(r.id) + '\';rvGiftState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Gift lot\')">Delete</button>'];
      }));
    } else {
      tbl = table(['Date','Gift Tag','Lot Ref','Gift Item','Qty','Weight g','Value ₹','Status','Issued To','Actions'], filtered.map(r => [
        esc(r.date), '<b>' + esc(r.code) + '</b>', esc(r.lotCode || '—'), '<b>' + esc(r.name) + '</b>', r.qty, rvF(r.weight) + ' g', rateMoney(r.amount || r.rate),
        r.status === 'Issued' ? '<span class="rco-badge rco-badge-cancel">Issued</span>' : '<span class="rco-badge rco-badge-open">In stock</span>',
        esc(r.issuedTo || '—'),
        (r.status !== 'Issued' ? '<button type="button" class="primary" onclick="rvIssueGiftTag(\'' + esc(r.id) + '\')">🎁 Issue</button> ' : '')
        + '<button type="button" onclick="if(window.rcPrintTagBatch)rcPrintTagBatch([{tagCode:\'' + esc(r.code) + '\',product:\'' + esc(r.name) + '\',metalType:\'Gift\',grossWeight:' + rvNum(r.weight) + ',netWeight:' + rvNum(r.weight) + ',rate:0}])">Print QR</button> '
        + '<button type="button" onclick="rvGiftState.editId=\'' + esc(r.id) + '\';rvGiftState.showForm=true;rvRefreshStockHub()">Edit</button> <button type="button" class="rb-delete-btn" onclick="rvDeleteCustomDoc(\'' + esc(r.id) + '\',\'Gift tag\')">Delete</button>'
      ]));
    }
  }

  return '<section class="panel"><div class="rc-section-title"><div><h2>' + esc(heading) + ' (' + filtered.length + ')</h2><p class="muted">Track complimentary gifts, silver coins, inward lots and issued customer gift tags.</p></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\'' + esc(repTarget) + '\')">📊 ' + esc(repTarget) + '</button><button type="button" class="primary" onclick="rvGiftState.editId=\'\';rvGiftState.showForm=true;rvRefreshStockHub()">＋ Create</button></div></div>'
    + '<div class="rv-filters"><label>Search<input type="search" value="' + esc(rvGiftState.search) + '" onchange="rvGiftState.search=this.value;rvRefreshStockHub()" placeholder="Code, gift item or supplier"></label><label>From<input type="date" value="' + esc(rvGiftState.from) + '" onchange="rvGiftState.from=this.value;rvRefreshStockHub()"></label><label>To<input type="date" value="' + esc(rvGiftState.to) + '" onchange="rvGiftState.to=this.value;rvRefreshStockHub()"></label><button type="button" onclick="rvGiftState.search=rvGiftState.from=rvGiftState.to=\'\';rvRefreshStockHub()">Reset</button></div>'
    + tbl + '</section>';
}

// ======================== SOLD TAGS ========================
function rvSaleTagMap() {
  const map = new Map();
  (db.sales || []).filter(s => s.accountType === 'customer').forEach(s => (s.invoiceItems || []).forEach(item => {
    const code = String(item.tagCode || '').trim().toLowerCase();
    if (code) map.set(code, { sale: s, item });
  }));
  return map;
}
function rvSoldRows() {
  const saleMap = rvSaleTagMap(), tags = rcDocs('retail-tagging'), known = new Set(), rows = [];
  tags.forEach(t => {
    const key = String(t.tagCode || '').toLowerCase(), match = saleMap.get(key);
    if (t.status !== 'Sold' && !match) return;
    known.add(key);
    rows.push({ tag: t, sale: match?.sale, item: match?.item });
  });
  for (const [key, match] of saleMap) {
    if (!known.has(key)) rows.push({ tag: { tagCode: match.item.tagCode, product: match.item.product, group: match.item.productGroup, pieces: match.item.pieces, grossWeight: match.item.grossWeight, netWeight: match.item.netWeight, huid: match.item.huid, metalType: match.item.metalType }, sale: match.sale, item: match.item });
  }
  return rows;
}
window.rvRestoreManualSoldTag = function(tagId) {
  const t = rcDocs('retail-tagging').find(x => x.id === tagId);
  if (!t) return;
  if (!confirm('Return tag ' + t.tagCode + ' to In Stock?')) return;
  t.status = 'In stock'; t.soldBySaleId = ''; t.soldBillNo = ''; t.soldAt = ''; t.updatedAt = new Date().toISOString();
  save(); rvRefreshStockHub(); say('Tag ' + t.tagCode + ' returned to stock.');
};
function rvSoldView() {
  const all = rvSoldRows();
  const rows = all.filter(x => {
    const s = [x.tag.tagCode, x.tag.product, x.tag.group, x.sale?.documentNo].join(' ').toLowerCase();
    return (!rvSoldSearch || s.includes(rvSoldSearch.toLowerCase())) && (!rvSoldDate || rvDateText(x.sale?.when || x.tag.soldAt) === rvSoldDate);
  });
  const total = rvStats(rows.map(x => x.tag));
  const amount = rows.reduce((a, x) => a + rvNum(x.item?.subtotal || x.item?.lineAmount || x.tag.totalAmount), 0);
  return '<section class="panel"><div class="rc-section-title"><div><h2>Sold Tags :: Lists</h2><p class="muted">Tags linked to saved retail sales bills and tags manually marked Sold.</p></div><span>' + rows.length + ' sold tags</span></div><div class="rv-summary rv-sold-summary">' + rvCard('Sold tags', total) + '<div class="rv-stat"><small>Sales value</small><b>₹ ' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + '</b><span>Recorded bills</span></div></div><div class="rv-filters"><label>Search<input type="search" value="' + esc(rvSoldSearch) + '" onchange="rvSoldSearch=this.value;rvRefreshStockHub()" placeholder="Tag, product or bill"></label><label>Sale date<input type="date" value="' + esc(rvSoldDate) + '" onchange="rvSoldDate=this.value;rvRefreshStockHub()"></label><button type="button" onclick="rvSoldSearch=rvSoldDate=\'\';rvRefreshStockHub()">Reset</button><button type="button" onclick="rvSoldExport()">CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div>'
    + (rows.length ? '<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Tag</th><th>Product</th><th>Group</th><th>Metal</th><th>Qty</th><th>Gross g</th><th>Net g</th><th>HUID</th><th>Bill / Date</th><th>Sale Value ₹</th><th>Action</th></tr></thead><tbody>'
      + rows.map(x => '<tr><td><b>' + esc(x.tag.tagCode || '—') + '</b></td><td>' + esc(x.tag.product || '—') + '</td><td>' + esc(x.tag.group || '—') + '</td><td>' + esc(x.tag.metalType || '—') + '</td><td>' + rvQty(x.tag) + '</td><td>' + rvF(rvWeight(x.tag)) + '</td><td>' + rvF(x.tag.netWeight) + '</td><td>' + esc(x.tag.huid || '—') + '</td><td>' + esc(x.sale?.documentNo || x.tag.soldBillNo || 'Manual') + '<small>' + esc(rvDateText(x.sale?.when || x.tag.soldAt)) + '</small></td><td>' + rvNum(x.item?.subtotal || x.item?.lineAmount || x.tag.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + '</td><td>' + (x.sale?.id ? '<button type="button" onclick="rbEdit(\'' + esc(x.sale.id) + '\')">Open Bill</button>' : (x.tag.id ? '<button type="button" onclick="rvRestoreManualSoldTag(\'' + esc(x.tag.id) + '\')">Restore</button>' : '—')) + '</td></tr>').join('')
      + '</tbody><tfoot><tr><th>TOTAL · ' + rows.length + '</th><th colspan="3"></th><th>' + total.qty + '</th><th>' + rvF(total.weight) + '</th><th>' + rvF(rows.reduce((a, x) => a + rvNum(x.tag.netWeight), 0)) + '</th><th colspan="2"></th><th>₹ ' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + '</th><th></th></tr></tfoot></table></div>' : '<p class="rv-no-tags">No sold tags found for these filters.</p>') + '</section>';
}

window.rvSyncSoldTags = function(previous, sale) {
  const before = new Set((previous?.invoiceItems || []).map(x => String(x.tagCode || '').toLowerCase()).filter(Boolean));
  const now = new Set((sale?.invoiceItems || []).map(x => String(x.tagCode || '').toLowerCase()).filter(Boolean));
  for (const tag of rcDocs('retail-tagging')) {
    const code = String(tag.tagCode || '').toLowerCase();
    if (now.has(code)) {
      tag.status = 'Sold'; tag.soldBySaleId = sale.id; tag.soldBillNo = sale.documentNo; tag.soldAt = sale.when; tag.updatedAt = new Date().toISOString();
    } else if (before.has(code) && tag.soldBySaleId === previous?.id) {
      tag.status = 'In stock'; tag.soldBySaleId = ''; tag.soldBillNo = ''; tag.soldAt = ''; tag.updatedAt = new Date().toISOString();
    }
  }
};
window.rvSoldExport = function() {
  const lines = [['Tag','Product','Group','Metal','Qty','Gross g','Net g','HUID','Bill','Sale date','Sale value']];
  for (const x of rvSoldRows()) lines.push([x.tag.tagCode, x.tag.product, x.tag.group, x.tag.metalType, rvQty(x.tag), rvF(rvWeight(x.tag)), rvF(x.tag.netWeight), x.tag.huid, x.sale?.documentNo || x.tag.soldBillNo, rvDateText(x.sale?.when || x.tag.soldAt), rvNum(x.item?.subtotal || x.item?.lineAmount || x.tag.totalAmount)]);
  rvCsvDownload('sold-tags.csv', lines);
};

// ======================== UNIFIED STOCK & TAGGING ROOF ========================
window.rvSyncInitialStockSection = function(section, subTab = '') {
  if (subTab) {
    rvStockOpen(subTab, true);
    return;
  }
  if (section === 'Lot Entry') rvStockPage = 'lot-entry';
  else if (section === 'Stock Verification') { rvStockPage = 'verify-group'; rvTab = 'group-list'; rvDraft = null; }
  else if (section === 'Tagging') rvStockPage = 'tagging';
};

window.rvStockSidebarSubmenuHtml = function() {
  const activeRoof = ['Stock & Tagging','Tagging','Lot Entry','Stock Verification'].includes(page);
  return RV_ROOF_SECTIONS.map(sec => '<div class="rga-sidebar-sub-head">' + esc(sec.heading) + '</div>'
    + sec.items.map(([key, label]) => '<button type="button" class="' + (activeRoof && rvStockPage === key ? 'active' : '') + '" onclick="rvStockOpen(\'' + esc(key) + '\')"><span>' + esc(label) + '</span></button>').join('')
  ).join('');
};

window.rvStockOpen = function(key, silent = false) {
  if (!silent && typeof rbCanLeave === 'function' && !rbCanLeave()) return;
  rvStockPage = key;
  if (key === 'tagging' && !rcTagEdit) rvTagShowCreate = false;
  rvVoucherState.showForm = false; rvVoucherState.editId = '';
  rvReorderState.showForm = false; rvReorderState.editId = '';
  if (!rvGiftState.prefillLotId) { rvGiftState.showForm = false; rvGiftState.editId = ''; }
  if (key === 'verify-group') { rvTab = 'group-list'; rvDraft = null; }
  else if (key === 'verify-product') { rvTab = 'product-list'; rvDraft = null; }
  else if (key === 'verify-counter') { rvTab = 'counter-list'; rvDraft = null; }
  else if (key === 'verify-rfid') { rvTab = 'rfid-list'; rvDraft = null; }
  else if (key === 'verify-audit') { rvTab = 'rfid-audit'; rvDraft = null; }
  if (silent) return;
  workspaceMode = 'retail';
  localStorage.setItem('goldleaf-workspace-mode', 'retail');
  window.rcStockSidebarOpen = true;
  if (!['Stock & Tagging','Tagging','Lot Entry','Stock Verification'].includes(page)) {
    page = 'Stock & Tagging';
    render();
  } else {
    page = 'Stock & Tagging';
    rvRefreshStockHub();
    if (typeof render === 'function') {
      // Keep sidebar active highlight synchronized
      document.querySelectorAll('[data-rc-stock-sub] button').forEach(b => b.classList.remove('active'));
    }
    render();
  }
  window.scrollTo?.(0, 0);
};

window.rvUnifiedStockScreen = function() {
  const allLots = window.rvLots ? window.rvLots() : [];
  const inStock = rvTags();
  const inStockWt = inStock.reduce((s, t) => s + rvNum(t.netWeight || t.grossWeight), 0);
  const soldCount = rvSoldRows().length;
  const verCount = rvRows().length;

  const activeSec = RV_ROOF_SECTIONS.find(s => s.items.some(([k]) => k === rvStockPage)) || RV_ROOF_SECTIONS[0];
  const roofNav = '<div class="rga-compact-roof" role="navigation" aria-label="Stock and Tagging sections">'
    + '<div class="rga-roof-top"><div class="rga-roof-cats">'
    + RV_ROOF_SECTIONS.map(sec => '<button type="button" class="rga-roof-cat-btn ' + (sec.heading === activeSec.heading ? 'active' : '') + '" onclick="rvStockOpen(\'' + esc(sec.items[0][0]) + '\')">' + esc(sec.heading) + '</button>').join('')
    + '</div><div class="rga-roof-inline-kpis">'
    + '<span class="rga-inline-kpi">In-Stock <b>' + inStock.length + ' (' + rvF(inStockWt) + ' g)</b></span>'
    + '<span class="rga-inline-kpi">Open Lots <b>' + allLots.filter(l => (l.status || 'Open') === 'Open').length + '/' + allLots.length + '</b></span>'
    + '<span class="rga-inline-kpi">Sold <b>' + soldCount + '</b></span>'
    + '<span class="rga-inline-kpi">Audits <b>' + verCount + '</b></span>'
    + '</div></div>'
    + '<div class="rga-roof-pills">'
    + activeSec.items.map(([key, label]) => '<button type="button" class="' + (rvStockPage === key ? 'active' : '') + '" onclick="rvStockOpen(\'' + esc(key) + '\')">' + esc(label) + '</button>').join('')
    + '</div></div>';

  let content = '';
  if (rvStockPage === 'lot-entry') content = window.rvLotView ? window.rvLotView() : '';
  else if (rvStockPage === 'tagging') {
    const showCreate = rvTagShowCreate || (typeof rcTagEdit !== 'undefined' && !!rcTagEdit);
    content = showCreate ? rcTaggingView() : window.rvRenderTagInventoryPanel(rcDocs('retail-tagging').sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))));
  }
  else if (rvStockPage === 'sold') content = rvSoldView();
  else if (rvStockPage === 'issue-voucher') content = rvVoucherView('retail-issue-voucher', 'Issue Voucher', 'ISS');
  else if (rvStockPage === 'receipt-voucher') content = rvVoucherView('retail-receipt-voucher', 'Receipt Voucher', 'RCV');
  else if (rvStockPage === 'metal-voucher') content = rvVoucherView('retail-metal-voucher', 'Metal Voucher', 'MTL');
  else if (rvStockPage === 'stock-journal') content = rvVoucherView('retail-stock-journal', 'Stock Journal', 'JRN');
  else if (rvStockPage.startsWith('verify-')) content = rvVerificationBody();
  else if (rvStockPage === 'reorder-weight') content = rvReorderModePage('Entry By Weight', 'Reorder Report By Weight');
  else if (rvStockPage === 'reorder-size') content = rvReorderModePage('Entry By Size', 'Reorder Report By Size');
  else if (rvStockPage === 'reorder-default') content = rvReorderModePage('Entry By Default', 'Reorder Report By Default');
  else if (rvStockPage === 'weight-range') content = rvWeightRangePage();
  else if (rvStockPage.startsWith('gift-')) content = rvGiftWorkflowPage(rvStockPage);
  else if (rvStockPage === 'opening-stock') {
    content = (window.rcOpeningView ? rcOpeningView('stock') : '') + (window.rgaLooseOpeningView ? rgaLooseOpeningView() : '');
  } else content = window.rvLotView ? window.rvLotView() : '';

  return roofNav + content;
};

// Backward-compatible aliases
window.rvTaggingScreen = window.rvUnifiedStockScreen;
window.rvRefreshStockHub = function() {
  const el = document.querySelector('.rc-content') || document.getElementById('app');
  if (el) el.innerHTML = window.rvUnifiedStockScreen();
};
window.rvRefreshTagging = window.rvRefreshStockHub;
window.rvTagOpen = function(tab) {
  const map = { 'reorder-entry': 'reorder-default', 'gift-items': 'gift-item' };
  window.rvStockOpen(map[tab] || tab);
};

if (typeof page !== 'undefined' && ['Stock Verification','Tagging','Lot Entry','Stock & Tagging'].includes(page) && typeof render === 'function') render();
