// Retail-only Order Tracking, CRM (8 modules), Customer Registration + 360 View, and Supplier Registration + View.
(function(){
  const RCO_STATES = ['TAMIL NADU','KERALA','KARNATAKA','ANDHRA PRADESH','TELANGANA','PUDUCHERRY','MAHARASHTRA','DELHI','GUJARAT','OTHER'];
  const RCO_ORNS = ['Gold','Silver','Diamond','Alloy','Stone','Platinum','Gift Item'];
  const RCO_LEAD_STATUS = ['Under Review','Open','In Follow-up','Converted','Lost'];
  const RCO_LEAD_SOURCES = ['Walk-in','YouTube','Instagram','Email','Referral','Web','Phone','Chat','Blogs','Display Ads','Events','Webinar','Visitor','Estimation','Other'];
  const RCO_DISPLAY_GROUPS = {
    'Document Details': [['estimate','Estimate']],
    'Item Details': [['tagging','Tagging'],['productGroup','Product Group'],['model','Model'],['stoneWt','Stone Weight'],['wst','Wst'],['stoneAmt','Stone Amount']],
    'Diamond': [['diaPcs','Diamond Pcs'],['diaCarat','Diamond Carat'],['diaRate','Diamond Rate'],['diaAmt','Diamond Amt'],['diaCert','Diamond Certificate Charges']],
    'Quantity & Weight': [['less','Less'],['netWt','Net Weight'],['chitWt','Chit Wt']],
    'Charges': [['mc','MC']],
    'Old Jewel': [['oldJewel','Old Jewel Purchase']],
    'Amounts': [['goldRate','Gold Rate'],['silverRate','Silver Rate']],
    'Chit': [['chit','Chit']],
    'Dates & Status': [['deliveryDate','Delivery Date'],['orderRef','Order Tracking Reference']],
    'Other': [['huid','HUID'],['skin','Skin'],['size','Length/Size'],['salesReturn','Sales Return'],['salesPerson','Sales Person']]
  };

  let rcoOrderTab = 'All', rcoOrderFilterOpen = false, rcoOrderDetailMode = false, rcoOrderEditId = '', rcoOrderViewId = '', rcoOrderViewTab = 'Details';
  let rcoExpandedOrders = new Set();
  let rcoOrderDisplay = JSON.parse(localStorage.getItem('goldleaf-order-display') || '{"oldJewel":true,"chit":true,"huid":true,"deliveryDate":true,"mc":true,"wst":true,"netWt":true}');
  let rcoOrderFilter = { q:'', dateBy:'orderDate', from:'', to:'', supplierId:'', ornament:'All', product:'', salesPerson:'' };

  let rcoCrmTab = 'Leads', rcoCrmEditId = '', rcoCrmFilterOpen = false, rcoCrmSearch = '', rcoCallTypeFilter = 'All';
  let rcoCalMonth = new Date().toISOString().slice(0,7);

  let rcoCustViewId = '', rcoCustViewTab = 'Details', rcoCustEditId = '', rcoCustShowForm = false, rcoCustSearch = '', rcoCustFilterOpen = false;
  let rcoCustFilter = { city:'', team:'', group:'', gender:'', segment:'', dnd:'', verified:'' };

  let rcoSupViewId = '', rcoSupViewTab = 'Details', rcoSupEditId = '', rcoSupShowForm = false, rcoSupSearch = '', rcoSupFilterOpen = false;
  let rcoSupFilter = { ornament:'', businessType:'', city:'' };

  const docs = (type) => (window.rcDocs ? window.rcDocs(type) : (db.retailDocuments||[]).filter(d=>d.type===type));
  const saveDoc = (type, doc) => {
    if(window.rcSaveDoc) return window.rcSaveDoc(type, doc);
    if(!Array.isArray(db.retailDocuments)) db.retailDocuments=[];
    const now = new Date().toISOString();
    const row = Object.assign({ id: doc.id || crypto.randomUUID(), type, createdAt: doc.createdAt || now, updatedAt: now }, doc);
    const idx = db.retailDocuments.findIndex(x=>x.id===row.id);
    if(idx<0) db.retailDocuments.unshift(row); else db.retailDocuments[idx] = row;
    save(); pushCloud(); return row;
  };
  const delDoc = (type, id) => {
    if(window.rcDeleteDoc) return window.rcDeleteDoc(type, id);
    db.retailDocuments = (db.retailDocuments||[]).filter(x=>x.id!==id);
    save(); pushCloud();
  };
  const opts = (arr, cur, emptyLabel) => (emptyLabel!==undefined?'<option value="">'+esc(emptyLabel)+'</option>':'') + arr.map(v=>'<option value="'+esc(v)+'" '+(String(cur||'')===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('');
  const custOpts = (cur, empty='-- Select Customer --') => '<option value="">'+esc(empty)+'</option>' + (db.customers||[]).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===cur?'selected':'')+'>'+esc(c.name)+(c.phone?' · '+esc(c.phone):'')+'</option>').join('');
  const supOpts = (cur, empty='-- Select Supplier --') => '<option value="">'+esc(empty)+'</option>' + (db.retailSuppliers||[]).map(s=>'<option value="'+esc(s.id)+'" '+(s.id===cur?'selected':'')+'>'+esc(s.name)+'</option>').join('');
  const prodOpts = (cur) => '<option value="">-- Select Product --</option>' + docs('retail-product').map(p=>'<option value="'+esc(p.name)+'" '+(p.name===cur?'selected':'')+'>'+esc(p.name)+'</option>').join('');
  const todayStr = () => new Date().toISOString().slice(0,10);

  // ======================== 1. ORDER TRACKING ========================
  window.rcoOpenOrderForm = (id='') => { rcoOrderEditId = id; rcoOrderViewId = ''; rcoOrderShowFormFlag = true; render(); };
  let rcoOrderShowFormFlag = false;
  window.rcoCloseOrderForm = () => { rcoOrderShowFormFlag = false; rcoOrderEditId = ''; render(); };
  window.rcoToggleOrderExpand = (id) => { if(rcoExpandedOrders.has(id)) rcoExpandedOrders.delete(id); else rcoExpandedOrders.add(id); render(); };
  window.rcoSetOrderTab = (tab) => { rcoOrderTab = tab; render(); };
  window.rcoViewOrder = (id) => { rcoOrderViewId = id; rcoOrderViewTab = 'Details'; render(); };
  window.rcoCloseOrderView = () => { rcoOrderViewId = ''; render(); };

  window.rcoOpenDisplayCustomizer = () => {
    document.getElementById('rcoDisplayModal')?.remove();
    let html = '<div id="rcoDisplayModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:780px">'
      + '<div class="retail-modal-head"><div><h2>Customize Order Columns & Fields</h2><p>Select fields to show in Order Tracking creation</p></div><button type="button" onclick="document.getElementById(\'rcoDisplayModal\').remove()">Close</button></div>'
      + '<div class="rco-display-cols">';
    for(const [grp, items] of Object.entries(RCO_DISPLAY_GROUPS)){
      html += '<div class="rco-display-group"><h4>'+esc(grp)+'</h4>';
      for(const [k, lbl] of items){
        html += '<label><input type="checkbox" data-disp-key="'+esc(k)+'" '+(rcoOrderDisplay[k]?'checked':'')+'> <span>'+esc(lbl)+'</span></label>';
      }
      html += '</div>';
    }
    html += '</div><div class="retail-modal-actions"><button type="button" class="primary" onclick="rcoSaveDisplayCustomizer()">Apply Columns</button></div></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.rcoSaveDisplayCustomizer = () => {
    document.querySelectorAll('#rcoDisplayModal [data-disp-key]').forEach(cb => { rcoOrderDisplay[cb.dataset.dispKey] = cb.checked; });
    localStorage.setItem('goldleaf-order-display', JSON.stringify(rcoOrderDisplay));
    document.getElementById('rcoDisplayModal')?.remove();
    render();
  };

  window.rcoAddOrderRow = () => {
    const tb = document.getElementById('rcoOrderItemsBody'); if(!tb) return;
    tb.insertAdjacentHTML('beforeend', rcoOrderRowMarkup({}));
    rcoRecalcOrder();
  };
  window.rcoAddOrderReceiptRow = () => {
    const tb = document.getElementById('rcoOrderReceiptsBody'); if(!tb) return;
    tb.insertAdjacentHTML('beforeend', rcoOrderReceiptMarkup({}));
    rcoRecalcOrder();
  };
  window.rcoAddOrderOldJewelRow = () => {
    const tb = document.getElementById('rcoOrderOldBody'); if(!tb) return;
    tb.insertAdjacentHTML('beforeend', rcoOrderOldMarkup({}));
    rcoRecalcOrder();
  };
  window.rcoAddOrderChitRow = () => {
    const tb = document.getElementById('rcoOrderChitBody'); if(!tb) return;
    tb.insertAdjacentHTML('beforeend', rcoOrderChitMarkup({}));
    rcoRecalcOrder();
  };

  function rcoOrderRowMarkup(it){
    const d = rcoOrderDisplay;
    return '<tr class="rco-order-row">'
      + '<td><select name="item_product" onchange="rcoRecalcOrder()">'+prodOpts(it.product)+'</select>'
      + '<input name="item_product_text" placeholder="Or type product" value="'+esc(it.product||'')+'" style="margin-top:4px;font-size:11px" oninput="rcoRecalcOrder()"></td>'
      + (d.huid?'<td><input name="item_huid" value="'+esc(it.huid||'')+'" placeholder="HUID" style="width:76px"></td>':'')
      + (d.tagging?'<td><input name="item_tag" value="'+esc(it.tagCode||'')+'" placeholder="Tag" style="width:76px"></td>':'')
      + '<td><select name="item_ornament">'+opts(RCO_ORNS, it.ornament||'Gold')+'</select></td>'
      + '<td><input name="item_qty" type="number" min="1" step="1" value="'+(it.qty||1)+'" style="width:55px" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="item_gross" type="number" min="0" step=".001" value="'+(it.grossWt||0)+'" style="width:74px" oninput="rcoRecalcOrder()"></td>'
      + (d.less?'<td><input name="item_less" type="number" min="0" step=".001" value="'+(it.lessWt||0)+'" style="width:68px" oninput="rcoRecalcOrder()"></td>':'')
      + (d.stoneWt?'<td><input name="item_stoneWt" type="number" min="0" step=".001" value="'+(it.stoneWt||0)+'" style="width:68px" oninput="rcoRecalcOrder()"></td>':'')
      + (d.netWt?'<td><input name="item_net" type="number" step=".001" readonly value="'+(it.netWt||0)+'" style="width:74px;background:#f4f4f4"></td>':'')
      + '<td><input name="item_rate" type="number" min="0" step=".01" value="'+(it.rate||db.rates?.gold22||0)+'" style="width:82px" oninput="rcoRecalcOrder()"></td>'
      + (d.skin?'<td><input name="item_skin" value="'+esc(it.skin||'22K')+'" style="width:60px"></td>':'')
      + (d.wst?'<td><input name="item_wst" type="number" min="0" step=".01" value="'+(it.wst||0)+'" style="width:60px" oninput="rcoRecalcOrder()"></td>':'')
      + (d.mc?'<td><input name="item_mc" type="number" min="0" step=".01" value="'+(it.mc||0)+'" style="width:70px" oninput="rcoRecalcOrder()"></td>':'')
      + (d.stoneAmt?'<td><input name="item_stoneAmt" type="number" min="0" step=".01" value="'+(it.stoneAmt||0)+'" style="width:70px" oninput="rcoRecalcOrder()"></td>':'')
      + '<td><select name="item_supplier">'+supOpts(it.supplierId,'-- Supplier --')+'</select></td>'
      + '<td><select name="item_status">'+opts(['Open','In Progress','Ready','Closed','Cancel'], it.status||'Open')+'</select></td>'
      + '<td><input name="item_amt" type="number" step=".01" readonly value="'+(it.amount||0)+'" style="width:90px;font-weight:700;background:#f4f4f4"></td>'
      + '<td><input name="item_notes" value="'+esc(it.notes||'')+'" placeholder="Notes" style="width:100px"></td>'
      + '<td><button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove();rcoRecalcOrder()">×</button></td>'
      + '</tr>';
  }
  function rcoOrderReceiptMarkup(r){
    return '<tr class="rco-rcpt-row">'
      + '<td><select name="rcpt_type">'+opts(['Cash','Bank','Card','UPI'], r.type||'Cash')+'</select></td>'
      + '<td><input name="rcpt_bank" value="'+esc(r.bankCash||'')+'" placeholder="Account / Cash"></td>'
      + '<td><input name="rcpt_amt" type="number" min="0" step=".01" value="'+(r.amount||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="rcpt_card" value="'+esc(r.cardType||'')+'" placeholder="Visa / UPI ID"></td>'
      + '<td style="text-align:center"><input name="rcpt_adv" type="checkbox" '+(r.advance!==false?'checked':'')+'></td>'
      + '<td><input name="rcpt_ref" value="'+esc(r.ref||'')+'" placeholder="Ref #"></td>'
      + '<td><button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove();rcoRecalcOrder()">×</button></td>'
      + '</tr>';
  }
  function rcoOrderOldMarkup(o){
    return '<tr class="rco-old-row">'
      + '<td><input name="old_type" value="'+esc(o.product||'Old Gold')+'" placeholder="Product"></td>'
      + '<td><input name="old_wt" type="number" min="0" step=".001" value="'+(o.weight||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="old_less" type="number" min="0" step=".001" value="'+(o.less||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="old_touch" type="number" min="0" max="100" step=".01" value="'+(o.touch||91.6)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="old_rate" type="number" min="0" step=".01" value="'+(o.rate||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><input name="old_amt" type="number" min="0" step=".01" value="'+(o.amount||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove();rcoRecalcOrder()">×</button></td>'
      + '</tr>';
  }
  function rcoOrderChitMarkup(c){
    return '<tr class="rco-chit-row">'
      + '<td><input name="chit_ledger" value="'+esc(c.ledger||'Chit')+'" placeholder="Ledger"></td>'
      + '<td><input name="chit_no" value="'+esc(c.chitNo||'')+'" placeholder="Chit #"></td>'
      + '<td><input name="chit_amt" type="number" min="0" step=".01" value="'+(c.amount||0)+'" oninput="rcoRecalcOrder()"></td>'
      + '<td><button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove();rcoRecalcOrder()">×</button></td>'
      + '</tr>';
  }

  window.rcoRecalcOrder = () => {
    const f = document.getElementById('rcoOrderForm'); if(!f) return;
    let salesAmt = 0, totalQty = 0, totalGross = 0;
    f.querySelectorAll('.rco-order-row').forEach(tr => {
      const qty = Math.max(1, n(tr.querySelector('[name="item_qty"]')?.value));
      const gross = n(tr.querySelector('[name="item_gross"]')?.value);
      const less = n(tr.querySelector('[name="item_less"]')?.value);
      const stWt = n(tr.querySelector('[name="item_stoneWt"]')?.value);
      const net = Math.max(0, gross - less - stWt);
      const netEl = tr.querySelector('[name="item_net"]'); if(netEl) netEl.value = net.toFixed(3);
      const rate = n(tr.querySelector('[name="item_rate"]')?.value);
      const wst = n(tr.querySelector('[name="item_wst"]')?.value);
      const mc = n(tr.querySelector('[name="item_mc"]')?.value);
      const stAmt = n(tr.querySelector('[name="item_stoneAmt"]')?.value);
      const amt = Math.round((net * (1 + wst/100) * rate + mc + stAmt) * 100) / 100;
      const amtEl = tr.querySelector('[name="item_amt"]'); if(amtEl) amtEl.value = amt.toFixed(2);
      salesAmt += amt; totalQty += qty; totalGross += gross;
    });
    let oldAmt = 0;
    f.querySelectorAll('.rco-old-row').forEach(tr => { oldAmt += n(tr.querySelector('[name="old_amt"]')?.value); });
    let chitAmt = 0;
    f.querySelectorAll('.rco-chit-row').forEach(tr => { chitAmt += n(tr.querySelector('[name="chit_amt"]')?.value); });
    let rcptAmt = 0;
    f.querySelectorAll('.rco-rcpt-row').forEach(tr => { rcptAmt += n(tr.querySelector('[name="rcpt_amt"]')?.value); });

    const disc = n(f.discount?.value);
    const taxable = Math.max(0, salesAmt - disc);
    const gstOn = f.gstEnabled?.checked;
    const taxAmt = gstOn ? Math.round(taxable * 0.03 * 100) / 100 : 0;
    const totalAmt = Math.max(0, taxable + taxAmt - oldAmt - chitAmt);
    const roundVal = n(f.roundOff?.value);
    const roundType = f.roundType?.value || 'Add';
    const netAmt = Math.max(0, totalAmt + (roundType === 'Sub' ? -roundVal : roundVal));
    const balAmt = Math.round((netAmt - rcptAmt) * 100) / 100;

    const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    set('rcoTotQty', totalQty);
    set('rcoTotGross', totalGross.toFixed(3) + ' g');
    set('rcoTotSales', rateMoney(salesAmt));
    set('rcoTotTax', rateMoney(taxAmt));
    set('rcoTotOld', rateMoney(oldAmt));
    set('rcoTotChit', rateMoney(chitAmt));
    set('rcoTotNet', rateMoney(netAmt));
    set('rcoTotRcpt', rateMoney(rcptAmt));
    set('rcoTotBal', rateMoney(balAmt));
  };

  window.rcoSaveOrder = (e) => {
    e.preventDefault();
    const f = e.target;
    const customerId = f.customerId.value;
    if(!customerId) return say('Please select a Customer.');
    const items = [];
    f.querySelectorAll('.rco-order-row').forEach(tr => {
      const pSel = tr.querySelector('[name="item_product"]')?.value || '';
      const pTxt = tr.querySelector('[name="item_product_text"]')?.value?.trim() || '';
      const product = pTxt || pSel;
      if(!product) return;
      const grossWt = n(tr.querySelector('[name="item_gross"]')?.value);
      const lessWt = n(tr.querySelector('[name="item_less"]')?.value);
      const stoneWt = n(tr.querySelector('[name="item_stoneWt"]')?.value);
      items.push({
        product,
        huid: tr.querySelector('[name="item_huid"]')?.value || '',
        tagCode: tr.querySelector('[name="item_tag"]')?.value || '',
        ornament: tr.querySelector('[name="item_ornament"]')?.value || 'Gold',
        qty: Math.max(1, n(tr.querySelector('[name="item_qty"]')?.value)),
        grossWt, lessWt, stoneWt,
        netWt: Math.max(0, grossWt - lessWt - stoneWt),
        rate: n(tr.querySelector('[name="item_rate"]')?.value),
        skin: tr.querySelector('[name="item_skin"]')?.value || '22K',
        wst: n(tr.querySelector('[name="item_wst"]')?.value),
        mc: n(tr.querySelector('[name="item_mc"]')?.value),
        stoneAmt: n(tr.querySelector('[name="item_stoneAmt"]')?.value),
        supplierId: tr.querySelector('[name="item_supplier"]')?.value || '',
        status: tr.querySelector('[name="item_status"]')?.value || 'Open',
        amount: n(tr.querySelector('[name="item_amt"]')?.value),
        notes: tr.querySelector('[name="item_notes"]')?.value || ''
      });
    });
    if(!items.length) return say('Add at least one order item.');

    const receipts = [], oldJewels = [], chits = [];
    f.querySelectorAll('.rco-rcpt-row').forEach(tr => {
      const amt = n(tr.querySelector('[name="rcpt_amt"]')?.value);
      if(amt > 0) receipts.push({ type: tr.querySelector('[name="rcpt_type"]').value, bankCash: tr.querySelector('[name="rcpt_bank"]').value, amount: amt, cardType: tr.querySelector('[name="rcpt_card"]').value, advance: tr.querySelector('[name="rcpt_adv"]').checked, ref: tr.querySelector('[name="rcpt_ref"]').value });
    });
    f.querySelectorAll('.rco-old-row').forEach(tr => {
      const amt = n(tr.querySelector('[name="old_amt"]')?.value);
      if(amt > 0) oldJewels.push({ product: tr.querySelector('[name="old_type"]').value, weight: n(tr.querySelector('[name="old_wt"]').value), less: n(tr.querySelector('[name="old_less"]').value), touch: n(tr.querySelector('[name="old_touch"]').value), rate: n(tr.querySelector('[name="old_rate"]').value), amount: amt });
    });
    f.querySelectorAll('.rco-chit-row').forEach(tr => {
      const amt = n(tr.querySelector('[name="chit_amt"]')?.value);
      if(amt > 0) chits.push({ ledger: tr.querySelector('[name="chit_ledger"]').value, chitNo: tr.querySelector('[name="chit_no"]').value, amount: amt });
    });

    const salesAmt = items.reduce((s,x)=>s+x.amount, 0);
    const disc = n(f.discount.value);
    const taxable = Math.max(0, salesAmt - disc);
    const gstEnabled = !!f.gstEnabled?.checked;
    const taxAmt = gstEnabled ? Math.round(taxable * 0.03 * 100)/100 : 0;
    const oldAmt = oldJewels.reduce((s,x)=>s+x.amount, 0);
    const chitAmt = chits.reduce((s,x)=>s+x.amount, 0);
    const totalAmt = Math.max(0, taxable + taxAmt - oldAmt - chitAmt);
    const roundOff = n(f.roundOff.value), roundType = f.roundType.value;
    const netAmount = Math.max(0, totalAmt + (roundType==='Sub'?-roundOff:roundOff));
    const paidAmount = receipts.reduce((s,x)=>s+x.amount, 0);
    const advanceAmount = receipts.filter(x=>x.advance).reduce((s,x)=>s+x.amount, 0);

    const existing = rcoOrderEditId ? docs('retail-order').find(x=>x.id===rcoOrderEditId) : null;
    const history = Array.isArray(existing?.history) ? existing.history.slice() : [];
    history.unshift({ at: new Date().toISOString(), action: existing ? 'Updated Order' : 'Created Order', status: f.status.value, by: goldleafContext?.user_email || 'Staff' });

    saveDoc('retail-order', {
      id: existing?.id,
      orderNo: existing?.orderNo || ('ORD-' + Date.now().toString().slice(-6)),
      orderDate: f.orderDate.value,
      deliveryDate: f.deliveryDate.value,
      customerId,
      status: f.status.value,
      salesPerson: f.salesPerson.value,
      orderRef: f.orderRef.value,
      reference: f.reference.value,
      goldRate: n(f.goldRate.value),
      silverRate: n(f.silverRate.value),
      items, receipts, oldJewels, chits,
      discount: disc, gstEnabled, taxAmount: taxAmt, salesAmount: salesAmt,
      oldJewelAmount: oldAmt, chitAmount: chitAmt, totalAmount: totalAmt,
      roundType, roundOff, netAmount, paidAmount, advanceAmount,
      balanceAmount: Math.round((netAmount - paidAmount)*100)/100,
      history
    });
    rcoOrderShowFormFlag = false; rcoOrderEditId = '';
    say('Order saved successfully.');
    render();
  };

  window.rcoPrintOrderPdf = (id, copyType='Original') => {
    const o = docs('retail-order').find(x=>x.id===id);
    if(!o) return say('Order not found.');
    const cust = (db.customers||[]).find(c=>c.id===o.customerId) || {};
    const cgst = o.gstEnabled ? Math.round(o.taxAmount * 50) / 100 : 0;
    const sgst = o.gstEnabled ? Math.round((o.taxAmount - cgst)*100)/100 : 0;
    const totals = [
      ['Amount', rateMoney(o.salesAmount)],
      ...(o.discount>0 ? [['Discount', '− '+rateMoney(o.discount)]] : []),
      ...(o.gstEnabled ? [['CGST (1.5%)', rateMoney(cgst)], ['SGST (1.5%)', rateMoney(sgst)], ['Total Tax Amount', rateMoney(o.taxAmount)]] : []),
      ...(o.oldJewelAmount>0 ? [['Old Jewel Amount', '− '+rateMoney(o.oldJewelAmount)]] : []),
      ...(o.chitAmount>0 ? [['Chit Amount', '− '+rateMoney(o.chitAmount)]] : []),
      ['Total Amount', rateMoney(o.totalAmount)],
      ...(o.roundOff>0 ? [['Round Off ('+o.roundType+')', rateMoney(o.roundOff)]] : []),
      ['Net Amount', rateMoney(o.netAmount), true],
      ['Advance / Paid Cash', rateMoney(o.paidAmount)],
      ['Balance Amount', rateMoney(o.balanceAmount), true]
    ];
    const model = {
      kind: 'order',
      retail: true,
      title: 'ORDER SALES',
      copyType,
      entityLabel: 'Customer',
      entityName: cust.name || 'Customer',
      customerAddress: [cust.doorNo, cust.address, cust.city].filter(Boolean).join(', '),
      customerMobile: cust.phone || cust.mobile || '',
      customerState: cust.state || 'TAMIL NADU',
      reference: o.orderNo,
      date: o.orderDate,
      deliveryDate: o.deliveryDate,
      goldRate: o.goldRate,
      notes: o.reference || o.orderRef || '',
      netAmount: o.netAmount,
      invoiceItems: (o.items||[]).map(x=>({ product:x.product, huid:x.huid, pieces:x.qty, grossWeight:x.grossWt, rate:x.rate, makingTotal:x.mc, wastage:x.wst, subtotal:x.amount, notes:x.notes })),
      totals
    };
    pdfPrintModel(model, 'retail', 'classic');
  };

  window.rcoConvertOrderToBill = (id) => {
    const o = docs('retail-order').find(x=>x.id===id);
    if(!o) return;
    if(!confirm('Convert Order ' + o.orderNo + ' to Sales Bill and mark as Converted?')) return;
    o.convertedToBill = true;
    o.status = 'Closed';
    o.history = [{ at: new Date().toISOString(), action: 'Converted to Sales Bill', status: 'Closed', by: goldleafContext?.user_email||'Staff' }, ...(o.history||[])];
    saveDoc('retail-order', o);
    localStorage.setItem('goldleaf-pending-order-bill', JSON.stringify(o));
    say('Order marked as converted. Opening Retail Sales Entry...');
    if(window.rcOpen) rcOpen('Bill');
  };

  function rcoOrderTrackingView(){
    const all = docs('retail-order');
    if(rcoOrderViewId){
      const o = all.find(x=>x.id===rcoOrderViewId);
      if(!o){ rcoOrderViewId=''; }
      else {
        const cust = (db.customers||[]).find(c=>c.id===o.customerId) || {};
        return header('Order Details · ' + o.orderNo, '<button type="button" onclick="rcoOpenOrderForm(\''+esc(o.id)+'\')">Edit</button> '
          + '<select id="rcoCopyType" style="min-height:36px;border-radius:8px;padding:0 8px"><option>Original</option><option>Duplicate</option><option>Triplicate</option></select> '
          + '<button type="button" class="primary" onclick="rcoPrintOrderPdf(\''+esc(o.id)+'\',document.getElementById(\'rcoCopyType\').value)">🖨️ Print / PDF</button> '
          + '<button type="button" onclick="rcoConvertOrderToBill(\''+esc(o.id)+'\')">⚡ Convert Into Sale Bill</button> '
          + '<button type="button" onclick="rcoCloseOrderView()">← Back</button>')
          + '<div class="rco-tabs"><button type="button" class="'+(rcoOrderViewTab==='Details'?'active':'')+'" onclick="rcoOrderViewTab=\'Details\';render()">Order Details</button><button type="button" class="'+(rcoOrderViewTab==='History'?'active':'')+'" onclick="rcoOrderViewTab=\'History\';render()">History ('+(o.history?.length||0)+')</button></div>'
          + (rcoOrderViewTab==='History'
            ? '<section class="panel"><h2>Audit History</h2>'+table(['Date & Time','Action','Status','User'], (o.history||[]).map(h=>[esc(String(h.at).replace('T',' ').slice(0,19)), esc(h.action), '<span class="rco-badge rco-badge-open">'+esc(h.status)+'</span>', esc(h.by)]))+'</section>'
            : '<div class="rco-grid-2">'
              + '<section class="rco-section-card"><h3>Order Information</h3><p><b>Order No:</b> '+esc(o.orderNo)+'</p><p><b>Order Date:</b> '+esc(o.orderDate)+'</p><p><b>Delivery Date:</b> '+esc(o.deliveryDate||'—')+'</p><p><b>Customer:</b> '+esc(cust.name||'—')+' ('+esc(cust.phone||'')+')</p><p><b>Status:</b> <span class="rco-badge rco-badge-'+(o.status==='Cancel'?'cancel':o.status==='Closed'?'closed':'open')+'">'+esc(o.status)+'</span></p><p><b>Sales Person:</b> '+esc(o.salesPerson||'—')+'</p><p><b>Reference:</b> '+esc(o.reference||o.orderRef||'—')+'</p></section>'
              + '<section class="rco-section-card"><h3>Payment & Tax Summary</h3><p><b>Order Sales Amount:</b> '+rateMoney(o.salesAmount)+'</p><p><b>Discount:</b> '+rateMoney(o.discount)+'</p><p><b>Tax Amount (GST):</b> '+rateMoney(o.taxAmount)+'</p><p><b>Old Jewel / Chit Credit:</b> '+rateMoney(n(o.oldJewelAmount)+n(o.chitAmount))+'</p><p><b>Net Amount:</b> <b>'+rateMoney(o.netAmount)+'</b></p><p><b>Paid / Advance:</b> '+rateMoney(o.paidAmount)+'</p><p><b>Balance Amount:</b> <b style="color:#b45309">'+rateMoney(o.balanceAmount)+'</b></p></section>'
              + '</div>'
              + '<section class="panel"><h2>Order Items</h2>'+table(['Product','Ornament','Qty','Gross Wt','Net Wt','Rate','Wst %','MC ₹','Supplier','Status','Amount'], (o.items||[]).map(x=>[esc(x.product), esc(x.ornament), x.qty, fmt(x.grossWt)+' g', fmt(x.netWt)+' g', rateMoney(x.rate), x.wst+'%', rateMoney(x.mc), esc(((db.retailSuppliers||[]).find(s=>s.id===x.supplierId)||{}).name||'—'), esc(x.status), '<b>'+rateMoney(x.amount)+'</b>']))+'</section>'
              + '<section class="panel"><h2>Receipts</h2>'+((o.receipts||[]).length ? table(['Type','Bank/Cash','Amount','Card/Ref','Advance'], o.receipts.map(r=>[esc(r.type), esc(r.bankCash||'—'), rateMoney(r.amount), esc(r.cardType||r.ref||'—'), r.advance?'Yes':'No'])) : '<p class="muted">No receipts recorded.</p>')+'</section>'
            );
      }
    }

    if(rcoOrderShowFormFlag){
      const o = rcoOrderEditId ? all.find(x=>x.id===rcoOrderEditId) : null;
      const d = rcoOrderDisplay;
      const items = o?.items?.length ? o.items : [{}];
      const receipts = o?.receipts?.length ? o.receipts : [{}];
      const oldJ = o?.oldJewels?.length ? o.oldJewels : [];
      const chits = o?.chits?.length ? o.chits : [];
      return header(o ? 'Edit Order · '+o.orderNo : 'Create Order', '<button type="button" onclick="rcoOpenDisplayCustomizer()">⚙️ Display</button> <button type="button" onclick="rcoCloseOrderForm()">← Back</button>')
        + '<form id="rcoOrderForm" onsubmit="rcoSaveOrder(event)">'
        + '<section class="rco-section-card"><h3>Order Header</h3><div class="rco-grid">'
        + '<label class="rco-field"><span>Order Date *</span><input name="orderDate" type="date" required value="'+esc(o?.orderDate||todayStr())+'"></label>'
        + '<label class="rco-field"><span>Customer Name *</span><select name="customerId" required>'+custOpts(o?.customerId)+'</select></label>'
        + '<label class="rco-field"><span>Status *</span><select name="status" required>'+opts(['Open','Closed','Cancel'], o?.status||'Open')+'</select></label>'
        + '<label class="rco-field"><span>Delivery Date</span><input name="deliveryDate" type="date" value="'+esc(o?.deliveryDate||'')+'"></label>'
        + '<label class="rco-field"><span>Gold Rate ₹/g</span><input name="goldRate" type="number" step=".01" value="'+(o?.goldRate||db.rates?.gold22||0)+'"></label>'
        + '<label class="rco-field"><span>Silver Rate ₹/g</span><input name="silverRate" type="number" step=".01" value="'+(o?.silverRate||db.rates?.silver||0)+'"></label>'
        + '<label class="rco-field"><span>Sales Person</span><input name="salesPerson" value="'+esc(o?.salesPerson||'')+'" placeholder="Staff name"></label>'
        + '<label class="rco-field"><span>Order Tracking Ref</span><input name="orderRef" value="'+esc(o?.orderRef||'')+'" placeholder="Ref #"></label>'
        + '</div></section>'

        + '<section class="rco-section-card"><h3>Line Items <button type="button" onclick="rcoAddOrderRow()">＋ Add Row</button></h3>'
        + '<div class="table" style="overflow-x:auto"><table><thead><tr>'
        + '<th>Product</th>'+(d.huid?'<th>HUID</th>':'')+(d.tagging?'<th>Tag</th>':'')+'<th>Ornament</th><th>Qty</th><th>Gross Wt</th>'+(d.less?'<th>Less</th>':'')+(d.stoneWt?'<th>St.Wt</th>':'')+(d.netWt?'<th>Net Wt</th>':'')+'<th>Rate</th>'+(d.skin?'<th>Skin</th>':'')+(d.wst?'<th>Wst %</th>':'')+(d.mc?'<th>MC ₹</th>':'')+(d.stoneAmt?'<th>St.Amt</th>':'')+'<th>Supplier</th><th>Status</th><th>Amount</th><th>Notes</th><th></th>'
        + '</tr></thead><tbody id="rcoOrderItemsBody">'+items.map(rcoOrderRowMarkup).join('')+'</tbody></table></div></section>'

        + '<div class="rco-grid-2">'
        + '<section class="rco-section-card"><h3>Receipts <button type="button" onclick="rcoAddOrderReceiptRow()">＋ Add</button></h3>'
        + '<div class="table"><table><thead><tr><th>Type</th><th>Bank/Cash</th><th>Amount</th><th>Card/UPI</th><th>Adv</th><th>Ref</th><th></th></tr></thead><tbody id="rcoOrderReceiptsBody">'+receipts.map(rcoOrderReceiptMarkup).join('')+'</tbody></table></div></section>'
        + '<section class="rco-section-card"><h3>Old Jewel & Chit <button type="button" onclick="rcoAddOrderOldJewelRow()">＋ Old Jewel</button> <button type="button" onclick="rcoAddOrderChitRow()">＋ Chit</button></h3>'
        + '<div class="table"><table><thead><tr><th>Old Jewel</th><th>Wt</th><th>Less</th><th>Touch</th><th>Rate</th><th>Amt</th><th></th></tr></thead><tbody id="rcoOrderOldBody">'+oldJ.map(rcoOrderOldMarkup).join('')+'</tbody></table></div>'
        + '<div class="table" style="margin-top:8px"><table><thead><tr><th>Chit Ledger</th><th>Chit #</th><th>Amount</th><th></th></tr></thead><tbody id="rcoOrderChitBody">'+chits.map(rcoOrderChitMarkup).join('')+'</tbody></table></div></section>'
        + '</div>'

        + '<section class="rco-section-card"><h3>Totals & Calculations</h3><div class="rco-grid">'
        + '<label class="rco-field"><span>Reference / Remarks</span><input name="reference" value="'+esc(o?.reference||'')+'"></label>'
        + '<label class="rco-field"><span>Discount ₹</span><input name="discount" type="number" min="0" step=".01" value="'+(o?.discount||0)+'" oninput="rcoRecalcOrder()"></label>'
        + '<label class="rco-field"><span>Round Type</span><select name="roundType" onchange="rcoRecalcOrder()">'+opts(['Add','Sub'], o?.roundType||'Add')+'</select></label>'
        + '<label class="rco-field"><span>Round Off ₹</span><input name="roundOff" type="number" min="0" step=".01" value="'+(o?.roundOff||0)+'" oninput="rcoRecalcOrder()"></label>'
        + '<div class="rco-field"><label style="display:flex;align-items:center;gap:6px;margin-top:20px"><input name="gstEnabled" type="checkbox" '+(o?.gstEnabled?'checked':'')+' onchange="rcoRecalcOrder()"> Include 3% GST (1.5% + 1.5%)</label></div>'
        + '</div>'
        + '<div class="cards" style="margin-top:12px">'
        + '<div class="card"><label>SALES AMOUNT</label><b id="rcoTotSales">₹ 0.00</b></div>'
        + '<div class="card"><label>TAX (GST)</label><b id="rcoTotTax">₹ 0.00</b></div>'
        + '<div class="card"><label>NET AMOUNT</label><b id="rcoTotNet">₹ 0.00</b></div>'
        + '<div class="card"><label>PAID / ADVANCE</label><b id="rcoTotRcpt">₹ 0.00</b></div>'
        + '<div class="card"><label>BALANCE DUE</label><b id="rcoTotBal">₹ 0.00</b></div>'
        + '</div>'
        + '<div class="right" style="margin-top:14px"><button type="submit" class="primary" style="min-width:160px;font-weight:750">Save Order</button></div></section></form>';
    }

    // List View
    const filtered = all.filter(o => {
      if(rcoOrderTab === 'Open' && o.status !== 'Open') return false;
      if(rcoOrderTab === 'Closed' && o.status !== 'Closed') return false;
      if(rcoOrderTab === 'Cancel' && o.status !== 'Cancel') return false;
      if(rcoOrderTab === 'By Due Date' && !o.deliveryDate) return false;
      if(rcoOrderTab === 'Convert Into Sale Bill' && !o.convertedToBill) return false;
      const cust = (db.customers||[]).find(c=>c.id===o.customerId) || {};
      const q = rcoOrderFilter.q.trim().toLowerCase();
      if(q && !(String(o.orderNo).toLowerCase().includes(q) || String(cust.name||'').toLowerCase().includes(q) || String(cust.phone||'').includes(q))) return false;
      if(rcoOrderFilter.supplierId && !(o.items||[]).some(it=>it.supplierId===rcoOrderFilter.supplierId)) return false;
      if(rcoOrderFilter.ornament !== 'All' && !(o.items||[]).some(it=>it.ornament===rcoOrderFilter.ornament)) return false;
      if(rcoOrderFilter.salesPerson && !String(o.salesPerson||'').toLowerCase().includes(rcoOrderFilter.salesPerson.toLowerCase())) return false;
      const dt = o[rcoOrderFilter.dateBy] || o.orderDate || '';
      if(rcoOrderFilter.from && dt < rcoOrderFilter.from) return false;
      if(rcoOrderFilter.to && dt > rcoOrderFilter.to) return false;
      return true;
    }).sort((a,b)=>String(b.orderDate||'').localeCompare(String(a.orderDate||'')));

    let tableHtml = '';
    if(rcoOrderDetailMode){
      const flatRows = [];
      filtered.forEach(o => (o.items||[]).forEach((it, idx) => {
        const sup = (db.retailSuppliers||[]).find(s=>s.id===it.supplierId)?.name || '—';
        flatRows.push([esc(o.orderNo), idx+1, esc(it.product), esc(it.ornament), it.qty, fmt(it.grossWt)+' g', fmt(it.netWt)+' g', rateMoney(it.rate), it.wst+'%', rateMoney(it.mc), esc(sup), '<span class="rco-badge rco-badge-open">'+esc(it.status)+'</span>', '<b>'+rateMoney(it.amount)+'</b>', esc(o.orderDate)]);
      }));
      tableHtml = flatRows.length ? table(['Order No','#','Product','Ornament','Qty','Gross Wt','Net Wt','Rate','Wst %','MC','Supplier','Status','Amount','Date'], flatRows) : '<p class="empty">No order items match filters.</p>';
    } else {
      let body = '';
      filtered.forEach(o => {
        const cust = (db.customers||[]).find(c=>c.id===o.customerId) || {};
        const goldWt = (o.items||[]).filter(x=>x.ornament==='Gold').reduce((s,x)=>s+n(x.netWt),0);
        const silvWt = (o.items||[]).filter(x=>x.ornament==='Silver').reduce((s,x)=>s+n(x.netWt),0);
        const goldAmt = (o.items||[]).filter(x=>x.ornament==='Gold').reduce((s,x)=>s+n(x.amount),0);
        const silvAmt = (o.items||[]).filter(x=>x.ornament==='Silver').reduce((s,x)=>s+n(x.amount),0);
        const exp = rcoExpandedOrders.has(o.id);
        body += '<tr>'
          + '<td><button type="button" onclick="rcoToggleOrderExpand(\''+esc(o.id)+'\')">'+(exp?'−':'+')+'</button></td>'
          + '<td><b>'+esc(o.orderNo)+'</b></td>'
          + '<td>'+esc(cust.name||'—')+(cust.phone?'<br><small>'+esc(cust.phone)+'</small>':'')+'</td>'
          + '<td>'+esc(o.orderDate)+'</td>'
          + '<td>'+esc(o.deliveryDate||'—')+'</td>'
          + '<td>'+rateMoney(o.advanceAmount)+'</td>'
          + '<td>'+rateMoney(o.paidAmount)+'</td>'
          + '<td>'+fmt(goldWt)+' g</td>'
          + '<td>'+fmt(silvWt)+' g</td>'
          + '<td>'+rateMoney(goldAmt)+'</td>'
          + '<td>'+rateMoney(silvAmt)+'</td>'
          + '<td><b>'+rateMoney(o.netAmount)+'</b></td>'
          + '<td><span class="rco-badge rco-badge-'+(o.status==='Cancel'?'cancel':o.status==='Closed'?'closed':'open')+'">'+esc(o.status)+'</span></td>'
          + '<td style="white-space:nowrap"><button type="button" onclick="rcoOpenOrderForm(\''+esc(o.id)+'\')">Edit</button> <button type="button" class="primary" onclick="rcoViewOrder(\''+esc(o.id)+'\')">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete order?\')){rcoDelOrder(\''+esc(o.id)+'\')}">×</button></td>'
          + '</tr>';
        if(exp){
          body += '<tr class="rco-subtable-row"><td colspan="14">'+table(['Product','Qty','Gross Wt','Stone Wt','Net Wt','Rate','Skin','Wst','Supplier','Status'], (o.items||[]).map(it=>[esc(it.product), it.qty, fmt(it.grossWt)+' g', fmt(it.stoneWt)+' g', fmt(it.netWt)+' g', rateMoney(it.rate), esc(it.skin), it.wst+'%', esc(((db.retailSuppliers||[]).find(s=>s.id===it.supplierId)||{}).name||'—'), esc(it.status)]))+'</td></tr>';
        }
      });
      tableHtml = filtered.length ? '<div class="table"><table><thead><tr><th></th><th>Order No</th><th>Customer</th><th>Order Date</th><th>Delivery Date</th><th>Advance Amt</th><th>Paid Amt</th><th>Gold Wt</th><th>Silver Wt</th><th>Gold Amt</th><th>Silver Amt</th><th>Estimated Amt</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+body+'</tbody></table></div>' : '<p class="empty">No orders yet. Click + Create to add your first retail order.</p>';
    }

    return header('Order Tracking', '<button type="button" class="primary" onclick="rcoOpenOrderForm()">＋ Create Order</button> <button type="button" onclick="rcoOrderDetailMode=!rcoOrderDetailMode;render()">'+(rcoOrderDetailMode?'View Lists':'Detail Lists')+'</button>')
      + '<div class="rco-tabs">' + ['All','By Due Date','Open','Cancel','Closed','Convert Into Sale Bill'].map(t=>'<button type="button" class="'+(rcoOrderTab===t?'active':'')+'" onclick="rcoSetOrderTab(\''+t+'\')">'+esc(t)+'</button>').join('') + '</div>'
      + '<section class="panel"><div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search by Customer Name, Mobile, Order No..." value="'+esc(rcoOrderFilter.q)+'" oninput="rcoOrderFilter.q=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" onclick="rcoOrderFilterOpen=!rcoOrderFilterOpen;render()">🔍 Filter</button><button type="button" onclick="rcoOrderFilter={q:\'\',dateBy:\'orderDate\',from:\'\',to:\'\',supplierId:\'\',ornament:\'All\',product:\'\',salesPerson:\'\'};render()">Reset</button></div></div>'
      + (rcoOrderFilterOpen ? '<div class="rco-filter-box">'
        + '<label class="rco-field"><span>Date Filter By</span><select onchange="rcoOrderFilter.dateBy=this.value;render()">'+opts(['orderDate','deliveryDate','createdAt'], rcoOrderFilter.dateBy)+'</select></label>'
        + '<label class="rco-field"><span>From Date</span><input type="date" value="'+esc(rcoOrderFilter.from)+'" onchange="rcoOrderFilter.from=this.value;render()"></label>'
        + '<label class="rco-field"><span>To Date</span><input type="date" value="'+esc(rcoOrderFilter.to)+'" onchange="rcoOrderFilter.to=this.value;render()"></label>'
        + '<label class="rco-field"><span>Supplier</span><select onchange="rcoOrderFilter.supplierId=this.value;render()">'+supOpts(rcoOrderFilter.supplierId,'All Suppliers')+'</select></label>'
        + '<label class="rco-field"><span>Ornament Type</span><select onchange="rcoOrderFilter.ornament=this.value;render()">'+opts(['All','Gold','Silver','Diamond','Alloy'], rcoOrderFilter.ornament)+'</select></label>'
        + '<label class="rco-field"><span>Sales Person</span><input value="'+esc(rcoOrderFilter.salesPerson)+'" oninput="rcoOrderFilter.salesPerson=this.value;render()"></label>'
        + '</div>' : '')
      + tableHtml + '</section>';
  }
  window.rcoDelOrder = (id) => { delDoc('retail-order', id); render(); };

  // ======================== 2. CRM MODULE (8 SUB-PAGES) ========================
  window.rcoSetCrmTab = (t) => { rcoCrmTab = t; rcoCrmEditId = ''; rcoCrmShowFormFlag = false; rcoCrmSearch = ''; render(); };
  let rcoCrmShowFormFlag = false;
  window.rcoOpenCrmForm = (id='') => { rcoCrmEditId = id; rcoCrmShowFormFlag = true; render(); };
  window.rcoCloseCrmForm = () => { rcoCrmShowFormFlag = false; rcoCrmEditId = ''; render(); };

  window.rcoSaveLead = (e) => {
    e.preventDefault(); const f = e.target;
    saveDoc('crm-lead', {
      id: rcoCrmEditId || undefined,
      leadNo: (rcoCrmEditId && docs('crm-lead').find(x=>x.id===rcoCrmEditId)?.leadNo) || ('LD-' + Date.now().toString().slice(-5)),
      campaign: f.campaign.value, status: f.status.value, source: f.source.value, owner: f.owner.value,
      name: f.name.value.trim(), mobile: f.mobile.value.trim(), email: f.email.value.trim(), city: f.city.value.trim(),
      interestedProducts: f.interestedProducts.value.trim(), budget: n(f.budget.value), followupDate: f.followupDate.value, notes: f.notes.value.trim()
    });
    rcoCloseCrmForm(); say('Lead saved.');
  };
  window.rcoConvertLeadToCustomer = (id) => {
    const l = docs('crm-lead').find(x=>x.id===id); if(!l) return;
    if(!confirm('Convert lead ' + l.name + ' to a Retail Customer?')) return;
    db.customers.push({ id: crypto.randomUUID(), name: l.name, phone: l.mobile, mobile: l.mobile, email: l.email, city: l.city, state: 'TAMIL NADU', createdAt: new Date().toISOString() });
    l.status = 'Converted'; saveDoc('crm-lead', l); save(); pushCloud(); say('Lead converted to Customer.'); render();
  };

  window.rcoSaveVisitor = (e) => {
    e.preventDefault(); const f = e.target;
    const prods = [];
    f.querySelectorAll('.rco-vis-prod').forEach(tr => {
      const p = tr.querySelector('[name="vp_prod"]')?.value?.trim();
      if(p) prods.push({ product:p, ornament:tr.querySelector('[name="vp_orn"]').value, qty:n(tr.querySelector('[name="vp_qty"]').value), weight:n(tr.querySelector('[name="vp_wt"]').value), wst:n(tr.querySelector('[name="vp_wst"]').value), amount:n(tr.querySelector('[name="vp_amt"]').value) });
    });
    saveDoc('crm-visitor', {
      id: rcoCrmEditId || undefined,
      visitDate: f.visitDate.value, customerNo: f.customerNo.value, mobile: f.mobile.value.trim(), name: f.name.value.trim(), email: f.email.value.trim(),
      contactPerson: f.contactPerson.value, contactMobile: f.contactMobile.value, doorNo: f.doorNo.value, street: f.street.value, area: f.area.value, city: f.city.value, district: f.district.value, pinCode: f.pinCode.value, state: f.state.value,
      businessType: f.businessType.value, religion: f.religion.value, gender: f.gender.value, refName: f.refName.value, refMobile: f.refMobile.value,
      areaRange: f.areaRange.value, festivalType: f.festivalType.value, profession: f.profession.value, visitorType: f.visitorType.value, vehicleType: f.vehicleType.value,
      customerBase: f.customerBase.value, status: f.status.value, referredBy: f.referredBy.value, empRef: f.empRef.value,
      dob: f.dob.value, anniversary: f.anniversary.value, followupDate: f.followupDate.value, age: f.age.value,
      attendBy: f.attendBy.value, supervisedBy: f.supervisedBy.value, visitStatus: f.visitStatus.value, segment: f.segment.value,
      privilegeCard: f.privilegeCard.value, reason: f.reason.value, feedback: f.feedback.value,
      eventType: f.eventType.value, eventDate: f.eventDate.value, eventArea: f.eventArea.value, eventCity: f.eventCity.value, eventHall: f.eventHall.value, eventContact: f.eventContact.value, eventContactMobile: f.eventContactMobile.value,
      products: prods
    });
    rcoCloseCrmForm(); say('Visitor saved.');
  };

  window.rcoOpenCallModal = (name='', mobile='', targetType='Customers', targetId='') => {
    document.getElementById('rcoCallModal')?.remove();
    const html = '<div id="rcoCallModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:520px">'
      + '<div class="retail-modal-head"><div><h2>Log Call</h2><p>Record follow-up call activity</p></div><button type="button" onclick="document.getElementById(\'rcoCallModal\').remove()">Close</button></div>'
      + '<form onsubmit="rcoSaveCallLog(event)"><div class="rco-grid-2">'
      + '<label class="rco-field"><span>Type</span><select name="callTargetType">'+opts(['Customers','Visitors','Leads'], targetType)+'</select></label>'
      + '<label class="rco-field"><span>Call Date</span><input name="callDate" type="date" required value="'+todayStr()+'"></label>'
      + '<label class="rco-field"><span>Name *</span><input name="name" required value="'+esc(name)+'"></label>'
      + '<label class="rco-field"><span>Mobile *</span><input name="mobile" required value="'+esc(mobile)+'"></label>'
      + '<label class="rco-field"><span>Call Type</span><select name="callType">'+opts(['Outgoing','Incoming','Missed','WhatsApp'], 'Outgoing')+'</select></label>'
      + '<label class="rco-field"><span>Call Response</span><select name="callResponse">'+opts(['Interested','Callback Requested','Not Reachable','Not Interested','Converted','Follow-up Scheduled'], 'Interested')+'</select></label>'
      + '<label class="rco-field"><span>Employee</span><input name="employee" value="'+esc(goldleafContext?.user_email||'Staff')+'"></label>'
      + '<label class="rco-field"><span>Next Follow-up Date</span><input name="followupDate" type="date"></label>'
      + '<label class="rco-field wide"><span>Notes / Remarks</span><textarea name="notes" rows="2"></textarea></label>'
      + '</div><input type="hidden" name="targetId" value="'+esc(targetId)+'">'
      + '<div class="retail-modal-actions"><button type="submit" class="primary">Save Call Log</button></div></form></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.rcoSaveCallLog = (e) => {
    e.preventDefault(); const f = e.target;
    saveDoc('crm-call-log', {
      callTargetType: f.callTargetType.value, targetId: f.targetId.value, callDate: f.callDate.value,
      name: f.name.value.trim(), mobile: f.mobile.value.trim(), callType: f.callType.value,
      callResponse: f.callResponse.value, employee: f.employee.value.trim(), followupDate: f.followupDate.value, notes: f.notes.value.trim()
    });
    document.getElementById('rcoCallModal')?.remove();
    say('Call log saved.'); render();
  };

  window.rcoSaveQuestion = (e) => {
    e.preventDefault(); const f = e.target;
    saveDoc('crm-question', { id: rcoCrmEditId||undefined, question: f.question.value.trim(), questionType: f.questionType.value, isRequired: f.isRequired.value });
    rcoCloseCrmForm(); say('Feedback question saved.');
  };
  window.rcoSaveCampaign = (e) => {
    e.preventDefault(); const f = e.target;
    const qIds = Array.from(f.querySelectorAll('[name="camp_q"]:checked')).map(c=>c.value);
    saveDoc('crm-campaign', { id: rcoCrmEditId||undefined, name: f.name.value.trim(), description: f.description.value.trim(), questionIds: qIds });
    rcoCloseCrmForm(); say('Campaign saved.');
  };
  window.rcoSaveFeedback = (e) => {
    e.preventDefault(); const f = e.target;
    const cust = (db.customers||[]).find(c=>c.id===f.customerId.value) || {};
    saveDoc('crm-feedback', {
      customerId: f.customerId.value, customerName: cust.name || f.customerName.value, mobile: cust.phone || f.mobile.value,
      campaign: f.campaign.value, source: f.source.value, saleBillNo: f.saleBillNo.value, response: f.response.value,
      status: f.status.value, description: f.description.value, filledBy: goldleafContext?.user_email || 'Staff', sentOn: todayStr()
    });
    rcoCloseCrmForm(); say('Feedback saved.');
  };
  window.rcoSaveVoucher = (e) => {
    e.preventDefault(); const f = e.target;
    const fromNo = Math.max(1, n(f.fromNo.value)||1), toNo = Math.max(fromNo, n(f.toNo.value)||fromNo);
    const prefix = f.prefix.value.trim(), suffix = f.suffix.value.trim(), randDigits = Math.max(0, Math.min(8, n(f.randDigits.value)||4));
    const genRand = (len) => Array.from({length:len}, ()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
    for(let i=fromNo; i<=Math.min(toNo, fromNo+50); i++){
      const numStr = String(i).padStart(Math.max(1, n(f.prefixDigits.value)||3), '0');
      const rStr = randDigits ? genRand(randDigits) : '';
      const code = f.randPos.value==='Prefix' ? (prefix+rStr+numStr+suffix) : (prefix+numStr+rStr+suffix);
      saveDoc('crm-voucher', {
        name: f.name.value.trim(), ledgerName: f.ledgerName.value.trim(), code, validFrom: f.validFrom.value, validTo: f.validTo.value,
        redeemType: f.redeemType.value, amount: n(f.amount.value), minPurchase: n(f.minPurchase.value), isRedeemed: false
      });
    }
    rcoCloseCrmForm(); say('Gift voucher(s) generated.');
  };

  function rcoCrmView(){
    const subTabs = ['Leads','Visitors','Call Logs','Calendar','Feedback','Campaign','Questions','Gift Voucher'];
    let body = '';

    if(rcoCrmTab === 'Leads'){
      const list = docs('crm-lead').filter(l=>!rcoCrmSearch || (l.name+l.mobile+l.leadNo).toLowerCase().includes(rcoCrmSearch.toLowerCase()));
      if(rcoCrmShowFormFlag){
        const l = rcoCrmEditId ? docs('crm-lead').find(x=>x.id===rcoCrmEditId) : null;
        body = '<section class="rco-section-card"><h3>'+(l?'Edit Lead':'New Lead')+' <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveLead(event)"><div class="rco-grid">'
          + '<label class="rco-field"><span>Campaign</span><select name="campaign">'+opts(['None (Walk-in)', ...docs('crm-campaign').map(c=>c.name)], l?.campaign||'None (Walk-in)')+'</select></label>'
          + '<label class="rco-field"><span>Lead Status *</span><select name="status" required>'+opts(RCO_LEAD_STATUS, l?.status||'Open')+'</select></label>'
          + '<label class="rco-field"><span>Lead Source</span><select name="source">'+opts(RCO_LEAD_SOURCES, l?.source||'Walk-in')+'</select></label>'
          + '<label class="rco-field"><span>Lead Owner</span><input name="owner" value="'+esc(l?.owner||'')+'"></label>'
          + '<label class="rco-field"><span>Name *</span><input name="name" required value="'+esc(l?.name||'')+'"></label>'
          + '<label class="rco-field"><span>Mobile *</span><input name="mobile" type="tel" required value="'+esc(l?.mobile||'')+'"></label>'
          + '<label class="rco-field"><span>Email</span><input name="email" type="email" value="'+esc(l?.email||'')+'"></label>'
          + '<label class="rco-field"><span>City</span><input name="city" value="'+esc(l?.city||'')+'"></label>'
          + '<label class="rco-field"><span>Interested Products</span><input name="interestedProducts" value="'+esc(l?.interestedProducts||'')+'" placeholder="e.g. Necklace, Bangles"></label>'
          + '<label class="rco-field"><span>Budget ₹</span><input name="budget" type="number" step=".01" value="'+(l?.budget||'')+'"></label>'
          + '<label class="rco-field"><span>Follow-up Date</span><input name="followupDate" type="date" value="'+esc(l?.followupDate||'')+'"></label>'
          + '<label class="rco-field wide"><span>Notes</span><textarea name="notes" rows="2">'+esc(l?.notes||'')+'</textarea></label>'
          + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Lead</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><input class="rco-search" placeholder="Search Name / Mobile / Lead No..." value="'+esc(rcoCrmSearch)+'" oninput="rcoCrmSearch=this.value;render()"><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Create Lead</button></div>'
          + (list.length ? table(['Lead No','Name','Mobile','Campaign','Source','Owner','Status','Follow-up','Actions'], list.map(l=>[esc(l.leadNo), '<b>'+esc(l.name)+'</b>', esc(l.mobile), esc(l.campaign), esc(l.source), esc(l.owner||'—'), '<span class="rco-badge rco-badge-open">'+esc(l.status)+'</span>', esc(l.followupDate||'—'), '<button type="button" onclick="rcoOpenCrmForm(\''+esc(l.id)+'\')">Edit</button> <button type="button" onclick="rcoOpenCallModal(\''+esc(l.name)+'\',\''+esc(l.mobile)+'\',\'Leads\',\''+esc(l.id)+'\')">📞 Call</button> <button type="button" class="primary" onclick="rcoConvertLeadToCustomer(\''+esc(l.id)+'\')">Convert</button> <button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-lead\',\''+esc(l.id)+'\')">×</button>'])) : '<p class="empty">No leads yet.</p>');
      }
    }
    else if(rcoCrmTab === 'Visitors'){
      const list = docs('crm-visitor').filter(v=>!rcoCrmSearch || (v.name+v.mobile).toLowerCase().includes(rcoCrmSearch.toLowerCase()));
      if(rcoCrmShowFormFlag){
        const v = rcoCrmEditId ? docs('crm-visitor').find(x=>x.id===rcoCrmEditId) : null;
        body = '<section class="rco-section-card"><h3>'+(v?'Edit Visitor':'New Visitor')+' <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveVisitor(event)">'
          + '<h4 style="margin:6px 0">Customer Information</h4><div class="rco-grid">'
          + '<label class="rco-field"><span>Visit Date</span><input name="visitDate" type="date" value="'+esc(v?.visitDate||todayStr())+'"></label>'
          + '<label class="rco-field"><span>Customer Number</span><input name="customerNo" value="'+esc(v?.customerNo||'')+'"></label>'
          + '<label class="rco-field"><span>Mobile Number *</span><input name="mobile" type="tel" required value="'+esc(v?.mobile||'')+'"></label>'
          + '<label class="rco-field"><span>Name *</span><input name="name" required value="'+esc(v?.name||'')+'"></label>'
          + '<label class="rco-field"><span>Email</span><input name="email" type="email" value="'+esc(v?.email||'')+'"></label>'
          + '<label class="rco-field"><span>Contact Person</span><input name="contactPerson" value="'+esc(v?.contactPerson||'')+'"></label>'
          + '<label class="rco-field"><span>Contact Mobile</span><input name="contactMobile" value="'+esc(v?.contactMobile||'')+'"></label>'
          + '<label class="rco-field"><span>Door No</span><input name="doorNo" value="'+esc(v?.doorNo||'')+'"></label>'
          + '<label class="rco-field"><span>Street Name</span><input name="street" value="'+esc(v?.street||'')+'"></label>'
          + '<label class="rco-field"><span>Type / Area</span><input name="area" value="'+esc(v?.area||'')+'"></label>'
          + '<label class="rco-field"><span>City</span><input name="city" value="'+esc(v?.city||'')+'"></label>'
          + '<label class="rco-field"><span>District</span><input name="district" value="'+esc(v?.district||'')+'"></label>'
          + '<label class="rco-field"><span>Pin Code</span><input name="pinCode" value="'+esc(v?.pinCode||'')+'"></label>'
          + '<label class="rco-field"><span>State</span><select name="state">'+opts(RCO_STATES, v?.state||'TAMIL NADU')+'</select></label>'
          + '<label class="rco-field"><span>Gender</span><select name="gender">'+opts(['Male','Female','Others'], v?.gender||'Female')+'</select></label>'
          + '<label class="rco-field"><span>Business Type</span><select name="businessType">'+opts(['','LARGE','MEDIUM','SMALL'], v?.businessType||'')+'</select></label>'
          + '<label class="rco-field"><span>Religion Type</span><select name="religion">'+opts(['','HINDU','MUSLIM','CHRISTIAN','OTHER'], v?.religion||'')+'</select></label>'
          + '<label class="rco-field"><span>Profession Type</span><input name="profession" value="'+esc(v?.profession||'')+'"></label>'
          + '<label class="rco-field"><span>Visitor Type</span><input name="visitorType" value="'+esc(v?.visitorType||'Walk-in')+'"></label>'
          + '<label class="rco-field"><span>Vehicle Type</span><input name="vehicleType" value="'+esc(v?.vehicleType||'')+'"></label>'
          + '<label class="rco-field"><span>Area Range</span><input name="areaRange" value="'+esc(v?.areaRange||'')+'"></label>'
          + '<label class="rco-field"><span>Festival Type</span><input name="festivalType" value="'+esc(v?.festivalType||'')+'"></label>'
          + '<label class="rco-field"><span>Customer Base</span><input name="customerBase" value="'+esc(v?.customerBase||'')+'"></label>'
          + '<label class="rco-field"><span>Customer Segment</span><input name="segment" value="'+esc(v?.segment||'')+'"></label>'
          + '<label class="rco-field"><span>Reference Name</span><input name="refName" value="'+esc(v?.refName||'')+'"></label>'
          + '<label class="rco-field"><span>Reference Mobile</span><input name="refMobile" value="'+esc(v?.refMobile||'')+'"></label>'
          + '<label class="rco-field"><span>Referred By</span><input name="referredBy" value="'+esc(v?.referredBy||'')+'"></label>'
          + '<label class="rco-field"><span>Employee Reference</span><input name="empRef" value="'+esc(v?.empRef||'')+'"></label>'
          + '<label class="rco-field"><span>Date of Birth</span><input name="dob" type="date" value="'+esc(v?.dob||'')+'"></label>'
          + '<label class="rco-field"><span>Anniversary Date</span><input name="anniversary" type="date" value="'+esc(v?.anniversary||'')+'"></label>'
          + '<label class="rco-field"><span>Follow-up Date</span><input name="followupDate" type="date" value="'+esc(v?.followupDate||'')+'"></label>'
          + '<label class="rco-field"><span>Age</span><input name="age" type="number" value="'+esc(v?.age||'')+'"></label>'
          + '<label class="rco-field"><span>Attend By</span><input name="attendBy" value="'+esc(v?.attendBy||'')+'"></label>'
          + '<label class="rco-field"><span>Supervised By</span><input name="supervisedBy" value="'+esc(v?.supervisedBy||'')+'"></label>'
          + '<label class="rco-field"><span>Visit Status</span><select name="visitStatus">'+opts(['Just Visit','Order','Purchase'], v?.visitStatus||'Just Visit')+'</select></label>'
          + '<label class="rco-field"><span>Status</span><input name="status" value="'+esc(v?.status||'Active')+'"></label>'
          + '<label class="rco-field"><span>Privilege Card No</span><input name="privilegeCard" value="'+esc(v?.privilegeCard||'')+'"></label>'
          + '<label class="rco-field"><span>Reason</span><input name="reason" value="'+esc(v?.reason||'')+'"></label>'
          + '<label class="rco-field"><span>Feedback</span><input name="feedback" value="'+esc(v?.feedback||'')+'"></label>'
          + '</div><h4 style="margin:14px 0 6px">Event Information</h4><div class="rco-grid">'
          + '<label class="rco-field"><span>Event Type</span><input name="eventType" value="'+esc(v?.eventType||'')+'"></label>'
          + '<label class="rco-field"><span>Event Date</span><input name="eventDate" type="date" value="'+esc(v?.eventDate||'')+'"></label>'
          + '<label class="rco-field"><span>Event Area</span><input name="eventArea" value="'+esc(v?.eventArea||'')+'"></label>'
          + '<label class="rco-field"><span>Event City</span><input name="eventCity" value="'+esc(v?.eventCity||'')+'"></label>'
          + '<label class="rco-field"><span>Event Hall Name</span><input name="eventHall" value="'+esc(v?.eventHall||'')+'"></label>'
          + '<label class="rco-field"><span>Event Contact Person</span><input name="eventContact" value="'+esc(v?.eventContact||'')+'"></label>'
          + '<label class="rco-field"><span>Event Contact Mobile</span><input name="eventContactMobile" value="'+esc(v?.eventContactMobile||'')+'"></label>'
          + '</div><h4 style="margin:14px 0 6px">Product Information <button type="button" onclick="document.getElementById(\'rcoVisProds\').insertAdjacentHTML(\'beforeend\',\'<tr class=rco-vis-prod><td><input name=vp_prod placeholder=Product></td><td><select name=vp_orn>'+opts(RCO_ORNS,'Gold').replace(/"/g,'&quot;')+'</select></td><td><input name=vp_qty type=number value=1></td><td><input name=vp_wt type=number step=.001></td><td><input name=vp_wst type=number step=.01></td><td><input name=vp_amt type=number step=.01></td><td><button type=button class=rb-delete-btn onclick=this.closest(&quot;tr&quot;).remove()>×</button></td></tr>\')">＋ Add</button></h4>'
          + '<div class="table"><table><thead><tr><th>Product</th><th>Ornament</th><th>Qty</th><th>Weight</th><th>Wst %</th><th>Amount</th><th></th></tr></thead><tbody id="rcoVisProds">'+(v?.products||[{}]).map(p=>'<tr class="rco-vis-prod"><td><input name="vp_prod" value="'+esc(p.product||'')+'"></td><td><select name="vp_orn">'+opts(RCO_ORNS,p.ornament||'Gold')+'</select></td><td><input name="vp_qty" type="number" value="'+(p.qty||1)+'"></td><td><input name="vp_wt" type="number" step=".001" value="'+(p.weight||0)+'"></td><td><input name="vp_wst" type="number" step=".01" value="'+(p.wst||0)+'"></td><td><input name="vp_amt" type="number" step=".01" value="'+(p.amount||0)+'"></td><td><button type="button" class="rb-delete-btn" onclick="this.closest(\'tr\').remove()">×</button></td></tr>').join('')+'</tbody></table></div>'
          + '<div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Visitor</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><input class="rco-search" placeholder="Search Visitor Name / Mobile..." value="'+esc(rcoCrmSearch)+'" oninput="rcoCrmSearch=this.value;render()"><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Create Visitor</button></div>'
          + (list.length ? table(['Visit Date','Name','Mobile','City','Attend By','Visit Status','Follow-up','Actions'], list.map(v=>[esc(v.visitDate), '<b>'+esc(v.name)+'</b>', esc(v.mobile), esc(v.city||'—'), esc(v.attendBy||'—'), '<span class="rco-badge rco-badge-open">'+esc(v.visitStatus)+'</span>', esc(v.followupDate||'—'), '<button type="button" onclick="rcoOpenCrmForm(\''+esc(v.id)+'\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-visitor\',\''+esc(v.id)+'\')">×</button>'])) : '<p class="empty">No visitors recorded yet.</p>');
      }
    }
    else if(rcoCrmTab === 'Call Logs'){
      const list = docs('crm-call-log').filter(c=>(rcoCallTypeFilter==='All'||c.callTargetType===rcoCallTypeFilter) && (!rcoCrmSearch || (c.name+c.mobile+c.notes).toLowerCase().includes(rcoCrmSearch.toLowerCase())));
      body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search Customer Name / Mobile..." value="'+esc(rcoCrmSearch)+'" oninput="rcoCrmSearch=this.value;render()"><select onchange="rcoCallTypeFilter=this.value;render()">'+opts(['All','Customers','Visitors','Leads'], rcoCallTypeFilter)+'</select></div><button type="button" class="primary" onclick="rcoOpenCallModal()">＋ Log Call</button></div>'
        + (list.length ? table(['Date','Type','Name','Mobile','Call Type','Response','Employee','Follow-up','Notes',''], list.map(c=>[esc(c.callDate), esc(c.callTargetType), '<b>'+esc(c.name)+'</b>', esc(c.mobile), esc(c.callType), '<span class="rco-badge rco-badge-open">'+esc(c.callResponse)+'</span>', esc(c.employee), esc(c.followupDate||'—'), esc(c.notes||'—'), '<button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-call-log\',\''+esc(c.id)+'\')">×</button>'])) : '<p class="empty">No call logs yet.</p>');
    }
    else if(rcoCrmTab === 'Calendar'){
      const [yr, mo] = rcoCalMonth.split('-').map(Number);
      const first = new Date(yr, mo-1, 1), startDay = first.getDay(), daysInMo = new Date(yr, mo, 0).getDate();
      const eventsByDay = {};
      const addEv = (dt, label, cls='') => { if(!dt||!dt.startsWith(rcoCalMonth)) return; const d = parseInt(dt.slice(8,10),10); (eventsByDay[d]=eventsByDay[d]||[]).push({label,cls}); };
      docs('crm-lead').forEach(l=>addEv(l.followupDate, 'Lead: '+l.name));
      docs('crm-visitor').forEach(v=>addEv(v.followupDate, 'Visit: '+v.name));
      docs('crm-call-log').forEach(c=>addEv(c.followupDate, 'Call: '+c.name));
      docs('retail-order').forEach(o=>addEv(o.deliveryDate, 'Order Due: '+o.orderNo, 'order'));
      (db.customers||[]).forEach(c=>{
        if(c.dob && c.dob.slice(5,7)===rcoCalMonth.slice(5,7)) addEv(rcoCalMonth+'-'+c.dob.slice(8,10), '🎂 '+c.name, 'bday');
        if(c.anniversary && c.anniversary.slice(5,7)===rcoCalMonth.slice(5,7)) addEv(rcoCalMonth+'-'+c.anniversary.slice(8,10), '💍 '+c.name, 'bday');
      });
      const prevM = new Date(yr, mo-2, 1).toISOString().slice(0,7), nextM = new Date(yr, mo, 1).toISOString().slice(0,7);
      let cells = '';
      for(let i=0;i<startDay;i++) cells += '<div class="rco-cal-cell muted"></div>';
      const tod = todayStr();
      for(let d=1; d<=daysInMo; d++){
        const dStr = rcoCalMonth + '-' + String(d).padStart(2,'0');
        const evs = (eventsByDay[d]||[]).map(e=>'<div class="rco-cal-ev '+e.cls+'" title="'+esc(e.label)+'">'+esc(e.label)+'</div>').join('');
        cells += '<div class="rco-cal-cell '+(dStr===tod?'today':'')+'"><b>'+d+'</b>'+evs+'</div>';
      }
      body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" onclick="rcoCalMonth=\''+prevM+'\';render()">◀</button><b>'+first.toLocaleString('en-IN',{month:'long',year:'numeric'})+'</b><button type="button" onclick="rcoCalMonth=\''+nextM+'\';render()">▶</button><button type="button" onclick="rcoCalMonth=\''+todayStr().slice(0,7)+'\';render()">Today</button></div></div>'
        + '<div class="rco-cal-grid">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(w=>'<div class="rco-cal-head">'+w+'</div>').join('')+cells+'</div>';
    }
    else if(rcoCrmTab === 'Feedback'){
      const list = docs('crm-feedback');
      if(rcoCrmShowFormFlag){
        body = '<section class="rco-section-card"><h3>Record Feedback <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveFeedback(event)"><div class="rco-grid">'
          + '<label class="rco-field"><span>Customer</span><select name="customerId">'+custOpts('','Walk-in / Manual')+'</select></label>'
          + '<label class="rco-field"><span>Customer Name</span><input name="customerName"></label>'
          + '<label class="rco-field"><span>Mobile</span><input name="mobile" type="tel"></label>'
          + '<label class="rco-field"><span>Campaign</span><select name="campaign">'+opts(['General', ...docs('crm-campaign').map(c=>c.name)], 'General')+'</select></label>'
          + '<label class="rco-field"><span>Source</span><select name="source">'+opts(['Sale Bill','Walk-in','WhatsApp'], 'Sale Bill')+'</select></label>'
          + '<label class="rco-field"><span>Sale Bill No</span><input name="saleBillNo"></label>'
          + '<label class="rco-field"><span>Response</span><select name="response">'+opts(['Excellent','Good','Average','Needs Attention'], 'Excellent')+'</select></label>'
          + '<label class="rco-field"><span>Status</span><select name="status">'+opts(['Completed','Pending'], 'Completed')+'</select></label>'
          + '<label class="rco-field wide"><span>Description / Comments</span><textarea name="description" rows="2"></textarea></label>'
          + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Feedback</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><span>Customer Feedback Responses</span><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Record Feedback</button></div>'
          + (list.length ? table(['Customer','Mobile','Campaign','Source','Bill No','Sent On','Response','Status','Description',''], list.map(f=>['<b>'+esc(f.customerName)+'</b>', esc(f.mobile), esc(f.campaign), esc(f.source), esc(f.saleBillNo||'—'), esc(f.sentOn), '<span class="rco-badge rco-badge-open">'+esc(f.response)+'</span>', esc(f.status), esc(f.description||'—'), '<button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-feedback\',\''+esc(f.id)+'\')">×</button>'])) : '<p class="empty">No feedback entries yet.</p>');
      }
    }
    else if(rcoCrmTab === 'Campaign'){
      const list = docs('crm-campaign'), qs = docs('crm-question');
      if(rcoCrmShowFormFlag){
        const c = rcoCrmEditId ? list.find(x=>x.id===rcoCrmEditId) : null;
        body = '<section class="rco-section-card"><h3>'+(c?'Edit Campaign':'Create Campaign')+' <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveCampaign(event)"><div class="rco-grid-2">'
          + '<label class="rco-field"><span>Campaign Name *</span><input name="name" required value="'+esc(c?.name||'')+'"></label>'
          + '<label class="rco-field wide"><span>Description</span><textarea name="description" rows="2">'+esc(c?.description||'')+'</textarea></label>'
          + '</div><div class="rco-field" style="margin-top:10px"><span>Select Questions</span><div class="rco-check-row">'+(qs.length?qs.map(q=>'<label><input type="checkbox" name="camp_q" value="'+esc(q.id)+'" '+((c?.questionIds||[]).includes(q.id)?'checked':'')+'> '+esc(q.question)+' ('+esc(q.questionType)+')</label>').join(''):'<span class="muted">Create questions in the Questions tab first.</span>')+'</div></div>'
          + '<div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Campaign</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><span>Campaigns</span><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Create Campaign</button></div>'
          + (list.length ? table(['Campaign Name','Description','Questions','Actions'], list.map(c=>['<b>'+esc(c.name)+'</b>', esc(c.description||'—'), (c.questionIds?.length||0)+' questions', '<button type="button" onclick="rcoOpenCrmForm(\''+esc(c.id)+'\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-campaign\',\''+esc(c.id)+'\')">×</button>'])) : '<p class="empty">No campaigns yet.</p>');
      }
    }
    else if(rcoCrmTab === 'Questions'){
      const list = docs('crm-question');
      if(rcoCrmShowFormFlag){
        const q = rcoCrmEditId ? list.find(x=>x.id===rcoCrmEditId) : null;
        body = '<section class="rco-section-card"><h3>'+(q?'Edit Question':'Create Question')+' <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveQuestion(event)"><div class="rco-grid-3">'
          + '<label class="rco-field wide"><span>Question *</span><input name="question" required value="'+esc(q?.question||'')+'"></label>'
          + '<label class="rco-field"><span>Question Type *</span><select name="questionType" required>'+opts(['Smiley','Thumbs','Rating','Options','Notes'], q?.questionType||'Rating')+'</select></label>'
          + '<label class="rco-field"><span>Is Required</span><select name="isRequired">'+opts(['Yes','No'], q?.isRequired||'Yes')+'</select></label>'
          + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Question</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><span>Feedback Questions</span><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Create Question</button></div>'
          + (list.length ? table(['Question','Type','Required','Actions'], list.map(q=>['<b>'+esc(q.question)+'</b>', esc(q.questionType), esc(q.isRequired), '<button type="button" onclick="rcoOpenCrmForm(\''+esc(q.id)+'\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-question\',\''+esc(q.id)+'\')">×</button>'])) : '<p class="empty">No questions yet.</p>');
      }
    }
    else if(rcoCrmTab === 'Gift Voucher'){
      const list = docs('crm-voucher');
      if(rcoCrmShowFormFlag){
        body = '<section class="rco-section-card"><h3>Create Gift Vouchers <button type="button" onclick="rcoCloseCrmForm()">← Back</button></h3><form onsubmit="rcoSaveVoucher(event)"><div class="rco-grid">'
          + '<label class="rco-field"><span>Name *</span><input name="name" required placeholder="e.g. Diwali Gift"></label>'
          + '<label class="rco-field"><span>Ledger Name *</span><input name="ledgerName" required value="Gift Voucher Account"></label>'
          + '<label class="rco-field"><span>Valid From *</span><input name="validFrom" type="date" required value="'+todayStr()+'"></label>'
          + '<label class="rco-field"><span>Valid To *</span><input name="validTo" type="date" required></label>'
          + '<label class="rco-field"><span>Redeem Type *</span><select name="redeemType" required>'+opts(['Amount','Percentage'],'Amount')+'</select></label>'
          + '<label class="rco-field"><span>Amount / % *</span><input name="amount" type="number" required step=".01"></label>'
          + '<label class="rco-field"><span>Min Purchased Value</span><input name="minPurchase" type="number" step=".01" value="0"></label>'
          + '<label class="rco-field"><span>From No *</span><input name="fromNo" type="number" required value="1"></label>'
          + '<label class="rco-field"><span>To No *</span><input name="toNo" type="number" required value="5"></label>'
          + '<label class="rco-field"><span>Code Prefix</span><input name="prefix" value="GL-"></label>'
          + '<label class="rco-field"><span>Code Suffix</span><input name="suffix"></label>'
          + '<label class="rco-field"><span>Prefix Digits</span><input name="prefixDigits" type="number" value="3"></label>'
          + '<label class="rco-field"><span>Random String Position</span><select name="randPos">'+opts(['Suffix','Prefix'],'Suffix')+'</select></label>'
          + '<label class="rco-field"><span>Random String Digits</span><input name="randDigits" type="number" value="4"></label>'
          + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Generate Vouchers</button></div></form></section>';
      } else {
        body = '<div class="rco-toolbar"><span>Gift Vouchers ('+list.length+')</span><button type="button" class="primary" onclick="rcoOpenCrmForm()">＋ Create Vouchers</button></div>'
          + (list.length ? table(['Name','Code','Ledger','Value','Valid From','Valid To','Status','Actions'], list.map(v=>['<b>'+esc(v.name)+'</b>', '<code>'+esc(v.code)+'</code>', esc(v.ledgerName), v.redeemType==='Percentage'?v.amount+'%':rateMoney(v.amount), esc(v.validFrom), esc(v.validTo), '<span class="rco-badge '+(v.isRedeemed?'rco-badge-closed':'rco-badge-open')+'">'+(v.isRedeemed?'Redeemed':'Valid')+'</span>', '<button type="button" onclick="rcoToggleVoucher(\''+esc(v.id)+'\')">'+(v.isRedeemed?'Mark Valid':'Redeem')+'</button> <button type="button" class="rb-delete-btn" onclick="rcoDelCrm(\'crm-voucher\',\''+esc(v.id)+'\')">×</button>'])) : '<p class="empty">No gift vouchers created yet.</p>');
      }
    }

    return header('Retail CRM', '')
      + '<div class="rco-tabs">' + subTabs.map(t=>'<button type="button" class="'+(rcoCrmTab===t?'active':'')+'" onclick="rcoSetCrmTab(\''+t+'\')">'+esc(t)+'</button>').join('') + '</div>'
      + '<section class="panel">' + body + '</section>';
  }
  window.rcoDelCrm = (t, id) => { if(confirm('Delete record?')){ delDoc(t, id); render(); } };
  window.rcoToggleVoucher = (id) => { const v = docs('crm-voucher').find(x=>x.id===id); if(v){ v.isRedeemed=!v.isRedeemed; saveDoc('crm-voucher', v); render(); } };

  // ======================== 3. RETAIL CUSTOMER REGISTRATION & 360 VIEW ========================
  window.rcoAddFamilyRow = () => {
    const c = document.getElementById('rcoFamilyList'); if(!c) return;
    c.insertAdjacentHTML('beforeend', rcoFamilyCardMarkup({}));
  };
  function rcoFamilyCardMarkup(fm){
    return '<div class="rco-family-card"><button type="button" class="rb-delete-btn" style="position:absolute;top:8px;right:8px" onclick="this.closest(\'.rco-family-card\').remove()">×</button>'
      + '<div class="rco-grid">'
      + '<label class="rco-field"><span>Member Name *</span><input name="fm_name" required value="'+esc(fm.name||'')+'"></label>'
      + '<label class="rco-field"><span>Mobile No *</span><input name="fm_mobile" type="tel" required value="'+esc(fm.mobile||'')+'"></label>'
      + '<label class="rco-field"><span>Relationship *</span><select name="fm_rel" required>'+opts(['Spouse','Son','Daughter','Father','Mother','Guardian'], fm.relationship||'Spouse')+'</select></label>'
      + '<label class="rco-field"><span>Gender</span><select name="fm_gender">'+opts(['FEMALE','MALE','OTHER'], fm.gender||'FEMALE')+'</select></label>'
      + '<label class="rco-field"><span>Occupation *</span><input name="fm_occ" required value="'+esc(fm.occupation||'Homemaker')+'"></label>'
      + '<label class="rco-field"><span>Marital Status *</span><select name="fm_marital" required>'+opts(['MARRIED','UNMARRIED','DIVORCED','WIDOWED'], fm.maritalStatus||'MARRIED')+'</select></label>'
      + '<label class="rco-field"><span>Date of Birth</span><input name="fm_dob" type="date" value="'+esc(fm.dob||'')+'"></label>'
      + '<label class="rco-field"><span>Anniversary Date</span><input name="fm_anniv" type="date" value="'+esc(fm.anniversary||'')+'"></label>'
      + '<label class="rco-field"><span>Blood Group</span><select name="fm_blood">'+opts(['','O+','O-','A+','A-','B+','B-','AB+','AB-','Unknown'], fm.bloodGroup||'')+'</select></label>'
      + '<label class="rco-field"><span>Religion</span><select name="fm_relig">'+opts(['','HINDU','MUSLIM','CHRISTIAN'], fm.religion||'')+'</select></label>'
      + '<label class="rco-field"><span>Email Id</span><input name="fm_email" type="email" value="'+esc(fm.email||'')+'"></label>'
      + '<label class="rco-field"><span style="margin-top:20px"><input name="fm_nominee" type="checkbox" '+(fm.nominee?'checked':'')+'> Nominee</span></label>'
      + '</div></div>';
  }

  window.rcoSaveRetailCustomer = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(), phone = f.phone.value.trim();
    if(!name) return say('Customer Name is required.');
    const allowDup = f.allowMobileDuplicate?.checked;
    if(!allowDup && phone && db.customers.some(c=>c.id!==rcoCustEditId && String(c.phone||c.mobile||'')===phone)){
      return say('Mobile number already registered. Tick "Is Allow Mobile Duplicate" if intentional.');
    }
    if(f.bankAccNo.value && f.bankAccNo.value !== f.bankAccConfirm.value){
      return say('Bank Account Numbers do not match.');
    }
    const family = [];
    f.querySelectorAll('.rco-family-card').forEach(card => {
      const mName = card.querySelector('[name="fm_name"]')?.value?.trim();
      if(mName) family.push({
        nominee: !!card.querySelector('[name="fm_nominee"]')?.checked,
        name: mName, mobile: card.querySelector('[name="fm_mobile"]')?.value||'',
        gender: card.querySelector('[name="fm_gender"]')?.value||'', religion: card.querySelector('[name="fm_relig"]')?.value||'',
        relationship: card.querySelector('[name="fm_rel"]')?.value||'', occupation: card.querySelector('[name="fm_occ"]')?.value||'',
        dob: card.querySelector('[name="fm_dob"]')?.value||'', anniversary: card.querySelector('[name="fm_anniv"]')?.value||'',
        bloodGroup: card.querySelector('[name="fm_blood"]')?.value||'', email: card.querySelector('[name="fm_email"]')?.value||'',
        maritalStatus: card.querySelector('[name="fm_marital"]')?.value||'MARRIED'
      });
    });
    const old = rcoCustEditId ? db.customers.find(c=>c.id===rcoCustEditId) : null;
    const row = Object.assign({}, old || {}, {
      id: old?.id || crypto.randomUUID(),
      customerNo: f.customerNo.value.trim() || old?.customerNo || ('C-' + Date.now().toString().slice(-5)),
      salutation: f.salutation.value, name, printName: f.printName.value.trim() || name,
      doorNo: f.doorNo.value.trim(), address: f.address.value.trim(), city: f.city.value.trim(), area: f.area.value.trim(),
      pinCode: f.pinCode.value.trim(), district: f.district.value.trim(), state: f.state.value,
      phone, mobile: phone, alternatePhone: f.alternatePhone.value.trim(), whatsapp: f.whatsapp.value.trim(), email: f.email.value.trim(),
      team: f.team.value, relationType: f.relationType.value, relationName: f.relationName.value.trim(),
      allowMobileDuplicate: !!allowDup, isDnd: !!f.isDnd?.checked, isAddressVerified: !!f.isAddressVerified?.checked, isEnableLogin: !!f.isEnableLogin?.checked,
      dob: f.dob.value, gender: f.gender.value, bloodGroup: f.bloodGroup.value, anniversary: f.anniversary.value,
      customerGroup: f.customerGroup.value.trim(), businessType: f.businessType.value, religion: f.religion.value, tcsTds: f.tcsTds.value, ornamentsType: f.ornamentsType.value,
      contactPerson: f.contactPerson.value.trim(), stdCode: f.stdCode.value.trim(), landline: f.landline.value.trim(),
      aadhaar: f.aadhaar.value.trim(), gstRegType: f.gstRegType.value, gst: f.gst.value.trim().toUpperCase(), pan: f.pan.value.trim().toUpperCase(), udyam: f.udyam.value.trim(),
      excelRef: f.excelRef.value.trim(), whatsappGroup: f.whatsappGroup.value.trim(), segment: f.segment.value.trim(),
      profession: f.profession.value.trim(), vehicleType: f.vehicleType.value.trim(), customerBase: f.customerBase.value.trim(),
      influenceBy: f.influenceBy.value.trim(), assignedBy: f.assignedBy.value.trim(), referrer: f.referrer.value, remarks: f.remarks.value.trim(),
      opening: n(f.opening.value),
      bankName: f.bankName.value.trim(), bankAccNo: f.bankAccNo.value.trim(), bankBranch: f.bankBranch.value.trim(), ifsc: f.ifsc.value.trim().toUpperCase(), bankHolder: f.bankHolder.value.trim(),
      family,
      updatedAt: new Date().toISOString(), createdAt: old?.createdAt || new Date().toISOString()
    });
    const idx = db.customers.findIndex(c=>c.id===row.id);
    if(idx<0) db.customers.push(row); else db.customers[idx] = row;
    save(); pushCloud();
    rcoCustShowForm = false; rcoCustEditId = '';
    say('Customer profile saved.'); render();
  };

  function rcoRetailCustomerView(){
    if(rcoCustViewId){
      const c = (db.customers||[]).find(x=>x.id===rcoCustViewId);
      if(!c) { rcoCustViewId = ''; }
      else {
        const cTabs = ['Details','Transactions','Chit Mappings','Similar Address','Call Logs','Visitors','Recent Transactions','Feedback','History'];
        const chits = docs('retail-chit-mapping').filter(m=>m.customerId===c.id);
        const calls = docs('crm-call-log').filter(l=>l.targetId===c.id || (c.phone && l.mobile===c.phone));
        const vis = docs('crm-visitor').filter(v=>c.phone && v.mobile===c.phone);
        const fbs = docs('crm-feedback').filter(f=>f.customerId===c.id || (c.phone && f.mobile===c.phone));
        const similar = (db.customers||[]).filter(o=>o.id!==c.id && ((c.address && o.address===c.address) || (c.city && o.city===c.city && c.pinCode && o.pinCode===c.pinCode)));
        const txs = typeof tx==='function' ? tx(c.id,'customer') : [];
        let tabContent = '';
        if(rcoCustViewTab==='Details'){
          tabContent = '<div class="rco-grid-2">'
            + '<section class="rco-section-card"><h3>Customer Information</h3><p><b>Customer No:</b> '+esc(c.customerNo||'—')+'</p><p><b>Name:</b> '+esc((c.salutation?c.salutation+' ':'')+c.name)+'</p><p><b>Mobile:</b> '+esc(c.phone||'—')+' | <b>WhatsApp:</b> '+esc(c.whatsapp||'—')+'</p><p><b>Email:</b> '+esc(c.email||'—')+'</p><p><b>Team:</b> '+esc(c.team||'—')+'</p><p><b>DOB / Anniversary:</b> '+esc(c.dob||'—')+' / '+esc(c.anniversary||'—')+'</p></section>'
            + '<section class="rco-section-card"><h3>Address & KYC</h3><p><b>Address:</b> '+esc([c.doorNo,c.address,c.area,c.city,c.district,c.state,c.pinCode].filter(Boolean).join(', ')||'—')+'</p><p><b>Aadhaar:</b> '+esc(c.aadhaar||'—')+'</p><p><b>PAN / GST:</b> '+esc(c.pan||'—')+' / '+esc(c.gst||'—')+'</p><p><b>Segment / Group:</b> '+esc(c.segment||'—')+' / '+esc(c.customerGroup||'—')+'</p></section>'
            + '<section class="rco-section-card"><h3>Bank Details</h3><p><b>Bank:</b> '+esc(c.bankName||'—')+' ('+esc(c.bankBranch||'—')+')</p><p><b>Account No:</b> '+esc(c.bankAccNo||'—')+'</p><p><b>IFSC:</b> '+esc(c.ifsc||'—')+'</p><p><b>Holder:</b> '+esc(c.bankHolder||'—')+'</p></section>'
            + '<section class="rco-section-card"><h3>Family Members ('+(c.family?.length||0)+')</h3>'+((c.family||[]).length?(c.family.map(fm=>'<p><b>'+esc(fm.name)+'</b> ('+esc(fm.relationship)+') · '+esc(fm.mobile)+(fm.nominee?' · <span class="pill">Nominee</span>':'')+'</p>').join('')):'<p class="muted">No family members added.</p>')+'</section>'
            + '</div>';
        }
        else if(rcoCustViewTab==='Transactions'||rcoCustViewTab==='Recent Transactions') tabContent = '<section class="panel">'+(txs.length?table(['Date','Type','Details','Amount'], txs.map(r=>[esc(String(r.when||r.date||'').slice(0,16)), esc(r.type), esc(r.product||r.desc||'—'), rateMoney(r.amount)])):'<p class="empty">No transactions found.</p>')+'</section>';
        else if(rcoCustViewTab==='Chit Mappings') tabContent = '<section class="panel">'+(chits.length?table(['Chit #','Group','Type','Instalment','Status'], chits.map(m=>[esc(m.chitNumber), esc(m.groupName||'—'), esc(m.schemeName||'—'), rateMoney(m.instalmentAmount), esc(m.status||'Active')])):'<p class="empty">No chit mappings.</p>')+'</section>';
        else if(rcoCustViewTab==='Similar Address') tabContent = '<section class="panel">'+(similar.length?table(['Name','Mobile','Address','City'], similar.map(s=>[esc(s.name), esc(s.phone||'—'), esc(s.address||'—'), esc(s.city||'—')])):'<p class="empty">No customers with similar address.</p>')+'</section>';
        else if(rcoCustViewTab==='Call Logs') tabContent = '<section class="panel"><div class="right" style="margin-bottom:8px"><button type="button" class="primary" onclick="rcoOpenCallModal(\''+esc(c.name)+'\',\''+esc(c.phone||'')+'\',\'Customers\',\''+esc(c.id)+'\')">＋ Log Call</button></div>'+(calls.length?table(['Date','Type','Response','Follow-up','Notes'], calls.map(l=>[esc(l.callDate), esc(l.callType), esc(l.callResponse), esc(l.followupDate||'—'), esc(l.notes||'—')])):'<p class="empty">No call logs.</p>')+'</section>';
        else if(rcoCustViewTab==='Visitors') tabContent = '<section class="panel">'+(vis.length?table(['Visit Date','Attend By','Status','Feedback'], vis.map(v=>[esc(v.visitDate), esc(v.attendBy||'—'), esc(v.visitStatus), esc(v.feedback||'—')])):'<p class="empty">No visitor records.</p>')+'</section>';
        else if(rcoCustViewTab==='Feedback') tabContent = '<section class="panel">'+(fbs.length?table(['Date','Campaign','Source','Response','Comments'], fbs.map(f=>[esc(f.sentOn), esc(f.campaign), esc(f.source), esc(f.response), esc(f.description||'—')])):'<p class="empty">No feedback.</p>')+'</section>';
        else tabContent = '<section class="panel"><p><b>Created:</b> '+esc(c.createdAt||'—')+'</p><p><b>Last Updated:</b> '+esc(c.updatedAt||'—')+'</p></section>';

        return header('Customer 360° · ' + c.name, '<button type="button" onclick="rcoCustEditId=\''+esc(c.id)+'\';rcoCustShowForm=true;rcoCustViewId=\'\';render()">Edit</button> <button type="button" onclick="rcoOpenCallModal(\''+esc(c.name)+'\',\''+esc(c.phone||'')+'\',\'Customers\',\''+esc(c.id)+'\')">📞 Call</button> <button type="button" onclick="rcoCustViewId=\'\';render()">← Back</button>')
          + '<div class="rco-tabs">'+cTabs.map(t=>'<button type="button" class="'+(rcoCustViewTab===t?'active':'')+'" onclick="rcoCustViewTab=\''+t+'\';render()">'+esc(t)+'</button>').join('')+'</div>'
          + tabContent;
      }
    }

    if(rcoCustShowForm){
      const c = rcoCustEditId ? (db.customers||[]).find(x=>x.id===rcoCustEditId) : null;
      return header(c ? 'Edit Customer · ' + c.name : 'Add Retail Customer', '<button type="button" onclick="rcoCustShowForm=false;rcoCustEditId=\'\';render()">← Back</button>')
        + '<form onsubmit="rcoSaveRetailCustomer(event)">'
        + '<section class="rco-section-card"><h3>1. Customer Information</h3><div class="rco-grid">'
        + '<label class="rco-field"><span>Salutation</span><select name="salutation">'+opts(['MR.','MRS.','Ms'], c?.salutation||'MR.')+'</select></label>'
        + '<label class="rco-field"><span>Customer Name *</span><input name="name" required value="'+esc(c?.name||'')+'"></label>'
        + '<label class="rco-field"><span>Print Name</span><input name="printName" value="'+esc(c?.printName||'')+'"></label>'
        + '<label class="rco-field"><span>Customer Number</span><input name="customerNo" value="'+esc(c?.customerNo||'')+'" placeholder="Auto if blank"></label>'
        + '<label class="rco-field"><span>Mobile Number</span><input name="phone" type="tel" value="'+esc(c?.phone||c?.mobile||'')+'"></label>'
        + '<label class="rco-field"><span>Alternate Number</span><input name="alternatePhone" type="tel" value="'+esc(c?.alternatePhone||'')+'"></label>'
        + '<label class="rco-field"><span>WhatsApp</span><input name="whatsapp" type="tel" value="'+esc(c?.whatsapp||'')+'"></label>'
        + '<label class="rco-field"><span>Email ID</span><input name="email" type="email" value="'+esc(c?.email||'')+'"></label>'
        + '<label class="rco-field"><span>Door No</span><input name="doorNo" value="'+esc(c?.doorNo||'')+'"></label>'
        + '<label class="rco-field"><span>Address / Street Name</span><input name="address" value="'+esc(c?.address||'')+'"></label>'
        + '<label class="rco-field"><span>Type / Area</span><input name="area" value="'+esc(c?.area||'')+'"></label>'
        + '<label class="rco-field"><span>City</span><input name="city" value="'+esc(c?.city||'')+'"></label>'
        + '<label class="rco-field"><span>Pin Code</span><input name="pinCode" value="'+esc(c?.pinCode||'')+'"></label>'
        + '<label class="rco-field"><span>District</span><input name="district" value="'+esc(c?.district||'')+'"></label>'
        + '<label class="rco-field"><span>State</span><select name="state">'+opts(RCO_STATES, c?.state||'TAMIL NADU')+'</select></label>'
        + '<label class="rco-field"><span>Team *</span><select name="team" required>'+opts(['AK','Arjeeth','SSJ','SSN','VKL'], c?.team||'AK')+'</select></label>'
        + '<label class="rco-field"><span>Relation Type</span><select name="relationType">'+opts(['','Daughter','Father','Guardian','Mother','Son','Spouse'], c?.relationType||'')+'</select></label>'
        + '<label class="rco-field"><span>Relation Name</span><input name="relationName" value="'+esc(c?.relationName||'')+'"></label>'
        + '<label class="rco-field"><span>Date of Birth</span><input name="dob" type="date" value="'+esc(c?.dob||'')+'"></label>'
        + '<label class="rco-field"><span>Gender</span><select name="gender">'+opts(['Female','Male','Others'], c?.gender||'Female')+'</select></label>'
        + '<label class="rco-field"><span>Blood Group</span><select name="bloodGroup">'+opts(['','O+','O-','A+','A-','B+','B-','AB+','AB-','Unknown'], c?.bloodGroup||'')+'</select></label>'
        + '<label class="rco-field"><span>Anniversary Date</span><input name="anniversary" type="date" value="'+esc(c?.anniversary||'')+'"></label>'
        + '<label class="rco-field"><span>Customer Groups</span><input name="customerGroup" value="'+esc(c?.customerGroup||'')+'"></label>'
        + '<label class="rco-field"><span>Business Type</span><select name="businessType">'+opts(['','LARGE','MEDIUM','SMALL'], c?.businessType||'')+'</select></label>'
        + '<label class="rco-field"><span>Religion Type</span><select name="religion">'+opts(['','HINDU','MUSLIM','CHRISTIAN'], c?.religion||'')+'</select></label>'
        + '<label class="rco-field"><span>TCS / TDS</span><select name="tcsTds">'+opts(['','TCS @ 0.01%'], c?.tcsTds||'')+'</select></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentsType">'+opts(['-- None --','GOLD','SILVER'], c?.ornamentsType||'-- None --')+'</select></label>'
        + '<label class="rco-field"><span>Contact Person Name</span><input name="contactPerson" value="'+esc(c?.contactPerson||'')+'"></label>'
        + '<label class="rco-field"><span>STD Code</span><input name="stdCode" value="'+esc(c?.stdCode||'')+'"></label>'
        + '<label class="rco-field"><span>LandLine Number</span><input name="landline" value="'+esc(c?.landline||'')+'"></label>'
        + '<label class="rco-field"><span>Aadhaar Number</span><input name="aadhaar" value="'+esc(c?.aadhaar||'')+'"></label>'
        + '<label class="rco-field"><span>GST Registration Type</span><select name="gstRegType">'+opts(['Un Registered','Regular'], c?.gstRegType||'Un Registered')+'</select></label>'
        + '<label class="rco-field"><span>GST No</span><input name="gst" maxlength="15" value="'+esc(c?.gst||'')+'"></label>'
        + '<label class="rco-field"><span>PAN Number</span><input name="pan" maxlength="10" value="'+esc(c?.pan||'')+'"></label>'
        + '<label class="rco-field"><span>Udyam Reg No</span><input name="udyam" value="'+esc(c?.udyam||'')+'"></label>'
        + '<label class="rco-field"><span>Excel Sheet Reference</span><input name="excelRef" value="'+esc(c?.excelRef||'')+'"></label>'
        + '<label class="rco-field"><span>WhatsApp Group</span><input name="whatsappGroup" value="'+esc(c?.whatsappGroup||'')+'"></label>'
        + '<label class="rco-field"><span>Customer Segment</span><input name="segment" value="'+esc(c?.segment||'')+'"></label>'
        + '<label class="rco-field"><span>Profession Type</span><input name="profession" value="'+esc(c?.profession||'')+'"></label>'
        + '<label class="rco-field"><span>Vehicle Type</span><input name="vehicleType" value="'+esc(c?.vehicleType||'')+'"></label>'
        + '<label class="rco-field"><span>Customer Base</span><input name="customerBase" value="'+esc(c?.customerBase||'')+'"></label>'
        + '<label class="rco-field"><span>Influence By</span><input name="influenceBy" value="'+esc(c?.influenceBy||'')+'"></label>'
        + '<label class="rco-field"><span>Assigned By</span><input name="assignedBy" value="'+esc(c?.assignedBy||'')+'"></label>'
        + '<label class="rco-field"><span>Referrer</span><select name="referrer">'+opts(['','Customer','Employee'], c?.referrer||'')+'</select></label>'
        + '<label class="rco-field"><span>Opening Balance ₹</span><input name="opening" type="number" step=".01" value="'+(c?.opening||0)+'"></label>'
        + '<label class="rco-field wide"><span>Remarks</span><textarea name="remarks" rows="2">'+esc(c?.remarks||'')+'</textarea></label>'
        + '<div class="rco-field wide"><div class="rco-check-row">'
        + '<label><input name="allowMobileDuplicate" type="checkbox" '+(c?.allowMobileDuplicate?'checked':'')+'> Is Allow Mobile Duplicate</label>'
        + '<label><input name="isDnd" type="checkbox" '+(c?.isDnd?'checked':'')+'> Is DND</label>'
        + '<label><input name="isAddressVerified" type="checkbox" '+(c?.isAddressVerified?'checked':'')+'> Is Address Verified</label>'
        + '<label><input name="isEnableLogin" type="checkbox" '+(c?.isEnableLogin?'checked':'')+'> Is Enable Login</label>'
        + '</div></div></div></section>'

        + '<section class="rco-section-card"><h3>2. Bank Details</h3><div class="rco-grid-3">'
        + '<label class="rco-field"><span>Bank Name</span><input name="bankName" value="'+esc(c?.bankName||'')+'"></label>'
        + '<label class="rco-field"><span>Bank Account Number</span><input name="bankAccNo" value="'+esc(c?.bankAccNo||'')+'"></label>'
        + '<label class="rco-field"><span>Re-Enter Bank Account No</span><input name="bankAccConfirm" value="'+esc(c?.bankAccNo||'')+'"></label>'
        + '<label class="rco-field"><span>Bank Branch Name</span><input name="bankBranch" value="'+esc(c?.bankBranch||'')+'"></label>'
        + '<label class="rco-field"><span>IFSC Code</span><input name="ifsc" value="'+esc(c?.ifsc||'')+'"></label>'
        + '<label class="rco-field"><span>Account Holder Name</span><input name="bankHolder" value="'+esc(c?.bankHolder||'')+'"></label>'
        + '</div></section>'

        + '<section class="rco-section-card"><h3>3. Family Details <button type="button" onclick="rcoAddFamilyRow()">＋ Add Family Member</button></h3>'
        + '<div id="rcoFamilyList">'+(c?.family||[]).map(rcoFamilyCardMarkup).join('')+'</div></section>'
        + '<div class="right"><button type="submit" class="primary" style="min-width:160px;font-weight:750">Save Customer</button></div></form>';
    }

    const list = (db.customers||[]).filter(c => {
      const q = rcoCustSearch.trim().toLowerCase();
      if(q && !(String(c.name||'').toLowerCase().includes(q) || String(c.phone||c.mobile||'').includes(q) || String(c.customerNo||'').toLowerCase().includes(q))) return false;
      if(rcoCustFilter.city && !String(c.city||'').toLowerCase().includes(rcoCustFilter.city.toLowerCase())) return false;
      if(rcoCustFilter.team && c.team !== rcoCustFilter.team) return false;
      if(rcoCustFilter.gender && c.gender !== rcoCustFilter.gender) return false;
      return true;
    });
    return header('Customer Register', '<button type="button" class="primary" onclick="rcoCustEditId=\'\';rcoCustShowForm=true;render()">＋ Add Customer</button>')
      + '<section class="panel"><div class="rco-toolbar"><input class="rco-search" placeholder="Search Customer Name, Mobile, Customer No..." value="'+esc(rcoCustSearch)+'" oninput="rcoCustSearch=this.value;render()"><div class="rco-toolbar-right"><button type="button" onclick="rcoCustFilterOpen=!rcoCustFilterOpen;render()">🔍 Filter</button></div></div>'
      + (rcoCustFilterOpen ? '<div class="rco-filter-box"><label class="rco-field"><span>City</span><input value="'+esc(rcoCustFilter.city)+'" oninput="rcoCustFilter.city=this.value;render()"></label><label class="rco-field"><span>Team</span><select onchange="rcoCustFilter.team=this.value;render()">'+opts(['','AK','Arjeeth','SSJ','SSN','VKL'], rcoCustFilter.team)+'</select></label><label class="rco-field"><span>Gender</span><select onchange="rcoCustFilter.gender=this.value;render()">'+opts(['','Female','Male','Others'], rcoCustFilter.gender)+'</select></label></div>' : '')
      + (list.length ? table(['Customer No','Name','Mobile','City','Team','Segment','Actions'], list.map(c=>[esc(c.customerNo||'—'), '<b>'+esc(c.name)+'</b>', esc(c.phone||c.mobile||'—'), esc(c.city||'—'), esc(c.team||'—'), esc(c.segment||'—'), '<button type="button" onclick="rcoCustEditId=\''+esc(c.id)+'\';rcoCustShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rcoCustViewId=\''+esc(c.id)+'\';rcoCustViewTab=\'Details\';render()">View</button> <button type="button" onclick="rcoOpenCallModal(\''+esc(c.name)+'\',\''+esc(c.phone||'')+'\',\'Customers\',\''+esc(c.id)+'\')">📞 Call</button>'])) : '<p class="empty">No customers yet.</p>')
      + '</section>';
  }

  // ======================== 4. RETAIL SUPPLIER REGISTRATION & VIEW ========================
  window.rcoSaveRetailSupplier = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(), city = f.city.value.trim();
    if(!name || !city) return say('Supplier Name and City are required.');
    const phone = f.phone.value.trim();
    if(!f.allowMobileDuplicate?.checked && phone && (db.retailSuppliers||[]).some(s=>s.id!==rcoSupEditId && String(s.phone||'')===phone)){
      return say('Mobile number already exists for another supplier.');
    }
    const old = rcoSupEditId ? (db.retailSuppliers||[]).find(s=>s.id===rcoSupEditId) : null;
    const row = Object.assign({}, old || {}, {
      id: old?.id || crypto.randomUUID(),
      supplierNo: f.supplierNo.value.trim() || old?.supplierNo || ('SUP-' + Date.now().toString().slice(-5)),
      salutation: f.salutation.value, name, printName: f.printName.value.trim() || name,
      supplierCode: f.supplierCode.value.trim(), contactPerson: f.contactPerson.value.trim(),
      phone, alternatePhone: f.alternatePhone.value.trim(), whatsapp: f.whatsapp.value.trim(), email: f.email.value.trim(),
      team: f.team.value, dob: f.dob.value, anniversary: f.anniversary.value,
      businessType: f.businessType.value, tcsTds: f.tcsTds.value, ornamentsType: f.ornamentsType.value,
      stdCode: f.stdCode.value.trim(), landline: f.landline.value.trim(),
      gstRegType: f.gstRegType.value, gst: f.gst.value.trim().toUpperCase(), pan: f.pan.value.trim().toUpperCase(),
      excelRef: f.excelRef.value.trim(), whatsappGroup: f.whatsappGroup.value.trim(),
      hallmarkLicense: f.hallmarkLicense.value.trim(), creditDays: f.creditDays.value.trim(),
      allowMobileDuplicate: !!f.allowMobileDuplicate?.checked,
      address: f.address.value.trim(), city, pinCode: f.pinCode.value.trim(), district: f.district.value.trim(), state: f.state.value, remarks: f.remarks.value.trim(),
      openingAmount: n(f.openingAmount.value), openingGold: n(f.openingGold.value), openingSilver: n(f.openingSilver.value),
      updatedAt: new Date().toISOString(), createdAt: old?.createdAt || new Date().toISOString()
    });
    if(!Array.isArray(db.retailSuppliers)) db.retailSuppliers = [];
    const idx = db.retailSuppliers.findIndex(s=>s.id===row.id);
    if(idx<0) db.retailSuppliers.push(row); else db.retailSuppliers[idx] = row;
    save(); pushCloud();
    rcoSupShowForm = false; rcoSupEditId = '';
    say('Supplier saved.'); render();
  };

  function rcoRetailSupplierView(){
    if(rcoSupViewId){
      const s = (db.retailSuppliers||[]).find(x=>x.id===rcoSupViewId);
      if(!s) { rcoSupViewId = ''; }
      else {
        return header('Supplier · ' + s.name, '<button type="button" onclick="rcoSupEditId=\''+esc(s.id)+'\';rcoSupShowForm=true;rcoSupViewId=\'\';render()">Edit</button> <button type="button" onclick="rcoSupViewId=\'\';render()">← Back</button>')
          + '<div class="rco-tabs"><button type="button" class="'+(rcoSupViewTab==='Details'?'active':'')+'" onclick="rcoSupViewTab=\'Details\';render()">Details</button><button type="button" class="'+(rcoSupViewTab==='History'?'active':'')+'" onclick="rcoSupViewTab=\'History\';render()">History</button></div>'
          + (rcoSupViewTab==='History'
            ? '<section class="panel"><p><b>Created On:</b> '+esc(s.createdAt||'—')+'</p><p><b>Updated On:</b> '+esc(s.updatedAt||'—')+'</p></section>'
            : '<div class="rco-grid-2">'
              + '<section class="rco-section-card"><h3>Supplier Information</h3><p><b>Supplier No:</b> '+esc(s.supplierNo||'—')+'</p><p><b>Name:</b> '+esc(s.name)+'</p><p><b>Code:</b> '+esc(s.supplierCode||'—')+'</p><p><b>Hallmark License No:</b> '+esc(s.hallmarkLicense||'—')+'</p><p><b>Mobile:</b> '+esc(s.phone||'—')+' | <b>WhatsApp:</b> '+esc(s.whatsapp||'—')+'</p><p><b>Ornaments Type:</b> '+esc(s.ornamentsType||'—')+'</p><p><b>GST / PAN:</b> '+esc(s.gst||'—')+' / '+esc(s.pan||'—')+'</p><p><b>Credit Days:</b> '+esc(s.creditDays||'—')+'</p></section>'
              + '<section class="rco-section-card"><h3>Address & Opening Balances</h3><p><b>Address:</b> '+esc([s.address,s.city,s.district,s.state,s.pinCode].filter(Boolean).join(', '))+'</p><p><b>Opening Amount:</b> '+rateMoney(s.openingAmount)+'</p><p><b>Opening Gold / Silver:</b> '+fmt(s.openingGold)+' g / '+fmt(s.openingSilver)+' g</p><p><b>Remarks:</b> '+esc(s.remarks||'—')+'</p></section>'
              + '</div>');
      }
    }

    if(rcoSupShowForm){
      const s = rcoSupEditId ? (db.retailSuppliers||[]).find(x=>x.id===rcoSupEditId) : null;
      return header(s ? 'Edit Supplier · ' + s.name : 'New Supplier Registration', '<button type="button" onclick="rcoSupShowForm=false;rcoSupEditId=\'\';render()">← Back</button>')
        + '<form onsubmit="rcoSaveRetailSupplier(event)">'
        + '<section class="rco-section-card"><h3>1. Supplier Information</h3><div class="rco-grid">'
        + '<label class="rco-field"><span>Salutation</span><select name="salutation">'+opts(['MR.','MRS.','Ms','M/S'], s?.salutation||'M/S')+'</select></label>'
        + '<label class="rco-field"><span>Supplier Name *</span><input name="name" required value="'+esc(s?.name||'')+'"></label>'
        + '<label class="rco-field"><span>Print Name</span><input name="printName" value="'+esc(s?.printName||'')+'"></label>'
        + '<label class="rco-field"><span>Supplier Code</span><input name="supplierCode" value="'+esc(s?.supplierCode||'')+'"></label>'
        + '<label class="rco-field"><span>Supplier Number</span><input name="supplierNo" value="'+esc(s?.supplierNo||'')+'" placeholder="Auto if blank"></label>'
        + '<label class="rco-field"><span>Contact Person Name</span><input name="contactPerson" value="'+esc(s?.contactPerson||'')+'"></label>'
        + '<label class="rco-field"><span>Mobile Number</span><input name="phone" type="tel" value="'+esc(s?.phone||'')+'"></label>'
        + '<label class="rco-field"><span>Alternate Number</span><input name="alternatePhone" type="tel" value="'+esc(s?.alternatePhone||'')+'"></label>'
        + '<label class="rco-field"><span>WhatsApp</span><input name="whatsapp" type="tel" value="'+esc(s?.whatsapp||'')+'"></label>'
        + '<label class="rco-field"><span>Email ID</span><input name="email" type="email" value="'+esc(s?.email||'')+'"></label>'
        + '<label class="rco-field"><span>Team *</span><select name="team" required>'+opts(['AK','Arjeeth','SSJ','SSN','VKL'], s?.team||'AK')+'</select></label>'
        + '<label class="rco-field"><span>Date of Birth</span><input name="dob" type="date" value="'+esc(s?.dob||'')+'"></label>'
        + '<label class="rco-field"><span>Anniversary Date</span><input name="anniversary" type="date" value="'+esc(s?.anniversary||'')+'"></label>'
        + '<label class="rco-field"><span>Business Type</span><select name="businessType">'+opts(['','LARGE','MEDIUM','SMALL'], s?.businessType||'')+'</select></label>'
        + '<label class="rco-field"><span>TCS / TDS</span><select name="tcsTds">'+opts(['','TCS @ 0.01%'], s?.tcsTds||'')+'</select></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentsType">'+opts(['-- None --','GOLD','SILVER','ALLOY','DIAMOND','STONE','PLATINUM','GIFT ITEM'], s?.ornamentsType||'-- None --')+'</select></label>'
        + '<label class="rco-field"><span>STD Code</span><input name="stdCode" value="'+esc(s?.stdCode||'')+'"></label>'
        + '<label class="rco-field"><span>LandLine Number</span><input name="landline" value="'+esc(s?.landline||'')+'"></label>'
        + '<label class="rco-field"><span>GST Registration Type</span><select name="gstRegType">'+opts(['Regular','Un Registered'], s?.gstRegType||'Regular')+'</select></label>'
        + '<label class="rco-field"><span>GST No</span><input name="gst" maxlength="15" value="'+esc(s?.gst||'')+'"></label>'
        + '<label class="rco-field"><span>PAN Number</span><input name="pan" maxlength="10" value="'+esc(s?.pan||'')+'"></label>'
        + '<label class="rco-field"><span>Hallmark License No</span><input name="hallmarkLicense" value="'+esc(s?.hallmarkLicense||'')+'"></label>'
        + '<label class="rco-field"><span>Credit Days</span><input name="creditDays" type="number" value="'+esc(s?.creditDays||'')+'"></label>'
        + '<label class="rco-field"><span>Excel Sheet Reference</span><input name="excelRef" value="'+esc(s?.excelRef||'')+'"></label>'
        + '<label class="rco-field"><span>WhatsApp Group</span><input name="whatsappGroup" value="'+esc(s?.whatsappGroup||'')+'"></label>'
        + '<label class="rco-field"><span>Opening Amount ₹</span><input name="openingAmount" type="number" step=".01" value="'+(s?.openingAmount||0)+'"></label>'
        + '<label class="rco-field"><span>Opening Gold g</span><input name="openingGold" type="number" step=".001" value="'+(s?.openingGold||0)+'"></label>'
        + '<label class="rco-field"><span>Opening Silver g</span><input name="openingSilver" type="number" step=".001" value="'+(s?.openingSilver||0)+'"></label>'
        + '<div class="rco-field wide"><div class="rco-check-row"><label><input name="allowMobileDuplicate" type="checkbox" '+(s?.allowMobileDuplicate?'checked':'')+'> Is Allow Mobile Duplicate</label></div></div>'
        + '</div></section>'
        + '<section class="rco-section-card"><h3>2. Address Information</h3><div class="rco-grid">'
        + '<label class="rco-field wide"><span>Address</span><input name="address" value="'+esc(s?.address||'')+'"></label>'
        + '<label class="rco-field"><span>City *</span><input name="city" required value="'+esc(s?.city||'')+'"></label>'
        + '<label class="rco-field"><span>Pin Code</span><input name="pinCode" value="'+esc(s?.pinCode||'')+'"></label>'
        + '<label class="rco-field"><span>District</span><input name="district" value="'+esc(s?.district||'')+'"></label>'
        + '<label class="rco-field"><span>State</span><select name="state">'+opts(RCO_STATES, s?.state||'TAMIL NADU')+'</select></label>'
        + '<label class="rco-field wide"><span>Remarks</span><textarea name="remarks" rows="2">'+esc(s?.remarks||'')+'</textarea></label>'
        + '</div></section>'
        + '<div class="right"><button type="submit" class="primary" style="min-width:160px;font-weight:750">Save Supplier</button></div></form>';
    }

    const list = (db.retailSuppliers||[]).filter(s => {
      const q = rcoSupSearch.trim().toLowerCase();
      if(q && !(String(s.name||'').toLowerCase().includes(q) || String(s.phone||'').includes(q) || String(s.supplierCode||'').toLowerCase().includes(q))) return false;
      if(rcoSupFilter.ornament && s.ornamentsType !== rcoSupFilter.ornament) return false;
      if(rcoSupFilter.businessType && s.businessType !== rcoSupFilter.businessType) return false;
      if(rcoSupFilter.city && !String(s.city||'').toLowerCase().includes(rcoSupFilter.city.toLowerCase())) return false;
      return true;
    });
    return header('Retail Suppliers', '<button type="button" class="primary" onclick="rcoSupEditId=\'\';rcoSupShowForm=true;render()">＋ New Supplier</button>')
      + '<section class="panel"><div class="rco-toolbar"><input class="rco-search" placeholder="Search Supplier Name, Code, Mobile..." value="'+esc(rcoSupSearch)+'" oninput="rcoSupSearch=this.value;render()"><div class="rco-toolbar-right"><button type="button" onclick="rcoSupFilterOpen=!rcoSupFilterOpen;render()">🔍 Filter</button></div></div>'
      + (rcoSupFilterOpen ? '<div class="rco-filter-box"><label class="rco-field"><span>Ornaments Type</span><select onchange="rcoSupFilter.ornament=this.value;render()">'+opts(['','GOLD','SILVER','ALLOY','DIAMOND','STONE','PLATINUM','GIFT ITEM'], rcoSupFilter.ornament)+'</select></label><label class="rco-field"><span>Business Type</span><select onchange="rcoSupFilter.businessType=this.value;render()">'+opts(['','LARGE','MEDIUM','SMALL'], rcoSupFilter.businessType)+'</select></label><label class="rco-field"><span>City</span><input value="'+esc(rcoSupFilter.city)+'" oninput="rcoSupFilter.city=this.value;render()"></label></div>' : '')
      + (list.length ? table(['Supplier No','Supplier Name','Hallmark Lic','Code','Mobile','Ornaments','City','Actions'], list.map(s=>[esc(s.supplierNo||'—'), '<b>'+esc(s.name)+'</b>', esc(s.hallmarkLicense||'—'), esc(s.supplierCode||'—'), esc(s.phone||'—'), esc(s.ornamentsType||'—'), esc(s.city||'—'), '<button type="button" onclick="rcoSupEditId=\''+esc(s.id)+'\';rcoSupShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rcoSupViewId=\''+esc(s.id)+'\';rcoSupViewTab=\'Details\';render()">View</button>'])) : '<p class="empty">No retail suppliers yet.</p>')
      + '</section>';
  }

  window.rcoOrderTrackingView = rcoOrderTrackingView;
  window.rcoCrmView = rcoCrmView;
  window.rcoRetailSupplierView = rcoRetailSupplierView;
  window.rcoRetailCustomerView = rcoRetailCustomerView;

  // ======================== NAVIGATION & RENDER HOOK ========================
  window.rcoOpenPage = (p) => {
    if(!session||!goldleafContext?.has_access){ say('Please sign in first.'); return; }
    if(typeof window.rbCanLeave==='function' && !window.rbCanLeave()) return;
    if(typeof window.go === 'function') window.go(p);
    window.scrollTo?.(0,0);
  };

  function rcoNavigation(){
    const nav = document.getElementById('nav'); if(!nav) return;
    nav.querySelectorAll('[data-rco-sidebar]').forEach(b=>b.remove());
    const more = document.getElementById('moreMenu');
    if(more) more.querySelectorAll('[data-rco-nav]').forEach(b=>b.remove());
    if(!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;
    const anchor = nav.querySelector('[data-rc-sidebar="Estimation / Quotation"]') || nav.querySelector('button[aria-label*="Sales"]') || nav.firstElementChild;
    const frag = document.createDocumentFragment();
    for(const [label, icon] of [['Order Tracking','plans'],['CRM','customers'],['Suppliers','parties']]){
      const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.rcoSidebar = label;
      btn.setAttribute('aria-label', label); btn.title = label;
      btn.classList.toggle('active', page === label);
      if(page === label) btn.setAttribute('aria-current', 'page');
      btn.onclick = () => rcoOpenPage(label);
      btn.innerHTML = '<span class="nav-icon">'+erpIcon(icon)+'</span><span class="erp-nav-label">'+esc(label)+'</span>';
      frag.append(btn);
    }
    if(anchor) anchor.after(frag); else nav.append(frag);
    if(more){
      for(const label of ['Order Tracking','CRM','Suppliers']){
        const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.rcoNav = label;
        btn.textContent = label; btn.onclick = () => { more.classList.remove('open'); rcoOpenPage(label); };
        more.append(btn);
      }
    }
    if(typeof erpFilterNavigation==='function') erpFilterNavigation(window.erpNavQuery||'');
  }

  const rcoPrevRender = window.render;
  window.render = function(){
    const res = rcoPrevRender.apply(this, arguments);
    if(session && typeof goldleafContext !== 'undefined' && goldleafContext?.has_access && workspaceMode === 'retail'){
      const appEl = document.getElementById('app');
      if(appEl){
        if(page === 'Order Tracking'){
          appEl.innerHTML = rcoOrderTrackingView();
          if(rcoOrderShowFormFlag) rcoRecalcOrder();
        } else if(page === 'CRM'){
          appEl.innerHTML = rcoCrmView();
        } else if(page === 'Suppliers'){
          appEl.innerHTML = rcoRetailSupplierView();
        } else if(page === 'Register' || page === 'Customer Register'){
          appEl.innerHTML = rcoRetailCustomerView();
        }
      }
    }
    rcoNavigation();
    return res;
  };
  render();
})();
