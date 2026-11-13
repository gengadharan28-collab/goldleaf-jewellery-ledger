// Retail purchase documents share the existing shop ledger JSON and RLS.
const RP_SECTIONS=['Purchase','Purchase Return','Payment','Old Jewel Purchase','Old Jewel Purchase Return','Purchase Entry (Bills)','Kacha Pure Conversion'];
const RP_KINDS=['purchase','purchase-return','payment','old-purchase','old-return','bill-entry','conversion'];
let rpSection='Purchase',rpEdit='',rpSupplierFilter='';

function rpEnsure(){
  if(!Array.isArray(db.retailSuppliers))db.retailSuppliers=[];
  if(!Array.isArray(db.retailDocuments))db.retailDocuments=[];
}
function rpDocs(kind,supplierId){
  rpEnsure();
  return db.retailDocuments.filter(x=>(!kind||x.kind===kind)&&(!supplierId||x.supplierId===supplierId));
}
function rpSupplier(id){
  rpEnsure();
  return db.retailSuppliers.find(x=>x.id===id);
}
function rpSupplierOptions(id='',empty='Select supplier / seller'){
  rpEnsure();
  return '<option value="">'+empty+'</option>'+db.retailSuppliers.map(x=>'<option value="'+esc(x.id)+'" '+(id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('');
}

function rpItemCalc(x,kind='purchase'){
  const id=x.id||crypto.randomUUID();
  const metal=x.metal==='Silver'?'Silver':'Gold';
  const pieces=n(x.pieces||1);
  const grossWeight=n(x.grossWeight);
  const lessWeight=n(x.lessWeight);
  const netWeight=rbGrams(Math.max(0,grossWeight-lessWeight));
  const meltingLossPercent=n(x.meltingLossPercent||x.meltingLoss||0);
  const meltingLossWeight=rbGrams(netWeight*meltingLossPercent/100);
  const touchPercent=n(x.purity??(kind==='old-purchase'?91.6:100)); // Assayed Touch %
  const purity=touchPercent;
  const netMelted=rbGrams(Math.max(0,netWeight-meltingLossWeight));
  const pureWeight=rbGrams(netMelted*touchPercent/100);
  const wastage=n(x.wastage||0);
  const wastageWeight=rbGrams(netWeight*wastage/100);
  const payablePure=kind==='old-purchase'?pureWeight:rbGrams(pureWeight+wastageWeight);
  const rate=n(x.rate);
  const makingMode=x.makingMode==='gram'?'gram':x.makingMode==='fixed'?'fixed':'piece';
  const makingRate=n(x.makingRate);
  const makingTotal=kind==='old-purchase'?0:rbRound(makingRate*(makingMode==='gram'?netWeight:makingMode==='piece'?pieces:1));
  const stoneAmount=n(x.stoneAmount||0);
  const otherAmount=n(x.otherAmount||0);
  const metalAmount=rbRound(payablePure*rate);
  const subtotal=kind==='old-purchase'?rbRound(metalAmount-otherAmount):rbRound(metalAmount+makingTotal+stoneAmount+otherAmount);

  if(kind==='bill-entry'){
    const quantity=n(x.quantity),discount=n(x.discount),base=rbRound(quantity*rate),gstRate=n(x.gstRate),after=rbRound(Math.max(0,base-discount));
    return Object.assign({},x,{id,product:String(x.product||'').trim(),quantity,rate,discount,gstRate,base,subtotal:after,grossWeight:0,netWeight:0,pureWeight:0,payablePure:0,pieces:quantity,metal:'Other',makingTotal:0,otherAmount:0});
  }

  return Object.assign({},x,{
    id,metal,product:String(x.product||'').trim(),huid:String(x.huid||x.tagCode||'').trim(),tagCode:String(x.tagCode||x.huid||'').trim(),
    pieces,grossWeight,lessWeight,netWeight,meltingLossPercent,meltingLossWeight,purity,touchPercent,
    pureWeight,wastage,wastageWeight,payablePure,rate,makingMode,makingRate,makingTotal,
    stoneAmount,otherAmount,metalAmount,subtotal
  });
}

function rpPurchaseCalc(items,options={}){
  const kind=options.kind||'purchase',rows=items.map(x=>rpItemCalc(x,kind)),subtotal=rbRound(rows.reduce((s,x)=>s+x.subtotal,0));
  const discount=n(options.discount),otherCharges=n(options.otherCharges),gstEnabled=!!options.gstEnabled,gstRate=n(options.gstRate),inclusive=options.taxTreatment==='inclusive',basis=kind==='bill-entry'?'amount':options.basis==='metal'?'metal':'amount';
  let taxable=0,tax=0;
  if(kind==='bill-entry'){
    for(const x of rows){
      const share=subtotal>0?discount*x.subtotal/subtotal:0,value=Math.max(0,x.subtotal-share),r=gstEnabled?x.gstRate:0,base=inclusive?value/(1+r/100):value;
      taxable+=base;tax+=base*r/100;
    }
    taxable+=otherCharges;
  } else {
    const after=Math.max(0,subtotal-discount+otherCharges),base=gstEnabled&&inclusive?after/(1+gstRate/100):after;
    taxable=base;tax=gstEnabled?base*gstRate/100:0;
  }
  taxable=rbRound(taxable);tax=rbRound(tax);

  // TDS (Section 194Q - 0.1% deduction) / TCS (Section 206C(1H) - 0.1% addition)
  const tdsTcsMode=options.tdsTcsMode||'none';
  let tdsAmount=0,tcsAmount=0;
  if(tdsTcsMode==='tds194q'){
    tdsAmount=rbRound(taxable*0.001);
  } else if(tdsTcsMode==='tcs206c'){
    tcsAmount=rbRound((taxable+tax)*0.001);
  }

  const beforeRound=rbRound(taxable+tax+tcsAmount-tdsAmount);
  const rounded=options.roundMode==='nearest'?Math.round(beforeRound):options.roundMode==='down'?Math.floor(beforeRound):options.roundMode==='up'?Math.ceil(beforeRound):beforeRound;
  const roundOff=rbRound(rounded-beforeRound);
  const totalAmount=rbRound(rounded);

  const goldPure=rbGrams(rows.filter(x=>x.metal==='Gold').reduce((s,x)=>s+x.payablePure,0));
  const silverPure=rbGrams(rows.filter(x=>x.metal==='Silver').reduce((s,x)=>s+x.payablePure,0));
  const charges=rbRound(rows.reduce((s,x)=>s+x.makingTotal+x.otherAmount+x.stoneAmount,0)+otherCharges+tax+tcsAmount-tdsAmount-discount+roundOff);
  const amountDebit=basis==='metal'?charges:totalAmount;

  // Multi-Mode Payment Breakdown
  const paidCash=n(options.paidCash||0);
  const paidBank=n(options.paidBank||0);
  const paidCard=n(options.paidCard||0);
  const paidUpi=n(options.paidUpi||0);
  const legacyPaid=n(options.paidAmount||0);
  const totalPaidMoney=rbRound(paidCash+paidBank+paidCard+paidUpi+(legacyPaid&&!paidCash&&!paidBank&&!paidCard&&!paidUpi?legacyPaid:0));
  const metalDelivered=rbGrams(options.metalDelivered||0);
  const metalDeliveredMetal=options.metalDeliveredMetal||'Gold';

  const goldDebit=basis==='metal'?(metalDeliveredMetal==='Gold'?Math.max(0,rbGrams(goldPure-metalDelivered)):goldPure):0;
  const silverDebit=basis==='metal'?(metalDeliveredMetal==='Silver'?Math.max(0,rbGrams(silverPure-metalDelivered)):silverPure):0;

  return {
    rows,subtotal,discount,otherCharges,gstEnabled,gstRate,taxTreatment:inclusive?'inclusive':'exclusive',
    taxableValue:taxable,gstAmount:tax,tdsTcsMode,tdsAmount,tcsAmount,roundOff,totalAmount,basis,
    goldPure,silverPure,amountDebit,goldDebit,silverDebit,
    paidCash,paidBank,paidCard,paidUpi,paidAmount:totalPaidMoney,
    paidBankRef:String(options.paidBankRef||'').trim(),paidUpiRef:String(options.paidUpiRef||'').trim(),
    metalDelivered,metalDeliveredMetal,
    balance:rbRound(amountDebit-totalPaidMoney),
    grossWeight:rbGrams(rows.reduce((s,x)=>s+x.grossWeight,0)),
    netWeight:rbGrams(rows.reduce((s,x)=>s+x.netWeight,0)),
    pieces:rows.reduce((s,x)=>s+x.pieces,0)
  };
}

function rpReturnUsed(sourceId,itemId,exclude=''){
  return rpDocs().filter(x=>x.id!==exclude&&['purchase-return','old-return'].includes(x.kind)&&x.sourceId===sourceId&&x.sourceItemId===itemId).reduce((a,x)=>({quantity:a.quantity+n(x.returnQuantity),weight:a.weight+n(x.returnWeight),amount:a.amount+n(x.creditAmount),gold:a.gold+n(x.goldCredit),silver:a.silver+n(x.silverCredit)}),{quantity:0,weight:0,amount:0,gold:0,silver:0});
}
function rpReturnLimit(sourceId,itemId,exclude=''){
  const source=rpDocs().find(x=>x.id===sourceId),item=source?.items?.find(x=>x.id===itemId);
  if(!item)return null;
  const used=rpReturnUsed(sourceId,itemId,exclude),byQty=source.kind==='bill-entry',quantity=byQty?n(item.quantity):n(item.netWeight),share=n(source.subtotal)>0?n(item.subtotal)/n(source.subtotal):0,amount=source.basis==='metal'?n(source.amountDebit)*share:n(source.totalAmount)*share;
  return {source,item,used,byQty,available:rbGrams(quantity-(byQty?used.quantity:used.weight)),originalQuantity:quantity,originalAmount:amount,availableAmount:rbRound(amount-used.amount)};
}
function rpOldApplied(id,excludeInvoice=''){
  return rbCustomerSales().filter(s=>s.id!==excludeInvoice).reduce((total,s)=>total+(s.oldGoldItems||[]).filter(x=>x.purchaseDocId===id).reduce((v,x)=>v+n(x.amount),0),0);
}
function rpSupplierBalance(id,exclude=''){
  const supplier=rpSupplier(id)||{};let amount=n(supplier.openingAmount),gold=n(supplier.openingGold),silver=n(supplier.openingSilver);
  for(const d of rpDocs('',id).filter(x=>x.id!==exclude)){
    if(['purchase','old-purchase','bill-entry'].includes(d.kind)){
      amount+=n(d.amountDebit)-n(d.paidAmount);
      gold+=n(d.goldDebit);
      silver+=n(d.silverDebit);
      if(d.kind==='old-purchase')amount-=rpOldApplied(d.id);
    }else if(['purchase-return','old-return'].includes(d.kind)){
      amount-=n(d.creditAmount);
      gold-=n(d.goldCredit);
      silver-=n(d.silverCredit);
      amount+=n(d.refundReceived);
    }else if(d.kind==='payment'){
      const sign=d.direction==='refund'?1:-1;
      amount+=sign*n(d.amountCredit);
      gold+=sign*n(d.goldCredit);
      silver+=sign*n(d.silverCredit);
    }else if(d.kind==='conversion'){
      amount+=n(d.labourCharge)-n(d.paidAmount);
    }
  }
  return {amount:rbRound(amount),gold:rbGrams(gold),silver:rbGrams(silver)};
}
function rpStockSources(exclude=''){
  const sources=rpDocs('old-purchase').map(d=>({id:d.id,label:(d.documentNo||d.id.slice(0,8))+' · '+(rpSupplier(d.supplierId)?.name||'Seller'),metal:d.metal||d.items?.[0]?.metal||'Gold',weight:n(d.netWeight),pure:(d.items||[]).reduce((s,x)=>s+n(x.pureWeight),0),amount:n(d.totalAmount),returned:rpDocs('old-return').filter(x=>x.sourceId===d.id).reduce((s,x)=>s+n(x.returnWeight),0)}));
  for(const s of rbCustomerSales()){const items=(s.oldGoldItems||[]).filter(x=>!x.purchaseDocId);if(items.length)sources.push({id:'sale:'+s.id,label:'Exchange '+(s.documentNo||s.id.slice(0,8))+' · '+accountName(s.partyId,'customer'),metal:'Gold',weight:items.reduce((v,x)=>v+n(x.weight),0),pure:items.reduce((v,x)=>v+n(x.pureGrams),0),amount:items.reduce((v,x)=>v+n(x.amount),0),returned:0});}
  return sources.map(s=>{const used=rpDocs('conversion').filter(x=>x.id!==exclude).reduce((sum,d)=>sum+(d.sources||[]).filter(x=>x.sourceId===s.id).reduce((v,x)=>v+n(x.weight),0),0),available=rbGrams(s.weight-s.returned-used);return Object.assign({},s,{available:Math.max(0,available)});});
}
function rpConversionCalc(sources,options={}){
  const weight=rbGrams(sources.reduce((s,x)=>s+n(x.weight),0)),stoneWeight=n(options.stoneWeight),net=rbGrams(weight-stoneWeight),meltedWeight=n(options.meltedWeight),outputWeight=n(options.outputWeight),outputPurity=n(options.outputPurity),pureReceived=rbGrams(outputWeight*outputPurity/100),expectedPure=rbGrams(sources.reduce((s,x)=>s+n(x.expectedPure),0));
  return {weight,stoneWeight,net,meltedWeight,outputWeight,outputPurity,pureReceived,expectedPure,meltingLoss:rbGrams(net-meltedWeight),pureVariance:rbGrams(expectedPure-pureReceived)};
}

window.rpOpen=function(section='Purchase'){
  if(!RP_SECTIONS.includes(section)||!rbCanLeave())return;
  rpSection=section;rpEdit='';edit=null;page='Purchase';render();window.scrollTo?.(0,0);
};
window.rpEditDocument=function(id){
  if(!rbCanLeave())return;
  const d=rpDocs().find(x=>x.id===id);
  if(!d)return;
  rpEdit=id;rpSection=RP_SECTIONS[RP_KINDS.indexOf(d.kind)];page='Purchase';render();window.scrollTo?.(0,0);
};

const rpPriorDirty=window.rbDirty;
window.rbDirty=function(){return rpPriorDirty()||!!document.querySelector('#rpDocumentForm[data-entry-dirty="1"],#rpSupplierPanel:not(.hidden) #rpSupplierForm[data-entry-dirty="1"]');};
for(const event of ['input','change'])document.addEventListener(event,e=>{const form=e.target.closest?.('#rpDocumentForm,#rpSupplierForm');if(form)rbMarkDirty(form);},true);

const rpPriorSave=window.save;
window.save=function(){
  rpEnsure();
  if(db.recordsResetToken)for(const key of ['retailSuppliers','retailDocuments'])for(const row of db[key])row.recordsResetToken=db.recordsResetToken;
  return rpPriorSave();
};
const rpPriorMerge=window.v2MergeCloudLedgers;
window.v2MergeCloudLedgers=function(remote,local,preferLocal=true){
  const merged=rpPriorMerge(remote,local,preferLocal),token=remote?.recordsResetToken||'',fresh=!token||local?.recordsResetToken===token;
  for(const key of ['retailSuppliers','retailDocuments']){
    const rows=new Map();
    for(const row of [...(remote?.[key]||[]),...(fresh?local?.[key]||[]:[])]){
      if(token&&row.recordsResetToken!==token)continue;
      const previous=rows.get(row.id);
      if(!previous||Date.parse(row.updatedAt||row.createdAt||0)>=Date.parse(previous.updatedAt||previous.createdAt||0))rows.set(row.id,row);
    }
    merged[key]=[...rows.values()];
  }
  return merged;
};

function rpInput(key,value,type='number',extra=''){
  return '<input data-rp-item="'+key+'" type="'+type+'" value="'+esc(value??'')+'"'+rbKeyboard(type,extra)+' '+extra+'>';
}

function rpItemMarkup(item={},index=0,kind='purchase'){
  const x=rpItemCalc(item,kind),input=(key,step='.001',cls='')=>rpInput(key,x[key]||'','number','min="0" step="'+step+'" aria-label="'+key+'" class="'+cls+'"'),select=(key,choices,value)=>'<select data-rp-item="'+key+'" aria-label="'+key+'">'+rbOptions(choices,value)+'</select>';
  let cells=[];
  if(kind==='bill-entry'){
    cells=[
      rpInput('product',x.product,'text','placeholder="Item / description" required'),
      rpInput('hsn',x.hsn||'','text','placeholder="HSN"'),
      input('quantity','any'),
      select('uom',['pcs','g','kg','service','other'],x.uom||'pcs'),
      input('rate','.01'),
      input('discount','.01'),
      input('gstRate','.01'),
      '<output data-rp-out="subtotal">'+rateMoney(x.subtotal)+'</output>'
    ];
  } else if(kind==='old-purchase'){
    cells=[
      rpInput('product',x.product||'Old Gold','text','placeholder="Scrap ornament description" required'),
      select('metal',['Gold','Silver'],x.metal),
      input('grossWeight','.001'),
      input('lessWeight','.001'),
      '<output data-rp-out="netWeight">'+fmt(x.netWeight)+'</output>',
      input('meltingLossPercent','.01'),
      input('purity','.01'),
      '<output data-rp-out="pureWeight">'+fmt(x.pureWeight)+'</output>',
      input('rate','.01'),
      input('otherAmount','.01'),
      '<output data-rp-out="subtotal">'+rateMoney(x.subtotal)+'</output>'
    ];
  } else {
    cells=[
      rpInput('product',x.product,'text','placeholder="Jewellery product" required'),
      rpInput('huid',x.huid||'','text','placeholder="HUID / Tag" style="max-width:85px"'),
      select('metal',['Gold','Silver'],x.metal),
      input('pieces','1'),
      input('grossWeight','.001'),
      input('lessWeight','.001'),
      '<output data-rp-out="netWeight">'+fmt(x.netWeight)+'</output>',
      input('meltingLossPercent','.01'),
      input('purity','.01'),
      '<output data-rp-out="pureWeight">'+fmt(x.pureWeight)+'</output>',
      input('wastage','.01'),
      '<output data-rp-out="payablePure">'+fmt(x.payablePure)+'</output>',
      input('rate','.01'),
      '<select data-rp-item="makingMode" aria-label="Making basis">'+[['piece','Per pc'],['gram','Per g'],['fixed','Fixed']].map(([v,label])=>'<option value="'+v+'" '+(v===x.makingMode?'selected':'')+'>'+label+'</option>').join('')+'</select>',
      input('makingRate','.01'),
      input('stoneAmount','.01'),
      input('otherAmount','.01'),
      '<output data-rp-out="subtotal">'+rateMoney(x.subtotal)+'</output>'
    ];
  }
  return '<tbody class="rp-item" data-rp-id="'+x.id+'"><tr><td>'+(index+1)+'</td>'+cells.map(c=>'<td>'+c+'</td>').join('')+'<td><button type="button" aria-label="Remove purchase item" onclick="rpRemoveItem(this)">×</button></td></tr></tbody>';
}

function rpReadItems(form){
  return [...form.querySelectorAll('.rp-item')].map(node=>{
    const row={id:node.dataset.rpId};
    node.querySelectorAll('[data-rp-item]').forEach(e=>row[e.dataset.rpItem]=e.value);
    return rpItemCalc(row,form.dataset.kind);
  });
}

window.rpAddItem=function(){
  const f=document.getElementById('rpDocumentForm'),kind=f.dataset.kind,metal=f.elements.metal?.value||'Gold';
  f.querySelector('tfoot').insertAdjacentHTML('beforebegin',rpItemMarkup({metal,purity:100,pieces:1,rate:metal==='Silver'?db.rates.silver:db.rates.gold24,gstRate:3},f.querySelectorAll('.rp-item').length,kind));
  rbMarkDirty(f);rpRecalc(f);
};
window.rpRemoveItem=function(button){
  const f=button.closest('form'),row=button.closest('.rp-item');
  if(f.querySelectorAll('.rp-item').length===1)return say('Keep one item row.');
  row.remove();rbMarkDirty(f);rpRecalc(f);
};

function rpItemsView(doc,kind){
  const items=doc?.items?.length?doc.items:[{pieces:1,purity:100,rate:db.rates.gold24,gstRate:3}];
  let heads=[];
  if(kind==='bill-entry'){
    heads=['No.','Item / description','HSN','Qty','UOM','Rate ₹','Discount ₹','GST %','Base amount ₹',''];
  } else if(kind==='old-purchase'){
    heads=['No.','Scrap Description','Metal','Gross g','Less g','Net g','Melt Loss %','Touch %','Pure g','Rate / pure g ₹','Testing Fee / Other ₹','Line amount ₹',''];
  } else {
    heads=['No.','Product','HUID / Tag','Metal','Pcs','Gross g','Less g','Net g','Melt Loss %','Touch %','Pure g','Wst %','Payable pure g','Pure rate / g ₹','Making by','Making ₹','Stone ₹','Other ₹','Amount ₹',''];
  }
  return '<section class="panel rb-items">'
    +'<div class="rb-section-head"><h2>'+(kind==='old-purchase'?'Scrap old jewellery items':kind==='bill-entry'?'Billed expense items':'Purchase inward items')+'</h2><button type="button" onclick="rpAddItem()">＋ Add item</button></div>'
    +'<div class="rb-item-scroll"><table class="rp-items-table" id="rpItemsTable"><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead>'+items.map((x,i)=>rpItemMarkup(x,i,kind)).join('')+'<tfoot><tr><td colspan="'+(heads.length-2)+'">Item total</td><td id="rpItemsValue">₹ 0.00</td><td></td></tr></tfoot></table></div>'
    +'<p class="hint">'+(kind==='bill-entry'?'Quantity × rate, less item discount. GST is recorded at each entered item rate.':kind==='old-purchase'?'Scrap Purchase: Pure weight = (Net weight − Melting loss) × Touch %. Line amount = (Pure weight × Pure rate) − Testing fee / deductions.':'Touch % = assayed testing purity. Pure weight = (Net weight − Melting loss) × Touch %. Payable pure = Pure weight + Wastage weight. Line amount = (Payable pure × Pure rate) + Making charges + Stone + Other charges.')+'</p>'
    +'</section>';
}

function rpHeader(){
  return '<header class="rb-header"><div><div class="eyebrow">GOLDLEAF · RETAIL PURCHASE</div><h1>'+rpSection+'</h1></div>'
    +'<div class="rb-tools">'
    +'<button type="button" onclick="if(rbCanLeave())go(\'Dashboard\')">Home</button>'
    +'<button type="button" onclick="rpSuppliers()">Suppliers</button>'
    +'<button type="button" onclick="rpLedger()">Ledger</button>'
    +'<button type="button" onclick="rpHistory()">History</button>'
    +'</div></header>'
    +'<label class="rb-mobile-section"><span>Purchase section</span><select aria-label="Purchase section" onchange="rpOpen(this.value);this.value=rpSection">'
    +RP_SECTIONS.map(x=>'<option value="'+x+'" '+(rpSection===x?'selected':'')+'>'+x+'</option>').join('')
    +'</select></label>'
    +'<nav class="rb-tabs rb-purchase-tabs" aria-label="Retail Purchase sections">'
    +RP_SECTIONS.map(x=>'<button type="button" class="'+(x===rpSection?'active':'')+'" onclick="rpOpen(\''+x+'\')">'+x+'</button>').join('')
    +'</nav>';
}

function rpSourcesOptions(kind,id='',supplierId=''){
  const kinds=kind==='old-return'?['old-purchase']:['purchase','bill-entry'];
  return '<option value="">Select original purchase</option>'+rpDocs().filter(x=>kinds.includes(x.kind)&&(!supplierId||x.supplierId===supplierId)).map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc((x.documentNo||x.id.slice(0,8))+' · '+(rpSupplier(x.supplierId)?.name||''))+'</option>').join('');
}

function rpReturnView(doc={},kind){
  const source=rpDocs().find(x=>x.id===doc.sourceId);
  return '<section class="panel"><div class="rb-record-grid">'
    +'<label class="rb-field rb-wide"><span>Original purchase *</span><select name="sourceId" required onchange="rpReturnItems(this.form)">'+rpSourcesOptions(kind,doc.sourceId,doc.supplierId)+'</select></label>'
    +'<label class="rb-field rb-wide"><span>Original item *</span><select name="sourceItemId" required onchange="rpReturnCalc(this.form,true)">'+(source?(source.items||[]).map(x=>'<option value="'+x.id+'" '+(x.id===doc.sourceItemId?'selected':'')+'>'+esc(x.product)+'</option>').join(''):'<option value="">Select an original purchase</option>')+'</select></label>'
    +rbInput('Quantity / net grams to return *','returnQuantity',doc.returnQuantity||doc.returnWeight||'','number','required min=".001" step="any" oninput="rpReturnCalc(this.form,true)"')
    +rbInput('Return credit · ₹ *','creditAmount',doc.creditAmount||'','number','min="0" step=".01" required')
    +rbInput('Supplier refund received · ₹','refundReceived',doc.refundReceived||0,'number','min="0" step=".01"')
    +rbInput('Reason','reason',doc.reason||'')
    +'<p class="hint rb-wide" id="rpReturnLimit">Select the original record to see remaining return quantity and value.</p>'
    +'</div><p class="hint">The return reduces supplier payable. A refund received settles supplier credit and does not reduce payable twice.</p></section>';
}

function rpPaymentView(doc={}){
  return '<section class="panel"><div class="rb-record-grid">'
    +'<label class="rb-field"><span>Direction</span><select name="direction">'+[['paid','Pay supplier'],['refund','Receive supplier refund']].map(([v,l])=>'<option value="'+v+'" '+((doc.direction||'paid')===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'
    +'<label class="rb-field"><span>Payment entry type</span><select name="paymentMode">'+[['money','Cash / bank / digital'],['metal','Metal delivery / receipt'],['cutoff','Cash converted to metal balance']].map(([v,l])=>'<option value="'+v+'" '+((doc.paymentMode||'money')===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'
    +'</div>'
    +'<div data-rp-payment="money,cutoff">'
    +'<div class="rb-section-head"><h3>Payment methods</h3><button type="button" onclick="rpAddCollection()">＋ Add method</button></div>'
    +'<div id="rpCollections">'+(doc.collections?.length?doc.collections:[{}]).map(rbCollectionRow).join('')+'</div>'
    +rbInput('Negotiated discount / write-off · ₹','paymentDiscount',doc.paymentDiscount||0,'number','min="0" step=".01"')
    +'</div>'
    +'<div class="rb-record-grid" data-rp-payment="metal,cutoff">'
    +'<label class="rb-field"><span>Metal</span><select name="paymentMetal">'+rbOptions(['Gold','Silver'],doc.paymentMetal||'Gold')+'</select></label>'
    +'<label class="rb-field" data-rp-payment="metal"><span>Apply metal to</span><select name="allocation">'+[['metal','Metal gram balance'],['amount','Rupee balance at agreed rate']].map(([v,l])=>'<option value="'+v+'" '+((doc.allocation||'metal')===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'
    +rbInput('Gross weight · g','paymentWeight',doc.paymentWeight||'','number','min="0" step=".001" data-rp-payment="metal"')
    +rbInput('Less / stone weight · g','paymentLess',doc.paymentLess||0,'number','min="0" step=".001" data-rp-payment="metal"')
    +rbInput('Testing purity · %','paymentPurity',doc.paymentPurity||100,'number','min="1" max="100" step="any" data-rp-payment="metal"')
    +rbInput('Agreed pure rate / g · ₹','paymentRate',doc.paymentRate||db.rates.gold24||0,'number','min="0" step=".01"')
    +'</div><p class="hint">Rupee payments settle amount payable. Cutoff settles only the chosen metal balance; metal entries keep grams separate from cash.</p></section>';
}

window.rpAddCollection=function(){
  const form=document.getElementById('rpDocumentForm');
  form.querySelector('#rpCollections').insertAdjacentHTML('beforeend',rbCollectionRow());
  rbMarkDirty(form);
};

function rpConversionView(doc={}){
  const sources=rpStockSources(doc.id).filter(x=>x.available>0||(doc.sources||[]).some(a=>a.sourceId===x.id));
  return '<section class="panel"><div class="rb-section-head"><h2>Old metal sources</h2><span>Unconverted weight only</span></div>'
    +'<div class="rp-stock-list">'+(sources.map(s=>{const value=(doc.sources||[]).find(x=>x.sourceId===s.id);return '<label><span><b>'+esc(s.label)+'</b><small>'+s.metal+' · available '+fmt(s.available)+' net g</small></span><input type="number" data-rp-source="'+esc(s.id)+'" value="'+esc(value?.weight||'')+'" min="0" max="'+s.available+'" step=".001" placeholder="Use net g" aria-label="Source weight to convert"></label>';}).join('')||'<p class="hint">Record an Old Jewel Purchase or a sales exchange first. Source weight becomes available here.</p>')+'</div>'
    +'<div class="rb-detail-grid">'
    +rbInput('Stone / impurity weight · g','stoneWeight',doc.stoneWeight||0,'number','min="0" step=".001"')
    +rbInput('Melted weight · g *','meltedWeight',doc.meltedWeight||'','number','required min=".001" step=".001"')
    +rbInput('Output bar weight · g *','outputWeight',doc.outputWeight||'','number','required min=".001" step=".001"')
    +rbInput('Output testing purity · % *','outputPurity',doc.outputPurity||'','number','required min="1" max="100" step="any"')
    +rbInput('Refining / labour charge · ₹','labourCharge',doc.labourCharge||0,'number','min="0" step=".01"')
    +rbInput('Refining charge paid · ₹','paidAmount',doc.paidAmount||0,'number','min="0" step=".01"')
    +'</div><p class="hint">Selected source weight is reserved by this conversion. Melting loss and pure recovery variance are recorded separately.</p></section>';
}

function rpFormView(){
  rpEnsure();
  const kind=RP_KINDS[RP_SECTIONS.indexOf(rpSection)],doc=rpDocs().find(x=>x.id===rpEdit),x=doc||{};
  const invoice=['purchase','old-purchase','bill-entry'].includes(kind);
  const returns=['purchase-return','old-return'].includes(kind);
  const supplier=rpSupplier(x.supplierId);

  const dualBalanceMarkup = 
    '<div id="rpSupplierDualTracker" class="rp-dual-tracker">'
    +'<div class="rp-dual-card rp-card-cash" onclick="rpLedger()" title="Click to view Supplier Ledger">'
    +'<span class="rp-card-label">Cash Ledger Balance</span>'
    +'<b class="rp-card-val" id="rpDualCash">₹ 0.00</b>'
    +'<span class="rp-card-badge" id="rpDualCashBadge">Clear</span>'
    +'</div>'
    +'<div class="rp-dual-card rp-card-gold" onclick="rpLedger()" title="Click to view Supplier Ledger">'
    +'<span class="rp-card-label">Pure Gold Vault</span>'
    +'<b class="rp-card-val" id="rpDualGold">0.000 g</b>'
    +'<span class="rp-card-badge" id="rpDualGoldBadge">Vault 0.000 g</span>'
    +'</div>'
    +'<div class="rp-dual-card rp-card-silver" onclick="rpLedger()" title="Click to view Supplier Ledger">'
    +'<span class="rp-card-label">Pure Silver Vault</span>'
    +'<b class="rp-card-val" id="rpDualSilver">0.000 g</b>'
    +'<span class="rp-card-badge" id="rpDualSilverBadge">Vault 0.000 g</span>'
    +'</div>'
    +'</div>';

  const common = 
    rbInput('Document date & time *','when',x.when||rbNow(),'datetime-local','required')
    +rbInput('Entry / bill number','documentNo',x.documentNo||'','text','placeholder="Auto after saving" maxlength="60"')
    +'<label class="rb-field"><span>'+(kind==='conversion'?'Refiner / supplier · optional':'Supplier / seller *')+'</span><select name="supplierId" class="rp-supplier-select" '+(kind==='conversion'?'':'required')+' onchange="rpSupplierChanged(this.form)">'+rpSupplierOptions(x.supplierId)+'</select></label>'
    +rbInput('Reference / supplier document','reference',x.reference||'')
    +rbInput('Counter','counter',x.counter||'Counter 1','text')
    +rbInput('Supplier document date','supplierDate',x.supplierDate||'','date');

  const content=invoice?rpItemsView(doc,kind):returns?rpReturnView(x,kind):kind==='payment'?rpPaymentView(x):rpConversionView(x);

  const multiModeMarkup = 
    '<div class="rp-multimode-settle">'
    +'<div class="rp-multimode-head"><span>Multi-Mode Payment Settlement</span><span>Inward Payout</span></div>'
    +'<div class="rp-multimode-grid">'
    +rbInput('Cash paid ₹','paidCash',x.paidCash||x.paidAmount||0,'number','min="0" step=".01"')
    +rbInput('Bank / NEFT ₹','paidBank',x.paidBank||0,'number','min="0" step=".01"')
    +rbInput('Bank reference / Cheque','paidBankRef',x.paidBankRef||'','text','placeholder="Cheque / UTR"')
    +rbInput('Card / POS ₹','paidCard',x.paidCard||0,'number','min="0" step=".01"')
    +rbInput('UPI paid ₹','paidUpi',x.paidUpi||0,'number','min="0" step=".01"')
    +rbInput('UPI UTR / Ref','paidUpiRef',x.paidUpiRef||'','text','placeholder="UPI Txn ID"')
    +'</div>'
    +'<div class="rp-multimode-head" style="margin-top:8px"><span>Pure Metal Bullion Delivery</span><span>Bar Settlement</span></div>'
    +'<div class="rp-multimode-grid">'
    +rbInput('Pure bullion delivered · g','metalDelivered',x.metalDelivered||0,'number','min="0" step=".001"')
    +'<label class="rb-field"><span>Delivered metal</span><select name="metalDeliveredMetal">'+rbOptions(['Gold','Silver'],x.metalDeliveredMetal||'Gold')+'</select></label>'
    +'</div>'
    +'</div>';

  const controls=invoice ? 
    '<label class="rb-field"><span>Settlement basis</span><select name="basis" '+(kind==='bill-entry'?'disabled':'')+'>'
    +[['amount','Rupee amount'],['metal','Metal grams + charges ₹']].map(([v,l])=>'<option value="'+v+'" '+((x.basis||'amount')===v?'selected':'')+'>'+l+'</option>').join('')
    +'</select></label>'
    +'<div class="rb-discount-controls">'
    +rbInput('Bill discount · ₹','discount',x.discount||0,'number','min="0" step=".01"')
    +rbInput('Other charges · ₹','otherCharges',x.otherCharges||0,'number','min="0" step=".01"')
    +'</div>'
    +'<label class="pdf-checkbox"><input name="gstEnabled" type="checkbox" '+(x.gstEnabled?'checked':'')+'> Record GST</label>'
    +'<div class="rb-discount-controls">'
    +rbInput('GST percentage','gstRate',x.gstRate||3,'number','min="0" max="100" step="any"')
    +'<label class="rb-field"><span>Tax treatment</span><select name="taxTreatment">'+rbOptions(['exclusive','inclusive'],x.taxTreatment||'exclusive')+'</select></label>'
    +'</div>'
    +'<label class="rb-field"><span>TDS / TCS Withholding Tax</span><select name="tdsTcsMode">'
    +[['none','None (Standard Purchase)'],['tds194q','TDS u/s 194Q (0.1% Deduction)'],['tcs206c','TCS u/s 206C(1H) (0.1% Addition)']].map(([v,l])=>'<option value="'+v+'" '+((x.tdsTcsMode||'none')===v?'selected':'')+'>'+l+'</option>').join('')
    +'</select></label>'
    +'<label class="rb-field"><span>Round off</span><select name="roundMode">'+rbOptions(['none','nearest','down','up'],x.roundMode||'none')+'</select></label>'
    +multiModeMarkup : '';

  return '<div class="rb-screen rp-screen">'+rpHeader()
    +'<form id="rpDocumentForm" class="rp-form" data-kind="'+kind+'" oninput="rpRecalc(this)" onchange="rpRecalc(this)" onsubmit="rpSaveDocument(event)">'
    +'<input type="hidden" name="id" value="'+esc(x.id||'')+'">'
    +'<section class="panel rp-head">'
    +'<div class="rp-head-grid">'+common+'</div>'
    +'<div class="rp-supplier-actions">'
    +'<button type="button" onclick="rpSuppliers(\'new\')">＋ Add supplier / seller</button>'
    +'<button type="button" onclick="rpSuppliers(document.getElementById(\'rpDocumentForm\').elements.supplierId.value)">Edit selected supplier</button>'
    +'<button type="button" onclick="rpLedger()">Supplier Ledger</button>'
    +'</div>'
    +dualBalanceMarkup
    +'</section>'
    +'<div class="rp-document-columns">'
    +'<div class="rp-main-scroll">'+content
    +'<section class="panel"><div class="rb-detail-grid">'+rbInput('Notes / remarks','notes',x.notes||'')+'</div></section>'
    +'</div>'
    +'<aside class="panel rb-totals rp-totals">'
    +'<div class="rp-controls">'+controls+'</div>'
    +'<div id="rpComputed" class="rb-totals-scroll"></div>'
    +'<div class="rb-balance"><span id="rpBalanceLabel">Document balance</span><b id="rpBalanceValue">₹ 0.00</b></div>'
    +'<div class="rb-bill-actions rp-print-actions">'
    +'<button type="button" class="primary" onclick="rpPrintCurrent()">Print Voucher</button>'
    +'<button type="button" class="rp-pill-btn" onclick="rpPrintCurrent(\'detailed\')">A4 Detailed</button>'
    +'<button type="button" class="rp-pill-btn" onclick="rpPrintCurrent(\'compact-a5-p\')">A5 Slip</button>'
    +'<button type="button" class="rp-pill-btn" onclick="rpPrintCurrent(\'thermal-80\')">80mm POS</button>'
    +'<button type="submit" class="primary">'+(doc?'Save changes':'Save entry')+'</button>'
    +'</div>'
    +'<p id="rpSaveMessage" role="status" class="hint"></p>'
    +'</aside>'
    +'</div>'
    +'</form>'
    +'</div>';
}

function rpReadDocument(form){
  const f=form.elements,kind=form.dataset.kind,id=f.id.value,old=rpDocs().find(x=>x.id===id),now=new Date().toISOString();
  const base={
    id:id||crypto.randomUUID(),kind,supplierId:f.supplierId.value,when:f.when.value,
    documentNo:f.documentNo.value.trim()||kind.toUpperCase()+'-'+Date.now().toString(36).toUpperCase(),
    reference:f.reference.value.trim(),counter:f.counter?.value?.trim()||'Counter 1',
    supplierDate:f.supplierDate?.value||'',notes:f.notes?.value?.trim()||'',
    createdAt:old?.createdAt||now,updatedAt:now
  };

  if(['purchase','old-purchase','bill-entry'].includes(kind)){
    const t=rpPurchaseCalc(rpReadItems(form),{
      kind,basis:f.basis?.value,discount:f.discount?.value,otherCharges:f.otherCharges?.value,
      gstEnabled:f.gstEnabled?.checked,gstRate:f.gstRate?.value,taxTreatment:f.taxTreatment?.value,
      tdsTcsMode:f.tdsTcsMode?.value,roundMode:f.roundMode?.value,
      paidCash:f.paidCash?.value,paidBank:f.paidBank?.value,paidBankRef:f.paidBankRef?.value,
      paidCard:f.paidCard?.value,paidUpi:f.paidUpi?.value,paidUpiRef:f.paidUpiRef?.value,
      metalDelivered:f.metalDelivered?.value,metalDeliveredMetal:f.metalDeliveredMetal?.value,
      paidAmount:f.paidAmount?.value
    });
    return Object.assign(base,t,{
      items:t.rows,metal:t.rows[0]?.metal||'Gold',roundMode:f.roundMode?.value||'none',
      paidMethod:t.paidBank>0?'Bank':t.paidUpi>0?'UPI':t.paidCard>0?'Card':'Cash'
    });
  }

  if(['purchase-return','old-return'].includes(kind)){
    const sourceId=f.sourceId.value,sourceItemId=f.sourceItemId.value,limit=rpReturnLimit(sourceId,sourceItemId,id),quantity=n(f.returnQuantity.value),ratio=limit?.originalQuantity>0?quantity/limit.originalQuantity:0,weight=limit?.byQty?0:quantity,pure=limit?.item?n(limit.item.payablePure)*ratio:0;
    return Object.assign(base,{sourceId,sourceItemId,returnQuantity:limit?.byQty?quantity:0,returnWeight:weight,creditAmount:rbRound(n(f.creditAmount.value)),refundReceived:rbRound(n(f.refundReceived.value)),goldCredit:limit?.source.basis==='metal'&&limit.item.metal==='Gold'?rbGrams(pure):0,silverCredit:limit?.source.basis==='metal'&&limit.item.metal==='Silver'?rbGrams(pure):0,product:limit?.item.product||'',reason:f.reason.value.trim(),basis:limit?.source.basis||'amount'});
  }

  if(kind==='payment'){
    const paymentMode=f.paymentMode.value,direction=f.direction.value,collections=paymentMode==='metal'?[]:rbReadCollections(form),paidAmount=rbRound(collections.reduce((s,x)=>s+x.amount,0)),discount=paymentMode==='money'?n(f.paymentDiscount.value):0,paymentMetal=f.paymentMetal.value,paymentWeight=n(f.paymentWeight.value),paymentLess=n(f.paymentLess.value),paymentPurity=n(f.paymentPurity.value),paymentRate=n(f.paymentRate.value),pureWeight=paymentMode==='metal'?rbGrams((paymentWeight-paymentLess)*paymentPurity/100):paymentMode==='cutoff'&&paymentRate>0?rbGrams(paidAmount/paymentRate):0,allocation=paymentMode==='cutoff'?'metal':f.allocation.value,amountCredit=paymentMode==='money'?rbRound(paidAmount+discount):allocation==='amount'?rbRound(pureWeight*paymentRate):0;
    return Object.assign(base,{paymentMode,direction,collections,paidAmount,paymentDiscount:discount,paymentMetal,paymentWeight,paymentLess,paymentPurity,paymentRate,pureWeight,allocation,amountCredit,goldCredit:allocation==='metal'&&paymentMode!=='money'&&paymentMetal==='Gold'?pureWeight:0,silverCredit:allocation==='metal'&&paymentMode!=='money'&&paymentMetal==='Silver'?pureWeight:0});
  }

  const available=rpStockSources(id),sources=[...form.querySelectorAll('[data-rp-source]')].map(e=>{const stock=available.find(x=>x.id===e.dataset.rpSource),weight=n(e.value);return {sourceId:e.dataset.rpSource,weight,expectedPure:stock?.weight>0?stock.pure*weight/stock.weight:0,amount:stock?.weight>0?stock.amount*weight/stock.weight:0,metal:stock?.metal||''};}).filter(x=>x.weight),t=rpConversionCalc(sources,{stoneWeight:f.stoneWeight.value,meltedWeight:f.meltedWeight.value,outputWeight:f.outputWeight.value,outputPurity:f.outputPurity.value});
  return Object.assign(base,t,{sources,metal:sources[0]?.metal||'Gold',labourCharge:n(f.labourCharge.value),paidAmount:n(f.paidAmount.value)});
}

function rpDependencies(id){
  return rpDocs().some(x=>x.sourceId===id||(x.sources||[]).some(s=>s.sourceId===id))||rbCustomerSales().some(x=>(x.oldGoldItems||[]).some(p=>p.purchaseDocId===id));
}
function rpFinancialSignature(d){
  return JSON.stringify(['kind','supplierId','items','basis','discount','otherCharges','gstEnabled','gstRate','taxTreatment','roundMode','totalAmount','amountDebit','goldDebit','silverDebit','paidAmount','tdsTcsMode','tdsAmount','tcsAmount','paidCash','paidBank','paidCard','paidUpi','metalDelivered'].map(k=>d[k]));
}

function rpValidate(d){
  if(d.kind!=='conversion'&&!rpSupplier(d.supplierId))return 'Select or add a supplier / seller first.';
  if(d.supplierId&&!rpSupplier(d.supplierId))return 'Select a valid supplier.';
  if(!d.when||Number.isNaN(Date.parse(d.when)))return 'Enter the document date and time.';
  if(rpDocs(d.kind).some(x=>x.id!==d.id&&x.documentNo.toLowerCase()===d.documentNo.toLowerCase()))return 'This document number is already in use.';
  const old=rpDocs().find(x=>x.id===d.id);
  if(old&&rpDependencies(d.id)&&['purchase','old-purchase','bill-entry'].includes(d.kind)&&rpFinancialSignature(old)!==rpFinancialSignature(d))return 'This purchase is linked to a return, exchange or conversion. Its financial fields are locked; reference and notes can still be corrected.';
  if(['purchase','old-purchase','bill-entry'].includes(d.kind)){
    if(!d.items.length)return 'Add at least one purchase item.';
    for(let i=0;i<d.items.length;i++){
      const x=d.items[i];
      if(!x.product)return 'Enter the product in item '+(i+1)+'.';
      if(d.kind==='bill-entry'){
        if(x.quantity<=0||x.rate<0||x.discount<0||x.discount>x.base||x.gstRate<0||x.gstRate>100)return 'Check quantity, rate, discount and GST in item '+(i+1)+'.';
      }else if(x.grossWeight<=0||x.lessWeight<0||x.netWeight<=0||x.purity<1||x.purity>100||x.wastage<0||x.rate<=0||x.makingRate<0||x.otherAmount<0||!Number.isInteger(x.pieces)||x.pieces<1)return 'Check weight, touch purity, pieces and charges in item '+(i+1)+'.';
    }
    if(d.kind==='old-purchase'&&new Set(d.items.map(x=>x.metal)).size>1)return 'Record Gold and Silver old purchases separately so source weights stay distinct.';
    if(d.discount<0||d.discount>d.subtotal||d.otherCharges<0||d.gstEnabled&&(d.gstRate<=0||d.gstRate>100)||d.amountDebit<-.001||d.paidAmount<0||d.paidAmount>Math.max(0,d.amountDebit)+.001)return 'Check discount, charges, GST and amount paid. In metal settlement, discount applies to cash charges only.';
    return '';
  }
  if(['purchase-return','old-return'].includes(kind)){
    const limit=rpReturnLimit(d.sourceId,d.sourceItemId,d.id),quantity=d.returnQuantity||d.returnWeight;
    if(!limit||limit.source.supplierId!==d.supplierId||!['purchase','old-purchase','bill-entry'].includes(limit.source.kind))return 'Choose the selected supplier’s original purchase and item.';
    if(quantity<=0||quantity>limit.available+.0001||d.creditAmount<0||d.creditAmount>limit.availableAmount+.01||d.creditAmount>rbRound(limit.originalAmount*quantity/limit.originalQuantity)+.01||d.refundReceived<0)return 'Return quantity or credit exceeds the remaining original purchase.';
    if(d.kind==='old-return'){
      const stock=rpStockSources().find(x=>x.id===d.sourceId),available=n(stock?.available)+n(old?.returnWeight);
      if(d.returnWeight>available+.0001)return 'Some of this old jewellery has already been converted. Return only unconverted weight.';
    }
    if(d.refundReceived>d.creditAmount+.01)return 'Refund received cannot exceed this return’s rupee credit.';
    return '';
  }
  if(d.kind==='payment'){
    if(d.direction==='paid'&&rpDocs('old-purchase',d.supplierId).some(x=>rpOldApplied(x.id)>0)&&d.amountCredit>Math.max(0,rpSupplierBalance(d.supplierId,d.id).amount)+.01)return 'This payment exceeds supplier payable after existing old-gold exchange credits. Review the supplier ledger.';
    if(!['money','metal','cutoff'].includes(d.paymentMode)||!['paid','refund'].includes(d.direction))return 'Choose a valid payment type and direction.';
    if(d.collections.some(x=>x.amount<0||!RB_METHODS.includes(x.method)))return 'Check payment amounts and methods.';
    if(d.paymentMode==='money'){
      if(d.paidAmount+d.paymentDiscount<=0||d.paymentDiscount<0)return 'Enter a payment or negotiated discount.';
      const balance=rpSupplierBalance(d.supplierId,d.id);
      if(d.paymentDiscount>Math.max(0,balance.amount)+.001)return 'The negotiated discount exceeds the supplier’s amount payable.';
    }else if(d.paymentMode==='metal'){
      if(d.paymentWeight<=0||d.paymentLess<0||d.paymentWeight-d.paymentLess<=0||d.paymentPurity<1||d.paymentPurity>100||d.allocation==='amount'&&d.paymentRate<=0)return 'Check metal weight, testing purity and agreed rate.';
    }else if(d.paidAmount<=0||d.paymentRate<=0)return 'Enter the cash payment and agreed pure-metal rate for cutoff.';
    return '';
  }
  const available=rpStockSources(d.id);
  if(!d.sources.length)return 'Select old metal source weight for this conversion.';
  if(new Set(d.sources.map(x=>x.metal)).size!==1)return 'Convert Gold and Silver in separate batches.';
  for(const x of d.sources){
    const stock=available.find(s=>s.id===x.sourceId);
    if(!stock||x.weight<=0||x.weight>stock.available+.0001)return 'A selected source weight is no longer available. Reopen this conversion.';
  }
  if(d.stoneWeight<0||d.net<=0||d.meltedWeight<=0||d.meltedWeight>d.net+.0001||d.outputWeight<=0||d.outputWeight>d.meltedWeight+.0001||d.outputPurity<1||d.outputPurity>100||d.labourCharge<0||d.paidAmount<0||d.paidAmount>d.labourCharge+.001)return 'Check source, stone, melted/output weights, testing purity and refining charges.';
  return '';
}

window.rpRecalc=function(form){
  if(!form)return;
  const d=rpReadDocument(form),kind=d.kind,computed=form.querySelector('#rpComputed'),row=(label,value)=>'<div class="rb-total-row"><span>'+label+'</span><b>'+value+'</b></div>';
  let html='',balance='';

  form.querySelectorAll('[data-rp-payment]').forEach(e=>{
    const visible=e.dataset.rpPayment.split(',').includes(form.elements.paymentMode?.value);
    (e.matches('input')?e.closest('label'):e).classList.toggle('hidden',!visible);
  });

  if(['purchase','old-purchase','bill-entry'].includes(kind)){
    form.querySelectorAll('.rp-item').forEach((node,i)=>{
      for(const key of ['netWeight','pureWeight','payablePure','subtotal']){
        const e=node.querySelector('[data-rp-out="'+key+'"]');
        if(e)e.textContent=key==='subtotal'?rateMoney(d.items[i][key]):fmt(d.items[i][key]);
      }
    });
    const out=form.querySelector('#rpItemsValue');
    if(out)out.textContent=rateMoney(d.subtotal);

    html=row('Net jewellery weight',fmt(d.netWeight)+' g')
      +row('Gold payable pure',fmt(d.goldPure)+' g')
      +row('Silver payable pure',fmt(d.silverPure)+' g')
      +row('Before bill discount',rateMoney(d.subtotal))
      +row('Discount',rateMoney(d.discount))
      +row('Other charges',rateMoney(d.otherCharges))
      +row('GST',rateMoney(d.gstAmount));
    if(d.tdsAmount>0) html+=row('TDS u/s 194Q (0.1% Deduction)','− '+rateMoney(d.tdsAmount));
    if(d.tcsAmount>0) html+=row('TCS u/s 206C(1H) (0.1% Addition)','+ '+rateMoney(d.tcsAmount));
    html+=row('Round off',rateMoney(d.roundOff))
      +row('Document value',rateMoney(d.totalAmount))
      +row('Amount due',rateMoney(d.amountDebit))
      +row('Paid now',rateMoney(d.paidAmount));
    if(d.metalDelivered>0) html+=row('Pure metal delivered',fmt(d.metalDelivered)+' g '+d.metalDeliveredMetal);
    balance=rateMoney(d.balance)+(d.basis==='metal'?' + '+fmt(d.goldDebit)+' g Gold / '+fmt(d.silverDebit)+' g Silver':'');
  } else if(['purchase-return','old-return'].includes(kind)){
    const limit=rpReturnLimit(d.sourceId,d.sourceItemId,d.id),note=form.querySelector('#rpReturnLimit');
    if(note)note.textContent=limit?'Available '+fmt(limit.available)+(limit.byQty?' '+(limit.item.uom||'units'):' net g')+' · Remaining credit '+rateMoney(limit.availableAmount):'Select the original purchase and item.';
    html=row('Return credit',rateMoney(d.creditAmount))+row('Gold credit',fmt(d.goldCredit)+' g')+row('Silver credit',fmt(d.silverCredit)+' g')+row('Refund received',rateMoney(d.refundReceived));
    balance=rateMoney(d.creditAmount-d.refundReceived);
  } else if(kind==='payment'){
    html=row('Cash / bank paid',rateMoney(d.paidAmount))+row('Negotiated discount',rateMoney(d.paymentDiscount))+row('Amount balance credit',rateMoney(d.amountCredit))+row('Gold balance credit',fmt(d.goldCredit)+' g')+row('Silver balance credit',fmt(d.silverCredit)+' g');
    balance=d.paymentMode==='money'?rateMoney(d.amountCredit):fmt(d.pureWeight)+' pure g';
  } else {
    html=row('Old metal used',fmt(d.weight)+' g')+row('Stone / impurity',fmt(d.stoneWeight)+' g')+row('Melted weight',fmt(d.meltedWeight)+' g')+row('Melting loss',fmt(d.meltingLoss)+' g')+row('Expected tested pure',fmt(d.expectedPure)+' g')+row('Pure recovered',fmt(d.pureReceived)+' g')+row('Pure variance ±',fmt(d.pureVariance)+' g')+row('Refining charge',rateMoney(d.labourCharge));
    balance=fmt(d.pureReceived)+' pure g';
  }

  computed.innerHTML=html;
  form.querySelector('#rpBalanceLabel').textContent=kind==='conversion'?'Recovered pure metal':kind==='payment'?'Settlement recorded':kind.includes('return')?'Return credit remaining':'Document balance';
  form.querySelector('#rpBalanceValue').textContent=balance;

  // Update Supplier Dual Balance Tracker
  const b=rpSupplierBalance(d.supplierId,d.id);
  const dualCash=form.querySelector('#rpDualCash');
  const dualCashBadge=form.querySelector('#rpDualCashBadge');
  const dualGold=form.querySelector('#rpDualGold');
  const dualGoldBadge=form.querySelector('#rpDualGoldBadge');
  const dualSilver=form.querySelector('#rpDualSilver');
  const dualSilverBadge=form.querySelector('#rpDualSilverBadge');

  if(dualCash&&dualCashBadge){
    dualCash.textContent=rateMoney(Math.abs(b.amount));
    if(b.amount>0.01){
      dualCashBadge.textContent='Payable to Supplier';
      dualCashBadge.className='rp-card-badge is-payable';
    }else if(b.amount<-0.01){
      dualCashBadge.textContent='Supplier Credit (Advance)';
      dualCashBadge.className='rp-card-badge is-credit';
    }else{
      dualCashBadge.textContent='Clear / Settled';
      dualCashBadge.className='rp-card-badge is-clear';
    }
  }
  if(dualGold&&dualGoldBadge){
    dualGold.textContent=fmt(Math.abs(b.gold))+' g';
    if(b.gold>0.0001){
      dualGoldBadge.textContent='Payable '+fmt(b.gold)+' g';
      dualGoldBadge.className='rp-card-badge is-payable';
    }else if(b.gold<-0.0001){
      dualGoldBadge.textContent='Pure Credit '+fmt(Math.abs(b.gold))+' g';
      dualGoldBadge.className='rp-card-badge is-credit';
    }else{
      dualGoldBadge.textContent='Vault 0.000 g';
      dualGoldBadge.className='rp-card-badge is-clear';
    }
  }
  if(dualSilver&&dualSilverBadge){
    dualSilver.textContent=fmt(Math.abs(b.silver))+' g';
    if(b.silver>0.0001){
      dualSilverBadge.textContent='Payable '+fmt(b.silver)+' g';
      dualSilverBadge.className='rp-card-badge is-payable';
    }else if(b.silver<-0.0001){
      dualSilverBadge.textContent='Pure Credit '+fmt(Math.abs(b.silver))+' g';
      dualSilverBadge.className='rp-card-badge is-credit';
    }else{
      dualSilverBadge.textContent='Vault 0.000 g';
      dualSilverBadge.className='rp-card-badge is-clear';
    }
  }
};

window.rpSupplierChanged=function(form){
  if(form.elements.sourceId){
    form.elements.sourceId.innerHTML=rpSourcesOptions(form.dataset.kind,'',form.elements.supplierId.value);
    rpReturnItems(form);
  }
  rpRecalc(form);
};
window.rpReturnItems=function(form){
  const source=rpDocs().find(x=>x.id===form.elements.sourceId.value);
  form.elements.sourceItemId.innerHTML=source?(source.items||[]).map(x=>'<option value="'+x.id+'">'+esc(x.product)+'</option>').join(''):'<option value="">Select an original purchase</option>';
  form.elements.returnQuantity.value='';
  form.elements.creditAmount.value='';
  rpRecalc(form);
};
window.rpReturnCalc=function(form,fill=false){
  const limit=rpReturnLimit(form.elements.sourceId.value,form.elements.sourceItemId.value,form.elements.id.value);
  if(limit&&fill)form.elements.creditAmount.value=Math.min(limit.availableAmount,rbRound(limit.originalAmount*n(form.elements.returnQuantity.value)/limit.originalQuantity)).toFixed(2);
  rpRecalc(form);
};
window.rpSaveDocument=function(event){
  event.preventDefault();
  const form=event.target;
  if(!form.reportValidity())return;
  const d=rpReadDocument(form),error=rpValidate(d);
  if(error)return say(error);
  if(form.elements.id.value&&!confirm('Save changes to this '+rpSection+' entry?'))return;
  const index=db.retailDocuments.findIndex(x=>x.id===d.id);
  if(index<0)db.retailDocuments.push(d);
  else db.retailDocuments[index]=d;
  rpEdit='';save();render();say(rpSection+' saved to the shop ledger.');
};

window.rpSuppliers=function(id=''){
  let old=document.getElementById('rpSupplierPanel');
  if(old)old.remove();
  const x=rpSupplier(id)||{},fields=rbInput('Supplier / seller name *','name',x.name||'','text','required maxlength="160"')+rbInput('City','city',x.city||'')+rbInput('Phone','phone',x.phone||'','tel')+rbInput('Email','email',x.email||'','email')+rbInput('GSTIN · optional','gst',x.gst||'','text','maxlength="15"')+rbInput('Address','address',x.address||'')+rbInput('Opening amount payable · ₹','openingAmount',x.openingAmount||0,'number','step=".01"')+rbInput('Opening Gold payable · pure g','openingGold',x.openingGold||0,'number','step=".001"')+rbInput('Opening Silver payable · pure g','openingSilver',x.openingSilver||0,'number','step=".001"')+'<label class="rb-field"><span>Linked Retail customer · optional</span><select name="customerId">'+rbCustomerOptions(x.customerId,'Supplier only · no customer link')+'</select></label>',list=db.retailSuppliers.map(s=>'<button type="button" onclick="rpSuppliers(\''+s.id+'\')">'+esc(s.name)+'</button>').join('');
  document.body.insertAdjacentHTML('beforeend',rbModal('rpSupplierPanel',x.id?'Edit supplier / seller':'Supplier register','<form id="rpSupplierForm" onsubmit="rpSaveSupplier(event)"><input type="hidden" name="id" value="'+esc(x.id||'')+'"><div class="rb-record-grid">'+fields+'</div><div class="right"><button class="primary">Save supplier</button></div></form><p class="hint">Positive opening balances are payable to the supplier. Negative balances are supplier credit. A linked customer allows an unpaid old purchase to be applied as a sales exchange.</p><div class="row">'+list+'</div>'));
  rbDialog('rpSupplierPanel');
};
window.rpSaveSupplier=function(event){
  event.preventDefault();
  const form=event.target,f=new FormData(form),id=String(f.get('id')||''),name=String(f.get('name')||'').trim(),gst=String(f.get('gst')||'').trim().toUpperCase(),customerId=String(f.get('customerId')||'');
  if(!name)return say('Enter the supplier / seller name.');
  if(gst&&!/^[A-Z0-9]{15}$/.test(gst))return say('Enter a 15-character GSTIN, or leave it blank.');
  if(customerId&&!account(customerId,'customer'))return say('Select an existing Retail customer.');
  if(db.retailSuppliers.some(x=>x.id!==id&&x.name.trim().toLowerCase()===name.toLowerCase()))return say('This supplier name already exists. Edit that profile instead.');
  if(id&&!confirm('Save changes to this supplier profile and opening balances?'))return;
  const now=new Date().toISOString(),old=rpSupplier(id),row=Object.assign({},old||{},{id:id||crypto.randomUUID(),name,city:String(f.get('city')||'').trim(),phone:String(f.get('phone')||'').trim(),email:String(f.get('email')||'').trim(),gst,address:String(f.get('address')||'').trim(),openingAmount:n(f.get('openingAmount')),openingGold:n(f.get('openingGold')),openingSilver:n(f.get('openingSilver')),customerId,createdAt:old?.createdAt||now,updatedAt:now}),index=db.retailSuppliers.findIndex(x=>x.id===row.id);
  if(index<0)db.retailSuppliers.push(row);
  else db.retailSuppliers[index]=row;
  document.querySelectorAll('.rp-supplier-select').forEach(select=>{
    const selected=select.value;
    select.innerHTML=rpSupplierOptions(selected||row.id);
  });
  const doc=document.getElementById('rpDocumentForm');
  if(doc)rbMarkDirty(doc);
  document.getElementById('rpSupplierPanel')?.remove();
  save();if(doc)rpRecalc(doc);
  say('Supplier profile saved.');
};

function rpDelta(d){
  if(['purchase','old-purchase','bill-entry'].includes(d.kind))return {amount:n(d.amountDebit)-n(d.paidAmount),gold:n(d.goldDebit),silver:n(d.silverDebit)};
  if(['purchase-return','old-return'].includes(d.kind))return {amount:-n(d.creditAmount)+n(d.refundReceived),gold:-n(d.goldCredit),silver:-n(d.silverCredit)};
  if(d.kind==='payment'){
    const sign=d.direction==='refund'?1:-1;
    return {amount:sign*n(d.amountCredit),gold:sign*n(d.goldCredit),silver:sign*n(d.silverCredit)};
  }
  return {amount:n(d.labourCharge)-n(d.paidAmount),gold:0,silver:0};
}

function rpLedgerModel(id){
  const supplier=rpSupplier(id);
  if(!supplier)return null;
  const events=rpDocs('',id).map(d=>({id:d.id,when:d.when,createdAt:d.createdAt,kind:RP_SECTIONS[RP_KINDS.indexOf(d.kind)],ref:d.documentNo,details:d.reference||d.product||(d.items||[]).map(x=>x.product).join(' + '),...rpDelta(d)}));
  for(const sale of rbCustomerSales()){
    const amount=(sale.oldGoldItems||[]).filter(x=>rpDocs('old-purchase',id).some(d=>d.id===x.purchaseDocId)).reduce((s,x)=>s+n(x.amount),0);
    if(amount)events.push({id:sale.id,when:sale.when,createdAt:sale.createdAt,kind:'Sales exchange settlement',ref:sale.documentNo||sale.id.slice(0,8),details:accountName(sale.partyId,'customer'),amount:-amount,gold:0,silver:0});
  }
  events.sort((a,b)=>whenStr(a).localeCompare(whenStr(b))||(a.createdAt||'').localeCompare(b.createdAt||'')||String(a.id||'').localeCompare(String(b.id||'')));
  let amount=n(supplier.openingAmount),gold=n(supplier.openingGold),silver=n(supplier.openingSilver);
  const rows=events.map(x=>{
    amount=rbRound(amount+x.amount);
    gold=rbGrams(gold+x.gold);
    silver=rbGrams(silver+x.silver);
    return [whenShow(x),x.kind,x.ref,x.details,rateMoney(x.amount),fmt(x.gold),fmt(x.silver),rateMoney(amount),fmt(gold),fmt(silver)];
  });
  return {
    kind:'ledger',retail:true,title:'RETAIL SUPPLIER LEDGER',entityLabel:'Supplier / seller',entityName:supplier.name,
    entityDetails:[supplier.address,supplier.city,supplier.phone,supplier.gst?'GSTIN '+supplier.gst:''].filter(Boolean).join(' · '),
    reference:'All dates',date:'',
    heads:['Date','Entry','Reference','Details','Amount ±₹','Gold ±g','Silver ±g','Amount balance ₹','Gold balance g','Silver balance g'],
    rows,
    totals:[
      ['Opening amount',rateMoney(supplier.openingAmount)],
      ['Opening Gold',fmt(supplier.openingGold)+' g'],
      ['Opening Silver',fmt(supplier.openingSilver)+' g'],
      [amount<0?'Closing supplier amount credit':'Closing amount payable',rateMoney(Math.abs(amount)),true],
      [gold<0?'Closing Gold credit':'Closing Gold payable',fmt(Math.abs(gold))+' g',true],
      [silver<0?'Closing Silver credit':'Closing Silver payable',fmt(Math.abs(silver))+' g',true]
    ]
  };
}

function rpLedgerContent(id){
  const m=rpLedgerModel(id);
  if(!m)return '<p class="hint">Select a supplier to see the transaction report.</p>';
  const b=rpSupplierBalance(id);
  return '<div class="rp-metrics"><span>Amount balance<b>'+rateMoney(b.amount)+'</b></span><span>Gold balance<b>'+fmt(b.gold)+' g</b></span><span>Silver balance<b>'+fmt(b.silver)+' g</b></span></div>'
    +table(m.heads,m.rows.map(row=>row.map(esc)))
    +'<div class="right"><button type="button" onclick="rpPrintLedger(\''+id+'\')">View PDF</button><button type="button" onclick="rpShareLedger(\''+id+'\')">Share report</button></div>';
}

window.rpLedger=function(){
  document.getElementById('rpLedgerPanel')?.remove();
  const id=document.getElementById('rpDocumentForm')?.elements.supplierId.value||rpSupplierFilter;
  document.body.insertAdjacentHTML('beforeend',rbModal('rpLedgerPanel','Supplier ledger','<label class="rb-field"><span>Supplier / seller</span><select onchange="rpSupplierFilter=this.value;document.getElementById(\'rpLedgerContent\').innerHTML=rpLedgerContent(this.value)">'+rpSupplierOptions(id)+'</select></label><div id="rpLedgerContent">'+rpLedgerContent(id)+'</div>'));
  rbDialog('rpLedgerPanel');
};
window.rpPrintLedger=function(id){
  const model=rpLedgerModel(id);
  if(model)pdfPrintModel(model,'retail');
};
window.rpShareLedger=async function(id){
  const model=rpLedgerModel(id);
  if(!model)return;
  const text=model.title+' · '+model.entityName+'\n'+model.heads.join(' | ')+'\n'+model.rows.map(x=>x.join(' | ')).join('\n')+'\n'+model.totals.map(x=>x[0]+': '+x[1]).join('\n');
  try{
    if(navigator.share)await navigator.share({title:model.title,text});
    else{await navigator.clipboard.writeText(text);say('Supplier report copied.');}
  }catch(error){if(error.name!=='AbortError')say('Sharing was unavailable. Use View PDF to save this report.');}
};

function rpDocumentModel(d){
  const supplier=rpSupplier(d.supplierId)||{},kind=d.kind,c=pdfConfig('retail');
  let heads=[],rows=[],totals=[];
  const b=rpSupplierBalance(d.supplierId, d.id);

  if(['purchase','old-purchase','bill-entry'].includes(kind)){
    if(kind==='bill-entry'){
      heads=['Item','HSN','Qty','UOM','Rate ₹','Discount ₹','GST %','Base amount ₹'];
      rows=d.items.map(x=>[x.product,x.hsn||'—',x.quantity,x.uom,rateMoney(x.rate),rateMoney(x.discount),x.gstRate,rateMoney(x.subtotal)]);
    } else if(kind==='old-purchase'){
      heads=['Scrap Description','Metal','Gross g','Less g','Net g','Melt Loss %','Touch %','Pure g','Rate / pure g ₹','Testing / Other ₹','Line amount ₹'];
      rows=d.items.map(x=>[x.product,x.metal,fmt(x.grossWeight),fmt(x.lessWeight),fmt(x.netWeight),n(x.meltingLossPercent)+'%',n(x.purity)+'%',fmt(x.pureWeight),rateMoney(x.rate),rateMoney(x.otherAmount),rateMoney(x.subtotal)]);
    } else {
      heads=['Product / HUID','Metal','Pcs','Gross g','Less g','Net g','Touch %','Pure g','Wst %','Payable pure g','Pure rate / g ₹','Making ₹','Stone ₹','Line total ₹'];
      rows=d.items.map(x=>[
        [x.product, x.huid].filter(Boolean).join(' · HUID: '),
        x.metal,
        x.pieces,
        fmt(x.grossWeight),
        fmt(x.lessWeight),
        fmt(x.netWeight),
        n(x.purity)+'%',
        fmt(x.pureWeight),
        n(x.wastage)+'%',
        fmt(x.payablePure),
        rateMoney(x.rate),
        rateMoney(x.makingTotal),
        rateMoney(x.stoneAmount),
        rateMoney(x.subtotal)
      ]);
    }

    totals=[
      ['Prior supplier balance', rateMoney(b.amount) + ' · Gold ' + fmt(b.gold) + 'g / Silver ' + fmt(b.silver) + 'g'],
      ['Items subtotal', rateMoney(d.subtotal)],
      ['Bill discount', '− ' + rateMoney(d.discount)],
      ['Other / handling charges', rateMoney(d.otherCharges)],
      ['GST recorded', rateMoney(d.gstAmount)],
    ];
    if(d.tdsAmount > 0) totals.push(['TDS u/s 194Q (0.1% Deduction)', '− ' + rateMoney(d.tdsAmount)]);
    if(d.tcsAmount > 0) totals.push(['TCS u/s 206C(1H) (0.1% Addition)', '+ ' + rateMoney(d.tcsAmount)]);
    totals.push(
      ['Round off', rateMoney(d.roundOff)],
      ['Document value', rateMoney(d.totalAmount)],
      ['Settlement basis', d.basis==='metal'?'Metal grams + cash charges':'Rupee amount'],
      ['Gold payable pure', fmt(d.goldDebit)+' g'],
      ['Silver payable pure', fmt(d.silverDebit)+' g'],
      ['Amount payable', rateMoney(d.amountDebit)]
    );

    if(d.paidCash > 0) totals.push(['Paid via Cash', rateMoney(d.paidCash)]);
    if(d.paidBank > 0) totals.push(['Paid via Bank / NEFT' + (d.paidBankRef ? ' ('+d.paidBankRef+')' : ''), rateMoney(d.paidBank)]);
    if(d.paidCard > 0) totals.push(['Paid via Card / POS', rateMoney(d.paidCard)]);
    if(d.paidUpi > 0) totals.push(['Paid via UPI' + (d.paidUpiRef ? ' ('+d.paidUpiRef+')' : ''), rateMoney(d.paidUpi)]);
    if(d.metalDelivered > 0) totals.push(['Pure bullion delivered', fmt(d.metalDelivered) + ' g ' + d.metalDeliveredMetal]);

    totals.push(
      ['Total rupee paid', rateMoney(d.paidAmount)],
      ['Document amount balance', rateMoney(n(d.amountDebit)-n(d.paidAmount)), true]
    );
  } else if(['purchase-return','old-return'].includes(kind)){
    heads=['Original purchase','Product','Quantity','Net weight g','Return credit ₹','Gold credit g','Silver credit g','Refund received ₹'];
    const source=rpDocs().find(x=>x.id===d.sourceId);
    rows=[[source?.documentNo||d.sourceId,d.product,d.returnQuantity||'—',fmt(d.returnWeight),rateMoney(d.creditAmount),fmt(d.goldCredit),fmt(d.silverCredit),rateMoney(d.refundReceived)]];
    totals=[['Reason',d.reason||'—'],['Unsettled rupee return credit',rateMoney(n(d.creditAmount)-n(d.refundReceived)),true]];
  } else if(kind==='payment'){
    heads=['Entry type','Direction','Method','Reference','Cash / bank ₹','Amount balance credit ₹','Gold credit g','Silver credit g'];
    rows=(d.collections?.length?d.collections:[{method:'Metal',amount:0,reference:d.reference}]).map((x,i)=>[d.paymentMode,d.direction,x.method,x.reference||'—',rateMoney(x.amount),i===0?rateMoney(d.amountCredit):'—',i===0?fmt(d.goldCredit):'—',i===0?fmt(d.silverCredit):'—']);
    totals=[['Negotiated discount',rateMoney(d.paymentDiscount)],['Metal testing purity',d.paymentMode==='metal'?d.paymentPurity+'%':'—'],['Agreed pure rate',rateMoney(d.paymentRate)],['Pure settlement weight',fmt(d.pureWeight)+' g',true]];
  } else {
    heads=['Source','Metal','Net weight used g','Expected tested pure g'];
    rows=d.sources.map(x=>[rpStockSources(d.id).find(s=>s.id===x.sourceId)?.label||x.sourceId,x.metal,fmt(x.weight),fmt(x.expectedPure)]);
    totals=[['Input net weight',fmt(d.weight)+' g'],['Stone / impurities',fmt(d.stoneWeight)+' g'],['Melted weight',fmt(d.meltedWeight)+' g'],['Melting loss',fmt(d.meltingLoss)+' g'],['Output bar',fmt(d.outputWeight)+' g @ '+d.outputPurity+'%'],['Pure recovered',fmt(d.pureReceived)+' g',true],['Pure recovery variance ±',fmt(d.pureVariance)+' g'],['Refining / labour charge',rateMoney(d.labourCharge)],['Charge paid',rateMoney(d.paidAmount)],['Refining amount balance',rateMoney(n(d.labourCharge)-n(d.paidAmount)),true]];
  }

  return {
    kind: 'purchase',
    retail: true,
    title: RP_SECTIONS[RP_KINDS.indexOf(kind)].toUpperCase() + ' VOUCHER',
    entityLabel: 'Supplier / Seller',
    entityName: supplier.name || 'Shop conversion',
    entityDetails: [supplier.address, supplier.city, supplier.phone, supplier.gst?'GSTIN: '+supplier.gst:''].filter(Boolean).join(' · '),
    reference: d.documentNo + (d.reference ? ' · Ref: ' + d.reference : ''),
    date: pdfDateText(d.when),
    invoiceItems: d.items,
    heads,
    rows,
    totals: [...totals, ...(d.notes?[['Notes',d.notes]]:[])]
  };
}

window.rpPrintDocument=function(id,forcedTemplate=null){
  const d=rpDocs().find(x=>x.id===id);
  if(d)pdfPrintModel(rpDocumentModel(d),'retail',forcedTemplate);
};
window.rpPrintCurrent=function(forcedTemplate=null){
  const form=document.getElementById('rpDocumentForm');
  if(!form.reportValidity())return;
  const d=rpReadDocument(form),error=rpValidate(d);
  if(error)return say(error);
  const model=rpDocumentModel(d);
  if(!form.elements.id.value)model.reference='DRAFT · '+model.reference;
  pdfPrintModel(model,'retail',forcedTemplate);
};

window.rpHistory=function(){
  document.getElementById('rpHistoryPanel')?.remove();
  const kind=RP_KINDS[RP_SECTIONS.indexOf(rpSection)];
  const rows=rpDocs(kind).sort(whenCmp).map(d=>[
    d.documentNo,
    whenShow(d),
    esc(rpSupplier(d.supplierId)?.name||'Shop conversion'),
    esc(d.reference||d.product||(d.items||[]).map(x=>x.product).join(' + ')),
    d.kind==='conversion'?fmt(d.pureReceived)+' pure g':rateMoney(d.totalAmount??d.creditAmount??d.amountCredit),
    '<div class="rb-history-actions">'
    +'<button type="button" onclick="rbDialog(\'rpHistoryPanel\',false);rpEditDocument(\''+d.id+'\')">Edit</button> '
    +'<button type="button" onclick="rpPrintDocument(\''+d.id+'\')">PDF</button> '
    +'<button type="button" onclick="rpPrintDocument(\''+d.id+'\',\'thermal-80\')">POS</button>'
    +'</div>'
  ]);
  document.body.insertAdjacentHTML('beforeend',rbModal('rpHistoryPanel',rpSection+' history',rows.length?table(['Entry','Date','Supplier / seller','Reference / product','Value','Actions'],rows):'<div class="empty">No saved entries in this section yet.</div>'));
  rbDialog('rpHistoryPanel');
};

function rpOldAccountAvailable(supplierId,exclude=''){
  const own=rbCustomerSales().find(s=>s.id===exclude),restored=(own?.oldGoldItems||[]).filter(x=>rpDocs('old-purchase').some(d=>d.id===x.purchaseDocId&&d.supplierId===supplierId)).reduce((v,x)=>v+n(x.amount),0);
  return Math.max(0,rbRound(rpSupplierBalance(supplierId).amount+restored));
}
function rpOldAvailable(doc,exclude=''){
  const returned=rpDocs('old-return').filter(x=>x.sourceId===doc.id),applied=rbCustomerSales().filter(x=>x.id!==exclude).flatMap(s=>s.oldGoldItems||[]).filter(x=>x.purchaseDocId===doc.id),amount=rbRound(n(doc.amountDebit)-n(doc.paidAmount)-returned.reduce((s,x)=>s+n(x.creditAmount),0)-applied.reduce((s,x)=>s+n(x.amount),0)),weight=rbGrams(n(doc.netWeight)-returned.reduce((s,x)=>s+n(x.returnWeight),0)-applied.reduce((s,x)=>s+n(x.weight),0));
  return {amount:Math.max(0,Math.min(amount,rpOldAccountAvailable(doc.supplierId,exclude))),weight};
}

window.rpChooseOldPurchase=function(){
  const form=document.getElementById('customerSaleForm'),customer=form?.elements.partyId.value;
  if(!customer)return say('Select the billing customer first.');
  document.getElementById('rpOldChooser')?.remove();
  const docs=rpDocs('old-purchase').filter(x=>x.basis==='amount'&&x.metal==='Gold'&&rpSupplier(x.supplierId)?.customerId===customer&&rpOldAvailable(x,form.elements.id.value).amount>0);
  document.body.insertAdjacentHTML('beforeend',rbModal('rpOldChooser','Apply an existing old-gold purchase','<p class="hint">Only this customer’s linked, unpaid Gold purchases are listed. Amounts already paid, returned or applied are excluded.</p>'+(docs.length?table(['Purchase','Date','Unpaid credit','Net weight',''],docs.map(d=>{const a=rpOldAvailable(d,form.elements.id.value);return [d.documentNo,whenShow(d),rateMoney(a.amount),fmt(a.weight)+' g','<button type="button" onclick="rpApplyOldPurchase(\''+d.id+'\')">Apply to bill</button>'];})):'<div class="empty">No eligible old purchases. Link the seller’s supplier profile to this Retail customer when recording Old Jewel Purchase.</div>')));
  rbDialog('rpOldChooser');
};
window.rpApplyOldPurchase=function(id){
  const form=document.getElementById('customerSaleForm'),d=rpDocs('old-purchase').find(x=>x.id===id);
  if(!form||!d)return;
  if([...form.querySelectorAll('[data-purchase-doc-id]')].some(x=>x.dataset.purchaseDocId===id))return say('This old purchase is already on the bill. Edit its applied weight instead.');
  const a=rpOldAvailable(d,form.elements.id.value),pure=(d.items||[]).reduce((s,x)=>s+n(x.pureWeight),0),touch=n(d.netWeight)>0?pure/n(d.netWeight)*100:100,rate=a.weight*touch>0?a.amount/(a.weight*touch/100):0;
  if(a.weight<=0||rate<=0)return say('No remaining unpaid old-gold credit.');
  const list=form.querySelector('#oldGoldLines');
  for(const row of list.querySelectorAll('.exchange-line')){if(!row.dataset.purchaseDocId&&![...row.querySelectorAll('input')].some(e=>e.value))row.remove();}
  list.insertAdjacentHTML('beforeend',exchangeLineMarkup({product:d.items.map(x=>x.product).join(' + '),purity:touch.toFixed(3)+'%',weight:a.weight,testingPurity:touch,rate},list.children.length));
  const row=list.lastElementChild;
  row.dataset.purchaseDocId=id;
  rpLockOldLine(row,d);
  rbMarkDirty(form);
  rbRecalc(form);
  rbDialog('rpOldChooser',false);
};

function rpLockOldLine(row,doc){
  for(const input of row.querySelectorAll('input'))if(input.name!=='exchangeWeight')input.readOnly=true;
  let note=row.querySelector('.rp-old-source');
  if(!note){note=document.createElement('p');note.className='hint rp-old-source';row.append(note);}
  note.textContent='Existing old purchase '+doc.documentNo+' · change only the weight to apply a partial credit.';
}

const rpPreviousExchangeRows=window.exchangeRows;
window.exchangeRows=function(form){
  const rows=rpPreviousExchangeRows(form),nodes=form.querySelectorAll('.exchange-line');
  return rows.map((x,i)=>Object.assign(x,nodes[i]?.dataset.purchaseDocId?{purchaseDocId:nodes[i].dataset.purchaseDocId}:{}));
};

const rpPreviousBillValidation=window.rbValidateBill;
window.rbValidateBill=function(form,totals,forSave=true){
  const error=rpPreviousBillValidation(form,totals,forSave);
  if(error)return error;
  const groups=new Map();
  for(const x of totals.exchange.filter(x=>x.purchaseDocId)){
    const old=groups.get(x.purchaseDocId)||{amount:0,weight:0};
    old.amount+=x.amount;old.weight+=x.weight;
    groups.set(x.purchaseDocId,old);
  }
  for(const [id,use] of groups){
    const doc=rpDocs('old-purchase').find(x=>x.id===id),a=doc?rpOldAvailable(doc,form.elements.id.value):null;
    if(!doc||doc.basis!=='amount'||doc.metal!=='Gold'||rpSupplier(doc.supplierId)?.customerId!==form.elements.partyId.value||use.amount>a.amount+.01||use.weight>a.weight+.0001)return 'An existing old purchase is paid, returned, already applied, or belongs to another customer. Reopen Add existing purchase.';
  }
  const supplierUse=new Map();
  for(const [id,use] of groups){
    const supplierId=rpDocs('old-purchase').find(x=>x.id===id)?.supplierId;
    supplierUse.set(supplierId,(supplierUse.get(supplierId)||0)+use.amount);
  }
  for(const [supplierId,amount] of supplierUse)if(amount>rpOldAccountAvailable(supplierId,form.elements.id.value)+.01)return 'Existing old purchase credit exceeds the supplier account balance after payments. Review the supplier ledger.';
  return '';
};

const rpPreviousRender=window.render;
window.render=function(){
  rpEnsure();
  const result=rpPreviousRender(),allowed=!!(session&&goldleafContext?.has_access&&goldleafContext.retail_enabled&&!erpIsAdmin()&&workspaceMode==='retail');
  if(allowed&&page==='Purchase'){
    document.getElementById('app').innerHTML=rpFormView();
    document.body.classList.add('rb-active');
    document.body.dataset.erpPage='Purchase';
  }
  document.body.classList.toggle('rp-active',allowed&&page==='Purchase');
  if(allowed){
    const nav=document.getElementById('nav'),sales=nav.querySelector('button[aria-label="Customer Sales Entry"]');
    if(sales){
      sales.setAttribute('aria-label','Sales');
      sales.innerHTML='<span class="nav-icon">'+erpIcon('sale')+'</span><span>Sales</span>';
      const button=document.createElement('button');
      button.type='button';
      button.setAttribute('aria-label','Purchase');
      button.classList.toggle('active',page==='Purchase');
      button.setAttribute('onclick','rpOpen()');
      button.innerHTML='<span class="nav-icon">'+erpIcon('payment')+'</span><span>Purchase</span>';
      sales.after(button);
    }
    nav.querySelector('#moreMenu')?.insertAdjacentHTML('beforeend','<button type="button" onclick="rbOpen(\'Receipt\')">Customer receipts</button><button type="button" onclick="rpOpen()">Purchase</button>');
    erpBuildShell();
    nav.querySelector('button[aria-label="Purchase"] .nav-icon')?.replaceChildren();
    const icon=nav.querySelector('button[aria-label="Purchase"] .nav-icon');
    if(icon)icon.innerHTML=erpIcon('payment');
    for(const button of document.querySelectorAll('#nav>button:not(.more-button),.erp-shortcuts button,.erp-page-tab,.erp-rate-chip')){
      const action=button.getAttribute('onclick')||'';
      if(action&&!/rbCanLeave|rpOpen|platformSignOut/.test(action))button.setAttribute('onclick','if(rbCanLeave()){'+action+'}');
    }
  }
  const saleForm=document.querySelector('#customerSaleForm[data-retail-bill]');
  if(saleForm){
    const old=rbCustomerSales().find(x=>x.id===saleForm.elements.id.value);
    saleForm.querySelectorAll('.exchange-line').forEach((row,i)=>{
      const id=old?.oldGoldItems?.[i]?.purchaseDocId,doc=rpDocs('old-purchase').find(x=>x.id===id);
      if(doc){row.dataset.purchaseDocId=id;rpLockOldLine(row,doc);}
    });
    const scroll=saleForm.querySelector('#oldGoldPanel .retail-modal-scroll');
    if(scroll&&!scroll.querySelector('.rp-existing-button'))scroll.insertAdjacentHTML('afterbegin','<button type="button" class="rp-existing-button" onclick="rpChooseOldPurchase()">＋ Add existing purchase</button>');
    rbRecalc(saleForm);
  }
  const form=document.getElementById('rpDocumentForm');
  if(form)rpRecalc(form);
  return result;
};
render();

const rpPreviousGo=window.go;
window.go=function(target){
  const result=rpPreviousGo(target);
  if(workspaceMode==='retail')window.scrollTo?.(0,0);
  return result;
};
