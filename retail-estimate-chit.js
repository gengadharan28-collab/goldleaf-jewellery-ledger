// Retail-only estimation, product master, tagging and chit workflows.
const RC_SECTIONS=['Bill','Sales Return','Receipt','Advance Amount','Metal Weight Advance'];
const RC_VERSION='2.10.38';
let rcSection=RC_SECTIONS.includes(localStorage.getItem('goldleaf-retail-section'))?localStorage.getItem('goldleaf-retail-section'):'Bill',rcChitTab='Group',rcProductEdit='',rcTagEdit='',rcEstimateEdit='';
let rcOldGoldItems=[],rcOldGoldEditId='',rcOldGoldFormLocked=false,rcOldGoldSyncedQuoteId=null;

const RC_DEFAULT_OLD_GOLD_TYPES=[
  { name: 'Old Gold', metal: 'Gold', touch: 91.6 },
  { name: '916 Hallmark Gold', metal: 'Gold', touch: 91.6 },
  { name: 'KDM / Non-Hallmark Gold', metal: 'Gold', touch: 85 },
  { name: 'Pure Gold (24K)', metal: 'Gold', touch: 100 },
  { name: 'Old Silver', metal: 'Silver', touch: 80 }
];

function rcGetCustomOldGoldTypes(){
  let custom = [];
  try {
    const raw = JSON.parse(localStorage.getItem('goldleaf-oldgold-types') || '[]');
    if(Array.isArray(raw)) custom = raw;
  } catch(e){}
  if(Array.isArray(db?.oldGoldTypes)){
    for(const item of db.oldGoldTypes){
      if(item && item.name && !custom.some(c => String(c.name).toLowerCase() === String(item.name).toLowerCase())){
        custom.push(item);
      }
    }
  }
  return custom;
}

function rcSaveCustomOldGoldTypes(list){
  try {
    localStorage.setItem('goldleaf-oldgold-types', JSON.stringify(list));
  } catch(e){}
  if(typeof db === 'object' && db){
    db.oldGoldTypes = list;
  }
  if(typeof save === 'function') save();
}

function rcGetAllOldGoldTypesForSettings(){
  const custom = rcGetCustomOldGoldTypes();
  const list = [];
  for(const def of RC_DEFAULT_OLD_GOLD_TYPES){
    const customMatch = custom.find(c => String(c.name || '').toLowerCase() === def.name.toLowerCase());
    if(customMatch){
      if(!customMatch.deleted){
        list.push({
          name: customMatch.name,
          metal: customMatch.metal === 'Silver' ? 'Silver' : 'Gold',
          touch: n(customMatch.touch) > 0 ? n(customMatch.touch) : def.touch,
          isBuiltin: true,
          isCustomized: true,
          deleted: false
        });
      }
    } else {
      list.push({
        name: def.name,
        metal: def.metal,
        touch: def.touch,
        isBuiltin: true,
        isCustomized: false,
        deleted: false
      });
    }
  }
  for(const c of custom){
    if(c && c.name && !c.deleted && !RC_DEFAULT_OLD_GOLD_TYPES.some(d => d.name.toLowerCase() === String(c.name).trim().toLowerCase())){
      list.push({
        name: String(c.name).trim(),
        metal: c.metal === 'Silver' ? 'Silver' : 'Gold',
        touch: n(c.touch) > 0 ? n(c.touch) : 91.6,
        isBuiltin: false,
        isCustomized: false,
        deleted: false
      });
    }
  }
  return list;
}

function rcSaveOldGoldType(name, metal, touch, originalName = ''){
  const cleanName = String(name || '').trim();
  if(!cleanName) throw new Error('Name cannot be empty');
  const cleanTouch = n(touch) > 0 ? n(touch) : 91.6;
  const cleanMetal = metal === 'Silver' ? 'Silver' : 'Gold';
  
  let custom = rcGetCustomOldGoldTypes();
  const origClean = String(originalName || '').trim();
  
  if(origClean){
    const def = RC_DEFAULT_OLD_GOLD_TYPES.find(d => d.name.toLowerCase() === origClean.toLowerCase());
    custom = custom.filter(c => String(c.name || '').toLowerCase() !== origClean.toLowerCase());
    if(def && origClean.toLowerCase() !== cleanName.toLowerCase()){
      custom.push({ name: def.name, deleted: true });
    }
  }
  
  const existingIdx = custom.findIndex(c => String(c.name || '').toLowerCase() === cleanName.toLowerCase());
  if(existingIdx >= 0){
    custom[existingIdx] = { name: cleanName, metal: cleanMetal, touch: cleanTouch, deleted: false };
  } else {
    custom.push({ name: cleanName, metal: cleanMetal, touch: cleanTouch, deleted: false });
  }
  rcSaveCustomOldGoldTypes(custom);
}

function rcDeleteOldGoldType(name){
  const clean = String(name || '').trim();
  let custom = rcGetCustomOldGoldTypes();
  const def = RC_DEFAULT_OLD_GOLD_TYPES.find(d => d.name.toLowerCase() === clean.toLowerCase());
  if(def){
    custom = custom.filter(c => String(c.name || '').toLowerCase() !== clean.toLowerCase());
    custom.push({ name: def.name, deleted: true });
  } else {
    custom = custom.filter(c => String(c.name || '').toLowerCase() !== clean.toLowerCase());
  }
  rcSaveCustomOldGoldTypes(custom);
}

function rcResetOldGoldType(name){
  const clean = String(name || '').trim();
  let custom = rcGetCustomOldGoldTypes();
  custom = custom.filter(c => String(c.name || '').toLowerCase() !== clean.toLowerCase());
  rcSaveCustomOldGoldTypes(custom);
}

function rcGetOldGoldTypeDefs(){
  return rcGetAllOldGoldTypesForSettings().filter(t => !t.deleted);
}

function rcOldGoldTypeOptions(selected='Old Gold'){
  const defs = rcGetOldGoldTypeDefs();
  const sel = String(selected || 'Old Gold').trim();
  const hasSel = defs.some(d => d.name === sel);
  const list = hasSel ? defs : [...defs, { name: sel, metal: sel.toLowerCase().includes('silver') ? 'Silver' : 'Gold', touch: 91.6 }];
  return list.map(d => '<option value="' + esc(d.name) + '" ' + (d.name === sel ? 'selected' : '') + '>' + esc(d.name) + '</option>').join('')
    + '<option value="__new__">＋ Create New Type...</option>';
}

function rcGetPureRateFromRateBook(typeName='Old Gold', form=null){
  const defs = rcGetOldGoldTypeDefs();
  const match = defs.find(d => d.name.toLowerCase() === String(typeName || '').trim().toLowerCase());
  const isSilver = (match?.metal === 'Silver') || String(typeName || '').toLowerCase().includes('silver');
  if(isSilver){
    return n(db?.rates?.silver) || n(db?.rates?.oldSilver) || n(db?.rates?.silverBoard) || n(db?.rateHistory?.[0]?.rates?.silver) || 0;
  }
  const f = form || (typeof document !== 'undefined' ? document.getElementById('rcEstimateForm') : null);
  return n(db?.rates?.gold24) || n(db?.rateHistory?.[0]?.rates?.gold24) || n(f?.elements?.goldRate?.value) || n(db?.rates?.oldGold) || 0;
}

function rcCalcOldGoldItem(raw={}, fallbackPureRate=0){
  const type = String(raw.type || 'Old Gold').trim() || 'Old Gold';
  const gross = n(raw.gross ?? raw.weight);
  const lessType = (raw.lessType === 'percent' || raw.lessType === '%') ? 'percent' : 'grams';
  const less = n(raw.less ?? raw.lessWeight ?? 0);
  const lessGrams = lessType === 'percent' ? rbGrams(gross * less / 100) : rbGrams(less);
  const netWeight = rbGrams(Math.max(0, gross - lessGrams));
  const bookPure = fallbackPureRate > 0 ? n(fallbackPureRate) : rcGetPureRateFromRateBook(type);
  const pureRate = n(raw.pureRate) > 0 ? n(raw.pureRate) : bookPure;
  const testing = n(raw.testing ?? raw.touch ?? raw.testingPurity ?? 91.6);
  const calcRate = pureRate > 0 ? rbRound(pureRate * testing / 100) : n(raw.rate);
  const rate = (raw.manualRate && n(raw.rate) > 0) ? n(raw.rate) : (calcRate > 0 ? calcRate : n(raw.rate));
  const calcAmount = rbRound(netWeight * rate);
  const amount = (raw.manualAmount && n(raw.amount) > 0) ? n(raw.amount) : (calcAmount > 0 ? calcAmount : n(raw.amount));
  const remarks = String(raw.remarks ?? raw.product ?? '').trim();
  const product = remarks || type || 'Old Gold';
  return {
    id: String(raw.id || ('og-' + Date.now())),
    type,
    gross,
    lessType,
    less,
    lessGrams,
    netWeight,
    pureRate,
    testing,
    rate,
    amount,
    remarks,
    product
  };
}

function rcNormalizeOldGoldItems(q){
  const fallbackPure = n(db?.rates?.gold24) || n(q?.goldRate) || n(q?.exchangePureRate) || n(q?.exchangeRate);
  if(Array.isArray(q?.exchangeItems) && q.exchangeItems.length > 0){
    return q.exchangeItems.map((x, idx) => {
      // Legacy records where pureRate wasn't saved separately: if rate === pureRate, compute from pureRate
      const hasPure = n(x.pureRate) > 0;
      const itemPure = hasPure ? n(x.pureRate) : fallbackPure;
      const calc = rcCalcOldGoldItem(Object.assign({}, x, {
        id: x.id || ('og-' + (idx + 1) + '-' + Date.now()),
        pureRate: itemPure,
        manualAmount: !hasPure && n(x.amount) > 0
      }), fallbackPure);
      return calc;
    }).filter(x => x.gross > 0 || x.amount > 0 || x.remarks);
  }
  const gross = n(q?.exchangeGross);
  const amount = n(q?.exchangeAmount);
  const prod = String(q?.exchangeProduct || '').trim();
  if(gross > 0 || amount > 0 || prod){
    return [rcCalcOldGoldItem({
      id: 'og-init-1',
      type: q?.exchangeType || 'Old Gold',
      gross,
      lessType: q?.exchangeLessType || 'grams',
      less: n(q?.exchangeLess || 0),
      pureRate: n(q?.exchangePureRate) || fallbackPure,
      testing: n(q?.exchangeTesting || 91.6),
      rate: n(q?.exchangeRate),
      amount,
      remarks: prod,
      manualAmount: amount > 0 && !q?.exchangePureRate
    }, fallbackPure)];
  }
  return [];
}

function rcCollectOldGoldData(form){
  const f = form || document.getElementById('rcEstimateForm');
  const fType = String(f?.elements?.exchangeType?.value || 'Old Gold').trim();
  const fGross = n(f?.elements?.exchangeGross?.value);
  const fLessType = f?.elements?.exchangeLessType?.value === 'percent' ? 'percent' : 'grams';
  const fLess = n(f?.elements?.exchangeLess?.value);
  const fPureRate = n(f?.elements?.exchangePureRate?.value) || rcGetPureRateFromRateBook(fType, f);
  const fTest = n(f?.elements?.exchangeTesting?.value || 91.6);
  const fRateInput = n(f?.elements?.exchangeRate?.value);
  const fDirectAmt = n(f?.elements?.exchangeAmount?.value);
  const fRemarks = String(f?.elements?.exchangeProduct?.value || '').trim();

  const draftItem = rcCalcOldGoldItem({
    id: rcOldGoldEditId || '__draft__',
    type: fType === '__new__' ? 'Old Gold' : fType,
    gross: fGross,
    lessType: fLessType,
    less: fLess,
    pureRate: fPureRate,
    testing: fTest,
    rate: fRateInput,
    amount: fDirectAmt,
    remarks: fRemarks,
    manualRate: f?.elements?.exchangeRate?.dataset?.manualRate === '1',
    manualAmount: f?.elements?.exchangeAmount?.dataset?.manualAmount === '1'
  }, fPureRate);

  const hasFormEntry = (draftItem.gross > 0 || draftItem.amount > 0);
  const list = rcOldGoldItems.map(x => Object.assign({}, x));

  if(rcOldGoldEditId){
    if(!rcOldGoldFormLocked){
      const idx = list.findIndex(x => x.id === rcOldGoldEditId);
      if(idx >= 0){
        list[idx] = Object.assign({}, draftItem, {
          id: rcOldGoldEditId,
          remarks: fRemarks || list[idx].remarks || '',
          product: fRemarks || list[idx].remarks || draftItem.type || ('Old Gold #' + (idx + 1))
        });
      }
    }
  } else if(hasFormEntry){
    list.push(Object.assign({}, draftItem, {
      id: '__draft__',
      isDraft: true
    }));
  }

  const validItems = list.filter(x => n(x.gross) > 0 || n(x.amount) > 0);
  const totalGross = rbGrams(validItems.reduce((s, x) => s + n(x.gross), 0));
  const totalLessGrams = rbGrams(validItems.reduce((s, x) => s + n(x.lessGrams), 0));
  const totalNet = rbGrams(validItems.reduce((s, x) => s + n(x.netWeight ?? x.gross), 0));
  const totalAmount = rbRound(validItems.reduce((s, x) => s + n(x.amount), 0));
  const combinedProduct = validItems.map(x => String(x.remarks || x.type || x.product || 'Old Gold').trim()).filter(Boolean).join(', ');
  const avgTesting = validItems[0]?.testing || fTest || 91.6;
  const avgRate = validItems[0]?.rate || draftItem.rate || fPureRate;

  return {
    items: validItems.map((x, idx) => Object.assign({}, x, {
      id: x.id === '__draft__' ? ('og-' + (idx + 1) + '-' + Date.now()) : x.id,
      product: String(x.remarks || x.type || x.product || ('Old Gold #' + (idx + 1))).trim()
    })),
    totalGross,
    totalLessGrams,
    totalNet,
    totalAmount,
    combinedProduct,
    avgTesting,
    avgRate,
    draftItem
  };
}

