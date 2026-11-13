// Retail Sales: itemised invoices, returns, receipts and tracked advances.
// All records use the existing shop-owned sales/payments cloud collections.
const RB_VERSION='2.10.50';
const rbStyle=document.createElement('link');rbStyle.rel='stylesheet';rbStyle.href='./retail-sales.css?v='+RB_VERSION;document.head.append(rbStyle);
let rbSection='Bill',rbSaving=false;
const RB_SECTIONS=['Bill','Sales Return','Receipt','Advance Amount','Metal Weight Advance'];
const RB_METHODS=['Cash','Cheque','GPay','Bank transfer','Card'];
const rbRound=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const rbGrams=value=>Math.round((Number(value)+Number.EPSILON)*1000)/1000;
const rbNow=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function rbItemCalc(x){
  const grossWeight=n(x.grossWeight??x.weight),lessWeight=n(x.lessWeight??x.stoneWeight??0),netWeight=rbGrams(grossWeight-lessWeight),pieces=n(x.pieces||1),purity=n(x.purity||22),rate=n(x.rate??x.ratePerGram),wastage=n(x.wastage),wastageMode=x.wastageMode==='grams'?'grams':'percent',wastageGrams=wastageMode==='grams'?wastage:netWeight*wastage/100;
  const prodLower=String(x.product||'').toLowerCase(),grpLower=String(x.productGroup||'').toLowerCase(),metalType=x.metalType||(prodLower.includes('silver')||grpLower.includes('silver')?'Silver':prodLower.includes('platinum')||grpLower.includes('platinum')?'Platinum':'Gold');
  const makingMode=['piece','gram','fixed','percent'].includes(x.makingMode)?x.makingMode:'piece',makingRate=n(x.makingRate??x.makingPerPiece),goldAmount=rbRound(netWeight*rate),wastageAmount=rbRound(wastageGrams*rate),makingTotal=rbRound(makingMode==='percent'?(goldAmount*makingRate/100):(makingRate*(makingMode==='piece'?pieces:makingMode==='gram'?netWeight:1))),stoneAmount=rbRound(n(x.stoneAmount??(n(x.stoneWeight)*n(x.stoneRate)+n(x.certificateCharge)))),otherAmount=n(x.otherAmount),wastageGramsRounded=rbGrams(wastageGrams),subtotal=rbRound(goldAmount+wastageAmount+makingTotal+stoneAmount+otherAmount);
  return Object.assign({},x,{id:x.id||crypto.randomUUID(),product:String(x.product||'').trim(),metalType,grossWeight,lessWeight,netWeight,weight:netWeight,pieces,purity,rate,wastage,wastageMode,wastageGrams:wastageGramsRounded,rawWastageGrams:wastageGramsRounded,makingMode,makingRate,goldAmount,rawGoldAmount:goldAmount,wastageAmount,rawWastageAmount:wastageAmount,makingTotal,rawMakingTotal:makingTotal,stoneAmount,otherAmount,chitWeight:0,chitCoveredWeight:0,nonChitWeight:netWeight,chitPaidAmount:0,chitRateBenefit:0,wastageDiscountGrams:0,wastageDiscountAmount:0,makingDiscountAmount:0,pureGold:(metalType.toLowerCase()==='silver'?0:netWeight*(purity>24?purity/100:purity/24)),rawSubtotal:subtotal,subtotal});
}
function rbApplyChitToRows(rawRows,options={}){
  const empty={rows:rawRows,chitMappingId:'',chitNumber:'',chitOrnamentType:'',chitPaid:0,chitBonus:0,chitDeduction:0,chitAmount:0,considerChitWeight:false,chitMetalWeight:0,chitUsedWeight:0,chitPrincipalUsed:0,chitRateBenefit:0,chitWastageDiscount:0,chitMakingDiscount:0,chitTotalBenefit:0};
  const chit=options.chitSummary||(options.chitMappingId&&typeof window.rcChitSummary==='function'?window.rcChitSummary(options.chitMappingId,{considerChitWeight:options.considerChitWeight,bonus:options.chitBonus,deduction:options.chitDeduction}):null);
  if(!chit||!chit.mappingId)return empty;
  const rows=rawRows.map(r=>Object.assign({},r)),ornLower=String(chit.ornamentType||'Gold').toLowerCase();
  const matchIdxs=rows.map((r,i)=>(String(r.metalType||'Gold').toLowerCase()===ornLower&&r.netWeight>0)?i:-1).filter(i=>i>=0);
  const useWeight=!!(chit.considerChitWeight&&chit.metalWeight>0);
  const allocatedWt=new Array(rows.length).fill(0),coveredWt=new Array(rows.length).fill(0);
  if(useWeight){
    let rem=rbGrams(chit.metalWeight);
    for(const i of matchIdxs){
      if(rem<=0)break;
      const take=rbGrams(Math.min(rem,rows[i].netWeight));
      allocatedWt[i]=take;coveredWt[i]=take;rem=rbGrams(Math.max(0,rem-take));
    }
  }else if(!(chit.metalWeight>0)&&chit.totalChitAmount>0&&(chit.wastageBenefitPercent>0||chit.mcBenefitRate>0||chit.noMakingCharge)){
    let remCash=n(chit.totalChitAmount);
    for(const i of matchIdxs){
      if(remCash<=0||rows[i].rate<=0)break;
      const take=rbGrams(Math.min(rows[i].netWeight,remCash/rows[i].rate));
      coveredWt[i]=take;remCash=Math.max(0,remCash-take*rows[i].rate);
    }
  }
  const totalUsedWt=rbGrams(allocatedWt.reduce((s,v)=>s+v,0));
  const applicablePrincipal=totalUsedWt>0?(totalUsedWt>=rbGrams(chit.metalWeight)-0.0005?rbRound(chit.paid):rbRound(chit.paid*(totalUsedWt/chit.metalWeight))):0;
  let remPrincipal=applicablePrincipal,usedWtLeft=totalUsedWt,totalRateBenefit=0,totalWstDisc=0,totalMcDisc=0;
  for(const i of matchIdxs){
    const r=rows[i],uWt=allocatedWt[i],cWt=coveredWt[i];
    if(uWt<=0&&cWt<=0)continue;
    let paidForRow=0,newGold=r.goldAmount,nonChitWt=r.netWeight,rateBenefit=0;
    if(uWt>0&&usedWtLeft>0){
      usedWtLeft=rbGrams(Math.max(0,usedWtLeft-uWt));
      paidForRow=usedWtLeft<=0?rbRound(remPrincipal):rbRound(applicablePrincipal*(uWt/totalUsedWt));
      remPrincipal=rbRound(Math.max(0,remPrincipal-paidForRow));
      nonChitWt=rbGrams(Math.max(0,r.netWeight-uWt));
      newGold=rbRound(nonChitWt*r.rate+paidForRow);
      rateBenefit=rbRound((uWt*r.rate)-paidForRow);
    }
    const waiverRatio=Math.min(100,Math.max(0,n(chit.wastageBenefitPercent)))/100;
    const rawWstForCovered=r.wastageMode==='grams'?(r.netWeight>0?r.rawWastageGrams*(cWt/r.netWeight):0):(cWt*n(r.wastage)/100);
    const wstDiscGrams=waiverRatio>0?rbGrams(Math.min(r.rawWastageGrams,rawWstForCovered*waiverRatio)):0;
    const newWstGrams=rbGrams(Math.max(0,r.rawWastageGrams-wstDiscGrams));
    const newWstAmt=rbRound(newWstGrams*r.rate),wstDiscAmt=rbRound(r.rawWastageAmount-newWstAmt);
    let mcDiscAmt=0;
    if(chit.noMakingCharge)mcDiscAmt=rbRound(r.rawMakingTotal*(cWt/r.netWeight));
    else if(n(chit.mcBenefitRate)>0)mcDiscAmt=r.makingMode==='gram'?rbRound(cWt*Math.min(n(r.makingRate),n(chit.mcBenefitRate))):Math.min(r.rawMakingTotal,rbRound(cWt*n(chit.mcBenefitRate)));
    const newMc=rbRound(Math.max(0,r.rawMakingTotal-mcDiscAmt));
    const newSubtotal=rbRound(newGold+newWstAmt+newMc+n(r.stoneAmount)+n(r.otherAmount));
    Object.assign(r,{goldAmount:newGold,wastageGrams:newWstGrams,wastageAmount:newWstAmt,makingTotal:newMc,subtotal:newSubtotal,chitWeight:uWt,chitCoveredWeight:cWt,nonChitWeight:nonChitWt,chitPaidAmount:paidForRow,chitRateBenefit:rateBenefit,wastageDiscountGrams:wstDiscGrams,wastageDiscountAmount:wstDiscAmt,makingDiscountAmount:mcDiscAmt});
    totalRateBenefit=rbRound(totalRateBenefit+rateBenefit);
    totalWstDisc=rbRound(totalWstDisc+wstDiscAmt);
    totalMcDisc=rbRound(totalMcDisc+mcDiscAmt);
  }
  const chitAmount=rbRound(n(chit.totalChitAmount));
  return {rows,chitMappingId:chit.mappingId,chitNumber:chit.chitNumber||'',chitOrnamentType:chit.ornamentType||'Gold',chitPaid:rbRound(chit.paid),chitBonus:rbRound(chit.bonus),chitDeduction:rbRound(chit.deduction),chitAmount,considerChitWeight:useWeight,chitMetalWeight:rbGrams(chit.metalWeight),chitUsedWeight:totalUsedWt,chitPrincipalUsed:applicablePrincipal,chitRateBenefit:totalRateBenefit,chitWastageDiscount:totalWstDisc,chitMakingDiscount:totalMcDisc,chitTotalBenefit:rbRound(totalRateBenefit+totalWstDisc+totalMcDisc+n(chit.bonus))};
}
function rbBillCalc(items,options={}){
  const rawRows=items.map(rbItemCalc),chitRes=rbApplyChitToRows(rawRows,options),rows=chitRes.rows,sum=key=>rbRound(rows.reduce((s,x)=>s+n(x[key]),0)),weight=rbGrams(rows.reduce((s,x)=>s+x.netWeight,0)),subtotal=sum('subtotal'),discountValue=n(options.discountValue),discountMode=options.discountMode||'amount',discount=rbRound(discountMode==='percent'?subtotal*discountValue/100:discountMode==='gram'?weight*discountValue:discountValue),afterDiscount=rbRound(Math.max(0,subtotal-discount)),gstEnabled=!!options.gstEnabled,gstRate=gstEnabled?n(options.gstRate):0,inclusive=options.taxTreatment==='inclusive',taxableValue=gstEnabled&&inclusive?rbRound(afterDiscount/(1+gstRate/100)):afterDiscount,gstAmount=gstEnabled?(inclusive?rbRound(afterDiscount-taxableValue):rbRound(taxableValue*gstRate/100)):0,saleBeforeRound=rbRound(taxableValue+gstAmount),exchangeAmount=rbRound(n(options.exchangeAmount)),metalCredit=rbRound(n(options.metalCredit)),beforeRound=rbRound(saleBeforeRound-exchangeAmount-metalCredit-chitRes.chitAmount);
  const rounded=options.roundMode==='nearest'?Math.round(beforeRound):options.roundMode==='down'?Math.floor(beforeRound):options.roundMode==='up'?Math.ceil(beforeRound):beforeRound,roundOff=rbRound(rounded-beforeRound),amount=rbRound(rounded),cashAdvance=rbRound(n(options.cashAdvance)),collectedAmount=rbRound(n(options.collectedAmount)),balance=rbRound(amount-cashAdvance-collectedAmount),gstMode=options.gstMode==='igst'?'igst':'cgst_sgst',cgst=gstMode==='cgst_sgst'?rbRound(gstAmount/2):0;
  return {rows,weight,grossWeight:rbGrams(rows.reduce((s,x)=>s+x.grossWeight,0)),pieces:rows.reduce((s,x)=>s+x.pieces,0),pureGold:rows.reduce((s,x)=>s+x.pureGold,0),goldAmount:sum('goldAmount'),wastageAmount:sum('wastageAmount'),makingTotal:sum('makingTotal'),stoneAmount:sum('stoneAmount'),otherAmount:sum('otherAmount'),subtotal,discount,discountMode,discountValue,taxableValue,gstEnabled,gstRate,gstMode,gstAmount,cgst,sgst:gstMode==='cgst_sgst'?rbRound(gstAmount-cgst):0,igst:gstMode==='igst'?gstAmount:0,taxTreatment:inclusive?'inclusive':'exclusive',saleBeforeRound,roundOff,saleAmount:rbRound(saleBeforeRound+roundOff),exchangeAmount,metalCredit,chitMappingId:chitRes.chitMappingId,chitNumber:chitRes.chitNumber,chitOrnamentType:chitRes.chitOrnamentType,chitPaid:chitRes.chitPaid,chitBonus:chitRes.chitBonus,chitDeduction:chitRes.chitDeduction,chitAmount:chitRes.chitAmount,considerChitWeight:chitRes.considerChitWeight,chitMetalWeight:chitRes.chitMetalWeight,chitUsedWeight:chitRes.chitUsedWeight,chitPrincipalUsed:chitRes.chitPrincipalUsed,chitRateBenefit:chitRes.chitRateBenefit,chitWastageDiscount:chitRes.chitWastageDiscount,chitMakingDiscount:chitRes.chitMakingDiscount,chitTotalBenefit:chitRes.chitTotalBenefit,amount,cashAdvance,collectedAmount,balance};
}
function rbInvoiceItems(sale){
  if(sale?.invoiceItems?.length)return sale.invoiceItems.map(rbItemCalc);
  if(!sale)return [rbItemCalc({product:db.products[0]||'',purity:22,pieces:1,rate:v2RateForPurity(22)})];
  return [rbItemCalc({id:'legacy-0',product:sale.product,grossWeight:sale.weight,pieces:sale.pieces,purity:sale.purity,wastage:sale.wastage,rate:n(sale.ratePerGram)||v2RateForPurity(sale.purity),makingRate:sale.makingPerPiece,photo:sale.photo})];
}
function rbCustomerSales(id){return db.sales.filter(x=>ownerType(x)==='customer'&&(!id||x.partyId===id));}
function rbRecords(kind,id){return db.payments.filter(x=>ownerType(x)==='customer'&&(x.retailKind||'receipt')===kind&&(!id||x.partyId===id));}
function rbCashUsed(paymentId,excludeInvoice=''){return rbCustomerSales().filter(x=>x.id!==excludeInvoice).reduce((sum,s)=>sum+(s.advanceAllocations||[]).filter(a=>a.paymentId===paymentId).reduce((v,a)=>v+n(a.amount),0),0);}
function rbMetalUsed(paymentId,excludeInvoice=''){return rbCustomerSales().filter(x=>x.id!==excludeInvoice).reduce((sum,s)=>sum+(s.metalAllocations||[]).filter(a=>a.paymentId===paymentId).reduce((v,a)=>v+n(a.pureGrams),0),0);}
function rbInvoiceBalance(sale){if(!sale)return 0;const other=db.payments.filter(p=>ownerType(p)==='customer'&&p.invoiceId===sale.id&&['receipt','return'].includes(p.retailKind)).reduce((s,p)=>s+n(p.amount),0);return rbRound(n(sale.amount)-saleCollectionValue(sale)-n(sale.cashAdvanceAmount)-other);}
function rbPureWeight(sale){return sale.invoiceItems?.length?sale.invoiceItems.reduce((s,x)=>s+n(x.netWeight)*n(x.purity)/24,0):n(sale.weight)*n(sale.purity)/24;}
function rbPurityText(sale){
  const items = sale.invoiceItems || (sale.purity ? [sale] : []);
  if(!items.length) return '—';
  const purities = items.map(x=>{
    const isSil = String(x.metalType||'').toLowerCase()==='silver' || String(x.product||'').toLowerCase().includes('silver') || String(x.productGroup||'').toLowerCase().includes('silver');
    return isSil ? '—' : (n(x.purity) + (String(x.purity).includes('K')||String(x.purity).includes('%')?'':'K'));
  });
  return [...new Set(purities)].join(' / ');
}
function rbCollectionByMethod(sale,method){return sale.collections?.length?sale.collections.filter(x=>x.method===method).reduce((s,x)=>s+n(x.amount),0):(sale.collectedMethod||'Cash')===method?saleCollectionValue(sale):0;}
function rbCustomerOptions(id='',empty='Select customer'){return '<option value="">'+empty+'</option>'+db.customers.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===id?'selected':'')+'>'+esc(x.name)+'</option>').join('');}
function rbOptions(items,value){return items.map(x=>'<option value="'+esc(x)+'" '+(x===value?'selected':'')+'>'+esc(x)+'</option>').join('');}
function rbKeyboard(type,extra=''){return type==='number'?' inputmode="'+(extra.includes('step="1"')?'numeric':'decimal')+'"':'';}
function rbInput(label,name,value='',type='text',extra=''){return '<label class="rb-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'"'+rbKeyboard(type,extra)+' '+extra+'></label>';}
function rbMarkDirty(form){if(form)form.dataset.entryDirty='1';}
function rbDirty(){return !!document.querySelector('#customerSaleForm[data-entry-dirty="1"],#rbRecordForm[data-entry-dirty="1"]');}
function rbCanLeave(){return !rbDirty()||confirm('Leave this entry and discard the unsaved changes?');}
window.rbOpen=function(section){
  if(!session||!goldleafContext?.has_access){say('Please sign in first.');return;}
  if(!RB_SECTIONS.includes(section)||!rbCanLeave())return;rbSection=section;edit=null;page='Sales Entry';render();window.scrollTo?.(0,0);};
window.rbEdit=function(id,kind='Bill'){
  if(!session||!goldleafContext?.has_access){say('Please sign in first.');return;}
  if(!rbCanLeave())return;
  rbDialog('rbHistoryPanel',false);
  rbSection=kind;
  edit=id;
  page='Sales Entry';
  render();
  document.getElementById('app')?.scrollTo(0,0);
  window.scrollTo?.(0,0);
};
function rbHeader(title){return '<header class="rb-header"><div><div class="eyebrow">GOLDLEAF · RETAIL SALES</div><h1>'+title+'</h1></div><div class="rb-tools"><button type="button" onclick="if(rbCanLeave())go(\'Dashboard\')">Home</button><button type="button" onclick="rbShowHistory()">Sales history</button><button type="button" onclick="if(rbCanLeave())go(\'Rate Book\')">Rates</button><button type="button" onclick="toggleTheme()" class="theme-toggle">'+(appTheme==='dark'?'☀':'☾')+'</button></div></header><label class="rb-mobile-section"><span>Sales section</span><select aria-label="Sales section" onchange="rbOpen(this.value);this.value=rbSection">'+RB_SECTIONS.map(x=>'<option value="'+x+'" '+(rbSection===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><nav class="rb-tabs" aria-label="Retail Sales sections">'+RB_SECTIONS.map(x=>'<button type="button" class="'+(rbSection===x?'active':'')+'" aria-current="'+(rbSection===x?'page':'false')+'" onclick="rbOpen(\''+x+'\')">'+x+'</button>').join('')+'</nav>';}
function rbModal(id,title,content,actions=''){
  const footer=actions||'<button type="button" class="primary" onclick="rbDialog(\''+id+'\',false)">Done</button>';
  return '<div id="'+id+'" class="retail-modal-backdrop rb-modal hidden" aria-hidden="true">'
    +'<section class="retail-modal" role="dialog" aria-modal="true" aria-labelledby="'+id+'Title">'
    +'<div class="retail-modal-head"><h2 id="'+id+'Title">'+title+'</h2>'
    +'<button type="button" onclick="rbDialog(\''+id+'\',false)">Close</button></div>'
    +'<div class="retail-modal-scroll">'+content+'</div>'
    +'<div class="retail-modal-actions">'+footer+'</div></section></div>';
}
window.rbDialog=function(id,open=true){const panel=document.getElementById(id);if(!panel)return;for(const p of document.querySelectorAll('.rb-modal:not(.hidden)'))if(p!==panel){p.classList.add('hidden');p.setAttribute('aria-hidden','true');}panel.classList.toggle('hidden',!open);panel.setAttribute('aria-hidden',String(!open));erpRefreshDialogState();if(open)panel.querySelector('input:not([type=hidden]),select,button')?.focus({preventScroll:true});};
const rbPreviousDialogState=window.erpRefreshDialogState;
window.erpRefreshDialogState=function(){const open=rbPreviousDialogState()||!!document.querySelector('.rb-modal:not(.hidden)');document.body.classList.toggle('retail-entry-dialog-open',open);return open;};
const rbPreviousEditCheck=window.v2HasFocusedEdit;
window.v2HasFocusedEdit=function(){return rbPreviousEditCheck()||rbDirty()||!!document.querySelector('.rb-modal:not(.hidden)');};
for(const name of ['input','change'])document.addEventListener(name,event=>{const form=event.target.closest?.('#rbRecordForm');if(form)rbMarkDirty(form);},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const panel=document.querySelector('.rb-modal:not(.hidden)');if(panel){event.preventDefault();rbDialog(panel.id,false);}}});

function rbItemInput(key,value,type='number',extra=''){return '<input data-item="'+key+'" type="'+type+'" value="'+esc(value??'')+'"'+rbKeyboard(type,extra)+' '+extra+'>';}
function rbItemMarkup(item,index){
  const x=rbItemCalc(item),num=(key,step='.001',extra='')=>rbItemInput(key,x[key]||'', 'number','min="0" step="'+step+'" '+extra),select=(key,options)=>'<select data-item="'+key+'">'+options+'</select>',modes=(items,value)=>items.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+label+'</option>').join('');
  const isSilver=String(x.metalType||'').toLowerCase()==='silver'||String(x.product||'').toLowerCase().includes('silver')||String(x.productGroup||'').toLowerCase().includes('silver');
  return '<tbody class="rb-item" data-item-id="'+esc(x.id)+'" data-metal-type="'+(isSilver?'Silver':'Gold')+'"><tr><td class="rb-index"><span class="rb-index-num">'+(index+1)+'</span><span class="rb-index-badge">Item #'+(index+1)+' · '+(isSilver?'Silver':'Gold')+'</span></td><td class="rb-tag-cell"><div class="rc-scan-wrap"><input data-item="tagCode" value="'+esc(x.tagCode||'')+'" placeholder="Tag / HUID" autocomplete="off" onchange="rbTagRowChanged(this)"><button type="button" class="gl-scan-btn gl-scan-btn-sm" onclick="openQrScannerForTagRow(this)" title="Scan QR / Barcode" aria-label="Scan">'+(window.glScanIconSvg||'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/></svg>')+'</button></div></td><td class="rb-product">'+select('product',rbOptions([...new Set([...db.products,x.product].filter(Boolean))],x.product))+'</td><td class="rb-huid-cell">'+rbItemInput('huid',x.huid,'text','placeholder="Optional" maxlength="30"')+'</td><td class="rb-pcs-cell">'+num('pieces','1','min="1" required')+'</td><td class="rb-gross-cell">'+num('grossWeight','.001','required')+'</td><td class="rb-less-cell">'+num('lessWeight')+'</td><td class="rb-net-cell"><output data-out="netWeight">'+fmt(x.netWeight)+'</output></td><td class="rb-purity-cell"><span class="rb-purity-na muted" style="display:'+(isSilver?'inline':'none')+'">—</span>'+select('purity',[...new Set([...(db.purities||[]).filter(k=>n(k)>0&&n(k)<=24),x.purity])].map(k=>'<option value="'+k+'" '+(n(k)===x.purity?'selected':'')+'>'+k+'K</option>').join('')).replace('<select ','<select '+(isSilver?'style="display:none" ':'')+'onchange="rbPurityChanged(this)" ')+'</td><td class="rb-wastage-cell">'+select('wastageMode',modes([['percent','%'],['grams','g']],x.wastageMode))+num('wastage','.01')+'</td><td class="rb-rate-cell">'+num('rate','.01','required')+'</td><td class="rb-making-cell">'+select('makingMode',modes([['piece','Per piece'],['gram','Per gram'],['fixed','Fixed']],x.makingMode))+'</td><td class="rb-making-rate-cell">'+num('makingRate','.01')+'</td><td class="rb-line-amount"><output data-out="subtotal">'+rateMoney(x.subtotal)+'</output></td><td class="rb-item-actions"><button type="button" aria-label="More item details" aria-expanded="false" onclick="rbItemDetails(this)">Details</button><button type="button" aria-label="Remove sale item" onclick="rbRemoveItem(this)">×</button></td></tr>'
    +'<tr class="rb-item-details hidden"><td colspan="15"><div class="rb-detail-grid">'+rbInput('Product group','unused',x.productGroup||(isSilver?'Silver jewellery':'Gold jewellery')).replace('name="unused"','data-item="productGroup"')+rbInput('Tag / barcode','unused',x.tagCode||'').replace('name="unused"','data-item="tagCode"')+rbInput('Description','unused',x.description||'').replace('name="unused"','data-item="description"')+rbInput('HSN','unused',x.hsn||'').replace('name="unused"','data-item="hsn"')+rbInput('Stone / diamond pieces','unused',x.stonePieces||0,'number','min="0" step="1"').replace('name="unused"','data-item="stonePieces"')+rbInput('Stone / diamond carats','unused',x.stoneWeight||0,'number','min="0" step=".001"').replace('name="unused"','data-item="stoneWeight"')+rbInput('Stone rate / carat · ₹','unused',x.stoneRate||0,'number','min="0" step=".01"').replace('name="unused"','data-item="stoneRate"')+rbInput('Certificate charge · ₹','unused',x.certificateCharge||0,'number','min="0" step=".01"').replace('name="unused"','data-item="certificateCharge"')+rbInput('Other item charge · ₹','unused',x.otherAmount||0,'number','min="0" step=".01"').replace('name="unused"','data-item="otherAmount"')+rbInput('Item remarks','unused',x.remarks||'').replace('name="unused"','data-item="remarks"')+'</div><p class="hint">Deduct stone or other non-gold weight in Less g. Carats above calculate the stone charge only.</p></td></tr></tbody>';
}
function rbReadItems(form){return [...form.querySelectorAll('.rb-item')].map(node=>{const item={id:node.dataset.itemId};node.querySelectorAll('[data-item]').forEach(input=>item[input.dataset.item]=input.value);return rbItemCalc(item);});}
window.rbAddItem=function(){const form=document.getElementById('customerSaleForm'),table=form?.querySelector('#rbItemsTable');if(!table)return;table.querySelector('tfoot').insertAdjacentHTML('beforebegin',rbItemMarkup(rbInvoiceItems()[0],form.querySelectorAll('.rb-item').length));rbMarkDirty(form);rbRecalc(form);};
window.rbRemoveItem=function(button){const form=button.form||button.closest('form'),row=button.closest('.rb-item');if(form.querySelectorAll('.rb-item').length===1){row.insertAdjacentHTML('beforebegin',rbItemMarkup(rbInvoiceItems()[0],0));}row.remove();form.querySelectorAll('.rb-item').forEach((r,i)=>{const idx=r.querySelector('.rb-index');if(idx){const isSil=r.dataset.metalType==='Silver';idx.innerHTML='<span class="rb-index-num">'+(i+1)+'</span><span class="rb-index-badge">Item #'+(i+1)+' · '+(isSil?'Silver':'Gold')+'</span>';}});rbMarkDirty(form);rbRecalc(form);};
window.rbItemDetails=function(button){const row=button.closest('.rb-item').querySelector('.rb-item-details'),open=row.classList.toggle('hidden')===false;button.setAttribute('aria-expanded',String(open));};
window.rbPurityChanged=function(input){const row=input.closest('.rb-item');row.querySelector('[data-item="rate"]').value=v2RateForPurity(input.value).toFixed(2);rbMarkDirty(input.form);rbRecalc(input.form);};
function rbCollectionRow(x={}){return '<div class="rb-collection-row"><select data-collection="method" aria-label="Collection method">'+rbOptions(RB_METHODS,x.method||'Cash')+'</select><input data-collection="amount" type="number" inputmode="decimal" min="0" step=".01" value="'+esc(x.amount||'')+'" placeholder="Amount ₹" aria-label="Collection amount"><input data-collection="reference" value="'+esc(x.reference||'')+'" placeholder="Cheque / transaction reference" aria-label="Collection reference"><button type="button" aria-label="Remove collection" onclick="rbRemoveCollection(this)">×</button></div>';}
window.rbAddCollection=function(){const form=document.getElementById('customerSaleForm');form.querySelector('#rbCollections').insertAdjacentHTML('beforeend',rbCollectionRow());rbMarkDirty(form);};
function rbReadCollections(form){
  let rows=[...form.querySelectorAll('.rb-collection-row')].map(row=>({method:row.querySelector('[data-collection=method]')?.value||'Cash',amount:n(row.querySelector('[data-collection=amount]')?.value),reference:String(row.querySelector('[data-collection=reference]')?.value||'').trim()})).filter(x=>x.amount!==0||x.reference);
  if(!rows.length){
    const dAmt=n(form.querySelector('#rbDirectAmount')?.value||form.querySelector('#rbTotalCollectedInput')?.value);
    if(dAmt>0){
      const dMeth=form.querySelector('#rbDirectMethod')?.value||'Cash';
      const dRef=String(form.querySelector('#rbDirectRef')?.value||'').trim();
      rows=[{method:dMeth,amount:dAmt,reference:dRef}];
    }
  }
  return rows;
}
window.rbSyncDirectCollection=function(el){
  const form=el.closest('form');if(!form)return;
  const dirAmt=form.querySelector('#rbDirectAmount'),dirMeth=form.querySelector('#rbDirectMethod'),dirRef=form.querySelector('#rbDirectRef'),totIn=form.querySelector('#rbTotalCollectedInput');
  if(totIn&&dirAmt&&el!==totIn)totIn.value=dirAmt.value;
  let cRow=form.querySelector('#rbCollections .rb-collection-row');
  if(!cRow){const container=form.querySelector('#rbCollections');if(container){container.innerHTML=rbCollectionRow({method:dirMeth?.value||'Cash',amount:dirAmt?.value||0,reference:dirRef?.value||''});cRow=container.querySelector('.rb-collection-row');}}
  if(cRow){
    const rowAmt=cRow.querySelector('[data-collection="amount"]');if(rowAmt&&dirAmt)rowAmt.value=dirAmt.value;
    const rowMeth=cRow.querySelector('[data-collection="method"]');if(rowMeth&&dirMeth)rowMeth.value=dirMeth.value;
    const rowRef=cRow.querySelector('[data-collection="reference"]');if(rowRef&&dirRef)rowRef.value=dirRef.value;
  }
  rbMarkDirty(form);rbRecalc(form);
};
window.rbSyncTotalCollection=function(el){
  const form=el.closest('form');if(!form)return;
  const dirAmt=form.querySelector('#rbDirectAmount');if(dirAmt)dirAmt.value=el.value;
  let cRow=form.querySelector('#rbCollections .rb-collection-row');
  if(!cRow){const container=form.querySelector('#rbCollections');if(container){container.innerHTML=rbCollectionRow({method:form.querySelector('#rbDirectMethod')?.value||'Cash',amount:el.value||0,reference:form.querySelector('#rbDirectRef')?.value||''});cRow=container.querySelector('.rb-collection-row');}}
  if(cRow){const rowAmt=cRow.querySelector('[data-collection="amount"]');if(rowAmt)rowAmt.value=el.value;}
  rbMarkDirty(form);rbRecalc(form);
};
function rbAdvanceMarkup(sale){const id=sale?.partyId||'',exclude=sale?.id||'',cash=rbRecords('advance',id),metal=rbRecords('metal',id);return '<div id="rbAdvanceBody">'+(!id?'<p class="hint">Select a customer to see available advances.</p>':'<h3>Amount advances · already credited in the customer ledger</h3>'+(cash.map(p=>{const value=n((sale?.advanceAllocations||[]).find(x=>x.paymentId===p.id)?.amount),available=rbRound(n(p.amount)-rbCashUsed(p.id,exclude)),dateLabel=p.documentNo||(p.when?p.when.replace('T',' '):(p.date||'Advance'));return '<label class="rb-allocation"><span>'+esc(dateLabel)+'<small>Available '+rateMoney(available)+'</small></span><input data-cash-advance="'+esc(p.id)+'" type="number" min="0" max="'+available+'" step=".01" value="'+(value||'')+'" placeholder="Apply ₹" aria-label="Apply amount advance"></label>';}).join('')||'<p class="hint">No amount advances available.</p>')+'<h3>Metal weight advances · valued when applied</h3>'+(metal.map(p=>{const value=n((sale?.metalAllocations||[]).find(x=>x.paymentId===p.id)?.pureGrams),available=rbGrams(n(p.pureGrams)-rbMetalUsed(p.id,exclude)),dateLabel=p.documentNo||(p.when?p.when.replace('T',' '):(p.date||'Advance'));return '<label class="rb-allocation"><span>'+esc(dateLabel)+'<small>Available '+fmt(available)+' pure g</small></span><input data-metal-advance="'+esc(p.id)+'" type="number" min="0" max="'+available+'" step=".001" value="'+(value||'')+'" placeholder="Apply pure g" aria-label="Apply metal advance"></label>';}).join('')||'<p class="hint">No metal advances available.</p>')+rbInput('Agreed 24K value for applied metal · ₹/g','metalAdvanceRate',sale?.metalAdvanceRate||db.rates.gold24||0,'number','min="0" step=".01"')+'<p class="hint">Amount advances settle this bill without adding a second receipt. Applied metal is converted once at the rate shown above.</p>')+'</div>';}
function rbAllocations(form){const rate=n(form.elements.metalAdvanceRate?.value),advanceAllocations=[...form.querySelectorAll('[data-cash-advance]')].map(e=>({paymentId:e.dataset.cashAdvance,amount:n(e.value)})).filter(x=>x.amount),metalAllocations=[...form.querySelectorAll('[data-metal-advance]')].map(e=>({paymentId:e.dataset.metalAdvance,pureGrams:n(e.value),rate,amount:rbRound(n(e.value)*rate)})).filter(x=>x.pureGrams);return {advanceAllocations,metalAllocations,cashAdvance:rbRound(advanceAllocations.reduce((s,x)=>s+x.amount,0)),metalCredit:rbRound(metalAllocations.reduce((s,x)=>s+x.amount,0))};}
function rbChitSelectSafe(customerId='',selected=''){if(typeof rcChitSelect==='function')return rcChitSelect(customerId,selected);const maps=(db.retailDocuments||[]).filter(x=>x.kind==='retail-chit-mapping'&&(!customerId||x.customerId===customerId)&&((x.status||'Active')!=='Closed'||x.id===selected));return '<label>Chit Info<select name="chitMappingId"><option value="">No chit linked</option>'+maps.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(m.chitNumber)+'</option>').join('')+'</select></label>';}
function rbChitModalMarkup(customerId='',sale=null){
  const selId=sale?.chitMappingId||'';
  const details=typeof window.rcChitDetailsMarkup==='function'?window.rcChitDetailsMarkup(selId,{considerChitWeight:sale?.considerChitWeight,bonus:sale?.chitBonus,deduction:sale?.chitDeduction},'bill'):'';
  return '<p class="hint">Link this bill to the customer’s active or matured retail chit passbook. Weight chits apply rate protection, wastage/MC waivers, and deduct chit credit post-tax.</p>'
    +rbChitSelectSafe(customerId,selId).replace('<select name="chitMappingId"','<select name="chitMappingId" onchange="rbSyncChitUI(this.form,true)"')
    +'<div id="rbChitDetailsBox">'+details+'</div>';
}
window.rbSyncChitUI=function(form,resetDefaults=false){
  if(!form?.dataset.retailBill)return;
  const f=form.elements,selId=f.chitMappingId?.value||'';
  const box=form.querySelector('#rbChitDetailsBox');
  if(box&&typeof window.rcChitDetailsMarkup==='function'){
    const state=resetDefaults?{}:{considerChitWeight:f.considerChitWeight?.checked,bonus:f.chitBonus?.value,deduction:f.chitDeduction?.value};
    box.innerHTML=window.rcChitDetailsMarkup(selId,state,'bill');
  }
  rbMarkDirty(form);
  rbRecalc(form);
};
function rbFormTotals(form){
  const f=form.elements,collections=rbReadCollections(form),allocation=rbAllocations(form),exchange=exchangeRows(form).filter(x=>x.hasEntry),exchangeAmount=rbRound(exchange.reduce((s,x)=>s+x.amount,0));
  const chitMappingId=f.chitMappingId?.value||'',considerChitWeight=f.considerChitWeight?!!f.considerChitWeight.checked:undefined,chitBonus=f.chitBonus?f.chitBonus.value:undefined,chitDeduction=f.chitDeduction?f.chitDeduction.value:undefined;
  return Object.assign(rbBillCalc(rbReadItems(form),{discountMode:f.discountMode.value,discountValue:f.discountValue.value,gstEnabled:!!f.gstEnabled?.checked,gstRate:f.gstRate?.value,gstMode:f.gstMode?.value,taxTreatment:f.taxTreatment.value,roundMode:f.roundMode.value,exchangeAmount,chitMappingId,considerChitWeight,chitBonus,chitDeduction,...allocation,collectedAmount:collections.reduce((s,x)=>s+x.amount,0)}),{collections,exchange,...allocation});
}
function rbTotalRow(label,id,value){return '<div class="rb-total-row"><span>'+label+'</span><b id="'+id+'">'+rateMoney(value)+'</b></div>';}
window.rbOpenCustomerAdd=function(){
  const panelId='rbAddCustomerPanel';
  document.getElementById(panelId)?.remove();
  const fields='<form id="rbAddCustomerForm" class="rb-quick-customer-fields" onsubmit="saveCustomer(event,rbUseAddedCustomer)">'
    +rbInput('Customer name *','name','','text','required autocomplete="name"')
    +rbInput('Phone','phone','','tel','autocomplete="tel"')
    +rbInput('City','city','','text','autocomplete="address-level2"')
    +'</form>';
  const actions='<button type="submit" form="rbAddCustomerForm" class="primary">Save customer</button>';
  document.body.insertAdjacentHTML('beforeend',rbModal(panelId,'Add customer',fields,actions));
  rbDialog(panelId);
};
window.rbUseAddedCustomer=function(customer){
  rbDialog('rbAddCustomerPanel',false);
  document.getElementById('rbAddCustomerPanel')?.remove();
  let bill=document.getElementById('customerSaleForm');
  if(!bill){
    render();
    bill=document.getElementById('customerSaleForm');
  }
  if(!bill?.dataset.retailBill)return;
  const {partyId,deliveryId}=bill.elements;
  partyId.innerHTML=rbCustomerOptions(customer.id);
  deliveryId.innerHTML=rbCustomerOptions(deliveryId.value,'Same as billing customer');
  syncSaleAccount(bill);
  partyId.focus({preventScroll:true});
};

