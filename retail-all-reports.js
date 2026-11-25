// Comprehensive Retail Reports Hub (GST/GSTR1/GSTR3B/HSN, DayBook/Cashbook/Bankbook/Outstanding/Advance/Expense, Sales Summary/Centralized/Wastage-MC/Profit/Register, Stock V1/Overall/Reorder/Gift/Team) with universal table lines, Display Columns, Filter, CSV, and Print.
(function(){
  window.rarState = window.rarState || {
    active: '',
    search: '',
    from: '',
    to: '',
    groupBy: 'Product Group',
    layout: 'Classic',
    gstr3bView: 'Horizontal',
    bookMode: 'Detailed View',
    daybookTab: 'Transactions',
    topDim: 'Product Group',
    metal: 'All',
    goldRate: 0,
    silverRate: 0
  };

  const docs = (t) => (window.rcDocs ? window.rcDocs(t) : (db.retailDocuments||[]).filter(d=>(d.kind||d.type)===t));
  const opts = (arr, cur) => arr.map(v=>'<option value="'+esc(v)+'" '+(String(cur||'')===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('');
  const inRange = (dt) => {
    const d = String(dt||'').slice(0,10);
    if(rarState.from && d && d < rarState.from) return false;
    if(rarState.to && d && d > rarState.to) return false;
    return true;
  };
  const rSales = () => (db.sales||[]).filter(s=>s.accountType==='customer' && inRange(s.when||s.createdAt));
  const rPays = () => (db.payments||[]).filter(p=>p.accountType==='customer' && inRange(p.when||p.createdAt));
  const rPurch = () => docs('retail-purchase').filter(p=>inRange(p.when||p.date||p.createdAt));

  window.rarOpen = (name) => {
    window.tagReportActive = false;
    window.tradeReportActive = false;
    rarState.active = name;
    if(name==='DayBook Report')rarState.daybookTab='Transactions';
    render();
  };
  window.rarBack = () => { rarState.active = ''; render(); };

  window.rarDownloadGstr1Json = () => {
    const sales = rSales();
    const cfg = window.pdfConfig ? pdfConfig('retail') : {};
    const b2b = [], b2cs = [];
    sales.forEach(s => {
      const cust = (db.customers||[]).find(c=>c.id===s.partyId) || {};
      const val = n(s.amount), gst = n(s.gstAmount), taxable = Math.max(0, val - gst);
      const entry = { inum: s.documentNo||s.id.slice(0,8), idt: String(s.when||'').slice(0,10), val, txval: taxable, iamt: 0, camt: gst/2, samt: gst/2 };
      if(cust.gst) b2b.push({ ctin: cust.gst, inv: [entry] });
      else b2cs.push({ pos: cust.state||'33', rt: n(s.gstRate)||3, txval: taxable, camt: gst/2, samt: gst/2 });
    });
    const payload = { gstin: cfg.gstNumber||'', fp: new Date().toISOString().slice(0,7).replace('-',''), version:'GST3.0.4', b2b, b2cs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'GSTR1-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
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
    link.download=rarState.active.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function rarRenderReport(name){
    const sales = rSales(), pays = rPays(), purch = rPurch();
    const custs = db.customers || [], sups = db.retailSuppliers || [];
    const products = docs('retail-product'), tags = docs('retail-tagging');
    const orders = docs('retail-order'), vouchers = docs('crm-voucher');
    const getCust = (id) => custs.find(c=>c.id===id) || {};

    let subToolbar = '';
    let content = '';

    // ---- 1. GSTR1 & GST REPORTS ----
    if(name === 'GSTR1 Report'){
      const b2b = sales.filter(s=>!!getCust(s.partyId).gst);
      const b2cLarge = sales.filter(s=>!getCust(s.partyId).gst && n(s.amount)>250000);
      const b2cSmall = sales.filter(s=>!getCust(s.partyId).gst && n(s.amount)<=250000);
      const sumBucket = (arr) => ({
        cnt: arr.length,
        taxable: arr.reduce((a,s)=>a+Math.max(0,n(s.amount)-n(s.gstAmount)),0),
        cgst: arr.reduce((a,s)=>a+n(s.gstAmount)/2,0),
        sgst: arr.reduce((a,s)=>a+n(s.gstAmount)/2,0),
        tot: arr.reduce((a,s)=>a+n(s.amount),0)
      });
      const rows = [
        ['B2B Invoices - 4A, 4B, 4C, 6B, 6C', sumBucket(b2b)],
        ['B2C (Large) Invoices - 5A, 5B (> ₹2.5L)', sumBucket(b2cLarge)],
        ['B2C (Small) Invoices - 7', sumBucket(b2cSmall)]
      ];
      subToolbar = '<button type="button" class="primary" onclick="rarDownloadGstr1Json()">⬇ Download GSTR1 JSON</button>';
      content = table(['Section','Vouchers','Taxable Value ₹','CGST ₹','SGST ₹','Total Invoice ₹'], rows.map(([lbl,b])=>['<b>'+esc(lbl)+'</b>', b.cnt, rateMoney(b.taxable), rateMoney(b.cgst), rateMoney(b.sgst), '<b>'+rateMoney(b.tot)+'</b>']));
    }
    else if(name === 'GSTR1 B2B & B2C Invoices'){
      content = table(['Type','Bill No','Date','Customer','GSTIN','State','Taxable ₹','CGST ₹','SGST ₹','Total ₹'], sales.map(s=>{
        const c = getCust(s.partyId), gst = n(s.gstAmount), tax = Math.max(0, n(s.amount)-gst);
        return [c.gst?'B2B':(n(s.amount)>250000?'B2C Large':'B2C Small'), '<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(String(s.when||'').slice(0,10)), esc(c.name||'—'), esc(c.gst||'Unregistered'), esc(c.state||'TAMIL NADU'), rateMoney(tax), rateMoney(gst/2), rateMoney(gst/2), '<b>'+rateMoney(s.amount)+'</b>'];
      }));
    }
    else if(name === 'GSTR1 HSN/SAC Summary'){
      const byHsn = {};
      sales.forEach(s => {
        const items = Array.isArray(s.items)&&s.items.length ? s.items : [s];
        items.forEach(it => {
          const hsn = it.hsn || '7113';
          if(!byHsn[hsn]) byHsn[hsn] = { hsn, desc: it.product||'Jewellery', qty:0, wt:0, val:0, gst:0 };
          byHsn[hsn].qty += (n(it.pieces)||1);
          byHsn[hsn].wt += n(it.netWeight||it.weight||s.weight);
          byHsn[hsn].val += n(it.subtotal||s.amount);
          byHsn[hsn].gst += n(s.gstAmount)/items.length;
        });
      });
      const rows = Object.values(byHsn);
      content = rows.length ? table(['HSN','Description','UQC','Qty','Weight g','Taxable ₹','CGST ₹','SGST ₹','Total ₹'], rows.map(r=>['<b>'+esc(r.hsn)+'</b>', esc(r.desc), 'GMS', r.qty, fmt(r.wt)+' g', rateMoney(Math.max(0,r.val-r.gst)), rateMoney(r.gst/2), rateMoney(r.gst/2), '<b>'+rateMoney(r.val)+'</b>'])) : '<p class="empty">No HSN sales records in range.</p>';
    }
    else if(name === 'GSTR3B Report'){
      const outTaxable = sales.reduce((a,s)=>a+Math.max(0,n(s.amount)-n(s.gstAmount)),0);
      const outGst = sales.reduce((a,s)=>a+n(s.gstAmount),0);
      const inTaxable = purch.reduce((a,p)=>a+Math.max(0,n(p.netAmount||p.amount)-n(p.taxAmount)),0);
      const inGst = purch.reduce((a,p)=>a+n(p.taxAmount),0);
      subToolbar = '<button type="button" class="'+(rarState.gstr3bView==='Horizontal'?'primary':'')+'" onclick="rarState.gstr3bView=\'Horizontal\';render()">Horizontal</button> <button type="button" class="'+(rarState.gstr3bView==='Vertical'?'primary':'')+'" onclick="rarState.gstr3bView=\'Vertical\';render()">Vertical</button>';
      content = table(['Particulars','Taxable Value ₹','CGST ₹','SGST ₹','Total Tax ₹'], [
        ['3.1 Outward Supplies (Sales)', rateMoney(outTaxable), rateMoney(outGst/2), rateMoney(outGst/2), '<b>'+rateMoney(outGst)+'</b>'],
        ['4. Eligible ITC (Inward Purchases)', rateMoney(inTaxable), rateMoney(inGst/2), rateMoney(inGst/2), '<b>'+rateMoney(inGst)+'</b>'],
        ['6.1 Net Tax Payable (Outward − ITC)', rateMoney(outTaxable-inTaxable), rateMoney((outGst-inGst)/2), rateMoney((outGst-inGst)/2), '<b>'+rateMoney(outGst-inGst)+'</b>']
      ]);
    }

    // ---- 2. ACCOUNTING, DAYBOOK, BOOKS, OUTSTANDING, ADVANCE, EXPENSE ----
    else if(name === 'DayBook Report' || name === 'DayBook Abstract'){
      const ledgers=new Map(docs('retail-ledger').map(row=>[row.id,row.name]));
      const entries=[];
      const add=(date,no,type,ledger,notes,dr,cr,wd=0,wc=0)=>{
        const day=String(date||'').slice(0,10);
        if(day&&inRange(day))entries.push({day,no,type,ledger,notes,dr:n(dr),cr:n(cr),wd:n(wd),wc:n(wc)});
      };
      for(const row of sales)add(row.when||row.createdAt,row.documentNo||row.id,'Sales Bill',getCust(row.partyId).name,row.product,row.amount,0,row.weight);
      for(const row of pays)add(row.when||row.createdAt,row.reference||row.id,'Receipt',getCust(row.partyId).name,row.kind,0,row.amount);
      for(const row of purch)add(row.when||row.date||row.createdAt,row.billNo||row.id,'Purchase',sups.find(x=>x.id===row.supplierId)?.name,row.remarks,0,row.netAmount??row.amount,0,row.totalNetWt);
      for(const row of docs('retail-account-posting')){
        for(const line of row.lines||[]){
          const amount=row.measure==='Amount';
          add(line.date||row.date,row.number,row.voucherType,ledgers.get(line.ledgerId),row.description,
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
        if(!groups.has(key))groups.set(key,{day:row.day,type:row.type,dr:0,cr:0,wd:0,wc:0});
        sum(groups.get(key),row);
      }
      const heads=abstract?['Date','Voucher type']:['Date','Voucher no.','Voucher type','Ledger','Narration'];
      const rows=abstract?[...groups.values()].map(row=>[esc(row.day),esc(row.type),...values(row)])
        :entries.map(row=>[row.day,row.no,row.type,row.ledger,row.notes].map(value=>esc(value||'—')).concat(values(row)));
      if(rows.length)rows.push(['<b>Total</b>',...heads.slice(1).map(()=>''),...values(total)]);
      content=rows.length?table([...heads,'Amount Dr ₹','Amount Cr ₹','Weight Dr','Weight Cr'],rows):'<p class="empty">No daybook transactions.</p>';
    }
    else if(name === 'Cashbook & Bankbook' || name === 'Cashbook Report' || name === 'Bankbook Report'){
      const book=name==='Bankbook Report'?'Bank':'Cash';
      const group=book==='Bank'?'Bank Accounts':'Cash in hand';
      const bookLedgers=new Map(docs('retail-ledger').filter(l=>l.parentGroup===group).map(l=>[l.id,l]));
      const entries=[];
      const add=(date,no,type,ledger,dr,cr,opening=false)=>{
        const dt=String(date||'').slice(0,10);
        if(n(dr)||n(cr))entries.push({dt,no,type,ledger,dr:n(dr),cr:n(cr),opening});
      };
      for(const ledger of bookLedgers.values()){
        const amount=n(ledger.openingAmount), credit=ledger.openingSide==='CR';
        add(ledger.openingEffectiveDate,'','Opening balance',ledger.name,credit?0:amount,credit?amount:0,true);
      }
      for(const row of docs('retail-shop-opening')){
        if(row.category===(book==='Bank'?'Bank':'Cash in hand'))add(row.when,'','Opening balance',row.description,n(row.amount),0,true);
      }
      for(const row of docs('retail-account-posting')){
        if(row.measure!=='Amount')continue;
        for(const line of row.lines||[]){
          const ledger=bookLedgers.get(line.ledgerId);
          if(ledger)add(line.date||row.date,row.number||row.id,row.voucherType,ledger.name,line.debit,line.credit);
        }
      }
      const allSales=(db.sales||[]).filter(row=>row.accountType==='customer');
      const allPayments=(db.payments||[]).filter(row=>row.accountType==='customer');
      const matches=method=>book==='Cash'?/^cash$/i.test(String(method).trim()):/^(?:bank(?: transfer)?|upi|gpay|google pay|phonepe|card|debit card|credit card|cheque|check|neft|rtgs|imps)$/i.test(String(method).trim());
      for(const sale of allSales){
        const collections=sale.collections?.length?sale.collections:[{method:sale.collectedMethod||'Cash',amount:sale.collectedAmount}];
        for(const payment of collections)if(matches(payment.method))add(sale.when||sale.createdAt,sale.documentNo||sale.id,'Sale receipt',getCust(sale.partyId).name||'Customer',payment.amount,0);
      }
      for(const payment of allPayments){
        if(matches(payment.method||payment.kind||'Cash'))add(payment.when||payment.createdAt,payment.reference||payment.id,'Receipt',getCust(payment.partyId).name||'Customer',payment.amount,0);
      }
      subToolbar=['Detailed View','Month Wise','Day Wise'].map(m=>'<button type="button" class="'+(rarState.bookMode===m?'primary':'')+'" onclick="rarState.bookMode=\''+m+'\';render()">'+m+'</button>').join(' ');
      const opening=entries.filter(e=>(!e.dt&&e.opening)||(rarState.from&&e.dt&&e.dt<rarState.from)).reduce((sum,e)=>sum+e.dr-e.cr,0);
      const period=entries.filter(e=>e.dt&&inRange(e.dt)).sort((a,b)=>a.dt.localeCompare(b.dt));
      let running=opening;
      const summary=rarState.bookMode!=='Detailed View';
      const grouped=new Map();
      if(summary)for(const entry of period){
        const key=entry.dt.slice(0,rarState.bookMode==='Month Wise'?7:10);
        const group=grouped.get(key)||{dt:key,dr:0,cr:0};
        group.dr+=entry.dr;group.cr+=entry.cr;grouped.set(key,group);
      }
      const heads=summary?['Period']:['Date','Txn No.','Type','Ledger'];
      const rows=(summary?[...grouped.values()]:period).map(e=>{
        running+=e.dr-e.cr;
        return [...(summary?[esc(e.dt)]:[esc(e.dt),esc(e.no||'—'),esc(e.type||'—'),esc(e.ledger||'—')]),rateMoney(e.dr),rateMoney(e.cr),rateMoney(running)];
      });
      content='<p>Opening balance <b>'+rateMoney(opening)+'</b> · Closing balance <b>'+rateMoney(running)+'</b></p>'
        +(rows.length?table([...heads,'Receipt ₹','Payment ₹','Closing ₹'],rows):'<p class="empty">No entries in this period.</p>');
    }
    else if(name === 'Bill Entry Report'){
      const ledgers=new Map(docs('retail-ledger').map(ledger=>[ledger.id,ledger.name]));
      const rows=docs('retail-account-posting').filter(entry=>entry.voucherType==='Bill Entry'&&inRange(entry.date))
        .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
        .map(entry=>[esc(entry.date||'—'),esc(entry.billNumber||entry.number||'—'),esc(entry.direction||'—'),
          esc(ledgers.get(entry.source)||'—'),esc(ledgers.get(entry.destination)||'—'),rateMoney(n(entry.amount)),
          esc(entry.dueDate||'—'),esc(entry.billStatus||'—'),esc(entry.description||'—')]);
      content=rows.length?table(['Date','Bill no. / reference','Type','From','To','Amount ₹','Due date','Status','Narration'],rows):'<p class="empty">No bill entries in this period.</p>';
    }
    else if(name === 'Outstanding Report'){
      const rows = custs.map(c => {
        const open = n(c.opening);
        const totSale = sales.filter(s=>s.partyId===c.id).reduce((a,s)=>a+n(s.amount)-n(s.exchangeAmount),0);
        const totPaid = pays.filter(p=>p.partyId===c.id).reduce((a,p)=>a+n(p.amount),0) + sales.filter(s=>s.partyId===c.id).reduce((a,s)=>a+n(s.collectedAmount),0);
        const bal = open + totSale - totPaid;
        return [ '<b>'+esc(c.name)+'</b>', esc(c.parentGroup||'Sundry Debtors'), esc(c.phone||'—'), esc(c.city||'—'), '<b>'+rateMoney(bal)+'</b>', bal>0?'<span class="rco-badge rco-badge-cancel">Due</span>':'<span class="rco-badge rco-badge-open">Settled</span>' ];
      });
      content = rows.length ? table(['Ledger','Parent Group','Mobile No','City','Balance Amount ₹','Status'], rows) : '<p class="empty">No customer accounts.</p>';
    }
    else if(name === 'Advance Amount Report'){
      const rows = docs('retail-chit-mapping').map(m=>{
        const c = getCust(m.customerId);
        const entries = docs('retail-chit-entry').filter(e=>e.mappingId===m.id);
        const paid = entries.reduce((a,e)=>a+n(e.amount),0);
        return ['<b>'+esc(c.name||'Customer')+'</b>', esc(m.chitNumber), esc(c.phone||'—'), rateMoney(paid), rateMoney(m.settledAmount||0), '<b>'+rateMoney(Math.max(0,paid-n(m.settledAmount)))+'</b>'];
      });
      content = rows.length ? table(['Ledger Name','Chit / Advance #','Mobile','Credit ₹','Used / Settled ₹','Closing Advance ₹'], rows) : '<p class="empty">No advance or chit balances.</p>';
    }
    else if(name === 'Expense Report'){
      const ledgers=new Map(docs('retail-ledger').map(row=>[row.id,row]));
      const expenseGroups=new Set(window.rgaAllAccountingGroups().flat.filter(group=>group.type==='EXPENSE').map(group=>group.name));
      const rows=[];
      let total=0;
      for(const entry of docs('retail-account-posting')){
        if(entry.measure!=='Amount')continue;
        for(const line of entry.lines||[]){
          const date=line.date||entry.date, ledger=ledgers.get(line.ledgerId);
          if(!ledger||!expenseGroups.has(ledger.parentGroup)||!inRange(date))continue;
          const net=n(line.debit)-n(line.credit);
          total+=net;
          rows.push([date,entry.number,ledger.name,ledger.parentGroup,entry.description].map(value=>esc(value||'—')).concat(rateMoney(net)));
        }
      }
      rows.sort((a,b)=>b[0].localeCompare(a[0]));
      if(rows.length)rows.push(['<b>Total</b>','','','','',rateMoney(total)]);
      content=rows.length?table(['Date','Voucher no.','Expense ledger','Group','Narration','Net expense ₹'],rows):'<p class="empty">No posted expenses in this period.</p>';
    }

    // ---- 3. ADVANCED SALES, STOCK & REORDER REPORTS ----
    else if(name === 'Sale Bill Summary Matrix'){
      const grossSales = sales.reduce((a,s)=>a+n(s.amount)+n(s.discount),0);
      const disc = sales.reduce((a,s)=>a+n(s.discount),0);
      const gst = sales.reduce((a,s)=>a+n(s.gstAmount),0);
      const og = sales.reduce((a,s)=>a+n(s.exchangeAmount),0);
      const net = sales.reduce((a,s)=>a+n(s.amount),0);
      const wt = sales.reduce((a,s)=>a+n(s.weight),0);
      content = table(['Particulars','Weight (g)','Amount ₹'], [
        ['Total Gross Sales', fmt(wt)+' g', rateMoney(grossSales)],
        ['Less: Discount', '—', '− '+rateMoney(disc)],
        ['CGST @ 1.5%', '—', rateMoney(gst/2)],
        ['SGST @ 1.5%', '—', rateMoney(gst/2)],
        ['Less: Old Jewel Purchase Credit', '—', '− '+rateMoney(og)],
        ['<b>NET SALES AMOUNT</b>', '<b>'+fmt(wt)+' g</b>', '<b>'+rateMoney(net-og)+'</b>']
      ]);
    }
    else if(name === 'Top Sales (Centralized)'){
      const dims = ['Product Group','Product','Customer','City','Area','Supplier'];
      subToolbar = '<label style="display:flex;align-items:center;gap:6px"><b>Report By:</b> <select onchange="rarState.topDim=this.value;render()">'+opts(dims, rarState.topDim)+'</select></label>';
      const grp = {};
      sales.forEach(s => {
        const c = getCust(s.partyId);
        let key = 'Unspecified';
        if(rarState.topDim==='Product') key = s.product || 'Jewellery';
        else if(rarState.topDim==='Product Group') key = (products.find(p=>p.name===s.product)||{}).group || 'General';
        else if(rarState.topDim==='Customer') key = c.name || 'Walk-in';
        else if(rarState.topDim==='City') key = c.city || '—';
        else if(rarState.topDim==='Area') key = c.area || '—';
        else key = 'Showroom';
        if(!grp[key]) grp[key] = { key, qty:0, wt:0, amt:0 };
        grp[key].qty += (n(s.pieces)||1); grp[key].wt += n(s.weight); grp[key].amt += n(s.amount);
      });
      const rows = Object.values(grp).sort((a,b)=>b.amt-a.amt);
      content = rows.length ? table([rarState.topDim, 'Net Qty', 'Sales Wt g', 'Net Wt g', 'Sales Amt ₹', 'Net Amt ₹'], rows.map(r=>['<b>'+esc(r.key)+'</b>', r.qty, fmt(r.wt)+' g', fmt(r.wt)+' g', rateMoney(r.amt), '<b>'+rateMoney(r.amt)+'</b>'])) : '<p class="empty">No sales data in range.</p>';
    }
    else if(name === 'Sales Item Wastage & MC Analysis'){
      content = sales.length ? table(['Bill No','Date','Product','Net Wt g','Wst %','Making ₹','Rate ₹/g','Discount ₹','Net Amt ₹'], sales.map(s=>['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(String(s.when||'').slice(0,10)), esc(s.product), fmt(s.weight)+' g', n(s.wastage)+'%', rateMoney(s.makingTotal||0), rateMoney(s.ratePerGram||0), rateMoney(s.discount||0), '<b>'+rateMoney(s.amount)+'</b>'])) : '<p class="empty">No sales items.</p>';
    }
    else if(name === 'Sale Bill Wise Profit Pure Rate'){
      subToolbar = '<label>Gold Pure Rate ₹/g <input type="number" style="width:100px" value="'+(rarState.goldRate||db.rates?.gold24||0)+'" onchange="rarState.goldRate=n(this.value);render()"></label>';
      const gRate = n(rarState.goldRate) || n(db.rates?.gold24);
      content = sales.length ? table(['Bill No','Date','Product','Net Wt g','Purity %','Pure Wt g','Pure Cost ₹','Net Sale ₹','Est. Profit ₹','Profit %'], sales.map(s=>{
        const pureWt = n(s.weight)*n(s.purity)/100;
        const cost = pureWt * gRate;
        const saleNet = Math.max(0, n(s.amount)-n(s.gstAmount));
        const profit = saleNet - cost;
        const pct = cost>0 ? (profit/cost*100).toFixed(2)+'%' : '—';
        return ['<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(String(s.when||'').slice(0,10)), esc(s.product), fmt(s.weight)+' g', n(s.purity)+'%', fmt(pureWt)+' g', rateMoney(cost), rateMoney(saleNet), '<b>'+rateMoney(profit)+'</b>', esc(pct)];
      })) : '<p class="empty">No sales records.</p>';
    }
    else if(name === 'Sale Register (26 Col)'){
      content = sales.length ? table(['Product Group','Date','Bill No','Customer','Code','Gross Wt','Net Wt','CGST ₹','SGST ₹','Amount ₹','Discount ₹','Net Amt ₹','Paid ₹','Method','Balance ₹'], sales.map(s=>{
        const c = getCust(s.partyId), pg = (products.find(p=>p.name===s.product)||{}).group||'General', gst=n(s.gstAmount);
        return [esc(pg), esc(String(s.when||'').slice(0,10)), '<b>'+esc(s.documentNo||s.id.slice(0,8))+'</b>', esc(c.name||'Customer'), esc(c.customerNo||'—'), fmt(s.grossWeight||s.weight)+' g', fmt(s.weight)+' g', rateMoney(gst/2), rateMoney(gst/2), rateMoney(n(s.amount)+n(s.discount)), rateMoney(s.discount), '<b>'+rateMoney(s.amount)+'</b>', rateMoney(s.collectedAmount||0), esc(s.collectedMethod||'Cash'), rateMoney(Math.max(0,n(s.amount)-n(s.exchangeAmount)-n(s.collectedAmount)))];
      })) : '<p class="empty">No sales records.</p>';
    }
    else if(name === 'Stock V1 & Overall Stock'){
      const pGroups = Array.from(new Set([...docs('retail-product-group').map(g=>g.name), ...products.map(p=>p.group||'General')]));
      const rows = pGroups.map(gn => {
        const opWt = products.filter(p=>(p.group||'General')===gn).reduce((a,p)=>a+n(p.openingNet),0);
        const tagWt = tags.filter(t=>(t.group||'General')===gn && t.status!=='Sold').reduce((a,t)=>a+n(t.netWeight||t.weight),0);
        const soldWt = sales.filter(s=>((products.find(p=>p.name===s.product)||{}).group||'General')===gn).reduce((a,s)=>a+n(s.weight),0);
        const balWt = Math.max(0, opWt + tagWt - soldWt);
        return ['<b>'+esc(gn)+'</b>', fmt(opWt)+' g', fmt(tagWt)+' g', fmt(soldWt)+' g', '<b>'+fmt(balWt)+' g</b>', fmt(tagWt - opWt)+' g'];
      });
      content = rows.length ? table(['Product Group','Opening Wt (Non-Tag)','Tag Stock Wt','Issued / Sold Wt','Closing Balance Wt','Tag vs Non-Tag Diff'], rows) : '<p class="empty">No stock groups found.</p>';
    }
    else if(name === 'Reorder & Inactive Customer'){
      const reorders = products.map(p=>{
        const avail = tags.filter(t=>t.product===p.name && t.status!=='Sold').reduce((a,t)=>a+n(t.netWeight||t.weight),0) + n(p.openingNet);
        const sold = sales.filter(s=>s.product===p.name).reduce((a,s)=>a+n(s.weight),0);
        const bal = Math.max(0, avail - sold);
        return ['<b>'+esc(p.name)+'</b>', esc(p.group||'—'), fmt(p.openingNet)+' g', fmt(bal)+' g', bal<5?'<span class="rco-badge rco-badge-cancel">Low Stock</span>':'<span class="rco-badge rco-badge-open">OK</span>'];
      });
      content = reorders.length ? table(['Product Name','Group','Opening Net','InStock Net g','Reorder Status'], reorders) : '<p class="empty">No products found.</p>';
    }
    else if(name === 'Gift Voucher & Order Summary'){
      content = table(['Module','Total Count','Active / Valid','Redeemed / Closed','Total Value ₹'], [
        ['Gift Vouchers', vouchers.length, vouchers.filter(v=>!v.isRedeemed).length, vouchers.filter(v=>v.isRedeemed).length, rateMoney(vouchers.reduce((a,v)=>a+n(v.amount),0))],
        ['Retail Orders', orders.length, orders.filter(o=>o.status==='Open').length, orders.filter(o=>o.status==='Closed').length, rateMoney(orders.reduce((a,o)=>a+n(o.netAmount),0))]
      ]);
    }

    return '<section class="panel">'
      + '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" onclick="rarBack()">← All Reports</button><h2 style="margin:0">'+esc(name)+'</h2></div>'
      + '<div class="rco-toolbar-right"><label style="font-size:12px">From <input type="date" value="'+esc(rarState.from)+'" onchange="rarState.from=this.value;render()"></label><label style="font-size:12px">To <input type="date" value="'+esc(rarState.to)+'" onchange="rarState.to=this.value;render()"></label>'+subToolbar+' <button type="button" onclick="rarDownloadCsv()">CSV</button> <button type="button" onclick="window.print()">🖨️ Print</button></div></div>'
      + '<div id="rar-report-results">'+content+'</div></section>';
  }

  const rarPrevReportsView = window.reportsView;
  window.reportsView = function(){
    if(workspaceMode !== 'retail') return rarPrevReportsView ? rarPrevReportsView() : '';
    if(window.tagReportActive) return tagReportsView();
    if(window.tradeReportActive) return tradeReportsView();
    if(rarState.active) return rarRenderReport(rarState.active);

    const sections = [
      ['Sales, Trade & Reorder Reports', [
        ['Sales & Purchase (Built-in)', "tradeReportOpen('Sales')"],
        ['Purchase Reports (Built-in)', "tradeReportOpen('Purchase')"],
        ['Sale Bill Summary Matrix', "rarOpen('Sale Bill Summary Matrix')"],
        ['Top Sales (Centralized)', "rarOpen('Top Sales (Centralized)')"],
        ['Sales Item Wastage & MC Analysis', "rarOpen('Sales Item Wastage & MC Analysis')"],
        ['Sale Bill Wise Profit Pure Rate', "rarOpen('Sale Bill Wise Profit Pure Rate')"],
        ['Sale Register (26 Col)', "rarOpen('Sale Register (26 Col)')"],
        ['Reorder & Inactive Customer', "rarOpen('Reorder & Inactive Customer')"],
        ['Gift Voucher & Order Summary', "rarOpen('Gift Voucher & Order Summary')"]
      ]],
      ['Stock & Tagging Reports', [
        ['Tag Stocks (Built-in)', "tagReportOpen('Tag Stocks')"],
        ['Tag Stock V1 (Built-in)', "tagReportOpen('Tag Stock V1')"],
        ['Tag Agewise Report (Built-in)', "tagReportOpen('Tag Age Wise')"],
        ['Overall Available Tag (Built-in)', "tagReportOpen('Overall Available Tag')"],
        ['Stock V1 & Overall Stock', "rarOpen('Stock V1 & Overall Stock')"]
      ]],
      ['Chit & Savings Reports', [
        ['All 11 Chit Reports (Built-in)', "go('Chit Reports')"]
      ]],
      ['Accounts, Books & Financial Statements', [
        ['Trial Balance / Balance Sheet / P&L', "rgaState.mainTab='Accounts & Reports';go('Parent Group')"],
        ['DayBook Transactions', "rarOpen('DayBook Report')"],
        ['DayBook Abstract', "rarOpen('DayBook Abstract')"],
        ['Cashbook Report', "rarOpen('Cashbook Report')"],
        ['Bankbook Report', "rarOpen('Bankbook Report')"],
        ['Bill Entry Report', "rarOpen('Bill Entry Report')"],
        ['Outstanding Report', "rarOpen('Outstanding Report')"],
        ['Advance Amount Report', "rarOpen('Advance Amount Report')"],
        ['Expense Report', "rarOpen('Expense Report')"]
      ]],
      ['GST & Tax Reports', [
        ['GSTR1 Report & JSON Export', "rarOpen('GSTR1 Report')"],
        ['GSTR1 B2B & B2C Invoices', "rarOpen('GSTR1 B2B & B2C Invoices')"],
        ['GSTR1 HSN/SAC Summary', "rarOpen('GSTR1 HSN/SAC Summary')"],
        ['GSTR3B Report', "rarOpen('GSTR3B Report')"]
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