function rcRenderOldGoldItemsMarkup(form){
  const ogData = rcCollectOldGoldData(form);
  if(!rcOldGoldItems.length && !ogData.items.length){
    return '';
  }
  const rowsHtml = rcOldGoldItems.map((item, idx) => {
    const isEditing = !rcOldGoldFormLocked && rcOldGoldEditId === item.id;
    const isSelected = rcOldGoldFormLocked && rcOldGoldEditId === item.id;
    const d = isEditing ? (ogData.items.find(x => x.id === item.id) || item) : item;
    const lessLabel = d.lessType === 'percent' ? (n(d.less) + '% (' + fmt(d.lessGrams) + 'g)') : (fmt(d.less || 0) + ' g');
    const lessTypeLabel = d.lessType === 'percent' ? 'Percentage (%)' : 'Grams (g)';
    return '<tr class="rc-og-table-row ' + (isEditing ? 'is-editing' : isSelected ? 'is-selected' : '') + '">'
      + '<td data-label="#">'
      + '<span class="rc-og-item-idx">#' + (idx + 1) + '</span>'
      + (isEditing ? ' <span class="rc-og-state-pill editing">Editing</span>' : isSelected ? ' <span class="rc-og-state-pill saved">Saved</span>' : '')
      + '</td>'
      + '<td data-label="Type"><b>' + esc(d.type || 'Old Gold') + '</b></td>'
      + '<td data-label="Weight">' + fmt(d.gross) + ' g</td>'
      + '<td data-label="Less Type">' + esc(lessTypeLabel) + '</td>'
      + '<td data-label="Less">' + esc(lessLabel) + '</td>'
      + '<td data-label="Net Wt"><b>' + fmt(d.netWeight ?? d.gross) + ' g</b></td>'
      + '<td data-label="Pure Rate">' + rateMoney(d.pureRate) + '</td>'
      + '<td data-label="Touch(%)">' + n(d.testing || 91.6) + '%</td>'
      + '<td data-label="Rate"><b>' + rateMoney(d.rate) + '</b></td>'
      + '<td data-label="Amount"><b class="rc-og-item-amt">' + rateMoney(d.amount) + '</b></td>'
      + '<td data-label="Remarks">' + esc(d.remarks || d.product || '—') + '</td>'
      + '<td data-label="Actions" class="rc-og-actions-cell">'
      + '<div class="rc-og-item-btns">'
      + '<button type="button" class="rc-og-row-btn rc-og-row-edit" onclick="rcOldGoldEditItem(\'' + esc(item.id) + '\')">✎ Edit</button>'
      + '<button type="button" class="rc-og-row-btn rc-og-row-del" onclick="rcOldGoldRemoveItem(\'' + esc(item.id) + '\')" title="Remove item">✕</button>'
      + '</div>'
      + '</td>'
      + '</tr>';
  }).join('');

  return '<div class="rc-og-list-box">'
    + (rcOldGoldItems.length > 0 ? (
      '<div class="rc-og-list-head">'
      + '<span>Saved Old Gold Items (' + rcOldGoldItems.length + ')</span>'
      + (rcOldGoldItems.length > 1 ? '<button type="button" class="rc-og-clear-all-btn" onclick="rcOldGoldClearAll()">Clear All</button>' : '')
      + '</div>'
      + '<div class="rc-og-table-scroll">'
      + '<table class="rc-og-items-table">'
      + '<thead><tr>'
      + '<th>#</th><th>Type</th><th>Weight</th><th>Less Type</th><th>Less</th><th>Net Wt</th><th>Pure Rate</th><th>Touch(%)</th><th>Rate</th><th>Amount</th><th>Remarks</th><th>Actions</th>'
      + '</tr></thead>'
      + '<tbody>' + rowsHtml + '</tbody>'
      + '</table>'
      + '</div>'
    ) : '')
    + '<div class="rc-og-list-foot">'
    + '<span>Total Old Gold (<b id="rcOgTotalCount">' + ogData.items.length + '</b> ' + (ogData.items.length === 1 ? 'Item' : 'Items') + ' · Wt: <b id="rcOgTotalGross">' + fmt(ogData.totalGross) + ' g</b> · Net Wt: <b id="rcOgTotalNet">' + fmt(ogData.totalNet) + ' g</b>)</span>'
    + '<b id="rcOgTotalAmount" class="rc-og-list-total-val">' + rateMoney(ogData.totalAmount) + '</b>'
    + '</div>'
    + '</div>';
}
function rcAllowed(){return !!(session&&goldleafContext?.has_access&&goldleafContext.retail_enabled&&!erpIsAdmin()&&workspaceMode==='retail')}
function rcEnsure(){if(!Array.isArray(db.retailDocuments))db.retailDocuments=[];}
function rcSaveStatus(promise,label){const show=()=>{const status=document.getElementById('cloudState')?.textContent||'';say(/^Cloud(?: sync)? ·/.test(status)?label+' saved to cloud.':(status.startsWith('Sync issue')||status.startsWith('Entry saved here'))?'Saved on this device only. Cloud sync failed: '+(window.v2LastSyncError||'check Settings → Cloud account.'):label+' saved on this device. Sign in to sync across devices.')};if(promise&&typeof promise.then==='function')promise.then(show);else show()}
function rcDocs(kind){rcEnsure();return db.retailDocuments.filter(x=>x.kind===kind)}
function rcRows(){return typeof rcQuoteReadRows==='function'?rcQuoteReadRows():[];}
function rcItemRow(x={}){const products=rcDocs('retail-product'),name=String(x.product||''),purity=Number(x.purity||22),rate=n(x.rate)||v2RateForPurity(purity),tags=rcDocs('retail-tagging').filter(t=>t.status==='In stock'||t.tagCode===x.tagCode);return '<div class="rc-item" data-id="'+esc(x.id||crypto.randomUUID())+'"><label>Product<select data-rc="product" required><option value="">Select product</option>'+[...new Set([...products.map(p=>p.name),...db.products,name].filter(Boolean))].map(p=>'<option '+(p===name?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select></label><label>Tag / barcode<select data-rc="tagCode" onchange="rcApplyTag(this)"><option value="">No tag</option>'+tags.map(t=>'<option value="'+esc(t.tagCode)+'" '+(x.tagCode===t.tagCode?'selected':'')+'>'+esc(t.tagCode)+' · '+esc(t.product)+'</option>').join('')+'</select></label><label>Pieces<input data-rc="pieces" type="number" min="1" step="1" value="'+(x.pieces||1)+'"></label><label>Gross g<input data-rc="grossWeight" type="number" min="0.001" step=".001" required value="'+(x.grossWeight??x.weight??'')+'"></label><label>Less g<input data-rc="lessWeight" type="number" min="0" step=".001" value="'+(x.lessWeight||0)+'"></label><label>Purity K<input data-rc="purity" type="number" min="1" max="24" step=".01" value="'+purity+'"></label><label>Wastage %<input data-rc="wastage" type="number" min="0" max="100" step=".01" value="'+(x.wastage||0)+'"></label><label>Rate / g ₹<input data-rc="rate" type="number" min="0" step=".01" value="'+rate+'"></label><label>Making / piece ₹<input data-rc="makingRate" type="number" min="0" step=".01" value="'+(x.makingRate||0)+'"></label><output class="rc-line-value">'+rateMoney(rbItemCalc(Object.assign({},x,{purity,rate})).subtotal)+'</output><button type="button" aria-label="Remove item" onclick="rcRemoveItem(this)">Remove</button></div>'}
window.rcApplyTag=function(select){const t=rcDocs('retail-tagging').find(x=>x.tagCode===select.value),row=select.closest('.rc-item');if(!t||!row)return;for(const [k,v] of Object.entries({product:t.product,pieces:t.pieces,grossWeight:t.grossWeight,lessWeight:t.lessWeight,purity:t.purity,wastage:t.wastage,wastageMode:t.wastageMode,rate:t.rate,makingRate:t.makingRate,makingMode:t.makingMode,huid:t.huid,stonePieces:t.stonePieces,stoneWeight:t.stoneCarat,certificateCharge:t.stoneCharge,productGroup:t.group,description:t.printName,hsn:t.hsn})){const el=row.querySelector('[data-rc="'+k+'"]');if(el)el.value=v}row.closest('form').dataset.entryDirty='1';rcRecalc()};
const rcPriorItemMarkup=window.rbItemMarkup;window.rbItemMarkup=function(item,index){const html=rcPriorItemMarkup(item,index);if(workspaceMode!=='retail')return html;const options=[...new Set([...db.products,...rcDocs('retail-product').map(p=>p.name),item.product].filter(Boolean))].map(p=>'<option value="'+esc(p)+'" '+(p===item.product?'selected':'')+'>'+esc(p)+'</option>').join('');return html.replace(/<td class="rb-product">[\s\S]*?<\/td>/,'<td class="rb-product"><select data-item="product" onchange="rcApplyProduct(this)"><option value="">Select product</option>'+options+'</select></td>')};
window.rcApplyProduct=function(select){const form=select.closest('form'),row=select.closest('.rb-item'),p=rcDocs('retail-product').find(x=>x.name===select.value);if(!p)return;const metal=p.metalType||(String(p.name||'').toLowerCase().includes('silver')?'Silver':'Gold'),isSilver=metal==='Silver'||String(p.name||'').toLowerCase().includes('silver');row.dataset.metalType=metal;let mField=row.querySelector('[data-item="metalType"]');if(!mField){row.insertAdjacentHTML('beforeend','<input type="hidden" data-item="metalType">');mField=row.querySelector('[data-item="metalType"]');}if(mField)mField.value=metal;const purity=row.querySelector('[data-item="purity"]'),purCell=row.querySelector('.rb-purity-cell')||purity?.closest('td');let naSpan=row.querySelector('.rb-purity-na');if(isSilver){if(purity){purity.style.display='none';if(![...purity.options].some(o=>Number(o.value)===n(p.purity||92.5)))purity.add(new Option((p.purity||92.5)+'%',p.purity||92.5));purity.value=p.purity||92.5;}if(!naSpan&&purCell){purCell.insertAdjacentHTML('afterbegin','<span class="rb-purity-na muted">—</span>');}else if(naSpan){naSpan.style.display='inline';}}else{if(naSpan)naSpan.style.display='none';if(purity){purity.style.display='';if(![...purity.options].some(o=>Number(o.value)===n(p.purity||22)))purity.add(new Option((p.purity||22)+'K',p.purity||22));purity.value=p.purity||22;}}for(const [key,value] of [['wastage',p.wastage],['wastageMode',p.wastageMode],['makingRate',p.makingRate],['makingMode',p.makingMode]]){const field=row.querySelector('[data-item="'+key+'"]');if(field&&n(value)>0)field.value=value}const rateVal=typeof window.rcRateForMetal==='function'?window.rcRateForMetal(metal,p.purity||(isSilver?92.5:22),p.rateType,p.manualRate):v2RateForPurity(p.purity||22);const rateIn=row.querySelector('[data-item="rate"]');if(rateIn&&rateVal>0)rateIn.value=Number(rateVal).toFixed(2);rbMarkDirty(form);rbRecalc(form);};
window.rcRemoveItem=function(b){if(document.querySelectorAll('#rcQuoteTable tbody tr.rc-quote-row').length<2)return say('Keep at least one jewellery item.');b.closest('tr.rc-quote-row')?.remove();rcRecalc()};
window.rcAddItem=function(item){document.querySelector('#rcQuoteTable tbody')?.insertAdjacentHTML('beforeend',rcQuoteItemRow(item||{},document.querySelectorAll('#rcQuoteTable tbody tr.rc-quote-row').length));rcRecalc()};

function rcChitOptions(customerId='',selected=''){const maps=rcDocs('retail-chit-mapping').filter(m=>!customerId||m.customerId===customerId);return '<option value="">No chit linked</option>'+maps.map(m=>{const t=rcDocs('retail-chit-type').find(z=>z.id===m.typeId);return '<option value="'+esc(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(m.chitNumber)+' · '+esc(t?.name||'Chit')+'</option>'}).join('')}
function rcChitSelect(customerId='',selected='',name='chitMappingId'){return '<label>Chit Info<select name="'+name+'"><option value="">No chit linked</option>'+rcDocs('retail-chit-mapping').filter(m=>!customerId||m.customerId===customerId).map(m=>{const t=rcDocs('retail-chit-type').find(z=>z.id===m.typeId);return '<option value="'+esc(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(m.chitNumber)+' · '+esc(t?.name||'Chit')+'</option>'}).join('')+'</select></label>'}

let rcQuoteMode = 'tag';
window.rcSetQuoteMode = function(mode){
  rcQuoteMode = mode;
  const f = document.getElementById('rcEstimateForm');
  if(!f) return;
  const items = rcQuoteReadRows();
  rcQuoteItemsCache = items;
  render();
};

let rcQuoteItemsCache = [];

function rcQuoteItemRow(x={}, i=0){
  const products = rcDocs('retail-product'),
        name = String(x.product||''),
        p = products.find(z=>z.id===x.productId)||products.find(z=>z.name===name),
        metal = x.metalType || p?.metalType || (name.toLowerCase().includes('silver')?'Silver':'Gold'),
        isSilver = metal === 'Silver' || name.toLowerCase().includes('silver'),
        purity = Number(x.purity || p?.purity || (isSilver?92.5:92)),
        rateVal = (x.rate!==undefined&&x.rate!==null&&x.rate!=='')?n(x.rate):rcRateForMetal(metal, purity, p?.rateType, p?.manualRate),
        gross = n(x.grossWeight??x.weight??0),
        stoneWt = n(x.stoneWeight??x.lessWeight??0),
        net = n(x.netWeight??Math.max(0, gross - stoneWt)),
        wstMode = x.wastageMode || p?.wastageMode || 'percent',
        wst = n(x.wastage??p?.wastage??0),
        mcMode = x.makingMode || p?.makingMode || 'piece',
        mcRate = n(x.makingRate??p?.makingRate??0),
        stoneAmt = n(x.stoneAmount??x.stoneCharge??p?.stoneCharge??0),
        valAdded = n(x.valueAdded||0),
        pcs = n(x.pieces||1);

  // Calculate line total using rbItemCalc
  const calc = rbItemCalc({
    grossWeight: gross,
    lessWeight: stoneWt,
    stoneWeight: stoneWt,
    netWeight: net,
    purity,
    metalType: metal,
    rate: rateVal,
    wastage: wst,
    wastageMode: wstMode,
    makingRate: mcRate,
    makingMode: mcMode,
    stoneAmount: stoneAmt,
    otherAmount: rbRound(valAdded * net),
    pieces: pcs
  });
  const lineTotal = calc.subtotal;
  const form = document.getElementById('rcEstimateForm');
  const gstRate = (form?.elements.gstEnabled?.checked !== false) ? n(form?.elements.gstRate?.value || 3) : 0;
  const rateTax = rbRound(rateVal * (1 + gstRate / 100));

  return '<tr class="rc-quote-row" data-id="'+esc(x.id||crypto.randomUUID())+'">'
    +'<td class="rc-index" data-label="Item #"><span class="rc-q-idx-badge">#'+(i+1)+'</span></td>'
    +'<td class="rc-q-cell-tag" data-label="Tag / Barcode"><div class="rc-q-tag-wrap"><input data-q="tagCode" value="'+esc(x.tagCode||'')+'" placeholder="Tag / Code" onchange="window.rcQuoteRowTagChanged&&rcQuoteRowTagChanged(this)"><button type="button" class="gl-scan-btn gl-scan-btn-embedded" onclick="window.openQrScannerForQuoteRow&&openQrScannerForQuoteRow(this)" title="Scan Tag" aria-label="Scan Tag">'+(window.glScanIconSvg||'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm8 0h4v4h-4V8zm-6 6h4v4H7v-4zm6-2h4v1h-4v-1zm0 3h2v1h-2v-1z"/></svg>')+'</button></div><input type="hidden" data-q="huid" value="'+esc(x.huid||'')+'"><input type="hidden" data-q="productId" value="'+esc(p?.id||x.productId||'')+'"></td>'
    +'<td class="rc-q-cell-product" data-label="Product Name"><input data-q="product" list="rcQuoteProdList" value="'+esc(name)+'" placeholder="Product name" onchange="window.rcQuoteRowProductChanged&&rcQuoteRowProductChanged(this)"></td>'
    +'<td class="rc-q-cell-metal" data-label="Metal"><select data-q="metalType" onchange="rcQuoteRowMetalChanged(this)"><option value="Gold" '+(metal==='Gold'?'selected':'')+'>Gold</option><option value="Silver" '+(metal==='Silver'?'selected':'')+'>Silver</option><option value="Platinum" '+(metal==='Platinum'?'selected':'')+'>Platinum</option></select></td>'
    +'<td class="rc-q-cell-purity" data-label="Purity %">'+(isSilver?'<input data-q="purity" type="hidden" value="'+purity+'"><span class="rc-q-purity-na muted">—</span>':'<input data-q="purity" type="number" min="1" max="100" step=".01" value="'+purity+'" oninput="rcQuoteRowPurityChanged(this)">')+'</td>'
    +'<td class="rc-q-cell-gross" data-label="Gross Wt (g)"><input data-q="grossWeight" type="number" min="0" step=".001" value="'+(gross||'')+'" placeholder="0.000" oninput="rcQuoteRowCalc(this)"></td>'
    +'<td class="rc-q-cell-stone" data-label="Stone Wt (g)"><input data-q="stoneWeight" type="number" min="0" step=".001" value="'+(stoneWt||0)+'" oninput="rcQuoteRowCalc(this)"><input type="hidden" data-q="stoneAmount" value="'+stoneAmt+'"></td>'
    +'<td class="rc-q-cell-net" data-label="Net Wt (g)"><input data-q="netWeight" type="number" min="0" step=".001" value="'+fmt(net)+'" oninput="this.dataset.manualNet=\'1\';rcQuoteRowCalc(this)"></td>'
    +'<td class="rc-q-cell-wastage" data-label="Wastage"><div class="rc-q-combo"><select data-q="wastageMode" onchange="rcQuoteRowCalc(this)"><option value="percent" '+(wstMode==='percent'?'selected':'')+'>%</option><option value="grams" '+(wstMode==='grams'?'selected':'')+'>g</option></select><input data-q="wastage" type="number" min="0" step=".01" value="'+wst+'" oninput="rcQuoteRowCalc(this)"></div></td>'
    +'<td class="rc-q-cell-making" data-label="Making Charge"><div class="rc-q-combo"><select data-q="makingMode" onchange="rcQuoteRowCalc(this)"><option value="piece" '+(mcMode==='piece'?'selected':'')+'>/pc</option><option value="gram" '+(mcMode==='gram'?'selected':'')+'>/g</option><option value="fixed" '+(mcMode==='fixed'?'selected':'')+'>Fix</option><option value="percent" '+(mcMode==='percent'?'selected':'')+'>%</option></select><input data-q="makingRate" type="number" min="0" step=".01" value="'+mcRate+'" oninput="rcQuoteRowCalc(this)"></div></td>'
    +'<td class="rc-q-cell-rate" data-label="Rate ₹/g"><input data-q="rate" type="number" min="0" step=".01" value="'+rateVal.toFixed(2)+'" oninput="rcQuoteRowCalc(this)"></td>'
    +'<td class="rc-q-cell-ratetax" data-label="Rate + GST"><span class="rc-q-ratetax">₹'+rateTax.toFixed(2)+'</span><input type="hidden" data-q="valueAdded" value="'+valAdded+'"><input type="hidden" data-q="pieces" value="'+pcs+'"></td>'
    +'<td class="rc-q-cell-amount" data-label="Line Amount"><b class="rc-q-lineamount">'+rateMoney(lineTotal)+'</b></td>'
    +'<td class="rc-q-cell-remove" data-label=""><button type="button" class="rc-tag-remove" onclick="rcQuoteRemoveRow(this)" aria-label="Remove item">×</button></td>'
    +'</tr>';
}

function rcQuoteReadRows(){
  return [...document.querySelectorAll('#rcQuoteTable tbody tr.rc-quote-row')].map(r=>{
    const g = k => r.querySelector('[data-q="'+k+'"]')?.value;
    const gross = n(g('grossWeight')), stoneWt = n(g('stoneWeight')), manualNet = r.querySelector('[data-q="netWeight"]')?.dataset.manualNet==='1';
    const net = manualNet ? n(g('netWeight')) : rbGrams(Math.max(0, gross - stoneWt));
    const rate = n(g('rate')), wst = n(g('wastage')), wstMode = g('wastageMode')||'percent';
    const mcRate = n(g('makingRate')), mcMode = g('makingMode')||'piece', pcs = n(g('pieces'))||1;
    const stoneAmt = n(g('stoneAmount')), valAdded = n(g('valueAdded'));
    const purity = n(g('purity'))||22;
    const metalType = g('metalType')||'Gold';

    const itemCalc = rbItemCalc({
      grossWeight: gross,
      lessWeight: stoneWt,
      stoneWeight: stoneWt,
      netWeight: net,
      purity,
      metalType,
      rate,
      wastage: wst,
      wastageMode: wstMode,
      makingRate: mcRate,
      makingMode: mcMode,
      stoneAmount: stoneAmt,
      otherAmount: rbRound(valAdded * net),
      pieces: pcs
    });

    const form = document.getElementById('rcEstimateForm');
    const gstRate = (form?.elements.gstEnabled?.checked !== false) ? n(form?.elements.gstRate?.value || 3) : 0;

    return Object.assign({}, itemCalc, {
      id: r.dataset.id || crypto.randomUUID(),
      tagCode: (g('tagCode')||'').trim(),
      huid: (g('huid')||'').trim(),
      productId: g('productId')||'',
      product: (g('product')||'').trim(),
      metalType: metalType,
      purity: purity,
      rateWithTax: rbRound(rate * (1 + gstRate / 100)),
      valueAdded: valAdded
    });
  });
}

window.rcQuoteRowCalc = function(input){
  const row = input.closest('tr.rc-quote-row');
  if(!row) return;
  const gross = n(row.querySelector('[data-q="grossWeight"]')?.value);
  const stoneWt = n(row.querySelector('[data-q="stoneWeight"]')?.value);
  const netIn = row.querySelector('[data-q="netWeight"]');
  if(netIn && netIn.dataset.manualNet !== '1'){
    netIn.value = fmt(Math.max(0, gross - stoneWt));
  }
  const net = n(netIn?.value ?? Math.max(0, gross - stoneWt));
  const rate = n(row.querySelector('[data-q="rate"]')?.value);
  const wst = n(row.querySelector('[data-q="wastage"]')?.value);
  const wstMode = row.querySelector('[data-q="wastageMode"]')?.value || 'percent';
  const mcRate = n(row.querySelector('[data-q="makingRate"]')?.value);
  const mcMode = row.querySelector('[data-q="makingMode"]')?.value || 'piece';
  const pcs = n(row.querySelector('[data-q="pieces"]')?.value) || 1;
  const stoneAmt = n(row.querySelector('[data-q="stoneAmount"]')?.value);
  const valAdded = n(row.querySelector('[data-q="valueAdded"]')?.value);
  const purity = n(row.querySelector('[data-q="purity"]')?.value) || 22;
  const metalType = row.querySelector('[data-q="metalType"]')?.value || 'Gold';

  const itemCalc = rbItemCalc({
    grossWeight: gross,
    lessWeight: stoneWt,
    stoneWeight: stoneWt,
    netWeight: net,
    purity,
    metalType,
    rate,
    wastage: wst,
    wastageMode: wstMode,
    makingRate: mcRate,
    makingMode: mcMode,
    stoneAmount: stoneAmt,
    otherAmount: rbRound(valAdded * net),
    pieces: pcs
  });

  const form = document.getElementById('rcEstimateForm');
  const gstOn = !!form?.elements.gstEnabled?.checked;
  const gstRate = gstOn ? n(form?.elements.gstRate?.value || 3) : 0;

  const outTax = row.querySelector('.rc-q-ratetax');
  if(outTax) outTax.textContent = '₹' + (rate * (1 + gstRate / 100)).toFixed(2);
  const outTot = row.querySelector('.rc-q-lineamount');
  if(outTot) outTot.textContent = rateMoney(itemCalc.subtotal);

  rcRecalc();
};

window.rcQuoteRowMetalChanged = function(select){
  const row = select.closest('tr.rc-quote-row');
  if(!row) return;
  const metal = select.value;
  const isSilver = metal==='Silver';
  const cell = row.querySelector('.rc-q-cell-purity');
  const purityIn = row.querySelector('[data-q="purity"]');
  let purityVal = purityIn ? (purityIn.value || (isSilver ? 92.5 : 92)) : (isSilver ? 92.5 : 92);
  if(cell){
    if(isSilver){
      cell.innerHTML = '<input data-q="purity" type="hidden" value="'+purityVal+'"><span class="rc-q-purity-na muted">—</span>';
    } else {
      cell.innerHTML = '<input data-q="purity" type="number" min="1" max="100" step=".01" value="'+(Number(purityVal)<=24?purityVal:92)+'" oninput="rcQuoteRowPurityChanged(this)">';
    }
  }
  const p = rcDocs('retail-product').find(z=>z.id===row.querySelector('[data-q="productId"]')?.value);
  const rate = rcRateForMetal(metal, purityVal||(isSilver?92.5:92), p?.rateType, p?.manualRate);
  const rateIn = row.querySelector('[data-q="rate"]');
  if(rateIn) rateIn.value = rate > 0 ? rate.toFixed(2) : '';
  rcQuoteRowCalc(select);
};

window.rcQuoteRowPurityChanged = function(input){
  const row = input.closest('tr.rc-quote-row');
  if(!row) return;
  const metal = row.querySelector('[data-q="metalType"]')?.value || 'Gold';
  const p = rcDocs('retail-product').find(z=>z.id===row.querySelector('[data-q="productId"]')?.value);
  const rate = rcRateForMetal(metal, input.value, p?.rateType, p?.manualRate);
  const rateIn = row.querySelector('[data-q="rate"]');
  if(rateIn && rate > 0) rateIn.value = rate.toFixed(2);
  rcQuoteRowCalc(input);
};

window.rcQuoteRowProductChanged = function(input){
  const row = input.closest('tr.rc-quote-row');
  if(!row) return;
  const name = String(input.value||'').trim();
  const p = rcDocs('retail-product').find(z=>String(z.name||'').toLowerCase()===name.toLowerCase());
  const metal = p?.metalType || (name.toLowerCase().includes('silver')?'Silver':row.querySelector('[data-q="metalType"]')?.value||'Gold');
  const mSel = row.querySelector('[data-q="metalType"]');
  if(mSel) mSel.value = metal;
  const isSilver = metal === 'Silver';
  const cell = row.querySelector('.rc-q-cell-purity');
  const purity = Number(p?.purity || (isSilver ? 92.5 : 92));
  if(cell){
    if(isSilver){
      cell.innerHTML = '<input data-q="purity" type="hidden" value="'+purity+'"><span class="rc-q-purity-na muted">—</span>';
    } else {
      cell.innerHTML = '<input data-q="purity" type="number" min="1" max="100" step=".01" value="'+purity+'" oninput="rcQuoteRowPurityChanged(this)">';
    }
  }
  if(p){
    const setVal = (key, val) => { const el = row.querySelector('[data-q="'+key+'"]'); if(el && val !== undefined && val !== null) el.value = val; };
    setVal('productId', p.id);
    setVal('huid', p.huid || '');
    setVal('wastageMode', p.wastageMode || 'percent');
    setVal('wastage', n(p.wastage || 0));
    setVal('makingMode', p.makingMode || 'piece');
    setVal('makingRate', n(p.makingRate || 0));
  }
  const rate = rcRateForMetal(metal, purity, p?.rateType, p?.manualRate);
  const rateIn = row.querySelector('[data-q="rate"]');
  if(rateIn) rateIn.value = rate > 0 ? rate.toFixed(2) : '';
  rcQuoteRowCalc(input);
};

window.rcQuoteRowTagChanged = function(input){
  const row = input.closest('tr.rc-quote-row');
  if(!row) return;
  const code = String(input.value || '').trim().toUpperCase();
  if(!code) return;
  input.value = code;
  const tag = rcDocs('retail-tagging').find(t => String(t.tagCode||'').toUpperCase() === code && (t.status||'In stock') === 'In stock');
  if(!tag){
    say('Tag "' + code + '" not found in stock.');
    return;
  }
  const p = rcDocs('retail-product').find(z => z.id===tag.productId || String(z.name||'').toLowerCase()===String(tag.product||'').toLowerCase());
  const setVal = (key, val) => { const el = row.querySelector('[data-q="'+key+'"]'); if(el && val !== undefined && val !== null) el.value = val; };
  setVal('huid', tag.huid || p?.huid || '');
  setVal('productId', tag.productId || p?.id || '');
  setVal('product', tag.product || p?.name || '');
  const metal = tag.metalType || p?.metalType || (String(tag.product||'').toLowerCase().includes('silver')?'Silver':'Gold');
  setVal('metalType', metal);
  const isSilver = metal === 'Silver';
  const cell = row.querySelector('.rc-q-cell-purity');
  const purity = Number(tag.purity || p?.purity || (isSilver ? 92.5 : 92));
  if(cell){
    if(isSilver){
      cell.innerHTML = '<input data-q="purity" type="hidden" value="'+purity+'"><span class="rc-q-purity-na muted">—</span>';
    } else {
      cell.innerHTML = '<input data-q="purity" type="number" min="1" max="100" step=".01" value="'+purity+'" oninput="rcQuoteRowPurityChanged(this)">';
    }
  } else {
    setVal('purity', purity);
  }
  const gross = n(tag.grossWeight || p?.defaultWeight || 0);
  const stoneWt = n(tag.lessWeight || tag.stoneWeight || 0);
  setVal('grossWeight', gross || '');
  setVal('stoneWeight', stoneWt || 0);
  setVal('stoneAmount', n(tag.stoneCharge || 0));
  const netIn = row.querySelector('[data-q="netWeight"]');
  if(netIn){ delete netIn.dataset.manualNet; netIn.value = fmt(Math.max(0, gross - stoneWt)); }
  setVal('wastageMode', tag.wastageMode || p?.wastageMode || 'percent');
  setVal('wastage', n(tag.wastage ?? p?.wastage ?? 0));
  setVal('makingMode', tag.makingMode || p?.makingMode || 'piece');
  setVal('makingRate', n(tag.makingRate ?? p?.makingRate ?? 0));
  setVal('pieces', n(tag.pieces || 1));
  const rate = rcRateForMetal(metal, purity, p?.rateType || tag.rateType, p?.manualRate || tag.manualRate);
  setVal('rate', (rate > 0 ? rate : n(tag.rate || 0)).toFixed(2));
  rcQuoteRowCalc(input);
  say('Loaded tag ' + code + ' · ' + (tag.product || p?.name || 'Item'));
};

window.rcQuoteRemoveRow = function(btn){
  const rows = document.querySelectorAll('#rcQuoteTable tbody tr.rc-quote-row');
  if(rows.length <= 1) return say('Keep at least one quotation item.');
  btn.closest('tr.rc-quote-row').remove();
  document.querySelectorAll('#rcQuoteTable tbody tr.rc-quote-row').forEach((r, i)=>{
    const idx = r.querySelector('.rc-index');
    if(idx) idx.innerHTML = '<span class="rc-q-idx-badge">#' + (i + 1) + '</span>';
  });
  rcRecalc();
};

window.rcQuoteAddRow = function(item={}){
  const tbody = document.querySelector('#rcQuoteTable tbody');
  if(!tbody) return;
  const count = tbody.querySelectorAll('tr.rc-quote-row').length;
  tbody.insertAdjacentHTML('beforeend', rcQuoteItemRow(item, count));
  rcRecalc();
};

// Mode 1: Quick Tag Load into Quote
window.rcQuoteLoadTag = function(){
  const input = document.getElementById('rcQuoteTagInput');
  if(!input) return;
  const val = input.value.trim().toLowerCase();
  if(!val) return say('Enter or scan a tag code or HUID.');
  const tag = rcDocs('retail-tagging').find(t => String(t.tagCode).toLowerCase() === val || String(t.huid||'').toLowerCase() === val);
  if(!tag) return say('Tag / HUID "' + input.value + '" not found in stock.');

  const existing = rcQuoteReadRows();
  // If the first row is empty, replace it, otherwise append
  if(existing.length === 1 && !existing[0].product && existing[0].grossWeight === 0){
    document.querySelector('#rcQuoteTable tbody').innerHTML = rcQuoteItemRow(tag, 0);
  } else {
    rcQuoteAddRow(tag);
  }
  input.value = '';
  input.focus();
  say('Added tag ' + tag.tagCode + ' (' + tag.product + ') to quotation.');
};

// Mode 2: Add Manual Item
window.rcQuoteAddManualItem = function(){
  const f = document.getElementById('rcQuoteManualCard');
  if(!f) return;
  const metal = f.querySelector('[name="mMetal"]').value;
  const purity = n(f.querySelector('[name="mPurity"]').value)||92;
  const prod = f.querySelector('[name="mProduct"]').value.trim();
  const gross = n(f.querySelector('[name="mGross"]').value);
  const stoneWt = n(f.querySelector('[name="mStoneWt"]').value);
  const stoneAmt = n(f.querySelector('[name="mStoneAmt"]').value);
  const wstMode = f.querySelector('[name="mWstMode"]').value;
  const wst = n(f.querySelector('[name="mWst"]').value);
  const mcMode = f.querySelector('[name="mMcMode"]').value;
  const mcRate = n(f.querySelector('[name="mMcRate"]').value);
  const rate = n(f.querySelector('[name="mRate"]').value);
  const valAdded = n(f.querySelector('[name="mValAdded"]').value);
  const huid = f.querySelector('[name="mHuid"]').value.trim();

  if(!prod || gross <= 0 || rate <= 0){
    return say('Please enter Product, gross weight (>0) and rate per gram.');
  }

  const item = {
    product: prod,
    metalType: metal,
    purity: purity,
    grossWeight: gross,
    stoneWeight: stoneWt,
    stoneAmount: stoneAmt,
    netWeight: Math.max(0, gross - stoneWt),
    wastageMode: wstMode,
    wastage: wst,
    makingMode: mcMode,
    makingRate: mcRate,
    rate: rate,
    valueAdded: valAdded,
    huid: huid,
    pieces: 1
  };

  const existing = rcQuoteReadRows();
  if(existing.length === 1 && !existing[0].product && existing[0].grossWeight === 0){
    document.querySelector('#rcQuoteTable tbody').innerHTML = rcQuoteItemRow(item, 0);
  } else {
    rcQuoteAddRow(item);
  }

  // Clear manual inputs
  f.querySelector('[name="mProduct"]').value = '';
  f.querySelector('[name="mGross"]').value = '';
  f.querySelector('[name="mStoneWt"]').value = '';
  f.querySelector('[name="mStoneAmt"]').value = '';
  f.querySelector('[name="mWst"]').value = '0';
  f.querySelector('[name="mMcRate"]').value = '0';
  say('Added manual item ' + prod + ' to quotation.');
};

// Mode 3: Multi-tag Selection Dialog
window.rcQuoteOpenMultiTagModal = function(){
  const stock = rcDocs('retail-tagging').filter(t => t.status === 'In stock');
  if(!stock.length) return say('No tagged items currently in stock.');
  const id = 'rcMultiTagModal';
  document.getElementById(id)?.remove();

  const modalHtml = '<div id="'+id+'" class="retail-modal-backdrop">'
    +'<section class="retail-modal" style="max-width:850px">'
    +'<header class="retail-modal-head"><div><h2>Select Tagged Stock for Quotation</h2><p>Pick one or more tags to insert directly into this quotation.</p></div><button type="button" onclick="this.closest(\'.retail-modal-backdrop\').remove()">×</button></header>'
    +'<div class="retail-modal-scroll" style="max-height:480px;overflow:auto">'
    +'<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">'
    +'<input id="rcMultiTagSearch" placeholder="Search product, tag code, group..." oninput="rcFilterMultiTags(this.value)" style="padding:6px 10px;width:280px;border-radius:5px;border:1px solid var(--line,#ccc)">'
    +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600"><input type="checkbox" onchange="document.querySelectorAll(\'.rc-multitag-cb\').forEach(cb=>cb.checked=this.checked)"> Select All</label>'
    +'</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:#f4f1ea;text-align:left"><th style="padding:6px"></th><th style="padding:6px">Tag</th><th style="padding:6px">Product</th><th style="padding:6px">Metal</th><th style="padding:6px">Purity</th><th style="padding:6px">Gross g</th><th style="padding:6px">Net g</th><th style="padding:6px">Rate ₹/g</th><th style="padding:6px">Total ₹</th></tr></thead>'
    +'<tbody id="rcMultiTagRows">'
    +stock.map(t=>'<tr class="rc-mt-row" data-tag-search="'+esc((t.tagCode+' '+t.product+' '+(t.group||'')+' '+(t.huid||'')).toLowerCase())+'" style="border-bottom:1px solid #eee">'
      +'<td style="padding:6px"><input type="checkbox" class="rc-multitag-cb" value="'+esc(t.tagCode)+'"></td>'
      +'<td style="padding:6px;font-weight:600">'+esc(t.tagCode)+'</td>'
      +'<td style="padding:6px">'+esc(t.product)+'</td>'
      +'<td style="padding:6px">'+esc(t.metalType||'Gold')+'</td>'
      +'<td style="padding:6px">'+n(t.purity)+'%</td>'
      +'<td style="padding:6px">'+fmt(t.grossWeight)+'</td>'
      +'<td style="padding:6px">'+fmt(t.netWeight)+'</td>'
      +'<td style="padding:6px">₹'+rateMoney(t.rate)+'</td>'
      +'<td style="padding:6px;font-weight:600">₹'+rateMoney(t.totalAmount)+'</td>'
      +'</tr>').join('')
    +'</tbody></table>'
    +'</div>'
    +'<div class="retail-modal-actions" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px">'
    +'<button type="button" onclick="this.closest(\'.retail-modal-backdrop\').remove()">Cancel</button>'
    +'<button type="button" class="primary" onclick="rcQuoteApplySelectedMultiTags()">＋ Add Selected to Quotation</button>'
    +'</div></section></div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.rcFilterMultiTags = function(term){
  const q = term.toLowerCase().trim();
  document.querySelectorAll('#rcMultiTagRows tr.rc-mt-row').forEach(r=>{
    r.style.display = (!q || r.dataset.tagSearch.includes(q)) ? '' : 'none';
  });
};

window.rcQuoteApplySelectedMultiTags = function(){
  const cbs = [...document.querySelectorAll('.rc-multitag-cb:checked')];
  if(!cbs.length) return say('Select at least one tag to add.');
  const codes = cbs.map(cb=>cb.value);
  const tags = rcDocs('retail-tagging').filter(t => codes.includes(t.tagCode));
  const existing = rcQuoteReadRows();
  let tbody = document.querySelector('#rcQuoteTable tbody');
  if(!tbody) return;

  if(existing.length === 1 && !existing[0].product && existing[0].grossWeight === 0){
    tbody.innerHTML = '';
  }

  tags.forEach(t => {
    tbody.insertAdjacentHTML('beforeend', rcQuoteItemRow(t, tbody.querySelectorAll('tr.rc-quote-row').length));
  });

  document.getElementById('rcMultiTagModal')?.remove();
  rcRecalc();
  say('Added ' + tags.length + ' item(s) to quotation.');
};

function rcQuoteForm(){
  const q = rcDocs('retail-estimate').find(x=>x.id===rcEstimateEdit),
        items = q?.items?.length ? q.items : (rcQuoteItemsCache.length ? rcQuoteItemsCache : [{}]),
        rates = n(db.rates.gold24)||0,
        inStockTags = rcDocs('retail-tagging').filter(t=>t.status==='In stock');

  const syncKey = rcEstimateEdit || '__new__';
  if(rcOldGoldSyncedQuoteId !== syncKey){
    rcOldGoldSyncedQuoteId = syncKey;
    rcOldGoldItems = rcNormalizeOldGoldItems(q);
    if(rcOldGoldItems.length > 0){
      const lastOg = rcOldGoldItems[rcOldGoldItems.length - 1];
      rcOldGoldEditId = lastOg.id;
      rcOldGoldFormLocked = true;
    } else {
      rcOldGoldEditId = '';
      rcOldGoldFormLocked = false;
    }
  }

  const products = rcDocs('retail-product'),
        activeOg = rcOldGoldEditId ? rcOldGoldItems.find(x => x.id === rcOldGoldEditId) : null,
        ogTypeVal = activeOg ? (activeOg.type || 'Old Gold') : (q?.exchangeType || 'Old Gold'),
        ogGrossVal = activeOg ? (activeOg.gross > 0 ? activeOg.gross : '') : '',
        ogLessTypeVal = activeOg ? (activeOg.lessType === 'percent' ? 'percent' : 'grams') : (q?.exchangeLessType === 'percent' ? 'percent' : 'grams'),
        ogLessVal = activeOg ? (activeOg.less > 0 ? activeOg.less : '') : '',
        ogNetVal = activeOg ? (n(activeOg.netWeight) > 0 ? Number(activeOg.netWeight).toFixed(3) : (n(activeOg.gross) > 0 ? Number(activeOg.gross).toFixed(3) : '')) : '',
        ogPureRateVal = activeOg && n(activeOg.pureRate) > 0 ? n(activeOg.pureRate) : (rcGetPureRateFromRateBook(ogTypeVal) || rates),
        ogTestingVal = activeOg ? (activeOg.testing || 91.6) : 91.6,
        ogRateCalc = ogPureRateVal > 0 ? rbRound(ogPureRateVal * ogTestingVal / 100) : 0,
        ogRateVal = activeOg && n(activeOg.rate) > 0 ? Number(activeOg.rate).toFixed(2) : (ogRateCalc > 0 ? ogRateCalc.toFixed(2) : ''),
        ogAmtVal = activeOg ? (activeOg.amount > 0 ? activeOg.amount.toFixed(2) : '') : '',
        ogRemarksVal = activeOg ? (activeOg.remarks ?? activeOg.product ?? '') : '',
        ogLockedAttr = rcOldGoldFormLocked ? ' readonly' : '',
        ogLockedClass = rcOldGoldFormLocked ? ' rc-og-input-locked' : '',
        oldGoldCredit = rbRound(rcOldGoldItems.reduce((s, x) => s + n(x.amount), 0)),
        hasOldGold = oldGoldCredit > 0 || rcOldGoldItems.length > 0;

  const activeOgIdx = rcOldGoldEditId ? (rcOldGoldItems.findIndex(x => x.id === rcOldGoldEditId) + 1) : 0;
  const activeOgTitle = activeOg ? ((activeOg.type || 'Old Gold') + (activeOg.remarks ? ' · ' + activeOg.remarks : '')) : 'Old Gold';
  const ogStatusClass = (rcOldGoldFormLocked && rcOldGoldEditId) ? 'saved' : (!rcOldGoldFormLocked && rcOldGoldEditId) ? 'editing' : 'entry';
  const ogStatusText = (rcOldGoldFormLocked && rcOldGoldEditId)
    ? ('✓ Item #' + activeOgIdx + ' Saved (' + esc(activeOgTitle) + ') — Click "Edit" to modify or "+ Add Item" for next item')
    : (!rcOldGoldFormLocked && rcOldGoldEditId)
      ? ('✎ Editing Item #' + activeOgIdx + ' (' + esc(activeOgTitle) + ') — Update fields & click "Save"')
      : ('🪙 Entering Old Gold Item #' + (rcOldGoldItems.length + 1) + (rcOldGoldItems.length > 0 ? ' (' + rcOldGoldItems.length + ' saved below)' : ''));

  const quoteDiscount = n(q?.discount||0),
        quoteGstOn = q?.gstEnabled !== false,
        quoteGstRate = quoteGstOn ? n(q?.gstRate !== undefined ? q.gstRate : 3) : 0,
        initBill = rbBillCalc(items, {
          discountValue: quoteDiscount,
          discountMode: 'amount',
          gstEnabled: quoteGstOn,
          gstRate: quoteGstRate,
          exchangeAmount: oldGoldCredit,
          collectedAmount: n(q?.collectedAmount||0)
        }),
        quoteSubtotal = initBill.subtotal,
        quoteTaxable = initBill.taxableValue,
        quoteGst = initBill.gstAmount,
        quotePurchaseValue = initBill.saleBeforeRound,
        quoteFinalVal = initBill.amount;

  let collections = [];
  if(Array.isArray(q?.collections) && q.collections.length > 0){
    collections = q.collections;
  } else if(n(q?.collectedAmount) > 0){
    collections = [{ method: q?.collectedMethod || 'Cash', amount: q.collectedAmount, reference: q?.collectedReference || '' }];
  } else {
    collections = [{ method: 'Cash', amount: '', reference: '' }];
  }

  return '<form id="rcEstimateForm" class="rc-form" oninput="rcRecalc()" onchange="rcRecalc()" onsubmit="rcSaveEstimate(event)">'
    +'<input type="hidden" name="id" value="'+esc(q?.id||'')+'">'
    
    // Top Card: Quotation Metadata & Customer
    +'<section class="panel">'
    +'<div class="rc-section-title">'
    +'<div><h2>'+(q?'Edit Quotation :: '+esc(q.documentNo):'Quotation :: New')+'</h2><p class="muted">Live Rate Book prices, instant tag scanning and multi-mode quotation workflow.</p></div>'
    +'<span class="pill" style="font-weight:700">'+esc(q?.status||'Draft')+'</span>'
    +'</div>'
    +'<div class="rc-grid">'
    +'<label>Quotation Number<input name="documentNo" maxlength="60" value="'+esc(q?.documentNo||'Q-'+Date.now().toString(36).toUpperCase())+'" placeholder="Auto generated"></label>'
    +'<label>Date & Time *<input required name="when" type="datetime-local" value="'+esc(q?.when||rbNow())+'"></label>'
    +'<div class="rb-field">'
    +'<div style="display:flex;justify-content:space-between;align-items:center"><label>Customer *</label><button type="button" style="font-size:10px;padding:2px 6px" onclick="rbOpenCustomerAdd()">＋ New</button></div>'
    +'<select name="customerId" required><option value="">Select customer</option>'+db.customers.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===q?.customerId?'selected':'')+'>'+esc(c.name)+(c.city?' ('+esc(c.city)+')':'')+'</option>').join('')+'</select>'
    +'</div>'
    +rcChitSelect(q?.customerId||'', q?.chitMappingId)
    +'<label>Valid Until<input name="validUntil" type="date" value="'+esc(q?.validUntil||new Date(Date.now()+86400000*2).toISOString().slice(0,10))+'"></label>'
    +'<label>Reference<input name="reference" value="'+esc(q?.reference||'')+'" placeholder="Sales rep / notes"></label>'
    +'<label>24K Base Rate ₹/g<input name="goldRate" type="number" min="0" step=".01" required value="'+(q?.goldRate??rates)+'" oninput="rcBaseGoldRateChanged(this)"></label>'
    +'</div>'
    +'</section>'

    // Segmented Mode Switcher Bar
    +'<section class="panel rc-quote-mode-section">'
    +'<div class="rc-quote-mode-head">'
    +'<span class="rc-quote-mode-title">Item Entry Mode</span>'
    +'<div class="rc-quote-mode-tabs" role="tablist" aria-label="Item entry mode">'
    +'<button type="button" class="rc-quote-mode-btn '+(rcQuoteMode==='tag'?'active':'')+'" onclick="rcSetQuoteMode(\'tag\')" role="tab" aria-selected="'+(rcQuoteMode==='tag')+'">🏷 Tag Mode</button>'
    +'<button type="button" class="rc-quote-mode-btn '+(rcQuoteMode==='manual'?'active':'')+'" onclick="rcSetQuoteMode(\'manual\')" role="tab" aria-selected="'+(rcQuoteMode==='manual')+'">✎ Manual Mode</button>'
    +'<button type="button" class="rc-quote-mode-btn '+(rcQuoteMode==='multi'?'active':'')+'" onclick="rcSetQuoteMode(\'multi\')" role="tab" aria-selected="'+(rcQuoteMode==='multi')+'">📑 Multi Tag Mode</button>'
    +'</div>'
    +'</div>'

    // Interactive Entry Box according to mode
    +(rcQuoteMode==='tag' ? (
      '<div id="rcQuoteTagBar" class="rc-unified-search-field">'
      +'<span class="rc-unified-search-prefix" aria-hidden="true">🏷</span>'
      +'<input id="rcQuoteTagInput" list="rcQuoteTagDatalist" placeholder="Scan or search Tag Code / HUID..." autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rcQuoteLoadTag()}">'
      +'<datalist id="rcQuoteTagDatalist">'+inStockTags.map(t=>'<option value="'+esc(t.tagCode)+'">'+esc(t.product)+' · '+fmt(t.grossWeight)+'g · '+(t.metalType||'Gold')+'</option>').join('')+'</datalist>'
      +'<button type="button" class="gl-scan-btn gl-scan-btn-embedded" onclick="openQrScannerForQuote()" title="Scan QR / Barcode with Camera" aria-label="Scan QR / Barcode">'+(window.glScanIconSvg||'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/></svg>')+'</button>'
      +'<button type="button" class="rc-unified-add-btn" onclick="rcQuoteLoadTag()" title="Load Tag into Quotation" aria-label="Load Tag">＋ Add Tag</button>'
      +'</div>'
    ) : rcQuoteMode==='manual' ? (
      '<div id="rcQuoteManualCard" style="margin-top:12px;background:#fbf9f4;padding:12px;border-radius:6px;border:1px solid var(--line,#ddd)">'
      +'<div style="font-size:12px;font-weight:700;margin-bottom:8px">Quick Manual Item Builder:</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">'
      +'<label style="font-size:11px">Metal<select name="mMetal" onchange="rcManualMetalChange(this)"><option value="Gold">Gold</option><option value="Silver">Silver</option><option value="Platinum">Platinum</option></select></label>'
      +'<label style="font-size:11px">Purity %<input name="mPurity" type="number" min="1" max="100" step=".01" value="92" oninput="rcManualPurityChange(this)"></label>'
      +'<label style="font-size:11px">Product Name *<input name="mProduct" list="rcQuoteProdList" placeholder="Ring, Chain..."></label>'
      +'<label style="font-size:11px">HUID<input name="mHuid" placeholder="Alphanumeric"></label>'
      +'<label style="font-size:11px">Gross Wt (g) *<input name="mGross" type="number" min="0" step=".001" placeholder="0.000"></label>'
      +'<label style="font-size:11px">Stone Wt (g)<input name="mStoneWt" type="number" min="0" step=".001" value="0"></label>'
      +'<label style="font-size:11px">Stone Amt ₹<input name="mStoneAmt" type="number" min="0" step=".01" value="0"></label>'
      +'<label style="font-size:11px">Wastage %<div style="display:flex"><select name="mWstMode" style="width:38px"><option value="percent">%</option><option value="grams">g</option></select><input name="mWst" type="number" min="0" step=".01" value="0"></div></label>'
      +'<label style="font-size:11px">Making ₹<div style="display:flex"><select name="mMcMode" style="width:42px"><option value="piece">/pc</option><option value="gram">/g</option><option value="fixed">Fix</option></select><input name="mMcRate" type="number" min="0" step=".01" value="0"></div></label>'
      +'<label style="font-size:11px">Rate ₹/g *<input name="mRate" type="number" min="0" step=".01" value="'+(rcRateForMetal('Gold',92)).toFixed(2)+'"></label>'
      +'<label style="font-size:11px">Value Added /g<input name="mValAdded" type="number" min="0" step=".01" value="0"></label>'
      +'</div>'
      +'<div style="margin-top:10px;text-align:right"><button type="button" class="primary" onclick="rcQuoteAddManualItem()">＋ Add to Quotation Table</button></div>'
      +'</div>'
    ) : (
      '<div id="rcQuoteMultiBar" style="margin-top:12px;background:#f3f6f4;padding:12px;border-radius:6px;border:1px solid #c2d8c9;display:flex;justify-content:space-between;align-items:center">'
      +'<div><b>Multi-Tag Batch Mode:</b> Select multiple tags from stock to add all at once.</div>'
      +'<button type="button" class="primary" onclick="rcQuoteOpenMultiTagModal()">📑 Browse & Select Tags ('+inStockTags.length+' available)</button>'
      +'</div>'
    ))
    +'</section>'

    // Items Section (Table on desktop, responsive Item Cards on mobile)
    +'<section class="panel rc-quote-items-panel">'
    +'<div class="rc-section-head rc-quote-items-head">'
    +'<h2>Quotation Items · <span id="rcQuoteItemCount">'+items.length+' item(s)</span></h2>'
    +'<div class="rc-quote-items-actions">'
    +'<button type="button" class="rc-quote-add-btn" onclick="rcQuoteAddRow({})">＋ Add Item Row</button>'
    +'</div>'
    +'</div>'
    +'<div class="rb-item-scroll rc-quote-table-wrap">'
    +'<table id="rcQuoteTable" class="rc-quote-table">'
    +'<thead>'
    +'<tr style="background:var(--erp-soft,#f4f1ea);text-align:left">'
    +'<th style="padding:6px;width:30px">#</th>'
    +'<th style="padding:6px;width:110px">Tag Code</th>'
    +'<th style="padding:6px;width:140px">Product Name</th>'
    +'<th style="padding:6px;width:80px">Metal</th>'
    +'<th style="padding:6px;width:65px">Purity</th>'
    +'<th style="padding:6px;width:75px">Gross g</th>'
    +'<th style="padding:6px;width:65px">Stone g</th>'
    +'<th style="padding:6px;width:75px">Net g</th>'
    +'<th style="padding:6px;width:95px">Wastage</th>'
    +'<th style="padding:6px;width:100px">Making Charge</th>'
    +'<th style="padding:6px;width:80px">Rate ₹/g</th>'
    +'<th style="padding:6px;width:75px">Rate+Tax</th>'
    +'<th style="padding:6px;width:95px">Amount ₹</th>'
    +'<th style="padding:6px;width:35px"></th>'
    +'</tr>'
    +'</thead>'
    +'<tbody>'
    +items.map(rcQuoteItemRow).join('')
    +'</tbody>'
    +'<tfoot class="rc-quote-tfoot">'
    +'<tr class="rc-quote-totals-row">'
    +'<td colspan="5" class="rc-qt-label">Totals</td>'
    +'<td id="rcQuoteTotalGross" data-label="Gross Total">0.000 g</td>'
    +'<td id="rcQuoteTotalStone" data-label="Stone Total">0.000 g</td>'
    +'<td id="rcQuoteTotalNet" data-label="Net Total">0.000 g</td>'
    +'<td colspan="4" class="rc-qt-spacer"></td>'
    +'<td id="rcQuoteTotalItemsVal" data-label="Items Subtotal" style="color:var(--green,#18392a)">₹ 0.00</td>'
    +'<td class="rc-qt-spacer"></td>'
    +'</tr>'
    +'</tfoot>'
    +'</table>'
    +'</div>'
    +'<datalist id="rcQuoteProdList">'+products.map(p=>'<option value="'+esc(p.name)+'">').join('')+'</datalist>'
    +'</section>'

    // Adjustments & Old Gold (Single-Row POS Strip for Mobile + Preserved Desktop Layout)
    +'<section class="panel rc-quote-adjustments-panel rc-pos-strip-container">'
    +'<div class="rc-section-title rc-pos-desktop-head"><h2>Adjustments & Old Gold Exchange</h2></div>'

    // Mobile Horizontal Pills Row (matches mockup 1 Single-Row POS Strip)
    +'<div class="rc-pos-pills-bar">'
    +'<button type="button" id="rcPill_oldgold" class="rc-pos-pill '+(hasOldGold?'has-value':'')+'" onclick="rcTogglePosDrawer(\'oldgold\')">'+(oldGoldCredit>0?'🪙 Old Gold ('+rateMoney(oldGoldCredit)+') ▾':'+ Old Gold ▾')+'</button>'
    +'<button type="button" id="rcPill_chit" class="rc-pos-pill '+(q?.chitMappingId?'has-value':'')+'" onclick="rcTogglePosDrawer(\'chit\')">'+(q?.chitMappingId?'✓ Chit':'+ Chit')+'</button>'
    +'<button type="button" id="rcPill_gst" class="rc-pos-pill '+(q?.gstEnabled!==false?'active':'')+'" onclick="rcTogglePosDrawer(\'gst\')">💰 GST '+(q?.gstEnabled!==false?((q?.gstRate!==undefined?q.gstRate:3)+'%'):'(Off)')+'</button>'
    +'<button type="button" id="rcPill_advance" class="rc-pos-pill active" onclick="rcFocusAdvance()">💰 Advance</button>'
    +'<button type="button" id="rcPill_discount" class="rc-pos-pill '+(q?.discount>0?'has-value':'')+'" onclick="rcTogglePosDrawer(\'discount\')">'+(q?.discount>0?'🏷️ Disc ('+rateMoney(q.discount)+')':'🏷️ Discount')+'</button>'
    +'</div>'

    // Drawers / Cards: on Desktop, these render in the 2-column grid; on Mobile, they are drawers toggled by pills
    +'<div class="rc-adj-cards-row rc-pos-drawers-wrap">'
    +'<div id="rcPosDrawer_discount" class="rc-adj-card rc-adj-discount-card rc-pos-drawer">'
    +'<div class="rc-adj-card-head rc-pos-drawer-head">'
    +'<span class="rc-adj-card-title">🏷️ Discount</span>'
    +'<b class="rc-adj-card-val" id="rcAdjDiscountVal">'+rateMoney(q?.discount||0)+'</b>'
    +'</div>'
    +'<label class="rc-adj-label">Discount ₹</label>'
    +'<input name="discount" class="rc-adj-input" type="number" min="0" step=".01" placeholder="0.00" value="'+(q?.discount||'')+'" oninput="rcRecalc()">'
    +'</div>'
    +'<div id="rcPosDrawer_gst" class="rc-adj-card rc-adj-gst-card rc-pos-drawer">'
    +'<div class="rc-adj-card-head rc-pos-drawer-head">'
    +'<span class="rc-adj-card-title">🏛️ GST Tax</span>'
    +'<label class="rc-adj-check-label"><input name="gstEnabled" type="checkbox" '+(q?.gstEnabled!==false?'checked':'')+' onchange="rcRecalc()"> <span>Enable</span></label>'
    +'</div>'
    +'<label class="rc-adj-label">GST Rate %</label>'
    +'<input name="gstRate" class="rc-adj-input" type="number" min="0" max="100" step=".01" placeholder="3%" value="'+(q?.gstRate!==undefined?q.gstRate:3)+'" oninput="rcRecalc()">'
    +'</div>'
    +'</div>'

    // Old Gold Exchange Drawer / Block
    +'<div id="rcPosDrawer_oldgold" class="rc-old-gold-wrap rc-pos-drawer '+(hasOldGold?'has-old-gold':'')+'">'
    +'<button type="button" id="rcOldGoldToggleBtn" class="rc-old-gold-btn '+(hasOldGold?'active':'')+'" onclick="rcToggleOldGold()" aria-expanded="'+(hasOldGold?'true':'false')+'">'
    +'<div class="rc-old-gold-btn-left">'
    +'<span class="rc-old-gold-icon">🪙</span>'
    +'<span class="rc-old-gold-title">Old Gold Exch.</span>'
    +'<b id="rcOldGoldBadge" class="rc-old-gold-badge">'+rateMoney(oldGoldCredit)+'</b>'
    +'</div>'
    +'<div class="rc-old-gold-btn-right">'
    +'<span class="rc-old-gold-hint">'+(hasOldGold?'Click to collapse':'Click to enter Old Gold data')+'</span>'
    +'<span id="rcOldGoldChevron" class="rc-old-gold-chevron">'+(hasOldGold?'▲':'▼')+'</span>'
    +'</div>'
    +'</button>'
    +'<div id="rcOldGoldDropdown" class="rc-old-gold-dropdown '+(hasOldGold?'':'hidden')+'">'
    +'<div class="rc-old-gold-dropdown-head">'
    +'<div><span style="font-size:12px;font-weight:800;color:#92400e">Old Gold Exchange Details</span><small style="display:block;color:#b45309;font-size:11px">Net Wt = Weight − Less · Rate = Pure Rate (Rate Book) × Touch(%) ÷ 100 · Amount = Net Wt × Rate</small></div>'
    +'<div class="rc-old-gold-credit-pill">Credit: <b id="rcOldGoldCreditSummary">'+rateMoney(oldGoldCredit)+'</b></div>'
    +'</div>'
    +'<div id="rcOgFormStatus" class="rc-og-form-status rc-og-status-'+ogStatusClass+'">'+ogStatusText+'</div>'
    +'<div class="rc-grid rc-old-gold-fields-grid">'
    +'<div class="rc-og-field rc-og-type" style="margin:0">'
    +'<div class="rc-og-label-row"><span class="rc-og-label-text">Type</span><button type="button" class="rc-og-new-type-btn" onclick="rcOldGoldCreateNewType()" title="Create New Old Gold Type">＋ New</button></div>'
    +'<select name="exchangeType" class="rc-og-input'+ogLockedClass+'" onchange="rcOldGoldTypeChanged(this)">'+rcOldGoldTypeOptions(ogTypeVal)+'</select>'
    +'</div>'
    +'<label class="rc-og-field rc-og-weight" style="margin:0"><span class="rc-og-label-text">Weight</span><input name="exchangeGross" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="0" step=".001" placeholder="0.000 g" value="'+ogGrossVal+'" oninput="rcOldGoldFieldChanged()"></label>'
    +'<label class="rc-og-field rc-og-less-type" style="margin:0"><span class="rc-og-label-text">Less Type</span><select name="exchangeLessType" class="rc-og-input'+ogLockedClass+'" onchange="rcOldGoldFieldChanged()"><option value="grams" '+(ogLessTypeVal==='grams'?'selected':'')+'>Grams (g)</option><option value="percent" '+(ogLessTypeVal==='percent'?'selected':'')+'>Percentage (%)</option></select></label>'
    +'<label class="rc-og-field rc-og-less" style="margin:0"><span class="rc-og-label-text" id="rcOgLessLabel">Less ('+(ogLessTypeVal==='percent'?'%':'g')+')</span><input name="exchangeLess" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="0" step=".001" placeholder="0.000" value="'+ogLessVal+'" oninput="rcOldGoldFieldChanged()"></label>'
    +'<label class="rc-og-field rc-og-net" style="margin:0"><span class="rc-og-label-text">Net Wt</span><input name="exchangeNet" class="rc-og-input rc-og-computed" readonly type="number" step=".001" placeholder="0.000 g" value="'+ogNetVal+'" tabindex="-1"></label>'
    +'<label class="rc-og-field rc-og-purerate" style="margin:0"><div class="rc-og-label-row"><span class="rc-og-label-text">Pure Rate</span><small class="rc-og-ratebook-tag">Rate Book</small></div><input name="exchangePureRate" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="0" step=".01" placeholder="Rate Book ₹/g" value="'+ogPureRateVal+'" oninput="rcOldGoldFieldChanged()"></label>'
    +'<label class="rc-og-field rc-og-touch" style="margin:0"><span class="rc-og-label-text">Touch(%)</span><input name="exchangeTesting" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="1" max="100" step=".01" placeholder="91.6" value="'+ogTestingVal+'" oninput="rcOldGoldFieldChanged()"></label>'
    +'<label class="rc-og-field rc-og-rate" style="margin:0"><span class="rc-og-label-text">Rate</span><input name="exchangeRate" class="rc-og-input rc-og-computed'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="0" step=".01" placeholder="0.00" value="'+ogRateVal+'" oninput="rcOldGoldRateManualChanged()"></label>'
    +'<label class="rc-og-field rc-og-amount" style="margin:0"><span class="rc-og-label-text">Amount</span><input name="exchangeAmount" id="rcExchangeAmountInput" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' type="number" min="0" step=".01" placeholder="0.00" value="'+ogAmtVal+'" oninput="rcOldGoldAmountChanged()"></label>'
    +'<label class="rc-og-field rc-og-remarks" style="margin:0"><span class="rc-og-label-text">Remarks</span><input name="exchangeProduct" class="rc-og-input'+ogLockedClass+'"'+ogLockedAttr+' value="'+esc(ogRemarksVal)+'" placeholder="e.g. Ring, Chain..." oninput="rcRecalc()"></label>'
    +'</div>'
    +'<div class="rc-og-actions-bar">'
    +'<button type="button" id="rcOgSaveBtn" class="rc-og-btn rc-og-btn-save" onclick="rcOldGoldSaveItem()">💾 Save</button>'
    +'<button type="button" id="rcOgEditBtn" class="rc-og-btn rc-og-btn-edit" onclick="rcOldGoldEditTrigger()">✎ Edit</button>'
    +'<button type="button" id="rcOgClearBtn" class="rc-og-btn rc-og-btn-clear" onclick="rcOldGoldClearForm()">✕ Clear</button>'
    +'<button type="button" id="rcOgAddItemBtn" class="rc-og-btn rc-og-btn-add" onclick="rcOldGoldAddItem()">＋ Add Item</button>'
    +'</div>'
    +'<div id="rcOldGoldItemsList" class="rc-og-items-list">'+rcRenderOldGoldItemsMarkup()+'</div>'
    +'</div>'
    +'</div>'

    // Payment Received Card (Single-Row POS Strip from mockup)
    +'<div class="rc-advance-collection-card rc-pos-payment-card">'
    +'<input type="hidden" name="collectedAmount" id="rcHiddenCollectedAmount" value="'+(q?.collectedAmount||0)+'">'
    +'<input type="hidden" name="collectedMethod" id="rcHiddenCollectedMethod" value="'+esc(q?.collectedMethod||'Cash')+'">'
    +'<input type="hidden" name="collectedReference" id="rcHiddenCollectedReference" value="'+esc(q?.collectedReference||'')+'">'
    +'<div class="rc-advance-card-head rc-pos-payment-head">'
    +'<div class="rc-pos-head-left">'
    +'<span class="rc-pos-payment-title">Payment Received</span>'
    +'</div>'
    +'<div class="rc-pos-payment-total-wrap">'
    +'<span class="rc-pos-header-total" title="Total = Purchase Value − Old Gold">Total: <b id="rcPosNetTotal">'+rateMoney(quoteFinalVal)+'</b></span>'
    +'<span class="rc-pos-pipe">|</span>'
    +'<span class="rc-pos-header-paid" title="Amount Collected">Paid: <b id="rcCollectionsTotal">'+rateMoney(q?.collectedAmount||0)+'</b></span>'
    +'<span class="rc-pos-pipe">|</span>'
    +'<button type="button" class="rc-pos-split-btn" onclick="rcAddCollection()">+ Split</button>'
    +'</div>'
    +'</div>'
    +'<div id="rcPosOldGoldBanner" class="rc-pos-oldgold-banner '+(oldGoldCredit>0?'':'hidden')+'">'
    +'<div class="rc-pos-og-left">'
    +'<span class="rc-pos-og-badge">🪙 Old Gold Credit</span>'
    +'<b id="rcPosOldGoldVal" class="rc-pos-og-val">'+rateMoney(oldGoldCredit)+'</b>'
    +'</div>'
    +'<div class="rc-pos-og-formula">'
    +'<span>Purchase (<b id="rcPosPurchVal">'+rateMoney(quotePurchaseValue)+'</b>) − Old Gold (<b id="rcPosOGVal">'+rateMoney(oldGoldCredit)+'</b>) = <b id="rcPosFormulaTotal" class="rc-pos-highlight-due">'+rateMoney(quoteFinalVal)+'</b></span>'
    +'</div>'
    +'</div>'
    +'<div class="rc-pos-labels-row">'
    +'<span>Collected (₹)</span><span>Method</span><span>Ref / Txn #</span><span></span>'
    +'</div>'
    +'<div id="rcCollectionsList" class="rc-collections-list rc-pos-collections-list">'
    +collections.map(c => rcCollectionRow(c)).join('')
    +'</div>'
    +'</div>'

    // Summary Totals
    +'<div class="rc-notes-wrap" style="margin-top:10px;margin-bottom:8px">'
    +'<label class="rc-notes-label" style="margin:0;display:block">'
    +'<span style="font-size:11px;font-weight:700;color:#64748b">Quotation Notes / Terms</span>'
    +'<textarea name="notes" class="rc-notes-input" rows="1" placeholder="e.g. Rate valid for 48 hours. Subject to physical verification of old gold.">'+esc(q?.notes||'')+'</textarea>'
    +'</label>'
    +'</div>'
    +'<div class="rc-totals" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;background:#fbfaf6;padding:12px;border-radius:6px;margin-top:14px;border:1px solid var(--line,#ddd)">'
    +'<span>Items Subtotal <b id="rcSubtotal" style="display:block;font-size:14px;color:#222">'+rateMoney(quoteSubtotal)+'</b></span>'
    +'<span>Discount <b id="rcDiscount" style="display:block;font-size:14px;color:#888">'+rateMoney(quoteDiscount)+'</b></span>'
    +'<span>GST Tax <b id="rcGST" style="display:block;font-size:14px;color:#222">'+rateMoney(quoteGst)+'</b></span>'
    +'<span>Purchase Value <b id="rcPurchaseVal" style="display:block;font-size:14px;color:#1e293b;font-weight:700">'+rateMoney(quotePurchaseValue)+'</b></span>'
    +'<span>Old Gold Credit <b id="rcOldGold" style="display:block;font-size:14px;color:#854d0e">'+(oldGoldCredit>0?'− '+rateMoney(oldGoldCredit):'₹ 0.00')+'</b></span>'
    +'<span>Net Estimate Payable <b id="rcFinal" style="display:block;font-size:15px;color:var(--green,#18392a);font-weight:800">'+rateMoney(quoteFinalVal)+'</b></span>'
    +'<span class="rc-advance-total-badge">💵 Collected Amount <b id="rcCollected" style="display:block;font-size:16px;color:#1b5e20;font-weight:800">'+rateMoney(q?.collectedAmount||0)+'</b></span>'
    +'</div>'
    +'<div id="rcBalanceBox" class="rc-balance-box rc-balance-due">'
    +'<div class="rc-balance-desktop-head">'
    +'<span class="rc-balance-icon" style="font-size:24px">⚖️</span>'
    +'<div><span id="rcBalanceLabel" class="rc-balance-title" style="font-size:13px;font-weight:850;text-transform:uppercase;letter-spacing:0.5px;color:#92400e;display:block">BALANCE TO PAY</span><small class="rc-balance-sub" style="font-size:11px;color:#b45309;font-weight:600">Net balance after payment collection</small></div>'
    +'</div>'
    +'<div class="rc-balance-linear-bar">'
    +'<span class="rc-bal-item rc-bal-quote"><span class="rc-bal-lbl">Net Total: </span><b id="rcBalGrandTotal">'+rateMoney(quoteFinalVal)+'</b></span>'
    +'<span class="rc-bal-pipe">|</span>'
    +'<span class="rc-bal-item rc-bal-advance"><span class="rc-bal-lbl">Paid Amount: </span><b id="rcBalAdvance">'+rateMoney(q?.collectedAmount||0)+'</b></span>'
    +'<span class="rc-bal-pipe">|</span>'
    +'<span class="rc-bal-item rc-bal-remaining"><span class="rc-bal-lbl rc-bal-rem-text">Remaining: </span><b id="rcBalanceDue">'+rateMoney(Math.abs(quoteFinalVal - (q?.collectedAmount||0)))+'</b></span>'
    +'</div>'
    +'</div>'
    +'</section>'

    // Actions
    +'<div class="rc-actions" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:10px">'
    +'<button type="button" onclick="rcResetEstimate()">＋ New Quote</button>'
    +'<button type="button" onclick="rcPrintEstimate()">📄 View PDF / Print</button>'
    +(q?.id ? '<button type="button" style="background:#25d366;border-color:#25d366;color:#fff;font-weight:700" onclick="rcShareQuoteWhatsApp(\''+esc(q.id)+'\')">📲 WhatsApp Quote</button>' : '')
    +(q?.id ? '<button type="button" style="background:#e88a1a;border-color:#e88a1a;color:#fff;font-weight:700" onclick="rcConvert(\''+esc(q.id)+'\')">⚡ Convert to Sales Bill</button>' : '')
    +'<button type="submit" class="primary" style="padding:0 20px;font-weight:750">'+(q?'Save Changes':'Save Quotation')+'</button>'
    +'</div>'
    +'</form>'

    // History Table
    +'<section class="panel" style="margin-top:20px">'
    +'<div class="rc-section-title"><h2>Quotation History · '+rcDocs('retail-estimate').length+'</h2><span>Saved estimates</span></div>'
    +rcEstimateHistory()
    +'</section>';
}

window.rcManualMetalChange = function(sel){
  const metal = sel.value;
  const card = sel.closest('#rcQuoteManualCard');
  if(!card) return;
  const purIn = card.querySelector('[name="mPurity"]');
  if(purIn) purIn.value = metal==='Silver' ? 92.5 : 92;
  const rateIn = card.querySelector('[name="mRate"]');
  if(rateIn){
    const r = rcRateForMetal(metal, purIn?.value||92);
    rateIn.value = r > 0 ? r.toFixed(2) : '';
  }
};

window.rcManualPurityChange = function(input){
  const card = input.closest('#rcQuoteManualCard');
  if(!card) return;
  const metal = card.querySelector('[name="mMetal"]')?.value || 'Gold';
  const rateIn = card.querySelector('[name="mRate"]');
  if(rateIn){
    const r = rcRateForMetal(metal, input.value);
    if(r > 0) rateIn.value = r.toFixed(2);
  }
};

window.rcScanTagForQuote = function(){
  rcScanTag();
};

function rcEstimateHistory(){
  const all = rcDocs('retail-estimate').sort((a,b)=>String(b.when||b.createdAt||'').localeCompare(String(a.when||a.createdAt||'')));
  return all.length ? table(['Quote #','Date','Customer','Items','Amount','Status','Actions'],all.map(q=>[
    '<b>'+esc(q.documentNo)+'</b>',
    esc(String(q.when||'').replace('T',' ')),
    esc(accountName(q.customerId,'customer')),
    (q.items?.length||0)+' pcs',
    '<b style="color:var(--green,#18392a)">'+rateMoney(q.amount)+'</b>',
    '<span class="pill">'+esc(q.status||'Draft')+'</span>',
    '<button type="button" onclick="rcEditEstimate(\''+esc(q.id)+'\')">Edit</button> '
    +'<button type="button" onclick="rcPrintSavedEstimate(\''+esc(q.id)+'\')">PDF</button> '
    +'<button type="button" onclick="rcShareQuoteWhatsApp(\''+esc(q.id)+'\')" style="background:#25d366;border-color:#25d366;color:#fff">WA</button> '
    +'<button type="button" class="primary" onclick="rcConvert(\''+esc(q.id)+'\')">Convert</button>'
  ])) : '<p class="muted">Saved estimations and quotations will appear here.</p>';
}

window.rcEditEstimate = function(id){
  rcEstimateEdit = id;
  rcOldGoldSyncedQuoteId = null;
  const q = rcDocs('retail-estimate').find(x=>x.id===id);
  if(q?.items) rcQuoteItemsCache = q.items;
  render();
};

window.rcResetEstimate = function(){
  if(!rbCanLeave()) return;
  rcEstimateEdit = '';
  rcQuoteItemsCache = [];
  rcOldGoldItems = [];
  rcOldGoldEditId = '';
  rcOldGoldFormLocked = false;
  rcOldGoldSyncedQuoteId = null;
  render();
};

function rcEstimateRead(form){
  const f = form.elements,
        items = rcQuoteReadRows();
  const discount = n(f.discount.value),
        gstOn = !!f.gstEnabled?.checked,
        gstRate = gstOn ? n(f.gstRate.value) : 0,
        ogData = rcCollectOldGoldData(form),
        goldCredit = ogData.totalAmount;

  const colRows = rcReadCollections(form);
  const collectedAmount = colRows.length > 0
    ? rbRound(colRows.reduce((s, x) => s + (n(x.amount) || 0), 0))
    : n(f.collectedAmount?.value);

  const billCalc = rbBillCalc(items, {
    discountValue: discount,
    discountMode: 'amount',
    gstEnabled: gstOn,
    gstRate: gstRate,
    exchangeAmount: goldCredit,
    collectedAmount: collectedAmount
  });

  const collectedMethod = colRows.map(c => c.method).filter((x,i,a)=>a.indexOf(x)===i).join(' + ') || String(f.collectedMethod?.value||'Cash');
  const collectedReference = colRows.map(c => c.reference ? c.method + ': ' + c.reference : '').filter(Boolean).join(' · ') || String(f.collectedReference?.value||'').trim();

  return {
    id: f.id.value || crypto.randomUUID(),
    kind: 'retail-estimate',
    accountType: 'customer',
    customerId: f.customerId.value,
    documentNo: f.documentNo.value.trim() || ('Q-' + Date.now().toString(36).toUpperCase()),
    when: f.when.value,
    validUntil: f.validUntil.value,
    reference: f.reference.value.trim(),
    chitMappingId: f.chitMappingId?.value || '',
    chitNumber: rcDocs('retail-chit-mapping').find(m=>m.id===f.chitMappingId?.value)?.chitNumber || '',
    items: items,
    discount: discount,
    discountMode: 'amount',
    gstEnabled: gstOn,
    gstRate: gstRate,
    subtotal: billCalc.subtotal,
    taxableValue: billCalc.taxableValue,
    gstAmount: billCalc.gstAmount,
    purchaseValue: billCalc.saleBeforeRound,
    exchangeItems: ogData.items,
    exchangeType: ogData.items[0]?.type || String(f.exchangeType?.value || 'Old Gold'),
    exchangeProduct: ogData.combinedProduct,
    exchangeGross: ogData.totalGross,
    exchangeLessType: ogData.items[0]?.lessType || String(f.exchangeLessType?.value || 'grams'),
    exchangeLess: ogData.totalLessGrams,
    exchangeNet: ogData.totalNet,
    exchangePureRate: ogData.items[0]?.pureRate || n(f.exchangePureRate?.value) || n(f.goldRate?.value),
    exchangeTesting: ogData.avgTesting,
    exchangeAmount: goldCredit,
    goldRate: n(f.goldRate.value),
    exchangeRate: ogData.avgRate,
    collections: colRows,
    collectedAmount: collectedAmount,
    collectedMethod: collectedMethod,
    collectedReference: collectedReference,
    amount: billCalc.amount,
    balance: billCalc.balance,
    notes: f.notes.value.trim(),
    status: 'Draft',
    createdAt: rcDocs('retail-estimate').find(x=>x.id===f.id.value)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

window.rcSaveEstimate = function(e){
  e.preventDefault();
  const f = e.target;
  if(!f.reportValidity()) return;
  const d = rcEstimateRead(f);
  if(!d.customerId || !d.items.length || d.items.some(x=>{
    const isSil = (x.metalType==='Silver')||String(x.product||'').toLowerCase().includes('silver');
    const pVal = isSil ? (n(x.purity)||92.5) : n(x.purity);
    return !x.product || x.netWeight<=0 || x.rate<=0 || pVal<1 || pVal>100;
  })){
    return say('Complete the customer and each item, including product, positive net weight, and rate.');
  }
  if(d.discount > d.items.reduce((s,x)=>s+x.subtotal,0)){
    return say('Discount cannot exceed the item total.');
  }
  if(f.elements.id.value && !confirm('Save changes to this quotation?')) return;
  const i = db.retailDocuments.findIndex(x=>x.id===d.id);
  if(i < 0) db.retailDocuments.push(d);
  else db.retailDocuments[i] = d;
  rcEstimateEdit = '';
  rcQuoteItemsCache = [];
  rcOldGoldItems = [];
  rcOldGoldEditId = '';
  rcOldGoldFormLocked = false;
  rcOldGoldSyncedQuoteId = null;
  const cloudSave = save();
  render();
  rcSaveStatus(cloudSave, 'Retail quotation');
};

function rcQuoteModel(q){
  const c = account(q.customerId, 'customer'),
        items = (q.items||[]).map(x=>rbItemCalc(x)),
        ogItems = rcNormalizeOldGoldItems(q),
        ogCreditFromItems = rbRound(ogItems.reduce((s, x) => s + n(x.amount), 0)),
        exchangeCredit = ogCreditFromItems > 0 ? ogCreditFromItems : (n(q.exchangeAmount) > 0 ? n(q.exchangeAmount) : rbRound(n(q.exchangeGross) * n(q.exchangeTesting||91.6) / 100 * n(q.exchangeRate))),
        ogLabel = ogItems.length > 0 ? ogItems.map(x => x.product || 'Old Gold').join(', ') : (q.exchangeProduct || 'Gold'),
        bill = rbBillCalc(items, {
          discountValue: n(q.discount),
          discountMode: 'amount',
          gstEnabled: !!q.gstEnabled,
          gstRate: q.gstEnabled ? n(q.gstRate||3) : 0,
          exchangeAmount: exchangeCredit,
          collectedAmount: n(q.collectedAmount)
        });

  const hasSplitCol = Array.isArray(q.collections) && q.collections.length > 1;
  const colRows = Array.isArray(q.collections) && q.collections.length > 0 ? q.collections : (n(q.collectedAmount) > 0 ? [{ method: q.collectedMethod || 'Cash', amount: q.collectedAmount, reference: q.collectedReference || '' }] : []);

  const totals = [
    ['Items total', rateMoney(bill.subtotal)],
    ...(bill.discount > 0 ? [['Discount', '− ' + rateMoney(bill.discount)]] : []),
    ...(bill.gstEnabled ? [['GST ' + (bill.gstRate) + '%', rateMoney(bill.gstAmount)]] : []),
    ['Purchase value', rateMoney(bill.saleBeforeRound)],
    ...(bill.exchangeAmount > 0 ? [['Old gold exchange (' + ogLabel + ')', '− ' + rateMoney(bill.exchangeAmount)]] : []),
    ['NET ESTIMATE PAYABLE', rateMoney(bill.amount), true],
    ...(bill.collectedAmount > 0 ? [
      ...(hasSplitCol ?
        colRows.filter(x=>n(x.amount)>0).map(x => [
          'Collected · ' + x.method + (x.reference ? ' (' + x.reference + ')' : ''),
          '− ' + rateMoney(x.amount)
        ]) : [
          ['Collected amount · ' + (q.collectedMethod||'Cash') + (q.collectedReference ? ' (' + q.collectedReference + ')' : ''), '− ' + rateMoney(bill.collectedAmount)]
        ]
      ),
      ...(hasSplitCol ? [['Total collected amount', '− ' + rateMoney(bill.collectedAmount)]] : []),
      [bill.balance < 0 ? 'Customer credit' : bill.balance === 0 ? '✓ Balance settled' : 'Balance to pay', rateMoney(Math.abs(bill.balance)), true]
    ] : [])
  ];

  const exchangeRowsPdf = ogItems.length > 0
    ? ogItems.map(x => ({
        product: (x.type ? x.type + (x.remarks ? ' - ' + x.remarks : '') : (x.product || 'Old Gold')),
        weight: n(x.netWeight ?? x.gross ?? 0),
        grossWeight: n(x.gross || 0),
        lessWeight: n(x.lessGrams || 0),
        pureRate: n(x.pureRate || q.goldRate || 0),
        testingPurity: n(x.testing || 91.6),
        rate: n(x.rate || q.exchangeRate || q.goldRate || 0),
        amount: n(x.amount || 0)
      }))
    : ((exchangeCredit > 0 || q.exchangeGross > 0) ? [{product: q.exchangeProduct||'Old Gold', weight: q.exchangeNet||q.exchangeGross||0, testingPurity: q.exchangeTesting||91.6, rate: q.exchangeRate||q.goldRate||0, amount: exchangeCredit}] : []);

  return {
    kind: 'bill',
    retail: true,
    title: 'ESTIMATION / QUOTATION',
    entityLabel: 'Customer',
    entityName: c?.name || 'Customer',
    entityDetails: [c?.address, c?.city, c?.phone, q.chitNumber ? 'Chit: ' + q.chitNumber : ''].filter(Boolean).join(' · '),
    reference: q.documentNo,
    date: pdfDateText(q.when),
    taxEnabled: q.gstEnabled,
    invoiceItems: items.map(x=>{
      const isSilver = String(x.metalType||'').toLowerCase()==='silver' || String(x.product||'').toLowerCase().includes('silver');
      return Object.assign({}, x, {purity: isSilver ? '—' : x.purity + '%'});
    }),
    exchange: exchangeRowsPdf,
    totals: totals,
    notes: [q.validUntil ? 'Valid until: ' + q.validUntil : '', q.reference, q.notes].filter(Boolean).join(' · ')
  };
}

window.rcPrintEstimate = function(){
  const f = document.getElementById('rcEstimateForm');
  if(!f?.reportValidity()) return;
  const q = rcEstimateRead(f);
  if(!q.customerId || q.items.some(x=>!x.product || x.netWeight<=0)){
    return say('Complete the customer and jewellery items before printing.');
  }
  pdfPrintModel(rcQuoteModel(q), 'retail');
};

window.rcPrintSavedEstimate = function(id){
  const q = rcDocs('retail-estimate').find(x=>x.id===id);
  if(q) pdfPrintModel(rcQuoteModel(q), 'retail');
};

window.rcShareQuoteWhatsApp = function(id){
  const q = rcDocs('retail-estimate').find(x=>x.id===id);
  if(!q) return say('Quotation not found.');
  const c = account(q.customerId, 'customer'),
        shop = db.shopName || goldleafContext?.shop_name || 'Goldleaf Jewellery';

  let msg = '*' + shop.toUpperCase() + '*\n';
  msg += '*ESTIMATION / QUOTATION*\n';
  msg += '--------------------------------\n';
  msg += 'Quote No: ' + q.documentNo + '\n';
  msg += 'Date: ' + (q.when ? q.when.replace('T', ' ') : 'Today') + '\n';
  msg += 'Customer: ' + (c?.name || 'Valued Customer') + (c?.phone ? ' (' + c.phone + ')' : '') + '\n';
  if(q.validUntil) msg += 'Valid Until: ' + q.validUntil + '\n';
  msg += '--------------------------------\n';
  msg += '*Items Quoted:*\n';
  (q.items||[]).forEach((item, idx)=>{
    msg += (idx+1) + '. *' + item.product + '* (' + (item.metalType||'Gold') + ' ' + item.purity + '%)\n';
    if(item.tagCode) msg += '   Tag: ' + item.tagCode + (item.huid ? ' | HUID: ' + item.huid : '') + '\n';
    msg += '   Gross: ' + fmt(item.grossWeight) + 'g | Net: ' + fmt(item.netWeight) + 'g\n';
    msg += '   Rate: ₹' + rateMoney(item.rate) + '/g | Total: ₹' + rateMoney(item.subtotal) + '\n';
  });
  msg += '--------------------------------\n';
  const subtotal = (q.items||[]).reduce((s,x)=>s+x.subtotal,0);
  msg += 'Items Total: ₹' + rateMoney(subtotal) + '\n';
  if(q.discount > 0) msg += 'Discount: ₹' + rateMoney(q.discount) + '\n';
  if(q.gstEnabled) msg += 'GST (' + (q.gstRate||3) + '%): ₹' + rateMoney(Math.max(0, subtotal - q.discount) * (q.gstRate||3) / 100) + '\n';
  const ogItems = rcNormalizeOldGoldItems(q);
  const exchangeCredit = ogItems.length > 0 ? rbRound(ogItems.reduce((s, x) => s + n(x.amount), 0)) : (n(q.exchangeAmount) > 0 ? n(q.exchangeAmount) : (n(q.exchangeGross) * n(q.exchangeTesting) / 100 * n(q.exchangeRate)));
  if(exchangeCredit > 0){
    if(ogItems.length > 1){
      msg += 'Old Gold Exchange:\n';
      ogItems.forEach(item => {
        msg += '  • ' + (item.product || 'Old Gold') + ' (' + fmt(item.gross) + 'g): ₹' + rateMoney(item.amount) + '\n';
      });
    }
    msg += 'Old Gold Credit: ₹' + rateMoney(exchangeCredit) + (q.exchangeGross > 0 ? (' (' + fmt(q.exchangeGross) + 'g)') : '') + '\n';
  }
  msg += '--------------------------------\n';
  msg += '*GRAND TOTAL: ₹' + rateMoney(q.amount) + '*\n';
  if(Array.isArray(q.collections) && q.collections.length > 1){
    msg += 'Collected Payments:\n';
    q.collections.filter(c => n(c.amount) > 0).forEach(c => {
      msg += '  • ' + c.method + ': ₹' + rateMoney(c.amount) + (c.reference ? ' (' + c.reference + ')' : '') + '\n';
    });
    msg += 'Paid Amount: ₹' + rateMoney(q.collectedAmount) + '\n';
    const bal = Math.max(0, n(q.amount) - n(q.collectedAmount));
    msg += '*Balance to Pay: ₹' + rateMoney(bal) + (bal === 0 && q.amount > 0 ? ' (Settled)' : '') + '*\n';
  } else if(n(q.collectedAmount) > 0){
    msg += 'Collected Amount: ₹' + rateMoney(q.collectedAmount) + ' (' + (q.collectedMethod||'Cash') + ')\n';
    const bal = Math.max(0, n(q.amount) - n(q.collectedAmount));
    msg += '*Balance to Pay: ₹' + rateMoney(bal) + (bal === 0 && q.amount > 0 ? ' (Settled)' : '') + '*\n';
  }
  msg += '--------------------------------\n';
  if(q.notes) msg += 'Note: ' + q.notes + '\n';
  msg += '*Rates are subject to daily market fluctuation.*\nThank you for choosing ' + shop + '!';

  const phone = (c?.phone||'').replace(/[^0-9]/g, '');
  const url = phone ? ('https://api.whatsapp.com/send?phone=91' + (phone.length===10?phone:phone.slice(-10)) + '&text=' + encodeURIComponent(msg)) : ('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg));
  window.open(url, '_blank');
};

window.rcConvert = function(id){
  const q = rcDocs('retail-estimate').find(x=>x.id===id);
  if(!q) return;
  if(!confirm('Convert Quotation ' + q.documentNo + ' into a Retail Sales Bill?')) return;
  rcSection = 'Bill';
  rcEstimateEdit = '';
  rbOpen('Bill');
  setTimeout(()=>{
    const f = document.getElementById('customerSaleForm');
    if(!f) return;
    f.elements.partyId.value = q.customerId;
    syncSaleAccount(f);
    f.elements.when.value = q.when || rbNow();
    f.elements.documentNo.value = ''; // Generate fresh bill number or leave empty
    if(f.elements.reference) f.elements.reference.value = 'Quote: ' + q.documentNo;
    
    // Replace items
    const tb = f.querySelector('#rbItemsTable');
    if(tb){
      tb.querySelectorAll('.rb-item').forEach(r => r.remove());
      const markup = q.items.map((x, i) => rbItemMarkup(x, i)).join('');
      tb.querySelector('tfoot').insertAdjacentHTML('beforebegin', markup);
    }
    
    if(f.elements.discountMode) f.elements.discountMode.value = 'amount';
    if(f.elements.discountValue) f.elements.discountValue.value = q.discount;
    if(f.elements.gstEnabled) f.elements.gstEnabled.checked = q.gstEnabled;
    if(f.elements.gstRate) f.elements.gstRate.value = q.gstRate || 3;
    if(f.elements.chitMappingId) f.elements.chitMappingId.value = q.chitMappingId || '';
    
    const ogItems = rcNormalizeOldGoldItems(q);
    if(ogItems.length > 0){
      toggleOldGold(true);
      const ogContainer = document.getElementById('oldGoldLines');
      if(ogContainer && typeof exchangeLineMarkup === 'function'){
        ogContainer.innerHTML = ogItems.map(item => exchangeLineMarkup({
          product: item.remarks || item.type || item.product || 'Old Jewellery',
          weight: n(item.netWeight ?? item.gross),
          purity: 22,
          testingPurity: n(item.testing || 91.6),
          rate: n(item.rate || q.goldRate),
          amount: n(item.amount)
        })).join('');
      } else {
        const row = document.querySelector('#oldGoldLines .exchange-line');
        if(row){
          row.querySelector('[data-exchange="product"]').value = q.exchangeProduct || 'Old Jewellery';
          if(q.exchangeNet > 0 || q.exchangeGross > 0) row.querySelector('[data-exchange="weight"]').value = q.exchangeNet || q.exchangeGross;
          if(q.exchangeTesting > 0) row.querySelector('[data-exchange="testingPurity"]').value = q.exchangeTesting;
          if(q.exchangeRate || q.goldRate) row.querySelector('[data-exchange="rate"]').value = q.exchangeRate || q.goldRate;
          const amtInput = row.querySelector('[data-exchange="amount"]');
          if(amtInput && n(q.exchangeAmount) > 0) amtInput.value = q.exchangeAmount;
        }
      }
    }
    if(Array.isArray(q.collections) && q.collections.length > 0){
      const cBox = f.querySelector('#rbCollections');
      if(cBox && typeof rbCollectionRow === 'function'){
        cBox.innerHTML = q.collections.map(c => rbCollectionRow(c)).join('');
      }
      const dirAmt = f.querySelector('#rbDirectAmount');
      if(dirAmt) dirAmt.value = q.collectedAmount;
      const dirMeth = f.querySelector('#rbDirectMethod');
      if(dirMeth && q.collections[0]) dirMeth.value = q.collections[0].method;
      const dirRef = f.querySelector('#rbDirectRef');
      if(dirRef) dirRef.value = q.collectedReference || ('Advance from Quote ' + q.documentNo);
      const totIn = f.querySelector('#rbTotalCollectedInput');
      if(totIn) totIn.value = q.collectedAmount;
    } else if(n(q.collectedAmount) > 0){
      const cRow = f.querySelector('#rbCollections .rb-collection-row');
      if(cRow){
        const amtIn = cRow.querySelector('[data-collection="amount"]');
        if(amtIn) amtIn.value = q.collectedAmount;
        const methSel = cRow.querySelector('[data-collection="method"]');
        if(methSel && q.collectedMethod) methSel.value = q.collectedMethod;
        const refIn = cRow.querySelector('[data-collection="reference"]');
        if(refIn) refIn.value = q.collectedReference || ('Advance from Quote ' + q.documentNo);
      }
      const dirAmt = f.querySelector('#rbDirectAmount');
      if(dirAmt) dirAmt.value = q.collectedAmount;
      const dirMeth = f.querySelector('#rbDirectMethod');
      if(dirMeth && q.collectedMethod) dirMeth.value = q.collectedMethod;
      const dirRef = f.querySelector('#rbDirectRef');
      if(dirRef) dirRef.value = q.collectedReference || ('Advance from Quote ' + q.documentNo);
      const totIn = f.querySelector('#rbTotalCollectedInput');
      if(totIn) totIn.value = q.collectedAmount;
    }
    rbMarkDirty(f);
    rbRecalc(f);
    say('Quotation ' + q.documentNo + ' successfully converted to Sales Bill. Review items and save.');
  }, 50);
};

function rcPopulateOldGoldFormFields(form, item=null){
  if(!form) return;
  const typeVal = item?.type || 'Old Gold';
  if(form.elements.exchangeType){
    form.elements.exchangeType.innerHTML = rcOldGoldTypeOptions(typeVal);
    form.elements.exchangeType.value = typeVal;
  }
  const pureRate = n(item?.pureRate) > 0 ? n(item.pureRate) : rcGetPureRateFromRateBook(typeVal, form);
  const testing = n(item?.testing) > 0 ? n(item.testing) : 91.6;
  const calcRate = pureRate > 0 ? rbRound(pureRate * testing / 100) : 0;
  const rateVal = n(item?.rate) > 0 ? n(item.rate) : calcRate;
  const lessType = item?.lessType === 'percent' ? 'percent' : 'grams';
  const grossVal = n(item?.gross) > 0 ? item.gross : '';
  const lessVal = n(item?.less) > 0 ? item.less : '';
  const netVal = n(item?.netWeight) > 0 ? Number(item.netWeight).toFixed(3) : (n(item?.gross) > 0 ? Number(item.gross).toFixed(3) : '');
  const amtVal = n(item?.amount) > 0 ? Number(item.amount).toFixed(2) : '';
  const remarksVal = item ? String(item.remarks ?? '') : '';

  if(form.elements.exchangeGross) form.elements.exchangeGross.value = grossVal;
  if(form.elements.exchangeLessType) form.elements.exchangeLessType.value = lessType;
  const lessLbl = document.getElementById('rcOgLessLabel');
  if(lessLbl) lessLbl.textContent = 'Less (' + (lessType === 'percent' ? '%' : 'g') + ')';
  if(form.elements.exchangeLess) form.elements.exchangeLess.value = lessVal;
  if(form.elements.exchangeNet) form.elements.exchangeNet.value = netVal;
  if(form.elements.exchangePureRate) form.elements.exchangePureRate.value = pureRate > 0 ? pureRate : '';
  if(form.elements.exchangeTesting) form.elements.exchangeTesting.value = testing;
  if(form.elements.exchangeRate){
    form.elements.exchangeRate.dataset.manualRate = '0';
    form.elements.exchangeRate.value = rateVal > 0 ? rateVal.toFixed(2) : '';
  }
  if(form.elements.exchangeAmount){
    form.elements.exchangeAmount.dataset.manualAmount = '0';
    form.elements.exchangeAmount.value = amtVal;
  }
  if(form.elements.exchangeProduct) form.elements.exchangeProduct.value = remarksVal;
}

function rcSyncOldGoldUI(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const textInputs = [
    form.elements.exchangeGross,
    form.elements.exchangeLess,
    form.elements.exchangePureRate,
    form.elements.exchangeTesting,
    form.elements.exchangeRate,
    form.elements.exchangeAmount,
    form.elements.exchangeProduct
  ];
  textInputs.forEach(inp => {
    if(!inp) return;
    inp.readOnly = !!rcOldGoldFormLocked;
    inp.classList.toggle('rc-og-input-locked', !!rcOldGoldFormLocked);
  });
  const selects = [
    form.elements.exchangeType,
    form.elements.exchangeLessType
  ];
  selects.forEach(sel => {
    if(!sel) return;
    sel.classList.toggle('rc-og-input-locked', !!rcOldGoldFormLocked);
  });
  if(form.elements.exchangeNet){
    form.elements.exchangeNet.readOnly = true;
  }

  const statusEl = document.getElementById('rcOgFormStatus');
  if(statusEl){
    statusEl.classList.remove('rc-og-status-saved', 'rc-og-status-editing', 'rc-og-status-entry');
    const activeIdx = rcOldGoldEditId ? (rcOldGoldItems.findIndex(x => x.id === rcOldGoldEditId) + 1) : 0;
    const activeItem = rcOldGoldEditId ? rcOldGoldItems.find(x => x.id === rcOldGoldEditId) : null;
    const activeLabel = activeItem ? ((activeItem.type || 'Old Gold') + (activeItem.remarks ? ' · ' + activeItem.remarks : '')) : 'Old Gold';
    if(rcOldGoldFormLocked && rcOldGoldEditId){
      statusEl.classList.add('rc-og-status-saved');
      statusEl.textContent = '✓ Item #' + activeIdx + ' Saved (' + activeLabel + ') — Click "Edit" to modify or "+ Add Item" for next item';
    } else if(!rcOldGoldFormLocked && rcOldGoldEditId){
      statusEl.classList.add('rc-og-status-editing');
      statusEl.textContent = '✎ Editing Item #' + activeIdx + ' (' + activeLabel + ') — Update fields & click "Save"';
    } else {
      statusEl.classList.add('rc-og-status-entry');
      statusEl.textContent = '🪙 Entering Old Gold Item #' + (rcOldGoldItems.length + 1) + (rcOldGoldItems.length > 0 ? ' (' + rcOldGoldItems.length + ' saved below)' : '');
    }
  }

  const listEl = document.getElementById('rcOldGoldItemsList');
  if(listEl){
    listEl.innerHTML = rcRenderOldGoldItemsMarkup(form);
  }
}

window.rcOldGoldSaveItem = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const ogData = rcCollectOldGoldData(form);
  const draft = ogData.draftItem;

  if(draft.gross <= 0 && draft.amount <= 0){
    say('Enter Old Gold weight or amount to save.');
    form.elements.exchangeGross?.focus();
    return;
  }

  if(rcOldGoldEditId){
    const idx = rcOldGoldItems.findIndex(x => x.id === rcOldGoldEditId);
    const savedItem = Object.assign({}, draft, {
      id: rcOldGoldEditId,
      remarks: draft.remarks || rcOldGoldItems[idx]?.remarks || '',
      product: draft.remarks || draft.type || ('Old Gold #' + (idx + 1))
    });
    if(idx >= 0){
      rcOldGoldItems[idx] = savedItem;
    }
    rcPopulateOldGoldFormFields(form, savedItem);
    rcOldGoldFormLocked = true;
    rcSyncOldGoldUI();
    rcRecalc();
    say('Old Gold item updated.');
  } else {
    const newId = 'og-' + (rcOldGoldItems.length + 1) + '-' + Date.now();
    const savedItem = Object.assign({}, draft, {
      id: newId,
      product: draft.remarks || draft.type || ('Old Gold #' + (rcOldGoldItems.length + 1))
    });
    rcOldGoldItems.push(savedItem);
    rcPopulateOldGoldFormFields(form, savedItem);
    rcOldGoldEditId = newId;
    rcOldGoldFormLocked = true;
    rcSyncOldGoldUI();
    rcRecalc();
    say('Old Gold item saved.');
  }
};

window.rcOldGoldEditTrigger = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  if(rcOldGoldEditId && rcOldGoldFormLocked){
    rcOldGoldFormLocked = false;
    rcSyncOldGoldUI();
    rcRecalc();
    form.elements.exchangeGross?.focus();
    return;
  }
  if(rcOldGoldItems.length > 0){
    const targetId = rcOldGoldEditId || rcOldGoldItems[rcOldGoldItems.length - 1].id;
    window.rcOldGoldEditItem(targetId);
    return;
  }
  rcOldGoldFormLocked = false;
  rcSyncOldGoldUI();
  form.elements.exchangeGross?.focus();
};

window.rcOldGoldEditItem = function(id){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const item = rcOldGoldItems.find(x => x.id === id);
  if(!item) return;
  rcOldGoldEditId = item.id;
  rcOldGoldFormLocked = false;
  rcPopulateOldGoldFormFields(form, item);
  rcSyncOldGoldUI();
  rcRecalc();
  form.elements.exchangeGross?.focus();
};

window.rcOldGoldAddItem = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const ogData = rcCollectOldGoldData(form);
  const draft = ogData.draftItem;

  if(!rcOldGoldFormLocked && (draft.gross > 0 || draft.amount > 0)){
    if(rcOldGoldEditId){
      const idx = rcOldGoldItems.findIndex(x => x.id === rcOldGoldEditId);
      if(idx >= 0){
        rcOldGoldItems[idx] = Object.assign({}, draft, {
          id: rcOldGoldEditId,
          remarks: draft.remarks || rcOldGoldItems[idx]?.remarks || '',
          product: draft.remarks || draft.type || ('Old Gold #' + (idx + 1))
        });
      }
    } else {
      rcOldGoldItems.push(Object.assign({}, draft, {
        id: 'og-' + (rcOldGoldItems.length + 1) + '-' + Date.now(),
        product: draft.remarks || draft.type || ('Old Gold #' + (rcOldGoldItems.length + 1))
      }));
    }
  }

  rcOldGoldEditId = '';
  rcOldGoldFormLocked = false;
  rcPopulateOldGoldFormFields(form, null);
  rcSyncOldGoldUI();
  rcRecalc();
  form.elements.exchangeGross?.focus();
};

window.rcOldGoldClearForm = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const fRemarks = String(form.elements.exchangeProduct?.value || '').trim();
  const fGross = n(form.elements.exchangeGross?.value);
  const fAmount = n(form.elements.exchangeAmount?.value);

  if(rcOldGoldEditId){
    if(rcOldGoldItems.length <= 1){
      rcOldGoldItems = [];
    }
    rcOldGoldEditId = '';
    rcOldGoldFormLocked = false;
  } else if(!fRemarks && fGross <= 0 && fAmount <= 0 && rcOldGoldItems.length > 0){
    rcOldGoldItems = [];
  }

  rcPopulateOldGoldFormFields(form, null);
  rcSyncOldGoldUI();
  rcRecalc();
};

window.rcOldGoldRemoveItem = function(id){
  const form = document.getElementById('rcEstimateForm');
  rcOldGoldItems = rcOldGoldItems.filter(x => x.id !== id);
  if(rcOldGoldEditId === id){
    if(rcOldGoldItems.length > 0){
      const last = rcOldGoldItems[rcOldGoldItems.length - 1];
      rcOldGoldEditId = last.id;
      rcOldGoldFormLocked = true;
      rcPopulateOldGoldFormFields(form, last);
    } else {
      rcOldGoldEditId = '';
      rcOldGoldFormLocked = false;
      rcPopulateOldGoldFormFields(form, null);
    }
  }
  rcSyncOldGoldUI();
  rcRecalc();
};

window.rcOldGoldClearAll = function(){
  const form = document.getElementById('rcEstimateForm');
  rcOldGoldItems = [];
  rcOldGoldEditId = '';
  rcOldGoldFormLocked = false;
  rcPopulateOldGoldFormFields(form, null);
  rcSyncOldGoldUI();
  rcRecalc();
};

window.rcOldGoldTypeChanged = function(sel){
  const form = document.getElementById('rcEstimateForm');
  if(!form || rcOldGoldFormLocked) return;
  const val = sel?.value || 'Old Gold';
  if(val === '__new__'){
    sel.value = 'Old Gold';
    window.rcOldGoldCreateNewType();
    return;
  }
  const defs = rcGetOldGoldTypeDefs();
  const def = defs.find(d => d.name.toLowerCase() === val.toLowerCase());
  if(def && n(def.touch) > 0 && form.elements.exchangeTesting){
    form.elements.exchangeTesting.value = def.touch;
  }
  const bookPure = rcGetPureRateFromRateBook(val, form);
  if(bookPure > 0 && form.elements.exchangePureRate){
    form.elements.exchangePureRate.value = bookPure;
  }
  window.rcOldGoldFieldChanged();
};

window.rcOpenOldGoldTypeModal = function(editingName = ''){
  document.getElementById('rcNewOldGoldTypeModal')?.remove();
  
  let currentName = '';
  let currentMetal = 'Gold';
  let currentTouch = 91.6;
  const isEditing = !!(editingName && typeof editingName === 'string');
  
  if(isEditing){
    const all = rcGetAllOldGoldTypesForSettings();
    const found = all.find(t => t.name.toLowerCase() === editingName.trim().toLowerCase());
    if(found){
      currentName = found.name;
      currentMetal = found.metal === 'Silver' ? 'Silver' : 'Gold';
      currentTouch = n(found.touch) > 0 ? found.touch : (currentMetal === 'Silver' ? 80 : 91.6);
    } else {
      currentName = editingName.trim();
    }
  }

  const modalHtml = '<div id="rcNewOldGoldTypeModal" class="rc-og-type-modal-backdrop" onclick="if(event.target===this)this.remove()">'
    + '<div class="rc-og-type-modal-card">'
    + '<div class="rc-og-type-modal-head">'
    + '<h3>' + (isEditing ? '✎ Edit Old Gold Type' : '＋ Create New Old Gold Type') + '</h3>'
    + '<button type="button" class="rc-og-type-modal-close" onclick="document.getElementById(\'rcNewOldGoldTypeModal\')?.remove()">✕</button>'
    + '</div>'
    + '<div class="rc-og-type-modal-body">'
    + '<input type="hidden" id="rcOgModalOriginalName" value="' + esc(isEditing ? currentName : '') + '">'
    + '<label>Type Name *<input id="rcNewOgTypeName" type="text" value="' + esc(currentName) + '" placeholder="e.g. 916 Coin Gold, 18K Antique Gold" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rcOldGoldSaveNewTypeModal()}"></label>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">'
    + '<label>Metal Category<select id="rcNewOgTypeMetal" onchange="document.getElementById(\'rcNewOgTypeTouch\').value=this.value===\'Silver\'?80:91.6">'
    + '<option value="Gold" ' + (currentMetal === 'Gold' ? 'selected' : '') + '>Gold (24K Pure Rate)</option>'
    + '<option value="Silver" ' + (currentMetal === 'Silver' ? 'selected' : '') + '>Silver (Pure Rate)</option>'
    + '</select></label>'
    + '<label>Default Touch(%)<input id="rcNewOgTypeTouch" type="number" min="1" max="100" step=".01" value="' + esc(currentTouch) + '"></label>'
    + '</div>'
    + '<p style="margin:10px 0 0 0;font-size:11.5px;color:#64748b">Pure rate is automatically fetched from Rate Book (24K Gold or Pure Silver) based on the chosen metal category.</p>'
    + '</div>'
    + '<div class="rc-og-type-modal-foot">'
    + '<button type="button" onclick="document.getElementById(\'rcNewOldGoldTypeModal\')?.remove()">Cancel</button>'
    + '<button type="button" class="primary" onclick="rcOldGoldSaveNewTypeModal()">💾 ' + (isEditing ? 'Save Changes' : 'Save Type') + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setTimeout(() => document.getElementById('rcNewOgTypeName')?.focus(), 40);
};

window.rcSettingsOpenTypeModal = window.rcOpenOldGoldTypeModal;

window.rcOldGoldCreateNewType = function(directName='', directMetal='Gold', directTouch=91.6){
  if(directName && typeof directName === 'string' && directName.trim()){
    rcSaveOldGoldType(directName, directMetal, directTouch);
    const form = document.getElementById('rcEstimateForm');
    if(form){
      rcOldGoldFormLocked = false;
      if(form.elements.exchangeType){
        form.elements.exchangeType.innerHTML = rcOldGoldTypeOptions(directName.trim());
        form.elements.exchangeType.value = directName.trim();
      }
      if(form.elements.exchangeTesting) form.elements.exchangeTesting.value = directTouch;
      const bookPure = rcGetPureRateFromRateBook(directName.trim(), form);
      if(bookPure > 0 && form.elements.exchangePureRate) form.elements.exchangePureRate.value = bookPure;
      rcSyncOldGoldUI();
      window.rcOldGoldFieldChanged();
    }
    say('Saved Old Gold Type: ' + directName.trim());
    return directName.trim();
  }
  window.rcOpenOldGoldTypeModal('');
};

window.rcOldGoldSaveNewTypeModal = function(){
  const origIn = document.getElementById('rcOgModalOriginalName');
  const nameIn = document.getElementById('rcNewOgTypeName');
  const metalIn = document.getElementById('rcNewOgTypeMetal');
  const touchIn = document.getElementById('rcNewOgTypeTouch');
  const name = String(nameIn?.value || '').trim();
  if(!name){
    say('Enter a Type Name.');
    nameIn?.focus();
    return;
  }
  const origName = String(origIn?.value || '').trim();
  const metal = metalIn?.value === 'Silver' ? 'Silver' : 'Gold';
  const touch = n(touchIn?.value) > 0 ? n(touchIn.value) : (metal === 'Silver' ? 80 : 91.6);
  document.getElementById('rcNewOldGoldTypeModal')?.remove();
  
  rcSaveOldGoldType(name, metal, touch, origName);
  
  if(typeof page !== 'undefined' && page === 'Settings'){
    render();
  }
  const form = document.getElementById('rcEstimateForm');
  if(form && form.elements.exchangeType){
    form.elements.exchangeType.innerHTML = rcOldGoldTypeOptions(name);
    form.elements.exchangeType.value = name;
    if(form.elements.exchangeTesting) form.elements.exchangeTesting.value = touch;
    const bookPure = rcGetPureRateFromRateBook(name, form);
    if(bookPure > 0 && form.elements.exchangePureRate) form.elements.exchangePureRate.value = bookPure;
    rcSyncOldGoldUI();
    window.rcOldGoldFieldChanged();
  }
  say('Saved Old Gold Type: ' + name);
};

window.rcDeleteOldGoldTypeAction = function(name){
  const clean = String(name || '').trim();
  if(!clean) return;
  if(!confirm('Are you sure you want to remove the Old Gold Type "' + clean + '"?')) return;
  rcDeleteOldGoldType(clean);
  if(typeof page !== 'undefined' && page === 'Settings') render();
  const form = document.getElementById('rcEstimateForm');
  if(form && form.elements.exchangeType){
    form.elements.exchangeType.innerHTML = rcOldGoldTypeOptions('Old Gold');
    rcOldGoldTypeChanged(form.elements.exchangeType);
  }
  say('Removed Old Gold Type: ' + clean);
};

window.rcResetOldGoldTypeAction = function(name){
  const clean = String(name || '').trim();
  if(!clean) return;
  if(!confirm('Reset "' + clean + '" to default purity and settings?')) return;
  rcResetOldGoldType(clean);
  if(typeof page !== 'undefined' && page === 'Settings') render();
  const form = document.getElementById('rcEstimateForm');
  if(form && form.elements.exchangeType){
    form.elements.exchangeType.innerHTML = rcOldGoldTypeOptions(clean);
    rcOldGoldTypeChanged(form.elements.exchangeType);
  }
  say('Reset Old Gold Type: ' + clean);
};

window.rcBaseGoldRateChanged = function(inp){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const newBase = n(inp?.value);
  if(!rcOldGoldFormLocked && newBase > 0){
    const fType = String(form.elements.exchangeType?.value || 'Old Gold');
    const isSilver = fType.toLowerCase().includes('silver');
    if(!isSilver && (!n(db?.rates?.gold24) || n(form.elements.exchangePureRate?.value) === 0 || n(form.elements.exchangePureRate?.value) === n(db?.rates?.gold24))){
      if(form.elements.exchangePureRate){
        form.elements.exchangePureRate.value = n(db?.rates?.gold24) || newBase;
      }
      window.rcOldGoldFieldChanged();
      return;
    }
  }
  rcRecalc();
};

window.rcOldGoldFieldChanged = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form || rcOldGoldFormLocked) return;
  const fType = String(form.elements.exchangeType?.value || 'Old Gold');
  const gross = n(form.elements.exchangeGross?.value);
  const lessType = form.elements.exchangeLessType?.value === 'percent' ? 'percent' : 'grams';
  const less = n(form.elements.exchangeLess?.value);
  const lessLbl = document.getElementById('rcOgLessLabel');
  if(lessLbl) lessLbl.textContent = 'Less (' + (lessType === 'percent' ? '%' : 'g') + ')';

  const lessGrams = lessType === 'percent' ? rbGrams(gross * less / 100) : rbGrams(less);
  const netWeight = rbGrams(Math.max(0, gross - lessGrams));
  if(form.elements.exchangeNet){
    form.elements.exchangeNet.value = (gross > 0 || less > 0) ? netWeight.toFixed(3) : '';
  }

  let pureRate = n(form.elements.exchangePureRate?.value);
  if(pureRate <= 0){
    pureRate = rcGetPureRateFromRateBook(fType, form);
    if(pureRate > 0 && form.elements.exchangePureRate){
      form.elements.exchangePureRate.value = pureRate;
    }
  }
  const touch = n(form.elements.exchangeTesting?.value || 91.6);
  const calcRate = pureRate > 0 ? rbRound(pureRate * touch / 100) : n(form.elements.exchangeRate?.value);

  if(form.elements.exchangeRate){
    form.elements.exchangeRate.dataset.manualRate = '0';
    form.elements.exchangeRate.value = calcRate > 0 ? calcRate.toFixed(2) : '';
  }
  const credit = rbRound(netWeight * calcRate);
  if(form.elements.exchangeAmount){
    form.elements.exchangeAmount.dataset.manualAmount = '0';
    form.elements.exchangeAmount.value = credit > 0 ? credit.toFixed(2) : '';
  }
  rcRecalc();
};

window.rcOldGoldRateManualChanged = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form || rcOldGoldFormLocked) return;
  if(form.elements.exchangeRate) form.elements.exchangeRate.dataset.manualRate = '1';
  const gross = n(form.elements.exchangeGross?.value);
  const lessType = form.elements.exchangeLessType?.value === 'percent' ? 'percent' : 'grams';
  const less = n(form.elements.exchangeLess?.value);
  const lessGrams = lessType === 'percent' ? rbGrams(gross * less / 100) : rbGrams(less);
  const netWeight = rbGrams(Math.max(0, gross - lessGrams));
  const rate = n(form.elements.exchangeRate?.value);
  const credit = rbRound(netWeight * rate);
  if(form.elements.exchangeAmount){
    form.elements.exchangeAmount.dataset.manualAmount = '0';
    form.elements.exchangeAmount.value = credit > 0 ? credit.toFixed(2) : '';
  }
  rcRecalc();
};