function rbBillView(){
  const sale=rbCustomerSales().find(x=>x.id===edit),items=rbInvoiceItems(sale),customer=db.customers.find(x=>x.id===sale?.partyId),exchange=sale?.oldGoldItems?.length?sale.oldGoldItems:[{}],collections=sale?.collections?.length?sale.collections:sale?.collectedAmount?[{method:sale.collectedMethod||'Cash',amount:sale.collectedAmount,reference:sale.collectedReference}]:[{}],col0=collections[0]||{},date=sale?.when||rbNow(),number=sale?.documentNo||'';
  if(!db.customers.length){
    return '<div class="retail-sale-screen rb-screen rb-bill-screen">'+rbHeader('Sales bill')
      +'<section class="panel empty"><h2>Register your first customer</h2>'
      +'<p>Add a customer to start a sales bill.</p>'
      +'<button type="button" class="primary" onclick="rbOpenCustomerAdd()">＋ Add customer</button></section>'
      +rbSalesHistorySection()+'</div>';
  }
  const gst=pdfGSTEntryMarkup(sale).replace('<p class="hint">Taxable value:', '<label class="rb-field"><span>GST treatment</span><select name="taxTreatment"><option value="exclusive" '+(sale?.taxTreatment!=='inclusive'?'selected':'')+'>Add GST to price</option><option value="inclusive" '+(sale?.taxTreatment==='inclusive'?'selected':'')+'>Price includes GST</option></select></label><p class="hint">Taxable value:');
  return '<div id="retailSaleScreen" class="retail-sale-screen rb-screen rb-bill-screen">'+rbHeader(sale?'Edit sales bill':'New sales bill')+'<form id="customerSaleForm" class="rb-form" data-retail-bill="2" oninput="rbRecalc(this)" onchange="rbRecalc(this)" onsubmit="saveSale(event)"><input name="id" type="hidden" value="'+esc(sale?.id||'')+'"><input name="accountType" type="hidden" value="customer"><input name="place" type="hidden" value="'+esc(customer?.city||'')+'"><input name="amount" type="hidden"><section class="rb-account panel"><div class="rb-section-head"><h2>Bill details</h2></div><div class="rb-account-grid">'+rbInput('Bill number · optional','documentNo',number,'text','maxlength="60" placeholder="Auto after saving"')+rbInput('Bill date & time *','when',date,'datetime-local','required')+'<div class="rb-field"><div class="rb-customer-field-label"><label for="rbBillingCustomer">Billing customer *</label><button type="button" onclick="rbOpenCustomerAdd()">＋ Add customer</button></div><select id="rbBillingCustomer" name="partyId" required onchange="syncSaleAccount(this.form)">'+rbCustomerOptions(sale?.partyId)+'</select></div><label class="rb-field"><span>Delivery customer</span><select name="deliveryId">'+rbCustomerOptions(sale?.deliveryId,'Same as billing customer')+'</select></label><div class="rb-contact"><div class="rb-contact-card rb-contact-city"><label class="rb-contact-lbl">City</label><span id="rbCustomerCity">'+esc(customer?.city||'—')+'</span></div><div class="rb-contact-card rb-contact-phone"><label class="rb-contact-lbl">Phone</label><small id="rbCustomerPhone">'+esc(customer?.phone||'Select customer')+'</small></div></div></div><details class="rb-bill-details"><summary>More bill details</summary><div class="rb-detail-grid"><label class="rb-field"><span>Sales type</span><select name="salesType">'+rbOptions(['Counter sale','Order delivery','Other'],sale?.salesType||'Counter sale')+'</select></label>'+rbInput('Counter','counter',sale?.counter||'')+rbInput('Salesperson','salesperson',sale?.salesperson||'')+rbInput('Place of supply','placeOfSupply',sale?.placeOfSupply||'')+rbInput('Reference','reference',sale?.reference||'')+rbInput('Bill notes','notes',sale?.notes||'')+'<label class="rb-field"><span>Product photo</span><input type="file" name="photo" accept="image/*"></label></div></details></section><section class="rb-items panel"><div class="rb-section-head"><h2>Jewellery items</h2><div><span id="rbItemCount">'+items.length+' item(s)</span><button type="button" onclick="rbAddItem()">＋ Add item</button></div></div><div class="rb-tag-field-unified"><span class="rb-tag-field-prefix" aria-hidden="true">🏷</span><input id="rbQuickTagInput" type="text" placeholder="Scan or enter Tag Code / Barcode / HUID..." autocomplete="off" onkeydown="rbQuickTagKey(event,this)"><button type="button" class="gl-scan-btn gl-scan-btn-embedded" onclick="openQrScannerForQuickTag()" title="Scan QR / Barcode with Camera" aria-label="Scan QR / Barcode">'+(window.glScanIconSvg||'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/></svg>')+'</button><button type="button" class="gl-add-tag-btn" onclick="rbQuickTagBtnClick(this)" title="Load Tag into Bill" aria-label="Add Tag">＋ Add Tag</button></div><div class="rb-item-scroll" role="region" aria-label="Jewellery items table" tabindex="0"><table id="rbItemsTable"><thead><tr>'+['No.','Tag / Barcode','Product','HUID','Pcs','Gross g','Less g','Net g','Purity','Wastage','Rate / g ₹','Making by','Making ₹','Amount ₹','Actions'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead>'+items.map(rbItemMarkup).join('')+'<tfoot><tr><td colspan="4">Totals</td><td id="rbTotalPieces"></td><td id="rbGrossWeight"></td><td></td><td id="rbNetWeight"></td><td colspan="5"></td><td id="rbItemsValue"></td><td></td></tr></tfoot></table></div></section><div class="rb-settlement"><section class="panel rb-adjustments"><div class="rb-section-head"><h2>Adjustments & receipts</h2></div><div class="rb-adjustment-grid"><button id="oldGoldToggle" type="button" class="exchange-toggle" aria-expanded="false" onclick="toggleOldGold(true)"><span>Old Gold Exchange</span><b id="rbExchangeBadge">'+rateMoney(sale?.exchangeAmount||0)+'</b></button><button id="rbChitToggle" type="button" class="exchange-toggle" onclick="rbDialog(\'rbChitPanel\')"><span>Chit Info</span><b id="rbChitBadge">'+(sale?.chitNumber?esc(sale.chitNumber):'Select')+'</b></button><button id="retailGSTToggle" type="button" class="exchange-toggle erp-gst-toggle" aria-expanded="false" onclick="toggleRetailGST(true)">＋ Add GST</button><button type="button" class="exchange-toggle rb-collection-toggle-highlight" onclick="rbDialog(\'rbCollectionsPanel\')"><span>💰 Split Payments</span><b id="rbCollectedBadge">'+rateMoney(sale?.collectedAmount||0)+'</b></button><button type="button" onclick="rbDialog(\'rbAdvancesPanel\')"><span>Apply advances</span><b id="rbAdvanceBadge">'+rateMoney(sale?.cashAdvanceAmount||0)+'</b></button></div><div class="rb-direct-collection-panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="rb-collection-highlight-badge">💰 PAYMENT COLLECTION</span><b style="font-size:14px;color:#18392a;font-weight:800">Collected Amount / Payment Received</b></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="rb-collection-live-total-wrap"><span class="rb-collection-live-label">Total Collected:</span><b id="rbDirectTotalDisplay" class="rb-collection-live-val">'+rateMoney(sale?.collectedAmount||0)+'</b></div><button type="button" style="font-size:11.5px;padding:5px 11px;font-weight:750;border-radius:6px;background:#18392a;color:#fff;border:none;cursor:pointer" onclick="rbDialog(\'rbCollectionsPanel\')">＋ Split multiple methods</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px"><label class="rb-field" style="margin:0"><span style="font-size:12px;font-weight:800;color:#18392a">Collected amount · ₹ *</span><input id="rbDirectAmount" class="rb-direct-amount-input" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00" value="'+(col0.amount>0?col0.amount:'')+'" oninput="rbSyncDirectCollection(this)"></label><label class="rb-field" style="margin:0"><span style="font-size:12px;font-weight:700;color:#18392a">Payment method</span><select id="rbDirectMethod" style="height:38px;font-weight:600;border:1.5px solid #2e7d32;border-radius:6px" onchange="rbSyncDirectCollection(this)">'+rbOptions(RB_METHODS,col0.method||'Cash')+'</select></label><label class="rb-field" style="margin:0"><span style="font-size:12px;font-weight:700;color:#18392a">Reference / Txn ID</span><input id="rbDirectRef" style="height:38px;border:1.5px solid #bbb;border-radius:6px" type="text" placeholder="UPI Ref / Cheque #" value="'+esc(col0.reference||'')+'" oninput="rbSyncDirectCollection(this)"></label></div></div></section><aside class="panel rb-totals"><div class="rb-section-head"><h2>Bill totals</h2></div><div class="rb-discount-controls"><label class="rb-field"><span>Discount by</span><select name="discountMode">'+[['amount','Amount ₹'],['percent','Percentage %'],['gram','₹ per gram']].map(([v,label])=>'<option value="'+v+'" '+((sale?.discountMode||'amount')===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+rbInput('Discount','discountValue',sale?.discountValue??sale?.discount??0,'number','min="0" step=".01"')+'</div><div class="rb-totals-scroll">'+rbTotalRow('Gold value','saleGoldAmount',0)+rbTotalRow('Wastage','saleWastageAmount',0)+rbTotalRow('Making charges','saleMakingAmount',0)+rbTotalRow('Stone / other charges','rbStoneAmount',0)+'<div class="rb-total-row hidden" id="rbChitBenefitRow" style="font-size:12px;color:#047857;background:#f0fdf4;padding:4px 8px;border-radius:6px"><span id="rbChitBenefitLabel">Chit wt & waivers saved</span><b id="rbChitBenefitVal">₹ 0.00</b></div>'+rbTotalRow('Before discount','saleSubtotal',0)+rbTotalRow('Discount','rbDiscountAmount',0)+rbTotalRow('GST','rbGSTAmount',0)+rbTotalRow('Sale value','saleAfterDiscount',0)+rbTotalRow('Old gold credit','saleExchangeAmount',0)+rbTotalRow('Metal advance credit','rbMetalCredit',0)+rbTotalRow('Chit amount less (−)','rbChitAmount',0)+'<label class="rb-round"><span>Round off</span><select name="roundMode">'+rbOptions(['none','nearest','down','up'],sale?.roundMode||'none')+'</select><b id="rbRoundAmount">₹ 0.00</b></label>'+rbTotalRow('Net payable','rbNetPayable',0)+rbTotalRow('Amount advance applied','rbCashAdvance',0)+'<label class="rb-total-row rb-collected-row"><span>💵 Collected now</span><span class="rb-total-input-wrap"><b>₹</b><input id="rbTotalCollectedInput" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00" value="'+(col0.amount>0?col0.amount:'')+'" oninput="rbSyncTotalCollection(this)"></span><b id="saleCollectedAmount" class="rb-total-collected-badge">'+rateMoney(sale?.collectedAmount||0)+'</b></label></div><div class="rb-balance rb-balance-due"><div class="rb-balance-header"><span id="saleBalanceLabel">Balance to collect</span><small class="rb-balance-sub">Net balance to pay</small></div><b id="saleBalanceAmount">₹ 0.00</b><div class="rb-balance-breakdown"><span>Bill Total: <b id="rbBalanceBillTotal">₹ 0.00</b></span><span class="rb-balance-sep">•</span><span>Collected: <b id="rbBalanceCollected" class="rb-balance-col-val">₹ 0.00</b></span></div></div></aside></div><div class="rb-bill-actions rp-print-actions"><button type="button" class="primary" onclick="rbPrintCurrent()">View PDF</button><button type="button" class="rb-pill-btn" onclick="rbPrintCurrent(\'detailed\')">A4 Detailed</button><button type="button" class="rb-pill-btn" onclick="rbPrintCurrent(\'compact-a5-p\')">A5 Slip</button><button type="button" class="rb-pill-btn" onclick="rbPrintCurrent(\'thermal-80\')">80mm POS</button><button type="button" class="rb-pill-btn" onclick="rbPrintCurrent(\'thermal-58\')">58mm POS</button><button type="submit" name="action" value="save" class="primary">Save bill</button><button type="submit" name="action" value="print">Save & Print</button></div>'
    +gst+'<div id="oldGoldPanel" class="retail-modal-backdrop hidden" aria-hidden="true"><section class="retail-modal" role="dialog" aria-modal="true" aria-labelledby="oldGoldTitle"><div class="retail-modal-head"><div><h2 id="oldGoldTitle">Old Gold Exchange</h2><p>Testing purity is entered manually from 1 to 100, including decimals.</p></div><button type="button" onclick="toggleOldGold(false)">Close</button></div><div class="retail-modal-scroll"><button type="button" onclick="addExchangeLine()">＋ Add item</button><div id="oldGoldLines">'+exchange.map(exchangeLineMarkup).join('')+'</div><div class="exchange-total">Old gold credit <b id="exchangeAmountTotal">₹ 0.00</b></div><p class="hint">Pure gold: <b id="exchangePureTotal">0.000 g</b></p></div><div class="retail-modal-actions"><button type="button" class="primary" onclick="toggleOldGold(false)">Done</button></div></section></div>'
    +rbModal('rbChitPanel','Chit Info',rbChitModalMarkup(sale?.partyId||'',sale))
    +rbModal('rbCollectionsPanel','Collections','<p class="hint">Enter each amount received. Cheque and digital references can be recorded separately.</p><div id="rbCollections">'+collections.map(rbCollectionRow).join('')+'</div><button type="button" onclick="rbAddCollection()">＋ Add collection method</button><div class="exchange-total">Total collected <b id="rbCollectionsTotal">₹ 0.00</b></div>')
    +rbModal('rbAdvancesPanel','Apply customer advances',rbAdvanceMarkup(sale))+'</form>'+rbSalesHistorySection()+'</div>';
}
window.rbRecalc=function(form){if(!form?.dataset.retailBill)return;const t=rbFormTotals(form),set=(id,value)=>{const el=form.querySelector('#'+id);if(el)el.textContent=value;},money=(id,value)=>set(id,rateMoney(value));form.querySelectorAll('.rb-item').forEach((row,i)=>{for(const key of ['netWeight','subtotal']){const out=row.querySelector('[data-out="'+key+'"]');if(out)out.textContent=key==='subtotal'?rateMoney(t.rows[i][key]):fmt(t.rows[i][key]);}});for(const [id,key] of Object.entries({saleGoldAmount:'goldAmount',saleWastageAmount:'wastageAmount',saleMakingAmount:'makingTotal',saleSubtotal:'subtotal',rbDiscountAmount:'discount',rbGSTAmount:'gstAmount',saleAfterDiscount:'saleAmount',saleExchangeAmount:'exchangeAmount',rbMetalCredit:'metalCredit',rbChitAmount:'chitAmount',rbRoundAmount:'roundOff',rbNetPayable:'amount',rbCashAdvance:'cashAdvance',saleCollectedAmount:'collectedAmount',rbCollectedBadge:'collectedAmount',rbCollectionsTotal:'collectedAmount',rbExchangeBadge:'exchangeAmount',exchangeAmountTotal:'exchangeAmount'}))money(id,t[key]);const dirAmtEl=form.querySelector('#rbDirectAmount'),totAmtEl=form.querySelector('#rbTotalCollectedInput'),colRows=form.querySelectorAll('#rbCollections .rb-collection-row');if(colRows.length<=1){if(dirAmtEl&&document.activeElement!==dirAmtEl)dirAmtEl.value=t.collectedAmount>0?t.collectedAmount:'';if(totAmtEl&&document.activeElement!==totAmtEl)totAmtEl.value=t.collectedAmount>0?t.collectedAmount:'';}money('rbStoneAmount',t.stoneAmount+t.otherAmount);money('rbAdvanceBadge',t.cashAdvance+t.metalCredit);money('rbDirectTotalDisplay',t.collectedAmount);money('rbBalanceBillTotal',t.amount);money('rbBalanceCollected',t.collectedAmount);money('saleBalanceAmount',Math.abs(t.balance));set('rbChitBadge',t.chitMappingId?(t.chitNumber+' · −'+rateMoney(t.chitAmount)+(t.chitUsedWeight>0?' · '+fmt(t.chitUsedWeight)+'g':'')):'Select');const chitBenRow=form.querySelector('#rbChitBenefitRow');if(chitBenRow){const ben=n(t.chitTotalBenefit);chitBenRow.classList.toggle('hidden',!(t.chitUsedWeight>0||ben!==0));chitBenRow.style.color=ben<0?'#b45309':'#047857';chitBenRow.style.background=ben<0?'#fffbeb':'#f0fdf4';set('rbChitBenefitLabel',t.chitUsedWeight>0?(ben<0?'Chit wt '+fmt(t.chitUsedWeight)+'g & waivers (rate < avg)':'Chit wt '+fmt(t.chitUsedWeight)+'g & waivers'):'Chit waivers & bonus');set('rbChitBenefitVal',ben<0?'− '+rateMoney(Math.abs(ben)):rateMoney(ben));}if(typeof window.rcUpdateChitLiveBox==='function')window.rcUpdateChitLiveBox(form,t,'bill');set('saleBalanceLabel',t.balance<0?'Customer credit':t.balance===0?'✓ Balance settled':'Balance to collect');const balSub=form.querySelector('.rb-balance-sub');if(balSub)balSub.textContent=t.balance<0?'Refund / advance excess':t.balance===0?'All dues settled':'Net balance to collect';const balBox=form.querySelector('.rb-balance');if(balBox){balBox.classList.remove('rb-balance-paid','rb-balance-due','rb-balance-credit');if(t.balance===0)balBox.classList.add('rb-balance-paid');else if(t.balance>0)balBox.classList.add('rb-balance-due');else balBox.classList.add('rb-balance-credit');}set('rbItemCount',t.rows.length+' item(s)');set('rbTotalPieces',t.pieces);set('rbGrossWeight',fmt(t.grossWeight));set('rbNetWeight',fmt(t.weight));money('rbItemsValue',t.subtotal);set('exchangePureTotal',fmt(t.exchange.reduce((s,x)=>s+x.pureGrams,0))+' g');money('retailTaxableValue',t.taxableValue);money('retailGSTAmount',t.gstAmount);set('retailGSTSplit',t.gstMode==='igst'?'IGST '+rateMoney(t.igst):'CGST '+rateMoney(t.cgst)+' + SGST '+rateMoney(t.sgst));form.querySelector('.retail-gst-options')?.classList.toggle('hidden',!t.gstEnabled);form.elements.amount.value=t.amount.toFixed(2);erpSyncGSTButton(form);};

function rbValidateBill(form,t,forSave=true){
  const f=form.elements,id=f.id.value,customer=f.partyId.value;if(!account(customer,'customer'))return 'Select a registered customer.';
  if(!t.rows.length)return 'Add at least one jewellery item.';
  for(let i=0;i<t.rows.length;i++){const x=t.rows[i];if(!x.product||x.grossWeight<=0||x.lessWeight<0||x.netWeight<=0||x.purity<=0||x.purity>100||!Number.isInteger(x.pieces)||x.pieces<1||x.rate<=0||x.wastage<0||x.makingRate<0||n(x.stoneWeight)<0||n(x.stoneRate)<0||n(x.certificateCharge)<0||x.otherAmount<0)return 'Check product, weight, purity, pieces and charges in item '+(i+1)+'.';}
  if(n(f.discountValue.value)<0||t.discount>t.subtotal+.001)return 'Discount cannot exceed the amount before discount.';
  if(t.gstEnabled&&(t.gstRate<=0||t.gstRate>100))return 'Enter a GST percentage above 0 and up to 100, or remove GST.';
  for(const x of t.exchange)if(!x.product||!x.purity||x.weight<=0||x.testingPurity<1||x.testingPurity>100||x.rate<=0)return 'Complete each old gold item. Testing purity must be from 1 to 100.';
  if(t.chitMappingId){const m=rcDocs('retail-chit-mapping').find(x=>x.id===t.chitMappingId);if(!m||m.customerId!==customer)return 'Selected chit passbook does not belong to this customer.';if((m.status||'Active')==='Closed'&&m.settledBySaleId!==id)return 'Chit passbook '+m.chitNumber+' is already closed/redeemed.';if(t.chitBonus<0||t.chitDeduction<0)return 'Chit bonus and deduction cannot be negative.';}
  if(t.collections.some(x=>x.amount<0||!RB_METHODS.includes(x.method)))return 'Check each collection amount and method.';
  for(const a of t.advanceAllocations){const p=db.payments.find(x=>x.id===a.paymentId&&x.partyId===customer&&x.retailKind==='advance');if(!p||a.amount<0||a.amount>rbRound(n(p.amount)-rbCashUsed(p.id,id))+.001)return 'An amount advance exceeds the available customer credit. Reopen Apply advances.';}
  for(const a of t.metalAllocations){const p=db.payments.find(x=>x.id===a.paymentId&&x.partyId===customer&&x.retailKind==='metal');if(!p||a.pureGrams<0||a.rate<=0||a.pureGrams>rbGrams(n(p.pureGrams)-rbMetalUsed(p.id,id))+.0001)return 'A metal advance exceeds the available pure weight, or its agreed rate is missing.';}
  if(t.cashAdvance>Math.max(0,t.amount)+.001||t.collectedAmount>Math.max(0,rbRound(t.amount-t.cashAdvance))+.001)return 'Advance applied plus collection cannot exceed the bill payable.';
  if(forSave&&id&&db.payments.some(x=>x.invoiceId===id&&x.retailKind==='return'))return 'This bill has a sales return. Its financial entries are locked; review the linked return instead.';
  const linked=id?db.payments.filter(x=>x.invoiceId===id&&x.retailKind==='receipt'):[];if(linked.some(x=>x.partyId!==customer))return 'A linked receipt belongs to the original customer. Keep that customer on this bill.';
  if(linked.reduce((s,x)=>s+n(x.amount),0)>Math.max(0,t.balance)+.001)return 'The revised bill is below its linked receipts. Adjust those receipts first.';
  if(f.documentNo.value.trim()&&rbCustomerSales().some(x=>x.id!==id&&x.documentNo?.toLowerCase()===f.documentNo.value.trim().toLowerCase()))return 'This bill number is already in use.';
  return '';
}
function rbBuildSale(form,t,photo){const f=form.elements,id=f.id.value,old=rbCustomerSales().find(x=>x.id===id),primary=t.rows[0],products=[...new Set(t.rows.map(x=>x.product))],now=new Date().toISOString();return Object.assign({},old||{},{id:id||crypto.randomUUID(),accountType:'customer',partyId:f.partyId.value,when:f.when.value,documentNo:f.documentNo.value.trim()||'S-'+Date.now().toString(36).toUpperCase(),deliveryId:f.deliveryId.value,salesType:f.salesType.value,counter:f.counter.value.trim(),salesperson:f.salesperson.value.trim(),placeOfSupply:f.placeOfSupply.value.trim(),reference:f.reference.value.trim(),notes:f.notes.value.trim(),chitMappingId:t.chitMappingId||f.chitMappingId?.value||'',chitNumber:t.chitNumber||rcDocs('retail-chit-mapping').find(m=>m.id===f.chitMappingId?.value)?.chitNumber||'',chitPaid:t.chitPaid,chitBonus:t.chitBonus,chitDeduction:t.chitDeduction,chitAmount:t.chitAmount,considerChitWeight:t.considerChitWeight,chitMetalWeight:t.chitMetalWeight,chitUsedWeight:t.chitUsedWeight,chitPrincipalUsed:t.chitPrincipalUsed,chitRateBenefit:t.chitRateBenefit,chitWastageDiscount:t.chitWastageDiscount,chitMakingDiscount:t.chitMakingDiscount,chitTotalBenefit:t.chitTotalBenefit,product:products.join(' + '),weight:t.weight,grossWeight:t.grossWeight,pieces:t.pieces,purity:t.weight>0?t.pureGold*24/t.weight:primary.purity,purityLabel:[...new Set(t.rows.map(x=>x.purity+'K'))].join(' / '),wastage:primary.wastage,wastageLabel:t.rows.length>1?'Item-wise':primary.wastage+(primary.wastageMode==='grams'?' g':'%'),rate24:primary.rate*24/primary.purity,ratePerGram:primary.rate,makingPerPiece:primary.makingMode==='piece'?primary.makingRate:0,invoiceItems:t.rows,entryVersion:2,discount:t.discount,discountMode:t.discountMode,discountValue:t.discountValue,subtotal:t.subtotal,goldAmount:t.goldAmount,wastageAmount:t.wastageAmount,makingTotal:t.makingTotal,stoneAmount:t.stoneAmount,otherAmount:t.otherAmount,pureGoldGrams:t.pureGold,wastageGrams:t.rows.reduce((s,x)=>s+x.wastageGrams,0),gstEnabled:t.gstEnabled,gstRate:t.gstRate,gstMode:t.gstMode,gstAmount:t.gstAmount,cgst:t.cgst,sgst:t.sgst,igst:t.igst,taxableValue:t.taxableValue,taxTreatment:t.taxTreatment,hsn:f.hsn?.value||'',roundMode:f.roundMode.value,roundOff:t.roundOff,saleBeforeRound:t.saleBeforeRound,saleAmount:t.saleAmount,amount:t.amount,exchangeAmount:t.exchangeAmount,exchangePureGrams:t.exchange.reduce((s,x)=>s+x.pureGrams,0),oldGoldItems:t.exchange.map(({hasEntry,...x})=>x),collections:t.collections,collectedAmount:t.collectedAmount,collectedMethod:t.collections.map(x=>x.method).filter((x,i,a)=>a.indexOf(x)===i).join(' + ')||'Cash',collectedReference:t.collections.map(x=>x.reference?x.method+': '+x.reference:'').filter(Boolean).join(' · '),cashAdvanceAmount:t.cashAdvance,advanceAllocations:t.advanceAllocations,metalAdvanceAmount:t.metalCredit,metalAdvanceRate:n(f.metalAdvanceRate?.value),metalAllocations:t.metalAllocations,photo:photo??old?.photo??'',createdAt:old?.createdAt||now,updatedAt:now});}
const rbPreviousSaveSale=window.saveSale;
window.saveSale=async function(event){if(!event.target?.dataset.retailBill)return rbPreviousSaveSale(event);event.preventDefault();const form=event.target;if(rbSaving||!form.reportValidity())return;const t=rbFormTotals(form),error=rbValidateBill(form,t);if(error)return say(error);if(form.elements.id.value&&!confirm('Save changes to this sales bill?'))return;rbSaving=true;try{const file=form.elements.photo?.files?.[0];let photo;if(file){if(file.size>4*1024*1024)return say('Choose a product photo below 4 MB.');photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}const oldSale=rbCustomerSales().find(x=>x.id===form.elements.id.value),sale=rbBuildSale(form,t,photo),index=db.sales.findIndex(x=>x.id===sale.id);if(index<0)db.sales.push(sale);else db.sales[index]=sale;const today=String(sale.when||'').slice(0,10)||new Date().toISOString().slice(0,10);if(oldSale?.chitMappingId&&oldSale.chitMappingId!==sale.chitMappingId){const prevMapIdx=(db.retailDocuments||[]).findIndex(x=>x.kind==='retail-chit-mapping'&&x.id===oldSale.chitMappingId&&x.settledBySaleId===sale.id);if(prevMapIdx>=0){const pm=db.retailDocuments[prevMapIdx];db.retailDocuments[prevMapIdx]=Object.assign({},pm,{status:'Active',settledAt:'',settledBySaleId:'',settledBillNo:'',settleMethod:'',updatedAt:new Date().toISOString()});db.retailDocuments=db.retailDocuments.filter(x=>!(x.kind==='retail-chit-entry'&&x.entryType==='Closure'&&x.mappingId===pm.id&&x.settledBySaleId===sale.id));}}if(sale.chitMappingId){const mIdx=(db.retailDocuments||[]).findIndex(x=>x.kind==='retail-chit-mapping'&&x.id===sale.chitMappingId);if(mIdx>=0){const m=db.retailDocuments[mIdx];db.retailDocuments[mIdx]=Object.assign({},m,{status:'Closed',settledAt:today,settledBySaleId:sale.id,settledBillNo:sale.documentNo,settleMethod:'sale_bill',settleAmount:sale.chitAmount,settleWeight:sale.chitUsedWeight,updatedAt:new Date().toISOString()});const cIdx=db.retailDocuments.findIndex(x=>x.kind==='retail-chit-entry'&&x.entryType==='Closure'&&x.mappingId===m.id&&x.settledBySaleId===sale.id);const closureRow={id:cIdx>=0?db.retailDocuments[cIdx].id:crypto.randomUUID(),kind:'retail-chit-entry',accountType:'customer',customerId:sale.partyId,mappingId:m.id,when:today,entryType:'Closure',installmentNo:999,amount:sale.chitAmount,goldRate:0,metalWeight:sale.chitUsedWeight||0,method:'Sales Bill Redemption',reference:'BILL-'+sale.documentNo,settledBySaleId:sale.id,remarks:'Redeemed in Sales Bill '+sale.documentNo+(sale.chitUsedWeight>0?' ('+fmt(sale.chitUsedWeight)+' g adjusted)':''),createdAt:cIdx>=0?db.retailDocuments[cIdx].createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};if(cIdx>=0)db.retailDocuments[cIdx]=closureRow;else db.retailDocuments.push(closureRow);}}const print=event.submitter?.value==='print';edit=null;save();render();say('Sales bill saved. Ledger and cloud sync are updated.');if(print)rbPrintSaved(sale.id,null,{directPrint:true});}catch(error){say('Could not save this bill: '+error.message);}finally{rbSaving=false;}};

function rbInvoiceOptions(customer,id='',empty='Customer account · no bill link'){return '<option value="">'+empty+'</option>'+rbCustomerSales(customer).map(x=>'<option value="'+x.id+'" '+(x.id===id?'selected':'')+'>'+esc((x.documentNo||x.id.slice(0,8))+' · '+x.product)+' · '+rateMoney(rbInvoiceBalance(x))+'</option>').join('');}
function rbReturnLimit(invoice,itemId,exclude=''){const item=rbInvoiceItems(invoice).find(x=>x.id===itemId);if(!item)return {weight:0,amount:0,pieces:0};const returns=rbRecords('return',invoice.partyId).filter(x=>x.invoiceId===invoice.id&&x.sourceItemId===itemId&&x.id!==exclude),subtotal=n(invoice.subtotal)||rbInvoiceItems(invoice).reduce((s,x)=>s+x.subtotal,0),lineValue=subtotal>0?(n(invoice.saleBeforeRound)||n(invoice.saleAmount)-n(invoice.roundOff))*item.subtotal/subtotal:0;return {weight:rbGrams(item.netWeight-returns.reduce((s,x)=>s+n(x.returnWeight),0)),amount:rbRound(lineValue-returns.reduce((s,x)=>s+n(x.amount),0)),pieces:item.pieces-returns.reduce((s,x)=>s+n(x.returnPieces),0),item,lineValue};}
function rbRecordView(){
  const kind={'Sales Return':'return','Receipt':'receipt','Advance Amount':'advance','Metal Weight Advance':'metal'}[rbSection],record=db.payments.find(x=>x.id===edit&&ownerType(x)==='customer'),ret=kind==='return',metal=kind==='metal',title=rbSection,x=record||{},customer=x.partyId||'';
  const fields=rbInput('Entry number · optional','documentNo',x.documentNo||'')+rbInput('Date & time *','when',x.when||rbNow(),'datetime-local','required')+'<label class="rb-field"><span>Customer *</span><select name="partyId" required onchange="rbRecordCustomer(this.form)">'+rbCustomerOptions(customer)+'</select></label>'+(ret||kind==='receipt'?'<label class="rb-field"><span>'+(ret?'Original sales bill *':'Apply receipt to bill · optional')+'</span><select name="invoiceId" '+(ret?'required':'')+' onchange="rbReturnItems(this.form)">'+rbInvoiceOptions(customer,x.invoiceId,ret?'Select original bill':'Customer account · no bill link')+'</select></label>':'');
  let entry='';if(ret){const sale=rbCustomerSales().find(s=>s.id===x.invoiceId);entry='<label class="rb-field rb-wide"><span>Original jewellery item *</span><select name="sourceItemId" required onchange="rbReturnCalc(this.form,true)">'+(sale?rbInvoiceItems(sale).map(i=>'<option value="'+i.id+'" '+(i.id===x.sourceItemId?'selected':'')+'>'+esc(i.product)+' · '+fmt(i.netWeight)+' g</option>').join(''):'<option value="">Select a bill first</option>')+'</select></label>'+rbInput('Return net weight · g *','returnWeight',x.returnWeight||'','number','required min=".001" step=".001" oninput="rbReturnCalc(this.form,true)"')+rbInput('Pieces returned','returnPieces',x.returnPieces||0,'number','min="0" step="1"')+rbInput('Return credit · ₹ *','amount',x.amount||'','number','required min=".01" step=".01"')+'<p id="rbReturnLimit" class="hint rb-wide"></p>'+rbInput('Reason','reason',x.reason||'');}
  else if(metal)entry=rbInput('Product / description *','product',x.product||'','text','required')+rbInput('Gross weight · g *','weight',x.weight||'','number','required min=".001" step=".001" oninput="rbMetalCalc(this.form)"')+rbInput('Less / stone weight · g','lessWeight',x.lessWeight||0,'number','min="0" step=".001" oninput="rbMetalCalc(this.form)"')+rbInput('Testing purity · % *','purity',x.purity||'','number','required min="1" max="100" step="any" oninput="rbMetalCalc(this.form)"')+'<div class="rb-info rb-wide" id="rbMetalValue">Net weight — · Pure weight —</div><p class="hint rb-wide">The advance is stored as pure grams. Its rupee credit is calculated once, when applied to a sales bill.</p>';
  else entry=rbInput('Amount received · ₹ *','amount',x.amount||'','number','required min=".01" step=".01"')+'<label class="rb-field"><span>Payment method</span><select name="method">'+rbOptions(RB_METHODS,x.method||x.kind||'Cash')+'</select></label>'+rbInput('Cheque / bank / UPI reference','reference',x.reference||'');
  const rows=rbRecords(kind).sort(whenCmp).map(p=>[p.documentNo||p.id.slice(0,8),whenShow(p),esc(accountName(p.partyId,'customer')),ret?esc(p.product||''):metal?fmt(p.pureGrams)+' pure g':esc(p.method||p.kind),metal?fmt(Math.max(0,n(p.pureGrams)-rbMetalUsed(p.id)))+' g available':rateMoney(p.amount),'<button type="button" onclick="rbEdit(\''+p.id+'\',\''+title+'\')">Edit</button> <button type="button" onclick="rbPrintRecord(\''+p.id+'\')">PDF</button>']);
  return '<div class="retail-sale-screen rb-screen rb-record-screen">'+rbHeader(title)+'<div class="rb-record-columns"><section class="panel"><div class="rb-section-head"><h2>'+(record?'Edit entry':'New entry')+'</h2><span class="erp-period-tag">'+(metal?'Pure grams':'Rupees')+'</span></div><form id="rbRecordForm" data-kind="'+kind+'" onsubmit="rbSaveRecord(event)"><input name="id" type="hidden" value="'+esc(x.id||'')+'"><div class="rb-record-grid">'+fields+entry+rbInput('Notes','notes',x.notes||'')+'</div><div class="right"><button class="primary">Save '+title.toLowerCase()+'</button></div></form></section><section class="panel rb-record-history"><div class="rb-section-head"><h2>Saved '+title.toLowerCase()+' entries</h2><button type="button" onclick="rbPrintRecordList(\''+kind+'\')">View PDF</button></div>'+(rows.length?table(['Entry','Date','Customer',ret?'Product':metal?'Pure weight':'Method',metal?'Available':'Amount','Actions'],rows):'<div class="empty">No entries yet.</div>')+'</section></div></div>';
}
window.rbRecordCustomer=function(form){const select=form.elements.invoiceId;if(select){select.innerHTML=rbInvoiceOptions(form.elements.partyId.value,'',form.dataset.kind==='return'?'Select original bill':'Customer account · no bill link');rbReturnItems(form);}};
window.rbReturnItems=function(form){if(form.dataset.kind!=='return')return;const sale=rbCustomerSales().find(x=>x.id===form.elements.invoiceId.value);form.elements.sourceItemId.innerHTML=sale?rbInvoiceItems(sale).map(x=>'<option value="'+x.id+'">'+esc(x.product)+' · '+fmt(x.netWeight)+' g</option>').join(''):'<option value="">Select a bill first</option>';form.elements.returnWeight.value='';form.elements.amount.value='';rbReturnCalc(form,false);};
window.rbReturnCalc=function(form,fill=false){if(form.dataset.kind!=='return')return;const sale=rbCustomerSales().find(x=>x.id===form.elements.invoiceId.value);if(!sale)return;const limit=rbReturnLimit(sale,form.elements.sourceItemId.value,form.elements.id.value),weight=n(form.elements.returnWeight.value),max=limit.item?rbRound(limit.lineValue*weight/limit.item.netWeight):0,node=form.querySelector('#rbReturnLimit');if(node)node.textContent='Available to return: '+fmt(limit.weight)+' g · Remaining original value '+rateMoney(limit.amount);if(fill)form.elements.amount.value=Math.min(limit.amount,max).toFixed(2);};
window.rbMetalCalc=function(form){const f=form.elements,net=rbGrams(n(f.weight.value)-n(f.lessWeight.value)),pure=rbGrams(net*n(f.purity.value)/100),node=form.querySelector('#rbMetalValue');if(node)node.textContent='Net weight '+fmt(net)+' g · Pure weight '+fmt(pure)+' g';};
window.rbSaveRecord=function(event){event.preventDefault();const form=event.target,f=new FormData(form),kind=form.dataset.kind,id=String(f.get('id')||''),old=db.payments.find(x=>x.id===id),partyId=f.get('partyId'),now=new Date().toISOString();if(!account(partyId,'customer'))return say('Select a registered customer.');let item=Object.assign({},old||{},{id:id||crypto.randomUUID(),accountType:'customer',retailKind:kind,partyId,when:f.get('when'),documentNo:String(f.get('documentNo')||'').trim()||kind.toUpperCase()+'-'+Date.now().toString(36).toUpperCase(),notes:String(f.get('notes')||''),createdAt:old?.createdAt||now,updatedAt:now});
  if(kind==='metal'){const weight=n(f.get('weight')),lessWeight=n(f.get('lessWeight')),purity=n(f.get('purity')),net=rbGrams(weight-lessWeight),pureGrams=rbGrams(net*purity/100);if(weight<=0||lessWeight<0||net<=0||purity<1||purity>100)return say('Check gross/less weight and manual testing purity from 1 to 100.');if(id&&(pureGrams+0.0001<rbMetalUsed(id)||old.partyId!==partyId&&rbMetalUsed(id)>0))return say('This metal advance is already applied. Keep its customer and at least the used pure weight.');Object.assign(item,{kind:'Metal weight advance',amount:0,weight,lessWeight,netWeight:net,purity,pureGrams,product:String(f.get('product')||'').trim()});}
  else if(kind==='return'){const invoiceId=f.get('invoiceId'),sale=rbCustomerSales(partyId).find(x=>x.id===invoiceId),sourceItemId=f.get('sourceItemId');if(!sale)return say('Select the customer’s original sales bill.');const limit=rbReturnLimit(sale,sourceItemId,id),returnWeight=n(f.get('returnWeight')),returnPieces=n(f.get('returnPieces')),amount=n(f.get('amount')),max=limit.item?rbRound(limit.lineValue*returnWeight/limit.item.netWeight):0;if(!limit.item||returnWeight<=0||returnWeight>limit.weight+.0001||returnPieces<0||!Number.isInteger(returnPieces)||returnPieces>limit.pieces||amount<=0||amount>limit.amount+.01||amount>max+.01)return say('Return weight, pieces or credit exceeds the remaining original item value.');Object.assign(item,{kind:'Sales return',method:'Account credit',invoiceId,sourceItemId,product:limit.item.product,returnWeight,returnPieces,amount:rbRound(amount),reason:String(f.get('reason')||''),reference:sale.documentNo||sale.id});}
  else{const amount=n(f.get('amount')),method=String(f.get('method')||'Cash'),invoiceId=kind==='receipt'?String(f.get('invoiceId')||''):'';if(amount<=0||!RB_METHODS.includes(method))return say('Enter a valid amount and payment method.');if(kind==='advance'&&id&&(amount+.001<rbCashUsed(id)||old.partyId!==partyId&&rbCashUsed(id)>0))return say('This advance is already applied. Keep its customer and at least the used amount.');if(invoiceId){const sale=rbCustomerSales(partyId).find(x=>x.id===invoiceId),available=sale?rbInvoiceBalance(sale)+(old?.invoiceId===invoiceId?n(old.amount):0):0;if(!sale||amount>Math.max(0,available)+.001)return say('Receipt exceeds this bill’s remaining balance. Leave the bill link blank to record account credit.');}Object.assign(item,{kind:kind==='advance'?'Amount advance':'Receipt',method,amount:rbRound(amount),invoiceId,reference:String(f.get('reference')||'').trim()});}
  if(id&&!confirm('Save changes to this '+kind+' entry?'))return;const index=db.payments.findIndex(x=>x.id===item.id);if(index<0)db.payments.push(item);else db.payments[index]=item;edit=null;save();render();say(rbSection+' saved.');};

function rbBuildChitPdfData(doc,items=[]){
  const mappingId=doc?.chitMappingId||'';
  const hasChit=!!(mappingId||doc?.chitNumber||n(doc?.chitAmount)>0||n(doc?.chitUsedWeight)>0||n(doc?.chitTotalBenefit)!==0);
  if(!hasChit)return null;
  const cs=(mappingId&&typeof window.rcChitSummary==='function')?window.rcChitSummary(mappingId,{considerChitWeight:doc?.considerChitWeight,bonus:doc?.chitBonus,deduction:doc?.chitDeduction}):null;
  const paid=rbRound(n(doc?.chitPaid??cs?.paid));
  const bonus=rbRound(n(doc?.chitBonus??cs?.bonus));
  const deduction=rbRound(n(doc?.chitDeduction??cs?.deduction));
  const amount=rbRound(n(doc?.chitAmount??Math.max(0,paid+bonus-deduction)));
  const accumWeight=rbGrams(n(doc?.chitMetalWeight??cs?.metalWeight));
  const usedWeight=rbGrams(n(doc?.chitUsedWeight));
  const avgRate=cs?.avgRate>0?cs.avgRate:(accumWeight>0&&paid>0?rbRound(paid/accumWeight):0);
  const itemRows=(items||[]).filter(x=>n(x.chitWeight)>0||n(x.chitCoveredWeight)>0||n(x.chitRateBenefit)!==0||n(x.wastageDiscountAmount)>0||n(x.makingDiscountAmount)>0).map(x=>({
    product:x.product||'Gold item',
    rate:n(x.rate),
    netWeight:n(x.netWeight??x.weight),
    chitWeight:n(x.chitWeight),
    coveredWeight:n(x.chitCoveredWeight),
    nonChitWeight:n(x.nonChitWeight??Math.max(0,n(x.netWeight??x.weight)-n(x.chitWeight))),
    chitPaidAmount:n(x.chitPaidAmount),
    rateBenefit:n(x.chitRateBenefit),
    wastageDiscountGrams:n(x.wastageDiscountGrams),
    wastageDiscountAmount:n(x.wastageDiscountAmount),
    makingDiscountAmount:n(x.makingDiscountAmount),
    subtotal:n(x.subtotal)
  }));
  return {
    mappingId,
    passbook:doc?.chitNumber||cs?.chitNumber||'',
    schemeName:cs?.typeName||'',
    scheme:cs?.scheme||'',
    mode:cs?.mode||(accumWeight>0?'Weight':'Amount'),
    ornamentType:doc?.chitOrnamentType||cs?.ornamentType||'Gold',
    duesText:cs?(cs.duesPaid+'/'+cs.totalDues):'',
    status:cs?.status||doc?.chitStatus||'',
    considerChitWeight:!!(doc?.considerChitWeight??cs?.considerChitWeight),
    accumWeight,
    usedWeight,
    principalUsed:rbRound(n(doc?.chitPrincipalUsed||(accumWeight>0&&usedWeight>0?paid*Math.min(1,usedWeight/accumWeight):0))),
    avgRate,
    paid,
    bonus,
    deduction,
    amount,
    rateBenefit:rbRound(n(doc?.chitRateBenefit)),
    wastageDiscount:rbRound(n(doc?.chitWastageDiscount)),
    makingDiscount:rbRound(n(doc?.chitMakingDiscount)),
    totalBenefit:rbRound(n(doc?.chitTotalBenefit)),
    wastageBenefitPercent:n(cs?.wastageBenefitPercent),
    mcBenefitRate:n(cs?.mcBenefitRate),
    noMakingCharge:!!cs?.noMakingCharge,
    items:itemRows
  };
}
window.rbBuildChitPdfData=rbBuildChitPdfData;
function rbBillModel(sale){
  const customer=account(sale.partyId,'customer')||{},items=(sale.invoiceItems?.length?sale.invoiceItems.map(x=>{const calc=rbItemCalc(x);return (n(sale.chitAmount)>0||n(sale.chitUsedWeight)>0||n(x.chitWeight)>0||n(x.wastageDiscountAmount)>0||n(x.makingDiscountAmount)>0)?Object.assign(calc,{goldAmount:n(x.goldAmount??calc.goldAmount),wastageGrams:n(x.wastageGrams??calc.wastageGrams),wastageAmount:n(x.wastageAmount??calc.wastageAmount),makingTotal:n(x.makingTotal??calc.makingTotal),subtotal:n(x.subtotal??calc.subtotal),chitWeight:n(x.chitWeight),chitCoveredWeight:n(x.chitCoveredWeight),nonChitWeight:x.nonChitWeight!==undefined?n(x.nonChitWeight):rbGrams(Math.max(0,calc.netWeight-n(x.chitWeight))),chitPaidAmount:n(x.chitPaidAmount),chitRateBenefit:n(x.chitRateBenefit),wastageDiscountGrams:n(x.wastageDiscountGrams),wastageDiscountAmount:n(x.wastageDiscountAmount),makingDiscountAmount:n(x.makingDiscountAmount)}):calc;}):rbInvoiceItems(sale)),balance=rbInvoiceBalance(sale),delivery=account(sale.deliveryId,'customer'),totals=[['Gold value',rateMoney(sale.goldAmount)],['Wastage',rateMoney(sale.wastageAmount)],['Making charges',rateMoney(sale.makingTotal)],['Stone / other item charges',rateMoney(n(sale.stoneAmount)+n(sale.otherAmount))],['Discount','− '+rateMoney(sale.discount)],['Taxable value',rateMoney(sale.taxableValue??(n(sale.saleAmount)-n(sale.gstAmount)))]];
  if(sale.gstEnabled){if(sale.gstMode==='igst')totals.push(['IGST '+n(sale.gstRate)+'%',rateMoney(sale.igst)]);else totals.push(['CGST '+n(sale.gstRate)/2+'%',rateMoney(sale.cgst)],['SGST '+n(sale.gstRate)/2+'%',rateMoney(sale.sgst)]);}
  totals.push(['New jewellery sale',rateMoney(sale.saleBeforeRound??sale.saleAmount)],['Old gold exchange','− '+rateMoney(sale.exchangeAmount)],['Metal advance applied','− '+rateMoney(sale.metalAdvanceAmount)]);
  if(n(sale.chitAmount)>0||sale.chitMappingId||sale.chitNumber)totals.push(['Chit deduction'+(sale.chitNumber?' ('+sale.chitNumber+')':''),'− '+rateMoney(sale.chitAmount)]);
  totals.push(['Round off',rateMoney(sale.roundOff)],['Net bill payable',rateMoney(sale.amount)],['Amount advance applied',rateMoney(sale.cashAdvanceAmount)]);
  const collections=sale.collections?.length?sale.collections:sale.collectedAmount?[{method:sale.collectedMethod||'Cash',amount:sale.collectedAmount,reference:sale.collectedReference}]:[];for(const x of collections)totals.push(['Collected · '+x.method+(x.reference?' · '+x.reference:''),rateMoney(x.amount)]);
  for(const p of db.payments.filter(x=>x.invoiceId===sale.id&&['receipt','return'].includes(x.retailKind)))totals.push([p.retailKind==='return'?'Sales return credit':'Later receipt · '+(p.method||p.kind),rateMoney(p.amount)]);
  totals.push([balance<0?'Customer credit':'Balance to collect',rateMoney(Math.abs(balance)),true]);
  const chitPdf=rbBuildChitPdfData(sale,items);
  return {kind:'bill',retail:true,title:'JEWELLERY SALES BILL',entityLabel:'Customer',entityName:customer.name||'Customer',entityDetails:[customer.address,customer.city,customer.phone,delivery?'Delivery: '+delivery.name:'',sale.placeOfSupply?'Place of supply: '+sale.placeOfSupply:'',sale.chitNumber?'Chit Passbook: '+sale.chitNumber:'',n(sale.chitUsedWeight)>0?'Chit Wt Adjusted: '+fmt(sale.chitUsedWeight)+' g':'',n(sale.chitTotalBenefit)>0?'Chit Benefits: '+rateMoney(sale.chitTotalBenefit):(n(sale.chitTotalBenefit)<0?'Chit Rate Diff: −'+rateMoney(Math.abs(sale.chitTotalBenefit)):'')].filter(Boolean).join(' · '),reference:sale.documentNo||sale.id?.slice(0,12)||'DRAFT',date:pdfDateText(sale.when),taxEnabled:!!sale.gstEnabled,invoiceItems:items,exchange:sale.oldGoldItems||[],chit:chitPdf,totals,notes:[sale.reference,sale.notes].filter(Boolean).join(' · ')};
}
const rbPreviousBillMarkup=window.pdfBillMarkup;
window.pdfBillMarkup=function(model,c,template){
  if(typeof rbPreviousBillMarkup==='function'){
    return rbPreviousBillMarkup(model,c,template);
  }
  return '';
};
window.rbPrintSaved=function(id,forcedTemplate=null,options={}){const sale=rbCustomerSales().find(x=>x.id===id);if(sale)pdfPrintModel(rbBillModel(sale),'retail',forcedTemplate,options);};
window.rbPrintCurrent=function(forcedTemplate=null){const form=document.getElementById('customerSaleForm');if(!form?.dataset.retailBill)return;if(!form.reportValidity())return;const totals=rbFormTotals(form),error=rbValidateBill(form,totals,false);if(error)return say(error);const sale=rbBuildSale(form,totals);sale.id=form.elements.id.value;const model=rbBillModel(sale);if(!sale.id)model.reference='DRAFT · '+(sale.documentNo||'unsaved bill');pdfPrintModel(model,'retail',forcedTemplate);};
const rbPreviousPrintCustomer=window.printCustomerSaleBill;
window.printCustomerSaleBill=function(forcedTemplate=null){return document.querySelector('#customerSaleForm[data-retail-bill]')?rbPrintCurrent(forcedTemplate):rbPreviousPrintCustomer();};
function rbRecordModel(rows,title){return {kind:'ledger',retail:true,title:title.toUpperCase(),entityLabel:'Shop',entityName:goldleafContext?.shop_name||'Goldleaf',entityDetails:'Retail customer records',reference:'',date:'All recorded dates',heads:['Date','Entry','Customer','Details','Amount ₹','Pure weight g'],rows:rows.map(x=>[typeof whenShow==='function'?whenShow(x):String(x.when||'').slice(0,16).replace('T',' ')||'—',x.documentNo||x.id.slice(0,8),accountName(x.partyId,'customer'),[x.product,x.method,x.reference,x.notes].filter(Boolean).join(' · '),x.retailKind==='metal'?'—':rateMoney(x.amount),x.retailKind==='metal'?fmt(x.pureGrams):'—']),totals:[['Total recorded amount',rateMoney(rows.reduce((s,x)=>s+n(x.amount),0)),true],['Metal advance pure weight',fmt(rows.filter(x=>x.retailKind==='metal').reduce((s,x)=>s+n(x.pureGrams),0))+' g']]};}
window.rbPrintRecord=function(id){const row=db.payments.find(x=>x.id===id);if(row)pdfPrintModel(rbRecordModel([row],row.kind||'Receipt'),'retail');};
window.rbPrintRecordList=function(kind){const rows=rbRecords(kind);if(!rows.length)return say('No records to print yet.');pdfPrintModel(rbRecordModel(rows,RB_SECTIONS.find(x=>({'Sales Return':'return','Receipt':'receipt','Advance Amount':'advance','Metal Weight Advance':'metal'})[x]===kind)||'Customer records'),'retail');};
function rbSavedSales(){
  return rbCustomerSales().sort((a,b)=>String(b.when||'').localeCompare(String(a.when||''))
    ||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function rbSalesHistoryTable(sales){
  if(!sales.length)return '<div class="empty">No sales bills yet.</div>';
  const rows=sales.map(sale=>{
    const id=esc(sale.id);
    const actions='<div class="rb-history-actions">'
      +'<button type="button" data-bill-id="'+id+'" onclick="rbEdit(this.dataset.billId)">Edit</button>'
      +'<button type="button" data-bill-id="'+id+'" onclick="rbPrintSaved(this.dataset.billId)">PDF</button>'
      +'<button type="button" data-bill-id="'+id+'" onclick="rbPrintSaved(this.dataset.billId,\'thermal-80\')">POS</button></div>';
    return [esc(sale.documentNo||String(sale.id).slice(0,8)),esc(String(sale.when||'').replace('T',' ')),
      esc(accountName(sale.partyId,'customer')),esc(sale.product),fmt(sale.weight)+' g',
      rateMoney(sale.saleAmount??sale.amount),rateMoney(sale.exchangeAmount),
      rateMoney(sale.collectedAmount),rateMoney(rbInvoiceBalance(sale)),actions];
  });
  return table(['Bill','Date','Customer','Products','Net g','Sale ₹','Old gold ₹','Collected ₹','Pending ₹','Actions'],rows);
}
function rbSalesHistorySection(){
  const sales=rbSavedSales();
  const recent=sales.slice(0,10);
  const viewAll=sales.length>recent.length?'<button type="button" onclick="rbShowHistory(true)">View all '+sales.length+' bills</button>':'';
  return '<section id="rbSalesHistory" class="panel rb-sales-history" aria-labelledby="rbSalesHistoryTitle" tabindex="-1">'
    +'<div class="rb-section-head"><h2 id="rbSalesHistoryTitle">Sales history</h2>'+viewAll+'</div>'
    +rbSalesHistoryTable(recent)+'</section>';
}
window.rbShowHistory=function(showAll=false){
  const section=document.getElementById('rbSalesHistory');
  if(section&&!showAll){
    section.scrollIntoView({block:'start'});
    section.focus({preventScroll:true});
    return;
  }
  document.getElementById('rbHistoryPanel')?.remove();
  document.body.insertAdjacentHTML('beforeend',rbModal('rbHistoryPanel','Sales history',rbSalesHistoryTable(rbSavedSales())));
  rbDialog('rbHistoryPanel');
};
const rbPreviousSalesView=window.salesView;
window.salesView=function(){if(workspaceMode!=='retail')return rbPreviousSalesView();return rbSection==='Bill'?rbBillView():rbRecordView();};
const rbPreviousPaymentsView=window.paymentsView;
window.paymentsView=function(){if(workspaceMode!=='retail')return rbPreviousPaymentsView();rbSection='Receipt';return rbRecordView();};
const rbPreviousCalc=window.calcSale;
window.calcSale=function(form){return form?.dataset.retailBill?rbRecalc(form):rbPreviousCalc(form);};
const rbPreviousAccountSync=window.syncSaleAccount;
window.syncSaleAccount=function(form){if(!form?.dataset.retailBill)return rbPreviousAccountSync(form);const customer=account(form.elements.partyId.value,'customer');form.elements.place.value=customer?.city||'';form.querySelector('#rbCustomerCity').textContent=customer?.city||'—';form.querySelector('#rbCustomerPhone').textContent=customer?.phone||'—';const body=form.querySelector('#rbAdvanceBody');if(body)body.outerHTML=rbAdvanceMarkup({partyId:customer?.id,id:form.elements.id.value});const chitBody=form.querySelector('#rbChitPanel .retail-modal-scroll');if(chitBody){chitBody.innerHTML=rbChitModalMarkup(customer?.id,null);}rbMarkDirty(form);rbRecalc(form);};
const rbPreviousFit=window.fitRetailSaleScreen;
window.fitRetailSaleScreen=function(){if(document.querySelector('.rb-screen'))return;return rbPreviousFit();};
const rbPreviousTx=window.tx;
window.tx=function(id,type='party'){const rows=rbPreviousTx(id,type);if(type!=='customer')return rows;return rows.map(row=>{const original=db.payments.find(x=>x.id===row.id);if(original?.retailKind)return Object.assign({},row,{kind:original.kind,method:original.method||original.kind,desc:original.kind+' · '+(original.product||original.method||'')+(original.reference?' · '+original.reference:'')});return row;});};
const rbPreviousRender=window.render;
window.render=function(){const result=rbPreviousRender(),active=!!document.querySelector('.rb-screen');document.body.classList.toggle('rb-active',active);if(active){const f=document.getElementById('customerSaleForm');if(f?.dataset.retailBill)rbRecalc(f);const record=document.getElementById('rbRecordForm');if(record?.dataset.kind==='metal')rbMetalCalc(record);if(record?.dataset.kind==='return')rbReturnCalc(record);}return result;};
const rbHistory=window.updateHistoryView;
window.updateHistoryView=function(){return rbHistory().replace('Goldleaf v2.6.0','Goldleaf v2.7.0').replace('v2.6.0 · 7 Nov 2026 · Current','v2.6.0 · 7 Nov 2026').replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.7.0 · 7 Nov 2026 · Current</h3><ul><li>Added itemised Retail sales bills, sales returns, receipts, amount advances and metal weight advances.</li><li>Added split collections, advance allocation without duplicate credit, manual testing purity, GST treatment, rounding and item details in the selected PDF template.</li><li>Added the Retail Purchase workspace with its seven reference workflows and supplier reports.</li></ul></article>');};
render();

window.rbRemoveCollection=function(button){const form=button.closest('form');button.closest('.rb-collection-row').remove();rbMarkDirty(form);if(form?.dataset.retailBill)rbRecalc(form);else if(form?.getAttribute('id')==='rpDocumentForm')rpRecalc(form);};

const rbAndroidRender=window.render;
window.render=function(){const result=rbAndroidRender();if(window.innerWidth<=760){document.querySelectorAll('input[type=number]').forEach(e=>e.inputMode=e.step==='1'?'numeric':'decimal');}return result;};
function rbMobileViewport(){if(window.innerWidth<=760&&window.visualViewport)document.documentElement.style.setProperty('--gl-mobile-height',window.visualViewport.height+'px');else document.documentElement.style.removeProperty('--gl-mobile-height');}
window.visualViewport?.addEventListener('resize',rbMobileViewport,{passive:true});window.addEventListener('resize',rbMobileViewport,{passive:true});rbMobileViewport();
const rbAndroidHistory=window.updateHistoryView;
window.updateHistoryView=function(){return rbAndroidHistory().replace('Goldleaf v2.7.0','Goldleaf v'+RB_VERSION).replace('v2.7.0 · 7 Nov 2026 · Current','v2.7.0 · 7 Nov 2026').replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.10.42 · 12 Nov 2026</h3><ul><li>Auto-hide header Update button once updated across all screens.</li><li>Added update success celebratory confirmation banner and notifications.</li></ul></article><article class="release-note"><h3>v2.10.41 · 12 Nov 2026</h3><ul><li>Added "The Office Up to Speed" update notification for mobile and desktop app, featuring new version loaded promotion with Update and Not Now controls.</li><li>Automatic update detection with service worker sync and toolbar update pill.</li></ul></article><article class="release-note"><h3>v2.10.40 · 12 Nov 2026</h3><ul><li>Customer Sale Entry bill details and jewellery items redesigned into compact Left &amp; Right cards for mobile comfort.</li><li>Desktop app install enhancements with standalone PWA support.</li></ul></article><article class="release-note"><h3>v2.8.2 · 7 Nov 2026</h3><ul><li>Finalised the manual Retail rate flow and preserved existing silver board rates by default.</li></ul><article class="release-note"><h3>v2.8.1 · 7 Nov 2026</h3><ul><li>Retail Rate Entry follows a dated multi-karat rate flow with manual 24K, 22K, 18K, 14K, silver and diamond rates, AM/PM selection, display and rate history.</li><li>Retail sales use the saved matching 22K, 18K or 14K rate when available.</li></ul><article class="release-note"><h3>v2.8.0 · 7 Nov 2026</h3><ul><li>Retail Sales Entry shows saved bills below the form and lets you add a billing customer without leaving the draft.</li><li>Adjustment buttons wrap at their natural width on phones.</li></ul></article><article class="release-note"><h3>v2.7.3 · 7 Nov 2026</h3><ul><li>Item amounts and actions in Retail sales bills scroll horizontally with their column headings and totals.</li><li>Adjustments and receipts use compact buttons with inline amounts.</li></ul></article><article class="release-note"><h3>v2.7.2 · 7 Nov 2026</h3><ul><li>Retail sales bills scroll from the item list through adjustments, totals and the Save buttons.</li><li>Removed the inline item-details instruction. The item details button still opens the extra fields.</li></ul></article><article class="release-note"><h3>v2.7.1 · 7 Nov 2026</h3><ul><li>Android layouts use simple section selectors, labelled item cards, larger entry controls and decimal number keyboards.</li><li>Mobile popups adapt to available keyboard height; desktop Purchase keeps balance and Save visible.</li></ul></article>');};


window.rbQuickTagKey = function(event, input) {
  if (event.key === 'Enter') {
    event.preventDefault();
    window.rbQuickTagScan(input.value, input);
  }
};
window.rbQuickTagBtnClick = function(btn) {
  const qIn = document.getElementById('rbQuickTagInput');
  window.rbQuickTagScan(qIn ? qIn.value : '', btn);
};
window.rbQuickTagScan = function(code, triggerEl) {
  const raw = String(code || '').trim();
  if (!raw) { say('Enter or scan a tag code or HUID.'); return; }
  const tags = typeof glDocs === 'function' ? glDocs('retail-tagging') : typeof rcDocs === 'function' ? rcDocs('retail-tagging') : (db.retailDocuments || []).filter(d => d.kind === 'retail-tagging');
  const tag = tags.find(t => (t.tagCode && t.tagCode.toLowerCase() === raw.toLowerCase()) || (t.huid && t.huid.toLowerCase() === raw.toLowerCase()));
  if (!tag) {
    say('Tag / HUID "' + raw + '" not found in inventory.');
    return;
  }
  const form = document.getElementById('customerSaleForm');
  if (!form) return;
  const rows = [...form.querySelectorAll('.rb-item')];
  let targetRow = rows.find(r => {
    const p = r.querySelector('[data-item="product"]')?.value;
    const g = n(r.querySelector('[data-item="grossWeight"]')?.value);
    const tc = r.querySelector('[data-item="tagCode"]')?.value;
    return (!tc && (!p || p === db.products[0]) && g === 0);
  });
  if (!targetRow) {
    rbAddItem();
    const updatedRows = [...form.querySelectorAll('.rb-item')];
    targetRow = updatedRows[updatedRows.length - 1];
  }
  if (targetRow) {
    if (typeof window.rbApplyTagData === 'function') {
      window.rbApplyTagData(targetRow, tag);
    } else {
      const tc = targetRow.querySelector('[data-item="tagCode"]'); if (tc) tc.value = tag.tagCode || '';
      const prod = targetRow.querySelector('[data-item="product"]'); if (prod && tag.product) prod.value = tag.product;
      const gw = targetRow.querySelector('[data-item="grossWeight"]'); if (gw) gw.value = tag.grossWeight || 0;
      const lw = targetRow.querySelector('[data-item="lessWeight"]'); if (lw) lw.value = tag.lessWeight || 0;
      const pur = targetRow.querySelector('[data-item="purity"]'); if (pur && tag.purity) pur.value = tag.purity;
      rbMarkDirty(form); rbRecalc(form);
    }
    say('Tag "' + (tag.tagCode || raw) + '" loaded into bill.');
    const qIn = document.getElementById('rbQuickTagInput');
    if (qIn) qIn.value = '';
  }
};
window.rbTagRowChanged = function(input) {
  const raw = String(input?.value || '').trim();
  if (!raw) return;
  const tags = typeof glDocs === 'function' ? glDocs('retail-tagging') : typeof rcDocs === 'function' ? rcDocs('retail-tagging') : (db.retailDocuments || []).filter(d => d.kind === 'retail-tagging');
  const tag = tags.find(t => (t.tagCode && t.tagCode.toLowerCase() === raw.toLowerCase()) || (t.huid && t.huid.toLowerCase() === raw.toLowerCase()));
  if (!tag) {
    say('Tag / HUID "' + raw + '" not found in inventory.');
    return;
  }
  const row = input.closest('.rb-item');
  if (row) {
    if (typeof window.rbApplyTagData === 'function') {
      window.rbApplyTagData(row, tag);
    } else {
      const prod = row.querySelector('[data-item="product"]'); if (prod && tag.product) prod.value = tag.product;
      const gw = row.querySelector('[data-item="grossWeight"]'); if (gw) gw.value = tag.grossWeight || 0;
      const lw = row.querySelector('[data-item="lessWeight"]'); if (lw) lw.value = tag.lessWeight || 0;
      const pur = row.querySelector('[data-item="purity"]'); if (pur && tag.purity) pur.value = tag.purity;
      rbMarkDirty(input.form); rbRecalc(input.form);
    }
    say('Tag "' + (tag.tagCode || raw) + '" loaded.');
  }
};
window.openQrScannerForQuickTag = function() {
  if (typeof window.openQrScanner === 'function') {
    window.openQrScanner({
      title: 'Scan Tag / QR for Sale',
      onScan: code => {
        const qIn = document.getElementById('rbQuickTagInput');
        if (qIn) qIn.value = code;
        window.rbQuickTagScan(code);
      }
    });
  } else {
    say('Camera scanner initializing...');
  }
};
window.openQrScannerForTagRow = function(btn) {
  if (!btn) return;
  const row = btn.closest('.rb-item');
  if (row) {
    const tagIn = row.querySelector('[data-item="tagCode"]');
    if (typeof window.openQrScanner === 'function') {
      window.openQrScanner({
        title: 'Scan Item Tag / QR Code',
        onScan: code => {
          if (tagIn) tagIn.value = code;
          window.rbTagRowChanged(tagIn);
        }
      });
    } else {
      say('Camera scanner initializing...');
    }
    return;
  }
  const field = btn.closest('.rc-scan-wrap')?.querySelector('input');
  if (field && typeof window.openQrScanner === 'function') {
    window.openQrScanner({
      title: 'Scan Item Tag / QR Code',
      onScan: code => {
        field.value = code;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        say('✓ Scanned Tag: ' + code);
      }
    });
  }
};
