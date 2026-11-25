/* Retail stock verification uses the shop's existing tagged inventory. */
const RV_TABS=[['group-list','By Product Group'],['group-create','Product Group Create'],['product-list','By Product'],['product-create','Product Create'],['counter-list','By Counter'],['counter-create','Counter Create'],['rfid-list','RFID Verification'],['rfid-audit','RFID Audit']];
let rvTab='group-list',rvDraft=null,rvSearch='',rvDate='',rvRfidFrom='',rvRfidTo='';
const rvToday=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const rvRows=()=>rcDocs('retail-stock-verification');
const rvTags=()=>rcDocs('retail-tagging').filter(t=>(t.status||'In stock')==='In stock');
const rvNum=x=>Number(x)||0;
const rvWeight=t=>rvNum(t.grossWeight||t.weight);
const rvQty=t=>rvNum(t.pieces)||1;
const rvStats=a=>({tags:a.length,qty:a.reduce((s,t)=>s+rvQty(t),0),weight:a.reduce((s,t)=>s+rvWeight(t),0)});
const rvF=x=>rvNum(x).toFixed(3);
const rvDateText=x=>String(x||'').slice(0,10);
function rvProductGroups(){return [...new Set([...rcDocs('retail-product-group').map(x=>x.name),...rcDocs('retail-product').map(x=>x.group),...rvTags().map(x=>x.group)].filter(Boolean))].sort()}
function rvProducts(group){return [...new Set([...rcDocs('retail-product').filter(x=>!group||x.group===group).map(x=>x.name),...rvTags().filter(x=>!group||x.group===group).map(x=>x.product)].filter(Boolean))].sort()}
function rvCounters(){return [...new Set(rvTags().map(x=>x.counter||x.location).filter(Boolean))].sort()}
function rvOptions(a,selected='',placeholder='Select'){return '<option value="">'+placeholder+'</option>'+a.map(x=>'<option value="'+esc(x)+'" '+(x===selected?'selected':'')+'>'+esc(x)+'</option>').join('')}
function rvScope(row){return Array.isArray(row.stock)?row.stock:rvTags().filter(t=>(row.scope==='group'?t.group===row.group:row.scope==='product'?t.group===row.group&&t.product===row.product:row.scope==='counter'?((t.counter||t.location)===row.counter&&(!row.group||t.group===row.group)&&(!row.product||t.product===row.product)):true))}
function rvSnapshot(row){row.stock=rvTags().filter(t=>(row.scope==='group'?t.group===row.group:row.scope==='product'?t.group===row.group&&t.product===row.product:row.scope==='counter'?((t.counter||t.location)===row.counter&&(!row.group||t.group===row.group)&&(!row.product||t.product===row.product)):true)).map(t=>({id:t.id,tagCode:t.tagCode,rfidUid:t.rfidUid||'',product:t.product,group:t.group,counter:t.counter,location:t.location,huid:t.huid,pieces:rvQty(t),grossWeight:rvWeight(t)}))}
function rvMarked(row){const ids=new Set(row.verifiedIds||[]);return rvScope(row).filter(t=>ids.has(t.id))}
function rvSummary(row){const available=rvScope(row),verified=rvMarked(row),missing=available.filter(t=>!(row.verifiedIds||[]).includes(t.id));return {available:rvStats(available),verified:rvStats(verified),missing:rvStats(missing),invalid:(row.invalidCodes||[]).length,scanned:(row.scans||[]).length}}
function rvCard(label,x){return '<div class="rv-stat"><small>'+label+'</small><b>'+x.tags+' tags · '+x.qty+' pcs</b><span>'+rvF(x.weight)+' g</span></div>'}
function rvTop(){return '<section class="panel rv-top"><div class="rc-section-title"><div><h2>Stock Verification</h2><p class="muted">Scan tagged stock and compare it with available inventory.</p></div><span>Retail stock</span></div><nav class="rv-tabs" aria-label="Stock verification views">'+RV_TABS.map(([k,v])=>'<button type="button" class="'+(rvTab===k?'active':'')+'" onclick="rvOpen(\''+k+'\')">'+esc(v)+'</button>').join('')+'</nav></section>'}
function rvList(scope){const rows=rvRows().filter(x=>x.scope===scope&&(!rvDate||rvDateText(x.date)===rvDate)&&(!rvSearch||[x.group,x.product,x.counter,x.name].join(' ').toLowerCase().includes(rvSearch.toLowerCase()))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 const title=scope==='group'?'By Product Group':scope==='product'?'By Product':'By Counter';
 const body=rows.map(r=>{const s=rvSummary(r),name=r.scope==='counter'?(r.counter||'Unassigned counter'):(r.group||'All groups')+(r.product?' / '+r.product:'');return '<tr><td><b>'+esc(name)+'</b><small>'+esc(rvDateText(r.date))+'</small></td><td>'+s.available.tags+' / '+s.available.qty+' / '+rvF(s.available.weight)+'</td><td>'+s.verified.tags+' / '+s.verified.qty+' / '+rvF(s.verified.weight)+'</td><td>'+s.invalid+'</td><td>'+s.missing.tags+' / '+s.missing.qty+' / '+rvF(s.missing.weight)+'</td><td><span class="rv-status">'+esc(r.status||'In progress')+'</span></td><td><button type="button" onclick="rvEdit(\''+esc(r.id)+'\')">Open</button></td></tr>'}).join('');
 return '<section class="panel"><div class="rc-section-title"><div><h2>'+title+'</h2><p class="muted">Available, verified, invalid and missing stock · Count / Qty / Weight g</p></div><button class="primary" type="button" onclick="rvOpen(\''+scope+'-create\')">＋ Create</button></div><div class="rv-filters"><label>Search<input type="search" value="'+esc(rvSearch)+'" onchange="rvSearch=this.value;rvRefreshBody()" placeholder="Group, product or counter"></label><label>Verify date<input type="date" value="'+esc(rvDate)+'" onchange="rvDate=this.value;rvRefreshBody()"></label><button type="button" onclick="rvSearch=rvDate=\'\';rvRefreshBody()">Reset</button><button type="button" onclick="rvExport(\''+scope+'\')">CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div><div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Scope / date</th><th>Available<br>Count / Qty / Weight</th><th>Verified<br>Count / Qty / Weight</th><th>Invalid</th><th>Missing<br>Count / Qty / Weight</th><th>Status</th><th>Action</th></tr></thead><tbody>'+ (body||'<tr><td colspan="7" class="rv-empty">No verification sessions yet. Select Create to start.</td></tr>')+'</tbody></table></div><p class="rv-hint">'+rows.length+' session(s). Verification records do not change sales or tag stock status.</p></section>'}
function rvCreate(scope){const r=rvDraft||{scope,date:rvToday(),verifiedIds:[],invalidCodes:[],scans:[],status:'In progress'},available=rvScope(r),verified=rvMarked(r),s=rvSummary(r),group=rvProductGroups(),products=rvProducts(r.group),counters=rvCounters();
 const select='<div class="rv-fields"><label>Verify date *<input id="rvDateInput" type="date" value="'+esc(rvDateText(r.date))+'" onchange="rvField(\'date\',this.value)"></label>'+(scope!=='rfid'&&scope!=='audit'?'<label>Product group<select id="rvGroup" onchange="rvField(\'group\',this.value)">'+rvOptions(group,r.group,'Select group')+'</select></label>':'')+(scope==='product'||scope==='counter'?'<label>Product<select onchange="rvField(\'product\',this.value)">'+rvOptions(products,r.product,'Select product')+'</select></label>':'')+(scope==='counter'?'<label>Counter *<select onchange="rvField(\'counter\',this.value)">'+rvOptions(counters,r.counter,'Select counter')+'</select></label>':'')+(scope==='audit'?'<label>Audit name *<input value="'+esc(r.name||'')+'" oninput="rvField(\'name\',this.value)" placeholder="e.g. Morning stock audit"></label>':'')+'<label>Status<select onchange="rvField(\'status\',this.value)">'+['In progress','Completed'].map(x=>'<option '+(r.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>';
 const rows=(a,checked)=>a.map(t=>'<tr><td>'+esc(t.tagCode||'')+'</td><td>'+esc(t.product||'')+'</td><td>'+esc(t.huid||'—')+'</td><td>'+rvQty(t)+'</td><td>'+rvF(rvWeight(t))+'</td><td>'+ (checked?'<button type="button" onclick="rvUnscan(\''+esc(t.id)+'\')">Undo</button>':'—')+'</td></tr>').join('');
 const table=(title,a,checked)=>'<section class="rv-list"><div class="rc-section-title"><h3>'+title+'</h3><strong>'+a.length+' tags · '+rvStats(a).qty+' pcs · '+rvF(rvStats(a).weight)+' g</strong></div>'+(a.length?'<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Tag No</th><th>Product Name</th><th>HUID</th><th>Qty</th><th>Weight g</th><th></th></tr></thead><tbody>'+rows(a,checked)+'</tbody></table></div>':'<p class="rv-no-tags">No tags found in this selection.</p>')+'</section>';
 return '<section class="panel rv-create"><div class="rc-section-title"><div><h2>Stock Verification :: '+(scope==='audit'?'RFID Audit':scope==='rfid'?'RFID Session':'Create')+'</h2><p class="muted">'+(scope==='group'?'By product group':scope==='product'?'By product':scope==='counter'?'By counter':scope==='rfid'?'RFID reader / keyboard scan':'Audit all tagged stock')+' · Scan tag code or HUID to verify.</p></div><button type="button" onclick="rvOpen(\''+(scope==='audit'?'rfid-audit':scope==='rfid'?'rfid-list':scope+'-list')+'\')">← List</button></div>'+select+'<div class="rv-scan"><label>Enter or scan tag code / HUID<input id="rvScan" autocomplete="off" placeholder="Scan or type a tag, then press Enter" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rvScan()}"></label><button type="button" class="primary" onclick="rvScan()">Verify tag</button></div><div class="rv-summary">'+rvCard('Available',s.available)+rvCard('Verified',s.verified)+rvCard('Missing',s.missing)+'<div class="rv-stat"><small>Invalid scans</small><b>'+s.invalid+'</b><span>'+s.scanned+' total scans</span></div></div>'+(r.invalidCodes?.length?'<p class="rv-invalid">Invalid: '+esc(r.invalidCodes.join(', '))+'</p>':'')+table('Available tags',available,false)+table('Verified tags',verified,true)+'<div class="rv-actions"><button type="button" onclick="rvSave(false)">Save progress</button><button type="button" class="primary" onclick="rvSave(true)">Complete verification</button><button type="button" onclick="window.print()">Print / PDF</button></div></section>'}
function rvRfidList(audit){const rows=rvRows().filter(x=>x.scope===(audit?'audit':'rfid')&&(!rvRfidFrom||x.date>=rvRfidFrom)&&(!rvRfidTo||x.date<=rvRfidTo)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return '<section class="panel"><div class="rc-section-title"><div><h2>'+ (audit?'RFID Stock Verification Audit':'RFID Stock Verification')+'</h2><p class="muted">'+(audit?'Audit name, status, scan times and tag totals':'Scan sessions with available, scanned and verified tag totals')+'</p></div><button class="primary" type="button" onclick="rvStart(\''+(audit?'audit':'rfid')+'\')">＋ New '+(audit?'audit':'session')+'</button></div><div class="rv-filters"><label>From date<input type="date" value="'+esc(rvRfidFrom)+'" onchange="rvRfidFrom=this.value;rvRefreshBody()"></label><label>To date<input type="date" value="'+esc(rvRfidTo)+'" onchange="rvRfidTo=this.value;rvRefreshBody()"></label><button type="button" onclick="rvRfidFrom=rvRfidTo=&quot;&quot;;rvRefreshBody()">Reset</button><button type="button" onclick="window.print()">Print / PDF</button></div><div class="rv-table-wrap"><table class="rv-table"><thead><tr>'+(audit?'<th>Audit name</th><th>Status</th>':'')+'<th>Date</th><th>First scan</th><th>Last scan</th><th>Available</th><th>Scanned</th><th>Verified</th><th>Action</th></tr></thead><tbody>'+ (rows.map(r=>{const s=rvSummary(r),scans=r.scans||[];return '<tr>'+(audit?'<td>'+esc(r.name||'—')+'</td><td>'+esc(r.status||'In progress')+'</td>':'')+'<td>'+esc(rvDateText(r.date))+'</td><td>'+esc(scans[0]?.at?.slice(11,16)||'—')+'</td><td>'+esc(scans.at(-1)?.at?.slice(11,16)||'—')+'</td><td>'+s.available.tags+'</td><td>'+s.scanned+'</td><td>'+s.verified.tags+'</td><td><button type="button" onclick="rvEdit(\''+esc(r.id)+'\')">Open</button></td></tr>'}).join('')||'<tr><td class="rv-empty" colspan="'+(audit?9:7)+'">No sessions yet.</td></tr>')+'</tbody></table></div></section>'}
window.rvView=function(){const scope=rvTab.split('-')[0];return rvTop()+(rvTab.endsWith('create')?rvCreate(scope):rvTab==='rfid-list'?rvRfidList(false):rvTab==='rfid-audit'?rvDraft?.scope==='audit'?rvCreate('audit'):rvRfidList(true):rvList(scope)+(window.rgaLooseOpeningView?'<details class="panel" open><summary>Opening loose metal and old jewellery</summary>'+rgaLooseOpeningView()+'</details>':''))};
window.rvRefreshBody=function(){document.querySelector('.rc-content').innerHTML=rvView()};
window.rvOpen=function(tab){if(!RV_TABS.some(x=>x[0]===tab))return;rvTab=tab;rvDraft=null;rvRefreshBody();window.scrollTo(0,0)};
window.rvStart=function(scope){rvDraft={scope,date:rvToday(),verifiedIds:[],invalidCodes:[],scans:[],status:'In progress'};rvSnapshot(rvDraft);rvTab=scope==='audit'?'rfid-audit':'rfid-list';rvRefreshBody()};
window.rvEdit=function(id){const r=rvRows().find(x=>x.id===id);if(!r)return;rvDraft=structuredClone(r);rvTab=r.scope==='audit'?'rfid-audit':r.scope==='rfid'?'rfid-list':r.scope+'-create';rvRefreshBody()};
window.rvField=function(key,value){if(!rvDraft)rvDraft={scope:rvTab.split('-')[0],date:rvToday(),verifiedIds:[],invalidCodes:[],scans:[],status:'In progress'};if(['group','product','counter'].includes(key)&&(rvDraft.scans||[]).length){say('Start a new session to change the scope after scanning.');rvRefreshBody();return}rvDraft[key]=value;if(key==='group')rvDraft.product='';if(['group','product','counter'].includes(key)){rvSnapshot(rvDraft);rvRefreshBody()}};
window.rvScan=function(){const input=document.getElementById('rvScan'),code=String(input?.value||'').trim();if(!code)return;const r=rvDraft||{scope:rvTab.split('-')[0],date:document.getElementById('rvDateInput')?.value||rvToday(),group:document.getElementById('rvGroup')?.value||'',verifiedIds:[],invalidCodes:[],scans:[],status:'In progress'};rvDraft=r;if(!r.stock)rvSnapshot(r);if(r.scope==='group'&&!r.group||r.scope==='product'&&(!r.group||!r.product)||r.scope==='counter'&&!r.counter)return say('Select a verification scope before scanning.');const t=rvScope(r).find(x=>[x.tagCode,x.huid,x.rfidUid].some(y=>String(y||'').toLowerCase()===code.toLowerCase()));if((r.scans||[]).some(x=>x.code.toLowerCase()===code.toLowerCase()))return say('This tag was already scanned.');r.scans.push({code,at:new Date().toISOString(),tagId:t?.id||''});if(t)r.verifiedIds.push(t.id);else r.invalidCodes.push(code);rvRefreshBody();document.getElementById('rvScan')?.focus();say(t?'Tag verified: '+code:'Tag not found in selected stock: '+code)};
window.rvUnscan=function(id){if(!rvDraft)return;rvDraft.verifiedIds=(rvDraft.verifiedIds||[]).filter(x=>x!==id);rvDraft.scans=(rvDraft.scans||[]).filter(x=>x.tagId!==id);rvRefreshBody()};
window.rvSave=function(complete){const r=rvDraft;if(!r)return say('Select a scope or scan a tag first.');if(r.scope==='group'&&!r.group)return say('Select a product group.');if(r.scope==='product'&&(!r.group||!r.product))return say('Select a group and product.');if(r.scope==='counter'&&!r.counter)return say('Select a counter.');if(r.scope==='audit'&&!String(r.name||'').trim())return say('Enter an audit name.');if(complete&&!confirm('Complete this verification session?'))return;if(!r.stock)rvSnapshot(r);const now=new Date().toISOString();const saved={...r,id:r.id||crypto.randomUUID(),kind:'retail-stock-verification',accountType:'customer',status:complete?'Completed':r.status||'In progress',createdAt:r.createdAt||now,updatedAt:now};const i=db.retailDocuments.findIndex(x=>x.id===saved.id);if(i<0)db.retailDocuments.push(saved);else db.retailDocuments[i]=saved;rvDraft=null;rvTab=saved.scope==='audit'?'rfid-audit':saved.scope==='rfid'?'rfid-list':saved.scope+'-list';const pending=save();rvRefreshBody();rcSaveStatus(pending,'Stock verification')};
window.rvExport=function(scope){const rows=rvRows().filter(x=>x.scope===scope),lines=[['Date','Scope','Group','Product','Counter','Available tags','Available qty','Available weight g','Verified tags','Verified qty','Verified weight g','Invalid','Missing tags','Missing qty','Missing weight g','Status']];rows.forEach(r=>{const s=rvSummary(r);lines.push([r.date,r.scope,r.group||'',r.product||'',r.counter||'',s.available.tags,s.available.qty,rvF(s.available.weight),s.verified.tags,s.verified.qty,rvF(s.verified.weight),s.invalid,s.missing.tags,s.missing.qty,rvF(s.missing.weight),r.status])});const csv=lines.map(a=>a.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='stock-verification-'+scope+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

if(typeof page!=='undefined'&&page==='Stock Verification'&&typeof render==='function')render();

let rvTagTab='tagging',rvSoldSearch='',rvSoldDate='';
const RV_STOCK_TABS=[
  ['tagging','Tagging'],
  ['sold','Sold Tags'],
  ['issue-voucher','Issue Voucher'],
  ['receipt-voucher','Receipt Voucher'],
  ['metal-voucher','Metal Voucher'],
  ['stock-journal','Stock Journal'],
  ['reorder-entry','Reorder Entry'],
  ['gift-items','Gift Items']
];
function rvSaveExtraDoc(kind,row,msg){
  if(!Array.isArray(db.retailDocuments))db.retailDocuments=[];
  const now=new Date().toISOString();
  const saved=Object.assign({id:row.id||crypto.randomUUID(),kind,type:kind,accountType:'customer',createdAt:row.createdAt||now},row,{updatedAt:now});
  const i=db.retailDocuments.findIndex(x=>x.id===saved.id);
  if(i<0)db.retailDocuments.unshift(saved);else db.retailDocuments[i]=saved;
  const p=save();rvRefreshTagging();if(typeof rcSaveStatus==='function')rcSaveStatus(p,msg);else say(msg+' saved.');
}
window.rvSaveStockVoucher=function(e,kind,prefix,label){
  e.preventDefault();const f=e.target;if(!f.reportValidity())return;
  const v=Object.fromEntries(new FormData(f));
  rvSaveExtraDoc(kind,{
    voucherNo:String(v.voucherNo||'').trim()||(prefix+'-'+Date.now().toString(36).toUpperCase().slice(-5)),
    date:v.date||rvToday(),party:String(v.party||'').trim()||'Goldsmith / Counter',
    direction:v.direction||label,metal:v.metal||'Gold',product:String(v.product||'').trim()||'Ornament',
    pieces:rvNum(v.pieces||1),grossWt:rvNum(v.grossWt),netWt:rvNum(v.netWt||v.grossWt),
    purity:rvNum(v.purity||91.6),pureWt:rvF(rvNum(v.netWt||v.grossWt)*rvNum(v.purity||91.6)/100),
    targetProduct:String(v.targetProduct||'').trim(),targetWt:rvNum(v.targetWt),
    charges:rvNum(v.charges),remarks:String(v.remarks||'').trim()
  },label);
};
window.rvSaveReorderRule=function(e){
  e.preventDefault();const f=e.target;if(!f.reportValidity())return;
  const v=Object.fromEntries(new FormData(f));
  rvSaveExtraDoc('retail-reorder-rule',{
    mode:v.mode||'By Default',productGroup:v.productGroup||'General',product:String(v.product||'').trim(),
    size:String(v.size||'').trim()||'Standard',weightRange:String(v.weightRange||'').trim()||'All Weights',
    reorderQty:rvNum(v.reorderQty||2),reorderWt:rvNum(v.reorderWt||10),remarks:String(v.remarks||'').trim()
  },'Reorder rule');
};
window.rvSaveGiftItemEntry=function(e){
  e.preventDefault();const f=e.target;if(!f.reportValidity())return;
  const v=Object.fromEntries(new FormData(f));
  rvSaveExtraDoc('retail-gift-entry',{
    entryType:v.entryType||'Gift Item Master',code:String(v.code||'').trim()||('GFT-'+Date.now().toString(36).toUpperCase().slice(-5)),
    date:v.date||rvToday(),name:String(v.name||'').trim(),supplier:String(v.supplier||'').trim(),
    qty:rvNum(v.qty||1),weight:rvNum(v.weight),rate:rvNum(v.rate),amount:rvNum(v.amount||rvNum(v.qty||1)*rvNum(v.rate)),
    remarks:String(v.remarks||'').trim()
  },'Gift item entry');
};
function rvVoucherView(kind,title,prefix){
  const list=rcDocs(kind),prods=rvProducts('');
  const isJournal=kind==='retail-stock-journal',isMetal=kind==='retail-metal-voucher';
  return '<section class="panel"><div class="rc-section-title"><div><h2>'+esc(title)+' :: Create</h2><p class="muted">Track retail smith, counter, bullion and jobwork stock movements.</p></div><span>'+list.length+' entries</span></div>'
    +'<form class="rc-grid" onsubmit="rvSaveStockVoucher(event,\''+kind+'\',\''+prefix+'\',\''+title+'\')">'
    +'<label>Voucher No.<input name="voucherNo" placeholder="Auto"></label>'
    +'<label>Date *<input type="date" name="date" required value="'+rvToday()+'"></label>'
    +(isMetal?'<label>Direction<select name="direction"><option>Metal Issue</option><option>Metal Receipt</option></select></label>':'')
    +'<label>'+(kind.includes('issue')?'Issue To':kind.includes('receipt')?'Received From':'Smith / Counter / Party')+' *<input name="party" required placeholder="Karigar, smith or counter"></label>'
    +'<label>Metal<select name="metal"><option>Gold</option><option>Silver</option><option>Diamond</option><option>Platinum</option></select></label>'
    +'<label>'+(isJournal?'Source Product':'Product / Bullion')+' *<input name="product" required list="rvProdDl" placeholder="Select or type"></label><datalist id="rvProdDl">'+prods.map(p=>'<option value="'+esc(p)+'">').join('')+'</datalist>'
    +'<label>Pieces / Qty<input type="number" name="pieces" min="1" step="1" value="1"></label>'
    +'<label>Gross Weight (g) *<input type="number" name="grossWt" min=".001" step=".001" required></label>'
    +'<label>Net Weight (g) *<input type="number" name="netWt" min=".001" step=".001" required></label>'
    +'<label>Touch / Purity %<input type="number" name="purity" min="1" max="100" step=".01" value="91.6"></label>'
    +(isJournal?'<label>Target Product / Output<input name="targetProduct" list="rvProdDl" placeholder="Converted product"></label><label>Target Output Wt (g)<input type="number" name="targetWt" step=".001"></label>':'')
    +'<label>Charges / Value ₹<input type="number" name="charges" min="0" step=".01" value="0"></label>'
    +'<label class="rc-wide">Narration / Remarks<input name="remarks"></label>'
    +'<div class="rc-actions rc-wide"><button class="primary" type="submit">Save '+esc(title)+'</button></div></form></section>'
    +'<section class="panel"><h2>'+esc(title)+' History · '+list.length+'</h2>'
    +(list.length?table(['Date','Voucher No','Party / Counter','Metal','Product','Qty','Gross g','Net g','Purity %','Pure g',isJournal?'Target Output':'Charges ₹','Remarks'],list.map(r=>[
      esc(r.date),'<b>'+esc(r.voucherNo)+'</b>',esc(r.party),esc(r.metal),esc(r.product),r.pieces,rvF(r.grossWt)+' g','<b>'+rvF(r.netWt)+' g</b>',r.purity+'%',rvF(r.pureWt)+' g',isJournal?esc((r.targetProduct||'—')+' ('+rvF(r.targetWt)+' g)'):rateMoney(r.charges),esc(r.remarks||'—')
    ])):'<p class="rv-no-tags">No '+esc(title.toLowerCase())+' records yet.</p>')+'</section>';
}
function rvReorderEntryView(){
  const list=rcDocs('retail-reorder-rule'),groups=rvProductGroups(),prods=rvProducts('');
  return '<section class="panel"><div class="rc-section-title"><div><h2>Reorder Entry (By Default / Size / Weight Range)</h2><p class="muted">Configure minimum stock pieces and weight thresholds for automated Reorder Reports.</p></div><span>'+list.length+' rules</span></div>'
    +'<form class="rc-grid" onsubmit="rvSaveReorderRule(event)">'
    +'<label>Entry Mode<select name="mode"><option>Entry By Default</option><option>Entry By Size</option><option>Entry By Weight</option><option>Weight Range Mapping</option></select></label>'
    +'<label>Product Group<select name="productGroup">'+rvOptions(groups,'','All Groups')+'</select></label>'
    +'<label>Product Name *<input name="product" required list="rvProdDl" placeholder="Product name"></label>'
    +'<label>Product Size<input name="size" placeholder="e.g. 16 In, 18 In, 2.4"></label>'
    +'<label>Weight Range Slab<input name="weightRange" placeholder="e.g. 2–5g, 5–10g, 10–20g"></label>'
    +'<label>Reorder Min Qty (Pcs) *<input type="number" name="reorderQty" min="1" step="1" value="2" required></label>'
    +'<label>Reorder Min Weight (g) *<input type="number" name="reorderWt" min=".001" step=".001" value="10" required></label>'
    +'<label>Remarks<input name="remarks"></label>'
    +'<div class="rc-actions rc-wide"><button class="primary" type="submit">Save Reorder Rule</button> <button type="button" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\'Reorder Report By Default\')">📊 View Reorder Reports</button></div></form></section>'
    +'<section class="panel"><h2>Saved Reorder Rules · '+list.length+'</h2>'
    +(list.length?table(['Mode','Product Group','Product','Size','Weight Range','Min Qty','Min Weight g','Remarks'],list.map(r=>[
      '<b>'+esc(r.mode)+'</b>',esc(r.productGroup),esc(r.product),esc(r.size),esc(r.weightRange),r.reorderQty,'<b>'+rvF(r.reorderWt)+' g</b>',esc(r.remarks||'—')
    ])):'<p class="rv-no-tags">No custom reorder rules saved yet.</p>')+'</section>';
}
function rvGiftItemsView(){
  const list=rcDocs('retail-gift-entry');
  return '<section class="panel"><div class="rc-section-title"><div><h2>Gift Items, Gift Purchase, Lot Entry & Tagging</h2><p class="muted">Manage complimentary gift articles, silver coins, gift lots and gift tags.</p></div><span>'+list.length+' records</span></div>'
    +'<form class="rc-grid" onsubmit="rvSaveGiftItemEntry(event)">'
    +'<label>Workflow Type<select name="entryType"><option>Gift Item Master</option><option>Gift Purchase Item</option><option>Gift Item Lot Entry</option><option>Gift Item Tagging</option></select></label>'
    +'<label>Code / Tag / Lot No.<input name="code" placeholder="Auto"></label>'
    +'<label>Date *<input type="date" name="date" required value="'+rvToday()+'"></label>'
    +'<label>Gift Item Name *<input name="name" required placeholder="e.g. Silver Coin 5g, Silk Bag, Compliment Box"></label>'
    +'<label>Supplier / Source<input name="supplier" placeholder="Supplier name"></label>'
    +'<label>Quantity (Pcs) *<input type="number" name="qty" min="1" step="1" value="1" required></label>'
    +'<label>Weight (g)<input type="number" name="weight" min="0" step=".001" value="0"></label>'
    +'<label>Rate / Unit ₹<input type="number" name="rate" min="0" step=".01" value="0"></label>'
    +'<label>Total Amount ₹<input type="number" name="amount" min="0" step=".01" value="0"></label>'
    +'<label>Remarks<input name="remarks"></label>'
    +'<div class="rc-actions rc-wide"><button class="primary" type="submit">Save Gift Entry</button> <button type="button" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\'Gift Stock Report\')">📊 Gift Stock Report</button></div></form></section>'
    +'<section class="panel"><h2>Gift Item Entries · '+list.length+'</h2>'
    +(list.length?table(['Date','Workflow Type','Code / Tag','Gift Item Name','Supplier','Qty','Weight g','Unit Rate ₹','Amount ₹','Remarks'],list.map(r=>[
      esc(r.date),'<b>'+esc(r.entryType)+'</b>',esc(r.code),'<b>'+esc(r.name)+'</b>',esc(r.supplier||'—'),r.qty,rvF(r.weight)+' g',rateMoney(r.rate),'<b>'+rateMoney(r.amount)+'</b>',esc(r.remarks||'—')
    ])):'<p class="rv-no-tags">No gift item entries recorded yet.</p>')+'</section>';
}
function rvSaleTagMap(){const map=new Map();(db.sales||[]).filter(s=>s.accountType==='customer').forEach(s=>(s.invoiceItems||[]).forEach(item=>{const code=String(item.tagCode||'').trim().toLowerCase();if(code)map.set(code,{sale:s,item})}));return map}
function rvSoldRows(){const saleMap=rvSaleTagMap(),tags=rcDocs('retail-tagging'),known=new Set(),rows=[];tags.forEach(t=>{const key=String(t.tagCode||'').toLowerCase(),match=saleMap.get(key);if(t.status!=='Sold'&&!match)return;known.add(key);rows.push({tag:t,sale:match?.sale,item:match?.item})});for(const [key,match] of saleMap)if(!known.has(key))rows.push({tag:{tagCode:match.item.tagCode,product:match.item.product,group:match.item.productGroup,pieces:match.item.pieces,grossWeight:match.item.grossWeight,netWeight:match.item.netWeight,huid:match.item.huid,metalType:match.item.metalType},sale:match.sale,item:match.item});return rows}
function rvSoldView(){const all=rvSoldRows(),rows=all.filter(x=>{const s=[x.tag.tagCode,x.tag.product,x.tag.group,x.sale?.documentNo].join(' ').toLowerCase();return (!rvSoldSearch||s.includes(rvSoldSearch.toLowerCase()))&&(!rvSoldDate||rvDateText(x.sale?.when||x.tag.soldAt)===rvSoldDate)}),total=rvStats(rows.map(x=>x.tag)),amount=rows.reduce((a,x)=>a+rvNum(x.item?.subtotal||x.item?.lineAmount||x.tag.totalAmount),0);return '<section class="panel"><div class="rc-section-title"><div><h2>Sold Tags</h2><p class="muted">Tags linked to saved retail sales bills and tags manually marked Sold.</p></div><span>'+rows.length+' sold tags</span></div><div class="rv-summary rv-sold-summary">'+rvCard('Sold tags',total)+'<div class="rv-stat"><small>Sales value</small><b>₹ '+amount.toLocaleString('en-IN',{maximumFractionDigits:2})+'</b><span>Recorded bills</span></div></div><div class="rv-filters"><label>Search<input type="search" value="'+esc(rvSoldSearch)+'" onchange="rvSoldSearch=this.value;rvRefreshTagging()" placeholder="Tag, product or bill"></label><label>Sale date<input type="date" value="'+esc(rvSoldDate)+'" onchange="rvSoldDate=this.value;rvRefreshTagging()"></label><button type="button" onclick="rvSoldSearch=rvSoldDate=\'\';rvRefreshTagging()">Reset</button><button type="button" onclick="rvSoldExport()">CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div>'+(rows.length?'<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Tag</th><th>Product</th><th>Group</th><th>Metal</th><th>Qty</th><th>Gross g</th><th>Net g</th><th>HUID</th><th>Bill / date</th><th>Sale value ₹</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.tag.tagCode||'—')+'</b></td><td>'+esc(x.tag.product||'—')+'</td><td>'+esc(x.tag.group||'—')+'</td><td>'+esc(x.tag.metalType||'—')+'</td><td>'+rvQty(x.tag)+'</td><td>'+rvF(rvWeight(x.tag))+'</td><td>'+rvF(x.tag.netWeight)+'</td><td>'+esc(x.tag.huid||'—')+'</td><td>'+esc(x.sale?.documentNo||x.tag.soldBillNo||'Manual')+'<small>'+esc(rvDateText(x.sale?.when||x.tag.soldAt))+'</small></td><td>'+rvNum(x.item?.subtotal||x.item?.lineAmount||x.tag.totalAmount).toLocaleString('en-IN',{maximumFractionDigits:2})+'</td></tr>').join('')+'</tbody><tfoot><tr><th>TOTAL · '+rows.length+'</th><th colspan="3"></th><th>'+total.qty+'</th><th>'+rvF(total.weight)+'</th><th>'+rvF(rows.reduce((a,x)=>a+rvNum(x.tag.netWeight),0))+'</th><th colspan="2"></th><th>₹ '+amount.toLocaleString('en-IN',{maximumFractionDigits:2})+'</th></tr></tfoot></table></div>':'<p class="rv-no-tags">No sold tags found for these filters.</p>')+'</section>'}
window.rvTaggingScreen=function(){
  const nav='<nav class="rv-tag-nav" style="display:flex;flex-wrap:wrap;gap:6px" aria-label="Tagging views">'+RV_STOCK_TABS.map(([k,lbl])=>'<button type="button" class="'+(rvTagTab===k?'active':'')+'" onclick="rvTagOpen(\''+k+'\')">'+esc(lbl)+'</button>').join('')+'</nav>';
  if(rvTagTab==='sold')return nav+rvSoldView();
  if(rvTagTab==='issue-voucher')return nav+rvVoucherView('retail-issue-voucher','Issue Voucher','ISS');
  if(rvTagTab==='receipt-voucher')return nav+rvVoucherView('retail-receipt-voucher','Receipt Voucher','RCV');
  if(rvTagTab==='metal-voucher')return nav+rvVoucherView('retail-metal-voucher','Metal Voucher','MTL');
  if(rvTagTab==='stock-journal')return nav+rvVoucherView('retail-stock-journal','Stock Journal (Jobwork)','JRN');
  if(rvTagTab==='reorder-entry')return nav+rvReorderEntryView();
  if(rvTagTab==='gift-items')return nav+rvGiftItemsView();
  return nav+rcTaggingView();
};
window.rvRefreshTagging=function(){const el=document.querySelector('.rc-content')||document.getElementById('app');if(el)el.innerHTML=rvTaggingScreen()};
window.rvTagOpen=function(tab){if(!RV_STOCK_TABS.some(x=>x[0]===tab))return;rvTagTab=tab;rvRefreshTagging();window.scrollTo?.(0,0)};
window.rvSyncSoldTags=function(previous,sale){const before=new Set((previous?.invoiceItems||[]).map(x=>String(x.tagCode||'').toLowerCase()).filter(Boolean)),now=new Set((sale.invoiceItems||[]).map(x=>String(x.tagCode||'').toLowerCase()).filter(Boolean));for(const tag of rcDocs('retail-tagging')){const code=String(tag.tagCode||'').toLowerCase();if(now.has(code)){tag.status='Sold';tag.soldBySaleId=sale.id;tag.soldBillNo=sale.documentNo;tag.soldAt=sale.when;tag.updatedAt=new Date().toISOString()}else if(before.has(code)&&tag.soldBySaleId===sale.id){tag.status='In stock';tag.soldBySaleId='';tag.soldBillNo='';tag.soldAt='';tag.updatedAt=new Date().toISOString()}}};
window.rvSoldExport=function(){const lines=[['Tag','Product','Group','Metal','Qty','Gross g','Net g','HUID','Bill','Sale date','Sale value']];for(const x of rvSoldRows())lines.push([x.tag.tagCode,x.tag.product,x.tag.group,x.tag.metalType,rvQty(x.tag),rvF(rvWeight(x.tag)),rvF(x.tag.netWeight),x.tag.huid,x.sale?.documentNo||x.tag.soldBillNo,rvDateText(x.sale?.when||x.tag.soldAt),rvNum(x.item?.subtotal||x.item?.lineAmount||x.tag.totalAmount)]);const csv=lines.map(a=>a.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='sold-tags.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