window.rcOldGoldAmountChanged = function(){
  const form = document.getElementById('rcEstimateForm');
  if(!form || rcOldGoldFormLocked) return;
  if(form.elements.exchangeAmount) form.elements.exchangeAmount.dataset.manualAmount = '1';
  rcRecalc();
};

window.rcCollectionMethodChanged = function(sel){
  rcRecalc();
};

window.rcCollectionRow = function(c){
  const method = c?.method || 'Cash';
  const amount = (c?.amount !== undefined && c?.amount !== null && c?.amount !== '') ? c.amount : '';
  const ref = c?.reference || '';
  const methods = ['Cash', 'GPay', 'PhonePe', 'Card', 'Bank transfer', 'Cheque'];
  if(method && !methods.includes(method)) methods.unshift(method);
  const methodOptions = methods.map(m => '<option value="' + m + '" ' + (m === method ? 'selected' : '') + '>' + m + '</option>').join('');

  return '<div class="rc-collection-row rc-pos-row">'
    + '<input type="number" class="rc-collection-amount rc-pos-amount-input" inputmode="decimal" placeholder="0.00" min="0" step="any" value="' + amount + '" oninput="rcRecalc()">'
    + '<select class="rc-collection-method rc-pos-method-select" onchange="rcRecalc()">' + methodOptions + '</select>'
    + '<input type="text" class="rc-collection-ref rc-pos-ref-input" placeholder="UPI / Cheque / Txn" value="' + esc(ref) + '" oninput="rcRecalc()">'
    + '<button type="button" class="rc-collection-remove rc-pos-remove-btn" onclick="rcRemoveCollection(this)" title="Remove payment">✕</button>'
    + '</div>';
};

