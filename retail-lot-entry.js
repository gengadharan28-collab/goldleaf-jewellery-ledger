/* Retail Lot Entry: Connects incoming product/group quantities to generated tags under Stock & Tagging. */
let rvLotTab = 'list', rvLotEdit = '', rvLotSearch = '', rvLotFrom = '', rvLotTo = '', rvLotStatusFilter = '';
let rvLotDetailMode = false, rvLotHiddenCols = new Set();
const rvLots = () => rcDocs('retail-lot');
window.rvLots = rvLots;

window.rvPostOpeningLot = function(button) {
  if (!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;
  const opening = rcDocs('retail-shop-opening').find(row => row.id === button.dataset.openingId);
  const product = rcDocs('retail-product').find(row => row.id === button.parentElement.querySelector('select')?.value);
  if (!opening || !['Finished jewellery','Other stock'].includes(opening.category) || !product?.group) return say('Select a product with a product group.');
  if (rvLots().some(lot => lot.openingId === opening.id)) return say('This opening entry already has a lot.');
  const qty = rvLotNumber(opening.pieces), weight = rvLotNumber(opening.weight);
  if (!Number.isInteger(qty) || qty < 1 || weight <= 0) return say('Enter positive pieces and weight in the opening entry first.');
  const entryNo = 'OB-' + opening.id.slice(0, 8).toUpperCase();
  const existing = rvLotTags({ entryNo });
  if (existing.length) return say('This opening lot number is already used by tags.');
  const now = new Date().toISOString();
  db.retailDocuments.push({
    id: 'opening-lot-' + opening.id, kind: 'retail-lot', accountType: 'customer', openingId: opening.id,
    entryNo, date: opening.when, ledgerName: 'Opening stock', entryType: 'By Product', rowCount: 1,
    remarks: opening.notes || '', status: 'Open', createdAt: now, updatedAt: now,
    items: [{ group: product.group, product: product.name, qty, weight, touch: rvLotNumber(opening.purity), rate: 0, wastage: 0, mc: 0, amount: rvLotNumber(opening.amount) }]
  });
  let pending;
  try { pending = save(); } catch (error) { pending = Promise.reject(error); }
  rvLotRefresh();
  rcSaveStatus(pending, 'Opening stock lot');
};

const rvLotToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const rvLotNumber = x => Number(x) || 0;
const rvLotFixed = x => rvLotNumber(x).toFixed(3);
const rvLotMoney = x => '₹ ' + rvLotNumber(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function rvLotTags(lot) {
  return rcDocs('retail-tagging').filter(t => String(t.lotEntry || '').trim().toLowerCase() === String(lot.entryNo || '').trim().toLowerCase());
}
function rvLotTotals(lot) {
  const rows = lot.items || [], tags = rvLotTags(lot);
  return {
    qty: rows.reduce((a, x) => a + rvLotNumber(x.qty), 0),
    weight: rows.reduce((a, x) => a + rvLotNumber(x.weight), 0),
    amount: rows.reduce((a, x) => a + rvLotNumber(x.amount), 0),
    tags: tags.length,
    tagQty: tags.reduce((a, x) => a + (rvLotNumber(x.pieces) || 1), 0),
    tagWeight: tags.reduce((a, x) => a + rvLotNumber(x.grossWeight), 0)
  };
}

window.rvGenerateTagsFromLot = function(lotId) {
  const lot = rvLots().find(l => l.id === lotId);
  if (!lot) return say('Lot not found.');
  const totals = rvLotTotals(lot);
  const remQty = Math.max(0, totals.qty - totals.tagQty);
  if (remQty <= 0 && !confirm('All pieces in lot ' + lot.entryNo + ' are already tagged. Create additional tags for this lot anyway?')) return;
  const products = rcDocs('retail-product');
  const tagItems = [];
  for (const it of (lot.items || [])) {
    const p = products.find(z => String(z.name || '').toLowerCase() === String(it.product || '').toLowerCase())
      || products.find(z => String(z.group || '').toLowerCase() === String(it.group || '').toLowerCase());
    const count = Math.max(1, Math.min(25, rvLotNumber(it.qty) || 1));
    const avgWt = count > 0 ? Number((rvLotNumber(it.weight) / count).toFixed(3)) : rvLotNumber(it.weight);
    for (let k = 0; k < count; k++) {
      tagItems.push({
        productId: p?.id || '',
        product: p?.name || it.product || '',
        group: it.group || p?.group || '',
        metalType: p?.metalType || (String(it.group || it.product || '').toLowerCase().includes('silver') ? 'Silver' : 'Gold'),
        pieces: 1,
        grossWeight: avgWt,
        lessWeight: 0,
        netWeight: avgWt,
        purity: rvLotNumber(it.touch) || p?.purity || 92,
        rate: rvLotNumber(it.rate) || 0,
        wastage: rvLotNumber(it.wastage) || p?.wastage || 0,
        wastageMode: 'percent',
        makingRate: rvLotNumber(it.mc) || p?.makingRate || 0,
        makingMode: p?.makingMode || 'fixed',
        status: 'In stock'
      });
    }
  }
  rcTagEdit = '';
  if (window.rvToggleTagCreate) window.rvToggleTagCreate(true, true);
  if (window.rvStockOpen) window.rvStockOpen('tagging');
  else if (window.rcOpenStandalone) window.rcOpenStandalone('Tagging');
  setTimeout(() => {
    const f = document.getElementById('rcTagBatchForm');
    if (!f) return;
    if (f.elements.lotEntry) f.elements.lotEntry.value = lot.entryNo;
    if (f.elements.supplier) f.elements.supplier.value = lot.ledgerName || '';
    const box = document.getElementById('rcTagRows');
    if (box && tagItems.length && typeof rcTagRow === 'function') {
      box.innerHTML = tagItems.map((row, idx) => rcTagRow(row, idx)).join('');
      if (f.elements.rowCount) f.elements.rowCount.value = tagItems.length;
      if (window.rcAutoFillTagCodes) window.rcAutoFillTagCodes();
      box.querySelectorAll('.rc-tag-row').forEach(r => window.rcTagCalcRow?.(r));
    }
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    say('Loaded lot ' + lot.entryNo + ' (' + tagItems.length + ' tag rows) into Tagging :: Create.');
  }, 40);
};

window.rvLotDeleteRow = function(id) {
  const lot = rvLots().find(l => l.id === id);
  if (!lot) return;
  const linked = rvLotTags(lot);
  if (linked.length) return say('Lot ' + lot.entryNo + ' has ' + linked.length + ' linked tag(s). Delete or unlink those tags first.');
  if (!confirm('Delete lot entry ' + lot.entryNo + '?')) return;
  if (!Array.isArray(db.deletedRetailDocumentIds)) db.deletedRetailDocumentIds = [];
  if (!db.deletedRetailDocumentIds.includes(String(id))) db.deletedRetailDocumentIds.push(String(id));
  db.retailDocuments = (db.retailDocuments || []).filter(x => x && x.id !== id);
  if (rvLotEdit === id) { rvLotEdit = ''; rvLotTab = 'list'; }
  save();
  rvLotRefresh();
  say('Lot ' + lot.entryNo + ' deleted.');
};

window.rvToggleLotCol = function(col, checked) {
  if (checked) rvLotHiddenCols.delete(col); else rvLotHiddenCols.add(col);
  rvLotRefresh();
  document.getElementById('rvLotColPicker')?.setAttribute('open', '');
};

function rvLotColFilteredTable(heads, rows, footRow) {
  const keep = heads.map((h, idx) => !rvLotHiddenCols.has(h) ? idx : -1).filter(i => i >= 0);
  const fHeads = keep.map(i => heads[i]);
  const fRows = rows.map(r => keep.map(i => r[i]));
  const colMenu = '<details id="rvLotColPicker" style="position:relative;display:inline-block"><summary class="gl-dt-btn" style="padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">Display Columns (' + fHeads.length + '/' + heads.length + ')</summary><div style="position:absolute;right:0;z-index:40;min-width:210px;max-height:260px;overflow:auto;padding:10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--white,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);display:grid;gap:5px">'
    + heads.map(h => '<label style="font-size:12px;display:flex;align-items:center;gap:6px;min-width:0"><input type="checkbox" ' + (!rvLotHiddenCols.has(h) ? 'checked' : '') + ' onchange="rvToggleLotCol(\'' + esc(h) + '\',this.checked)"> ' + esc(h) + '</label>').join('')
    + '</div></details>';
  const tbl = fRows.length ? '<div class="rv-table-wrap"><table class="rv-table"><thead><tr>' + fHeads.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
    + fRows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')
    + (footRow ? '</tbody><tfoot><tr>' + keep.map(i => '<th>' + (footRow[i] ?? '') + '</th>').join('') + '</tr></tfoot>' : '</tbody>')
    + '</table></div>' : '<p class="rv-no-tags">No lot entries found. Click ＋ Create to record incoming jewellery lots.</p>';
  return { colMenu, tbl };
}

function rvLotList() {
  const rows = rvLots().filter(l => {
    const q = [l.entryNo, l.ledgerName, l.remarks, ...(l.items || []).map(i => i.group + ' ' + i.product)].join(' ').toLowerCase();
    return (!rvLotSearch || q.includes(rvLotSearch.toLowerCase()))
      && (!rvLotFrom || l.date >= rvLotFrom)
      && (!rvLotTo || l.date <= rvLotTo)
      && (!rvLotStatusFilter || (l.status || 'Open') === rvLotStatusFilter);
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const qty = rows.reduce((a, l) => a + rvLotTotals(l).qty, 0);
  const weight = rows.reduce((a, l) => a + rvLotTotals(l).weight, 0);
  const tagQty = rows.reduce((a, l) => a + rvLotTotals(l).tagQty, 0);
  const tagWeight = rows.reduce((a, l) => a + rvLotTotals(l).tagWeight, 0);

  let heads, dataRows, footRow;
  if (rvLotDetailMode) {
    heads = ['Entry No','Entry Date','Ledger','Product Group','Product Name','Qty','Weight','Touch %','Rate','Wastage %','MC','Amount ₹','Status','Actions'];
    dataRows = rows.flatMap(l => (l.items || [{}]).map(it => [
      '<b>' + esc(l.entryNo) + '</b>', esc(l.date), esc(l.ledgerName), esc(it.group || '—'), '<b>' + esc(it.product || '—') + '</b>',
      rvLotNumber(it.qty), rvLotFixed(it.weight), rvLotNumber(it.touch) ? rvLotNumber(it.touch) + '%' : '—',
      rvLotMoney(it.rate), rvLotNumber(it.wastage) + '%', rvLotMoney(it.mc), rvLotMoney(it.amount), esc(l.status || 'Open'),
      '<button type="button" class="primary" onclick="rvGenerateTagsFromLot(\'' + esc(l.id) + '\')">＋ Tag</button>'
    ]));
    footRow = ['TOTAL (' + dataRows.length + ' items)','','','','',qty,rvLotFixed(weight),'','','','','','',''];
  } else {
    heads = ['Entry No','Entry Date','Ledger','Qty','Weight','Total Tags','Total Tag Qty','Total Tag Wt','Difference Qty','Difference Wt','Amount ₹','Reference Object','Remarks','Updated On','Status','Actions'];
    dataRows = rows.map(l => {
      const t = rvLotTotals(l);
      return [
        '<b>' + esc(l.entryNo) + '</b>', esc(l.date), esc(l.ledgerName), t.qty, rvLotFixed(t.weight),
        t.tags, t.tagQty, rvLotFixed(t.tagWeight), t.qty - t.tagQty, rvLotFixed(t.weight - t.tagWeight),
        rvLotMoney(t.amount), esc(l.openingId ? 'Opening Stock' : (l.entryType || 'Lot')), esc(l.remarks || '—'),
        esc(String(l.updatedAt || l.createdAt || '').slice(0, 10)), esc(l.status || 'Open'),
        '<span style="white-space:nowrap"><button type="button" class="primary" onclick="rvGenerateTagsFromLot(\'' + esc(l.id) + '\')">＋ Tag Lot</button> '
        + (!l.openingId ? '<button type="button" onclick="rvLotEditRow(\'' + esc(l.id) + '\')">Edit</button> ' : '')
        + '<button type="button" class="rb-delete-btn" onclick="rvLotDeleteRow(\'' + esc(l.id) + '\')">Delete</button></span>'
      ];
    });
    footRow = ['TOTAL · ' + rows.length,'','',qty,rvLotFixed(weight),'',tagQty,rvLotFixed(tagWeight),(qty - tagQty),rvLotFixed(weight - tagWeight),'','','','','',''];
  }

  const { colMenu, tbl } = rvLotColFilteredTable(heads, dataRows, footRow);

  return '<section class="panel"><div class="rc-section-title" style="flex-wrap:wrap;gap:8px"><div><h2>Lot Entry :: ' + (rvLotDetailMode ? 'Detail Lists' : 'Lists') + ' (' + rows.length + ')</h2><p class="muted">Compare entered lots with generated tags, switch to Detail Lists, or click ＋ Tag Lot.</p></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" class="' + (rvLotDetailMode ? 'primary' : '') + '" onclick="rvLotDetailMode=!rvLotDetailMode;rvLotHiddenCols.clear();rvLotRefresh()">' + (rvLotDetailMode ? 'Summary Lists' : 'Detail Lists') + '</button>' + colMenu + '<button type="button" onclick="rvLotExport()">Export CSV</button><button type="button" onclick="window.print()">Print</button><button class="primary" type="button" onclick="rvLotOpen(\'create\')">＋ Create</button></div></div>'
    + '<div class="rv-filters"><label>Search<input type="search" value="' + esc(rvLotSearch) + '" onchange="rvLotSearch=this.value;rvLotRefresh()" placeholder="Entry no, ledger or product"></label><label>From date<input type="date" value="' + esc(rvLotFrom) + '" onchange="rvLotFrom=this.value;rvLotRefresh()"></label><label>To date<input type="date" value="' + esc(rvLotTo) + '" onchange="rvLotTo=this.value;rvLotRefresh()"></label><label>Status<select onchange="rvLotStatusFilter=this.value;rvLotRefresh()"><option value="">All</option><option ' + (rvLotStatusFilter === 'Open' ? 'selected' : '') + '>Open</option><option ' + (rvLotStatusFilter === 'Closed' ? 'selected' : '') + '>Closed</option></select></label><button type="button" onclick="rvLotSearch=rvLotFrom=rvLotTo=rvLotStatusFilter=\'\';rvLotHiddenCols.clear();rvLotRefresh()">Reset</button></div>'
    + tbl + '</section>';
}
function rvLotInput(label, key, value, type = 'text', extra = '') { return '<label>' + label + '<input data-lot="' + key + '" type="' + type + '" value="' + esc(value ?? '') + '" ' + extra + '></label>'; }
function rvLotRow(x = {}, i = 0) {
  const groups = rvProductGroups(), products = rvProducts(x.group), options = (xs, v) => '<option value="">Select</option>' + xs.map(a => '<option ' + (a === v ? 'selected' : '') + '>' + esc(a) + '</option>').join('');
  return '<div class="rv-lot-row" data-lot-row><div class="rv-lot-row-head"><b>No. ' + (i + 1) + '</b><button type="button" class="rb-delete-btn" onclick="rvLotRemove(this)">Remove</button></div><div class="rv-lot-fields"><label>Product group *<select data-lot="group" required onchange="rvLotGroup(this)">' + options(groups, x.group) + '</select></label><label>Product name<select data-lot="product" onchange="rvLotCalc()">' + options(products, x.product) + '</select></label>' + rvLotInput('Qty *', 'qty', x.qty || 1, 'number', 'min="1" step="1" required oninput="rvLotCalc()"') + rvLotInput('Weight g *', 'weight', x.weight || '', 'number', 'min="0" step=".001" required oninput="rvLotCalc()"') + rvLotInput('Touch %', 'touch', x.touch || '', 'number', 'min="0" max="100" step=".01" oninput="rvLotCalc()"') + rvLotInput('Rate ₹/g', 'rate', x.rate || '', 'number', 'min="0" step=".01" oninput="rvLotCalc()"') + rvLotInput('Wastage %', 'wastage', x.wastage || 0, 'number', 'min="0" max="100" step=".01" oninput="rvLotCalc()"') + rvLotInput('MC ₹', 'mc', x.mc || 0, 'number', 'min="0" step=".01" oninput="rvLotCalc()"') + rvLotInput('Amount ₹', 'amount', x.amount || '', 'number', 'min="0" step=".01" oninput="this.dataset.manual=\'1\';rvLotCalc()"') + '</div></div>';
}
function rvLotForm() {
  const x = rvLots().find(l => l.id === rvLotEdit) || {}, items = x.items?.length ? x.items : [{}];
  const ledgers = [...new Set([...(db.retailSuppliers || []).map(s => s.name), ...rcDocs('retail-purchase').map(p => p.supplier || p.ledgerName), ...rvLots().map(l => l.ledgerName)].filter(Boolean))];
  return '<section class="panel"><div class="rc-section-title"><div><h2>Lot Entry :: ' + (x.id ? 'Edit' : 'Create') + '</h2><p class="muted">Enter incoming stock by product or group, then save or generate item tags.</p></div><div style="display:flex;gap:6px"><button type="button" onclick="rvLotCalc()">Display</button><button type="button" onclick="rvLotOpen(\'list\')">← Back</button></div></div><form id="rvLotForm" onsubmit="rvLotSave(event)"><input name="id" type="hidden" value="' + esc(x.id || '') + '"><div class="rv-fields"><label>Entry no *<input name="entryNo" required value="' + esc(x.entryNo || 'LOT-' + Date.now().toString(36).toUpperCase()) + '"></label><label>Entry date *<input name="date" type="date" required value="' + esc(x.date || rvLotToday()) + '"></label><label>Ledger Name *<input name="ledgerName" list="rvLotLedgers" required value="' + esc(x.ledgerName || '') + '" placeholder="Supplier / ledger"><datalist id="rvLotLedgers">' + ledgers.map(v => '<option value="' + esc(v) + '">').join('') + '</datalist></label><label>Type<select name="entryType" onchange="rvLotType(this)"><option ' + (x.entryType !== 'By Product Group' ? 'selected' : '') + '>By Product</option><option ' + (x.entryType === 'By Product Group' ? 'selected' : '') + '>By Product Group</option></select></label><label>No of Rows<input name="rowCount" type="number" min="1" step="1" value="' + items.length + '" onchange="rvLotRowCount(this)"></label><label>Status<select name="status"><option ' + (x.status !== 'Closed' ? 'selected' : '') + '>Open</option><option ' + (x.status === 'Closed' ? 'selected' : '') + '>Closed</option></select></label><label class="rv-wide">Remarks<input name="remarks" value="' + esc(x.remarks || '') + '"></label></div><div id="rvLotRows">' + items.map(rvLotRow).join('') + '</div><div class="rv-actions"><button type="button" onclick="rvLotAdd()">＋ Add row</button><button type="submit" class="primary">' + (x.id ? 'Save changes' : 'Save') + '</button></div><div class="rv-lot-totals"><span>Items <b id="rvLotItems">' + items.length + '</b></span><span>Total Qty <b id="rvLotQty">0</b></span><span>Total Weight <b id="rvLotWeight">0.000 g</b></span><span>Total Amount <b id="rvLotAmount">₹ 0.00</b></span></div></form></section>';
}
window.rvLotView = function() {
  return rvLotTab === 'list' ? rvLotList() + (window.rcOpeningView ? '<details class="panel"><summary style="font-weight:750;cursor:pointer">Opening Stock to Lot</summary>' + rcOpeningView('stock') + '</details>' : '') : rvLotForm();
};
window.rvLotRefresh = function() {
  if (window.rvRefreshStockHub && (page === 'Stock & Tagging' || page === 'Lot Entry')) {
    window.rvRefreshStockHub();
    if (rvLotTab === 'create') rvLotCalc();
    return;
  }
  const root = document.querySelector('.rc-content');
  if (root) { root.innerHTML = rvLotView(); if (rvLotTab === 'create') rvLotCalc(); }
};
window.rvLotOpen = function(tab) { if (!['list','create'].includes(tab)) return; rvLotTab = tab; rvLotEdit = ''; rvLotRefresh(); window.scrollTo?.(0, 0); };
window.rvLotEditRow = function(id) { if (rvLots().some(lot => lot.id === id && lot.openingId)) return say('This lot was posted from Opening Stock.'); rvLotEdit = id; rvLotTab = 'create'; rvLotRefresh(); };
window.rvLotAdd = function() { const box = document.getElementById('rvLotRows'); box.insertAdjacentHTML('beforeend', rvLotRow({}, box.children.length)); document.querySelector('#rvLotForm [name="rowCount"]').value = box.children.length; rvLotCalc(); };
window.rvLotRemove = function(btn) { const box = document.getElementById('rvLotRows'); if (box.children.length === 1) return say('Keep at least one item.'); btn.closest('[data-lot-row]').remove(); [...box.children].forEach((e, i) => e.querySelector('.rv-lot-row-head b').textContent = 'No. ' + (i + 1)); document.querySelector('#rvLotForm [name="rowCount"]').value = box.children.length; rvLotCalc(); };
window.rvLotRowCount = function(input) { const count = Math.max(1, Math.min(100, rvLotNumber(input.value) || 1)), box = document.getElementById('rvLotRows'); while (box.children.length < count) rvLotAdd(); while (box.children.length > count) box.lastElementChild.remove(); input.value = box.children.length; rvLotCalc(); };
window.rvLotGroup = function(select) { const row = select.closest('[data-lot-row]'), prod = row.querySelector('[data-lot="product"]'); prod.innerHTML = '<option value="">Select</option>' + rvProducts(select.value).map(x => '<option>' + esc(x) + '</option>').join(''); rvLotCalc(); };
window.rvLotType = function(select) { document.querySelectorAll('#rvLotRows [data-lot="product"]').forEach(e => { e.required = select.value === 'By Product'; }); rvLotCalc(); };
window.rvLotCalc = function() {
  const rows = [...document.querySelectorAll('#rvLotRows [data-lot-row]')], v = (row, key) => rvLotNumber(row.querySelector('[data-lot="' + key + '"]')?.value);
  let qty = 0, weight = 0, amount = 0;
  for (const row of rows) {
    qty += v(row, 'qty'); weight += v(row, 'weight');
    const a = row.querySelector('[data-lot="amount"]');
    if (a && !a.dataset.manual && !(rvLotEdit && a.value)) { a.value = ((v(row, 'weight') * (1 + v(row, 'wastage') / 100) * v(row, 'rate')) + v(row, 'mc')).toFixed(2); }
    amount += v(row, 'amount');
  }
  for (const [id, text] of [['rvLotItems', rows.length], ['rvLotQty', qty], ['rvLotWeight', rvLotFixed(weight) + ' g'], ['rvLotAmount', rvLotMoney(amount)]]) {
    const e = document.getElementById(id); if (e) e.textContent = text;
  }
};
window.rvLotSave = function(event) {
  event.preventDefault();
  const f = event.target, d = Object.fromEntries(new FormData(f)), items = [...f.querySelectorAll('[data-lot-row]')].map(row => {
    const get = k => row.querySelector('[data-lot="' + k + '"]')?.value || '';
    return { group: get('group'), product: get('product'), qty: rvLotNumber(get('qty')), weight: rvLotNumber(get('weight')), touch: rvLotNumber(get('touch')), rate: rvLotNumber(get('rate')), wastage: rvLotNumber(get('wastage')), mc: rvLotNumber(get('mc')), amount: rvLotNumber(get('amount')) };
  });
  if (!d.entryNo?.trim() || !d.ledgerName?.trim() || !d.date) return say('Enter entry number, date and ledger name.');
  if (rvLots().some(l => l.id !== d.id && String(l.entryNo).toLowerCase() === d.entryNo.trim().toLowerCase())) return say('That lot entry number already exists.');
  if (items.some(x => !x.group || d.entryType === 'By Product' && !x.product || x.qty < 1 || x.weight <= 0 || x.touch > 100 || x.wastage > 100)) return say('Complete the group, product, quantity, weight and valid percentages for each row.');
  if (d.id && !confirm('Save changes to this lot entry?')) return;
  const old = rvLots().find(l => l.id === d.id), now = new Date().toISOString();
  const lot = { ...(old || {}), id: d.id || crypto.randomUUID(), kind: 'retail-lot', accountType: 'customer', entryNo: d.entryNo.trim(), date: d.date, ledgerName: d.ledgerName.trim(), entryType: d.entryType, rowCount: items.length, remarks: d.remarks || '', status: d.status || 'Open', items, createdAt: old?.createdAt || now, updatedAt: now };
  const i = db.retailDocuments.findIndex(x => x.id === lot.id);
  if (i < 0) db.retailDocuments.push(lot); else db.retailDocuments[i] = lot;
  rvLotTab = 'list'; rvLotEdit = '';
  const pending = save();
  rvLotRefresh();
  rcSaveStatus(pending, 'Lot entry');
};
window.rvLotExport = function() {
  const lines = [['Entry no','Date','Ledger','Qty','Weight g','Tags','Tag qty','Tag wt g','Difference qty','Difference wt g','Amount','Status']];
  for (const lot of rvLots()) {
    const t = rvLotTotals(lot);
    lines.push([lot.entryNo, lot.date, lot.ledgerName, t.qty, rvLotFixed(t.weight), t.tags, t.tagQty, rvLotFixed(t.tagWeight), t.qty - t.tagQty, rvLotFixed(t.weight - t.tagWeight), t.amount, lot.status]);
  }
  const csv = lines.map(a => a.map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'lot-entries.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
if (typeof page !== 'undefined' && (page === 'Lot Entry' || page === 'Stock & Tagging') && typeof render === 'function') render();
