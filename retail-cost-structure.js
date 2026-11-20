// Retail-only Cost Structure (Weight-slab pricing, MC/Wastage/GST rules, Display customizer, and auto-lookup in Tagging & Estimation).
(function(){
  const RCS_GST_OPTS = [
    ['0', '0% (No Tax)'],
    ['0.25', '0.25% (Rough Diamonds)'],
    ['1.5', '1.5% GST (Cut/Polished)'],
    ['3', '3% (Gold, Silver, etc.)'],
    ['5', '5% (Essential Items)'],
    ['12', '12% (Standard Rate)'],
    ['18', '18% (Most Goods & Services)'],
    ['28', '28% (Luxury Items)']
  ];
  const RCS_MC_TYPES = ['Fixed', 'Per Gram', '%', '% Per Gram'];
  const RCS_WST_TYPES = ['%', 'GM'];

  const RCS_DISPLAY_GROUPS = {
    'Item Details': [['wastage','Wastage'],['gstPct','GST %'],['minWstType','Min Wst.Type'],['minWst','Min Wst'],['maxWstType','Max Wst.Type'],['maxWst','Max Wst']],
    'Quantity & Weight': [['fromWt','From Weight'],['toWt','To Weight'],['estCharge','Est Charge/Gm']],
    'Charges': [['mc','Making Charge'],['minMcType','Min Mc.Type'],['minMc','Min Mc'],['minMcAmt','Min MC Amount'],['minMcRate','Min MC Rate'],['maxMcType','Max Mc.Type'],['maxMc','Max Mc']],
    'Tax': [['rateTax','Rate + Tax']],
    'Amounts': [['va','V.A'],['rate','Rate'],['rateGm','Rate/GM']]
  };

  window.rcsState = window.rcsState || {
    search: '', filterOpen: false, showForm: false, editProduct: '', viewProduct: '',
    filter: { ornament: '', group: '', product: '', model: '' },
    display: JSON.parse(localStorage.getItem('goldleaf-cost-display') || '{"fromWt":true,"toWt":true,"va":true,"mc":true,"wastage":true,"rate":true,"estCharge":true,"minWstType":true,"minWst":true}'),
    listDisplay: JSON.parse(localStorage.getItem('goldleaf-cost-list-display') || '{"group":true,"product":true,"fromWt":true,"toWt":true,"va":true,"mc":true,"wastage":true,"rate":true,"estCharge":true,"actions":true}')
  };

  const docs = (t) => (window.rcDocs ? window.rcDocs(t) : (db.retailDocuments||[]).filter(d=>d.type===t));
  const saveDoc = (t, d) => {
    if(window.rcSaveDoc) return window.rcSaveDoc(t, d);
    if(!Array.isArray(db.retailDocuments)) db.retailDocuments=[];
    const now = new Date().toISOString();
    const row = Object.assign({ id: d.id || crypto.randomUUID(), type: t, createdAt: d.createdAt || now, updatedAt: now }, d);
    const i = db.retailDocuments.findIndex(x=>x.id===row.id);
    if(i<0) db.retailDocuments.unshift(row); else db.retailDocuments[i]=row;
    save(); pushCloud(); return row;
  };
  const delDoc = (t, id) => {
    if(window.rcDeleteDoc) return window.rcDeleteDoc(t, id);
    db.retailDocuments = (db.retailDocuments||[]).filter(x=>x.id!==id);
    save(); pushCloud();
  };
  const opts = (arr, cur, empty) => (empty!==undefined?'<option value="">'+esc(empty)+'</option>':'') + arr.map(v=>'<option value="'+esc(v)+'" '+(String(cur||'')===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('');

  // Public Cost Structure Slab Lookup (used in Tagging & Estimation)
  window.rcsLookupSlab = (productName, weight) => {
    const wt = n(weight);
    if(!productName || wt <= 0) return null;
    const pname = String(productName).trim().toLowerCase();
    const slabs = docs('retail-cost-structure').filter(s => String(s.product||'').trim().toLowerCase() === pname);
    if(!slabs.length) return null;
    return slabs.find(s => wt >= n(s.fromWeight) && wt <= n(s.toWeight)) || null;
  };

  function rcsAllGroups(){
    const set = new Set();
    docs('retail-product-group').forEach(g => { if(g.name) set.add(g.name); });
    docs('retail-product').forEach(p => { if(p.group) set.add(p.group); });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }

  function rcsProductsForGroup(grp){
    const prods = docs('retail-product');
    if(!grp) return prods;
    return prods.filter(p => String(p.group||'').toLowerCase() === String(grp).toLowerCase());
  }

  window.rcsOpenDisplayModal = (mode='form') => {
    document.getElementById('rcsDisplayModal')?.remove();
    const cur = mode==='list' ? rcsState.listDisplay : rcsState.display;
    let html = '<div id="rcsDisplayModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:740px">'
      + '<div class="retail-modal-head"><div><h2>Customize Cost Structure Columns</h2><p>Toggle columns shown in the table</p></div><button type="button" onclick="document.getElementById(\'rcsDisplayModal\').remove()">Close</button></div>'
      + '<div class="rco-display-cols">';
    for(const [grp, items] of Object.entries(RCS_DISPLAY_GROUPS)){
      html += '<div class="rco-display-group"><h4>'+esc(grp)+'</h4>';
      for(const [k, lbl] of items){
        html += '<label><input type="checkbox" data-rcs-disp="'+esc(k)+'" '+(cur[k]?'checked':'')+'> <span>'+esc(lbl)+'</span></label>';
      }
      html += '</div>';
    }
    html += '</div><div class="retail-modal-actions"><button type="button" class="primary" onclick="rcsSaveDisplay(\''+mode+'\')">Apply</button></div></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.rcsSaveDisplay = (mode) => {
    const target = mode==='list' ? rcsState.listDisplay : rcsState.display;
    document.querySelectorAll('#rcsDisplayModal [data-rcs-disp]').forEach(cb => { target[cb.dataset.rcsDisp] = cb.checked; });
    localStorage.setItem(mode==='list'?'goldleaf-cost-list-display':'goldleaf-cost-display', JSON.stringify(target));
    document.getElementById('rcsDisplayModal')?.remove();
    render();
  };

  function rcsSlabRowMarkup(s={}, idx=0){
    const d = rcsState.display;
    const gstOptsHtml = RCS_GST_OPTS.map(([v,lbl])=>'<option value="'+v+'" '+(String(s.gstPct||'0')===v?'selected':'')+'>'+esc(lbl)+'</option>').join('');
    return '<tr class="rcs-slab-row" data-id="'+esc(s.id||'')+'">'
      + '<td><input name="fromWeight" type="number" step=".001" min="0" value="'+(s.fromWeight??'')+'" placeholder="0.000" style="width:76px"></td>'
      + '<td><input name="toWeight" type="number" step=".001" min="0" value="'+(s.toWeight??'')+'" placeholder="0.000" style="width:76px"></td>'
      + (d.va?'<td><input name="va" type="number" step=".01" value="'+(s.va??'')+'" placeholder="V.A" style="width:70px"></td>':'')
      + (d.mc?'<td><select name="mcType">'+opts(RCS_MC_TYPES, s.mcType||'Fixed')+'</select></td><td><input name="mc" type="number" step=".01" value="'+(s.mc??'')+'" placeholder="MC" style="width:76px"></td>':'')
      + (d.wastage?'<td><select name="wstType">'+opts(RCS_WST_TYPES, s.wstType||'%')+'</select></td><td><input name="wst" type="number" step=".001" value="'+(s.wst??'')+'" placeholder="Wst" style="width:70px"></td>':'')
      + (d.rate?'<td><input name="rate" type="number" step=".01" value="'+(s.rate??'')+'" placeholder="Rate" style="width:82px" oninput="rcsCalcRowTax(this.closest(\'tr\'),\'rate\')"></td>':'')
      + (d.rateGm?'<td><input name="ratePerGm" type="number" step=".01" value="'+(s.ratePerGm??'')+'" placeholder="Rate/GM" style="width:76px"></td>':'')
      + (d.rateTax?'<td><input name="rateWithTax" type="number" step=".01" value="'+(s.rateWithTax??'')+'" placeholder="Rate+Tax" style="width:86px" oninput="rcsCalcRowTax(this.closest(\'tr\'),\'tax\')"></td>':'')
      + (d.gstPct?'<td><select name="gstPct" onchange="rcsCalcRowTax(this.closest(\'tr\'),\'rate\')">'+gstOptsHtml+'</select></td>':'')
      + (d.estCharge?'<td><input name="estChargePerGm" type="number" step=".01" value="'+(s.estChargePerGm??'')+'" placeholder="Est/Gm" style="width:76px"></td>':'')
      + (d.minMcType?'<td><select name="minMcType">'+opts(RCS_MC_TYPES, s.minMcType||'Fixed')+'</select></td>':'')
      + (d.minMc?'<td><input name="minMc" type="number" step=".01" value="'+(s.minMc??'')+'" style="width:70px"></td>':'')
      + (d.maxMcType?'<td><select name="maxMcType">'+opts(RCS_MC_TYPES, s.maxMcType||'Fixed')+'</select></td>':'')
      + (d.maxMc?'<td><input name="maxMc" type="number" step=".01" value="'+(s.maxMc??'')+'" style="width:70px"></td>':'')
      + (d.minWstType?'<td><select name="minWstType">'+opts(RCS_WST_TYPES, s.minWstType||'%')+'</select></td>':'')
      + (d.minWst?'<td><input name="minWst" type="number" step=".001" value="'+(s.minWst??'')+'" style="width:70px"></td>':'')
      + (d.maxWstType?'<td><select name="maxWstType">'+opts(RCS_WST_TYPES, s.maxWstType||'%')+'</select></td>':'')
      + (d.maxWst?'<td><input name="maxWst" type="number" step=".001" value="'+(s.maxWst??'')+'" style="width:70px"></td>':'')
      + (d.minMcAmt?'<td><input name="minMcAmt" type="number" step=".01" value="'+(s.minMcAmt??'')+'" style="width:76px"></td>':'')
      + (d.minMcRate?'<td><input name="minMcRate" type="number" step=".01" value="'+(s.minMcRate??'')+'" style="width:76px"></td>':'')
      + '<td style="white-space:nowrap"><button type="button" onclick="rcsAddSlabAfter(this.closest(\'tr\'))" title="Add next weight slab">＋</button> <button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove()" title="Remove row">×</button></td>'
      + '</tr>';
  }

  window.rcsCalcRowTax = (tr, source) => {
    if(!tr) return;
    const gst = n(tr.querySelector('[name="gstPct"]')?.value);
    const rateEl = tr.querySelector('[name="rate"]');
    const taxEl = tr.querySelector('[name="rateWithTax"]');
    if(!rateEl || !taxEl) return;
    if(source === 'rate'){
      const r = n(rateEl.value);
      taxEl.value = r > 0 ? (r * (1 + gst/100)).toFixed(2) : '';
    } else {
      const rt = n(taxEl.value);
      rateEl.value = rt > 0 ? (rt / (1 + gst/100)).toFixed(2) : '';
    }
  };

  window.rcsAddSlabAfter = (tr) => {
    const toWt = n(tr.querySelector('[name="toWeight"]')?.value);
    if(toWt <= 0) return say('To weight is invalid.');
    const nextFrom = (toWt + 0.001).toFixed(3);
    tr.insertAdjacentHTML('afterend', rcsSlabRowMarkup({ fromWeight: nextFrom }));
  };

  window.rcsGenerateRows = (cnt) => {
    const num = Math.max(1, Math.min(25, n(cnt)||1));
    const tb = document.getElementById('rcsSlabBody'); if(!tb) return;
    tb.innerHTML = '';
    for(let i=0;i<num;i++) tb.insertAdjacentHTML('beforeend', rcsSlabRowMarkup({}, i));
  };

  window.rcsOnGroupChange = (sel) => {
    const pSel = document.getElementById('rcsProductSelect');
    if(!pSel) return;
    const prods = rcsProductsForGroup(sel.value);
    pSel.innerHTML = prods.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>').join('');
  };

  window.rcsSaveCostStructure = (e) => {
    e.preventDefault(); const f = e.target;
    const group = f.productGroup.value.trim();
    const pSel = document.getElementById('rcsProductSelect');
    const selectedProducts = rcsState.editProduct ? [rcsState.editProduct] : Array.from(pSel?.selectedOptions||[]).map(o=>o.value).filter(Boolean);
    const typedProd = f.productText?.value?.trim();
    if(!selectedProducts.length && typedProd) selectedProducts.push(typedProd);
    if(!group || !selectedProducts.length) return say('Product Group and Product are required.');
    const model = f.model?.value?.trim() || '';

    const slabs = [];
    f.querySelectorAll('.rcs-slab-row').forEach(tr => {
      const fromWeight = n(tr.querySelector('[name="fromWeight"]')?.value);
      const toWeight = n(tr.querySelector('[name="toWeight"]')?.value);
      if(toWeight <= 0) return;
      slabs.push({
        existingId: tr.dataset.id || '',
        fromWeight, toWeight,
        va: n(tr.querySelector('[name="va"]')?.value),
        mcType: tr.querySelector('[name="mcType"]')?.value || 'Fixed',
        mc: n(tr.querySelector('[name="mc"]')?.value),
        wstType: tr.querySelector('[name="wstType"]')?.value || '%',
        wst: n(tr.querySelector('[name="wst"]')?.value),
        rate: n(tr.querySelector('[name="rate"]')?.value),
        ratePerGm: n(tr.querySelector('[name="ratePerGm"]')?.value),
        rateWithTax: n(tr.querySelector('[name="rateWithTax"]')?.value),
        gstPct: tr.querySelector('[name="gstPct"]')?.value || '0',
        estChargePerGm: n(tr.querySelector('[name="estChargePerGm"]')?.value),
        minMcType: tr.querySelector('[name="minMcType"]')?.value || 'Fixed',
        minMc: n(tr.querySelector('[name="minMc"]')?.value),
        maxMcType: tr.querySelector('[name="maxMcType"]')?.value || 'Fixed',
        maxMc: n(tr.querySelector('[name="maxMc"]')?.value),
        minWstType: tr.querySelector('[name="minWstType"]')?.value || '%',
        minWst: n(tr.querySelector('[name="minWst"]')?.value),
        maxWstType: tr.querySelector('[name="maxWstType"]')?.value || '%',
        maxWst: n(tr.querySelector('[name="maxWst"]')?.value),
        minMcAmt: n(tr.querySelector('[name="minMcAmt"]')?.value),
        minMcRate: n(tr.querySelector('[name="minMcRate"]')?.value)
      });
    });
    if(!slabs.length) return say('Enter at least one valid weight slab (To Weight > 0).');

    if(rcsState.editProduct){
      // Replace slabs for this edited product
      const oldIds = docs('retail-cost-structure').filter(x=>x.product===rcsState.editProduct).map(x=>x.id);
      oldIds.forEach(id => { db.retailDocuments = (db.retailDocuments||[]).filter(d=>d.id!==id); });
    }
    selectedProducts.forEach(prodName => {
      slabs.forEach(sl => {
        saveDoc('retail-cost-structure', {
          productGroup: group, product: prodName, model,
          fromWeight: sl.fromWeight, toWeight: sl.toWeight,
          va: sl.va, mcType: sl.mcType, mc: sl.mc, wstType: sl.wstType, wst: sl.wst,
          rate: sl.rate, ratePerGm: sl.ratePerGm, rateWithTax: sl.rateWithTax, gstPct: sl.gstPct,
          estChargePerGm: sl.estChargePerGm,
          minMcType: sl.minMcType, minMc: sl.minMc, maxMcType: sl.maxMcType, maxMc: sl.maxMc,
          minWstType: sl.minWstType, minWst: sl.minWst, maxWstType: sl.maxWstType, maxWst: sl.maxWst,
          minMcAmt: sl.minMcAmt, minMcRate: sl.minMcRate
        });
      });
    });
    rcsState.showForm = false; rcsState.editProduct = '';
    say('Cost Structure saved.'); render();
  };

  window.rcsCostStructurePage = () => {
    const all = docs('retail-cost-structure');

    if(rcsState.viewProduct){
      const rows = all.filter(x=>x.product===rcsState.viewProduct).sort((a,b)=>n(a.fromWeight)-n(b.fromWeight));
      const first = rows[0] || {};
      return header('Cost Structure · ' + rcsState.viewProduct, '<button type="button" onclick="rcsState.editProduct=\''+esc(rcsState.viewProduct)+'\';rcsState.showForm=true;rcsState.viewProduct=\'\';render()">Edit</button> <button type="button" onclick="rcsState.viewProduct=\'\';render()">← Back</button>')
        + '<section class="rco-section-card"><h3>Cost Structure Details</h3><p><b>Product Group:</b> '+esc(first.productGroup||'—')+' &nbsp;|&nbsp; <b>Product Name:</b> '+esc(rcsState.viewProduct)+' &nbsp;|&nbsp; <b>Model:</b> '+esc(first.model||'—')+'</p></section>'
        + '<section class="panel"><h2>Cost Structure Information ('+rows.length+' slabs)</h2>'
        + table(['S.No','From Weight','To Weight','V.A','MC','Wst','Rate','Rate + Tax','GST %','Rate/GM','Est.Charge/Gm','Min MC','Max MC','Min Wst','Max Wst'], rows.map((r,i)=>[
          i+1, fmt(r.fromWeight)+' g', fmt(r.toWeight)+' g', rateMoney(r.va),
          rateMoney(r.mc)+' ('+esc(r.mcType)+')', n(r.wst)+' '+esc(r.wstType),
          rateMoney(r.rate), rateMoney(r.rateWithTax), esc(r.gstPct||'0')+'%', rateMoney(r.ratePerGm), rateMoney(r.estChargePerGm),
          n(r.minMc)+' ('+esc(r.minMcType)+')', n(r.maxMc)+' ('+esc(r.maxMcType)+')',
          n(r.minWst)+' '+esc(r.minWstType), n(r.maxWst)+' '+esc(r.maxWstType)
        ])) + '</section>';
    }

    if(rcsState.showForm){
      const isEdit = !!rcsState.editProduct;
      const editRows = isEdit ? all.filter(x=>x.product===rcsState.editProduct).sort((a,b)=>n(a.fromWeight)-n(b.fromWeight)) : [{}];
      const first = editRows[0] || {};
      const groups = rcsAllGroups();
      const selGroup = first.productGroup || groups[0] || '';
      const prods = rcsProductsForGroup(selGroup);
      const d = rcsState.display;

      return header(isEdit ? 'Edit Cost Structure · '+rcsState.editProduct : 'Create Cost Structure', '<button type="button" onclick="rcsOpenDisplayModal(\'form\')">⚙️ Display</button> <button type="button" onclick="rcsState.showForm=false;rcsState.editProduct=\'\';render()">← Back</button>')
        + '<form onsubmit="rcsSaveCostStructure(event)">'
        + '<section class="rco-section-card"><h3>Header</h3><div class="rco-grid">'
        + '<label class="rco-field"><span>Product Group *</span><select name="productGroup" '+(isEdit?'readonly':'')+' onchange="rcsOnGroupChange(this)">'+opts(groups, selGroup, '-- Select Group --')+'</select></label>'
        + (isEdit
          ? '<label class="rco-field"><span>Product *</span><input name="productText" readonly value="'+esc(rcsState.editProduct)+'"></label>'
          : '<label class="rco-field"><span>Product * (Ctrl+Click for multi)</span><select id="rcsProductSelect" multiple size="3">'+prods.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>').join('')+'</select><input name="productText" placeholder="Or type new product name" style="margin-top:4px"></label>')
        + '<label class="rco-field"><span>Model</span><input name="model" value="'+esc(first.model||'')+'" placeholder="Optional"></label>'
        + (!isEdit ? '<label class="rco-field"><span>No of Rows</span><div style="display:flex;gap:6px"><input id="rcsNumRows" type="number" min="1" max="25" value="1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rcsGenerateRows(this.value);}"><button type="button" onclick="rcsGenerateRows(document.getElementById(\'rcsNumRows\').value)">Generate</button></div></label>' : '')
        + '</div></section>'
        + '<section class="rco-section-card"><h3>Weight Slabs</h3><div class="table" style="overflow-x:auto"><table><thead><tr>'
        + '<th>From Wt</th><th>To Wt</th>'
        + (d.va?'<th>V.A</th>':'')
        + (d.mc?'<th>Mc.Type</th><th>MC</th>':'')
        + (d.wastage?'<th>Wst.Type</th><th>Wst</th>':'')
        + (d.rate?'<th>Rate</th>':'')
        + (d.rateGm?'<th>Rate/GM</th>':'')
        + (d.rateTax?'<th>Rate + Tax</th>':'')
        + (d.gstPct?'<th>GST %</th>':'')
        + (d.estCharge?'<th>Est.Charge/Gm</th>':'')
        + (d.minMcType?'<th>Min Mc.Type</th>':'')
        + (d.minMc?'<th>Min MC</th>':'')
        + (d.maxMcType?'<th>Max Mc.Type</th>':'')
        + (d.maxMc?'<th>Max MC</th>':'')
        + (d.minWstType?'<th>Min Wst.Type</th>':'')
        + (d.minWst?'<th>Min Wst</th>':'')
        + (d.maxWstType?'<th>Max Wst.Type</th>':'')
        + (d.maxWst?'<th>Max Wst</th>':'')
        + (d.minMcAmt?'<th>Min MC Amt</th>':'')
        + (d.minMcRate?'<th>Min MC Rate</th>':'')
        + '<th>Actions</th></tr></thead><tbody id="rcsSlabBody">'+editRows.map(rcsSlabRowMarkup).join('')+'</tbody></table></div>'
        + '<div class="right" style="margin-top:14px"><button type="submit" class="primary" style="min-width:160px;font-weight:750">Save Cost Structure</button></div></section></form>';
    }

    // List View
    const q = rcsState.search.trim().toLowerCase();
    const filtered = all.filter(r => {
      if(q && !(String(r.product||'').toLowerCase().includes(q) || String(r.productGroup||'').toLowerCase().includes(q))) return false;
      if(rcsState.filter.group && r.productGroup !== rcsState.filter.group) return false;
      if(rcsState.filter.product && r.product !== rcsState.filter.product) return false;
      if(rcsState.filter.model && !String(r.model||'').toLowerCase().includes(rcsState.filter.model.toLowerCase())) return false;
      return true;
    }).sort((a,b)=>String(a.productGroup||'').localeCompare(String(b.productGroup||'')) || String(a.product||'').localeCompare(String(b.product||'')) || n(a.fromWeight)-n(b.fromWeight));

    return header('Cost Structure', '<button type="button" class="primary" onclick="rcsState.editProduct=\'\';rcsState.showForm=true;render()">＋ Create</button> <button type="button" onclick="rcsOpenDisplayModal(\'list\')">⚙️ Display Columns</button>')
      + '<section class="panel"><div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search By Product Name..." value="'+esc(rcsState.search)+'" oninput="rcsState.search=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" onclick="rcsState.filterOpen=!rcsState.filterOpen;render()">🔍 Filter</button><button type="button" onclick="rcsState.search=\'\';rcsState.filter={ornament:\'\',group:\'\',product:\'\',model:\'\'};render()">Reset</button></div></div>'
      + (rcsState.filterOpen ? '<div class="rco-filter-box"><label class="rco-field"><span>Product Group</span><select onchange="rcsState.filter.group=this.value;render()">'+opts(rcsAllGroups(), rcsState.filter.group, 'All Groups')+'</select></label><label class="rco-field"><span>Model</span><input value="'+esc(rcsState.filter.model)+'" oninput="rcsState.filter.model=this.value;render()"></label></div>' : '')
      + (filtered.length ? table(['Product Group','Product','From Wt','To Wt','V.A','MC','Wst','Rate','Est.Charge/Gm','Actions'], filtered.map(r=>[
        esc(r.productGroup||'—'), '<b>'+esc(r.product)+'</b>', fmt(r.fromWeight)+' g', fmt(r.toWeight)+' g',
        rateMoney(r.va), rateMoney(r.mc)+' <small class="muted">('+esc(r.mcType)+')</small>',
        n(r.wst)+' '+esc(r.wstType), rateMoney(r.rate), rateMoney(r.estChargePerGm),
        '<button type="button" class="primary" onclick="rcsState.viewProduct=\''+esc(r.product)+'\';render()">View</button> <button type="button" onclick="rcsState.editProduct=\''+esc(r.product)+'\';rcsState.showForm=true;render()">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete slab?\')){rcsDelSlab(\''+esc(r.id)+'\')}">×</button>'
      ])) : '<p class="empty">No cost structures defined yet. Click ＋ Create to add weight-slab MC & Wastage rules.</p>')
      + '</section>';
  };
  window.rcsDelSlab = (id) => { delDoc('retail-cost-structure', id); render(); };

  // Auto-apply Cost Structure slab in Estimation Manual Entry when weight changes
  document.addEventListener('change', (e) => {
    const manualCard = e.target.closest?.('#rcQuoteManualCard');
    if(manualCard && (e.target.name==='mProduct' || e.target.name==='mGross' || e.target.name==='mLess')){
      const prod = manualCard.querySelector('[name="mProduct"]')?.value;
      const net = Math.max(0, n(manualCard.querySelector('[name="mGross"]')?.value) - n(manualCard.querySelector('[name="mLess"]')?.value));
      const slab = window.rcsLookupSlab(prod, net);
      if(slab){
        const wstEl = manualCard.querySelector('[name="mWastage"]');
        const mcEl = manualCard.querySelector('[name="mMakingRate"]');
        const mcModeEl = manualCard.querySelector('[name="mMakingMode"]');
        if(wstEl && slab.wst > 0) wstEl.value = slab.wst;
        if(mcEl && slab.mc > 0) mcEl.value = slab.mc;
        if(mcModeEl && slab.mcType){
          mcModeEl.value = slab.mcType==='Per Gram' ? 'gram' : (slab.mcType==='%'||slab.mcType==='% Per Gram') ? 'percent' : 'fixed';
        }
      }
    }
  });

  function rcsNavigation(){
    const nav = document.getElementById('nav'); if(!nav) return;
    nav.querySelectorAll('[data-rcs-sidebar]').forEach(b=>b.remove());
    const more = document.getElementById('moreMenu');
    if(more) more.querySelectorAll('[data-rcs-nav]').forEach(b=>b.remove());
    if(!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;
    const anchor = nav.querySelector('[data-rga-sidebar="Parent Group"]') || nav.querySelector('[data-rc-sidebar="Products"]') || nav.firstElementChild;
    const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.rcsSidebar = 'Cost Structure';
    btn.setAttribute('aria-label', 'Cost Structure'); btn.title = 'Cost Structure';
    btn.classList.toggle('active', page === 'Cost Structure');
    if(page === 'Cost Structure') btn.setAttribute('aria-current', 'page');
    btn.onclick = () => { if(typeof window.go==='function') window.go('Cost Structure'); };
    btn.innerHTML = '<span class="nav-icon">'+erpIcon('plans')+'</span><span class="erp-nav-label">Cost Structure</span>';
    if(anchor) anchor.after(btn); else nav.append(btn);
    if(more){
      const mb = document.createElement('button'); mb.type = 'button'; mb.dataset.rcsNav = 'Cost Structure';
      mb.textContent = 'Cost Structure'; mb.onclick = () => { more.classList.remove('open'); if(typeof window.go==='function') window.go('Cost Structure'); };
      more.append(mb);
    }
    if(typeof erpFilterNavigation==='function') erpFilterNavigation(window.erpNavQuery||'');
  }

  const rcsPrevRender = window.render;
  window.render = function(){
    const res = rcsPrevRender.apply(this, arguments);
    if(session && typeof goldleafContext !== 'undefined' && goldleafContext?.has_access && workspaceMode === 'retail'){
      if(page === 'Cost Structure'){
        const appEl = document.getElementById('app');
        if(appEl) appEl.innerHTML = window.rcsCostStructurePage();
      }
    }
    rcsNavigation();
    return res;
  };
  render();
})();