window.rcAddCollection = function(){
  const container = document.getElementById('rcCollectionsList');
  if(!container) return;
  const existingRows = container.querySelectorAll('.rc-collection-row');
  const nextMethod = existingRows.length === 1 ? 'GPay' : (existingRows.length === 2 ? 'PhonePe' : (existingRows.length === 3 ? 'Card' : 'Cash'));
  container.insertAdjacentHTML('beforeend', rcCollectionRow({ method: nextMethod, amount: '', reference: '' }));
  rcRecalc();
  const allAmounts = container.querySelectorAll('.rc-collection-amount');
  if(allAmounts.length > 0) allAmounts[allAmounts.length - 1].focus();
};

window.rcTogglePosDrawer = function(type){
  if(type === 'chit'){
    const topChit = document.querySelector('select[name="chitMappingId"]');
    if(topChit){
      topChit.scrollIntoView({ behavior: 'smooth', block: 'center' });
      topChit.focus();
      const wrap = topChit.closest('label') || topChit;
      wrap.classList.add('rc-highlight-pulse');
      setTimeout(() => wrap.classList.remove('rc-highlight-pulse'), 1500);
      return;
    }
  }
  const drawer = document.getElementById('rcPosDrawer_' + type);
  const pill = document.getElementById('rcPill_' + type);
  if(!drawer) return;
  const isCurrentlyOpen = drawer.classList.contains('rc-drawer-open');
  if(isCurrentlyOpen){
    drawer.classList.remove('rc-drawer-open');
    if(pill) pill.classList.remove('active');
    rcRecalc();
  } else {
    document.querySelectorAll('.rc-pos-drawer.rc-drawer-open').forEach(d => {
      d.classList.remove('rc-drawer-open');
      const otherType = d.id.replace('rcPosDrawer_', '');
      document.getElementById('rcPill_' + otherType)?.classList.remove('active');
    });
    drawer.classList.add('rc-drawer-open');
    if(pill) pill.classList.add('active');
    if(type === 'oldgold'){
      const dd = document.getElementById('rcOldGoldDropdown');
      if(dd && dd.classList.contains('hidden')){
        if(typeof window.rcToggleOldGold === 'function') window.rcToggleOldGold();
      }
    }
    rcRecalc();
    const firstInput = drawer.querySelector('input:not([type="hidden"]), select, textarea');
    if(firstInput) setTimeout(() => firstInput.focus(), 50);
  }
};

