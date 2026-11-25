// Comprehensive Retail Reports Hub: Accounts/Books/Financial Statements, Payments/Outstanding/Advances/Expenses,
// GSTR1 (All sections, B2B, B2CL, B2CS, CR/DR, Document Summary, HSN Sales & Return Detail, JSON) & GSTR3B,
// Sales/Purchase/Profit/Target/Tray/Diamond/Visitor/Branch/Influence, Stock/Transactions/Reorder (Default/Size/Weight),
// Gift Stock/Issued/Voucher Redeem, and Jewel Loan (Date-wise, Area-wise, Hand Stock, Jewel Stock, Interest Due).
(function(){
  window.rarState = window.rarState || {
    active: '',
    search: '',
    from: '',
    to: '',
    asOf: '',
    groupBy: 'Product Group',
    layout: 'Classic',
    gstr3bView: 'Horizontal',
    bookMode: 'Detailed View',
    daybookTab: 'Transactions',
    topDim: 'Product Group',
    payLedgerView: 'Summary',
    supPayView: 'Summary',
    purRepView: 'Supplier Wise',
    metal: 'All',
    goldRate: 0,
    silverRate: 0,
    ledgerId: '',
    parentGroup: '',
    payMode: 'All',
    payDir: 'All',
    supplierId: '',
    partyType: 'All',
    outStatus: 'All',
    ageBucket: 'All',
    advType: 'All',
    billStatus: 'All',
    expView: 'Detailed',
    tbDetail: false,
    b2csView: 'Summary',
    salesGroup: 'Date',
    returnView: 'Detailed',
    spGroup: 'Date',
    topPurMode: 'Suppliers',
    targetMode: 'Month Wise',
    goldTargetG: 500,
    silverTargetG: 2000,
    trayGroup: 'Tray',
    diamondFilter: 'All',
    visitorGroup: 'Date',
    branchGroup: 'Counter',
    stockGroup: 'Product Group',
    txType: 'All',
    minReorderWt: 10,
    minReorderPcs: 2,
    weightSlabs: '0,2,5,10,20,50',
    loanScheme: 'All',
    loanRatePm: 1.5,
    hiddenCols: {}
  };

  const docs = (t) => (window.rcDocs ? window.rcDocs(t) : (db.retailDocuments||[]).filter(d=>(d.kind||d.type)===t));
  const allPurchases = () => {
    const a = docs('purchase'), b = docs('retail-purchase');
    const seen = new Set(a.map(x=>x.id));
    return [...a, ...b.filter(x=>!seen.has(x.id))];
  };
  const opts = (arr, cur) => arr.map(v=>'<option value="'+esc(v)+'" '+(String(cur||'')===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('');
  const dayOf = (dt) => String(dt||'').slice(0,10);
  const inRange = (dt) => {
    const d = dayOf(dt);
    if(rarState.from && d && d < rarState.from) return false;
    if(rarState.to && d && d > rarState.to) return false;
    return true;
  };
  const rSales = () => (db.sales||[]).filter(s=>s.accountType==='customer' && inRange(s.when||s.createdAt));
  const rReturns = () => (db.payments||[]).filter(p=>p.accountType==='customer' && p.retailKind==='return' && inRange(p.when||p.date||p.createdAt));
  const rPays = () => (db.payments||[]).filter(p=>p.accountType==='customer' && (p.retailKind||'receipt')!=='return' && inRange(p.when||p.date||p.createdAt));
  const rPurch = () => allPurchases().filter(p=>inRange(p.when||p.date||p.createdAt));
  const rOldPurch = () => docs('old-purchase').filter(p=>inRange(p.when||p.date||p.createdAt));
  const rPurchReturns = () => [...docs('purchase-return'), ...docs('old-return')].filter(p=>inRange(p.when||p.date||p.createdAt));
  const rSupPays = () => docs('payment').filter(p=>inRange(p.when||p.date||p.createdAt));

  const saleItemsOf = (s) => {
    if(typeof rbInvoiceItems === 'function') return rbInvoiceItems(s);
    if(Array.isArray(s.invoiceItems) && s.invoiceItems.length) return s.invoiceItems;
    if(Array.isArray(s.items) && s.items.length) return s.items;
    return [s];
  };
  const purchItemsOf = (p) => {
    if(Array.isArray(p.items) && p.items.length){
      return typeof rpItemCalc === 'function' ? p.items.map(it=>rpItemCalc(it, p.kind||'purchase')) : p.items;
    }
    return [p];
  };

  window.rarOpen = (name, optDim) => {
    window.tagReportActive = false;
    window.tradeReportActive = false;
    rarState.active = name;
    if(optDim) rarState.topDim = optDim;
    if(name==='DayBook Report') rarState.daybookTab='Transactions';
    if(name==='DayBook Abstract') rarState.daybookTab='Abstract';
    render();
  };
  window.rarBack = () => { rarState.active = ''; render(); };
  window.rarResetFilters = () => {
    rarState.search = '';
    rarState.from = '';
    rarState.to = '';
    rarState.metal = 'All';
    rarState.ledgerId = '';
    rarState.parentGroup = '';
    rarState.payMode = 'All';
    rarState.payDir = 'All';
    rarState.supplierId = '';
    rarState.partyType = 'All';
    rarState.outStatus = 'All';
    rarState.ageBucket = 'All';
    rarState.advType = 'All';
    rarState.billStatus = 'All';
    rarState.txType = 'All';
    rarState.loanScheme = 'All';
    if(rarState.active) delete rarState.hiddenCols[rarState.active];
    render();
  };
  window.rarToggleCol = (colName, checked) => {
    const key = rarState.active || 'default';
    const set = new Set(rarState.hiddenCols[key] || []);
    if(checked) set.delete(colName);
    else set.add(colName);
    rarState.hiddenCols[key] = [...set];
    render();
    document.getElementById('rarColOptions')?.setAttribute('open','');
  };

  function buildGstr1Payload(){
    const sales = rSales(), returns = rReturns();
    const cfg = window.pdfConfig ? pdfConfig('retail') : {};
    const custs = db.customers || [];
    const getCust = id => custs.find(c=>c.id===id) || {};
    const b2b = [], b2cl = [], b2csMap = new Map(), cdnr = [], hsnMap = new Map();
    sales.forEach(s => {
      const cust = getCust(s.partyId);
      const val = n(s.amount), gst = n(s.gstAmount), taxable = Math.max(0, val - gst), rt = n(s.gstRate)||3;
      const pos = String(cust.state||'33-TAMIL NADU').slice(0,2).replace(/[^0-9]/g,'') || '33';
      const entry = { inum: s.documentNo||s.id.slice(0,8), idt: dayOf(s.when||s.createdAt), val, pos, rchrg:'N', inv_typ:'R', itms:[{ num:1, itm_det:{ rt, txval:taxable, iamt:0, camt:rbRound(gst/2), samt:rbRound(gst/2), csamt:0 } }] };
      if(cust.gst) b2b.push({ ctin: cust.gst, inv: [entry] });
      else if(val > 250000) b2cl.push({ pos, inv: [entry] });
      else {
        const k = pos+'|'+rt;
        const cur = b2csMap.get(k) || { sply_ty:'INTRA', pos, typ:'OE', rt, txval:0, iamt:0, camt:0, samt:0, csamt:0 };
        cur.txval = rbRound(cur.txval + taxable);
        cur.camt = rbRound(cur.camt + gst/2);
        cur.samt = rbRound(cur.samt + gst/2);
        b2csMap.set(k, cur);
      }
      const items = saleItemsOf(s);
      items.forEach((it, idx) => {
        const hsn = it.hsn || '7113';
        const h = hsnMap.get(hsn) || { num: hsnMap.size+1, hsn_sc: hsn, desc: it.product||'Jewellery', uqc:'GMS', qty:0, val:0, txval:0, iamt:0, camt:0, samt:0, csamt:0, rt };
        const share = items.length ? 1/items.length : 1;
        const itVal = n(it.subtotal||s.amount*share), itGst = gst*share;
        h.qty = rbGrams(h.qty + n(it.netWeight||it.weight||0));
        h.val = rbRound(h.val + itVal);
        h.txval = rbRound(h.txval + Math.max(0, itVal - itGst));
        h.camt = rbRound(h.camt + itGst/2);
        h.samt = rbRound(h.samt + itGst/2);
        hsnMap.set(hsn, h);
      });
    });
    returns.forEach(r => {
      const cust = getCust(r.partyId);
      const val = n(r.amount), tax = rbRound(val - val/1.03), txval = rbRound(val - tax);
      cdnr.push({ ctin: cust.gst||'URP', nt:[{ ntty:'C', nt_num: r.documentNo||r.reference||r.id.slice(0,8), nt_dt: dayOf(r.when||r.date||r.createdAt), val, itms:[{ num:1, itm_det:{ rt:3, txval, iamt:0, camt:rbRound(tax/2), samt:rbRound(tax/2) } }] }] });
    });
    return {
      gstin: cfg.gstNumber||'33AAAAA0000A1Z5',
      fp: (rarState.to||new Date().toISOString().slice(0,10)).slice(0,7).replace('-',''),
      version: 'GST3.0.4',
      hash: 'hash',
      b2b,
      b2cl,
      b2cs: [...b2csMap.values()],
      cdnr,
      hsn: { data: [...hsnMap.values()] },
      doc_issue: {
        doc_det: [
          { doc_num: 1, docs: [{ num:1, from: sales.at(-1)?.documentNo||'INV-001', to: sales[0]?.documentNo||'INV-'+sales.length, totnum: sales.length, cancel:0, net_issue: sales.length }] },
          { doc_num: 5, docs: [{ num:1, from: returns.at(-1)?.documentNo||'CN-001', to: returns[0]?.documentNo||'CN-'+returns.length, totnum: returns.length, cancel:0, net_issue: returns.length }] }
        ]
      }
    };
  }

  window.rarDownloadGstr1Json = () => {
    const payload = buildGstr1Payload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'GSTR1-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
  };
  window.rarCopyGstr1Json = () => {
    const json = JSON.stringify(buildGstr1Payload(), null, 2);
    navigator.clipboard?.writeText(json).then(()=>say('GSTR1 JSON copied to clipboard.')).catch(()=>say('Use Download GSTR1 JSON.'));
  };

  window.rarDownloadCsv = () => {
    const rows=[...document.querySelectorAll('#rar-report-results table tr')];
    if(!rows.length)return say('There is no report table to export.');
    const csvCell=cell=>{
      const value=cell.textContent.trim();
      const safe=/^[=+@\-]/.test(value)?"'"+value:value;
      return '"'+safe.replaceAll('"','""')+'"';
    };
    const csv=rows.map(row=>[...row.cells].map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download=(rarState.active||'report').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  // Smart table renderer with universal text search & column visibility filtering
  let lastReportColumns = [];
  function rarTable(heads, rows){
    lastReportColumns = heads.slice();
    const q = (rarState.search||'').trim().toLowerCase();
    const strip = s => String(s??'').replace(/<[^>]*>/g,' ').toLowerCase();
    const filteredRows = !q ? rows : rows.filter(r => {
      const first = strip(r[0]);
      if(first.startsWith('total') || first.startsWith('grand total') || first.startsWith('net ')) return true;
      return r.some(c => strip(c).includes(q));
    });
    const hidden = new Set(rarState.hiddenCols[rarState.active] || []);
    let keepIdxs = heads.map((h,i)=>hidden.has(h)?-1:i).filter(i=>i>=0);
    if(!keepIdxs.length) keepIdxs = [0];
    const visHeads = keepIdxs.map(i=>heads[i]);
    const visRows = filteredRows.map(r=>keepIdxs.map(i=>r[i]??''));
    return table(visHeads, visRows);
  }

  function rarRenderReport(name){
    lastReportColumns = [];
    const sales = rSales(), returns = rReturns(), pays = rPays(), purch = rPurch(), oldPurch = rOldPurch(), purchRet = rPurchReturns(), supPays = rSupPays();
    const custs = db.customers || [], sups = db.retailSuppliers || [];
    const products = docs('retail-product'), pGroups = docs('retail-product-group'), tags = docs('retail-tagging'), lots = docs('retail-lot');
    const orders = docs('retail-order'), vouchers = docs('crm-voucher'), visitors = docs('crm-visitor'), leads = docs('crm-lead');
    const ledgersList = docs('retail-ledger'), postings = docs('retail-account-posting');
    const getCust = (id) => custs.find(c=>c.id===id) || {};
    const getSup = (id) => sups.find(s=>s.id===id) || {};
    const getLedger = (id) => ledgersList.find(l=>l.id===id) || {};
    const prodGroupOf = (pName, itemGrp) => itemGrp || (products.find(p=>String(p.name||'').toLowerCase()===String(pName||'').toLowerCase())||{}).group || 'General';
    const prodMetalOf = (pName, itemMetal) => itemMetal || (products.find(p=>String(p.name||'').toLowerCase()===String(pName||'').toLowerCase())||{}).metalType || (/silver/i.test(String(pName||''))?'Silver':'Gold');

    let subToolbar = '';
    let content = '';

    // =========================================================================
    // 1. GSTR1 & GST REPORTS
    // =========================================================================
    if(name === 'GSTR1 Report'){
      const b2b = sales.filter(s=>!!getCust(s.partyId).gst);
      const b2cLarge = sales.filter(s=>!getCust(s.partyId).gst && n(s.amount)>250000);
      const b2cSmall = sales.filter(s=>!getCust(s.partyId).gst && n(s.amount)<=250000);
      const sumBucket = (arr) => ({
        cnt: arr.length,
        taxable: arr.reduce((a,s)=>a+Math.max(0,n(s.amount)-n(s.gstAmount)),0),
        cgst: arr.reduce((a,s)=>a+n(s.gstAmount)/2,0),
        sgst: arr.reduce((a,s)=>a+n(s.gstAmount)/2,0),
        igst: arr.reduce((a,s)=>a+(s.gstMode==='igst'?n(s.gstAmount):0),0),
        tot: arr.reduce((a,s)=>a+n(s.amount),0)
      });
      const retTax = returns.reduce((a,r)=>a+(n(r.amount)-n(r.amount)/1.03),0);
      const retTot = returns.reduce((a,r)=>a+n(r.amount),0);
      const rows = [
        ['4A, 4B, 4C, 6B, 6C - B2B Invoices', sumBucket(b2b)],
        ['5A, 5B - B2C (Large) Invoices (> ₹2.5L)', sumBucket(b2cLarge)],
        ['7 - B2C (Small) Invoices (≤ ₹2.5L)', sumBucket(b2cSmall)],
        ['9B - Credit / Debit Notes (Sales Returns)', { cnt: returns.length, taxable: Math.max(0,retTot-retTax), cgst: retTax/2, sgst: retTax/2, igst:0, tot: retTot }]
      ];
      const allB = sumBucket(sales);
      subToolbar = '<button type="button" class="primary" onclick="rarDownloadGstr1Json()">⬇ Download GSTR1 JSON</button> <button type="button" onclick="rarOpen(\'GSTR1 JSON Report\')">View JSON</button>';
      content = rarTable(['Section','Vouchers','Taxable Value ₹','CGST ₹','SGST ₹','IGST ₹','Total Invoice ₹'], [
        ...rows.map(([lbl,b])=>['<b>'+esc(lbl)+'</b>', b.cnt, rateMoney(b.taxable), rateMoney(b.cgst), rateMoney(b.sgst), rateMoney(b.igst), '<b>'+rateMoney(b.tot)+'</b>']),
        ['<b>Net Outward Liability (Sales − Returns)</b>', sales.length+returns.length, rateMoney(allB.taxable-Math.max(0,retTot-retTax)), rateMoney(allB.cgst-retTax/2), rateMoney(allB.sgst-retTax/2), rateMoney(allB.igst), '<b>'+rateMoney(allB.tot-retTot)+'</b>']
      ]);
    }
    else if(name === 'GSTR1 All Invoice Report' || name === 'GSTR1 B2B & B2C Invoices' || name === 'GSTR1 B2B Invoices' || name === 'GSTR1 B2C Large Invoices'){
      const onlyB2B = name === 'GSTR1 B2B Invoices';
      const onlyB2CL = name === 'GSTR1 B2C Large Invoices';
      const filteredSales = sales.filter(s=>{
        const c = getCust(s.partyId);
        if(onlyB2B) return !!c.gst;
        if(onlyB2CL) return !c.gst && n(s.amount)>250000;
        return true;
      });
      let totTax=0, totCgst=0, totSgst=0, totIgst=0, totAmt=0, totWt=0;
      const rows = filteredSales.map(s=>{
        const c = getCust(s.partyId), gst = n(s.gstAmount), tax = Math.max(0, n(s.amount)-gst);
        const igst = s.gstMode==='igst' ? gst : 0, cgst = igst ? 0 : gst/2, sgst = igst ? 0 : gst/2;
        const wt = n(s.weight);
        totTax+=tax; totCgst+=cgst; totSgst+=sgst; totIgst+=igst; totAmt+=n(s.amount); totWt+=wt;
        return [
          c.gst?'B2B':(n(s.amount)>250000?'B2C Large':'B2C Small'),
          '<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>',
          esc(dayOf(s.when||s.createdAt)),
          esc(c.name||'Walk-in Customer'),
          esc(c.gst||'Unregistered'),
          esc(c.state||s.placeOfSupply||'TAMIL NADU'),
          (n(s.gstRate)||3)+'%',
          fmt(wt)+' g',
          rateMoney(tax),
          rateMoney(cgst),
          rateMoney(sgst),
          rateMoney(igst),
          '<b>'+rateMoney(s.amount)+'</b>'
        ];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totTax)+'</b>','<b>'+rateMoney(totCgst)+'</b>','<b>'+rateMoney(totSgst)+'</b>','<b>'+rateMoney(totIgst)+'</b>','<b>'+rateMoney(totAmt)+'</b>']);
      content = rows.length ? rarTable(['Type','Bill No','Date','Customer','GSTIN','Place of Supply','Rate %','Net Wt g','Taxable ₹','CGST ₹','SGST ₹','IGST ₹','Total ₹'], rows) : '<p class="empty">No matching GSTR1 invoices in this period.</p>';
    }
    else if(name === 'GSTR1 B2C Small Invoices'){
      const b2cs = sales.filter(s=>!getCust(s.partyId).gst && n(s.amount)<=250000);
      subToolbar = ['Summary','Invoice List'].map(m=>'<button type="button" class="'+(rarState.b2csView===m?'primary':'')+'" onclick="rarState.b2csView=\''+m+'\';render()">'+m+'</button>').join(' ');
      if(rarState.b2csView === 'Invoice List'){
        let totTax=0, totGst=0, totAmt=0;
        const rows = b2cs.map(s=>{
          const c = getCust(s.partyId), gst = n(s.gstAmount), tax = Math.max(0,n(s.amount)-gst);
          totTax+=tax; totGst+=gst; totAmt+=n(s.amount);
          return ['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(dayOf(s.when||s.createdAt)), esc(c.name||'Customer'), esc(c.state||'TAMIL NADU'), (n(s.gstRate)||3)+'%', fmt(s.weight)+' g', rateMoney(tax), rateMoney(gst/2), rateMoney(gst/2), '<b>'+rateMoney(s.amount)+'</b>'];
        });
        if(rows.length) rows.push(['<b>Total</b>','','','','','',rateMoney(totTax),rateMoney(totGst/2),rateMoney(totGst/2),'<b>'+rateMoney(totAmt)+'</b>']);
        content = rows.length ? rarTable(['Bill No','Date','Customer','State','Rate %','Net Wt g','Taxable ₹','CGST ₹','SGST ₹','Total ₹'], rows) : '<p class="empty">No B2C Small invoices in range.</p>';
      } else {
        const groups = new Map();
        b2cs.forEach(s=>{
          const c = getCust(s.partyId), state = c.state||s.placeOfSupply||'33-TAMIL NADU', rt = (n(s.gstRate)||3)+'%';
          const k = state+'|'+rt;
          const g = groups.get(k) || { state, rt, cnt:0, wt:0, tax:0, cgst:0, sgst:0, tot:0 };
          const gst = n(s.gstAmount), tax = Math.max(0,n(s.amount)-gst);
          g.cnt++; g.wt+=n(s.weight); g.tax+=tax; g.cgst+=gst/2; g.sgst+=gst/2; g.tot+=n(s.amount);
          groups.set(k, g);
        });
        const list = [...groups.values()];
        const rows = list.map(g=>['<b>'+esc(g.state)+'</b>','Intra-State (OE)',esc(g.rt),g.cnt,fmt(g.wt)+' g',rateMoney(g.tax),rateMoney(g.cgst),rateMoney(g.sgst),'<b>'+rateMoney(g.tot)+'</b>']);
        if(rows.length) rows.push(['<b>Total</b>','','',b2cs.length,fmt(list.reduce((a,x)=>a+x.wt,0))+' g',rateMoney(list.reduce((a,x)=>a+x.tax,0)),rateMoney(list.reduce((a,x)=>a+x.cgst,0)),rateMoney(list.reduce((a,x)=>a+x.sgst,0)),'<b>'+rateMoney(list.reduce((a,x)=>a+x.tot,0))+'</b>']);
        content = rows.length ? rarTable(['Place of Supply','Supply Type','Rate %','Invoices','Net Wt g','Taxable Value ₹','CGST ₹','SGST ₹','Total Value ₹'], rows) : '<p class="empty">No B2C Small invoices in range.</p>';
      }
    }
    else if(name === 'GSTR1 CR/DR Lists'){
      const rows = [];
      let totWt=0, totTax=0, totGst=0, totAmt=0;
      returns.forEach(r=>{
        const c = getCust(r.partyId), amt = n(r.amount), gst = rbRound(amt - amt/1.03), tax = rbRound(amt - gst), wt = n(r.returnWeight||r.weight);
        totWt+=wt; totTax+=tax; totGst+=gst; totAmt+=amt;
        rows.push(['Credit Note (Sales Return)','<b>'+esc(r.documentNo||r.reference||r.id.slice(0,8))+'</b>',esc(dayOf(r.when||r.date||r.createdAt)),esc(r.invoiceNo||r.invoiceId||'—'),esc(c.name||'Customer'),esc(c.gst||'Unregistered'),esc(r.product||'Jewellery'),fmt(wt)+' g',rateMoney(tax),rateMoney(gst/2),rateMoney(gst/2),'<b>'+rateMoney(amt)+'</b>']);
      });
      purchRet.forEach(r=>{
        const s = getSup(r.supplierId), amt = n(r.creditAmount||r.amount), gst = rbRound(amt - amt/1.03), tax = rbRound(amt - gst), wt = n(r.returnWeight||r.weight);
        totWt+=wt; totTax+=tax; totGst+=gst; totAmt+=amt;
        rows.push(['Debit Note (Purchase Return)','<b>'+esc(r.documentNo||r.id.slice(0,8))+'</b>',esc(dayOf(r.when||r.date||r.createdAt)),esc(r.sourceNo||r.sourceId||'—'),esc(s.name||'Supplier'),esc(s.gst||'—'),esc(r.product||'Jewellery'),fmt(wt)+' g',rateMoney(tax),rateMoney(gst/2),rateMoney(gst/2),'<b>'+rateMoney(amt)+'</b>']);
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totTax)+'</b>','<b>'+rateMoney(totGst/2)+'</b>','<b>'+rateMoney(totGst/2)+'</b>','<b>'+rateMoney(totAmt)+'</b>']);
      content = rows.length ? rarTable(['Note Type','Note No.','Date','Orig. Bill No.','Party Name','GSTIN','Product','Weight g','Taxable ₹','CGST ₹','SGST ₹','Total Value ₹'], rows) : '<p class="empty">No credit or debit notes (returns) in this period.</p>';
    }
    else if(name === 'GSTR1 Document Summary'){
      const docSeries = (label, arr, key='documentNo', prefix='DOC') => {
        const codes = arr.map((x,i)=>String(x[key]||x.billNo||x.reference||(prefix+'-'+(i+1)))).sort();
        return ['<b>'+esc(label)+'</b>', esc(codes[0]||'—'), esc(codes.at(-1)||'—'), arr.length, 0, '<b>'+arr.length+'</b>'];
      };
      const advs = pays.filter(p=>p.retailKind==='advance'||p.retailKind==='metal');
      const rows = [
        docSeries('1. Invoices for outward supply (Sales Bills)', sales, 'documentNo', 'INV'),
        docSeries('2. Invoices for inward supply from unregistered persons (Old Gold)', oldPurch, 'documentNo', 'OG'),
        docSeries('3. Credit Notes (Sales Returns)', returns, 'documentNo', 'CN'),
        docSeries('4. Debit Notes (Purchase Returns)', purchRet, 'documentNo', 'DN'),
        docSeries('5. Receipt Vouchers (Customer Advances)', advs, 'documentNo', 'ADV'),
        docSeries('6. Payment Vouchers (Supplier Payments)', supPays, 'documentNo', 'PAY'),
        docSeries('7. Retail Customer Orders / Job Cards', orders.filter(o=>inRange(o.date||o.createdAt)), 'orderNo', 'ORD')
      ];
      const totDocs = rows.reduce((a,r)=>a+n(r[3]),0);
      rows.push(['<b>Total Documents Issued</b>','—','—','<b>'+totDocs+'</b>','0','<b>'+totDocs+'</b>']);
      content = rarTable(['Nature of Document (Table 13)','Sr. No. From','Sr. No. To','Total Number','Cancelled','Net Issued'], rows);
    }
    else if(name === 'GSTR1 HSN/SAC Summary' || name === 'GSTR1 HSN/SAC Sales Summary'){
      const byHsn = {};
      sales.forEach(s => {
        const items = saleItemsOf(s);
        items.forEach(it => {
          const hsn = it.hsn || '7113';
          if(!byHsn[hsn]) byHsn[hsn] = { hsn, desc: it.product||'Jewellery', rate: n(s.gstRate)||3, qty:0, gross:0, wt:0, val:0, gst:0 };
          const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
          byHsn[hsn].qty += (n(it.pieces)||1);
          byHsn[hsn].gross += n(it.grossWeight||it.weight||0);
          byHsn[hsn].wt += n(it.netWeight||it.weight||0);
          byHsn[hsn].val += n(s.amount)*share;
          byHsn[hsn].gst += n(s.gstAmount)*share;
        });
      });
      const list = Object.values(byHsn);
      const rows = list.map(r=>['<b>'+esc(r.hsn)+'</b>', esc(r.desc), 'GMS', r.rate+'%', r.qty, fmt(r.gross)+' g', fmt(r.wt)+' g', rateMoney(Math.max(0,r.val-r.gst)), rateMoney(r.gst/2), rateMoney(r.gst/2), '<b>'+rateMoney(r.val)+'</b>']);
      if(rows.length) rows.push(['<b>Total</b>','','','',list.reduce((a,x)=>a+x.qty,0),fmt(list.reduce((a,x)=>a+x.gross,0))+' g',fmt(list.reduce((a,x)=>a+x.wt,0))+' g',rateMoney(list.reduce((a,x)=>a+Math.max(0,x.val-x.gst),0)),rateMoney(list.reduce((a,x)=>a+x.gst/2,0)),rateMoney(list.reduce((a,x)=>a+x.gst/2,0)),'<b>'+rateMoney(list.reduce((a,x)=>a+x.val,0))+'</b>']);
      content = rows.length ? rarTable(['HSN / SAC','Description','UQC','GST %','Qty','Gross Wt g','Net Wt g','Taxable ₹','CGST ₹','SGST ₹','Total ₹'], rows) : '<p class="empty">No HSN sales records in range.</p>';
    }
    else if(name === 'HSN/SAC Sales Detail Summary'){
      const rows = [];
      let totPcs=0, totGross=0, totNet=0, totTax=0, totGst=0, totVal=0;
      sales.forEach(s => {
        const c = getCust(s.partyId), items = saleItemsOf(s);
        items.forEach(it => {
          const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
          const val = rbRound(n(s.amount)*share), gst = rbRound(n(s.gstAmount)*share), tax = Math.max(0, val - gst);
          const pcs = n(it.pieces)||1, gross = n(it.grossWeight||it.weight), net = n(it.netWeight||it.weight);
          totPcs+=pcs; totGross+=gross; totNet+=net; totTax+=tax; totGst+=gst; totVal+=val;
          rows.push([
            esc(dayOf(s.when||s.createdAt)),
            '<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>',
            esc(c.name||'Customer'),
            esc(c.gst||'Unregistered'),
            esc(it.hsn||'7113'),
            esc(prodGroupOf(it.product, it.productGroup)),
            esc(it.product||'Jewellery'),
            esc(prodMetalOf(it.product, it.metalType)),
            pcs,
            fmt(gross)+' g',
            fmt(net)+' g',
            (n(s.gstRate)||3)+'%',
            rateMoney(tax),
            rateMoney(gst/2),
            rateMoney(gst/2),
            '<b>'+rateMoney(val)+'</b>'
          ]);
        });
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','',totPcs,fmt(totGross)+' g',fmt(totNet)+' g','',rateMoney(totTax),rateMoney(totGst/2),rateMoney(totGst/2),'<b>'+rateMoney(totVal)+'</b>']);
      content = rows.length ? rarTable(['Date','Bill No','Customer','GSTIN','HSN/SAC','Product Group','Product','Metal','Pcs','Gross Wt g','Net Wt g','GST %','Taxable ₹','CGST ₹','SGST ₹','Total ₹'], rows) : '<p class="empty">No HSN sales details in this period.</p>';
    }
    else if(name === 'HSN/SAC Return Detail Summary'){
      const rows = [];
      let totWt=0, totTax=0, totGst=0, totVal=0;
      returns.forEach(r => {
        const c = getCust(r.partyId), val = n(r.amount), gst = rbRound(val - val/1.03), tax = Math.max(0, val - gst), wt = n(r.returnWeight||r.weight);
        totWt+=wt; totTax+=tax; totGst+=gst; totVal+=val;
        rows.push([esc(dayOf(r.when||r.date||r.createdAt)),'<b>'+esc(r.documentNo||r.reference||r.id.slice(0,8))+'</b>','Sales Return',esc(r.invoiceNo||r.invoiceId||'—'),esc(c.name||'Customer'),esc(c.gst||'Unregistered'),esc(r.hsn||'7113'),esc(r.product||'Jewellery'),fmt(wt)+' g',rateMoney(tax),rateMoney(gst/2),rateMoney(gst/2),'<b>'+rateMoney(val)+'</b>']);
      });
      purchRet.forEach(r => {
        const s = getSup(r.supplierId), val = n(r.creditAmount||r.amount), gst = rbRound(val - val/1.03), tax = Math.max(0, val - gst), wt = n(r.returnWeight||r.weight);
        totWt+=wt; totTax+=tax; totGst+=gst; totVal+=val;
        rows.push([esc(dayOf(r.when||r.date||r.createdAt)),'<b>'+esc(r.documentNo||r.id.slice(0,8))+'</b>','Purchase Return',esc(r.sourceNo||r.sourceId||'—'),esc(s.name||'Supplier'),esc(s.gst||'—'),esc(r.hsn||'7113'),esc(r.product||'Jewellery'),fmt(wt)+' g',rateMoney(tax),rateMoney(gst/2),rateMoney(gst/2),'<b>'+rateMoney(val)+'</b>']);
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totTax)+'</b>','<b>'+rateMoney(totGst/2)+'</b>','<b>'+rateMoney(totGst/2)+'</b>','<b>'+rateMoney(totVal)+'</b>']);
      content = rows.length ? rarTable(['Date','Return No','Return Type','Orig. Bill','Party','GSTIN','HSN/SAC','Product','Return Wt g','Taxable ₹','CGST ₹','SGST ₹','Return Value ₹'], rows) : '<p class="empty">No HSN return records in this period.</p>';
    }
    else if(name === 'GSTR1 JSON Report'){
      const payload = buildGstr1Payload();
      subToolbar = '<button type="button" class="primary" onclick="rarDownloadGstr1Json()">⬇ Download GSTR1 JSON</button> <button type="button" onclick="rarCopyGstr1Json()">📋 Copy JSON</button>';
      const summaryRows = [
        ['GSTIN', esc(payload.gstin), 'Filing Period (MMYYYY)', esc(payload.fp)],
        ['B2B Registered Invoices (b2b)', payload.b2b.length, 'B2C Large Invoices (b2cl)', payload.b2cl.length],
        ['B2C Small State/Rate Buckets (b2cs)', payload.b2cs.length, 'Credit / Debit Notes (cdnr)', payload.cdnr.length],
        ['HSN Summary Rows (hsn.data)', payload.hsn.data.length, 'Document Series (doc_issue)', payload.doc_issue.doc_det.length]
      ];
      content = rarTable(['JSON Property','Value / Count','JSON Property 2','Value / Count 2'], summaryRows)
        + '<pre style="max-height:380px;overflow:auto;padding:12px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--paper,#faf8f4);font-size:12px">' + esc(JSON.stringify(payload, null, 2)) + '</pre>';
    }
    else if(name === 'GSTR3B Report'){
      const outTaxable = sales.reduce((a,s)=>a+Math.max(0,n(s.amount)-n(s.gstAmount)),0);
      const outGst = sales.reduce((a,s)=>a+n(s.gstAmount),0);
      const retTax = returns.reduce((a,r)=>a+(n(r.amount)-n(r.amount)/1.03),0);
      const retTaxable = returns.reduce((a,r)=>a+Math.max(0,n(r.amount)-(n(r.amount)-n(r.amount)/1.03)),0);
      const netOutTaxable = Math.max(0, outTaxable - retTaxable);
      const netOutGst = Math.max(0, outGst - retTax);
      const inTaxable = purch.reduce((a,p)=>a+Math.max(0,n(p.taxableValue||n(p.totalAmount||p.netAmount||p.amount)-n(p.gstAmount||p.taxAmount))),0);
      const inGst = purch.reduce((a,p)=>a+n(p.gstAmount||p.taxAmount),0);
      const netPayable = netOutGst - inGst;
      subToolbar = '<button type="button" class="'+(rarState.gstr3bView==='Horizontal'?'primary':'')+'" onclick="rarState.gstr3bView=\'Horizontal\';render()">Horizontal</button> <button type="button" class="'+(rarState.gstr3bView==='Vertical'?'primary':'')+'" onclick="rarState.gstr3bView=\'Vertical\';render()">Vertical</button>';
      if(rarState.gstr3bView === 'Vertical'){
        content = rarTable(['GSTR-3B Section','Measure','Amount ₹'], [
          ['3.1(a) Outward Taxable Supplies (Gross Sales)','Taxable Value',rateMoney(outTaxable)],
          ['3.1(a) Outward Taxable Supplies (Gross Sales)','CGST + SGST',rateMoney(outGst)],
          ['Less: Credit Notes / Sales Returns','Taxable Value',rateMoney(retTaxable)],
          ['Less: Credit Notes / Sales Returns','Tax Reduction',rateMoney(retTax)],
          ['3.1 Net Outward Taxable Supplies','Net Tax Liability','<b>'+rateMoney(netOutGst)+'</b>'],
          ['4(A)(5) All Other Eligible ITC (Purchases)','Inward Taxable Value',rateMoney(inTaxable)],
          ['4(C) Net Eligible ITC Available','CGST + SGST ITC','<b>'+rateMoney(inGst)+'</b>'],
          ['6.1 Net GST Payable in Cash (Outward − ITC)','Net Tax Payable','<b>'+rateMoney(netPayable)+'</b>']
        ]);
      } else {
        content = rarTable(['Particulars','Taxable Value ₹','CGST ₹','SGST ₹','IGST ₹','Total Tax ₹'], [
          ['3.1(a) Outward Taxable Supplies (Sales)', rateMoney(outTaxable), rateMoney(outGst/2), rateMoney(outGst/2), rateMoney(0), '<b>'+rateMoney(outGst)+'</b>'],
          ['Less: 9B Sales Returns (Credit Notes)', rateMoney(retTaxable), rateMoney(retTax/2), rateMoney(retTax/2), rateMoney(0), rateMoney(retTax)],
          ['<b>Net Outward Supplies (3.1 Net)</b>', '<b>'+rateMoney(netOutTaxable)+'</b>', '<b>'+rateMoney(netOutGst/2)+'</b>', '<b>'+rateMoney(netOutGst/2)+'</b>', rateMoney(0), '<b>'+rateMoney(netOutGst)+'</b>'],
          ['4(A) Eligible ITC (Inward GST Purchases)', rateMoney(inTaxable), rateMoney(inGst/2), rateMoney(inGst/2), rateMoney(0), '<b>'+rateMoney(inGst)+'</b>'],
          ['<b>6.1 Net Tax Payable (Outward − ITC)</b>', '<b>'+rateMoney(netOutTaxable-inTaxable)+'</b>', '<b>'+rateMoney((netOutGst-inGst)/2)+'</b>', '<b>'+rateMoney((netOutGst-inGst)/2)+'</b>', rateMoney(0), '<b>'+rateMoney(netPayable)+'</b>']
        ]);
      }
    }

    // =========================================================================
    // 2. ACCOUNTS, BOOKS, PAYMENTS, OUTSTANDING, ADVANCE, EXPENSE, FINANCIALS
    // =========================================================================
    else if(name === 'DayBook Report' || name === 'DayBook Abstract'){
      const ledgers=new Map(ledgersList.map(row=>[row.id,row.name]));
      const entries=[];
      const add=(date,no,type,ledger,notes,dr,cr,wd=0,wc=0)=>{
        const day=dayOf(date);
        if(day&&inRange(day))entries.push({day,no,type,ledger,notes,dr:n(dr),cr:n(cr),wd:n(wd),wc:n(wc)});
      };
      for(const row of sales)add(row.when||row.createdAt,row.documentNo||row.id,'Sales Bill',getCust(row.partyId).name,row.product||'Jewellery Sale',row.amount,0,row.weight);
      for(const row of returns)add(row.when||row.date||row.createdAt,row.documentNo||row.reference||row.id,'Sales Return',getCust(row.partyId).name,row.product||'Sales Return',0,row.amount,0,row.returnWeight||row.weight);
      for(const row of pays)add(row.when||row.date||row.createdAt,row.documentNo||row.reference||row.id,'Receipt ('+(row.retailKind||'cash')+')',getCust(row.partyId).name,row.method||row.kind||'Receipt',0,row.amount,0,row.pureGrams);
      for(const row of purch)add(row.when||row.date||row.createdAt,row.documentNo||row.billNo||row.id,'Purchase',getSup(row.supplierId).name,row.remarks||'Purchase',0,row.totalAmount??row.netAmount??row.amount,0,row.netWeight||row.totalNetWt);
      for(const row of oldPurch)add(row.when||row.date||row.createdAt,row.documentNo||row.id,'Old Jewel Purchase',getSup(row.supplierId).name||'Customer Seller',row.remarks||'Old Gold',0,row.totalAmount??row.amount,0,row.netWeight);
      for(const row of supPays)add(row.when||row.date||row.createdAt,row.documentNo||row.id,'Supplier Payment',getSup(row.supplierId).name,row.notes||'Payment',row.amountCredit,0,row.goldCredit+row.silverCredit,0);
      for(const row of postings){
        for(const line of row.lines||[]){
          const amount=row.measure==='Amount';
          add(line.date||row.date,row.number,row.voucherType,ledgers.get(line.ledgerId),line.remarks||row.description,
            amount?line.debit:0,amount?line.credit:0,amount?0:line.debit,amount?0:line.credit);
        }
      }
      const abstract=name==='DayBook Abstract'||rarState.daybookTab==='Abstract';
      subToolbar=['Transactions','Abstract'].map(mode=>'<button type="button" class="'+(abstract===(mode==='Abstract')?'primary':'')
        +'" onclick="rarState.active=\'DayBook Report\';rarState.daybookTab=\''+mode+'\';render()">'+mode+'</button>').join(' ');
      const groups=new Map();
      const sum=(target,row)=>{for(const key of ['dr','cr','wd','wc'])target[key]+=row[key]};
      const values=row=>[rateMoney(row.dr),rateMoney(row.cr),fmt(row.wd)+' g',fmt(row.wc)+' g'];
      const total={dr:0,cr:0,wd:0,wc:0};
      entries.sort((a,b)=>b.day.localeCompare(a.day));
      for(const row of entries){
        sum(total,row);
        const key=JSON.stringify([row.day,row.type]);
        if(!groups.has(key))groups.set(key,{day:row.day,type:row.type,cnt:0,dr:0,cr:0,wd:0,wc:0});
        groups.get(key).cnt++;
        sum(groups.get(key),row);
      }
      const heads=abstract?['Date','Voucher type','Vouchers']:['Date','Voucher no.','Voucher type','Ledger','Narration'];
      const rows=abstract?[...groups.values()].map(row=>[esc(row.day),'<b>'+esc(row.type)+'</b>',row.cnt,...values(row)])
        :entries.map(row=>[row.day,row.no,row.type,row.ledger,row.notes].map(value=>esc(value||'—')).concat(values(row)));
      if(rows.length)rows.push(['<b>Total</b>',...heads.slice(1).map(()=>''),...values(total)]);
      content=rows.length?rarTable([...heads,'Amount Dr ₹','Amount Cr ₹','Weight Dr','Weight Cr'],rows):'<p class="empty">No daybook transactions.</p>';
    }
    else if(name === 'Cashbook & Bankbook' || name === 'Cashbook Report' || name === 'Bankbook Report'){
      const book=name==='Bankbook Report'?'Bank':'Cash';
      const group=book==='Bank'?'Bank Accounts':'Cash in hand';
      const bookLedgers=new Map(ledgersList.filter(l=>l.parentGroup===group).map(l=>[l.id,l]));
      const entries=[];
      const add=(date,no,type,ledger,party,dr,cr,opening=false)=>{
        if(book==='Bank' && rarState.ledgerId && ledger!==rarState.ledgerId && party!==rarState.ledgerId) return;
        const dt=dayOf(date);
        if(n(dr)||n(cr))entries.push({dt,no,type,ledger:party||ledger,dr:n(dr),cr:n(cr),opening});
      };
      for(const ledger of bookLedgers.values()){
        const amount=n(ledger.openingAmount), credit=ledger.openingSide==='CR';
        add(ledger.openingEffectiveDate,'','Opening balance',ledger.name,ledger.name,credit?0:amount,credit?amount:0,true);
      }
      for(const row of docs('retail-shop-opening')){
        if(row.category===(book==='Bank'?'Bank':'Cash in hand'))add(row.when,'','Opening balance',row.description,row.description,n(row.amount),0,true);
      }
      for(const row of postings){
        if(row.measure!=='Amount')continue;
        for(const line of row.lines||[]){
          const ledger=bookLedgers.get(line.ledgerId);
          if(ledger)add(line.date||row.date,row.number||row.id,row.voucherType,ledger.name,row.description||ledger.name,line.debit,line.credit);
        }
      }
      const allSales=(db.sales||[]).filter(row=>row.accountType==='customer');
      const allPayments=(db.payments||[]).filter(row=>row.accountType==='customer'&&(row.retailKind||'receipt')!=='return');
      const matches=method=>book==='Cash'?/^cash$/i.test(String(method).trim()):/^(?:bank(?: transfer)?|upi|gpay|google pay|phonepe|card|debit card|credit card|cheque|check|neft|rtgs|imps)$/i.test(String(method).trim());
      for(const sale of allSales){
        const collections=sale.collections?.length?sale.collections:[{method:sale.collectedMethod||'Cash',amount:sale.collectedAmount}];
        for(const payment of collections)if(matches(payment.method))add(sale.when||sale.createdAt,sale.documentNo||sale.id,'Sale receipt ('+payment.method+')',book,getCust(sale.partyId).name||'Customer',payment.amount,0);
      }
      for(const payment of allPayments){
        if(matches(payment.method||payment.kind||'Cash'))add(payment.when||payment.createdAt,payment.reference||payment.documentNo||payment.id,'Customer receipt',book,getCust(payment.partyId).name||'Customer',payment.amount,0);
      }
      for(const pur of [...allPurchases(), ...docs('old-purchase')]){
        const dt=pur.when||pur.date||pur.createdAt, sName=getSup(pur.supplierId).name||'Supplier';
        if(book==='Cash' && n(pur.paidCash)>0) add(dt,pur.documentNo||pur.id,'Purchase payment (Cash)',book,sName,0,pur.paidCash);
        if(book==='Bank'){
          const bPaid = n(pur.paidBank)+n(pur.paidCard)+n(pur.paidUpi);
          if(bPaid>0) add(dt,pur.documentNo||pur.id,'Purchase payment (Bank/UPI)',book,sName,0,bPaid);
        }
      }
      for(const sp of docs('payment')){
        const dt=sp.when||sp.date||sp.createdAt, sName=getSup(sp.supplierId).name||'Supplier';
        const collections = sp.collections?.length ? sp.collections : [{method: sp.method||'Cash', amount: sp.amountCredit}];
        for(const c of collections) if(matches(c.method)) add(dt,sp.documentNo||sp.id,'Supplier payment ('+c.method+')',book,sName,0,c.amount);
      }
      const bankOpts = book==='Bank' ? '<select onchange="rarState.ledgerId=this.value;render()"><option value="">All Bank Ledgers</option>'+opts([...bookLedgers.values()].map(l=>l.name), rarState.ledgerId)+'</select> ' : '';
      subToolbar = bankOpts + ['Detailed View','Month Wise','Day Wise'].map(m=>'<button type="button" class="'+(rarState.bookMode===m?'primary':'')+'" onclick="rarState.bookMode=\''+m+'\';render()">'+m+'</button>').join(' ');
      const opening=entries.filter(e=>(!e.dt&&e.opening)||(rarState.from&&e.dt&&e.dt<rarState.from)).reduce((sum,e)=>sum+e.dr-e.cr,0);
      const period=entries.filter(e=>e.dt&&inRange(e.dt)).sort((a,b)=>a.dt.localeCompare(b.dt));
      let running=opening, totDr=0, totCr=0;
      const summary=rarState.bookMode!=='Detailed View';
      const grouped=new Map();
      if(summary)for(const entry of period){
        const key=entry.dt.slice(0,rarState.bookMode==='Month Wise'?7:10);
        const groupObj=grouped.get(key)||{dt:key,dr:0,cr:0};
        groupObj.dr+=entry.dr;groupObj.cr+=entry.cr;grouped.set(key,groupObj);
      }
      const heads=summary?['Period']:['Date','Txn No.','Type','Ledger / Particulars'];
      const rows=(summary?[...grouped.values()]:period).map(e=>{
        running+=e.dr-e.cr; totDr+=e.dr; totCr+=e.cr;
        return [...(summary?[esc(e.dt)]:[esc(e.dt),esc(e.no||'—'),esc(e.type||'—'),esc(e.ledger||'—')]),rateMoney(e.dr),rateMoney(e.cr),'<b>'+rateMoney(running)+'</b>'];
      });
      if(rows.length) rows.push(['<b>Total</b>',...heads.slice(1).map(()=>''),'<b>'+rateMoney(totDr)+'</b>','<b>'+rateMoney(totCr)+'</b>','<b>'+rateMoney(running)+'</b>']);
      content='<p>Opening balance <b>'+rateMoney(opening)+'</b> · Period Receipts <b>'+rateMoney(totDr)+'</b> · Period Payments <b>'+rateMoney(totCr)+'</b> · Closing balance <b>'+rateMoney(running)+'</b></p>'
        +(rows.length?rarTable([...heads,'Receipt ₹','Payment ₹','Closing ₹'],rows):'<p class="empty">No entries in this period.</p>');
    }
    else if(name === 'Bill Entry Report'){
      const ledgers=new Map(ledgersList.map(ledger=>[ledger.id,ledger.name]));
      subToolbar = '<label>Status <select onchange="rarState.billStatus=this.value;render()">'+opts(['All','Delivered','Undelivered','Old Gold'], rarState.billStatus)+'</select></label>';
      const list=postings.filter(entry=>entry.voucherType==='Bill Entry'&&inRange(entry.date)&&(rarState.billStatus==='All'||(entry.billStatus||'Undelivered')===rarState.billStatus))
        .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      let totAmt=0, totWt=0;
      const rows=list.map(entry=>{
        totAmt+=n(entry.amount); totWt+=n(entry.billWeight);
        return [esc(entry.date||'—'),'<b>'+esc(entry.billNumber||entry.number||'—')+'</b>',esc(entry.direction||'—'),
          esc(ledgers.get(entry.source)||'—'),esc(ledgers.get(entry.destination)||'—'),rateMoney(n(entry.amount)),
          fmt(n(entry.billWeight))+' g',esc(entry.attendedBy||'—'),esc(entry.dueDate||'—'),esc(entry.billStatus||'—'),esc(entry.description||'—')];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','<b>'+rateMoney(totAmt)+'</b>','<b>'+fmt(totWt)+' g</b>','','','','']);
      content=rows.length?rarTable(['Date','Bill no. / reference','Type','From','To','Amount ₹','Weight g','Attended by','Due date','Status','Narration'],rows):'<p class="empty">No bill entries in this period.</p>';
    }
    else if(name === 'Payment Report By Ledger' || name === 'Payment Report By Ledger Group'){
      const byGroup = name === 'Payment Report By Ledger Group';
      const entries = [];
      const pushEntry = (dt, no, type, ledgerName, groupName, mode, dr, cr, wt=0) => {
        const d = dayOf(dt);
        if(!d || !inRange(d)) return;
        if(rarState.parentGroup && groupName !== rarState.parentGroup) return;
        if(rarState.ledgerId && ledgerName !== rarState.ledgerId) return;
        if(rarState.payMode !== 'All' && String(mode||'Cash').toLowerCase() !== rarState.payMode.toLowerCase()) return;
        entries.push({ d, no, type, ledgerName: ledgerName||'Unspecified', groupName: groupName||'General', mode: mode||'Cash', dr: n(dr), cr: n(cr), wt: n(wt) });
      };
      // 1. Sales collections
      sales.forEach(s => {
        const c = getCust(s.partyId), cols = s.collections?.length ? s.collections : (n(s.collectedAmount)>0 ? [{method:s.collectedMethod||'Cash',amount:s.collectedAmount}] : []);
        cols.forEach(col => pushEntry(s.when||s.createdAt, s.documentNo||s.id.slice(0,8), 'Sale Receipt', c.name||'Customer', c.parentGroup||'Sundry Debtors', col.method, col.amount, 0, s.weight));
      });
      // 2. Customer receipts & advances
      pays.forEach(p => {
        const c = getCust(p.partyId);
        pushEntry(p.when||p.date||p.createdAt, p.documentNo||p.reference||p.id.slice(0,8), 'Customer '+(p.retailKind||'Receipt'), c.name||'Customer', c.parentGroup||'Sundry Debtors', p.method||p.kind||'Cash', p.amount, 0, p.pureGrams);
      });
      // 3. Supplier payments
      supPays.forEach(sp => {
        const s = getSup(sp.supplierId);
        pushEntry(sp.when||sp.date||sp.createdAt, sp.documentNo||sp.id.slice(0,8), 'Supplier Payment', s.name||'Supplier', s.parentGroup||'Sundry Creditors', sp.method||'Cash', 0, sp.amountCredit, n(sp.goldCredit)+n(sp.silverCredit));
      });
      // 4. Purchase-time payments
      [...purch, ...oldPurch].forEach(p => {
        if(n(p.paidAmount)>0){
          const s = getSup(p.supplierId);
          const mode = n(p.paidBank)>0?'Bank transfer':n(p.paidUpi)>0?'UPI':n(p.paidCard)>0?'Card':'Cash';
          pushEntry(p.when||p.date||p.createdAt, p.documentNo||p.id.slice(0,8), 'Purchase Paid', s.name||'Supplier / Seller', s.parentGroup||'Sundry Creditors', mode, 0, p.paidAmount, p.netWeight);
        }
      });
      // 5. Account Postings
      const lMap = new Map(ledgersList.map(l=>[l.id,l]));
      postings.forEach(post => {
        (post.lines||[]).forEach(ln => {
          const l = lMap.get(ln.ledgerId);
          if(!l) return;
          const isAmt = post.measure==='Amount';
          pushEntry(ln.date||post.date, post.number, post.voucherType, l.name, l.parentGroup, post.paymentMode||'Account', isAmt?ln.debit:0, isAmt?ln.credit:0, isAmt?0:(n(ln.debit)-n(ln.credit)));
        });
      });

      const allGroups = [...new Set(['Sundry Debtors','Sundry Creditors','Cash in hand','Bank Accounts','Direct Expenses','Indirect Expenses',...ledgersList.map(l=>l.parentGroup).filter(Boolean)])].sort();
      const allLedgerNames = [...new Set([...custs.map(c=>c.name),...sups.map(s=>s.name),...ledgersList.map(l=>l.name)].filter(Boolean))].sort();
      subToolbar = '<select onchange="rarState.parentGroup=this.value;render()"><option value="">All Ledger Groups</option>'+opts(allGroups, rarState.parentGroup)+'</select> '
        + (!byGroup ? '<select onchange="rarState.ledgerId=this.value;render()"><option value="">All Ledgers</option>'+opts(allLedgerNames, rarState.ledgerId)+'</select> ' : '')
        + '<select onchange="rarState.payMode=this.value;render()">'+opts(['All','Cash','Bank transfer','UPI','GPay','Card','Cheque'], rarState.payMode)+'</select>';

      if(byGroup){
        const grpMap = new Map();
        entries.forEach(e => {
          const g = grpMap.get(e.groupName) || { name: e.groupName, cnt:0, ledgers: new Set(), dr:0, cr:0, wt:0 };
          g.cnt++; g.ledgers.add(e.ledgerName); g.dr+=e.dr; g.cr+=e.cr; g.wt+=e.wt;
          grpMap.set(e.groupName, g);
        });
        const list = [...grpMap.values()].sort((a,b)=>(b.dr+b.cr)-(a.dr+a.cr));
        const rows = list.map(g=>['<b>'+esc(g.name)+'</b>', g.ledgers.size, g.cnt, fmt(g.wt)+' g', rateMoney(g.dr), rateMoney(g.cr), '<b>'+rateMoney(g.dr-g.cr)+'</b>']);
        if(rows.length) rows.push(['<b>Total ('+list.length+' Groups)</b>', '', entries.length, fmt(list.reduce((a,x)=>a+x.wt,0))+' g', '<b>'+rateMoney(list.reduce((a,x)=>a+x.dr,0))+'</b>', '<b>'+rateMoney(list.reduce((a,x)=>a+x.cr,0))+'</b>', '<b>'+rateMoney(list.reduce((a,x)=>a+x.dr-x.cr,0))+'</b>']);
        content = rows.length ? rarTable(['Ledger Group','Active Ledgers','Transactions','Weight g','Receipts / Debit ₹','Payments / Credit ₹','Net Balance ₹'], rows) : '<p class="empty">No group payment entries in this period.</p>';
      } else {
        entries.sort((a,b)=>b.d.localeCompare(a.d));
        let totDr=0, totCr=0, totWt=0;
        const rows = entries.map(e => {
          totDr+=e.dr; totCr+=e.cr; totWt+=e.wt;
          return [esc(e.d), '<b>'+esc(e.no)+'</b>', esc(e.type), '<b>'+esc(e.ledgerName)+'</b>', esc(e.groupName), esc(e.mode), fmt(e.wt)+' g', rateMoney(e.dr), rateMoney(e.cr), '<b>'+rateMoney(e.dr-e.cr)+'</b>'];
        });
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totDr)+'</b>','<b>'+rateMoney(totCr)+'</b>','<b>'+rateMoney(totDr-totCr)+'</b>']);
        content = rows.length ? rarTable(['Date','Voucher / Ref No','Entry Type','Ledger Name','Parent Group','Payment Mode','Weight g','Receipt / Dr ₹','Payment / Cr ₹','Net ₹'], rows) : '<p class="empty">No payment entries for the selected ledger filters.</p>';
      }
    }
    else if(name === 'Supplier Payment Report'){
      subToolbar = '<select onchange="rarState.supplierId=this.value;render()"><option value="">All Suppliers</option>'+sups.map(s=>'<option value="'+esc(s.id)+'" '+(rarState.supplierId===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select>';
      const rows = [];
      let totCash=0, totBank=0, totCard=0, totUpi=0, totPaid=0, totGold=0, totSilver=0;
      const matchSup = id => !rarState.supplierId || id === rarState.supplierId;
      supPays.filter(sp=>matchSup(sp.supplierId)).forEach(sp => {
        const s = getSup(sp.supplierId), bal = typeof rpSupplierBalance==='function' ? rpSupplierBalance(sp.supplierId) : {amount:0};
        const cash = n(sp.paidCash||(sp.method==='Cash'?sp.amountCredit:0));
        const bank = n(sp.paidBank||(sp.method==='Bank transfer'||sp.method==='Cheque'?sp.amountCredit:0));
        const card = n(sp.paidCard||(sp.method==='Card'?sp.amountCredit:0));
        const upi = n(sp.paidUpi||(sp.method==='UPI'||sp.method==='GPay'?sp.amountCredit:0));
        const tot = n(sp.amountCredit) || (cash+bank+card+upi);
        const g = n(sp.goldCredit), sil = n(sp.silverCredit);
        totCash+=cash; totBank+=bank; totCard+=card; totUpi+=upi; totPaid+=tot; totGold+=g; totSilver+=sil;
        rows.push([esc(dayOf(sp.when||sp.date||sp.createdAt)),'<b>'+esc(sp.documentNo||sp.id.slice(0,8))+'</b>','<b>'+esc(s.name||'Supplier')+'</b>',esc(sp.direction==='refund'?'Supplier Refund':'Supplier Payment'),rateMoney(cash),rateMoney(bank),rateMoney(card),rateMoney(upi),'<b>'+rateMoney(tot)+'</b>',fmt(g)+' g',fmt(sil)+' g',rateMoney(bal.amount),esc(sp.notes||sp.remarks||'—')]);
      });
      [...purch, ...oldPurch, ...docs('conversion')].filter(p=>matchSup(p.supplierId)&&(n(p.paidAmount)>0||n(p.metalDelivered)>0)&&inRange(p.when||p.date||p.createdAt)).forEach(p => {
        const s = getSup(p.supplierId), bal = typeof rpSupplierBalance==='function' ? rpSupplierBalance(p.supplierId) : {amount:0};
        const cash = n(p.paidCash) || (!n(p.paidBank)&&!n(p.paidCard)&&!n(p.paidUpi)?n(p.paidAmount):0);
        const bank = n(p.paidBank), card = n(p.paidCard), upi = n(p.paidUpi), tot = n(p.paidAmount);
        const g = p.metalDeliveredMetal!=='Silver'?n(p.metalDelivered):0, sil = p.metalDeliveredMetal==='Silver'?n(p.metalDelivered):0;
        totCash+=cash; totBank+=bank; totCard+=card; totUpi+=upi; totPaid+=tot; totGold+=g; totSilver+=sil;
        rows.push([esc(dayOf(p.when||p.date||p.createdAt)),'<b>'+esc(p.documentNo||p.billNo||p.id.slice(0,8))+'</b>','<b>'+esc(s.name||'Supplier')+'</b>','Bill Settlement ('+esc(p.kind||'purchase')+')',rateMoney(cash),rateMoney(bank),rateMoney(card),rateMoney(upi),'<b>'+rateMoney(tot)+'</b>',fmt(g)+' g',fmt(sil)+' g',rateMoney(bal.amount),esc(p.paidBankRef||p.paidUpiRef||p.remarks||'—')]);
      });
      rows.sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','',rateMoney(totCash),rateMoney(totBank),rateMoney(totCard),rateMoney(totUpi),'<b>'+rateMoney(totPaid)+'</b>','<b>'+fmt(totGold)+' g</b>','<b>'+fmt(totSilver)+' g</b>','','']);
      content = rows.length ? rarTable(['Date','Voucher / Bill No','Supplier Name','Payment Type','Cash ₹','Bank ₹','Card ₹','UPI ₹','Total Paid ₹','Gold Paid g','Silver Paid g','Current Balance ₹','Reference / Notes'], rows) : '<p class="empty">No supplier payments recorded in this period.</p>';
    }
    else if(name === 'Outstanding Report'){
      subToolbar = '<select onchange="rarState.partyType=this.value;render()">'+opts(['All','Customers (Debtors)','Suppliers (Creditors)','Custom Ledgers'], rarState.partyType)+'</select> '
        + '<select onchange="rarState.outStatus=this.value;render()">'+opts(['All','Due Only','Advance / Credit','Settled'], rarState.outStatus)+'</select>';
      const rows = [];
      let totOpen=0, totDr=0, totCr=0, totBal=0, totWt=0;
      const pushParty = (name, group, phone, city, open, dr, cr, wt=0) => {
        const bal = rbRound(open + dr - cr);
        const status = bal > 0.01 ? 'Due' : bal < -0.01 ? 'Advance / Credit' : 'Settled';
        if(rarState.outStatus === 'Due Only' && bal <= 0.01) return;
        if(rarState.outStatus === 'Advance / Credit' && bal >= -0.01) return;
        if(rarState.outStatus === 'Settled' && Math.abs(bal) > 0.01) return;
        totOpen+=open; totDr+=dr; totCr+=cr; totBal+=bal; totWt+=wt;
        const badge = bal>0.01 ? '<span class="rco-badge rco-badge-cancel">Due DR</span>' : bal<-0.01 ? '<span class="rco-badge rco-badge-wait">Credit CR</span>' : '<span class="rco-badge rco-badge-open">Settled</span>';
        rows.push(['<b>'+esc(name)+'</b>', esc(group), esc(phone||'—'), esc(city||'—'), rateMoney(open), rateMoney(dr), rateMoney(cr), fmt(wt)+' g', '<b>'+rateMoney(Math.abs(bal))+' '+(bal>=0?'DR':'CR')+'</b>', badge]);
      };
      if(rarState.partyType === 'All' || rarState.partyType === 'Customers (Debtors)'){
        custs.forEach(c => {
          const open = n(c.opening);
          const cSales = sales.filter(s=>s.partyId===c.id);
          const totSale = cSales.reduce((a,s)=>a+n(s.amount),0);
          const totPaid = pays.filter(p=>p.partyId===c.id).reduce((a,p)=>a+n(p.amount),0)
            + returns.filter(r=>r.partyId===c.id).reduce((a,r)=>a+n(r.amount),0)
            + cSales.reduce((a,s)=>a+n(s.collectedAmount)+n(s.cashAdvanceAmount),0);
          const metalAdv = pays.filter(p=>p.partyId===c.id&&p.retailKind==='metal').reduce((a,p)=>a+n(p.pureGrams),0);
          pushParty(c.name, c.parentGroup||'Sundry Debtors', c.phone||c.mobile, c.city, open, totSale, totPaid, metalAdv);
        });
      }
      if(rarState.partyType === 'All' || rarState.partyType === 'Suppliers (Creditors)'){
        sups.forEach(s => {
          const open = -n(s.openingAmount);
          const sPur = [...purch, ...oldPurch].filter(p=>p.supplierId===s.id);
          const totPur = sPur.reduce((a,p)=>a+n(p.amountDebit??p.totalAmount??p.netAmount??p.amount),0);
          const totPaid = sPur.reduce((a,p)=>a+n(p.paidAmount),0) + supPays.filter(p=>p.supplierId===s.id).reduce((a,p)=>a+n(p.amountCredit),0);
          const balObj = typeof rpSupplierBalance==='function' ? rpSupplierBalance(s.id) : {gold:0,silver:0};
          pushParty(s.name, s.parentGroup||'Sundry Creditors', s.phone||s.mobile, s.city, open, totPaid, totPur, n(balObj.gold)+n(balObj.silver));
        });
      }
      if(rarState.partyType === 'All' || rarState.partyType === 'Custom Ledgers'){
        ledgersList.forEach(l => {
          const open = (l.openingSide==='CR'?-1:1)*n(l.openingAmount);
          let dr=0, cr=0;
          postings.forEach(post => {
            if(post.measure!=='Amount') return;
            (post.lines||[]).filter(ln=>ln.ledgerId===l.id&&inRange(ln.date||post.date)).forEach(ln=>{ dr+=n(ln.debit); cr+=n(ln.credit); });
          });
          pushParty(l.name, l.parentGroup, l.mobile, l.city, open, dr, cr, n(l.pureWeight));
        });
      }
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','',rateMoney(totOpen),rateMoney(totDr),rateMoney(totCr),fmt(totWt)+' g','<b>'+rateMoney(Math.abs(totBal))+' '+(totBal>=0?'DR':'CR')+'</b>','']);
      content = rows.length ? rarTable(['Ledger','Parent Group','Mobile No','City','Opening ₹','Debit ₹','Credit ₹','Metal g','Balance Amount ₹','Status'], rows) : '<p class="empty">No matching outstanding accounts.</p>';
    }
    else if(name === 'Outstanding V1 Report'){
      subToolbar = '<select onchange="rarState.ageBucket=this.value;render()">'+opts(['All','0–30 Days','31–60 Days','61–90 Days','90+ Days'], rarState.ageBucket)+'</select>';
      const rows = [];
      let totBill=0, totPaid=0, totPend=0;
      const bucketOf = days => days<=30?'0–30 Days':days<=60?'31–60 Days':days<=90?'61–90 Days':'90+ Days';
      const pushBill = (dt, no, party, mobile, type, billAmt, paidAmt) => {
        const pend = rbRound(billAmt - paidAmt);
        if(pend <= 0.01) return;
        const d = dayOf(dt) || rbNow().slice(0,10);
        const age = Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 86400000));
        const b = bucketOf(age);
        if(rarState.ageBucket !== 'All' && b !== rarState.ageBucket) return;
        totBill+=billAmt; totPaid+=paidAmt; totPend+=pend;
        rows.push([esc(d), '<b>'+esc(no)+'</b>', '<b>'+esc(party)+'</b>', esc(mobile||'—'), esc(type), rateMoney(billAmt), rateMoney(paidAmt), '<b>'+rateMoney(pend)+'</b>', age+' days', '<span class="rco-badge '+(age>60?'rco-badge-cancel':'rco-badge-wait')+'">'+esc(b)+'</span>']);
      };
      sales.forEach(s => {
        const c = getCust(s.partyId), pend = typeof rbInvoiceBalance==='function' ? rbInvoiceBalance(s) : Math.max(0, n(s.amount)-n(s.collectedAmount)-n(s.cashAdvanceAmount));
        pushBill(s.when||s.createdAt, s.documentNo||s.id.slice(0,8), c.name||'Customer', c.phone||c.mobile, 'Customer Sale Bill', n(s.amount), n(s.amount)-pend);
      });
      purch.forEach(p => {
        const s = getSup(p.supplierId), tot = n(p.amountDebit??p.totalAmount??p.amount), paid = n(p.paidAmount);
        pushBill(p.when||p.date||p.createdAt, p.documentNo||p.billNo||p.id.slice(0,8), s.name||'Supplier', s.phone||s.mobile, 'Supplier Purchase Bill', tot, paid);
      });
      postings.filter(p=>p.voucherType==='Bill Entry'&&p.billStatus!=='Delivered'&&inRange(p.date)).forEach(p => {
        const l = getLedger(p.destination);
        pushBill(p.date, p.billNumber||p.number, l.name||'Billing Ledger', l.mobile, 'Bill Entry ('+(p.direction||'Debit')+')', n(p.amount), 0);
      });
      rows.sort((a,b)=>parseInt(b[8])-parseInt(a[8]));
      if(rows.length) rows.push(['<b>Total ('+rows.length+' Bills)</b>','','','','','<b>'+rateMoney(totBill)+'</b>','<b>'+rateMoney(totPaid)+'</b>','<b>'+rateMoney(totPend)+'</b>','','']);
      content = rows.length ? rarTable(['Bill Date','Bill No.','Ledger / Party','Mobile','Voucher Type','Bill Amount ₹','Paid / Adjusted ₹','Pending Balance ₹','Age (Days)','Age Bucket'], rows) : '<p class="empty">No pending bill-wise outstandings in this period.</p>';
    }
    else if(name === 'Advance Amount Report' || name === 'Advance Amount Report V1'){
      const isV1 = name === 'Advance Amount Report V1';
      subToolbar = '<select onchange="rarState.advType=this.value;render()">'+opts(['All','Customer Cash Advance','Metal Weight Advance','Chit Scheme Advance','Retail Order Advance','Ledger Advance'], rarState.advType)+'</select>';
      const rows = [];
      let totOpen=0, totCr=0, totUsed=0, totClose=0, totWt=0;
      const addAdv = (dt, ref, party, mobile, type, openAmt, crAmt, usedAmt, wtG=0) => {
        if(rarState.advType !== 'All' && rarState.advType !== type) return;
        const closeAmt = Math.max(0, rbRound(openAmt + crAmt - usedAmt));
        totOpen+=openAmt; totCr+=crAmt; totUsed+=usedAmt; totClose+=closeAmt; totWt+=wtG;
        if(isV1){
          rows.push(['<b>'+esc(party)+'</b>', esc(ref), esc(mobile||'—'), esc(type), fmt(wtG)+' g', rateMoney(openAmt), rateMoney(crAmt), rateMoney(usedAmt), '<b>'+rateMoney(closeAmt)+'</b>']);
        } else {
          rows.push([esc(dayOf(dt)||'—'), '<b>'+esc(party)+'</b>', esc(ref), esc(mobile||'—'), esc(type), fmt(wtG)+' g', rateMoney(openAmt+crAmt), rateMoney(usedAmt), '<b>'+rateMoney(closeAmt)+'</b>']);
        }
      };
      // 1. Customer Amount Advances
      (db.payments||[]).filter(p=>p.accountType==='customer'&&p.retailKind==='advance').forEach(p=>{
        const d = dayOf(p.when||p.date||p.createdAt), c = getCust(p.partyId);
        const used = typeof rbCashUsed==='function' ? rbCashUsed(p.id) : 0;
        const beforeFrom = rarState.from && d && d < rarState.from;
        if(!beforeFrom && !inRange(d)) return;
        addAdv(d, p.documentNo||p.reference||p.id.slice(0,8), c.name||'Customer', c.phone||c.mobile, 'Customer Cash Advance', beforeFrom?n(p.amount):0, beforeFrom?0:n(p.amount), used, 0);
      });
      // 2. Metal Weight Advances
      (db.payments||[]).filter(p=>p.accountType==='customer'&&p.retailKind==='metal').forEach(p=>{
        const d = dayOf(p.when||p.date||p.createdAt), c = getCust(p.partyId);
        const usedG = typeof rbMetalUsed==='function' ? rbMetalUsed(p.id) : 0;
        const remG = Math.max(0, rbGrams(n(p.pureGrams) - usedG));
        const rate = n(p.rate||db.rates?.gold24||0);
        if(!inRange(d) && !(rarState.from && d < rarState.from)) return;
        addAdv(d, p.documentNo||p.reference||p.id.slice(0,8), c.name||'Customer', c.phone||c.mobile, 'Metal Weight Advance', 0, rbRound(n(p.pureGrams)*rate), rbRound(usedG*rate), remG);
      });
      // 3. Chit Passbook Advances
      docs('retail-chit-mapping').forEach(m=>{
        const c = getCust(m.customerId);
        const entries = docs('retail-chit-entry').filter(e=>e.mappingId===m.id);
        const openPaid = rarState.from ? entries.filter(e=>dayOf(e.date||e.createdAt)<rarState.from).reduce((a,e)=>a+n(e.amount),0) : 0;
        const periodPaid = entries.filter(e=>inRange(e.date||e.createdAt)).reduce((a,e)=>a+n(e.amount),0);
        const wt = entries.reduce((a,e)=>a+n(e.metalWeight||e.weight),0);
        addAdv(m.startDate||m.createdAt, m.chitNumber, c.name||'Customer', c.phone||c.mobile, 'Chit Scheme Advance', openPaid, periodPaid, n(m.settledAmount||0), wt);
      });
      // 4. Retail Order Advances
      orders.filter(o=>n(o.advanceAmount)>0&&inRange(o.date||o.createdAt)).forEach(o=>{
        const c = getCust(o.customerId);
        const used = o.status==='Closed' || o.convertedBillId ? n(o.advanceAmount) : 0;
        addAdv(o.date||o.createdAt, o.orderNo||o.id.slice(0,8), o.customerName||c.name||'Customer', o.mobile||c.phone, 'Retail Order Advance', 0, n(o.advanceAmount), used, n(o.oldMetalNetWt));
      });
      // 5. Ledger Opening & Bill Entry Advances
      ledgersList.filter(l=>l.openingIsAdvance&&n(l.openingAmount)>0).forEach(l=>{
        addAdv(l.openingEffectiveDate, 'OB-ADV', l.name, l.mobile, 'Ledger Advance', n(l.openingAmount), 0, 0, n(l.pureWeight));
      });
      if(isV1){
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totOpen)+'</b>','<b>'+rateMoney(totCr)+'</b>','<b>'+rateMoney(totUsed)+'</b>','<b>'+rateMoney(totClose)+'</b>']);
        content = rows.length ? rarTable(['Ledger Name','Advance / Chit #','Mobile','Advance Type','Metal Wt g','Opening Advance ₹','Period Received ₹','Used / Settled ₹','Closing Advance ₹'], rows) : '<p class="empty">No advance balances found.</p>';
      } else {
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totOpen+totCr)+'</b>','<b>'+rateMoney(totUsed)+'</b>','<b>'+rateMoney(totClose)+'</b>']);
        content = rows.length ? rarTable(['Date','Ledger Name','Chit / Advance #','Mobile','Advance Type','Metal Wt g','Credit ₹','Used / Settled ₹','Closing Advance ₹'], rows) : '<p class="empty">No advance or chit balances.</p>';
      }
    }
    else if(name === 'Expense Report'){
      const ledgers=new Map(ledgersList.map(row=>[row.id,row]));
      const expenseGroups=new Set(window.rgaAllAccountingGroups().flat.filter(group=>group.type==='EXPENSE').map(group=>group.name));
      subToolbar = ['Detailed','Ledger Summary'].map(m=>'<button type="button" class="'+(rarState.expView===m?'primary':'')+'" onclick="rarState.expView=\''+m+'\';render()">'+m+'</button>').join(' ');
      const rows=[];
      let total=0;
      for(const entry of postings){
        if(entry.measure!=='Amount')continue;
        for(const line of entry.lines||[]){
          const date=line.date||entry.date, ledger=ledgers.get(line.ledgerId);
          if(!ledger||!expenseGroups.has(ledger.parentGroup)||!inRange(date))continue;
          const net=n(line.debit)-n(line.credit);
          total+=net;
          rows.push({date:dayOf(date),number:entry.number,ledger:ledger.name,group:ledger.parentGroup,mode:entry.paymentMode||'Cash',notes:line.remarks||entry.detail||entry.description||'—',net});
        }
      }
      if(rarState.expView === 'Ledger Summary'){
        const byLed = new Map();
        rows.forEach(r => {
          const g = byLed.get(r.ledger) || { ledger:r.ledger, group:r.group, cnt:0, net:0 };
          g.cnt++; g.net+=r.net; byLed.set(r.ledger, g);
        });
        const sRows = [...byLed.values()].sort((a,b)=>b.net-a.net).map(g=>['<b>'+esc(g.ledger)+'</b>',esc(g.group),g.cnt,'<b>'+rateMoney(g.net)+'</b>']);
        if(sRows.length) sRows.push(['<b>Total</b>','',rows.length,'<b>'+rateMoney(total)+'</b>']);
        content = sRows.length ? rarTable(['Expense Ledger','Expense Group','Vouchers','Net Expense ₹'], sRows) : '<p class="empty">No posted expenses in this period.</p>';
      } else {
        rows.sort((a,b)=>b.date.localeCompare(a.date));
        const dRows = rows.map(r=>[esc(r.date),'<b>'+esc(r.number)+'</b>','<b>'+esc(r.ledger)+'</b>',esc(r.group),esc(r.mode),esc(r.notes),rateMoney(r.net)]);
        if(dRows.length) dRows.push(['<b>Total ('+dRows.length+')</b>','','','','','','<b>'+rateMoney(total)+'</b>']);
        content=dRows.length?rarTable(['Date','Voucher no.','Expense ledger','Group','Payment Mode','Narration','Net expense ₹'],dRows):'<p class="empty">No posted expenses in this period.</p>';
      }
    }
    else if(name === 'Trial Balance Report' || name === 'Profit Loss Report' || name === 'Balance Sheet Report'){
      const lines = typeof window.rgaComputeAccountLines === 'function' ? window.rgaComputeAccountLines(rarState.to||rbNow().slice(0,10)) : [];
      const groupRollup = {};
      lines.forEach(l => {
        if(!groupRollup[l.parentGroup]) groupRollup[l.parentGroup] = { name:l.parentGroup, type:l.groupType, debit:0, credit:0, grossWt:0, pureWt:0, items:[] };
        groupRollup[l.parentGroup].debit += n(l.debit);
        groupRollup[l.parentGroup].credit += n(l.credit);
        groupRollup[l.parentGroup].grossWt += n(l.grossWt);
        groupRollup[l.parentGroup].pureWt += n(l.pureWt);
        groupRollup[l.parentGroup].items.push(l);
      });
      const groups = Object.values(groupRollup).sort((a,b)=>a.name.localeCompare(b.name));
      if(name === 'Trial Balance Report'){
        subToolbar = '<label style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" '+(rarState.tbDetail?'checked':'')+' onchange="rarState.tbDetail=this.checked;render()"> Expand Individual Ledgers</label>';
        const rows = [];
        let totDr=0, totCr=0, totPure=0;
        groups.forEach(g => {
          totDr+=g.debit; totCr+=g.credit; totPure+=g.pureWt;
          const net = g.debit - g.credit;
          rows.push(['<b>'+esc(g.name)+'</b>', esc(g.type), g.items.length, fmt(g.pureWt)+' g', rateMoney(g.debit), rateMoney(g.credit), '<b>'+rateMoney(Math.abs(net))+' '+(net>=0?'DR':'CR')+'</b>']);
          if(rarState.tbDetail){
            g.items.forEach(it => {
              const lNet = it.debit - it.credit;
              rows.push(['↳ '+esc(it.ledgerName), esc(g.name), 1, fmt(it.pureWt)+' g', rateMoney(it.debit), rateMoney(it.credit), rateMoney(Math.abs(lNet))+' '+(lNet>=0?'DR':'CR')]);
            });
          }
        });
        if(rows.length) rows.push(['<b>GRAND TOTAL (Diff: '+rateMoney(Math.abs(totDr-totCr))+')</b>','',lines.length,'<b>'+fmt(totPure)+' g</b>','<b>'+rateMoney(totDr)+'</b>','<b>'+rateMoney(totCr)+'</b>','<b>'+rateMoney(Math.abs(totDr-totCr))+'</b>']);
        content = rows.length ? rarTable(['Particulars (Group / Ledger)','Account Type','Ledgers','Pure Wt g','Debit ₹','Credit ₹','Closing Balance ₹'], rows) : '<p class="empty">No accounting balances recorded.</p>';
      }
      else if(name === 'Profit Loss Report'){
        const expGroups = groups.filter(g=>g.type==='EXPENSE');
        const incGroups = groups.filter(g=>g.type==='INCOME');
        const retAmt = returns.reduce((a,r)=>a+n(r.amount),0);
        const totExp = expGroups.reduce((s,g)=>s+(g.debit-g.credit),0);
        const totInc = Math.max(0, incGroups.reduce((s,g)=>s+(g.credit-g.debit),0) - retAmt);
        const net = totInc - totExp;
        const rows = [
          ...incGroups.map(g=>['Income (Cr)','<b>'+esc(g.name)+'</b>',rateMoney(0),rateMoney(g.credit-g.debit)]),
          ...(retAmt>0?[['Less: Sales Returns','Sales Return Credits',rateMoney(retAmt),rateMoney(0)]]:[]),
          ...expGroups.map(g=>['Expense (Dr)','<b>'+esc(g.name)+'</b>',rateMoney(g.debit-g.credit),rateMoney(0)]),
          ['<b>'+(net>=0?'NET PROFIT':'NET LOSS')+'</b>','<b>Period Profit & Loss Result</b>','<b>'+rateMoney(totExp+(net>0?net:0))+'</b>','<b>'+rateMoney(totInc+(net<0?Math.abs(net):0))+'</b>']
        ];
        content = '<p>Total Income <b>'+rateMoney(totInc)+'</b> · Total Expense <b>'+rateMoney(totExp)+'</b> · '+(net>=0?'Net Profit':'Net Loss')+' <b>'+rateMoney(Math.abs(net))+'</b></p>'
          + rarTable(['Side','Account Group / Particulars','Expense / Debit ₹','Income / Credit ₹'], rows);
      }
      else {
        const liabGroups = groups.filter(g=>g.type==='LIABILITY'||g.type==='EQUITY');
        const assetGroups = groups.filter(g=>g.type==='ASSET');
        const incTotal = groups.filter(g=>g.type==='INCOME').reduce((s,g)=>s+(g.credit-g.debit),0) - returns.reduce((a,r)=>a+n(r.amount),0);
        const expTotal = groups.filter(g=>g.type==='EXPENSE').reduce((s,g)=>s+(g.debit-g.credit),0);
        const netProfit = incTotal - expTotal;
        const totLiab = liabGroups.reduce((s,g)=>s+(g.credit-g.debit),0) + (netProfit>0?netProfit:0);
        const totAsset = assetGroups.reduce((s,g)=>s+(g.debit-g.credit),0) + (netProfit<0?Math.abs(netProfit):0);
        const rows = [
          ...liabGroups.map(g=>['Liability / Equity','<b>'+esc(g.name)+'</b>',rateMoney(g.credit-g.debit),rateMoney(0)]),
          ...(netProfit>0?[['Equity (P&L)','<b>Net Profit (Transferred)</b>',rateMoney(netProfit),rateMoney(0)]]:[]),
          ...assetGroups.map(g=>['Asset','<b>'+esc(g.name)+'</b>',rateMoney(0),rateMoney(g.debit-g.credit)]),
          ...(netProfit<0?[['Asset (P&L)','<b>Net Loss (Transferred)</b>',rateMoney(0),rateMoney(Math.abs(netProfit))]]:[]),
          ['<b>BALANCE SHEET TOTAL</b>','<b>Liabilities vs Assets</b>','<b>'+rateMoney(totLiab)+'</b>','<b>'+rateMoney(totAsset)+'</b>']
        ];
        content = rarTable(['Classification','Account Group','Liabilities & Equity ₹','Assets ₹'], rows);
      }
    }

    // =========================================================================
    // 3. SALES, TRADE, PROFIT, TARGET, TRAY, DIAMOND, VISITOR, BRANCH, INFLUENCE
    // =========================================================================
    else if(name === 'Sales Abstract Report' || name === 'Sale Bill Summary Matrix'){
      const modes = ['Date','Month','Product Group','Metal','Payment Mode','Summary Matrix'];
      const curMode = name === 'Sale Bill Summary Matrix' && rarState.salesGroup === 'Date' ? 'Summary Matrix' : rarState.salesGroup;
      subToolbar = '<label>Group By <select onchange="rarState.salesGroup=this.value;render()">'+opts(modes, curMode)+'</select></label>';
      if(curMode === 'Summary Matrix'){
        const grossSales = sales.reduce((a,s)=>a+n(s.amount)+n(s.discount),0);
        const disc = sales.reduce((a,s)=>a+n(s.discount),0);
        const gst = sales.reduce((a,s)=>a+n(s.gstAmount),0);
        const og = sales.reduce((a,s)=>a+n(s.exchangeAmount),0);
        const chit = sales.reduce((a,s)=>a+n(s.chitAmount),0);
        const ret = returns.reduce((a,r)=>a+n(r.amount),0);
        const net = sales.reduce((a,s)=>a+n(s.amount),0);
        const wt = sales.reduce((a,s)=>a+n(s.weight),0);
        content = rarTable(['Particulars','Bills / Vouchers','Weight (g)','Amount ₹'], [
          ['Total Gross Sales', sales.length, fmt(wt)+' g', rateMoney(grossSales)],
          ['Less: Bill Discount', '—', '—', '− '+rateMoney(disc)],
          ['CGST @ 1.5%', '—', '—', rateMoney(gst/2)],
          ['SGST @ 1.5%', '—', '—', rateMoney(gst/2)],
          ['Less: Old Jewel Exchange Credit', '—', '—', '− '+rateMoney(og)],
          ['Less: Chit Scheme Applied', '—', '—', '− '+rateMoney(chit)],
          ['Less: Sales Returns Credit', returns.length, '—', '− '+rateMoney(ret)],
          ['<b>NET SALES REALIZED</b>', '<b>'+sales.length+'</b>', '<b>'+fmt(wt)+' g</b>', '<b>'+rateMoney(net-og-ret)+'</b>']
        ]);
      } else {
        const groups = new Map();
        const addG = (key, pcs, gross, netWt, wst, mc, stone, disc, gst, og, chit, amt, col) => {
          const g = groups.get(key) || { key, bills:0, pcs:0, gross:0, netWt:0, wst:0, mc:0, stone:0, disc:0, gst:0, og:0, chit:0, amt:0, col:0 };
          g.bills++; g.pcs+=pcs; g.gross+=gross; g.netWt+=netWt; g.wst+=wst; g.mc+=mc; g.stone+=stone; g.disc+=disc; g.gst+=gst; g.og+=og; g.chit+=chit; g.amt+=amt; g.col+=col;
          groups.set(key, g);
        };
        sales.forEach(s => {
          const d = dayOf(s.when||s.createdAt), items = saleItemsOf(s);
          if(curMode === 'Product Group' || curMode === 'Metal'){
            items.forEach(it => {
              const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
              const k = curMode==='Metal' ? prodMetalOf(it.product, it.metalType) : prodGroupOf(it.product, it.productGroup);
              addG(k, n(it.pieces)||1, n(it.grossWeight||it.weight), n(it.netWeight||it.weight), n(it.wastageGrams), n(it.makingTotal), n(it.stoneAmount), n(s.discount)*share, n(s.gstAmount)*share, n(s.exchangeAmount)*share, n(s.chitAmount)*share, n(s.amount)*share, n(s.collectedAmount)*share);
            });
          } else {
            const k = curMode==='Month' ? d.slice(0,7) : curMode==='Payment Mode' ? (s.collectedMethod||'Cash') : d;
            const gross = items.reduce((a,it)=>a+n(it.grossWeight||it.weight),0);
            const wst = items.reduce((a,it)=>a+n(it.wastageGrams),0);
            const mc = items.reduce((a,it)=>a+n(it.makingTotal),0);
            const stone = items.reduce((a,it)=>a+n(it.stoneAmount),0);
            addG(k, n(s.pieces)||items.length, gross||n(s.weight), n(s.weight), wst, mc, stone, n(s.discount), n(s.gstAmount), n(s.exchangeAmount), n(s.chitAmount), n(s.amount), n(s.collectedAmount));
          }
        });
        const list = [...groups.values()].sort((a,b)=>String(b.key).localeCompare(String(a.key)));
        const rows = list.map(g=>['<b>'+esc(g.key)+'</b>',g.bills,g.pcs,fmt(g.gross)+' g',fmt(g.netWt)+' g',fmt(g.wst)+' g',rateMoney(g.mc),rateMoney(g.stone),rateMoney(g.disc),rateMoney(g.gst),rateMoney(g.og),rateMoney(g.chit),'<b>'+rateMoney(g.amt)+'</b>',rateMoney(g.col)]);
        const sumK = k => list.reduce((a,x)=>a+x[k],0);
        if(rows.length) rows.push(['<b>Total</b>',sumK('bills'),sumK('pcs'),fmt(sumK('gross'))+' g',fmt(sumK('netWt'))+' g',fmt(sumK('wst'))+' g',rateMoney(sumK('mc')),rateMoney(sumK('stone')),rateMoney(sumK('disc')),rateMoney(sumK('gst')),rateMoney(sumK('og')),rateMoney(sumK('chit')),'<b>'+rateMoney(sumK('amt'))+'</b>',rateMoney(sumK('col'))]);
        content = rows.length ? rarTable([curMode,'Bills','Pcs','Gross Wt g','Net Wt g','Wastage g','Making ₹','Stone ₹','Discount ₹','GST ₹','Old Gold ₹','Chit ₹','Net Sales ₹','Collected ₹'], rows) : '<p class="empty">No sales abstract data in this period.</p>';
      }
    }
    else if(name === 'Sales Register Report' || name === 'Sale Register (26 Col)'){
      subToolbar = '<select onchange="rarState.metal=this.value;render()">'+opts(['All','Gold','Silver','Diamond','Platinum'], rarState.metal)+'</select>';
      const rows = [];
      let totPcs=0, totGross=0, totLess=0, totNet=0, totMc=0, totStone=0, totDisc=0, totGst=0, totOg=0, totChit=0, totAmt=0, totPaid=0, totBal=0;
      sales.forEach(s => {
        const c = getCust(s.partyId), items = saleItemsOf(s);
        items.forEach(it => {
          const metal = prodMetalOf(it.product, it.metalType);
          if(rarState.metal !== 'All' && metal !== rarState.metal) return;
          const pg = prodGroupOf(it.product, it.productGroup);
          const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
          const pcs = n(it.pieces)||1, gross = n(it.grossWeight||it.weight), less = n(it.lessWeight||0), net = n(it.netWeight||it.weight);
          const mc = n(it.makingTotal), stone = n(it.stoneAmount), disc = n(s.discount)*share, gst = n(s.gstAmount)*share;
          const og = n(s.exchangeAmount)*share, chit = (n(s.chitAmount)+n(s.cashAdvanceAmount))*share, amt = n(s.amount)*share, paid = n(s.collectedAmount)*share;
          const bal = Math.max(0, amt - og - chit - paid);
          totPcs+=pcs; totGross+=gross; totLess+=less; totNet+=net; totMc+=mc; totStone+=stone; totDisc+=disc; totGst+=gst; totOg+=og; totChit+=chit; totAmt+=amt; totPaid+=paid; totBal+=bal;
          rows.push([
            esc(dayOf(s.when||s.createdAt)),
            '<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>',
            '<b>'+esc(c.name||'Customer')+'</b>',
            esc(c.phone||c.mobile||'—'),
            esc(c.city||'—'),
            esc(c.gst||'Unregistered'),
            esc(pg),
            esc(it.product||'Jewellery'),
            esc(it.tagCode||it.huid||'—'),
            esc(metal),
            n(it.purity)+'%',
            pcs,
            fmt(gross)+' g',
            fmt(less)+' g',
            fmt(net)+' g',
            n(it.wastage)+(it.wastageMode==='grams'?' g':'%'),
            rateMoney(it.rate||s.ratePerGram||0),
            rateMoney(mc),
            rateMoney(stone),
            rateMoney(disc),
            rateMoney(gst/2),
            rateMoney(gst/2),
            rateMoney(og),
            rateMoney(chit),
            '<b>'+rateMoney(amt)+'</b>',
            rateMoney(paid),
            esc(s.collectedMethod||'Cash'),
            esc(s.salesperson||s.counter||'Showroom'),
            rateMoney(bal)
          ]);
        });
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','','','','',totPcs,fmt(totGross)+' g',fmt(totLess)+' g',fmt(totNet)+' g','','',rateMoney(totMc),rateMoney(totStone),rateMoney(totDisc),rateMoney(totGst/2),rateMoney(totGst/2),rateMoney(totOg),rateMoney(totChit),'<b>'+rateMoney(totAmt)+'</b>',rateMoney(totPaid),'','',rateMoney(totBal)]);
      content = rows.length ? rarTable(['Date','Bill No','Customer','Mobile','City','GSTIN','Product Group','Product','Tag / HUID','Metal','Purity','Pcs','Gross Wt','Less Wt','Net Wt','Wastage','Rate/g ₹','Making ₹','Stone ₹','Discount ₹','CGST ₹','SGST ₹','Old Gold ₹','Chit/Adv ₹','Net Amt ₹','Paid ₹','Method','Counter/Staff','Balance ₹'], rows) : '<p class="empty">No sales register records in this period.</p>';
    }
    else if(name === 'Sales Return Abstract Report'){
      subToolbar = ['Detailed','Product Summary'].map(m=>'<button type="button" class="'+(rarState.returnView===m?'primary':'')+'" onclick="rarState.returnView=\''+m+'\';render()">'+m+'</button>').join(' ');
      if(rarState.returnView === 'Product Summary'){
        const grp = new Map();
        returns.forEach(r => {
          const k = r.product || 'Jewellery';
          const g = grp.get(k) || { product:k, cnt:0, wt:0, amt:0 };
          g.cnt++; g.wt+=n(r.returnWeight||r.weight); g.amt+=n(r.amount);
          grp.set(k, g);
        });
        const list = [...grp.values()].sort((a,b)=>b.amt-a.amt);
        const rows = list.map(g=>['<b>'+esc(g.product)+'</b>',g.cnt,fmt(g.wt)+' g','<b>'+rateMoney(g.amt)+'</b>']);
        if(rows.length) rows.push(['<b>Total</b>',returns.length,fmt(list.reduce((a,x)=>a+x.wt,0))+' g','<b>'+rateMoney(list.reduce((a,x)=>a+x.amt,0))+'</b>']);
        content = rows.length ? rarTable(['Product','Return Count','Return Weight g','Return Credit ₹'], rows) : '<p class="empty">No sales returns in this period.</p>';
      } else {
        let totWt=0, totAmt=0;
        const rows = returns.map(r => {
          const c = getCust(r.partyId), wt = n(r.returnWeight||r.weight), amt = n(r.amount);
          totWt+=wt; totAmt+=amt;
          return [esc(dayOf(r.when||r.date||r.createdAt)),'<b>'+esc(r.documentNo||r.reference||r.id.slice(0,8))+'</b>',esc(r.invoiceNo||r.invoiceId||'—'),'<b>'+esc(c.name||'Customer')+'</b>',esc(c.phone||c.mobile||'—'),esc(r.product||'Jewellery'),fmt(wt)+' g','<b>'+rateMoney(amt)+'</b>',esc(r.reason||'Exchange / Return'),esc(r.notes||'—')];
        });
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','<b>'+fmt(totWt)+' g</b>','<b>'+rateMoney(totAmt)+'</b>','','']);
        content = rows.length ? rarTable(['Date','Return No.','Orig. Bill No.','Customer','Mobile','Product','Return Wt g','Return Credit ₹','Reason','Notes'], rows) : '<p class="empty">No sales returns in this period.</p>';
      }
    }
    else if(name === 'Sales Purchase'){
      subToolbar = ['Date','Month','Metal'].map(m=>'<button type="button" class="'+(rarState.spGroup===m?'primary':'')+'" onclick="rarState.spGroup=\''+m+'\';render()">By '+m+'</button>').join(' ');
      const map = new Map();
      const slot = k => { if(!map.has(k)) map.set(k,{k,sBills:0,sWt:0,sAmt:0,pBills:0,pWt:0,pAmt:0,ogWt:0,ogAmt:0}); return map.get(k); };
      sales.forEach(s => {
        const d = dayOf(s.when||s.createdAt);
        if(rarState.spGroup==='Metal'){
          saleItemsOf(s).forEach(it=>{
            const g = slot(prodMetalOf(it.product,it.metalType));
            g.sBills++; g.sWt+=n(it.netWeight||it.weight); g.sAmt+=n(it.subtotal||s.amount);
          });
        } else {
          const g = slot(rarState.spGroup==='Month'?d.slice(0,7):d);
          g.sBills++; g.sWt+=n(s.weight); g.sAmt+=n(s.amount);
          g.ogWt+=n(s.exchangePureGrams); g.ogAmt+=n(s.exchangeAmount);
        }
      });
      purch.forEach(p => {
        const d = dayOf(p.when||p.date||p.createdAt);
        const k = rarState.spGroup==='Metal' ? (p.metal||p.items?.[0]?.metal||'Gold') : rarState.spGroup==='Month' ? d.slice(0,7) : d;
        const g = slot(k);
        g.pBills++; g.pWt+=n(p.netWeight||p.grossWeight); g.pAmt+=n(p.totalAmount||p.netAmount||p.amount);
      });
      oldPurch.forEach(p => {
        const d = dayOf(p.when||p.date||p.createdAt);
        const k = rarState.spGroup==='Metal' ? (p.metal||p.items?.[0]?.metal||'Gold') : rarState.spGroup==='Month' ? d.slice(0,7) : d;
        const g = slot(k);
        g.ogWt+=n(p.netWeight); g.ogAmt+=n(p.totalAmount||p.amount);
      });
      const list = [...map.values()].sort((a,b)=>String(b.k).localeCompare(String(a.k)));
      const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',g.sBills,fmt(g.sWt)+' g',rateMoney(g.sAmt),g.pBills,fmt(g.pWt)+' g',rateMoney(g.pAmt),fmt(g.ogWt)+' g',rateMoney(g.ogAmt),fmt(g.pWt+g.ogWt-g.sWt)+' g','<b>'+rateMoney(g.sAmt-g.pAmt-g.ogAmt)+'</b>']);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>',sumK('sBills'),fmt(sumK('sWt'))+' g',rateMoney(sumK('sAmt')),sumK('pBills'),fmt(sumK('pWt'))+' g',rateMoney(sumK('pAmt')),fmt(sumK('ogWt'))+' g',rateMoney(sumK('ogAmt')),fmt(sumK('pWt')+sumK('ogWt')-sumK('sWt'))+' g','<b>'+rateMoney(sumK('sAmt')-sumK('pAmt')-sumK('ogAmt'))+'</b>']);
      content = rows.length ? rarTable([rarState.spGroup,'Sale Bills','Sales Wt g','Sales Amt ₹','Purch. Bills','Purch. Wt g','Purch. Amt ₹','Old Gold Wt g','Old Gold ₹','Net Stock Flow g','Net Cash Margin ₹'], rows) : '<p class="empty">No sales or purchase comparison records in range.</p>';
    }
    else if(name === 'Top Customer' || name === 'Top Sales (Centralized)'){
      const dims = ['Product Group','Product','Product Size','Product Weight Range','Model','Employee','Supplier','Customer','City','Area'];
      const curDim = name === 'Top Customer' && rarState.topDim === 'Product Group' ? 'Customer' : rarState.topDim;
      subToolbar = '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><b>Report By:</b> '+dims.map(d=>'<button type="button" class="'+(curDim===d?'primary':'')+'" style="padding:4px 8px;font-size:11.5px" onclick="rarState.topDim=\''+d+'\';render()">'+esc(d)+'</button>').join('')+'</div>';
      const tagMap = new Map(tags.map(t=>[String(t.tagCode||'').toLowerCase(), t]));
      const slabOf = wt => wt<2?'0–2g':wt<5?'2–5g':wt<10?'5–10g':wt<20?'10–20g':wt<50?'20–50g':'50g+';
      const grp = {};
      sales.forEach(s => {
        const c = getCust(s.partyId), items = saleItemsOf(s);
        items.forEach(it => {
          const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
          const t = tagMap.get(String(it.tagCode||'').toLowerCase()) || {};
          const p = products.find(x=>String(x.name||'').toLowerCase()===String(it.product||'').toLowerCase()) || {};
          const wt = n(it.netWeight||it.weight), amt = n(s.amount)*share;
          let key = 'Unspecified';
          if(curDim==='Customer') key = c.name || 'Walk-in Customer';
          else if(curDim==='Product') key = it.product || 'Jewellery';
          else if(curDim==='Product Group') key = prodGroupOf(it.product, it.productGroup);
          else if(curDim==='Product Size') key = t.size || p.size || 'Standard Size';
          else if(curDim==='Product Weight Range') key = slabOf(wt);
          else if(curDim==='Model') key = t.model || p.category || it.product || 'Standard Model';
          else if(curDim==='Employee') key = s.salesperson || 'Showroom Staff';
          else if(curDim==='Supplier') key = t.supplier || sups[0]?.name || 'In-House Mfg';
          else if(curDim==='City') key = c.city || '—';
          else if(curDim==='Area') key = c.area || c.city || '—';
          if(!grp[key]) grp[key] = { key, mobile: c.phone||c.mobile||'—', city: c.city||'—', bills:0, qty:0, sWt:0, rWt:0, sAmt:0, rAmt:0, og:0, paid:0, last:'' };
          const d = dayOf(s.when||s.createdAt);
          grp[key].bills++; grp[key].qty += (n(it.pieces)||1); grp[key].sWt += wt; grp[key].sAmt += amt; grp[key].og += n(s.exchangeAmount)*share; grp[key].paid += n(s.collectedAmount)*share;
          if(d > grp[key].last) grp[key].last = d;
        });
      });
      returns.forEach(r => {
        const c = getCust(r.partyId);
        const key = curDim==='Customer' ? (c.name||'Customer') : curDim==='Product' ? (r.product||'Jewellery') : curDim==='Product Group' ? prodGroupOf(r.product) : curDim==='City' ? (c.city||'—') : curDim==='Area' ? (c.area||c.city||'—') : '';
        if(key && grp[key]){ grp[key].rWt += n(r.returnWeight||r.weight); grp[key].rAmt += n(r.amount); }
      });
      const list = Object.values(grp).sort((a,b)=>(b.sAmt-b.rAmt)-(a.sAmt-a.rAmt));
      const rows = list.map((r,i)=>[i+1, '<b>'+esc(r.key)+'</b>', r.bills, r.qty, fmt(r.sWt)+' g', fmt(r.rWt)+' g', '<b>'+fmt(r.sWt-r.rWt)+' g</b>', rateMoney(r.sAmt), rateMoney(r.rAmt), '<b>'+rateMoney(r.sAmt-r.rAmt)+'</b>']);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>','<b>'+list.length+' Ranked</b>',sumK('bills'),sumK('qty'),fmt(sumK('sWt'))+' g',fmt(sumK('rWt'))+' g','<b>'+fmt(sumK('sWt')-sumK('rWt'))+' g</b>',rateMoney(sumK('sAmt')),rateMoney(sumK('rAmt')),'<b>'+rateMoney(sumK('sAmt')-sumK('rAmt'))+'</b>']);
      content = rows.length ? rarTable(['S.No', curDim, 'Bills', 'Net Qty', 'Sales Wt g', 'Return Wt g', 'Net Wt g', 'Sales Amt ₹', 'Return Amt ₹', 'Net Amt ₹'], rows) : '<p class="empty">No sales data in range.</p>';
    }
    else if(name === 'Ledger Report'){
      const allLedgerNames = [...new Set([...custs.map(c=>c.name),...sups.map(s=>s.name),...ledgersList.map(l=>l.name)].filter(Boolean))].sort();
      subToolbar = '<select onchange="rarState.ledgerId=this.value;render()"><option value="">All Ledgers</option>'+opts(allLedgerNames, rarState.ledgerId)+'</select>';
      const entries = [];
      const addL = (dt, no, type, ledger, mode, notes, dr, cr, wd=0, wc=0, adv=0) => {
        if(rarState.ledgerId && ledger !== rarState.ledgerId) return;
        const d = dayOf(dt);
        if(!d || !inRange(d)) return;
        entries.push({ d, no, type, ledger:ledger||'—', mode:mode||'—', notes:notes||'—', dr:n(dr), cr:n(cr), wd:n(wd), wc:n(wc), adv:n(adv) });
      };
      sales.forEach(s => { const c=getCust(s.partyId); addL(s.when||s.createdAt, s.documentNo||s.id.slice(0,8), 'Sales Bill', c.name, s.collectedMethod||'Bill', s.product||'Jewellery Sale', s.amount, s.collectedAmount, s.weight, 0, s.cashAdvanceAmount); });
      returns.forEach(r => { const c=getCust(r.partyId); addL(r.when||r.date||r.createdAt, r.documentNo||r.id.slice(0,8), 'Sales Return', c.name, 'Credit Note', r.product||'Sales Return', 0, r.amount, 0, r.returnWeight||r.weight, 0); });
      pays.forEach(p => { const c=getCust(p.partyId); addL(p.when||p.date||p.createdAt, p.documentNo||p.reference||p.id.slice(0,8), 'Customer '+(p.retailKind||'Receipt'), c.name, p.method||'Cash', p.notes||'Receipt', 0, p.amount, 0, p.pureGrams, p.retailKind==='advance'?p.amount:0); });
      purch.forEach(p => { const s=getSup(p.supplierId); addL(p.when||p.date||p.createdAt, p.documentNo||p.id.slice(0,8), 'Purchase Bill', s.name, 'Purchase', p.remarks||'Purchase', p.paidAmount, p.totalAmount||p.amount, 0, p.netWeight, 0); });
      supPays.forEach(sp => { const s=getSup(sp.supplierId); addL(sp.when||sp.date||sp.createdAt, sp.documentNo||sp.id.slice(0,8), 'Supplier Payment', s.name, sp.method||'Cash', sp.notes||'Payment', sp.amountCredit, 0, n(sp.goldCredit)+n(sp.silverCredit), 0, 0); });
      const lMap = new Map(ledgersList.map(l=>[l.id,l]));
      postings.forEach(post => (post.lines||[]).forEach(ln => {
        const l = lMap.get(ln.ledgerId); if(!l) return;
        const isAmt = post.measure==='Amount';
        addL(ln.date||post.date, post.number, post.voucherType, l.name, post.paymentMode||'Voucher', ln.remarks||post.description, isAmt?ln.debit:0, isAmt?ln.credit:0, isAmt?0:ln.debit, isAmt?0:ln.credit, ln.advance?ln.credit:0);
      }));
      entries.sort((a,b)=>a.d.localeCompare(b.d));
      let totDr=0, totCr=0, totWd=0, totWc=0, totAdv=0;
      const rows = entries.map(e => {
        totDr+=e.dr; totCr+=e.cr; totWd+=e.wd; totWc+=e.wc; totAdv+=e.adv;
        return [esc(e.d),'<b>'+esc(e.no)+'</b>',esc(e.type),'<b>'+esc(e.ledger)+'</b>',esc(e.mode),esc(e.notes),rateMoney(e.dr),rateMoney(e.cr),fmt(e.wd)+' g',fmt(e.wc)+' g',rateMoney(e.adv)];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','<b>'+rateMoney(totDr)+'</b>','<b>'+rateMoney(totCr)+'</b>','<b>'+fmt(totWd)+' g</b>','<b>'+fmt(totWc)+' g</b>','<b>'+rateMoney(totAdv)+'</b>']);
      content = rows.length ? rarTable(['Date','Txn.No','Txn Type','Ledger Name','Mode','Narration','Amount (D)','Amount (C)','Wgt (D)','Wgt (C)','Advance'], rows) : '<p class="empty">No ledger transactions in this period.</p>';
    }
    else if(name === 'Customer Inactive Report'){
      const rows = custs.map(c => {
        const cSales = (db.sales||[]).filter(s=>s.accountType==='customer'&&s.partyId===c.id);
        const lastDate = cSales.map(s=>dayOf(s.when||s.createdAt)).sort().at(-1) || dayOf(c.createdAt) || '';
        const days = lastDate ? Math.max(0, Math.floor((Date.now()-Date.parse(lastDate))/86400000)) : 999;
        const totAmt = cSales.reduce((a,s)=>a+n(s.amount),0);
        const totWt = cSales.reduce((a,s)=>a+n(s.weight),0);
        return ['<b>'+esc(c.name)+'</b>',esc(c.phone||c.mobile||'—'),esc(c.city||c.area||'—'),cSales.length,fmt(totWt)+' g',rateMoney(totAmt),esc(lastDate||'Never'),days===999?'No Purchases':(days+' days'),days>30?'<span class="rco-badge rco-badge-cancel">Inactive</span>':'<span class="rco-badge rco-badge-open">Active</span>'];
      });
      content = rows.length ? rarTable(['Customer Name','Mobile','City / Area','Total Bills','Total Wt g','Total Sales ₹','Last Purchase Date','Inactive Days','Status'], rows) : '<p class="empty">No customer accounts found.</p>';
    }
    else if(name === 'Retail Purchase Report' || name === 'Purchase Abstract Report' || name === 'Top Purchase By Product'){
      const mode = name === 'Purchase Abstract Report' ? 'Abstract' : name === 'Top Purchase By Product' ? 'Product Group Wise' : rarState.purRepView;
      subToolbar = ['Supplier Wise','Product Group Wise','Abstract'].map(m=>'<button type="button" class="'+(mode===m?'primary':'')+'" onclick="rarState.active=\'Retail Purchase Report\';rarState.purRepView=\''+m+'\';render()">'+m+'</button>').join(' ');
      if(mode === 'Abstract'){
        const grp = new Map();
        [...purch, ...oldPurch].forEach(p => purchItemsOf(p).forEach(it => {
          const k = it.metal || (p.kind==='old-purchase'?'Old Gold':'Gold');
          const g = grp.get(k) || { k, gross:0, amt:0, tax:0, tot:0 };
          const share = n(p.subtotal)>0 ? n(it.subtotal)/n(p.subtotal) : 1;
          g.gross += n(it.grossWeight||p.grossWeight);
          g.amt += n(it.subtotal||p.subtotal||p.totalAmount);
          g.tax += n(p.gstAmount)*share;
          g.tot += n(p.totalAmount||p.amount)*share;
          grp.set(k, g);
        }));
        const list = [...grp.values()];
        const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',fmt(g.gross)+' g',rateMoney(g.amt),rateMoney(g.tax),'<b>'+rateMoney(g.tot)+'</b>']);
        if(rows.length) rows.push(['<b>GRAND TOTAL</b>','<b>'+fmt(list.reduce((a,x)=>a+x.gross,0))+' g</b>','<b>'+rateMoney(list.reduce((a,x)=>a+x.amt,0))+'</b>','<b>'+rateMoney(list.reduce((a,x)=>a+x.tax,0))+'</b>','<b>'+rateMoney(list.reduce((a,x)=>a+x.tot,0))+'</b>']);
        content = rows.length ? rarTable(['PARTICULAR','GRSWT','AMOUNT','TAX','TOTAL'], rows) : '<p class="empty">No purchase abstract records.</p>';
      } else {
        const byProd = mode === 'Product Group Wise';
        const grp = new Map();
        [...purch, ...oldPurch].forEach(p => {
          const s = getSup(p.supplierId);
          purchItemsOf(p).forEach(it => {
            const k = byProd ? (it.product||'Jewellery') : (s.name||'Supplier');
            const g = grp.get(k) || { k, qty:0, gross:0, pure:0, amt:0 };
            g.qty += n(it.pieces||1); g.gross += n(it.grossWeight||p.grossWeight); g.pure += n(it.payablePure||it.pureWeight||p.goldPure); g.amt += n(it.subtotal||p.totalAmount);
            grp.set(k, g);
          });
        });
        const list = [...grp.values()].sort((a,b)=>b.gross-a.gross);
        const rows = list.map((g,i)=>[i+1,'<b>'+esc(g.k)+'</b>',g.qty,fmt(g.gross)+' g',fmt(g.pure)+' g','<b>'+rateMoney(g.amt)+'</b>']);
        if(rows.length) rows.push(['<b>Total</b>','',list.reduce((a,x)=>a+x.qty,0),'<b>'+fmt(list.reduce((a,x)=>a+x.gross,0))+' g</b>','<b>'+fmt(list.reduce((a,x)=>a+x.pure,0))+' g</b>','<b>'+rateMoney(list.reduce((a,x)=>a+x.amt,0))+'</b>']);
        content = rows.length ? rarTable(['S.No',byProd?'Product':'Supplier Name','QTY','Total Gross Wt','Total Pure Wt','Amount ₹'], rows) : '<p class="empty">No purchase records in this period.</p>';
      }
    }
    else if(name === 'Team Analysis Report'){
      const grp = new Map();
      const slot = k => { const key=k||'Showroom Team'; if(!grp.has(key)) grp.set(key,{k:key,sWt:0,sAmt:0,rWt:0,rAmt:0,outWt:0,outAmt:0}); return grp.get(key); };
      sales.forEach(s => {
        const g = slot(s.salesperson||getCust(s.partyId).team||'Showroom Team');
        const bal = typeof rbInvoiceBalance==='function' ? rbInvoiceBalance(s) : Math.max(0,n(s.amount)-n(s.collectedAmount));
        g.sWt += n(s.weight); g.sAmt += n(s.amount); g.outAmt += bal;
      });
      returns.forEach(r => {
        const g = slot(getCust(r.partyId).team||'Showroom Team');
        g.rWt += n(r.returnWeight||r.weight); g.rAmt += n(r.amount);
      });
      const list = [...grp.values()].sort((a,b)=>b.sAmt-a.sAmt);
      const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',fmt(g.sWt)+' g',rateMoney(g.sAmt),fmt(g.rWt)+' g',rateMoney(g.rAmt),'<b>'+fmt(g.sWt-g.rWt)+' g</b>','<b>'+rateMoney(g.sAmt-g.rAmt)+'</b>',fmt(g.outWt)+' g',rateMoney(g.outAmt)]);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>',fmt(sumK('sWt'))+' g',rateMoney(sumK('sAmt')),fmt(sumK('rWt'))+' g',rateMoney(sumK('rAmt')),'<b>'+fmt(sumK('sWt')-sumK('rWt'))+' g</b>','<b>'+rateMoney(sumK('sAmt')-sumK('rAmt'))+'</b>',fmt(sumK('outWt'))+' g',rateMoney(sumK('outAmt'))]);
      content = rows.length ? rarTable(['Team / Salesperson','Sale Weight','Sale Amount','Sale Return Wgt','Sale Return Amt','Net Weight','Net Amount','Outstand Weight','Outstand Amount'], rows) : '<p class="empty">No team sales records.</p>';
    }
    else if(name === 'SaleBill DayBook Report'){
      let runBal=0, totCr=0, totDr=0, totCash=0, totBank=0;
      const rows = sales.map(s => {
        const c = getCust(s.partyId), amt = n(s.amount), col = n(s.collectedAmount);
        const isCash = /^cash$/i.test(String(s.collectedMethod||'Cash'));
        const cash = isCash ? col : 0, bank = isCash ? 0 : col;
        const bal = Math.max(0, amt - n(s.exchangeAmount) - n(s.chitAmount) - col);
        runBal += bal; totCr += col; totDr += amt; totCash += cash; totBank += bank;
        return [esc(dayOf(s.when||s.createdAt)),'<b>'+esc(s.documentNo||s.id.slice(0,8))+' · '+esc(c.name||'Customer')+' ('+esc(s.product||'Sale')+')</b>',rateMoney(col),rateMoney(amt),rateMoney(cash),rateMoney(bank),'<b>'+rateMoney(bal)+'</b>'];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','',rateMoney(totCr),rateMoney(totDr),rateMoney(totCash),rateMoney(totBank),'<b>'+rateMoney(runBal)+'</b>']);
      content = rows.length ? rarTable(['Date','Description','Credit (Collected)','Debit (Bill Amt)','Cash','Bank / UPI','Balance'], rows) : '<p class="empty">No sale bill daybook rows in range.</p>';
    }
    else if(name === 'Partial Sales Report'){
      const rows = [];
      let totGross=0, totNet=0, totAmt=0, totBal=0;
      sales.forEach(s => {
        const c = getCust(s.partyId), bal = typeof rbInvoiceBalance==='function' ? rbInvoiceBalance(s) : Math.max(0, n(s.amount)-n(s.exchangeAmount)-n(s.collectedAmount));
        saleItemsOf(s).forEach(it => {
          const gross = n(it.grossWeight||it.weight), net = n(it.netWeight||it.weight), amt = n(s.amount);
          totGross+=gross; totNet+=net; totAmt+=amt; totBal+=bal;
          rows.push(['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>',esc(dayOf(s.when||s.createdAt)),esc(s.counter||'Main Showroom'),'<b>'+esc(c.name||'Customer')+'</b>',esc(c.customerNo||c.id?.slice(0,6)||'—'),esc(c.phone||c.mobile||'—'),esc(it.product||'Jewellery'),esc(prodGroupOf(it.product,it.productGroup)),esc(it.tagCode||it.huid||'—'),fmt(gross)+' g',fmt(it.stoneWeight||it.lessWeight||0)+' g',fmt(net)+' g',rateMoney(s.gstAmount),esc(it.wastageMode||'percent'),n(it.wastage),rateMoney(s.discount),rateMoney(amt),rateMoney(s.collectedAmount),'<b>'+rateMoney(bal)+'</b>',esc(s.salesperson||'—'),esc(s.counter||'Main')]);
        });
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','','',fmt(totGross)+' g','',fmt(totNet)+' g','','','','','<b>'+rateMoney(totAmt)+'</b>','','<b>'+rateMoney(totBal)+'</b>','','']);
      content = rows.length ? rarTable(['Bill No','Date','Branch Name','Ledger','Customer Code','Mobile Number','Product Name','Product Group','Tag No','Gross wt','Stone wt','Net wt','GST','Wst Type','Wastage','Discount','Net Amount','Collected','Balance','Sales Person','Counter'], rows) : '<p class="empty">No sales records in this period.</p>';
    }
    else if(name === 'Top Purchase'){
      subToolbar = ['Suppliers','Old Gold Sellers','Products'].map(m=>'<button type="button" class="'+(rarState.topPurMode===m?'primary':'')+'" onclick="rarState.topPurMode=\''+m+'\';render()">'+m+'</button>').join(' ');
      const grp = new Map();
      const sourceDocs = rarState.topPurMode === 'Old Gold Sellers' ? oldPurch : [...purch, ...oldPurch];
      sourceDocs.forEach(p => {
        const s = getSup(p.supplierId);
        if(rarState.topPurMode === 'Products'){
          purchItemsOf(p).forEach(it => {
            const k = it.product || 'Bullion / Jewellery';
            const g = grp.get(k) || { k, phone: it.metal||'Gold', bills:0, pcs:0, gross:0, net:0, pure:0, amt:0, paid:0 };
            g.bills++; g.pcs+=n(it.pieces||1); g.gross+=n(it.grossWeight); g.net+=n(it.netWeight); g.pure+=n(it.payablePure||it.pureWeight); g.amt+=n(it.subtotal||p.totalAmount);
            grp.set(k, g);
          });
        } else {
          const k = s.name || p.sellerName || 'Walk-in Seller';
          const g = grp.get(k) || { k, phone: s.phone||s.mobile||s.city||'—', bills:0, pcs:0, gross:0, net:0, pure:0, amt:0, paid:0 };
          g.bills++; g.pcs+=n(p.pieces||1); g.gross+=n(p.grossWeight); g.net+=n(p.netWeight); g.pure+=(n(p.goldPure)+n(p.silverPure)); g.amt+=n(p.totalAmount||p.netAmount||p.amount); g.paid+=n(p.paidAmount);
          grp.set(k, g);
        }
      });
      const list = [...grp.values()].sort((a,b)=>b.amt-a.amt);
      const rows = list.map((g,i)=>[i+1,'<b>'+esc(g.k)+'</b>',esc(g.phone),g.bills,g.pcs,fmt(g.gross)+' g',fmt(g.net)+' g',fmt(g.pure)+' g','<b>'+rateMoney(g.amt)+'</b>',rateMoney(g.paid),rateMoney(Math.max(0,g.amt-g.paid))]);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>','<b>'+list.length+'</b>','',sumK('bills'),sumK('pcs'),fmt(sumK('gross'))+' g',fmt(sumK('net'))+' g',fmt(sumK('pure'))+' g','<b>'+rateMoney(sumK('amt'))+'</b>',rateMoney(sumK('paid')),rateMoney(Math.max(0,sumK('amt')-sumK('paid')))]);
      content = rows.length ? rarTable(['Rank',rarState.topPurMode,'Contact / Metal','Bills','Pcs','Gross Wt g','Net Wt g','Pure Wt g','Purchase Amt ₹','Paid ₹','Balance ₹'], rows) : '<p class="empty">No purchase records in this period.</p>';
    }
    else if(name === 'Sales Item Wastage & MC Analysis'){
      let totWt=0, totMc=0, totDisc=0, totAmt=0;
      const rows = [];
      sales.forEach(s => {
        const items = saleItemsOf(s);
        items.forEach(it => {
          const share = n(s.subtotal)>0 ? n(it.subtotal)/n(s.subtotal) : (1/items.length);
          const wt = n(it.netWeight||it.weight), mc = n(it.makingTotal), disc = n(s.discount)*share, amt = n(s.amount)*share;
          totWt+=wt; totMc+=mc; totDisc+=disc; totAmt+=amt;
          rows.push(['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(dayOf(s.when||s.createdAt)), esc(getCust(s.partyId).name||'Customer'), esc(it.product||'Jewellery'), fmt(wt)+' g', n(it.wastage)+(it.wastageMode==='grams'?' g':'%'), fmt(it.wastageGrams)+' g', rateMoney(mc), rateMoney(it.rate||s.ratePerGram||0), rateMoney(disc), '<b>'+rateMoney(amt)+'</b>']);
        });
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','<b>'+fmt(totWt)+' g</b>','','',rateMoney(totMc),'',rateMoney(totDisc),'<b>'+rateMoney(totAmt)+'</b>']);
      content = rows.length ? rarTable(['Bill No','Date','Customer','Product','Net Wt g','Wastage','Wastage Wt g','Making ₹','Rate ₹/g','Discount ₹','Net Amt ₹'], rows) : '<p class="empty">No sales items.</p>';
    }
    else if(name === 'Sale Bill Wise Profit Pure Report' || name === 'Sale Bill Wise Profit Pure Rate'){
      const gRate = n(rarState.goldRate) || n(db.rates?.gold24) || 7500;
      const sRate = n(rarState.silverRate) || n(db.rates?.silver) || 95;
      subToolbar = '<label>24K Gold Pure Rate ₹/g <input type="number" style="width:95px" value="'+gRate+'" onchange="rarState.goldRate=n(this.value);render()"></label> '
        + '<label>Silver Pure Rate ₹/g <input type="number" style="width:85px" value="'+sRate+'" onchange="rarState.silverRate=n(this.value);render()"></label>';
      let totNet=0, totPure=0, totCost=0, totSale=0, totProf=0;
      const rows = sales.map(s=>{
        const items = saleItemsOf(s);
        let billPure = 0, billCost = 0;
        items.forEach(it => {
          const isSil = prodMetalOf(it.product, it.metalType) === 'Silver';
          const touch = n(it.purity) > 24 ? n(it.purity) : (n(it.purity)||22)*100/24;
          const pure = rbGrams(n(it.netWeight||it.weight)*touch/100);
          billPure += pure;
          billCost += pure * (isSil ? sRate : gRate);
        });
        const saleNet = Math.max(0, n(s.amount)-n(s.gstAmount));
        const profit = saleNet - billCost;
        const pct = billCost>0 ? (profit/billCost*100).toFixed(2)+'%' : '—';
        totNet+=n(s.weight); totPure+=billPure; totCost+=billCost; totSale+=saleNet; totProf+=profit;
        return ['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(dayOf(s.when||s.createdAt)), esc(getCust(s.partyId).name||'Customer'), esc(s.product||items.map(x=>x.product).join(', ')), fmt(s.weight)+' g', esc(typeof rbPurityText==='function'?rbPurityText(s):(n(s.purity)+'%')), fmt(billPure)+' g', rateMoney(billCost), rateMoney(saleNet), '<b>'+rateMoney(profit)+'</b>', esc(pct)];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','<b>'+fmt(totNet)+' g</b>','','<b>'+fmt(totPure)+' g</b>','<b>'+rateMoney(totCost)+'</b>','<b>'+rateMoney(totSale)+'</b>','<b>'+rateMoney(totProf)+'</b>',totCost>0?(totProf/totCost*100).toFixed(2)+'%':'—']);
      content = rows.length ? rarTable(['Bill No','Date','Customer','Product','Net Wt g','Purity','Pure Wt g','Pure Cost ₹','Net Sale (Ex-GST) ₹','Est. Profit ₹','Profit %'], rows) : '<p class="empty">No sales records.</p>';
    }
    else if(name === 'Sales Pure Target Report'){
      subToolbar = ['Month Wise','Day Wise'].map(m=>'<button type="button" class="'+(rarState.targetMode===m?'primary':'')+'" onclick="rarState.targetMode=\''+m+'\';render()">'+m+'</button>').join(' ')
        + ' <label>Gold Target g <input type="number" style="width:80px" value="'+n(rarState.goldTargetG)+'" onchange="rarState.goldTargetG=n(this.value);render()"></label>'
        + ' <label>Silver Target g <input type="number" style="width:80px" value="'+n(rarState.silverTargetG)+'" onchange="rarState.silverTargetG=n(this.value);render()"></label>';
      const groups = new Map();
      sales.forEach(s => {
        const d = dayOf(s.when||s.createdAt);
        const k = rarState.targetMode==='Month Wise' ? d.slice(0,7) : d;
        const g = groups.get(k) || { k, bills:0, gPure:0, sPure:0, amt:0 };
        g.bills++; g.amt += n(s.amount);
        saleItemsOf(s).forEach(it => {
          const isSil = prodMetalOf(it.product, it.metalType) === 'Silver';
          const touch = n(it.purity)>24 ? n(it.purity) : (n(it.purity)||22)*100/24;
          const pure = rbGrams(n(it.netWeight||it.weight)*touch/100);
          if(isSil) g.sPure += pure; else g.gPure += pure;
        });
        groups.set(k, g);
      });
      const div = rarState.targetMode==='Day Wise' ? 30 : 1;
      const gTgt = rbGrams(n(rarState.goldTargetG)/div), sTgt = rbGrams(n(rarState.silverTargetG)/div);
      const list = [...groups.values()].sort((a,b)=>String(b.k).localeCompare(String(a.k)));
      const rows = list.map(g=>{
        const gPct = gTgt>0 ? (g.gPure/gTgt*100).toFixed(1)+'%' : '—';
        const sPct = sTgt>0 ? (g.sPure/sTgt*100).toFixed(1)+'%' : '—';
        return ['<b>'+esc(g.k)+'</b>', g.bills, fmt(gTgt)+' g', fmt(g.gPure)+' g', esc(gPct), fmt(g.gPure-gTgt)+' g', fmt(sTgt)+' g', fmt(g.sPure)+' g', esc(sPct), '<b>'+rateMoney(g.amt)+'</b>'];
      });
      if(rows.length) rows.push(['<b>Total</b>',list.reduce((a,x)=>a+x.bills,0),fmt(gTgt*list.length)+' g','<b>'+fmt(list.reduce((a,x)=>a+x.gPure,0))+' g</b>','','',fmt(sTgt*list.length)+' g','<b>'+fmt(list.reduce((a,x)=>a+x.sPure,0))+' g</b>','','<b>'+rateMoney(list.reduce((a,x)=>a+x.amt,0))+'</b>']);
      content = rows.length ? rarTable(['Period','Bills','Gold Target g','Sold Pure Gold g','Gold Achieved %','Gold Variance g','Silver Target g','Sold Pure Silver g','Silver Achieved %','Sales Value ₹'], rows) : '<p class="empty">No sales pure target data in range.</p>';
    }
    else if(name === 'Tray Wise Sales Report'){
      subToolbar = ['Tray','Counter','Location'].map(m=>'<button type="button" class="'+(rarState.trayGroup===m?'primary':'')+'" onclick="rarState.trayGroup=\''+m+'\';render()">By '+m+'</button>').join(' ');
      const tagMap = new Map(tags.map(t=>[String(t.tagCode||'').toLowerCase(), t]));
      const fieldKey = rarState.trayGroup.toLowerCase();
      const groups = new Map();
      const slot = k => { if(!groups.has(k)) groups.set(k,{k,soldPcs:0,soldGross:0,soldNet:0,soldAmt:0,availTags:0,availNet:0}); return groups.get(k); };
      tags.forEach(t => {
        const k = t[fieldKey] || t.counter || 'Main Showroom Tray';
        const isSold = ['sold','issued','returned','removed'].includes(String(t.status||'').toLowerCase());
        if(!isSold){ const g = slot(k); g.availTags++; g.availNet+=n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)); }
      });
      sales.forEach(s => {
        saleItemsOf(s).forEach(it => {
          const t = tagMap.get(String(it.tagCode||'').toLowerCase());
          const k = (t && t[fieldKey]) || s.counter || 'Main Showroom Tray';
          const g = slot(k);
          g.soldPcs += n(it.pieces)||1;
          g.soldGross += n(it.grossWeight||it.weight);
          g.soldNet += n(it.netWeight||it.weight);
          g.soldAmt += n(it.subtotal||s.amount);
        });
      });
      const list = [...groups.values()].sort((a,b)=>b.soldAmt-a.soldAmt);
      const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',g.soldPcs,fmt(g.soldGross)+' g',fmt(g.soldNet)+' g','<b>'+rateMoney(g.soldAmt)+'</b>',g.availTags,fmt(g.availNet)+' g']);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>',sumK('soldPcs'),fmt(sumK('soldGross'))+' g',fmt(sumK('soldNet'))+' g','<b>'+rateMoney(sumK('soldAmt'))+'</b>',sumK('availTags'),fmt(sumK('availNet'))+' g']);
      content = rows.length ? rarTable([rarState.trayGroup,'Sold Pcs','Sold Gross g','Sold Net g','Sold Value ₹','In-Stock Tags','In-Stock Net g'], rows) : '<p class="empty">No tray or counter sales data found.</p>';
    }
    else if(name === 'SaleBill Diamond Report'){
      subToolbar = ['All','Diamond Only','Stone Only'].map(m=>'<button type="button" class="'+(rarState.diamondFilter===m?'primary':'')+'" onclick="rarState.diamondFilter=\''+m+'\';render()">'+m+'</button>').join(' ');
      const rows = [];
      let totGross=0, totNet=0, totStPcs=0, totCt=0, totStAmt=0, totAmt=0;
      sales.forEach(s => {
        const c = getCust(s.partyId);
        saleItemsOf(s).forEach(it => {
          const p = products.find(x=>String(x.name||'').toLowerCase()===String(it.product||'').toLowerCase())||{};
          const isDia = /diamond/i.test(String(it.product||'')+' '+String(it.productGroup||'')+' '+String(p.stoneType||''));
          const stPcs = n(it.stonePieces||p.stonePieces), stCt = n(it.stoneWeight||p.stoneCarat), stAmt = n(it.stoneAmount||p.stoneCharge), less = n(it.lessWeight);
          if(!isDia && stPcs<=0 && stCt<=0 && stAmt<=0 && less<=0) return;
          if(rarState.diamondFilter==='Diamond Only' && !isDia) return;
          if(rarState.diamondFilter==='Stone Only' && isDia) return;
          const gross = n(it.grossWeight||it.weight), net = n(it.netWeight||it.weight), amt = n(it.subtotal||s.amount);
          totGross+=gross; totNet+=net; totStPcs+=stPcs; totCt+=stCt; totStAmt+=stAmt; totAmt+=amt;
          rows.push([esc(dayOf(s.when||s.createdAt)),'<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>',esc(c.name||'Customer'),esc(it.product||'Jewellery'),esc(it.tagCode||it.huid||'—'),isDia?'Diamond':'Stone',fmt(gross)+' g',fmt(net)+' g',stPcs||1,fmt(stCt||less)+' ct',rateMoney(it.stoneRate||0),rateMoney(it.certificateCharge||0),'<b>'+rateMoney(stAmt)+'</b>','<b>'+rateMoney(amt)+'</b>']);
        });
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','',fmt(totGross)+' g',fmt(totNet)+' g',totStPcs,fmt(totCt)+' ct','','','<b>'+rateMoney(totStAmt)+'</b>','<b>'+rateMoney(totAmt)+'</b>']);
      content = rows.length ? rarTable(['Date','Bill No','Customer','Product','Tag / HUID','Stone Type','Gross Wt g','Net Metal g','Stone Pcs','Carat / Wt','Rate / Ct ₹','Cert. Charge ₹','Stone / Dia Value ₹','Item Total ₹'], rows) : '<p class="empty">No diamond or stone sale items in this period.</p>';
    }
    else if(name === 'Visitors Sales Comparison Report'){
      subToolbar = ['Date','Month','Staff / Employee'].map(m=>'<button type="button" class="'+(rarState.visitorGroup===m?'primary':'')+'" onclick="rarState.visitorGroup=\''+m+'\';render()">By '+m+'</button>').join(' ');
      const groups = new Map();
      const slot = k => { if(!groups.has(k)) groups.set(k,{k,vis:0,conv:0,bills:0,wt:0,amt:0}); return groups.get(k); };
      visitors.filter(v=>inRange(v.date||v.createdAt)).forEach(v => {
        const d = dayOf(v.date||v.createdAt);
        const k = rarState.visitorGroup==='Staff / Employee' ? (v.empRef||v.attendedBy||'Showroom Team') : rarState.visitorGroup==='Month' ? d.slice(0,7) : d;
        const g = slot(k);
        g.vis++;
        if(/purchased|converted|closed|won/i.test(String(v.status||''))) g.conv++;
      });
      sales.forEach(s => {
        const d = dayOf(s.when||s.createdAt);
        const k = rarState.visitorGroup==='Staff / Employee' ? (s.salesperson||'Showroom Team') : rarState.visitorGroup==='Month' ? d.slice(0,7) : d;
        const g = slot(k);
        g.bills++; g.wt+=n(s.weight); g.amt+=n(s.amount);
      });
      const list = [...groups.values()].sort((a,b)=>String(b.k).localeCompare(String(a.k)));
      const rows = list.map(g=>{
        const effVis = Math.max(g.vis, g.bills);
        const pct = effVis>0 ? (g.bills/effVis*100).toFixed(1)+'%' : '—';
        return ['<b>'+esc(g.k)+'</b>', g.vis, g.conv||g.bills, g.bills, esc(pct), fmt(g.wt)+' g', '<b>'+rateMoney(g.amt)+'</b>'];
      });
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>',sumK('vis'),sumK('conv')||sumK('bills'),sumK('bills'),'',fmt(sumK('wt'))+' g','<b>'+rateMoney(sumK('amt'))+'</b>']);
      content = rows.length ? rarTable([rarState.visitorGroup,'Logged Visitors','Converted','Sales Bills','Conversion %','Sold Net Wt g','Sales Revenue ₹'], rows) : '<p class="empty">No visitors or sales comparison data in range.</p>';
    }
    else if(name === 'Branch Wise Sales Summary Report'){
      subToolbar = ['Counter','Place of Supply','Sales Type'].map(m=>'<button type="button" class="'+(rarState.branchGroup===m?'primary':'')+'" onclick="rarState.branchGroup=\''+m+'\';render()">By '+m+'</button>').join(' ');
      const groups = new Map();
      sales.forEach(s => {
        const c = getCust(s.partyId);
        const k = rarState.branchGroup==='Place of Supply' ? (s.placeOfSupply||c.city||c.state||'Main Branch') : rarState.branchGroup==='Sales Type' ? (s.salesType||'Counter sale') : (s.counter||'Main Showroom');
        const g = groups.get(k) || { k, bills:0, pcs:0, gross:0, net:0, disc:0, gst:0, og:0, amt:0, col:0 };
        g.bills++; g.pcs+=n(s.pieces||1); g.gross+=n(s.grossWeight||s.weight); g.net+=n(s.weight); g.disc+=n(s.discount); g.gst+=n(s.gstAmount); g.og+=n(s.exchangeAmount); g.amt+=n(s.amount); g.col+=n(s.collectedAmount);
        groups.set(k, g);
      });
      const list = [...groups.values()].sort((a,b)=>b.amt-a.amt);
      const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',g.bills,g.pcs,fmt(g.gross)+' g',fmt(g.net)+' g',rateMoney(g.disc),rateMoney(g.gst),rateMoney(g.og),'<b>'+rateMoney(g.amt)+'</b>',rateMoney(g.col),rateMoney(Math.max(0,g.amt-g.og-g.col))]);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total ('+list.length+')</b>',sumK('bills'),sumK('pcs'),fmt(sumK('gross'))+' g',fmt(sumK('net'))+' g',rateMoney(sumK('disc')),rateMoney(sumK('gst')),rateMoney(sumK('og')),'<b>'+rateMoney(sumK('amt'))+'</b>',rateMoney(sumK('col')),rateMoney(Math.max(0,sumK('amt')-sumK('og')-sumK('col')))]);
      content = rows.length ? rarTable(['Branch / '+rarState.branchGroup,'Bills','Pcs','Gross Wt g','Net Wt g','Discount ₹','GST ₹','Old Gold ₹','Net Sales ₹','Collected ₹','Balance ₹'], rows) : '<p class="empty">No branch sales summary records in range.</p>';
    }
    else if(name === 'Influence By Report'){
      const groups = new Map();
      const slot = k => { const key = k||'Walk-in / Direct'; if(!groups.has(key)) groups.set(key,{k:key,vis:0,leads:0,custs:0,bills:0,wt:0,amt:0}); return groups.get(key); };
      visitors.filter(v=>inRange(v.date||v.createdAt)).forEach(v => slot(v.referredBy||v.source||'Walk-in / Direct').vis++);
      leads.filter(l=>inRange(l.date||l.createdAt)).forEach(l => slot(l.source||'Walk-in / Direct').leads++);
      const custSource = new Map();
      visitors.forEach(v => { if(v.mobile) custSource.set(String(v.mobile).trim(), v.referredBy||'Visitor Referral'); });
      leads.forEach(l => { if(l.mobile) custSource.set(String(l.mobile).trim(), l.source||'CRM Lead'); });
      custs.forEach(c => {
        const src = c.referredBy || c.source || custSource.get(String(c.phone||c.mobile||'').trim()) || 'Walk-in / Direct';
        custSource.set(c.id, src);
        slot(src).custs++;
      });
      sales.forEach(s => {
        const src = s.reference || custSource.get(s.partyId) || 'Walk-in / Direct';
        const g = slot(src);
        g.bills++; g.wt+=n(s.weight); g.amt+=n(s.amount);
      });
      const list = [...groups.values()].sort((a,b)=>b.amt-a.amt);
      const rows = list.map(g=>['<b>'+esc(g.k)+'</b>',g.vis,g.leads,g.custs,g.bills,fmt(g.wt)+' g','<b>'+rateMoney(g.amt)+'</b>']);
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>',sumK('vis'),sumK('leads'),sumK('custs'),sumK('bills'),fmt(sumK('wt'))+' g','<b>'+rateMoney(sumK('amt'))+'</b>']);
      content = rows.length ? rarTable(['Influence / Referral Source','Visitors','CRM Leads','Customers','Sales Bills','Sold Net Wt g','Sales Amount ₹'], rows) : '<p class="empty">No influence or referral records found.</p>';
    }

    // =========================================================================
    // 4. STOCK, OVERALL STOCK, STOCK TRANSACTIONS & REORDER REPORTS
    // =========================================================================
    else if(name === 'Stock' || name === 'Stock V1' || name === 'Stock V1 & Overall Stock'){
      subToolbar = ['Product Group','Product','Metal'].map(m=>'<button type="button" class="'+(rarState.stockGroup===m?'primary':'')+'" onclick="rarState.stockGroup=\''+m+'\';render()">By '+m+'</button>').join(' ');
      const map = new Map();
      const slot = (k, metal='Gold') => { if(!map.has(k)) map.set(k,{k,metal,opPcs:0,opGross:0,opNet:0,inPcs:0,inGross:0,inNet:0,outPcs:0,outGross:0,outNet:0}); return map.get(k); };
      const keyFor = (pName, grp, metal) => rarState.stockGroup==='Product' ? (pName||'Jewellery') : rarState.stockGroup==='Metal' ? (metal||'Gold') : (grp||'General');
      products.forEach(p => {
        const g = slot(keyFor(p.name, p.group, p.metalType), p.metalType||'Gold');
        g.opPcs += n(p.openingPieces); g.opGross += n(p.openingGross||p.openingNet); g.opNet += n(p.openingNet);
      });
      tags.forEach(t => {
        const d = dayOf(t.tagDate||t.createdAt), metal = prodMetalOf(t.product, t.metalType);
        const g = slot(keyFor(t.product, t.group, metal), metal);
        const pcs = n(t.pieces||1), gross = n(t.grossWeight), net = n(t.netWeight??gross-n(t.lessWeight));
        if(rarState.from && d && d < rarState.from){ g.opPcs+=pcs; g.opGross+=gross; g.opNet+=net; }
        else if(inRange(d)){ g.inPcs+=pcs; g.inGross+=gross; g.inNet+=net; }
      });
      purch.forEach(p => {
        purchItemsOf(p).forEach(it => {
          const g = slot(keyFor(it.product, prodGroupOf(it.product), it.metal), it.metal||'Gold');
          g.inPcs += n(it.pieces||1); g.inGross += n(it.grossWeight); g.inNet += n(it.netWeight);
        });
      });
      sales.forEach(s => {
        saleItemsOf(s).forEach(it => {
          const metal = prodMetalOf(it.product, it.metalType);
          const g = slot(keyFor(it.product, prodGroupOf(it.product, it.productGroup), metal), metal);
          g.outPcs += n(it.pieces)||1; g.outGross += n(it.grossWeight||it.weight); g.outNet += n(it.netWeight||it.weight);
        });
      });
      const list = [...map.values()].sort((a,b)=>String(a.k).localeCompare(String(b.k)));
      const rows = list.map(g=>{
        const clPcs = Math.max(0, g.opPcs + g.inPcs - g.outPcs);
        const clGross = Math.max(0, g.opGross + g.inGross - g.outGross);
        const clNet = Math.max(0, g.opNet + g.inNet - g.outNet);
        return ['<b>'+esc(g.k)+'</b>', esc(g.metal), g.opPcs, fmt(g.opNet)+' g', g.inPcs, fmt(g.inNet)+' g', g.outPcs, fmt(g.outNet)+' g', clPcs, fmt(clGross)+' g', '<b>'+fmt(clNet)+' g</b>'];
      });
      const sumK = k => list.reduce((a,x)=>a+x[k],0);
      if(rows.length) rows.push(['<b>Total</b>','',sumK('opPcs'),fmt(sumK('opNet'))+' g',sumK('inPcs'),fmt(sumK('inNet'))+' g',sumK('outPcs'),fmt(sumK('outNet'))+' g',Math.max(0,sumK('opPcs')+sumK('inPcs')-sumK('outPcs')),fmt(Math.max(0,sumK('opGross')+sumK('inGross')-sumK('outGross')))+' g','<b>'+fmt(Math.max(0,sumK('opNet')+sumK('inNet')-sumK('outNet')))+' g</b>']);
      content = rows.length ? rarTable([rarState.stockGroup,'Metal','Opening Pcs','Opening Net g','Received / Tagged Pcs','Received Net g','Sold / Issued Pcs','Issued Net g','Closing Pcs','Closing Gross g','Closing Net g'], rows) : '<p class="empty">No stock groups found.</p>';
    }
    else if(name === 'Overall Stock'){
      const g22 = n(db.rates?.gold22)||n(db.rates?.gold24)*0.916||6800, g24 = n(db.rates?.gold24)||7400, silRate = n(db.rates?.silver)||95;
      const availTags = tags.filter(t=>!['sold','issued','returned','removed'].includes(String(t.status||'').toLowerCase()));
      const goldTags = availTags.filter(t=>prodMetalOf(t.product,t.metalType)!=='Silver');
      const silTags = availTags.filter(t=>prodMetalOf(t.product,t.metalType)==='Silver');
      const goldProdOp = products.filter(p=>(p.metalType||'Gold')!=='Silver').reduce((a,p)=>a+n(p.openingNet),0);
      const silProdOp = products.filter(p=>p.metalType==='Silver').reduce((a,p)=>a+n(p.openingNet),0);
      const looseOp = docs('retail-shop-opening').filter(r=>['Loose gold','Loose silver','Old gold','Old silver'].includes(r.category));
      const ogPurchWt = oldPurch.reduce((a,p)=>a+n(p.netWeight),0) + sales.reduce((a,s)=>a+n(s.exchangePureGrams),0);
      const rows = [
        ['<b>1. Tagged Gold Ornaments</b>','Gold',goldTags.length,fmt(goldTags.reduce((a,t)=>a+n(t.grossWeight),0))+' g',fmt(goldTags.reduce((a,t)=>a+n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)),0))+' g',rateMoney(g22),'<b>'+rateMoney(goldTags.reduce((a,t)=>a+n(t.netWeight??n(t.grossWeight)-n(t.lessWeight))*g22,0))+'</b>'],
        ['<b>2. Tagged Silver Ornaments</b>','Silver',silTags.length,fmt(silTags.reduce((a,t)=>a+n(t.grossWeight),0))+' g',fmt(silTags.reduce((a,t)=>a+n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)),0))+' g',rateMoney(silRate),'<b>'+rateMoney(silTags.reduce((a,t)=>a+n(t.netWeight??n(t.grossWeight)-n(t.lessWeight))*silRate,0))+'</b>'],
        ['<b>3. Non-Tag Product Opening (Gold)</b>','Gold',products.filter(p=>(p.metalType||'Gold')!=='Silver').reduce((a,p)=>a+n(p.openingPieces),0),fmt(goldProdOp)+' g',fmt(goldProdOp)+' g',rateMoney(g22),'<b>'+rateMoney(goldProdOp*g22)+'</b>'],
        ['<b>4. Non-Tag Product Opening (Silver)</b>','Silver',products.filter(p=>p.metalType==='Silver').reduce((a,p)=>a+n(p.openingPieces),0),fmt(silProdOp)+' g',fmt(silProdOp)+' g',rateMoney(silRate),'<b>'+rateMoney(silProdOp*silRate)+'</b>'],
        ['<b>5. Loose Metal & Old Jewel Opening</b>','Mixed',looseOp.length,fmt(looseOp.reduce((a,r)=>a+n(r.weight),0))+' g',fmt(looseOp.reduce((a,r)=>a+n(r.weight),0))+' g','Opening Val','<b>'+rateMoney(looseOp.reduce((a,r)=>a+n(r.amount),0))+'</b>'],
        ['<b>6. Old Gold Purchases & Exchanges</b>','Gold',oldPurch.length,fmt(ogPurchWt)+' g',fmt(ogPurchWt)+' g',rateMoney(g24),'<b>'+rateMoney(oldPurch.reduce((a,p)=>a+n(p.totalAmount||p.amount),0)+sales.reduce((a,s)=>a+n(s.exchangeAmount),0))+'</b>']
      ];
      content = rarTable(['Stock Category','Metal','Tags / Pcs','Gross Weight g','Net Weight g','Valuation Rate','Est. Stock Value ₹'], rows);
    }
    else if(name === 'Stock Transactions'){
      subToolbar = '<select onchange="rarState.txType=this.value;render()">'+opts(['All','Inward Only','Outward Only','Tagging','Lot Entry','Purchase','Old Gold','Sale Bill','Sales Return','Purchase Return','Conversion'], rarState.txType)+'</select> '
        + '<select onchange="rarState.metal=this.value;render()">'+opts(['All','Gold','Silver'], rarState.metal)+'</select>';
      const txs = [];
      const addTx = (dt, ref, type, party, product, metal, inPcs, inWt, outPcs, outWt) => {
        const d = dayOf(dt);
        if(!d || !inRange(d)) return;
        const m = metal || prodMetalOf(product);
        if(rarState.metal !== 'All' && m !== rarState.metal) return;
        if(rarState.txType === 'Inward Only' && inWt <= 0 && inPcs <= 0) return;
        if(rarState.txType === 'Outward Only' && outWt <= 0 && outPcs <= 0) return;
        if(!['All','Inward Only','Outward Only'].includes(rarState.txType) && type !== rarState.txType) return;
        txs.push({ d, ref, type, party: party||'Showroom', product: product||'Jewellery', metal: m, inPcs: n(inPcs), inWt: n(inWt), outPcs: n(outPcs), outWt: n(outWt) });
      };
      tags.forEach(t => addTx(t.tagDate||t.createdAt, t.tagCode, 'Tagging', t.supplier||'Tag Lot', t.product, t.metalType, t.pieces||1, t.netWeight??n(t.grossWeight)-n(t.lessWeight), 0, 0));
      lots.forEach(l => (l.items||[l]).forEach(it => addTx(l.date||l.createdAt, l.lotNo||l.id?.slice(0,8), 'Lot Entry', l.supplier||'Lot', it.product||l.product, it.metalType||l.metalType, it.pieces||1, it.netWeight||it.grossWeight, 0, 0)));
      purch.forEach(p => purchItemsOf(p).forEach(it => addTx(p.when||p.date||p.createdAt, p.documentNo||p.id.slice(0,8), 'Purchase', getSup(p.supplierId).name, it.product, it.metal, it.pieces||1, it.netWeight, 0, 0)));
      oldPurch.forEach(p => purchItemsOf(p).forEach(it => addTx(p.when||p.date||p.createdAt, p.documentNo||p.id.slice(0,8), 'Old Gold', getSup(p.supplierId).name||'Customer', it.product||'Old Jewel', it.metal, it.pieces||1, it.netWeight, 0, 0)));
      sales.forEach(s => saleItemsOf(s).forEach(it => addTx(s.when||s.createdAt, s.documentNo||s.id.slice(0,8), 'Sale Bill', getCust(s.partyId).name, it.product, it.metalType, 0, 0, it.pieces||1, it.netWeight||it.weight)));
      returns.forEach(r => addTx(r.when||r.date||r.createdAt, r.documentNo||r.id.slice(0,8), 'Sales Return', getCust(r.partyId).name, r.product, 'Gold', 1, r.returnWeight||r.weight, 0, 0));
      purchRet.forEach(r => addTx(r.when||r.date||r.createdAt, r.documentNo||r.id.slice(0,8), 'Purchase Return', getSup(r.supplierId).name, r.product, r.metal||'Gold', 0, 0, r.returnQuantity||1, r.returnWeight||r.weight));
      docs('conversion').forEach(c => addTx(c.when||c.date||c.createdAt, c.documentNo||c.id.slice(0,8), 'Conversion', getSup(c.supplierId).name||'Refinery', 'Kacha to Pure', c.metal||'Gold', 1, c.outputWeight, 1, c.weight));

      txs.sort((a,b)=>a.d.localeCompare(b.d));
      let runWt=0, totInP=0, totInW=0, totOutP=0, totOutW=0;
      const rows = txs.map(t => {
        runWt = rbGrams(runWt + t.inWt - t.outWt);
        totInP+=t.inPcs; totInW+=t.inWt; totOutP+=t.outPcs; totOutW+=t.outWt;
        return [esc(t.d),'<b>'+esc(t.ref||'—')+'</b>',esc(t.type),esc(t.party),esc(t.product),esc(t.metal),t.inPcs,fmt(t.inWt)+' g',t.outPcs,fmt(t.outWt)+' g','<b>'+fmt(runWt)+' g</b>'];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','',totInP,'<b>'+fmt(totInW)+' g</b>',totOutP,'<b>'+fmt(totOutW)+' g</b>','<b>'+fmt(runWt)+' g</b>']);
      content = rows.length ? rarTable(['Date','Ref / Tag / Bill','Movement Type','Party / Source','Product','Metal','Inward Pcs','Inward Net g','Outward Pcs','Outward Net g','Running Net g'], rows) : '<p class="empty">No stock transactions match the selected filters.</p>';
    }
    else if(name === 'Reorder Report By Default' || name === 'Reorder & Inactive Customer'){
      subToolbar = '<label>Min Reorder Wt g <input type="number" style="width:75px" value="'+n(rarState.minReorderWt)+'" onchange="rarState.minReorderWt=n(this.value);render()"></label> '
        + '<label>Min Pcs <input type="number" style="width:65px" value="'+n(rarState.minReorderPcs)+'" onchange="rarState.minReorderPcs=n(this.value);render()"></label>';
      const minW = n(rarState.minReorderWt)||10, minP = n(rarState.minReorderPcs)||2;
      const rows = products.map(p=>{
        const availTags = tags.filter(t=>String(t.product||'').toLowerCase()===String(p.name||'').toLowerCase() && !['sold','issued','returned','removed'].includes(String(t.status||'').toLowerCase()));
        const soldItems = sales.flatMap(saleItemsOf).filter(it=>String(it.product||'').toLowerCase()===String(p.name||'').toLowerCase());
        const soldPcs = soldItems.reduce((a,it)=>a+n(it.pieces||1),0), soldWt = soldItems.reduce((a,it)=>a+n(it.netWeight||it.weight),0);
        const inPcs = Math.max(0, n(p.openingPieces) + availTags.reduce((a,t)=>a+n(t.pieces||1),0) - (availTags.length?0:soldPcs));
        const inWt = Math.max(0, n(p.openingNet) + availTags.reduce((a,t)=>a+n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)),0) - (availTags.length?0:soldWt));
        const shortWt = Math.max(0, rbGrams(minW - inWt));
        const low = inWt < minW || inPcs < minP;
        return ['<b>'+esc(p.name)+'</b>', esc(p.group||'—'), esc(p.metalType||'Gold'), esc(p.size||'Standard'), inPcs, fmt(inWt)+' g', soldPcs, fmt(soldWt)+' g', fmt(minW)+' g', '<b>'+fmt(shortWt)+' g</b>', low?'<span class="rco-badge rco-badge-cancel">Reorder Now</span>':'<span class="rco-badge rco-badge-open">Adequate</span>'];
      });
      content = rows.length ? rarTable(['Product Name','Group','Metal','Default Size','In-Stock Pcs','In-Stock Net g','Sold Pcs','Sold Wt g','Min Level g','Reorder Shortfall g','Status'], rows) : '<p class="empty">No products found.</p>';
    }
    else if(name === 'Reorder Report By Size'){
      const minW = n(rarState.minReorderWt)||10;
      subToolbar = '<label>Target Wt per Size g <input type="number" style="width:80px" value="'+minW+'" onchange="rarState.minReorderWt=n(this.value);render()"></label>';
      const sizeMap = new Map();
      const slot = (grp, prod, sz) => { const k = [grp||'General', prod||'Jewellery', sz||'Standard'].join('|'); if(!sizeMap.has(k)) sizeMap.set(k,{grp:grp||'General',prod:prod||'Jewellery',sz:sz||'Standard',inPcs:0,inWt:0,soldPcs:0,soldWt:0}); return sizeMap.get(k); };
      products.forEach(p => {
        const gObj = pGroups.find(g=>g.name===p.group);
        const sizes = String(p.size||gObj?.sizes||gObj?.size||'Standard').split(',').map(s=>s.trim()).filter(Boolean);
        sizes.forEach((sz,idx) => {
          const s = slot(p.group, p.name, sz);
          if(idx===0){ s.inPcs+=n(p.openingPieces); s.inWt+=n(p.openingNet); }
        });
      });
      tags.forEach(t => {
        const s = slot(t.group, t.product, t.size||'Standard');
        const wt = n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)), pcs = n(t.pieces||1);
        if(['sold','issued'].includes(String(t.status||'').toLowerCase())){ s.soldPcs+=pcs; s.soldWt+=wt; }
        else { s.inPcs+=pcs; s.inWt+=wt; }
      });
      const list = [...sizeMap.values()].sort((a,b)=>a.prod.localeCompare(b.prod)||a.sz.localeCompare(b.sz));
      const rows = list.map(s=>{
        const short = Math.max(0, rbGrams(minW - s.inWt));
        return [esc(s.grp),'<b>'+esc(s.prod)+'</b>','<b>'+esc(s.sz)+'</b>',s.inPcs,fmt(s.inWt)+' g',s.soldPcs,fmt(s.soldWt)+' g',fmt(minW)+' g','<b>'+fmt(short)+' g</b>',short>0?'<span class="rco-badge rco-badge-cancel">Reorder Size</span>':'<span class="rco-badge rco-badge-open">OK</span>'];
      });
      content = rows.length ? rarTable(['Product Group','Product','Size','Available Pcs','Available Net g','Sold Pcs','Sold Net g','Target Wt g','Shortfall Wt g','Status'], rows) : '<p class="empty">No size-wise product or tag records found.</p>';
    }
    else if(name === 'Reorder Report By Weight'){
      subToolbar = '<label>Weight Slabs (g) <input value="'+esc(rarState.weightSlabs)+'" style="width:140px" onchange="rarState.weightSlabs=this.value;render()"></label>';
      const cuts = [...new Set(String(rarState.weightSlabs||'0,2,5,10,20,50').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>=0))].sort((a,b)=>a-b);
      const bounds = (cuts.length?cuts:[0,2,5,10,20,50]).map((x,i)=>[x, cuts[i+1]??Infinity]);
      const slabOf = wt => {
        for(const [lo,hi] of bounds) if(wt>=lo && wt<hi) return hi===Infinity ? lo+'g+' : lo+'–'+hi+'g';
        return '0–2g';
      };
      const wMap = new Map();
      const slot = (grp, prod, slab) => { const k = [grp||'General',prod||'Jewellery',slab].join('|'); if(!wMap.has(k)) wMap.set(k,{grp:grp||'General',prod:prod||'Jewellery',slab,inPcs:0,inWt:0,soldPcs:0,soldWt:0}); return wMap.get(k); };
      tags.forEach(t => {
        const wt = n(t.netWeight??n(t.grossWeight)-n(t.lessWeight)), pcs = n(t.pieces||1);
        const s = slot(t.group, t.product, slabOf(wt));
        if(['sold','issued'].includes(String(t.status||'').toLowerCase())){ s.soldPcs+=pcs; s.soldWt+=wt; }
        else { s.inPcs+=pcs; s.inWt+=wt; }
      });
      sales.forEach(sale => saleItemsOf(sale).forEach(it => {
        if(it.tagCode) return;
        const wt = n(it.netWeight||it.weight);
        const s = slot(prodGroupOf(it.product,it.productGroup), it.product, slabOf(wt));
        s.soldPcs += n(it.pieces||1); s.soldWt += wt;
      }));
      products.forEach(p => {
        if(n(p.openingNet)>0){
          const avg = n(p.openingPieces)>0 ? n(p.openingNet)/n(p.openingPieces) : n(p.defaultWeight||p.openingNet);
          const s = slot(p.group, p.name, slabOf(avg));
          s.inPcs += n(p.openingPieces||1); s.inWt += n(p.openingNet);
        }
      });
      const list = [...wMap.values()].sort((a,b)=>a.prod.localeCompare(b.prod));
      const rows = list.map(s=>{
        const need = Math.max(0, s.soldPcs - s.inPcs);
        return [esc(s.grp),'<b>'+esc(s.prod)+'</b>','<b>'+esc(s.slab)+'</b>',s.inPcs,fmt(s.inWt)+' g',s.soldPcs,fmt(s.soldWt)+' g','<b>'+need+' pcs</b>',s.inPcs===0||need>0?'<span class="rco-badge rco-badge-cancel">Reorder '+need+'</span>':'<span class="rco-badge rco-badge-open">In Stock</span>'];
      });
      content = rows.length ? rarTable(['Product Group','Product','Weight Range Slab','In-Stock Tags/Pcs','In-Stock Net g','Sold Tags/Pcs','Sold Net g','Reorder Needed','Status'], rows) : '<p class="empty">No weight-slab stock records found.</p>';
    }

    // =========================================================================
    // 5. GIFT ITEM & GIFT VOUCHER REPORTS
    // =========================================================================
    else if(name === 'Gift Stock Report' || name === 'Gift Voucher & Order Summary'){
      const giftGroups = new Set(pGroups.filter(g=>g.ornamentType==='Gift Item'||/gift/i.test(g.name||'')).map(g=>g.name));
      const giftProds = products.filter(p=>giftGroups.has(p.group)||/gift|compliment|coin|article/i.test(String(p.name||'')+' '+String(p.category||'')));
      const rows = giftProds.map(p=>{
        const op = n(p.openingPieces)||0;
        const inTags = tags.filter(t=>t.product===p.name).reduce((a,t)=>a+n(t.pieces||1),0);
        const issued = sales.flatMap(saleItemsOf).filter(it=>it.product===p.name).reduce((a,it)=>a+n(it.pieces||1),0);
        const bal = Math.max(0, op + inTags - issued);
        return ['<b>'+esc(p.name)+'</b>',esc(p.group||'Gift Item'),op,inTags,issued,'<b>'+bal+'</b>',rateMoney(p.makingRate||p.manualRate||0)];
      });
      const vActive = vouchers.filter(v=>!v.isRedeemed).length, vRed = vouchers.filter(v=>v.isRedeemed).length;
      rows.push(['<b>Gift Vouchers Pool</b>','CRM Gift Vouchers',vouchers.length,0,vRed,'<b>'+vActive+'</b>',rateMoney(vouchers.reduce((a,v)=>a+n(v.amount),0))]);
      rows.push(['<b>Retail Customer Orders</b>','Order Bookings',orders.length,0,orders.filter(o=>o.status==='Closed').length,'<b>'+orders.filter(o=>o.status!=='Closed').length+'</b>',rateMoney(orders.reduce((a,o)=>a+n(o.netAmount),0))]);
      content = rarTable(['Gift Item / Module','Category','Opening / Created Qty','Tagged / Added Qty','Issued / Redeemed Qty','Available Balance Qty','Value ₹'], rows);
    }
    else if(name === 'Gift Issued Report'){
      const giftGroups = new Set(pGroups.filter(g=>g.ornamentType==='Gift Item'||/gift/i.test(g.name||'')).map(g=>g.name));
      const rows = [];
      let totVal = 0;
      sales.forEach(s => {
        const c = getCust(s.partyId);
        if(s.giftVoucherCode || s.giftVoucherId){
          const v = vouchers.find(x=>x.id===s.giftVoucherId||x.code===s.giftVoucherCode)||{};
          const val = n(s.voucherCredit||v.amount);
          totVal += val;
          rows.push([esc(dayOf(s.when||s.createdAt)),'<b>'+esc(s.giftVoucherCode||v.code||'GIFT')+'</b>','Gift Voucher Applied',esc(c.name||'Customer'),esc(c.phone||c.mobile||'—'),esc(s.documentNo||s.id.slice(0,8)),1,'<b>'+rateMoney(val)+'</b>']);
        }
        saleItemsOf(s).forEach(it => {
          if(giftGroups.has(it.productGroup) || /gift|compliment/i.test(String(it.product||''))){
            const val = n(it.subtotal);
            totVal += val;
            rows.push([esc(dayOf(s.when||s.createdAt)),'<b>'+esc(it.tagCode||s.documentNo||s.id.slice(0,8))+'</b>',esc(it.product),'<b>'+esc(c.name||'Customer')+'</b>',esc(c.phone||c.mobile||'—'),esc(s.documentNo||s.id.slice(0,8)),n(it.pieces||1),'<b>'+rateMoney(val)+'</b>']);
          }
        });
      });
      vouchers.filter(v=>inRange(v.validFrom||v.createdAt)).forEach(v => {
        totVal += n(v.amount);
        rows.push([esc(dayOf(v.validFrom||v.createdAt)),'<b>'+esc(v.code)+'</b>',esc(v.name||'Gift Voucher'),esc(v.ledgerName||'Customer Bearer'),'—',esc(v.isRedeemed?'Redeemed':'Issued'),1,'<b>'+rateMoney(v.amount)+'</b>']);
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','<b>'+rateMoney(totVal)+'</b>']);
      content = rows.length ? rarTable(['Date','Voucher / Tag Code','Gift Item / Campaign','Customer Name','Mobile','Bill / Status','Qty','Gift Value ₹'], rows) : '<p class="empty">No gift items or vouchers issued in this period.</p>';
    }
    else if(name === 'Gift Voucher Redeem Report'){
      const todayStr = rbNow().slice(0,10);
      let totVal=0, totRed=0;
      const rows = vouchers.filter(v=>inRange(v.validFrom||v.createdAt)).map(v => {
        const linkedSale = (db.sales||[]).find(s=>s.accountType==='customer'&&(s.giftVoucherId===v.id||String(s.giftVoucherCode||'').toUpperCase()===String(v.code||'').toUpperCase()));
        const isRed = !!(v.isRedeemed || linkedSale);
        const isExp = !isRed && v.validTo && v.validTo < todayStr;
        const c = linkedSale ? getCust(linkedSale.partyId) : {};
        totVal += n(v.amount);
        if(isRed) totRed += n(v.amount);
        const badge = isRed ? '<span class="rco-badge rco-badge-open">Redeemed</span>' : isExp ? '<span class="rco-badge rco-badge-cancel">Expired</span>' : '<span class="rco-badge rco-badge-wait">Active</span>';
        return ['<b>'+esc(v.code)+'</b>',esc(v.name||'Campaign'),esc(v.ledgerName||c.name||'Any Customer'),esc(v.validFrom||'—'),esc(v.validTo||'—'),esc(v.redeemType||'Flat'),rateMoney(v.minPurchase||0),'<b>'+rateMoney(v.amount)+'</b>',esc(linkedSale?dayOf(linkedSale.when||linkedSale.createdAt):(v.redeemedAt||'—')),esc(linkedSale?(linkedSale.documentNo||linkedSale.id.slice(0,8)):'—'),badge];
      });
      if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','Redeemed: '+rateMoney(totRed),'<b>'+rateMoney(totVal)+'</b>','','','']);
      content = rows.length ? rarTable(['Voucher Code','Voucher / Campaign','Customer Ledger','Valid From','Valid To','Type','Min Bill ₹','Voucher Value ₹','Redeemed Date','Redeemed Bill No','Status'], rows) : '<p class="empty">No gift vouchers found.</p>';
    }

    // =========================================================================
    // 6. JEWEL LOAN & AUCTION REPORTS
    // =========================================================================
    else if(name === 'Jewel Loan Date Wise Report' || name === 'Jewel Loan Area Wise Report' || name === 'Jewel Loan Hand Stock Report' || name === 'Jewel Loan Stock Report' || name === 'Interest Due Report'){
      const allLoans = typeof window.glAllJewelLoans === 'function' ? window.glAllJewelLoans() : docs('retail-jewel-loan-draft');
      const allInts = typeof window.glJewelLoanInterests === 'function' ? window.glJewelLoanInterests() : docs('retail-jewel-loan-interest');
      const allReds = typeof window.glJewelLoanRedemptions === 'function' ? window.glJewelLoanRedemptions() : docs('retail-jewel-loan-redemption');
      const redMap = new Map(allReds.map(r=>[String(r.loanRef||''), r]));
      const intByRef = (ref) => allInts.filter(i=>i.loanRef===ref).reduce((a,i)=>a+n(i.netAmount||i.interestAmount),0) + (redMap.get(ref)?n(redMap.get(ref).interestAmount):0);
      const loans = allLoans.filter(l => inRange(l.date||l.createdAt) && (rarState.metal==='All'||(l.metal||'Gold')===rarState.metal) && (rarState.loanScheme==='All'||l.scheme===rarState.loanScheme));
      const schemes = ['All', ...new Set(allLoans.map(l=>l.scheme).filter(Boolean))];
      subToolbar = '<select onchange="rarState.metal=this.value;render()">'+opts(['All','Gold','Silver'], rarState.metal)+'</select> '
        + '<select onchange="rarState.loanScheme=this.value;render()">'+opts(schemes, rarState.loanScheme)+'</select>';

      if(name === 'Jewel Loan Date Wise Report'){
        let totGross=0, totLess=0, totNet=0, totPrin=0, totChg=0, totInt=0;
        const rows = loans.map(l => {
          const c = getCust(l.customerId), gross = n(l.gross), less = n(l.less), net = Math.max(0, gross-less), prin = n(l.principal), chg = n(l.charges), intPaid = intByRef(l.reference);
          const rel = redMap.get(l.reference);
          totGross+=gross; totLess+=less; totNet+=net; totPrin+=prin; totChg+=chg; totInt+=intPaid;
          const status = rel ? (rel.releaseType==='Auction Release'?'<span class="rco-badge rco-badge-cancel">Auctioned</span>':'<span class="rco-badge rco-badge-open">Released</span>') : '<span class="rco-badge rco-badge-wait">In Hand / Active</span>';
          return [esc(dayOf(l.date||l.createdAt)),'<b>'+esc(l.reference)+'</b>','<b>'+esc(c.name||'Customer')+'</b>',esc(c.phone||c.mobile||'—'),esc(c.city||c.area||'—'),esc(l.scheme||'Standard'),esc(l.item||'Jewel'),esc(l.metal||'Gold'),n(l.purity||91.6)+'%',fmt(gross)+' g',fmt(less)+' g',fmt(net)+' g','<b>'+rateMoney(prin)+'</b>',rateMoney(chg),rateMoney(intPaid),status];
        });
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','','','','',fmt(totGross)+' g',fmt(totLess)+' g','<b>'+fmt(totNet)+' g</b>','<b>'+rateMoney(totPrin)+'</b>',rateMoney(totChg),rateMoney(totInt),'']);
        content = rows.length ? rarTable(['Date','Loan Ref No','Customer','Mobile','City / Area','Scheme','Pledge Item','Metal','Purity','Gross Wt g','Less Wt g','Net Wt g','Principal ₹','Charges ₹','Interest Paid ₹','Status'], rows) : '<p class="empty">No jewel loans in this period. Open Jewel Loan & Auction to create loan entries.</p>';
      }
      else if(name === 'Jewel Loan Area Wise Report'){
        const aMap = new Map();
        loans.forEach(l => {
          const c = getCust(l.customerId), area = c.area || c.city || 'Main Showroom Area';
          const g = aMap.get(area) || { area, custs: new Set(), active:0, released:0, gross:0, net:0, prin:0, intPaid:0, outPrin:0 };
          const rel = redMap.get(l.reference), net = Math.max(0, n(l.gross)-n(l.less));
          g.custs.add(l.customerId||c.name);
          if(rel) g.released++; else { g.active++; g.outPrin+=n(l.principal); }
          g.gross+=n(l.gross); g.net+=net; g.prin+=n(l.principal); g.intPaid+=intByRef(l.reference);
          aMap.set(area, g);
        });
        const list = [...aMap.values()].sort((a,b)=>b.prin-a.prin);
        const rows = list.map(g=>['<b>'+esc(g.area)+'</b>',g.custs.size,g.active,g.released,fmt(g.gross)+' g',fmt(g.net)+' g',rateMoney(g.prin),rateMoney(g.intPaid),'<b>'+rateMoney(g.outPrin)+'</b>']);
        const sumK = k => list.reduce((a,x)=>a+x[k],0);
        if(rows.length) rows.push(['<b>Total ('+list.length+' Areas)</b>','',sumK('active'),sumK('released'),fmt(sumK('gross'))+' g',fmt(sumK('net'))+' g',rateMoney(sumK('prin')),rateMoney(sumK('intPaid')),'<b>'+rateMoney(sumK('outPrin'))+'</b>']);
        content = rows.length ? rarTable(['Area / City','Customers','Active Loans','Released Loans','Gross Wt g','Net Wt g','Total Principal ₹','Interest Collected ₹','Active Principal ₹'], rows) : '<p class="empty">No area-wise jewel loan records found.</p>';
      }
      else if(name === 'Jewel Loan Hand Stock Report'){
        const activeLoans = loans.filter(l=>!redMap.has(l.reference));
        const gRate = n(db.rates?.gold22)||6800, sRate = n(db.rates?.silver)||95;
        let totGross=0, totNet=0, totPure=0, totPrin=0, totVal=0;
        const rows = activeLoans.map(l => {
          const c = getCust(l.customerId), gross = n(l.gross), less = n(l.less), net = Math.max(0, gross-less), pur = n(l.purity||91.6), pure = rbGrams(net*pur/100);
          const mRate = (l.metal||'Gold')==='Silver' ? sRate : gRate;
          const mktVal = rbRound(net * mRate), prin = n(l.principal);
          const ltv = mktVal>0 ? (prin/mktVal*100).toFixed(1)+'%' : '—';
          const days = Math.max(0, Math.floor((Date.now()-Date.parse(dayOf(l.date||l.createdAt)||rbNow().slice(0,10)))/86400000));
          totGross+=gross; totNet+=net; totPure+=pure; totPrin+=prin; totVal+=mktVal;
          return ['<b>'+esc(l.reference)+'</b>',esc(dayOf(l.date||l.createdAt)),'<b>'+esc(c.name||'Customer')+'</b>',esc(c.phone||c.mobile||'—'),esc(l.item||'Jewel'),esc(l.metal||'Gold'),pur+'%',fmt(gross)+' g',fmt(net)+' g',fmt(pure)+' g','<b>'+rateMoney(prin)+'</b>',rateMoney(mktVal),esc(ltv),days+' days'];
        });
        if(rows.length) rows.push(['<b>Total Hand Stock ('+rows.length+')</b>','','','','','','',fmt(totGross)+' g','<b>'+fmt(totNet)+' g</b>',fmt(totPure)+' g','<b>'+rateMoney(totPrin)+'</b>','<b>'+rateMoney(totVal)+'</b>',totVal>0?(totPrin/totVal*100).toFixed(1)+'%':'—','']);
        content = rows.length ? rarTable(['Loan Ref No','Date','Customer','Mobile','Pledge Item','Metal','Purity %','Gross Wt g','Net Wt g','Pure Wt g','Principal ₹','Est. Metal Value ₹','LTV %','Custody Days'], rows) : '<p class="empty">No active jewel loan hand stock in custody.</p>';
      }
      else if(name === 'Jewel Loan Stock Report'){
        const gRate = n(db.rates?.gold22)||6800, sRate = n(db.rates?.silver)||95;
        const sMap = new Map();
        loans.filter(l=>!redMap.has(l.reference)).forEach(l => {
          const k = (l.metal||'Gold')+' · '+(l.item||'Ornament');
          const g = sMap.get(k) || { metal:l.metal||'Gold', item:l.item||'Ornament', cnt:0, gross:0, less:0, net:0, pure:0, prin:0, val:0 };
          const gross = n(l.gross), less = n(l.less), net = Math.max(0,gross-less), pure = rbGrams(net*n(l.purity||91.6)/100);
          const mRate = g.metal==='Silver' ? sRate : gRate;
          g.cnt++; g.gross+=gross; g.less+=less; g.net+=net; g.pure+=pure; g.prin+=n(l.principal); g.val+=rbRound(net*mRate);
          sMap.set(k, g);
        });
        const list = [...sMap.values()].sort((a,b)=>b.prin-a.prin);
        const rows = list.map(g=>[esc(g.metal),'<b>'+esc(g.item)+'</b>',g.cnt,fmt(g.gross)+' g',fmt(g.less)+' g','<b>'+fmt(g.net)+' g</b>',fmt(g.pure)+' g','<b>'+rateMoney(g.prin)+'</b>',rateMoney(g.val),rateMoney(g.val-g.prin)]);
        const sumK = k => list.reduce((a,x)=>a+x[k],0);
        if(rows.length) rows.push(['<b>Total</b>','',sumK('cnt'),fmt(sumK('gross'))+' g',fmt(sumK('less'))+' g','<b>'+fmt(sumK('net'))+' g</b>',fmt(sumK('pure'))+' g','<b>'+rateMoney(sumK('prin'))+'</b>',rateMoney(sumK('val')),rateMoney(sumK('val')-sumK('prin'))]);
        content = rows.length ? rarTable(['Metal','Pledge Ornament / Item','Active Pledges','Gross Wt g','Less Wt g','Net Wt g','Pure Wt g','Principal Exposure ₹','Market Value ₹','Safety Margin ₹'], rows) : '<p class="empty">No jewel loan stock records.</p>';
      }
      else {
        // Interest Due Report
        const ratePm = n(rarState.loanRatePm)||1.5;
        subToolbar += ' <label>Monthly Rate % <input type="number" step=".05" style="width:70px" value="'+ratePm+'" onchange="rarState.loanRatePm=n(this.value);render()"></label>';
        const asOfStr = rarState.to || rbNow().slice(0,10);
        let totPrin=0, totAcc=0, totPaid=0, totDue=0, totRed=0;
        const rows = loans.filter(l=>!redMap.has(l.reference)).map(l => {
          const c = getCust(l.customerId), d = dayOf(l.date||l.createdAt)||asOfStr;
          const days = Math.max(1, Math.floor((Date.parse(asOfStr) - Date.parse(d)) / 86400000));
          const months = (days / 30).toFixed(2);
          const prin = n(l.principal);
          const accrued = rbRound(prin * (ratePm / 100) * (days / 30));
          const paid = intByRef(l.reference);
          const due = Math.max(0, rbRound(accrued - paid));
          const redAmt = rbRound(prin + due + n(l.charges));
          totPrin+=prin; totAcc+=accrued; totPaid+=paid; totDue+=due; totRed+=redAmt;
          return ['<b>'+esc(l.reference)+'</b>',esc(d),'<b>'+esc(c.name||'Customer')+'</b>',esc(c.phone||c.mobile||'—'),esc(l.scheme||'Standard'),fmt(Math.max(0,n(l.gross)-n(l.less)))+' g',rateMoney(prin),days+' d ('+months+' m)',ratePm+'%',rateMoney(accrued),rateMoney(paid),'<b>'+rateMoney(due)+'</b>','<b>'+rateMoney(redAmt)+'</b>'];
        });
        if(rows.length) rows.push(['<b>Total ('+rows.length+')</b>','','','','','',rateMoney(totPrin),'','',rateMoney(totAcc),rateMoney(totPaid),'<b>'+rateMoney(totDue)+'</b>','<b>'+rateMoney(totRed)+'</b>']);
        content = rows.length ? rarTable(['Loan Ref No','Loan Date','Customer','Mobile','Scheme','Net Wt g','Principal ₹','Elapsed Period','Rate %/m','Accrued Interest ₹','Interest Paid ₹','Interest Due ₹','Total Redemption ₹'], rows) : '<p class="empty">No active jewel loans with interest due.</p>';
      }
    }

    const hiddenSet = new Set(rarState.hiddenCols[name] || []);
    const colSelector = lastReportColumns.length ? '<details id="rarColOptions" style="position:relative;display:inline-block"><summary class="gl-dt-btn" style="padding:5px 10px;font-size:12px;cursor:pointer">Display Columns ('+(lastReportColumns.length-hiddenSet.size)+'/'+lastReportColumns.length+')</summary><div style="position:absolute;right:0;z-index:40;min-width:220px;max-height:280px;overflow:auto;padding:10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--white,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);display:grid;gap:6px">'
      + lastReportColumns.map(col=>'<label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" '+(!hiddenSet.has(col)?'checked':'')+' onchange="rarToggleCol(\''+esc(col)+'\',this.checked)"> '+esc(col)+'</label>').join('')
      + '</div></details>' : '';

    return '<section class="panel">'
      + '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" onclick="rarBack()">← All Reports</button><h2 style="margin:0">'+esc(name)+'</h2></div>'
      + '<div class="rco-toolbar-right" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">'
      + '<input type="search" placeholder="Search report rows..." value="'+esc(rarState.search)+'" oninput="rarState.search=this.value;render()" style="width:165px;font-size:12px;padding:4px 8px">'
      + '<label style="font-size:12px">From <input type="date" value="'+esc(rarState.from)+'" onchange="rarState.from=this.value;render()"></label>'
      + '<label style="font-size:12px">To <input type="date" value="'+esc(rarState.to)+'" onchange="rarState.to=this.value;render()"></label>'
      + subToolbar
      + colSelector
      + ' <button type="button" onclick="rarResetFilters()">Reset</button>'
      + ' <button type="button" onclick="rarDownloadCsv()">CSV</button>'
      + ' <button type="button" onclick="window.print()">🖨️ Print</button></div></div>'
      + '<div id="rar-report-results">'+content+'</div></section>';
  }

  const rarPrevReportsView = window.reportsView;
  window.reportsView = function(){
    if(workspaceMode !== 'retail') return rarPrevReportsView ? rarPrevReportsView() : '';
    if(window.tagReportActive) return tagReportsView();
    if(window.tradeReportActive) return tradeReportsView();
    if(rarState.active) return rarRenderReport(rarState.active);

    const sections = [
      ['Accounts, Books & Financial Statements', [
        ['DayBook Transactions', "rarOpen('DayBook Report')"],
        ['DayBook Abstract', "rarOpen('DayBook Abstract')"],
        ['Cashbook Report', "rarOpen('Cashbook Report')"],
        ['Bankbook Report', "rarOpen('Bankbook Report')"],
        ['Bill Entry Report', "rarOpen('Bill Entry Report')"],
        ['Payment Report By Ledger', "rarOpen('Payment Report By Ledger')"],
        ['Payment Report By Ledger Group', "rarOpen('Payment Report By Ledger Group')"],
        ['Supplier Payment Report', "rarOpen('Supplier Payment Report')"],
        ['Outstanding Report', "rarOpen('Outstanding Report')"],
        ['Outstanding V1 Report', "rarOpen('Outstanding V1 Report')"],
        ['Advance Amount Report', "rarOpen('Advance Amount Report')"],
        ['Advance Amount Report V1', "rarOpen('Advance Amount Report V1')"],
        ['Expense Report', "rarOpen('Expense Report')"],
        ['Ledger Report', "rarOpen('Ledger Report')"],
        ['Trial Balance Report', "rarOpen('Trial Balance Report')"],
        ['Profit Loss Report', "rarOpen('Profit Loss Report')"],
        ['Balance Sheet Report', "rarOpen('Balance Sheet Report')"],
        ['Accounts Group & Metal Ledger', "rgaState.mainTab='Accounts & Reports';go('Parent Group')"]
      ]],
      ['GST & Tax Reports (GSTR1, HSN & GSTR3B)', [
        ['GSTR1 Report', "rarOpen('GSTR1 Report')"],
        ['GSTR1 All Invoice Report', "rarOpen('GSTR1 All Invoice Report')"],
        ['GSTR1 B2B Invoices', "rarOpen('GSTR1 B2B Invoices')"],
        ['GSTR1 B2C Large Invoices', "rarOpen('GSTR1 B2C Large Invoices')"],
        ['GSTR1 B2C Small Invoices', "rarOpen('GSTR1 B2C Small Invoices')"],
        ['GSTR1 CR/DR Lists', "rarOpen('GSTR1 CR/DR Lists')"],
        ['GSTR1 Document Summary', "rarOpen('GSTR1 Document Summary')"],
        ['GSTR1 HSN/SAC Sales Summary', "rarOpen('GSTR1 HSN/SAC Sales Summary')"],
        ['HSN/SAC Sales Detail Summary', "rarOpen('HSN/SAC Sales Detail Summary')"],
        ['HSN/SAC Return Detail Summary', "rarOpen('HSN/SAC Return Detail Summary')"],
        ['GSTR1 JSON Report', "rarOpen('GSTR1 JSON Report')"],
        ['GSTR3B Report', "rarOpen('GSTR3B Report')"]
      ]],
      ['Sales, Purchase & Analytics Reports', [
        ['Sales Abstract Report', "rarOpen('Sales Abstract Report')"],
        ['Sales Register Report', "rarOpen('Sales Register Report')"],
        ['Sales Return Abstract Report', "rarOpen('Sales Return Abstract Report')"],
        ['SaleBill DayBook Report', "rarOpen('SaleBill DayBook Report')"],
        ['Partial Sales Report', "rarOpen('Partial Sales Report')"],
        ['Sales Purchase', "rarOpen('Sales Purchase')"],
        ['Top Customer', "rarOpen('Top Customer')"],
        ['Customer Inactive Report', "rarOpen('Customer Inactive Report')"],
        ['Top Purchase', "rarOpen('Top Purchase')"],
        ['Top Purchase By Product', "rarOpen('Top Purchase By Product')"],
        ['Retail Purchase Report', "rarOpen('Retail Purchase Report')"],
        ['Purchase Abstract Report', "rarOpen('Purchase Abstract Report')"],
        ['Top Sales (Centralized)', "rarOpen('Top Sales (Centralized)')"],
        ['Top Sales By Product', "rarOpen('Top Sales (Centralized)','Product')"],
        ['Top Sales By Product Group', "rarOpen('Top Sales (Centralized)','Product Group')"],
        ['Top Sales By Product Size', "rarOpen('Top Sales (Centralized)','Product Size')"],
        ['Top Sales By Weight Range', "rarOpen('Top Sales (Centralized)','Product Weight Range')"],
        ['Top Sales By Model', "rarOpen('Top Sales (Centralized)','Model')"],
        ['Top Sales By Employee', "rarOpen('Top Sales (Centralized)','Employee')"],
        ['Top Sales By Supplier', "rarOpen('Top Sales (Centralized)','Supplier')"],
        ['Top Sales By Customer', "rarOpen('Top Sales (Centralized)','Customer')"],
        ['Top Sales By City', "rarOpen('Top Sales (Centralized)','City')"],
        ['Top Sales By Area', "rarOpen('Top Sales (Centralized)','Area')"],
        ['Sale Bill Summary Matrix', "rarOpen('Sale Bill Summary Matrix')"],
        ['Sales Item Wastage & MC Analysis', "rarOpen('Sales Item Wastage & MC Analysis')"],
        ['Sale Bill Wise Profit Pure Report', "rarOpen('Sale Bill Wise Profit Pure Report')"],
        ['Sales Pure Target Report', "rarOpen('Sales Pure Target Report')"],
        ['Tray Wise Sales Report', "rarOpen('Tray Wise Sales Report')"],
        ['SaleBill Diamond Report', "rarOpen('SaleBill Diamond Report')"],
        ['Visitors Sales Comparison Report', "rarOpen('Visitors Sales Comparison Report')"],
        ['Branch Wise Sales Summary Report', "rarOpen('Branch Wise Sales Summary Report')"],
        ['Influence By Report', "rarOpen('Influence By Report')"],
        ['Team Analysis Report', "rarOpen('Team Analysis Report')"],
        ['Sales & Purchase Tabs (Built-in)', "tradeReportOpen('Sales')"],
        ['Purchase Register Tabs (Built-in)', "tradeReportOpen('Purchase')"]
      ]],
      ['Stock, Tagging & Reorder Reports', [
        ['Stock', "rarOpen('Stock')"],
        ['Stock V1', "rarOpen('Stock V1')"],
        ['Overall Stock', "rarOpen('Overall Stock')"],
        ['Stock Transactions', "rarOpen('Stock Transactions')"],
        ['Reorder Report By Default', "rarOpen('Reorder Report By Default')"],
        ['Reorder Report By Size', "rarOpen('Reorder Report By Size')"],
        ['Reorder Report By Weight', "rarOpen('Reorder Report By Weight')"],
        ['Tag Stocks (Built-in)', "tagReportOpen('Tag Stocks')"],
        ['Tag Stock V1 (Built-in)', "tagReportOpen('Tag Stock V1')"],
        ['Tag Agewise Report (Built-in)', "tagReportOpen('Tag Age Wise')"],
        ['Overall Available Tag (Built-in)', "tagReportOpen('Overall Available Tag')"]
      ]],
      ['Gift Item & Gift Voucher Reports', [
        ['Gift Stock Report', "rarOpen('Gift Stock Report')"],
        ['Gift Issued Report', "rarOpen('Gift Issued Report')"],
        ['Gift Voucher Redeem Report', "rarOpen('Gift Voucher Redeem Report')"],
        ['Gift Voucher & Order Summary', "rarOpen('Gift Voucher & Order Summary')"]
      ]],
      ['Jewel Loan & Auction Reports', [
        ['Jewel Loan Date Wise Report', "rarOpen('Jewel Loan Date Wise Report')"],
        ['Jewel Loan Area Wise Report', "rarOpen('Jewel Loan Area Wise Report')"],
        ['Jewel Loan Hand Stock Report', "rarOpen('Jewel Loan Hand Stock Report')"],
        ['Jewel Loan Stock Report', "rarOpen('Jewel Loan Stock Report')"],
        ['Interest Due Report', "rarOpen('Interest Due Report')"]
      ]],
      ['Chit & Savings Reports', [
        ['All 11 Chit Reports (Built-in)', "go('Chit Reports')"]
      ]]
    ];

    return header('Retail Reports Directory', '')
      + sections.map(([secTitle, items])=>
        '<section class="rco-section-card"><h3>'+esc(secTitle)+'</h3><div style="display:flex;flex-wrap:wrap;gap:8px">'
        + items.map(([lbl, act])=>'<button type="button" class="gl-dt-btn" style="padding:8px 14px;font-size:12.5px" onclick="'+act+'">📊 '+esc(lbl)+'</button>').join('')
        + '</div></section>'
      ).join('');
  };
})();