window.rcFocusAdvance = function(){
  const inp = document.querySelector('#rcCollectionsList .rc-pos-amount-input');
  if(inp){
    inp.focus();
    inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.rcRemoveCollection = function(btn){
  const row = btn?.closest('.rc-collection-row');
  const container = document.getElementById('rcCollectionsList');
  if(row){
    row.remove();
    if(container && !container.querySelectorAll('.rc-collection-row').length){
      container.insertAdjacentHTML('beforeend', rcCollectionRow({ method: 'Cash', amount: '', reference: '' }));
    }
    rcRecalc();
  }
};

function rcReadCollections(form){
  const f = form || document.getElementById('rcEstimateForm');
  if(!f) return [];
  const container = f.querySelector('#rcCollectionsList');
  if(!container) return [];
  const rows = [...container.querySelectorAll('.rc-collection-row')];
  return rows.map(r => {
    const meth = r.querySelector('.rc-collection-method')?.value || 'Cash';
    const amt = n(r.querySelector('.rc-collection-amount')?.value);
    const ref = String(r.querySelector('.rc-collection-ref')?.value || '').trim();
    return { method: meth, amount: amt, reference: ref };
  }).filter(x => x.amount > 0 || x.reference);
}

window.rcToggleOldGold = function() {
  const dropdown = document.getElementById('rcOldGoldDropdown');
  const btn = document.getElementById('rcOldGoldToggleBtn');
  const chev = document.getElementById('rcOldGoldChevron');
  const hint = btn?.querySelector('.rc-old-gold-hint');
  if (!dropdown) return;
  const isHidden = dropdown.classList.toggle('hidden');
  if (btn) {
    btn.setAttribute('aria-expanded', String(!isHidden));
    btn.classList.toggle('active', !isHidden);
  }
  if (chev) chev.textContent = isHidden ? '▼' : '▲';
  if (hint) hint.textContent = isHidden ? 'Click to enter Old Gold data' : 'Click to collapse';
  if (!isHidden) {
    dropdown.querySelector('input[name="exchangeProduct"]')?.focus({ preventScroll: true });
  }
};

function rcRecalc(){
  const form = document.getElementById('rcEstimateForm');
  if(!form) return;
  const items = rcQuoteReadRows();
  const discount = n(form.elements.discount?.value);
  const gstOn = !!form.elements.gstEnabled?.checked;
  const gstRate = gstOn ? n(form.elements.gstRate?.value||3) : 0;

  const ogData = rcCollectOldGoldData(form);
  const goldCredit = ogData.totalAmount;

  const listEl = document.getElementById('rcOldGoldItemsList');
  if(listEl){
    listEl.innerHTML = rcRenderOldGoldItemsMarkup(form);
  }

  // Multi-method split payments calculation
  let collected = 0;
  const colRows = rcReadCollections(form);
  const colAmounts = form.querySelectorAll('#rcCollectionsList .rc-collection-amount');
  if(colAmounts.length > 0){
    colAmounts.forEach(inp => {
      collected += n(inp.value);
    });
  } else {
    collected = n(form.elements.collectedAmount?.value);
  }
  collected = rbRound(collected);

  // Sync hidden inputs
  const hidAmt = form.querySelector('#rcHiddenCollectedAmount') || form.elements.collectedAmount;
  if(hidAmt && hidAmt.type === 'hidden') hidAmt.value = collected;
  const hidMeth = form.querySelector('#rcHiddenCollectedMethod');
  if(hidMeth) hidMeth.value = colRows[0]?.method || 'Cash';
  const hidRef = form.querySelector('#rcHiddenCollectedReference');
  if(hidRef) hidRef.value = colRows.map(c => c.reference).filter(Boolean).join(', ');

  // Exact Sales Entry Bill calculation engine
  const bill = rbBillCalc(items, {
    discountValue: discount,
    discountMode: 'amount',
    gstEnabled: gstOn,
    gstRate: gstRate,
    exchangeAmount: goldCredit,
    collectedAmount: collected
  });

  const totGross = bill.grossWeight;
  const totStone = items.reduce((s,x)=>s+x.stoneWeight, 0);
  const totNet = bill.weight;

  const elGross = document.getElementById('rcQuoteTotalGross');
  if(elGross) elGross.textContent = fmt(totGross) + ' g';
  const elStone = document.getElementById('rcQuoteTotalStone');
  if(elStone) elStone.textContent = fmt(totStone) + ' g';
  const elNet = document.getElementById('rcQuoteTotalNet');
  if(elNet) elNet.textContent = fmt(totNet) + ' g';
  const elItemsVal = document.getElementById('rcQuoteTotalItemsVal');
  if(elItemsVal) elItemsVal.textContent = rateMoney(bill.subtotal);

  const elSub = document.getElementById('rcSubtotal');
  if(elSub) elSub.textContent = rateMoney(bill.subtotal);
  const elDisc = document.getElementById('rcDiscount');
  if(elDisc) elDisc.textContent = rateMoney(bill.discount);
  const elAdjDisc = document.getElementById('rcAdjDiscountVal');
  if(elAdjDisc) elAdjDisc.textContent = rateMoney(bill.discount);
  const elGST = document.getElementById('rcGST');
  if(elGST) elGST.textContent = rateMoney(bill.gstAmount);
  const elPurchValSummary = document.getElementById('rcPurchaseVal');
  if(elPurchValSummary) elPurchValSummary.textContent = rateMoney(bill.saleBeforeRound);
  const elGold = document.getElementById('rcOldGold');
  if(elGold) elGold.textContent = rateMoney(bill.exchangeAmount);
  const elBadge = document.getElementById('rcOldGoldBadge');
  if(elBadge) elBadge.textContent = rateMoney(bill.exchangeAmount);
  const elCreditSum = document.getElementById('rcOldGoldCreditSummary');
  if(elCreditSum) elCreditSum.textContent = rateMoney(bill.exchangeAmount);
  const elFinal = document.getElementById('rcFinal');
  if(elFinal) elFinal.textContent = rateMoney(bill.amount);

  // Payment Received Card Header: Total (Net Due = Purchase Value - Old Gold) and Paid (Collected)
  const elNetTot = document.getElementById('rcPosNetTotal');
  if(elNetTot) elNetTot.textContent = rateMoney(bill.amount);
  const elCol = document.getElementById('rcCollected');
  if(elCol) elCol.textContent = rateMoney(bill.collectedAmount);
  const elColTot = document.getElementById('rcCollectionsTotal');
  if(elColTot) elColTot.textContent = rateMoney(bill.collectedAmount);

  // Old Gold Banner in Payment Received Card
  const elPurchVal = document.getElementById('rcPosPurchVal');
  if(elPurchVal) elPurchVal.textContent = rateMoney(bill.saleBeforeRound);
  const elOGVal = document.getElementById('rcPosOGVal');
  if(elOGVal) elOGVal.textContent = rateMoney(bill.exchangeAmount);
  const elOGValMain = document.getElementById('rcPosOldGoldVal');
  if(elOGValMain) elOGValMain.textContent = rateMoney(bill.exchangeAmount);
  const elFormulaTot = document.getElementById('rcPosFormulaTotal');
  if(elFormulaTot) elFormulaTot.textContent = rateMoney(bill.amount);
  const ogBanner = document.getElementById('rcPosOldGoldBanner');
  if(ogBanner) ogBanner.classList.toggle('hidden', !(bill.exchangeAmount > 0));

  const elAdvBill = document.getElementById('rcAdvBillTotal');
  if(elAdvBill) elAdvBill.textContent = rateMoney(bill.amount);
  const elAdvLive = document.getElementById('rcAdvanceLiveTotal');
  if(elAdvLive) elAdvLive.textContent = rateMoney(bill.collectedAmount);
  const elBal = document.getElementById('rcBalanceDue');
  if(elBal) elBal.textContent = rateMoney(Math.abs(bill.balance));
  const elBalTot = document.getElementById('rcBalGrandTotal');
  if(elBalTot) elBalTot.textContent = rateMoney(bill.amount);
  const elBalAdv = document.getElementById('rcBalAdvance');
  if(elBalAdv) elBalAdv.textContent = rateMoney(bill.collectedAmount);
  const balBox = document.getElementById('rcBalanceBox');
  if(balBox){
    balBox.classList.remove('rc-balance-paid', 'rc-balance-due', 'rc-balance-credit');
    const balLbl = document.getElementById('rcBalanceLabel');
    const balRemText = balBox.querySelector('.rc-bal-rem-text');
    if(bill.balance === 0 && (bill.amount > 0 || bill.collectedAmount > 0)){
      balBox.classList.add('rc-balance-paid');
      if(balLbl) balLbl.textContent = '✓ BALANCE FULLY SETTLED';
      if(balRemText) balRemText.textContent = 'Settled: ';
    } else if(bill.balance < 0){
      balBox.classList.add('rc-balance-credit');
      if(balLbl) balLbl.textContent = 'CUSTOMER CREDIT';
      if(balRemText) balRemText.textContent = 'Excess: ';
    } else {
      balBox.classList.add('rc-balance-due');
      if(balLbl) balLbl.textContent = 'BALANCE TO PAY';
      if(balRemText) balRemText.textContent = 'Remaining: ';
    }
  }
  // Dynamic mobile pills update
  const pOldGold = document.getElementById('rcPill_oldgold');
  if(pOldGold){
    const isOgOpen = document.getElementById('rcPosDrawer_oldgold')?.classList.contains('rc-drawer-open');
    const ogCaret = isOgOpen ? ' ▴' : ' ▾';
    if(goldCredit > 0){
      pOldGold.textContent = '🪙 Old Gold (' + rateMoney(goldCredit) + ')' + ogCaret;
      pOldGold.classList.add('has-value');
    } else {
      pOldGold.textContent = '+ Old Gold' + ogCaret;
      pOldGold.classList.remove('has-value');
    }
  }
  const pDisc = document.getElementById('rcPill_discount');
  if(pDisc){
    if(discount > 0){
      pDisc.textContent = '🏷️ Disc (' + rateMoney(discount) + ')';
      pDisc.classList.add('has-value');
    } else {
      pDisc.textContent = '🏷️ Discount';
      pDisc.classList.remove('has-value');
    }
  }
  const pGST = document.getElementById('rcPill_gst');
  if(pGST){
    pGST.textContent = '💰 GST ' + (gstOn ? ((gstRate || 3) + '%') : '(Off)');
    pGST.classList.toggle('active', gstOn);
  }
  const pChit = document.getElementById('rcPill_chit');
  if(pChit){
    const chitVal = form.elements.chitMappingId?.value;
    if(chitVal){
      pChit.textContent = '✓ Chit';
      pChit.classList.add('has-value');
    } else {
      pChit.textContent = '+ Chit';
      pChit.classList.remove('has-value');
    }
  }
  const elCount = document.getElementById('rcQuoteItemCount');
  if(elCount) elCount.textContent = items.length + ' item(s)';
}

function rcModeOptions(values,current){return values.map(([v,l])=>'<option value="'+v+'" '+(v===(current||values[0][0])?'selected':'')+'>'+l+'</option>').join('')}
function rcProductsView(){const list=rcDocs('retail-product'),x=list.find(p=>p.id===rcProductEdit);return '<section class="panel"><h2>'+(x?'Edit retail product':'Retail product master')+'</h2><p class="muted">Product defaults flow into tagging, sales and quotations.</p><form class="rc-grid rc-master-form" onsubmit="rcSaveProduct(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Product group<input name="group" value="'+esc(x?.group||'')+'" placeholder="Gold, Silver"></label><label>Product name *<input name="name" required maxlength="100" value="'+esc(x?.name||'')+'"></label><label>Print name<input name="printName" value="'+esc(x?.printName||'')+'"></label><label>Purity %<input name="purity" type="number" min="1" max="100" step=".01" value="'+(x?.purity||92)+'"></label><label>Wastage type<select name="wastageMode">'+rcModeOptions([['percent','Percentage (%)'],['grams','Weight (g)']],x?.wastageMode)+'</select></label><label>Wastage value<input name="wastage" type="number" min="0" step=".001" value="'+(x?.wastage||0)+'"></label><label>Making charge type<select name="makingMode">'+rcModeOptions([['fixed','Fixed amount'],['piece','Per piece'],['gram','Per gram'],['percent','Percentage'] ],x?.makingMode)+'</select></label><label>Making charge value<input name="makingRate" type="number" min="0" step=".01" value="'+(x?.makingRate||0)+'"></label><label>HSN<input name="hsn" value="'+esc(x?.hsn||'')+'"></label><label>Product size<input name="size" value="'+esc(x?.size||'')+'"></label><label>HUID<input name="huid" value="'+esc(x?.huid||'')+'"></label><label>Stone type<select name="stoneType">'+rcModeOptions([['none','None'],['diamond','Diamond'],['stone','Stone'],['other','Other']],x?.stoneType)+'</select></label><label>Stone pieces<input name="stonePieces" type="number" min="0" step="1" value="'+(x?.stonePieces||0)+'"></label><label>Stone carat<input name="stoneCarat" type="number" min="0" step=".001" value="'+(x?.stoneCarat||0)+'"></label><label>Stone / certificate charge ₹<input name="stoneCharge" type="number" min="0" step=".01" value="'+(x?.stoneCharge||0)+'"></label><label class="rc-wide">Description / remarks<input name="description" value="'+esc(x?.description||'')+'"></label><div class="rc-actions rc-wide"><button class="primary">'+(x?'Update product':'Add product')+'</button><button type="button" onclick="rcProductEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Products · '+list.length+'</h2>'+ (list.length?table(['Group','Product','Purity','Wastage','MC type','Making','HUID','Stone','HSN',''],list.map(p=>[esc(p.group||'—'),esc(p.name),p.purity+'%',(p.wastageMode==='grams'?'g':'%')+' '+n(p.wastage),esc(p.makingMode||'piece'),rateMoney(p.makingRate),esc(p.huid||'—'),esc(p.stoneType||'none'),esc(p.hsn||'—'),'<button type="button" onclick="rcEditProduct(\''+esc(p.id)+'\')">Edit</button>'])):'<p class="muted">Add the first retail product above.</p>')+'</section>'}
window.rcEditProduct=id=>{rcProductEdit=id;render()};window.rcSaveProduct=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),name=String(d.name||'').trim(),purity=n(d.purity);if(!name||purity<1||purity>100)return say('Enter a product name and purity from 1 to 100%.');if(d.id&&!confirm('Save changes to this product?'))return;const old=rcDocs('retail-product').find(x=>x.id===d.id),p=Object.assign({},old||{},{id:d.id||crypto.randomUUID(),kind:'retail-product',accountType:'customer',name,group:String(d.group||'').trim(),printName:String(d.printName||'').trim(),purity,wastage:n(d.wastage),wastageMode:d.wastageMode==='grams'?'grams':'percent',makingRate:n(d.makingRate),makingMode:['fixed','piece','gram','percent'].includes(d.makingMode)?d.makingMode:'piece',hsn:String(d.hsn||'').trim(),size:String(d.size||'').trim(),huid:String(d.huid||'').trim(),stoneType:d.stoneType||'none',stonePieces:n(d.stonePieces),stoneCarat:n(d.stoneCarat),stoneCharge:n(d.stoneCharge),description:String(d.description||'').trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}),i=db.retailDocuments.findIndex(x=>x.id===p.id);if(i<0)db.retailDocuments.push(p);else db.retailDocuments[i]=p;rcProductEdit='';const cloudSave=save();render();rcSaveStatus(cloudSave,'Retail product')};
function rcTaggingView(){const rows=rcDocs('retail-tagging'),x=rows.find(t=>t.id===rcTagEdit),prods=rcDocs('retail-product'),groups=[...new Set(prods.map(p=>p.group).filter(Boolean))];return '<section class="panel"><h2>'+(x?'Edit tagged item':'Retail product tagging')+'</h2><p class="muted">Tag stock by weight or by item. Charge types and stone details carry into Retail sale and quotation entries.</p><form class="rc-grid rc-master-form" onsubmit="rcSaveTag(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Tag / barcode *<span class="rc-scan-wrap"><input name="tagCode" id="rcTagCode" required value="'+esc(x?.tagCode||'')+'" autocomplete="off"><button type="button" onclick="rcScanTag()">▣ Scan</button></span></label><label>Tag date<input name="tagDate" type="date" value="'+esc(x?.tagDate||new Date().toISOString().slice(0,10))+'"></label><label>Entry mode<select name="entryMode">'+rcModeOptions([['gram','Gram based'],['item','Item based']],x?.entryMode)+'</select></label><label>Lot entry<input name="lotEntry" value="'+esc(x?.lotEntry||'')+'"></label><label>Product group<select name="group"><option value="">Select group</option>'+groups.map(g=>'<option '+(g===x?.group?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label><label>Product name *<input name="product" list="rcProductNames" required value="'+esc(x?.product||'')+'"><datalist id="rcProductNames">'+prods.map(p=>'<option value="'+esc(p.name)+'">').join('')+'</datalist></label><label>Print name<input name="printName" value="'+esc(x?.printName||'')+'"></label><label>Pieces<input name="pieces" type="number" min="1" step="1" value="'+(x?.pieces||1)+'"></label><label>Gross weight · g *<input name="grossWeight" type="number" min=".001" step=".001" required value="'+(x?.grossWeight||'')+'"></label><label>Net weight · g<input name="netWeight" type="number" min="0" step=".001" value="'+(x?.netWeight??Math.max(0,n(x?.grossWeight)-n(x?.lessWeight)))+'"></label><label>Less weight · g<input name="lessWeight" type="number" min="0" step=".001" value="'+(x?.lessWeight||0)+'"></label><label>MC type<select name="makingMode">'+rcModeOptions([['fixed','Fixed'],['piece','Per piece'],['gram','Per gram'],['percent','Percentage']],x?.makingMode)+'</select></label><label>Making charge · amount<input name="makingRate" type="number" min="0" step=".01" value="'+(x?.makingRate||0)+'"></label><label>Wastage type<select name="wastageMode">'+rcModeOptions([['percent','Percentage (%)'],['grams','Weight (g)']],x?.wastageMode)+'</select></label><label>Wastage value<input name="wastage" type="number" min="0" step=".001" value="'+(x?.wastage||0)+'"></label><label>Purity · %<input name="purity" type="number" min="1" max="100" step=".01" required value="'+(x?.purity||92)+'"></label><label>Rate / gram · ₹<input name="rate" type="number" min="0" step=".01" value="'+(x?.rate||v2RateForPurity(x?.purity||92))+'"></label><label>HUID<input name="huid" value="'+esc(x?.huid||'')+'"></label><label>Ornament purity / touch<input name="ornamentPurity" type="number" min="0" max="100" step=".01" value="'+(x?.ornamentPurity||'')+'"></label><label>Product size<input name="size" value="'+esc(x?.size||'')+'"></label><label>Stone type<select name="stoneType">'+rcModeOptions([['none','None'],['diamond','Diamond'],['stone','Stone'],['other','Other']],x?.stoneType)+'</select></label><label>Diamond / stone pieces<input name="stonePieces" type="number" min="0" step="1" value="'+(x?.stonePieces||0)+'"></label><label>Diamond / stone carat<input name="stoneCarat" type="number" min="0" step=".001" value="'+(x?.stoneCarat||0)+'"></label><label>Stone / certificate charge · ₹<input name="stoneCharge" type="number" min="0" step=".01" value="'+(x?.stoneCharge||0)+'"></label><label>Reference 1<input name="reference1" value="'+esc(x?.reference1||'')+'"></label><label>Reference 2<input name="reference2" value="'+esc(x?.reference2||'')+'"></label><label>Status<select name="status">'+rbOptions(['In stock','Reserved','Sold'],x?.status||'In stock')+'</select></label><label>Location<input name="location" value="'+esc(x?.location||'')+'"></label><label class="rc-wide">Remarks<input name="remarks" value="'+esc(x?.remarks||'')+'"></label><div class="rc-actions rc-wide"><button type="button" onclick="rcSaveTag(event,true)">Save & print tag</button><button class="primary">'+(x?'Save changes':'Create tag')+'</button><button type="button" onclick="rcTagEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Tagged items · '+rows.length+'</h2>'+ (rows.length?table(['Tag','Mode','Product','Pcs','Gross','Net','MC type','MC','Wst type','Wastage','Purity','HUID','Stone','Status',''],rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).map(t=>[esc(t.tagCode),esc(t.entryMode||'gram'),esc(t.product),t.pieces,fmt(t.grossWeight),fmt(t.netWeight??(t.grossWeight-t.lessWeight)),esc(t.makingMode||'piece'),(t.makingMode==='percent'?n(t.makingRate)+'%':rateMoney(t.makingRate)),esc(t.wastageMode||'percent'),(t.wastageMode==='grams'?fmt(t.wastage)+' g':n(t.wastage)+'%'),n(t.purity)+'%',esc(t.huid||'—'),esc(t.stoneType||'none'),esc(t.status),'<button type="button" onclick="rcEditTag(\''+esc(t.id)+'\')">Edit</button> <button type="button" onclick="rcPrintOneTag(\''+esc(t.id)+'\')">Print</button>'])):'<p class="muted">No items tagged yet.</p>')+'</section>'}
window.rcScanTag=function(){const field=document.getElementById('rcTagCode')||document.getElementById('rcQuoteTagInput');if(window.openQrScanner){window.openQrScanner(code=>{if(field){field.value=code;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}if(document.getElementById('rcQuoteTagInput')===field&&typeof window.rcQuoteAddByTag==='function')window.rcQuoteAddByTag();});return;}if(field)field.focus();};

// Batch tagging workflow modeled on the reference ERP while retaining Goldleaf Retail cloud documents.
window.rcRateForMetal=function(metalType,purity,rateType='metal-default',manualRate=0){
  if(n(manualRate)>0&&rateType==='manual')return n(manualRate);
  const m=String(metalType||'Gold').trim().toLowerCase(),r=db?.rates||{};
  if(m==='silver'){
    if(rateType==='silver-pure')return n(r.silver)||n(r.silverBoard);
    return n(r.silverBoard)||n(r.silver);
  }
  if(m==='gold'){
    const p=Number(purity)||92;
    if(p<=24&&p>=20){
      const k=Math.round(p);
      if(k===24)return n(r.gold24);
      if(k===22)return n(r.gold22)||(n(r.gold24)*22/24);
      if(k===18)return n(r.gold18)||(n(r.gold24)*18/24);
      if(k===14)return n(r.gold14)||(n(r.gold24)*14/24);
      return n(r.gold24)*k/24;
    }
    if(p>=91&&p<=92)return n(r.gold22)||(n(r.gold24)*22/24);
    if(p>=74&&p<=76)return n(r.gold18)||(n(r.gold24)*18/24);
    if(p>=57&&p<=59)return n(r.gold14)||(n(r.gold24)*14/24);
    if(p>=99)return n(r.gold24);
    if(p>24)return n(r.gold24)*(p/100);
    return typeof v2RateForPurity==='function'?v2RateForPurity(p,r):(n(r.gold24)*p/24);
  }
  if(m==='platinum')return n(r.platinum);
  return 0;
};

window.rcCalcTagTotal=function(o){
  const net=n(o.netWeight),rate=n(o.rate),wst=n(o.wastage),wstMode=o.wastageMode==='grams'?'grams':'percent';
  const wstGrams=wstMode==='grams'?wst:net*wst/100,mc=n(o.makingRate),mcMode=o.makingMode||'fixed',pcs=n(o.pieces)||1;
  const mcTot=mc*(mcMode==='piece'?pcs:mcMode==='gram'?net:1);
  const total=(net*rate)+(wstGrams*rate)+mcTot+n(o.stoneCharge);
  return typeof rbRound==='function'?rbRound(total):Math.round(total*100)/100;
};

let rcTagMode='gram',rcTagBatch=[];
function rcTagSelect(options,current){return options.map(([v,l])=>'<option value="'+esc(v)+'" '+(String(v)===String(current)?'selected':'')+'>'+esc(l)+'</option>').join('')}
function rcTagProductOptions(selected=''){return '<option value="">Select product</option>'+rcDocs('retail-product').map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.name)+'</option>').join('')}

function rcTagRow(x={},i=0){
  let products=rcDocs('retail-product'),
      p=products.find(z=>z.id===x.productId)||products.find(z=>z.name===x.product),
      net=x.netWeight??Math.max(0,n(x.grossWeight)-n(x.lessWeight)),
      metalType=x.metalType||p?.metalType||(String(x.product||'').toLowerCase().includes('silver')?'Silver':'Gold'),
      isSilver=metalType==='Silver'||String(p?.name||x.product||'').toLowerCase().includes('silver'),
      rateVal=(x.rate!==undefined&&x.rate!==null&&x.rate!=='')?n(x.rate):rcRateForMetal(metalType,x.purity??p?.purity??(isSilver?92.5:92),p?.rateType,p?.manualRate),
      totalVal=x.totalAmount??rcCalcTagTotal({netWeight:net,rate:rateVal,wastage:x.wastage??p?.wastage??0,wastageMode:x.wastageMode??p?.wastageMode??'percent',makingRate:x.makingRate??p?.makingRate??0,makingMode:x.makingMode??p?.makingMode??'fixed',pieces:x.pieces||1,stoneCharge:x.stoneCharge??p?.stoneCharge??0});
  return '<article class="rc-tag-row" data-tag-id="'+esc(x.id||'')+'">'
    +'<header><b>Tag item '+(i+1)+'</b><button type="button" class="rc-tag-remove" onclick="rcTagRemoveRow(this)">Remove</button></header>'
    +'<div class="rc-tag-fields">'
    +'<label>Tag / barcode *<span class="rc-scan-wrap"><input data-tag="tagCode" required value="'+esc(x.tagCode||'')+'" autocomplete="off"><button type="button" class="gl-scan-btn" onclick="openQrScannerForTagRow(this)" title="Scan QR / Barcode with Camera" aria-label="Scan QR / Barcode">'+(window.glScanIconSvg||'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/></svg>')+'</button></span></label>'
    +'<label>Ornament / metal *<select data-tag="metalType" onchange="rcTagMetalChanged(this)">'+rcTagSelect([['Gold','Gold'],['Silver','Silver'],['Platinum','Platinum'],['Other','Other']],metalType)+'</select></label>'
    +'<label>Product group<select data-tag="group"><option value="">Select group</option>'+[...new Set(products.map(z=>z.group).filter(Boolean))].map(g=>'<option '+(g===(x.group||p?.group)?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label>'
    +'<label>Product name *<select data-tag="productId" required onchange="rcTagProductChanged(this)">'+rcTagProductOptions(p?.id||'')+'</select></label>'
    +'<label>Print name<input data-tag="printName" value="'+esc(x.printName||p?.printName||'')+'"></label>'
    +'<label>Pieces<input data-tag="pieces" type="number" min="1" step="1" oninput="rcTagItemRecalc(this)" value="'+(x.pieces||1)+'"></label>'
    +'<label>Gross weight · g '+(rcTagMode==='gram'?'*':'')+'<input data-tag="grossWeight" type="number" min="0" step=".001" oninput="rcTagWeight(this)" '+(rcTagMode==='gram'?'required':'')+' value="'+(x.grossWeight??'')+'"></label>'
    +'<label>Less / stone weight · g<input data-tag="lessWeight" type="number" min="0" step=".001" oninput="rcTagWeight(this)" value="'+(x.lessWeight||0)+'"></label>'
    +'<label>Net weight · g<input data-tag="netWeight" type="number" min="0" step=".001" oninput="this.dataset.manualNet=\'1\';rcTagItemRecalc(this)" value="'+fmt(net)+'"></label>'
    +'<label class="rc-tag-purity-label" style="display:'+(isSilver?'none':'grid')+'">Purity · % *<input data-tag="purity" type="number" min="1" max="100" step=".01" '+(isSilver?'':'required')+' oninput="rcTagPurityChanged(this)" value="'+(x.purity??p?.purity??(isSilver?92.5:92))+'"></label>'
    +'<label>Rate / gram · ₹<input data-tag="rate" type="number" min="0" step=".01" oninput="rcTagRateInput(this)" placeholder="From Rate Book" value="'+(rateVal>0?rateVal.toFixed(2):'')+'"></label>'
    +'<label>Estimated total · ₹<input data-tag="totalAmount" readonly value="'+rateMoney(totalVal)+'" style="font-weight:600;background:#f6f9f6;color:#18392a"></label>'
    +'<label>MC type<select data-tag="makingMode" onchange="rcTagItemRecalc(this)">'+rcTagSelect([['fixed','Fixed amount'],['piece','Per piece'],['gram','Per gram'],['percent','%'],['percent-gram','% per gram']],x.makingMode||p?.makingMode||'fixed')+'</select></label>'
    +'<label>Making charge<input data-tag="makingRate" type="number" min="0" step=".01" oninput="rcTagItemRecalc(this)" value="'+(x.makingRate??p?.makingRate??'')+'"></label>'
    +'<label>Wastage type<select data-tag="wastageMode" onchange="rcTagItemRecalc(this)">'+rcTagSelect([['percent','%'],['grams','Grams']],x.wastageMode||p?.wastageMode||'percent')+'</select></label>'
    +'<label>Wastage value<input data-tag="wastage" type="number" min="0" step=".001" oninput="rcTagItemRecalc(this)" value="'+(x.wastage??p?.wastage??0)+'"></label>'
    +'<label>HUID<input data-tag="huid" value="'+esc(x.huid||p?.huid||'')+'"></label>'
    +'<label>Stone type<select data-tag="stoneType">'+rcTagSelect([['none','None'],['diamond','Diamond'],['stone','Stone'],['other','Other']],x.stoneType||p?.stoneType||'none')+'</select></label>'
    +'<label>Diamond / stone pieces<input data-tag="stonePieces" type="number" min="0" step="1" value="'+(x.stonePieces??p?.stonePieces??0)+'"></label>'
    +'<label>Diamond / stone carat<input data-tag="stoneCarat" type="number" min="0" step=".001" value="'+(x.stoneCarat??p?.stoneCarat??0)+'"></label>'
    +'<label>Diamond certificate / CC · ₹<input data-tag="stoneCharge" type="number" min="0" step=".01" oninput="rcTagItemRecalc(this)" value="'+(x.stoneCharge??p?.stoneCharge??0)+'"></label>'
    +'<label>Ornament purity / touch<input data-tag="ornamentPurity" type="number" min="0" max="100" step=".01" value="'+(x.ornamentPurity??'')+'"></label>'
    +'<label>Product size<input data-tag="size" value="'+esc(x.size||p?.size||'')+'"></label>'
    +'<label>Reference 1<input data-tag="reference1" value="'+esc(x.reference1||'')+'"></label>'
    +'<label>Reference 2<input data-tag="reference2" value="'+esc(x.reference2||'')+'"></label>'
    +'<label>Status<select data-tag="status">'+rcTagSelect([['In stock','In stock'],['Reserved','Reserved'],['Sold','Sold']],x.status||'In stock')+'</select></label>'
    +'<label>Stock location<input data-tag="location" value="'+esc(x.location||'')+'"></label>'
    +'<label class="rc-tag-wide">Remarks<input data-tag="remarks" value="'+esc(x.remarks||'')+'"></label>'
    +'</div></article>';
}

function rcTaggingView(){
  const rows=rcDocs('retail-tagging').sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))),
        x=rows.find(t=>t.id===rcTagEdit),
        products=rcDocs('retail-product'),
        supplier=x?.supplier||'',tray=x?.tray||'',counter=x?.counter||'',
        batch=x?.batchId||crypto.randomUUID();
  rcTagMode=x?(x.entryMode==='item'?'item':'gram'):rcTagMode;
  rcTagBatch=x?[x]:[{}];
  return '<section class="panel"><div class="rc-section-title"><div><h2>'+(x?'Edit tagged item':'Retail product tagging')+'</h2><p class="muted">Build a tag batch, enter each piece or gram based item, then save, display or print the tags.</p></div><span>'+rows.length+' tags in stock</span></div><form id="rcTagBatchForm" onsubmit="rcSaveTagBatch(event)"><input type="hidden" name="batchId" value="'+esc(batch)+'"><section class="rc-tag-batch-meta"><label>Tag date *<input name="tagDate" type="date" required value="'+esc(x?.tagDate||new Date().toISOString().slice(0,10))+'"></label><label>Lot entry<input name="lotEntry" value="'+esc(x?.lotEntry||'')+'" placeholder="Lot / batch reference"></label><label>Supplier<input name="supplier" value="'+esc(supplier)+'" placeholder="Supplier name"></label><label>Tray<input name="tray" value="'+esc(tray)+'" placeholder="Tray number"></label><label>Counter<input name="counter" value="'+esc(counter)+'" placeholder="Counter"></label><label>No. of rows<input name="rowCount" type="number" min="1" step="1" onchange="rcSetTagRowCount(this)" value="'+rcTagBatch.length+'"></label><label class="rc-tag-check"><input name="isEcommerce" type="checkbox" '+(x?.isEcommerce?'checked':'')+'> E-commerce</label></section><div class="rc-tag-modebar"><b>Products info</b><div role="group" aria-label="Tagging entry mode"><button type="button" class="'+(rcTagMode==='gram'?'active':'')+'" onclick="rcSetTagMode(\'gram\')">⚖ Gram based</button><button type="button" class="'+(rcTagMode==='item'?'active':'')+'" onclick="rcSetTagMode(\'item\')">▣ Item based</button></div></div><div id="rcTagRows">'+rcTagBatch.map(rcTagRow).join('')+'</div><div class="rc-tag-actions"><button type="button" onclick="rcAddTagRow()">＋ Add new item</button><button type="button" onclick="rcAddTagRow(\'group\')">＋ Same product group</button><button type="button" onclick="rcAddTagRow(\'product\')">＋ Same product</button><button type="button" onclick="rcDisplayTagBatch()">Display / preview</button><button type="button" onclick="rcSaveTagBatch(event,true)">Save & print tags</button><button class="primary">'+(x?'Save changes':'Save tag batch')+'</button><button type="button" onclick="rcTagEdit=\'\';rcTagMode=\'gram\';render()">Clear / new</button></div></form></section><section class="panel"><div class="rc-section-title"><h2>Tagged items · '+rows.length+'</h2><span>Retail stock</span></div>'+(rows.length?table(['Tag / Barcode','Date','Lot','Product','Metal','Group','Pcs','Gross g','Net g','Rate ₹/g','Total ₹','Purity %','HUID','Status','Actions'],rows.map(t=>[esc(t.tagCode),esc(t.tagDate||''),esc(t.lotEntry||''),esc(t.product),esc(t.metalType||'Gold'),esc(t.group||'—'),n(t.pieces)||1,fmt(t.grossWeight),fmt(t.netWeight),rateMoney(t.rate),rateMoney(t.totalAmount),((t.metalType==='Silver'||String(t.product||'').toLowerCase().includes('silver'))?'—':(n(t.purity)+'%')),esc(t.huid||'—'),esc(t.status||'In stock'),'<button type="button" onclick="rcEditTag(\''+esc(t.id)+'\')">Edit</button> <button type="button" onclick="rcPrintOneTag(\''+esc(t.id)+'\')">Print</button>'])):'<p class="muted">No tagged items yet.</p>')+'</section>';
}

window.rcSetTagMode=function(mode){rcTagMode=mode==='item'?'item':'gram';const f=document.getElementById('rcTagBatchForm');if(!f)return;const data=rcTagReadRows(),meta=new FormData(f);const keep={tagDate:meta.get('tagDate'),lotEntry:meta.get('lotEntry'),supplier:meta.get('supplier'),tray:meta.get('tray'),counter:meta.get('counter'),rowCount:data.length,isEcommerce:f.elements.isEcommerce.checked};rcTagBatch=data;render();Object.entries(keep).forEach(([k,v])=>{const el=f.elements[k];if(el)if(el.type==='checkbox')el.checked=!!v;else el.value=v})};

window.rcTagCalcRow=function(row){
  if(!row)return;
  const netIn=row.querySelector('[data-tag="netWeight"]');
  const gross=n(row.querySelector('[data-tag="grossWeight"]')?.value);
  const less=n(row.querySelector('[data-tag="lessWeight"]')?.value);
  if(netIn&&netIn.dataset.manualNet!=='1')netIn.value=fmt(Math.max(0,gross-less));
  const net=n(netIn?.value??Math.max(0,gross-less));
  const rate=n(row.querySelector('[data-tag="rate"]')?.value);
  const wastage=n(row.querySelector('[data-tag="wastage"]')?.value);
  const wastageMode=row.querySelector('[data-tag="wastageMode"]')?.value||'percent';
  const makingRate=n(row.querySelector('[data-tag="makingRate"]')?.value);
  const makingMode=row.querySelector('[data-tag="makingMode"]')?.value||'fixed';
  const pieces=n(row.querySelector('[data-tag="pieces"]')?.value)||1;
  const stoneCharge=n(row.querySelector('[data-tag="stoneCharge"]')?.value);
  const total=rcCalcTagTotal({netWeight:net,rate,wastage,wastageMode,makingRate,makingMode,pieces,stoneCharge});
  const totOut=row.querySelector('[data-tag="totalAmount"]');
  if(totOut)totOut.value=rateMoney(total);
};

window.rcTagWeight=function(input){const row=input.closest('.rc-tag-row');if(row)rcTagCalcRow(row)};
window.rcTagRateInput=function(input){const row=input.closest('.rc-tag-row');if(row)rcTagCalcRow(row)};
window.rcTagItemRecalc=function(input){const row=input.closest('.rc-tag-row');if(row)rcTagCalcRow(row)};

window.rcTagMetalChanged=function(select){
  const row=select.closest('.rc-tag-row');if(!row)return;
  const metal=select.value;
  const isSilver=metal==='Silver';
  const purLabel=row.querySelector('.rc-tag-purity-label');
  const purityIn=row.querySelector('[data-tag="purity"]');
  if(purLabel) purLabel.style.display=isSilver?'none':'grid';
  if(purityIn){
    if(isSilver){
      purityIn.removeAttribute('required');
      if(!purityIn.value||Number(purityIn.value)<=0) purityIn.value=92.5;
    } else {
      purityIn.setAttribute('required','');
      if(!purityIn.value||Number(purityIn.value)<=0) purityIn.value=92;
    }
  }
  const p=rcDocs('retail-product').find(z=>z.id===row.querySelector('[data-tag="productId"]')?.value);
  const rate=rcRateForMetal(metal,purityIn?.value||(isSilver?92.5:92),p?.rateType,p?.manualRate);
  const rateIn=row.querySelector('[data-tag="rate"]');
  if(rateIn)rateIn.value=rate>0?rate.toFixed(2):'';
  rcTagCalcRow(row);
};

window.rcTagPurityChanged=function(input){
  const row=input.closest('.rc-tag-row');if(!row)return;
  const metal=row.querySelector('[data-tag="metalType"]')?.value||'Gold';
  const p=rcDocs('retail-product').find(z=>z.id===row.querySelector('[data-tag="productId"]')?.value);
  const rate=rcRateForMetal(metal,input.value,p?.rateType,p?.manualRate);
  const rateIn=row.querySelector('[data-tag="rate"]');
  if(rateIn&&rate>0)rateIn.value=rate.toFixed(2);
  rcTagCalcRow(row);
};

window.rcTagProductChanged=function(select){
  const p=rcDocs('retail-product').find(z=>z.id===select.value),r=select.closest('.rc-tag-row');if(!p||!r)return;
  const metal=p.metalType||(String(p.name||'').toLowerCase().includes('silver')?'Silver':'Gold');
  const isSilver=metal==='Silver'||String(p.name||'').toLowerCase().includes('silver');
  const metalSel=r.querySelector('[data-tag="metalType"]');
  if(metalSel)metalSel.value=metal;
  const purLabel=r.querySelector('.rc-tag-purity-label');
  const purInput=r.querySelector('[data-tag="purity"]');
  if(purLabel) purLabel.style.display=isSilver?'none':'grid';
  if(purInput){
    if(isSilver) purInput.removeAttribute('required');
    else purInput.setAttribute('required','');
  }
  const values={group:p.group||'',printName:p.printName||'',makingMode:p.makingMode||'fixed',makingRate:p.makingRate||0,wastageMode:p.wastageMode||'percent',wastage:p.wastage||0,purity:p.purity||(isSilver?92.5:92),huid:p.huid||'',stoneType:p.stoneType||'none',stonePieces:p.stonePieces||0,stoneCarat:p.stoneCarat||0,stoneCharge:p.stoneCharge||0,size:p.size||''};
  for(const [k,v] of Object.entries(values)){const el=r.querySelector('[data-tag="'+k+'"]');if(el)el.value=v}
  const rate=rcRateForMetal(metal,values.purity,p.rateType,p.manualRate);
  const rateIn=r.querySelector('[data-tag="rate"]');
  if(rateIn)rateIn.value=rate>0?rate.toFixed(2):'';
  rcTagCalcRow(r);
};

function rcTagReadRows(){
  return [...document.querySelectorAll('#rcTagRows .rc-tag-row')].map(r=>{
    const x={id:r.dataset.tagId||''};
    r.querySelectorAll('[data-tag]').forEach(e=>x[e.dataset.tag]=e.value);
    const p=rcDocs('retail-product').find(z=>z.id===x.productId);
    x.product=p?.name||x.product||'';
    x.group=x.group||p?.group||'';
    x.metalType=x.metalType||p?.metalType||'Gold';
    const isSilver=x.metalType==='Silver'||String(x.product||'').toLowerCase().includes('silver');
    if(isSilver && (!x.purity || Number(x.purity)<=0)) x.purity = 92.5;
    x.rate=n(x.rate);
    x.totalAmount=n(String(x.totalAmount||'').replace(/[^\d.-]/g,''));
    x.netWeight=n(x.netWeight);
    return x;
  });
}

window.rcAddTagRow=function(kind=''){
  const existing=rcTagReadRows(),last=existing.at(-1)||{},p=rcDocs('retail-product').find(z=>z.id===last.productId);
  const add=kind==='product'?{...last,id:'',tagCode:''}:kind==='group'?{group:last.group,metalType:last.metalType,tagCode:''}:{};
  document.getElementById('rcTagRows').insertAdjacentHTML('beforeend',rcTagRow(add,existing.length));
  document.querySelector('#rcTagBatchForm [name="rowCount"]').value=existing.length+1;
};

window.rcTagRemoveRow=function(btn){
  const rows=document.querySelectorAll('#rcTagRows .rc-tag-row');if(rows.length<=1)return say('Keep at least one tag item.');
  btn.closest('.rc-tag-row').remove();
  document.querySelectorAll('#rcTagRows .rc-tag-row>header b').forEach((b,i)=>b.textContent='Tag item '+(i+1));
  const c=document.querySelector('#rcTagBatchForm [name="rowCount"]');if(c)c.value=document.querySelectorAll('#rcTagRows .rc-tag-row').length;
};

window.rcScanTagRow=function(btn){
  if(window.openQrScannerForTagRow){
    window.openQrScannerForTagRow(btn);
  } else {
    const field=btn.closest('.rc-scan-wrap')?.querySelector('input');if(field)field.focus();
  }
};

function rcTagReadMeta(){const f=document.getElementById('rcTagBatchForm'),d=Object.fromEntries(new FormData(f));d.isEcommerce=f.elements.isEcommerce.checked;return d}

window.rcSaveTagBatch=function(e,printAfter=false){
  e.preventDefault();const f=e.target.closest('form');if(!f?.reportValidity())return;
  const meta=rcTagReadMeta(),items=rcTagReadRows(),seen=new Set();
  if(n(meta.rowCount)!==items.length)return say('The row count does not match the tag items.');
  for(const t of items){
    const p=rcDocs('retail-product').find(z=>z.id===t.productId),
          isSilver=(t.metalType==='Silver')||String(p?.name||t.product||'').toLowerCase().includes('silver');
    let purity=n(t.purity);
    if(isSilver&&purity<=0) purity=92.5;
    const gross=n(t.grossWeight),net=n(t.netWeight);
    if(!t.tagCode||!p||purity<1||purity>100||(rcTagMode==='gram'&&gross<=0)||(rcTagMode==='item'&&n(t.pieces)<1))return say('Complete each tag, product, pieces and purity; Gram based items also need gross weight.');
    const code=t.tagCode.trim().toLowerCase();if(seen.has(code))return say('Each tag / barcode in this batch must be unique.');seen.add(code);
    if(rcDocs('retail-tagging').some(z=>z.id!==t.id&&String(z.tagCode).toLowerCase()===code))return say('Tag / barcode '+t.tagCode+' already exists.');
    if(net<0||gross>0&&net>gross)return say('Net weight must be between zero and gross weight.');
  }
  if(rcTagEdit&&!confirm('Save changes to this tag?'))return;
  const now=new Date().toISOString();
  for(const t of items){
    const old=rcDocs('retail-tagging').find(z=>z.id===t.id),
          p=rcDocs('retail-product').find(z=>z.id===t.productId),
          isSilver=(t.metalType==='Silver')||String(p?.name||t.product||'').toLowerCase().includes('silver'),
          purity=n(t.purity)<=0&&isSilver?92.5:n(t.purity),
          tag={...(old||{}),id:t.id||crypto.randomUUID(),kind:'retail-tagging',accountType:'customer',
               batchId:meta.batchId||crypto.randomUUID(),tagDate:meta.tagDate,lotEntry:String(meta.lotEntry||'').trim(),
               supplier:String(meta.supplier||'').trim(),tray:String(meta.tray||'').trim(),counter:String(meta.counter||'').trim(),
               rowCount:items.length,isEcommerce:!!meta.isEcommerce,entryMode:rcTagMode,tagCode:t.tagCode.trim(),
               productId:t.productId,product:t.product,group:t.group,metalType:t.metalType||'Gold',
               rate:n(t.rate),totalAmount:n(t.totalAmount),printName:t.printName,pieces:n(t.pieces)||1,
               grossWeight:n(t.grossWeight),lessWeight:n(t.lessWeight),netWeight:n(t.netWeight),
               makingMode:t.makingMode,makingRate:n(t.makingRate),wastageMode:t.wastageMode==='grams'?'grams':'percent',wastage:n(t.wastage),
               purity:purity,huid:t.huid,stoneType:t.stoneType,stonePieces:n(t.stonePieces),stoneCarat:n(t.stoneCarat),stoneCharge:n(t.stoneCharge),
               ornamentPurity:n(t.ornamentPurity),size:t.size,reference1:t.reference1,reference2:t.reference2,
               status:t.status,location:t.location,remarks:t.remarks,createdAt:old?.createdAt||now,updatedAt:now};
    const i=db.retailDocuments.findIndex(z=>z.id===tag.id);
    if(i<0)db.retailDocuments.push(tag);else db.retailDocuments[i]=tag;
  }
  const printed=items.map(t=>Object.assign({},t,rcDocs('retail-tagging').find(z=>z.tagCode===t.tagCode)||{}));
  rcTagEdit='';const pending=save();render();rcSaveStatus(pending,'Retail tag batch');
  if(printAfter)rcPrintTagBatch(printed);
};

function rcGenerateQrSvg(text,size=66){
  if(!text)return '';
  if(window.QRCode){
    try{
      const dummy=document.createElement('div');
      const qr=new window.QRCode(dummy,{
        text:String(text).trim(),
        correctLevel:window.QRCode.CorrectLevel.M
      });
      const model=qr._oQRCode;
      if(model){
        const count=model.getModuleCount();
        const margin=2;
        const total=count+(margin*2);
        let pathD='';
        for(let r=0;r<count;r++){
          for(let c=0;c<count;c++){
            if(model.isDark(r,c)){
              pathD+='M'+(c+margin)+','+(r+margin)+'h1v1h-1z ';
            }
          }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+total+' '+total+'" width="'+size+'" height="'+size+'" shape-rendering="crispEdges" style="display:block;width:'+size+'px;height:'+size+'px;background:#ffffff;" aria-label="QR Code '+esc(text)+'"><rect width="'+total+'" height="'+total+'" fill="#ffffff"/><path d="'+pathD+'" fill="#000000"/></svg>';
      }
    }catch(e){
      console.warn('QR SVG render error:',e);
    }
  }
  return '';
}

function rcRenderTagQr(container,text,size=70){
  if(!container||!text)return;
  const svg=rcGenerateQrSvg(text,size);
  if(svg){
    container.innerHTML=svg;
    return;
  }
  if(window.QRCode){
    try{
      container.innerHTML='';
      new window.QRCode(container,{
        text:String(text).trim(),
        width:size,
        height:size,
        colorDark:'#000000',
        colorLight:'#ffffff',
        correctLevel:window.QRCode.CorrectLevel.M
      });
    }catch(_){}
  }
}

window.rcDisplayTagBatch=function(){
  const items=rcTagReadRows();if(!items.some(t=>t.tagCode||t.productId))return say('Enter at least one product and tag first.');
  const old=document.querySelector('.rc-tag-preview');old?.remove();
  const box=document.createElement('div');box.className='retail-modal-backdrop rc-tag-preview';
  box.innerHTML='<section class="retail-modal"><header class="retail-modal-head"><h2>Tag preview · '+items.length+' item(s)</h2><div style="display:flex;gap:8px"><button type="button" class="primary" onclick="rcPrintTagBatch();this.closest(\'.retail-modal-backdrop\').remove()">🖨 Print tags with QR</button><button type="button" onclick="this.closest(\'.retail-modal-backdrop\').remove()">Close</button></div></header><div class="retail-modal-scroll"><div class="rc-tag-preview-grid">'+items.map((t,idx)=>{
    const isSil=(t.metalType==='Silver')||String(t.product||'').toLowerCase().includes('silver');
    const purText=isSil?'':(' · '+esc(t.purity)+'%');
    return '<article class="rc-tag-preview-card"><div class="rc-tag-preview-qr" id="rcPrevQr_'+idx+'">'+rcGenerateQrSvg(t.tagCode||'GL-TAG',76)+'</div><div class="rc-tag-preview-meta"><b>'+esc(t.printName||t.product||'Product')+'</b><div class="rc-tag-code-badge">'+esc(t.tagCode||'No barcode')+' · '+(t.metalType||'Gold')+'</div><span>'+fmt(t.netWeight??t.grossWeight)+' g'+purText+'</span>'+(t.size?'<small>Size: '+esc(t.size)+'</small>':'')+'<small>₹'+rateMoney(t.rate)+'/g · Total ₹'+rateMoney(t.totalAmount)+'</small>'+(t.huid?'<small>HUID '+esc(t.huid)+'</small>':'')+'</div></article>';
  }).join('')+'</div></div></section>';
  document.body.append(box);
  items.forEach((t,idx)=>{
    const el=document.getElementById('rcPrevQr_'+idx);
    if(el&&!el.querySelector('svg'))rcRenderTagQr(el,t.tagCode||'GL-TAG',76);
  });
};

window.rcPrintTagBatch=function(items){
  items=items||rcTagReadRows();if(!items||!items.length)return;
  const old=document.getElementById('rcTagPrintSheet');old?.remove();
  const sheet=document.createElement('div');sheet.id='rcTagPrintSheet';
  sheet.innerHTML=items.map((t,idx)=>{
    const isSil=(t.metalType==='Silver')||String(t.product||'').toLowerCase().includes('silver');
    const purSpan=isSil?'':(' '+n(t.purity)+'%');
    return '<article class="rc-tag-print-item" data-tag="'+esc(t.tagCode||'')+'"><div class="rc-tag-print-head"><span class="rc-tag-brand">'+esc(goldleafContext?.shop_name||'GOLDLEAF')+'</span><span class="rc-tag-code-text">'+esc(t.tagCode||'')+'</span></div><div class="rc-tag-print-main"><div class="rc-tag-qr-box" id="rcPrintQr_'+idx+'">'+rcGenerateQrSvg(t.tagCode||'GL-TAG',66)+'</div><div class="rc-tag-details"><b class="rc-tag-name">'+esc(t.printName||t.product||'Jewellery')+'</b><div class="rc-tag-meta-line"><span>'+esc(t.metalType||'Gold')+purSpan+'</span>'+(t.size?'<span>Sz: '+esc(t.size)+'</span>':'')+'</div><div class="rc-tag-weight-line"><span>GW: '+fmt(t.grossWeight)+'g</span><span>NW: '+fmt(t.netWeight??t.grossWeight)+'g</span></div>'+(n(t.rate)>0?'<div class="rc-tag-price-line">₹'+rateMoney(t.rate)+'/g</div>':'')+(t.huid?'<div class="rc-tag-huid-line">HUID: '+esc(t.huid)+'</div>':'')+'</div></div></article>';
  }).join('');
  document.body.append(sheet);

  items.forEach((t,idx)=>{
    const el=document.getElementById('rcPrintQr_'+idx);
    if(el&&!el.querySelector('svg'))rcRenderTagQr(el,t.tagCode||'GL-TAG',66);
  });

  document.body.classList.add('goldleaf-tag-printing');
  const onAfterPrint=()=>{
    document.body.classList.remove('goldleaf-tag-printing');
    window.removeEventListener('afterprint',onAfterPrint);
  };
  window.addEventListener('afterprint',onAfterPrint,{once:true});
  setTimeout(()=>{window.print()},100);
};

window.rcPrintOneTag=function(id){const t=rcDocs('retail-tagging').find(z=>z.id===id);if(t)rcPrintTagBatch([t])};

window.rcSetTagRowCount=function(input){
  const target=Math.max(1,Math.min(500,Math.floor(n(input.value)||1))),current=document.querySelectorAll('#rcTagRows .rc-tag-row').length;
  if(target<current&&!confirm('Remove the last '+(current-target)+' unsaved tag row(s)?')){input.value=current;return}
  if(target<current){
    document.querySelectorAll('#rcTagRows .rc-tag-row').forEach((r,i)=>{if(i>=target)r.remove()});
    document.querySelectorAll('#rcTagRows .rc-tag-row>header b').forEach((b,i)=>b.textContent='Tag item '+(i+1));
  }else while(document.querySelectorAll('#rcTagRows .rc-tag-row').length<target)rcAddTagRow();
  input.value=target;
};

// Expand the product master to capture catalog identity and stock/sale defaults for tags.
function rcProductsView(){const list=rcDocs('retail-product'),x=list.find(p=>p.id===rcProductEdit);return '<section class="panel"><div class="rc-section-title"><div><h2>'+(x?'Edit retail product':'Retail product master')+'</h2><p class="muted">Catalog details and defaults flow into Product Tagging, sales and quotations.</p></div><span>'+list.length+' products</span></div><form class="rc-grid rc-master-form" onsubmit="rcSaveProduct(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Product code / SKU<input name="productCode" value="'+esc(x?.productCode||'')+'"></label><label>Product group *<input name="group" required value="'+esc(x?.group||'')+'" placeholder="Gold, Silver"></label><label>Category<input name="category" value="'+esc(x?.category||'')+'" placeholder="Ring, chain, bangle"></label><label>Product name *<input name="name" required maxlength="100" value="'+esc(x?.name||'')+'"></label><label>Print name<input name="printName" value="'+esc(x?.printName||'')+'"></label><label>Metal<select name="metalType">'+rcTagSelect([['Gold','Gold'],['Silver','Silver'],['Platinum','Platinum'],['Other','Other']],x?.metalType||'Gold')+'</select></label><label>Base unit<select name="unit">'+rcTagSelect([['piece','Piece'],['gram','Gram'],['pair','Pair'],['set','Set']],x?.unit||'piece')+'</select></label><label>Purity · %<input name="purity" type="number" min="1" max="100" step=".01" value="'+(x?.purity||92)+'"></label><label>HSN / SAC<input name="hsn" value="'+esc(x?.hsn||'')+'"></label><label>Product size<input name="size" value="'+esc(x?.size||'')+'"></label><label>HUID default<input name="huid" value="'+esc(x?.huid||'')+'"></label><label>Wastage type<select name="wastageMode">'+rcTagSelect([['percent','Percentage (%)'],['grams','Weight (g)']],x?.wastageMode||'percent')+'</select></label><label>Wastage value<input name="wastage" type="number" min="0" step=".001" value="'+(x?.wastage||0)+'"></label><label>Making charge type<select name="makingMode">'+rcTagSelect([['fixed','Fixed amount'],['piece','Per piece'],['gram','Per gram'],['percent','Percentage'],['percent-gram','% per gram']],x?.makingMode||'piece')+'</select></label><label>Making charge value<input name="makingRate" type="number" min="0" step=".01" value="'+(x?.makingRate||0)+'"></label><label>Stone type<select name="stoneType">'+rcTagSelect([['none','None'],['diamond','Diamond'],['stone','Stone'],['other','Other']],x?.stoneType||'none')+'</select></label><label>Stone / diamond pieces<input name="stonePieces" type="number" min="0" step="1" value="'+(x?.stonePieces||0)+'"></label><label>Stone / diamond carat<input name="stoneCarat" type="number" min="0" step=".001" value="'+(x?.stoneCarat||0)+'"></label><label>Diamond certificate / CC · ₹<input name="stoneCharge" type="number" min="0" step=".01" value="'+(x?.stoneCharge||0)+'"></label><label>Default ornament purity<input name="ornamentPurity" type="number" min="0" max="100" step=".01" value="'+(x?.ornamentPurity||'')+'"></label><label>Opening stock · pcs<input name="openingPieces" type="number" min="0" step="1" value="'+(x?.openingPieces||0)+'"></label><label>Opening gross · g<input name="openingGross" type="number" min="0" step=".001" value="'+(x?.openingGross||0)+'"></label><label>Opening net · g<input name="openingNet" type="number" min="0" step=".001" value="'+(x?.openingNet||0)+'"></label><label class="rc-check"><input name="isEcommerce" type="checkbox" '+(x?.isEcommerce?'checked':'')+'> Available for e-commerce</label><label class="rc-wide">Description / remarks<input name="description" value="'+esc(x?.description||'')+'"></label><div class="rc-actions rc-wide"><button class="primary">'+(x?'Update product':'Add product')+'</button><button type="button" onclick="rcProductEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Products · '+list.length+'</h2>'+(list.length?table(['Code','Group','Category','Product','Metal','Unit','Purity','Wastage','MC type','Making','Stock pcs','Stock gross g','Stock net g','HUID','Stone','HSN',''],list.map(p=>[esc(p.productCode||'—'),esc(p.group||'—'),esc(p.category||'—'),esc(p.name),esc(p.metalType||'Gold'),esc(p.unit||'piece'),n(p.purity)+'%',(p.wastageMode==='grams'?'g':'%')+' '+n(p.wastage),esc(p.makingMode||'piece'),rateMoney(p.makingRate),n(p.openingPieces),fmt(p.openingGross),fmt(p.openingNet),esc(p.huid||'—'),esc(p.stoneType||'none'),esc(p.hsn||'—'),'<button type="button" onclick="rcEditProduct(\''+esc(p.id)+'\')">Edit</button>'])):'<p class="muted">Add the first retail product above.</p>')+'</section>'}
window.rcSaveProduct=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),name=String(d.name||'').trim(),purity=n(d.purity);if(!name||!d.group||purity<1||purity>100)return say('Enter a product group, product name and purity from 1 to 100%.');if(d.productCode&&rcDocs('retail-product').some(p=>p.id!==d.id&&String(p.productCode||'').toLowerCase()===d.productCode.trim().toLowerCase()))return say('That product code already exists.');if(d.id&&!confirm('Save changes to this product?'))return;const old=rcDocs('retail-product').find(p=>p.id===d.id),p={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-product',accountType:'customer',productCode:String(d.productCode||'').trim(),group:String(d.group||'').trim(),category:String(d.category||'').trim(),name,printName:String(d.printName||'').trim(),metalType:d.metalType||'Gold',unit:d.unit||'piece',purity,wastage:n(d.wastage),wastageMode:d.wastageMode==='grams'?'grams':'percent',makingRate:n(d.makingRate),makingMode:d.makingMode||'piece',hsn:String(d.hsn||'').trim(),size:String(d.size||'').trim(),huid:String(d.huid||'').trim(),stoneType:d.stoneType||'none',stonePieces:n(d.stonePieces),stoneCarat:n(d.stoneCarat),stoneCharge:n(d.stoneCharge),ornamentPurity:n(d.ornamentPurity),openingPieces:n(d.openingPieces),openingGross:n(d.openingGross),openingNet:n(d.openingNet),isEcommerce:f.elements.isEcommerce.checked,description:String(d.description||'').trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()},i=db.retailDocuments.findIndex(z=>z.id===p.id);if(i<0)db.retailDocuments.push(p);else db.retailDocuments[i]=p;rcProductEdit='';const pending=save();render();rcSaveStatus(pending,'Retail product')};
window.rcEditTag=id=>{rcTagEdit=id;render()};window.rcSaveTag=function(e,printAfter=false){e.preventDefault();const f=e.target.closest('form'),d=Object.fromEntries(new FormData(f)),code=String(d.tagCode||'').trim(),product=String(d.product||'').trim(),purity=n(d.purity),gross=n(d.grossWeight),net=n(d.netWeight||Math.max(0,gross-n(d.lessWeight)));if(!code||!product||gross<=0||net<0||purity<1||purity>100)return say('Enter tag, product, positive gross weight, net weight and purity from 1 to 100%.');if(rcDocs('retail-tagging').some(t=>t.id!==d.id&&String(t.tagCode).toLowerCase()===code.toLowerCase()))return say('That tag / barcode already exists.');if(d.id&&!confirm('Save changes to this tag?'))return;const old=rcDocs('retail-tagging').find(t=>t.id===d.id),tag={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-tagging',accountType:'customer',tagCode:code,tagDate:d.tagDate,entryMode:d.entryMode==='item'?'item':'gram',lotEntry:String(d.lotEntry||'').trim(),group:String(d.group||'').trim(),product,printName:String(d.printName||'').trim(),pieces:n(d.pieces)||1,grossWeight:gross,netWeight:net,lessWeight:n(d.lessWeight),purity,wastage:n(d.wastage),wastageMode:d.wastageMode==='grams'?'grams':'percent',makingMode:['fixed','piece','gram','percent'].includes(d.makingMode)?d.makingMode:'fixed',makingRate:n(d.makingRate),rate:n(d.rate),huid:String(d.huid||'').trim(),ornamentPurity:n(d.ornamentPurity),size:String(d.size||'').trim(),stoneType:d.stoneType||'none',stonePieces:n(d.stonePieces),stoneCarat:n(d.stoneCarat),stoneCharge:n(d.stoneCharge),reference1:String(d.reference1||'').trim(),reference2:String(d.reference2||'').trim(),status:d.status||'In stock',location:String(d.location||'').trim(),remarks:String(d.remarks||'').trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const i=db.retailDocuments.findIndex(t=>t.id===tag.id);if(i<0)db.retailDocuments.push(tag);else db.retailDocuments[i]=tag;rcTagEdit='';const cloudSave=save();render();rcSaveStatus(cloudSave,'Retail tag');if(printAfter)rcPrintTagBatch([tag]);};
const RC_SCHEMES=['Digi Gold','Digi Silver','Fixed','Flexi','One Time Investment','Fixed Interest','Custom'];
function rcChitNav(){return '<nav class="rc-subtabs" aria-label="Retail chit sections">'+['Group','Type','Mapping','Entry'].map(x=>'<button type="button" class="'+(x===rcChitTab?'active':'')+'" onclick="rcChitOpen(\''+x+'\')">'+x+'</button>').join('')+'</nav>'}
window.rcChitOpen=function(tab){if(!rbCanLeave())return;rcChitTab=tab;rcChitEdit='';render()};let rcChitEdit='';
function rcChitView(){
 const all=rcDocs('retail-chit-'+rcChitTab.toLowerCase()),x=all.find(z=>z.id===rcChitEdit),groups=rcDocs('retail-chit-group'),types=rcDocs('retail-chit-type'),maps=rcDocs('retail-chit-mapping'),entries=rcDocs('retail-chit-entry');
 const val=(key,fallback='')=>esc(x?.[key]??fallback),num=(key,fallback=0)=>x?.[key]??fallback,check=key=>x?.[key]?'checked':'';
 let form='';
 if(rcChitTab==='Group')form='<div class="rc-grid"><label>Group name *<input name="name" required value="'+val('name')+'"></label><label>Group code<input name="groupCode" value="'+val('groupCode')+'" placeholder="Auto or enter code"></label><label>Start date<input name="startDate" type="date" value="'+val('startDate')+'"></label><label>End date<input name="endDate" type="date" value="'+val('endDate')+'"></label><label>Member limit<input name="memberLimit" type="number" min="1" step="1" value="'+num('memberLimit','')+'"></label><label>Status<select name="status">'+rbOptions(['Active','Closed','Upcoming'],x?.status||'Active')+'</select></label><label class="rc-wide">Notes<input name="notes" value="'+val('notes')+'"></label></div>';
 if(rcChitTab==='Type')form='<div class="rc-grid"><label>Scheme *<select name="scheme" required>'+rbOptions(RC_SCHEMES,x?.scheme||'Fixed')+'</select></label><label>Chit type name *<input name="name" required value="'+val('name')+'" placeholder="e.g. Monthly Gold 11+1"></label><label>Frequency *<select name="frequency">'+rbOptions(['Daily','Weekly','Monthly','Flexible'],x?.frequency||'Monthly')+'</select></label><label>Duration / instalments<input name="installments" type="number" min="1" step="1" value="'+num('installments',11)+'"></label><label>Plan duration (days)<input name="durationDays" type="number" min="1" value="'+num('durationDays',330)+'"></label><label>Mode *<select name="mode">'+rbOptions(['Cash','Metal','Cash / Metal','Digital Gold','Digital Silver'],x?.mode||(x?.scheme==='Digi Gold'?'Digital Gold':x?.scheme==='Digi Silver'?'Digital Silver':'Cash / Metal'))+'</select></label><label>Fixed instalment ₹<input name="installmentAmount" type="number" min="0" step=".01" value="'+num('installmentAmount')+'"></label><label>Flexi minimum ₹<input name="minAmount" type="number" min="0" step=".01" value="'+num('minAmount')+'"></label><label>Flexi maximum ₹<input name="maxAmount" type="number" min="0" step=".01" value="'+num('maxAmount')+'"></label><label>Bonus type<select name="bonusType">'+rbOptions(['None','Percentage','Fixed Amount','Gold Weight','Silver Weight'],x?.bonusType||'None')+'</select></label><label>Bonus value<input name="bonusValue" type="number" min="0" step=".001" value="'+num('bonusValue')+'"></label><label>Annual interest %<input name="interestRate" type="number" min="0" max="100" step=".01" value="'+num('interestRate')+'"></label><label>Limited dues<select name="limitedDueType">'+rbOptions(['Allow Multiple Due','One Due Only','Limited Due'],x?.limitedDueType||'Allow Multiple Due')+'</select></label><label>Maximum dues at once<input name="maxDueAtOnce" type="number" min="1" step="1" value="'+num('maxDueAtOnce',1)+'"></label><label>Payment condition<select name="paymentCondition">'+rbOptions(['Multi Payment','Single Payment','Any Amount'],x?.paymentCondition||'Multi Payment')+'</select></label><label>Maturity date mode<select name="maturityDateMode">'+rbOptions(['Fixed','From Start Date','After Last Instalment'],x?.maturityDateMode||'Fixed')+'</select></label><label>Cooling days<input name="coolingDays" type="number" min="0" step="1" value="'+num('coolingDays')+'"></label><label>Max plans per customer<input name="maxPerCustomer" type="number" min="0" step="1" value="'+num('maxPerCustomer',0)+'" placeholder="No limit"></label><label>Metal / ornament<select name="ornamentType">'+rbOptions(['Gold','Silver','Other'],x?.ornamentType||(x?.scheme==='Digi Silver'?'Silver':'Gold'))+'</select></label><label>Ledger name<input name="ledgerName" value="'+val('ledgerName')+'"></label><label>Gift item<input name="giftItem" value="'+val('giftItem')+'"></label><label>Bonus benefit %<input name="benefitPercent" type="number" min="0" max="100" step=".01" value="'+num('benefitPercent')+'"></label><label class="rc-check"><input name="allowPartial" type="checkbox" '+check('allowPartial')+'> Allow partial instalment</label><label class="rc-check"><input name="allowMultiple" type="checkbox" '+(x?.allowMultiple!==false?'checked':'')+'> Allow multiple due payments</label><label class="rc-check"><input name="allowChange" type="checkbox" '+check('allowChange')+'> Allow customer to change amount</label><label class="rc-check"><input name="alwaysPayment" type="checkbox" '+check('alwaysPayment')+'> Keep payment enabled</label><label class="rc-check"><input name="allowCustomer" type="checkbox" '+(x?.allowCustomer!==false?'checked':'')+'> Allow customer payments</label><label class="rc-check"><input name="incentiveApplicable" type="checkbox" '+check('incentiveApplicable')+'> Incentive applicable</label><label class="rc-check"><input name="disableCustomerPayment" type="checkbox" '+check('disableCustomerPayment')+'> Disable customer self-pay</label><label class="rc-check"><input name="proofRequired" type="checkbox" '+check('proofRequired')+'> Proof required at joining</label><label class="rc-check"><input name="aadhaarRequired" type="checkbox" '+check('aadhaarRequired')+'> Aadhaar required</label><label class="rc-check"><input name="panRequired" type="checkbox" '+check('panRequired')+'> PAN required</label></div>';
 if(rcChitTab==='Mapping')form='<div class="rc-grid"><label>Retail customer *<select name="customerId" required><option value="">Select customer</option>'+db.customers.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===x?.customerId?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label><label>Group<select name="groupId"><option value="">Select group</option>'+groups.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===x?.groupId?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label><label>Chit type *<select name="typeId" required><option value="">Select type</option>'+types.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===x?.typeId?'selected':'')+'>'+esc(t.name)+' · '+esc(t.scheme||'Fixed')+' · '+esc(t.frequency||'Monthly')+'</option>').join('')+'</select></label><label>Chit number *<input name="chitNumber" required value="'+val('chitNumber')+'"></label><label>Join date *<input name="startDate" type="date" required value="'+val('startDate',new Date().toISOString().slice(0,10))+'"></label><label>Maturity date<input name="maturityDate" type="date" value="'+val('maturityDate')+'"></label><label>Instalment ₹<input name="installmentAmount" type="number" min="0" step=".01" value="'+num('installmentAmount')+'"></label><label>Flexi target ₹<input name="targetAmount" type="number" min="0" step=".01" value="'+num('targetAmount')+'"></label><label>Total dues<input name="totalDues" type="number" min="1" step="1" value="'+num('totalDues',types.find(t=>t.id===x?.typeId)?.installments||11)+'"></label><label>Customer reference<input name="customerReference" value="'+val('customerReference')+'"></label><label>Status<select name="status">'+rbOptions(['Active','Matured','Closed','Suspended'],x?.status||'Active')+'</select></label><label class="rc-wide">Notes<input name="notes" value="'+val('notes')+'"></label></div>';
 let entryForm='';
 if(rcChitTab==='Entry')entryForm='<form class="rc-grid" onsubmit="rcSaveChitEntry(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Customer *<select name="customerId" required onchange="rcEntryCustomer(this.value)"><option value="">Select customer</option>'+db.customers.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===x?.customerId?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label><label>Chit mapping *<select id="rcEntryMapping" name="mappingId" required onchange="rcEntryPlan(this.value)"><option value="">Select chit</option>'+maps.map(m=>'<option value="'+esc(m.id)+'" data-customer="'+esc(m.customerId)+'" '+(m.id===x?.mappingId?'selected':'')+'>'+esc(m.chitNumber)+' · '+esc(accountName(m.customerId,'customer'))+'</option>').join('')+'</select></label><label>Entry type<select name="entryType">'+rbOptions(['Instalment','Advance','Bonus','Refund','Closure'], x?.entryType||'Instalment')+'</select></label><label>Date *<input name="when" type="date" required value="'+esc(x?.when||new Date().toISOString().slice(0,10))+'"></label><label>Due / instalment no. *<input name="installmentNo" type="number" min="1" step="1" required value="'+(x?.installmentNo||1)+'"></label><label>Amount paid ₹ *<input name="amount" type="number" min=".01" step=".01" required value="'+(x?.amount||'')+'"></label><label>Gold / silver weight g<input name="metalWeight" type="number" min="0" step=".001" value="'+(x?.metalWeight||0)+'"></label><label>Manual testing purity %<input name="testingPurity" type="number" min="0" max="100" step=".01" value="'+(x?.testingPurity??'')+'" placeholder="Optional"></label><label>Payment method<select name="method">'+rbOptions(RB_METHODS,x?.method||'Cash')+'</select></label><label>Reference / receipt no.<input name="reference" value="'+val('reference')+'"></label><label class="rc-wide">Remarks<input name="remarks" value="'+val('remarks')+'"></label><div class="rc-wide rc-totals"><span>Plan instalment <b id="rcPlanAmount">—</b></span><span>Received to date <b id="rcPaidToDate">—</b></span><span>Remaining plan balance <b id="rcRemaining">—</b></span></div><button class="primary">'+(x?'Save entry changes':'Save chit entry')+'</button></form>';
 const headers=rcChitTab==='Group'?['Group','Code','Period','Members','Status','']:rcChitTab==='Type'?['Type','Scheme','Frequency','Mode','Instalment','Dues','Benefit','']:rcChitTab==='Mapping'?['Chit no.','Customer','Group','Type','Target / instalment','Paid / due','Start','Status','']:['Date','Customer','Chit','Entry','Due no.','Amount ₹','Metal g','Method','Reference','Receipt'];
 const actions=id=>'<button type="button" onclick="rcEditChit(\''+esc(id)+'\')">Edit</button>';
 const rows=all.filter(r=>rcChitTab!=='Entry').map(r=>rcChitTab==='Group'?[esc(r.name),esc(r.groupCode||'—'),esc([r.startDate,r.endDate].filter(Boolean).join(' – ')||'—'),esc(r.memberLimit||'—'),esc(r.status||'Active'),actions(r.id)]:rcChitTab==='Type'?[esc(r.name),esc(r.scheme||'Fixed'),esc(r.frequency),esc(r.mode||'Cash / Metal'),rateMoney(r.installmentAmount),esc(r.installments||'—'),esc((r.bonusType&&r.bonusType!=='None'?r.bonusType+' ':'')+(r.benefitPercent||r.bonusValue||0)+'%'),actions(r.id)]:(()=>{let t=types.find(z=>z.id===r.typeId),paid=entries.filter(p=>p.mappingId===r.id&&p.entryType!=='Refund').reduce((s,p)=>s+n(p.amount),0)-entries.filter(p=>p.mappingId===r.id&&p.entryType==='Refund').reduce((s,p)=>s+n(p.amount),0);return [esc(r.chitNumber),esc(accountName(r.customerId,'customer')),esc(groups.find(g=>g.id===r.groupId)?.name||'—'),esc(t?.name||'—'),rateMoney(r.targetAmount||r.installmentAmount),rateMoney(paid)+' / '+rateMoney(Math.max(0,n(r.targetAmount||r.installmentAmount)*n(r.totalDues||t?.installments||0)-paid)),esc(r.startDate||'—'),esc(r.status),actions(r.id)]})());
 const entryRows=entries.sort((a,b)=>String(b.when).localeCompare(String(a.when))).map(p=>{let m=maps.find(z=>z.id===p.mappingId);return [esc(p.when),esc(accountName(p.customerId,'customer')),esc(m?.chitNumber||'—'),esc(p.entryType||'Instalment'),p.installmentNo,rateMoney(p.amount),fmt(p.metalWeight||0),esc(p.method||'—'),esc(p.reference||'—'),'<button type="button" onclick="rcEditChit(\''+esc(p.id)+'\')">Edit</button> <button type="button" onclick="rcPrintChit(\''+esc(p.id)+'\')">Receipt</button>']});
 const body=rcChitTab==='Entry'?entryForm:'<form class="rc-form rc-chit-definition-form rc-chit-'+rcChitTab.toLowerCase()+'-form" onsubmit="rcSaveChitDefinition(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'">'+form+'<button class="primary">'+(x?'Save changes':'Save '+rcChitTab.toLowerCase())+'</button></form>';
 const list=rcChitTab==='Entry'?(entryRows.length?table(headers,entryRows):'<p class="muted">No chit entries recorded yet.</p>'):(rows.length?table(headers,rows):'<p class="muted">No '+rcChitTab.toLowerCase()+' entries yet.</p>');
 const dashboard='<section class="panel rc-chit-overview"><h2>Chit overview</h2><div class="rc-totals"><span>Active plans <b>'+maps.filter(m=>(m.status||'Active')==='Active').length+'</b></span><span>Customers enrolled <b>'+new Set(maps.map(m=>m.customerId)).size+'</b></span><span>Entries received <b>'+entries.length+'</b></span><span>Total collected <b>'+rateMoney(entries.reduce((s,p)=>s+(p.entryType==='Refund'?-1:1)*n(p.amount),0))+'</b></span></div></section>';
 return dashboard+'<section class="panel"><h2>Retail Chit</h2><p class="muted">Create groups and scheme types, enrol customers, collect dues, track progress and print receipts.</p>'+rcChitNav()+'</section><section class="panel"><h2>'+ (rcChitTab==='Entry'?'Record chit payment or adjustment':(x?'Edit ':'Create ')+'chit '+rcChitTab.toLowerCase())+'</h2>'+body+'</section><section class="panel"><h2>'+(rcChitTab==='Entry'?'Chit entry history':rcChitTab+' list')+'</h2>'+list+'</section>'
}
window.rcEditChit=id=>{rcChitEdit=id;render()};
window.rcSaveChitDefinition=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),old=rcDocs('retail-chit-'+rcChitTab.toLowerCase()).find(x=>x.id===d.id);if(d.id&&!confirm('Save changes to this chit '+rcChitTab.toLowerCase()+'?'))return;const checkbox=['allowPartial','allowMultiple','allowChange','alwaysPayment','allowCustomer','incentiveApplicable','disableCustomerPayment','proofRequired','aadhaarRequired','panRequired'];checkbox.forEach(k=>d[k]=f.elements[k]?.checked||false);const numeric=['installmentAmount','installments','benefitPercent','durationDays','minAmount','maxAmount','bonusValue','interestRate','maxDueAtOnce','coolingDays','maxPerCustomer','memberLimit','targetAmount','totalDues'];numeric.forEach(k=>{if(k in d)d[k]=n(d[k])});const row=Object.assign({},old||{},{...d,id:d.id||crypto.randomUUID(),kind:'retail-chit-'+rcChitTab.toLowerCase(),accountType:'customer',name:String(d.name||'').trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});if(rcChitTab==='Mapping'){row.customerId=String(d.customerId||'');row.typeId=String(d.typeId||'');const type=rcDocs('retail-chit-type').find(t=>t.id===row.typeId);if(!row.customerId||!type)return say('Select a customer and a chit type.');const sameType=rcDocs('retail-chit-mapping').filter(m=>m.id!==row.id&&m.customerId===row.customerId&&m.typeId===row.typeId&&(m.status||'Active')==='Active').length;if(n(type.maxPerCustomer)>0&&sameType>=n(type.maxPerCustomer))return say('This customer has reached the active plan limit for this chit type.');if(n(row.totalDues)<=0)row.totalDues=n(type.installments);if(n(row.installmentAmount)<=0)row.installmentAmount=n(type.installmentAmount);if(rcDocs('retail-chit-mapping').some(m=>m.id!==row.id&&String(m.chitNumber).toLowerCase()===String(row.chitNumber).toLowerCase()))return say('That chit number already exists.')}if(rcChitTab==='Type'&&row.scheme==='Flexi'&&n(row.maxAmount)>0&&n(row.minAmount)>n(row.maxAmount))return say('Flexi minimum cannot be greater than the maximum.');if(rcChitTab==='Group'&&row.endDate&&row.startDate&&row.endDate<row.startDate)return say('Group end date cannot be before the start date.');const i=db.retailDocuments.findIndex(x=>x.id===row.id);if(i<0)db.retailDocuments.push(row);else db.retailDocuments[i]=row;rcChitEdit='';const cloudSave=save();render();rcSaveStatus(cloudSave,'Retail chit '+rcChitTab.toLowerCase())};
window.rcEntryCustomer=function(id){const s=document.getElementById('rcEntryMapping');if(s)Array.from(s.options).forEach(o=>{o.hidden=!!(o.value&&id&&o.dataset.customer!==id);if(o.value&&id&&o.dataset.customer!==id&&o.selected)s.value=''});window.rcEntryPlan(s?.value||'')};
window.rcEntryPlan=function(id){const m=rcDocs('retail-chit-mapping').find(x=>x.id===id),t=rcDocs('retail-chit-type').find(x=>x.id===m?.typeId),paid=rcDocs('retail-chit-entry').filter(p=>p.mappingId===id).reduce((s,p)=>s+(p.entryType==='Refund'?-1:1)*n(p.amount),0),due=n(m?.targetAmount)>0?n(m.targetAmount):n(m?.installmentAmount||t?.installmentAmount)*n(m?.totalDues||t?.installments);const put=(key,text)=>{const el=document.getElementById(key);if(el)el.textContent=text};put('rcPlanAmount',rateMoney(m?.installmentAmount||t?.installmentAmount||0));put('rcPaidToDate',rateMoney(paid));put('rcRemaining',rateMoney(Math.max(0,due-paid)))};
window.rcSaveChitEntry=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),old=rcDocs('retail-chit-entry').find(x=>x.id===d.id),map=rcDocs('retail-chit-mapping').find(x=>x.id===d.mappingId),type=rcDocs('retail-chit-type').find(x=>x.id===map?.typeId);if(old&&!confirm('Save changes to this chit entry?'))return;if(!map||map.customerId!==d.customerId)return say('Select the customer assigned to this chit.');const row={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-chit-entry',accountType:'customer',customerId:d.customerId,mappingId:d.mappingId,when:d.when,entryType:d.entryType||'Instalment',installmentNo:n(d.installmentNo),amount:n(d.amount),metalWeight:n(d.metalWeight),testingPurity:d.testingPurity===''?null:n(d.testingPurity),method:d.method,reference:String(d.reference||'').trim(),remarks:String(d.remarks||'').trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(row.amount<=0||row.installmentNo<1)return say('Enter a positive amount and due number.');if(row.testingPurity!==null&&(row.testingPurity<0||row.testingPurity>100))return say('Testing purity must be between 0 and 100%.');if(row.metalWeight>0&&!['Metal','Cash / Metal','Digital Gold','Digital Silver'].includes(type?.mode||'Cash / Metal'))return say('This plan does not accept metal payments.');if(d.entryType==='Instalment'&&!type?.allowPartial&&n(map.installmentAmount||type?.installmentAmount)>0&&row.amount+0.005<n(map.installmentAmount||type.installmentAmount))return say('This plan requires the full instalment amount.');if(d.entryType==='Instalment'&&type?.limitedDueType==='One Due Only'&&rcDocs('retail-chit-entry').some(p=>p.id!==row.id&&p.mappingId===map.id&&p.installmentNo===row.installmentNo&&p.entryType==='Instalment'))return say('This due already has a payment recorded.');const i=db.retailDocuments.findIndex(p=>p.id===row.id);if(i<0)db.retailDocuments.push(row);else db.retailDocuments[i]=row;rcChitEdit='';const cloudSave=save();render();rcSaveStatus(cloudSave,'Chit entry')};
window.rcPrintChit=function(id){const p=rcDocs('retail-chit-entry').find(x=>x.id===id),m=rcDocs('retail-chit-mapping').find(x=>x.id===p?.mappingId);if(!p)return;pdfPrintModel({kind:'ledger',retail:true,title:'RETAIL CHIT RECEIPT',entityLabel:'Customer',entityName:accountName(p.customerId,'customer'),entityDetails:'Chit '+(m?.chitNumber||''),reference:'Installment '+p.installmentNo,date:pdfDateText(p.when),heads:['Payment method','Reference','Amount'],rows:[[p.method,p.reference||'—',rateMoney(p.amount)]],totals:[['Amount received',rateMoney(p.amount),true]]},'retail')};
function rcBody(){rbSection=rcSection;return salesView().replace(/<header class="rb-header">[\s\S]*?<\/header>/,'').replace(/<label class="rb-mobile-section">[\s\S]*?<\/label>/,'').replace(/<nav class="rb-tabs"[\s\S]*?<\/nav>/,'')}
function rcRetailScreen(){const labels=RC_SECTIONS.map(x=>'<option '+(x===rcSection?'selected':'')+'>'+x+'</option>').join('');return '<div class="rc-screen rb-screen"><header class="rb-header"><div><div class="eyebrow">GOLDLEAF · RETAIL</div><h1>'+esc(rcSection==='Bill'?'Sales entry':rcSection)+'</h1></div><div class="rb-tools"><button type="button" onclick="if(rbCanLeave())go(\'Dashboard\')">Home</button><button type="button" onclick="if(rbCanLeave())go(\'Rate Book\')">Rates</button><button type="button" class="theme-toggle" onclick="toggleTheme()">'+(appTheme==='dark'?'☀':'☾')+'</button></div></header><label class="rc-mobile-select">Retail workspace<select aria-label="Retail workspace" onchange="rcOpen(this.value)">'+labels+'</select></label><nav class="rc-tabs" aria-label="Retail workspace sections">'+RC_SECTIONS.map(x=>'<button type="button" class="'+(x===rcSection?'active':'')+'" onclick="rcOpen(\''+x+'\')">'+esc(x)+'</button>').join('')+'</nav><main class="rc-content">'+rcBody()+'</main></div>'}
function rcStandaloneScreen(section){return '<div class="rc-screen rb-screen rc-standalone"><header class="rb-header"><div><div class="eyebrow">GOLDLEAF · RETAIL</div><h1>'+esc(section)+'</h1></div><div class="rb-tools"><button type="button" onclick="if(rbCanLeave())go(\'Dashboard\')">Home</button><button type="button" onclick="if(rbCanLeave())go(\'Rate Book\')">Rates</button><button type="button" class="theme-toggle" onclick="toggleTheme()">'+(appTheme==='dark'?'☀':'☾')+'</button></div></header><main class="rc-content">'+(section==='Estimation / Quotation'?rcQuoteForm():section==='Products'?rcProductsView():section==='Tagging'?rcTaggingView():rcChitView())+'</main></div>'}
window.rcOpenStandalone=function(section){
  if(!['Products','Estimation / Quotation','Tagging','Chit'].includes(section)||!rbCanLeave())return;
  workspaceMode='retail';
  localStorage.setItem('goldleaf-workspace-mode','retail');
  rcEstimateEdit='';rcProductEdit='';rcTagEdit='';rcChitEdit='';
  page=section;
  window.goldleafRememberView?.();
  render();
  window.scrollTo?.(0,0);
};

window.rcOpen=function(section){
  if(!session||!goldleafContext?.has_access){say('Please sign in first.');return;}
  if(!RC_SECTIONS.includes(section)||!rbCanLeave())return;rcSection=rbSection=section;localStorage.setItem('goldleaf-retail-section',section);rcEstimateEdit='';edit=null;page='Sales Entry';window.goldleafRememberView?.();render();window.scrollTo?.(0,0)};
const rcOldDirty=window.rbDirty;window.rbDirty=function(){return rcOldDirty()||!!document.querySelector('.rc-screen form[data-entry-dirty="1"]')};const rcOldCanLeave=window.rbCanLeave;window.rbCanLeave=function(){return !document.querySelector('.rc-screen form[data-entry-dirty="1"]')?rcOldCanLeave():confirm('Leave this entry and discard the unsaved changes?')};
document.addEventListener('input',e=>{if(e.target.closest?.('.rc-screen form'))e.target.closest('.rc-screen form').dataset.entryDirty='1';if(e.target.closest?.('#rcEstimateForm'))rcRecalc()});document.addEventListener('change',e=>{if(e.target.closest?.('.rc-screen form'))e.target.closest('.rc-screen form').dataset.entryDirty='1';if(e.target.closest?.('#rcEstimateForm'))rcRecalc()});
const RC_PAGES={'Products':'Products','Retail Products':'Products','Tagging':'Tagging','Retail Tagging':'Tagging','Estimation / Quotation':'Estimation / Quotation','Retail Estimation':'Estimation / Quotation','Chit':'Chit','Retail Chit':'Chit'};
function rcNavigation(){
  const nav=document.getElementById('nav');if(!nav)return;
  nav.querySelectorAll('[data-rc-sidebar],[data-rc-estimate-nav]').forEach(b=>b.remove());
  const more=document.getElementById('moreMenu');
  if(more)more.querySelectorAll('[data-rc-nav]').forEach(b=>b.remove());
  if(!session||!goldleafContext?.has_access)return;
  const anchor=nav.querySelector('button[aria-label*="Sales"]')||nav.querySelector('button:nth-child(2)')||nav.firstElementChild;
  const fragment=document.createDocumentFragment();
  for(const [label,icon] of [['Estimation / Quotation','tagging'],['Products','plans'],['Tagging','tagging'],['Chit','chit']]){
    const button=document.createElement('button');button.type='button';button.dataset.rcSidebar=label;
    button.setAttribute('aria-label',label);button.title=label;
    button.classList.toggle('active',page===label||page==='Retail '+label);
    if(page===label||page==='Retail '+label)button.setAttribute('aria-current','page');
    button.onclick=()=>rcOpenStandalone(label);
    button.innerHTML='<span class="nav-icon">'+erpIcon(icon)+'</span><span class="erp-nav-label">'+esc(label)+'</span>';
    fragment.append(button);
  }
  if(anchor)anchor.after(fragment);
  else nav.append(fragment);
  if(more){
    for(const label of ['Estimation / Quotation','Products','Tagging','Chit']){
      const button=document.createElement('button');button.type='button';button.dataset.rcNav=label;
      button.textContent=label;button.onclick=()=>{more.classList.remove('open');rcOpenStandalone(label)};more.append(button);
    }
  }
  erpFilterNavigation(erpNavQuery);
}
const rcPreviousRender=window.render;
window.render=function(){
  if(!session||!goldleafContext?.has_access){
    rcNavigation();
    return rcPreviousRender();
  }
  const active=page==='Sales Entry'&&workspaceMode==='retail';
  if(active)rcSection=RC_SECTIONS.includes(rbSection)?rbSection:'Bill';
  const result=rcPreviousRender(),section=RC_PAGES[page]||null;
  if(section){
    const appEl=document.getElementById('app');
    if(appEl) appEl.innerHTML=rcStandaloneScreen(section);
    document.body.classList.add('rb-active','rc-active');document.body.dataset.erpPage='Retail';
    if(section==='Estimation / Quotation')rcRecalc();
    if(section==='Chit'&&rcChitTab==='Entry')rcEntryPlan(document.getElementById('rcEntryMapping')?.value||'');
  }else if(active){
    const appEl=document.getElementById('app');
    if(appEl) appEl.innerHTML=rcRetailScreen();
    document.body.classList.add('rb-active','rc-active');document.body.dataset.erpPage='Retail';
  }else document.body.classList.remove('rc-active');
  rcNavigation();
  return result;
};
const rcStyle=document.createElement('link');rcStyle.rel='stylesheet';rcStyle.href='./retail-estimate-chit.css?v='+RC_VERSION;document.head.append(rcStyle);
const rcHistoryPrevious=window.updateHistoryView;window.updateHistoryView=function(){return rcHistoryPrevious().replace('Goldleaf v2.7.0','Goldleaf v'+RC_VERSION).replace('v2.7.0 · 7 Nov 2026 · Current','v2.7.0 · 7 Nov 2026').replace('<h2>Update history</h2><article class="release-note"><h3>v2.10.38 · Current</h3><ul><li>Added central Old Gold Types management to the Settings page with full view, edit, reset, delete and type creation controls.</li><li>Old Gold Exchange Details in Estimation & Quotation dynamically syncs with the central Old Gold Types settings.</li></ul></article>','<h2>Update history</h2><article class="release-note"><h3>v2.8.7 · 7 Nov 2026 · Current</h3><ul><li>Products and Chit are independent Retail sidebar pages below Sales and Purchase. Each page shows only its own workflow; returning to Sales restores sales content.</li></ul></article><article class="release-note"><h3>v2.8.5 · 7 Nov 2026</h3><ul><li>Added dedicated Retail Products, Tagging and Chit pages to the left navigation and kept them scrollable on mobile.</li></ul></article><article class="release-note"><h3>v2.8.4 · 7 Nov 2026</h3><ul><li>Added separate Retail toolbar pages for Estimation / Quotation, Tagging and Chit, with improved full-page scrolling.</li></ul></article><article class="release-note"><h3>v2.8.3 · 7 Nov 2026</h3><ul><li>Moved Retail Estimation / Quotation into the main navigation beside Rate Book for quicker access.</li></ul></article><article class="release-note"><h3>v2.8.2 · 7 Nov 2026</h3><ul><li>Rate-based Retail estimates now use saved purity-specific prices.</li></ul><article class="release-note"><h3>v2.8.1 · 7 Nov 2026</h3><ul><li>Retail Rate Entry now uses manually entered per-purity prices and a dated AM/PM history.</li><li>Retail sales and estimates use the saved purity-specific rates.</li></ul><article class="release-note"><h3>v2.8.0 · 7 Nov 2026</h3><ul><li>Retail now includes saved estimation and quotation, PDF printing, history and bill conversion.</li><li>Added Retail product master and item tagging with barcode, weights, purity, stock state and item details.</li><li>Added Retail chit groups, installment types, customer mappings, payment entry and printable receipts.</li><li>New Retail records sync in the shop cloud ledger and stay separate from Wholesale.</li></ul></article>')};
render();
const rcHistoryV2100=window.updateHistoryView;window.updateHistoryView=function(){let h=rcHistoryV2100().replace('Goldleaf v2.9.1','Goldleaf v'+RC_VERSION).replace('<h3>v2.10.0 · 8 Nov 2026 · Current</h3>','<h3>v2.10.0 · 8 Nov 2026</h3>');return h.replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.10.4 · 8 Nov 2026 · Current</h3><ul><li>Carry the shop reset token onto Retail document records so Product, Tagging and Chit writes pass the database reset guard.</li><li>Product, Tagging, Chit and quotation saves now show the actual cloud-write error when a save stays on the device.</li></ul></article><article class="release-note"><h3>v2.10.3 · 8 Nov 2026</h3><ul><li>Chit saves wait for cloud-sync completion before reporting success.</li><li>Cloud merge retains Retail documents across devices.</li></ul></article><article class="release-note"><h3>v2.10.2 · 8 Nov 2026</h3><ul><li>Cloud sync now merges Retail Chit, Products, Tagging and Estimation records.</li></ul></article><article class="release-note"><h3>v2.10.1 · 8 Nov 2026</h3><ul><li>Fixed Group, Type and Mapping forms being squeezed into a nested grid; compacted the Chit overview cards across desktop and mobile.</li><li>New Chit types no longer enforce a one-plan-per-customer limit unless a limit is entered.</li></ul></article><article class="release-note"><h3>v2.10.0 · 8 Nov 2026</h3><ul><li>Expanded Retail Chit with Digi Gold, Digi Silver, Fixed, Flexi, One Time Investment, Fixed Interest and Custom plans.</li><li>Added group and scheme rules, customer mapping, due tracking, manual metal testing, advance/bonus/refund/closure entries and printable receipts.</li></ul></article>')};







function rcSettingsOldGoldTypesPanel(){
  const types = rcGetAllOldGoldTypesForSettings();
  const rows = types.map((t) => {
    const isGold = t.metal !== 'Silver';
    const metalBadge = isGold 
      ? '<span class="rc-og-badge rc-og-badge-gold">🪙 Gold (24K)</span>' 
      : '<span class="rc-og-badge rc-og-badge-silver">🥈 Silver (Pure)</span>';
    const originBadge = t.isBuiltin
      ? (t.isCustomized ? '<span class="rc-og-badge rc-og-badge-builtin" title="Default type modified">Default (Modified)</span>' : '<span class="rc-og-badge rc-og-badge-builtin">Default</span>')
      : '<span class="rc-og-badge rc-og-badge-custom">Custom</span>';
    const rateSource = isGold ? 'Rate Book 24K Gold' : 'Rate Book Pure Silver';
    
    let actionButtons = '<button type="button" class="rc-og-table-btn rc-og-table-btn-edit" onclick="rcOpenOldGoldTypeModal(\'' + esc(t.name) + '\')">✎ Edit</button>';
    if(!t.isBuiltin){
      actionButtons += '<button type="button" class="rc-og-table-btn rc-og-table-btn-del" onclick="rcDeleteOldGoldTypeAction(\'' + esc(t.name) + '\')">✕ Delete</button>';
    } else if(t.isCustomized){
      actionButtons += '<button type="button" class="rc-og-table-btn rc-og-table-btn-reset" onclick="rcResetOldGoldTypeAction(\'' + esc(t.name) + '\')">↺ Reset</button>';
    }
    
    return '<tr>'
      + '<td><b class="rc-og-type-title">' + esc(t.name) + '</b></td>'
      + '<td>' + metalBadge + '</td>'
      + '<td><span class="rc-og-touch-val">' + Number(t.touch).toFixed(t.touch % 1 ? 2 : 1) + '%</span></td>'
      + '<td><span class="rc-og-rate-base">' + rateSource + '</span></td>'
      + '<td>' + originBadge + '</td>'
      + '<td><div class="rc-og-settings-actions">' + actionButtons + '</div></td>'
      + '</tr>';
  }).join('');

  return '<section class="panel rc-settings-og-panel">'
    + '<div class="rc-settings-og-head">'
    + '<div>'
    + '<h2>🪙 Old Gold Types</h2>'
    + '<p class="hint">Manage Old Gold Exchange types, metal category (Gold 24K pure rate / Silver pure rate), and default touch purity (%) used across Estimation & Quotation.</p>'
    + '</div>'
    + '<button type="button" class="rc-settings-add-btn" onclick="rcOpenOldGoldTypeModal(\'\')">＋ Add Old Gold Type</button>'
    + '</div>'
    + '<div class="rc-og-settings-table-wrap">'
    + '<table class="rc-og-settings-table">'
    + '<thead>'
    + '<tr>'
    + '<th>Type Name</th>'
    + '<th>Metal Category</th>'
    + '<th>Default Touch (%)</th>'
    + '<th>Pure Rate Source</th>'
    + '<th>Type Origin</th>'
    + '<th style="text-align:right">Actions</th>'
    + '</tr>'
    + '</thead>'
    + '<tbody>'
    + (rows || '<tr><td colspan="6" style="text-align:center;padding:16px;color:#94a3b8">No types configured</td></tr>')
    + '</tbody>'
    + '</table>'
    + '</div>'
    + '</section>';
}

const rcSettingsPrevious = window.settingsView;
window.settingsView = function(){
  let html = rcSettingsPrevious ? rcSettingsPrevious() : '';
  const ogPanel = rcSettingsOldGoldTypesPanel();
  if(html.includes('<section class="panel"><h2>Backup & setup</h2>')){
    html = html.replace('<section class="panel"><h2>Backup & setup</h2>', ogPanel + '<section class="panel"><h2>Backup & setup</h2>');
  } else {
    html += ogPanel;
  }
  return html;
};
