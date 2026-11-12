// Retail Product Group, Product and Model workflows. Records stay in the shop's
// normal synced retailDocuments collection so phone and desktop share them.
const GL_PRODUCT_VERSION = '2.10.44';
let glProductStep=['Group','Product','Model'].includes(sessionStorage.getItem('gl-product-step'))?sessionStorage.getItem('gl-product-step'):'Product';
let glGroupEdit='',glModelEdit='';
const glDocs=kind=>rcDocs(kind);
const glEsc=esc;
function glProductRows(){return glDocs('retail-product')}
function glGroupRows(){return glDocs('retail-product-group')}
function glModelRows(){return glDocs('retail-model')}
function glOption(items,value){return items.map(x=>'<option value="'+esc(x[0])+'" '+(String(x[0])===String(value)?'selected':'')+'>'+esc(x[1])+'</option>').join('')}
function glSaveDoc(kind,row,label){const i=db.retailDocuments.findIndex(x=>x.id===row.id);if(i<0)db.retailDocuments.push(row);else db.retailDocuments[i]=row;const pending=save();render();rcSaveStatus(pending,label)}
function glProductTabs(){return '<nav class="gl-product-switch" aria-label="Product workflows">'+[['Group','Product Group','▦'],['Product','Product','◇'],['Model','Model','✦']].map(([id,label,icon])=>'<button type="button" class="gl-product-card '+(glProductStep===id?'active':'')+'" aria-current="'+(glProductStep===id?'page':'false')+'" onclick="glProductOpen(\''+id+'\')"><span>'+icon+'</span><b>'+label+'</b><small>'+({Group:'Groups & codes',Product:'Catalog & stock',Model:'Design & tag defaults'}[id])+'</small></button>').join('')+'</nav>'}
window.glProductOpen=function(step){
  if(!session||!goldleafContext?.has_access){say('Please sign in first.');return;}
  if(!['Group','Product','Model'].includes(step)||!rbCanLeave())return;glProductStep=step;sessionStorage.setItem('gl-product-step',step);rcProductEdit='';glGroupEdit='';glModelEdit='';render();window.scrollTo?.(0,0)};
function glGroupPage(){const rows=glGroupRows(),x=rows.find(g=>g.id===glGroupEdit);return '<section class="panel"><div class="rc-section-title"><div><h2>'+(x?'Edit product group':'Create product group')+'</h2><p class="muted">Set up group codes and default product size first. Groups appear in Product and Tagging selectors.</p></div><span>'+rows.length+' groups</span></div><form class="rc-grid rc-master-form" onsubmit="glSaveGroup(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Group code<input name="groupCode" maxlength="30" value="'+esc(x?.groupCode||'')+'" placeholder="e.g. CHAINS"></label><label>Group name *<input name="name" required maxlength="80" value="'+esc(x?.name||'')+'" placeholder="Gold Chains"></label><label>Print name<input name="printName" maxlength="80" value="'+esc(x?.printName||'')+'"></label><label>Ornament / metal<select name="metalType">'+glOption([['Gold','Gold'],['Silver','Silver'],['Platinum','Platinum'],['Other','Other']],x?.metalType||'Gold')+'</select></label><label>Product size<input name="size" maxlength="40" value="'+esc(x?.size||x?.productSize||'')+'" placeholder="e.g. 2.4, 18 inch, Free size"></label><label>Status<select name="status">'+glOption([['Active','Active'],['Disabled','Disabled']],x?.status||'Active')+'</select></label><label class="rc-wide">Notes<input name="remarks" value="'+esc(x?.remarks||'')+'"></label><div class="rc-actions rc-wide"><button class="primary">'+(x?'Update group':'Save group')+'</button><button type="button" onclick="glGroupEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Product groups · '+rows.length+'</h2>'+(rows.length?table(['Code','Group','Print name','Metal','Product size','Status',''],rows.map(g=>[esc(g.groupCode||'—'),esc(g.name),esc(g.printName||g.name),esc(g.metalType||'Gold'),esc(g.size||g.productSize||'—'),esc(g.status||'Active'),'<button type="button" onclick="glEditGroup(\''+esc(g.id)+'\')">Edit</button>'])):'<p class="muted">No groups yet. Create a group to start the catalog.</p>')+'</section>'}
window.glEditGroup=id=>{glGroupEdit=id;render()};
window.glSaveGroup=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),name=String(d.name||'').trim(),code=String(d.groupCode||'').trim(),old=glGroupRows().find(x=>x.id===d.id);if(!name)return say('Enter a group name.');if(glGroupRows().some(x=>x.id!==d.id&&x.name.toLowerCase()===name.toLowerCase()))return say('That product group already exists.');if(code&&glGroupRows().some(x=>x.id!==d.id&&String(x.groupCode||'').toLowerCase()===code.toLowerCase()))return say('That group code is already in use.');if(d.id&&!confirm('Save changes to this product group?'))return;const now=new Date().toISOString(),row={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-product-group',accountType:'customer',name,groupCode:code,printName:String(d.printName||'').trim(),metalType:d.metalType||'Gold',size:String(d.size||d.productSize||'').trim(),productSize:String(d.size||d.productSize||'').trim(),status:d.status||'Active',remarks:String(d.remarks||'').trim(),createdAt:old?.createdAt||now,updatedAt:now};delete row.productType;glGroupEdit='';glSaveDoc('retail-product-group',row,'Retail product group')};
window.glProductGroupChanged=function(sel){const g=glGroupRows().find(x=>x.name===sel.value),f=sel.form;if(!g||!f)return;if(g.metalType&&f.elements.metalType)f.elements.metalType.value=g.metalType;if((g.size||g.productSize)&&f.elements.size&&!f.elements.size.value){f.elements.size.value=g.size||g.productSize||''}};
window.glToggleReqDropdown=function(btn){if(window.innerWidth>760)return;const grp=btn?.closest('.gl-req-group');if(!grp)return;const isOpen=grp.classList.toggle('is-open');btn.setAttribute('aria-expanded',String(isOpen));const caret=btn.querySelector('.gl-req-caret');if(caret)caret.textContent=isOpen?'▴':'▾'};
window.glUpdateReqCount=function(chk){const grp=chk?.closest('.gl-req-group');if(!grp)return;const count=grp.querySelectorAll('input[type="checkbox"]:checked').length;const badge=grp.querySelector('.gl-req-count-badge');if(badge){badge.textContent=count>0?(count+' selected'):'0 selected';badge.classList.toggle('has-selected',count>0)}};
function glRenderReqDropdowns(attrName,x,thirdLabel){const fields=['Tag / Barcode','HUID','Pieces','Gross weight','Less weight','Purity','Wastage','Making charge','Stone details'];const buildGroup=(title,key)=>{const chosen=Array.isArray(x?.[key])?x[key]:[];const count=chosen.length;return '<div class="gl-req-group gl-span-two" data-req-group="'+key+'"><button type="button" class="gl-req-dropdown-btn" onclick="glToggleReqDropdown(this)" aria-expanded="false"><span class="gl-req-title">'+title+'</span><span class="gl-req-right-meta"><span class="gl-req-count-badge '+(count>0?'has-selected':'')+'">'+(count>0?(count+' selected'):'0 selected')+'</span><span class="gl-req-caret">▾</span></span></button><div class="gl-req-dropdown-body"><div class="gl-check-list">'+fields.map(label=>'<label class="gl-tick-chip"><input type="checkbox" '+attrName+'="'+key+'" value="'+label+'" '+(chosen.includes(label)?'checked':'')+' onchange="glUpdateReqCount(this)"><span>'+label+'</span></label>').join('')+'</div></div></div>'};return '<div class="gl-req-separated-section rc-wide"><div class="gl-req-sep-header"><span>Required Fields Configuration</span><small>Tap each category below to select required fields</small></div>'+buildGroup('Sales required fields','salesRequiredFields')+buildGroup('Purchase required fields','purchaseRequiredFields')+buildGroup(thirdLabel||'Old jewellery required fields','oldJewelRequiredFields')+'</div>'}
function glProductPage(){const rows=glProductRows(),x=rows.find(p=>p.id===rcProductEdit),groups=glGroupRows().filter(g=>(g.status||'Active')==='Active'),groupNames=[...new Set([...groups.map(g=>g.name),...rows.map(p=>p.group).filter(Boolean),x?.group].filter(Boolean))],selectedGroup=x?.group||'';return '<section class="panel"><div class="rc-section-title"><div><h2>'+(x?'Edit product':'Product master')+'</h2><p class="muted">Product details, metal rates, stock and charge defaults carry into tags, Retail bills and quotations.</p></div><span>'+rows.length+' products</span></div><form class="rc-grid rc-master-form" onsubmit="glSaveProduct(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Product code / SKU<input name="productCode" maxlength="40" value="'+esc(x?.productCode||'')+'" placeholder="Optional unique code"></label><label>Product group *<select name="group" required onchange="glProductGroupChanged(this)"><option value="">Select group</option>'+groupNames.map(g=>'<option '+(g===selectedGroup?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label><label>Category<input name="category" value="'+esc(x?.category||'')+'" placeholder="Ring, chain, bangle"></label><label>Product name *<input name="name" required maxlength="100" value="'+esc(x?.name||'')+'"></label><label>Print name<input name="printName" value="'+esc(x?.printName||'')+'"></label><label>Metal / ornament *<select name="metalType">'+glOption([['Gold','Gold'],['Silver','Silver'],['Platinum','Platinum'],['Other','Other']],x?.metalType||groups.find(g=>g.name===selectedGroup)?.metalType||'Gold')+'</select></label><label>Product type<select name="productType">'+glOption([['GRAM_BASED','Gram based'],['ITEM_BASED','Item based']],x?.productType||'GRAM_BASED')+'</select></label><label>Base unit<select name="unit">'+glOption([['piece','Piece'],['gram','Gram'],['pair','Pair'],['set','Set']],x?.unit||'piece')+'</select></label><label>Purity · %<input name="purity" type="number" min="1" max="100" step=".01" value="'+(x?.purity??92)+'"></label><label>Rate source<select name="rateType">'+glOption([['metal-default','Use metal rate'],['silver-board','Silver board rate'],['silver-pure','Silver pure rate'],['manual','Manual product rate']],x?.rateType||'metal-default')+'</select></label><label>Manual rate · ₹/g<input name="manualRate" type="number" min="0" step=".01" value="'+(x?.manualRate??'')+'"></label><label>Default weight · g<input name="defaultWeight" type="number" min="0" step=".001" value="'+(x?.defaultWeight??'')+'"></label><label>HSN / SAC<input name="hsn" value="'+esc(x?.hsn||'')+'"></label><label>Product size<input name="size" value="'+esc(x?.size||groups.find(g=>g.name===selectedGroup)?.size||groups.find(g=>g.name===selectedGroup)?.productSize||'')+'"></label><label>HUID default<input name="huid" value="'+esc(x?.huid||'')+'"></label><label>Tag prefix / series<input name="tagPrefix" value="'+esc(x?.tagPrefix||'')+'"></label><label>Next tag number<input name="tagNextNumber" type="number" min="0" step="1" value="'+(x?.tagNextNumber??'')+'"></label><label>Wastage minimum<input name="minWastage" type="number" min="0" step=".01" value="'+(x?.minWastage??x?.wastage??0)+'"></label><label>Wastage maximum<input name="maxWastage" type="number" min="0" step=".01" value="'+(x?.maxWastage??x?.wastage??0)+'"></label><label>Wastage type<select name="wastageMode">'+glOption([['percent','Percentage (%)'],['grams','Weight (g)']],x?.wastageMode||'percent')+'</select></label><label>Default wastage<input name="wastage" type="number" min="0" step=".001" value="'+(x?.wastage||0)+'"></label><label>Making charge type<select name="makingMode">'+glOption([['fixed','Fixed amount'],['piece','Per piece'],['gram','Per gram'],['percent','Percentage'],['percent-gram','Percentage per gram']],x?.makingMode||'piece')+'</select></label><label>Making charge value<input name="makingRate" type="number" min="0" step=".01" value="'+(x?.makingRate||0)+'"></label><label>Stone type<select name="stoneType">'+glOption([['none','None'],['diamond','Diamond'],['stone','Stone'],['other','Other']],x?.stoneType||'none')+'</select></label><label>Stone / diamond pieces<input name="stonePieces" type="number" min="0" step="1" value="'+(x?.stonePieces||0)+'"></label><label>Stone / diamond carats<input name="stoneCarat" type="number" min="0" step=".001" value="'+(x?.stoneCarat||0)+'"></label><label>Stone / certificate charge · ₹<input name="stoneCharge" type="number" min="0" step=".01" value="'+(x?.stoneCharge||0)+'"></label><label>Ornament purity / touch<input name="ornamentPurity" type="number" min="0" max="100" step=".01" value="'+(x?.ornamentPurity??'')+'"></label><label>Opening stock · pieces<input name="openingPieces" type="number" min="0" step="1" value="'+(x?.openingPieces||0)+'"></label><label>Opening gross · g<input name="openingGross" type="number" min="0" step=".001" value="'+(x?.openingGross||0)+'"></label><label>Opening net · g<input name="openingNet" type="number" min="0" step=".001" value="'+(x?.openingNet||0)+'"></label>'+glRenderReqDropdowns('data-gl-required',x,'Old jewellery required fields')+'<label class="rc-check"><input name="isEcommerce" type="checkbox" '+(x?.isEcommerce?'checked':'')+'> Available for e-commerce</label><label class="rc-wide">Description / remarks<input name="description" value="'+esc(x?.description||'')+'"></label><div class="rc-actions rc-wide"><button class="primary">'+(x?'Update product':'Save product')+'</button><button type="button" onclick="rcProductEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Product list · '+rows.length+'</h2>'+(rows.length?table(['Code','Group','Category','Product','Metal','Type','Purity','Wastage','Making','Stock pcs','Stock net g','Tag next',''],rows.map(p=>[esc(p.productCode||'—'),esc(p.group||'—'),esc(p.category||'—'),esc(p.name),esc(p.metalType||'Gold'),esc(p.productType||'GRAM_BASED'),n(p.purity)+'%',(p.wastageMode==='grams'?'g ':'% ')+n(p.wastage),esc(p.makingMode||'piece')+' · '+rateMoney(p.makingRate),n(p.openingPieces),fmt(p.openingNet),esc(p.tagNextNumber||p.tagPrefix||'—'),'<button type="button" onclick="rcEditProduct(\''+esc(p.id)+'\')">Edit</button>'])):'<p class="muted">No products yet. Add a Product Group, then save your first item.</p>')+'</section>'}
window.rcProductsView=function(){return '<div class="gl-product-page">'+glProductTabs()+(glProductStep==='Group'?glGroupPage():glProductStep==='Model'?glModelPage():glProductPage())+'</div>'};
window.glSaveProduct=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),name=String(d.name||'').trim(),group=String(d.group||'').trim(),purity=n(d.purity),old=glProductRows().find(p=>p.id===d.id);if(!group||!name)return say('Select a product group and enter the product name.');if(purity<1||purity>100)return say('Enter product purity from 1 to 100%.');if(d.productCode&&glProductRows().some(p=>p.id!==d.id&&String(p.productCode||'').toLowerCase()===d.productCode.trim().toLowerCase()))return say('That product code is already in use.');if(d.id&&!confirm('Save changes to this product?'))return;const required=key=>[...f.querySelectorAll('[data-gl-required="'+key+'"]:checked')].map(el=>el.value),now=new Date().toISOString(),p={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-product',accountType:'customer',productCode:String(d.productCode||'').trim(),group,category:String(d.category||'').trim(),name,printName:String(d.printName||'').trim(),metalType:d.metalType||'Gold',productType:d.productType||'GRAM_BASED',unit:d.unit||'piece',purity,rateType:d.rateType||'metal-default',manualRate:n(d.manualRate),defaultWeight:n(d.defaultWeight),hsn:String(d.hsn||'') .trim(),size:String(d.size||'').trim(),huid:String(d.huid||'').trim(),tagPrefix:String(d.tagPrefix||'').trim(),tagNextNumber:n(d.tagNextNumber),minWastage:n(d.minWastage),maxWastage:n(d.maxWastage),wastage:n(d.wastage),wastageMode:d.wastageMode==='grams'?'grams':'percent',makingRate:n(d.makingRate),makingMode:d.makingMode||'piece',stoneType:d.stoneType||'none',stonePieces:n(d.stonePieces),stoneCarat:n(d.stoneCarat),stoneCharge:n(d.stoneCharge),ornamentPurity:n(d.ornamentPurity),openingPieces:n(d.openingPieces),openingGross:n(d.openingGross),openingNet:n(d.openingNet),salesRequiredFields:required('salesRequiredFields'),purchaseRequiredFields:required('purchaseRequiredFields'),oldJewelRequiredFields:required('oldJewelRequiredFields'),isEcommerce:f.elements.isEcommerce.checked,description:String(d.description||'').trim(),createdAt:old?.createdAt||now,updatedAt:now};rcProductEdit='';glSaveDoc('retail-product',p,'Retail product')};
function glModelPage(){const rows=glModelRows(),x=rows.find(m=>m.id===glModelEdit),products=glProductRows(),groups=[...new Set([...glGroupRows().map(g=>g.name),...products.map(p=>p.group)].filter(Boolean))];return '<section class="panel"><div class="rc-section-title"><div><h2>'+(x?'Edit model':'Create model')+'</h2><p class="muted">Models connect to a Product and carry standard print, purity, wastage and tag defaults.</p></div><span>'+rows.length+' models</span></div><form class="rc-grid rc-master-form" onsubmit="glSaveModel(event)"><input type="hidden" name="id" value="'+esc(x?.id||'')+'"><label>Product group *<select name="group" required><option value="">Select group</option>'+groups.map(g=>'<option '+(g===(x?.group||'')?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label><label>Product *<select name="productId" required onchange="glModelProductChanged(this)"><option value="">Select product</option>'+products.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===x?.productId?'selected':'')+'>'+esc(p.name)+' · '+esc(p.metalType||'Gold')+'</option>').join('')+'</select></label><label>Model name *<input name="name" required maxlength="100" value="'+esc(x?.name||'')+'"></label><label>Model print name<input name="printName" value="'+esc(x?.printName||'')+'"></label><label>Model code<input name="code" maxlength="30" value="'+esc(x?.code||'')+'"></label><label>Metal<select name="metalType">'+glOption([['Gold','Gold'],['Silver','Silver'],['Platinum','Platinum'],['Other','Other']],x?.metalType||'Gold')+'</select></label><label>Ornament purity · %<input name="purity" type="number" min="1" max="100" step=".01" value="'+(x?.purity??92)+'"></label><label>Default weight · g<input name="defaultWeight" type="number" min="0" step=".001" value="'+(x?.defaultWeight??'')+'"></label><label>Minimum wastage<input name="minWastage" type="number" min="0" step=".01" value="'+(x?.minWastage??0)+'"></label><label>Minimum wastage type<select name="minWastageType">'+glOption([['percent','Percentage (%)'],['grams','Weight (g)']],x?.minWastageType||'percent')+'</select></label><label>Maximum wastage<input name="maxWastage" type="number" min="0" step=".01" value="'+(x?.maxWastage??0)+'"></label><label>Maximum wastage type<select name="maxWastageType">'+glOption([['percent','Percentage (%)'],['grams','Weight (g)']],x?.maxWastageType||'percent')+'</select></label><label>Tag prefix<input name="tagPrefix" value="'+esc(x?.tagPrefix||'')+'"></label><label>Tag next number<input name="tagNextNumber" type="number" min="0" step="1" value="'+(x?.tagNextNumber??'')+'"></label><label>Status<select name="status">'+glOption([['Active','Active'],['Disabled','Disabled']],x?.status||'Active')+'</select></label>'+glRenderReqDropdowns('data-gl-model-required',x,'Old jewellery required fields')+'<div class="rc-actions rc-wide"><button class="primary">'+(x?'Update model':'Save model')+'</button><button type="button" onclick="glModelEdit=\'\';render()">Clear</button></div></form></section><section class="panel"><h2>Model list · '+rows.length+'</h2>'+(rows.length?table(['Group','Product','Model','Print name','Code','Metal','Purity','Min wastage','Max wastage','Tag next','Status',''],rows.map(m=>[esc(m.group||'—'),esc(products.find(p=>p.id===m.productId)?.name||m.productName||'—'),esc(m.name),esc(m.printName||'—'),esc(m.code||'—'),esc(m.metalType||'Gold'),n(m.purity)+'%',n(m.minWastage)+' '+(m.minWastageType==='grams'?'g':'%'),n(m.maxWastage)+' '+(m.maxWastageType==='grams'?'g':'%'),esc(m.tagNextNumber||m.tagPrefix||'—'),esc(m.status||'Active'),'<button type="button" onclick="glEditModel(\''+esc(m.id)+'\')">Edit</button>'])):'<p class="muted">Create a Product first, then add its models here.</p>')+'</section>'}
window.glModelProductChanged=function(s){const p=glProductRows().find(x=>x.id===s.value),f=s.form;if(!p)return;f.elements.group.value=p.group||'';f.elements.metalType.value=p.metalType||'Gold';f.elements.purity.value=p.purity||92;f.elements.minWastage.value=p.minWastage??p.wastage??0;f.elements.maxWastage.value=p.maxWastage??p.wastage??0;f.elements.minWastageType.value=p.wastageMode||'percent';f.elements.maxWastageType.value=p.wastageMode||'percent';f.elements.tagPrefix.value=p.tagPrefix||'';f.elements.tagNextNumber.value=p.tagNextNumber||''};
window.glEditModel=id=>{glModelEdit=id;glProductStep='Model';render()};
window.glSaveModel=function(e){e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),name=String(d.name||'').trim(),p=glProductRows().find(x=>x.id===d.productId),old=glModelRows().find(x=>x.id===d.id);if(!p||!name)return say('Select a Product and enter a Model name.');const code=String(d.code||'').trim();if(code&&glModelRows().some(x=>x.id!==d.id&&String(x.code||'').toLowerCase()===code.toLowerCase()))return say('That model code is already in use.');if(d.id&&!confirm('Save changes to this model?'))return;const picked=key=>[...f.querySelectorAll('[data-gl-model-required="'+key+'"]:checked')].map(el=>el.value),now=new Date().toISOString(),row={...(old||{}),id:d.id||crypto.randomUUID(),kind:'retail-model',accountType:'customer',group:String(d.group||p.group||'').trim(),productId:p.id,productName:p.name,name,printName:String(d.printName||'').trim(),code,metalType:d.metalType||p.metalType||'Gold',purity:n(d.purity),defaultWeight:n(d.defaultWeight),minWastage:n(d.minWastage),minWastageType:d.minWastageType||'percent',maxWastage:n(d.maxWastage),maxWastageType:d.maxWastageType||'percent',tagPrefix:String(d.tagPrefix||'').trim(),tagNextNumber:n(d.tagNextNumber),status:d.status||'Active',salesRequiredFields:picked('salesRequiredFields'),purchaseRequiredFields:picked('purchaseRequiredFields'),oldJewelRequiredFields:picked('oldJewelRequiredFields'),createdAt:old?.createdAt||now,updatedAt:now};glModelEdit='';glSaveDoc('retail-model',row,'Retail model')};
// Remember each product category in Retail tagging; product metal controls the
// matching manual Retail rate (silver board/pure or purity-based gold).
function glRateForProduct(product,purity){
  if(typeof window.rcRateForMetal==='function'){
    const m=product?.metalType||(String(product?.name||'').toLowerCase().includes('silver')?'Silver':'Gold');
    return window.rcRateForMetal(m,purity||product?.purity,product?.rateType,product?.manualRate);
  }
  if(!product)return v2RateForPurity(purity);
  if(product.rateType==='manual'&&n(product.manualRate)>0)return n(product.manualRate);
  if(String(product.metalType||'').toLowerCase()==='silver')return product.rateType==='silver-pure'?n(db.rates.silver):n(db.rates.silverBoard)||n(db.rates.silver);
  return v2RateForPurity(purity||product.purity||92);
}
function glFindProduct(name,id){return glProductRows().find(p=>id&&p.id===id)||glProductRows().find(p=>String(p.name).toLowerCase()===String(name||'').toLowerCase())}
const glOldApplyProduct=window.rcApplyProduct;
window.rcApplyProduct=function(select){glOldApplyProduct(select);const p=glFindProduct(select.value),row=select.closest('.rb-item');if(!p||!row)return;row.dataset.metalType=p.metalType||'Gold';const rate=row.querySelector('[data-item="rate"]');if(rate)rate.value=glRateForProduct(p,p.purity||row.querySelector('[data-item="purity"]')?.value).toFixed(2);for(const [k,v] of Object.entries({metalType:p.metalType||'Gold',rateType:p.rateType||'metal-default'})){let el=row.querySelector('[data-item="'+k+'"]');if(!el){row.insertAdjacentHTML('beforeend','<input type="hidden" data-item="'+k+'">');el=row.querySelector('[data-item="'+k+'"]')}el.value=v}rbMarkDirty(select.form);rbRecalc(select.form)};
const glOldQuoteItemRow=window.rcItemRow;
window.rcItemRow=function(x={}){const html=glOldQuoteItemRow(x);return html.replace('<select data-rc="product" required','<select data-rc="product" required onchange="glQuoteProductChanged(this)"')};
window.glQuoteProductChanged=function(select){const p=glFindProduct(select.value),row=select.closest('.rc-item');if(!p||!row)return;const values={purity:p.ornamentPurity||p.purity||92,wastage:p.wastage||0,wastageMode:p.wastageMode||'percent',makingRate:p.makingRate||0,makingMode:p.makingMode||'piece',rate:glRateForProduct(p,p.ornamentPurity||p.purity)};for(const [key,value] of Object.entries(values)){let el=row.querySelector('[data-rc="'+key+'"]');if(el)el.value=value}row.dataset.metalType=p.metalType||'Gold';row.closest('form').dataset.entryDirty='1';rcRecalc()};
const glOldApplyTag=window.rcApplyTag;
window.rcApplyTag=function(select){glOldApplyTag(select);const tag=glDocs('retail-tagging').find(t=>t.tagCode===select.value),row=select.closest('.rc-item'),p=glFindProduct(tag?.product,tag?.productId);if(!tag||!row)return;const rate=row.querySelector('[data-rc="rate"]');if(rate)rate.value=glRateForProduct(p,tag.purity).toFixed(2);row.dataset.metalType=tag.metalType||p?.metalType||'Gold';row.closest('form').dataset.entryDirty='1';rcRecalc()};
// Scan/type a Retail tag in the bill: fill the linked product's identity and
// stock values, then switch to its metal's rate book entry.
window.rbApplyTagData=function(row,tag){
  if(!row||!tag)return;
  const form=row.closest('form');
  const p=glFindProduct(tag.product,tag.productId);
  const metalType=tag.metalType||p?.metalType||(String(tag.product||'').toLowerCase().includes('silver')?'Silver':'Gold');

  // 1. Ensure product option exists and select it
  const prodSel=row.querySelector('[data-item="product"]');
  if(prodSel&&tag.product){
    if(![...prodSel.options].some(o=>o.value===tag.product)){
      prodSel.add(new Option(tag.product,tag.product));
    }
    prodSel.value=tag.product;
  }

  // 2. Weights & pieces
  const gross=n(tag.grossWeight??tag.netWeight);
  const less=n(tag.lessWeight||0);
  const net=Math.max(0,gross-less);
  const pcs=n(tag.pieces||1);
  const grossIn=row.querySelector('[data-item="grossWeight"]');if(grossIn)grossIn.value=gross;
  const lessIn=row.querySelector('[data-item="lessWeight"]');if(lessIn)lessIn.value=less;
  const pcsIn=row.querySelector('[data-item="pieces"]');if(pcsIn)pcsIn.value=pcs;
  const netOut=row.querySelector('[data-out="netWeight"]');if(netOut)netOut.textContent=fmt(net);

  // 3. Purity option & value
  const isSilver = metalType==='Silver'||String(tag.product||'').toLowerCase().includes('silver');
  const purityVal=tag.purity||(isSilver?92.5:22);
  const purSel=row.querySelector('[data-item="purity"]');
  const purCell=row.querySelector('.rb-purity-cell')||purSel?.closest('td');
  let naSpan=row.querySelector('.rb-purity-na');
  if(isSilver){
    if(purSel) purSel.style.display='none';
    if(!naSpan&&purCell){
      purCell.insertAdjacentHTML('afterbegin','<span class="rb-purity-na muted">—</span>');
    } else if(naSpan){
      naSpan.style.display='inline';
    }
  } else {
    if(purSel) purSel.style.display='';
    if(naSpan) naSpan.style.display='none';
  }
  if(purSel){
    if(![...purSel.options].some(o=>Number(o.value)===Number(purityVal))){
      purSel.add(new Option(purityVal+(Number(purityVal)<=24?'K':'%'),purityVal));
    }
    purSel.value=purityVal;
  }

  // 4. Wastage & Making
  const wstIn=row.querySelector('[data-item="wastage"]');if(wstIn)wstIn.value=tag.wastage||0;
  const wstMode=row.querySelector('[data-item="wastageMode"]');if(wstMode)wstMode.value=tag.wastageMode||'percent';
  const mcIn=row.querySelector('[data-item="makingRate"]');if(mcIn)mcIn.value=tag.makingRate||0;
  const mcMode=row.querySelector('[data-item="makingMode"]');if(mcMode)mcMode.value=tag.makingMode||'piece';

  // 5. Details
  const huidIn=row.querySelector('[data-item="huid"]');if(huidIn)huidIn.value=tag.huid||'';
  const tagIn=row.querySelector('[data-item="tagCode"]');if(tagIn)tagIn.value=tag.tagCode;
  const hsnIn=row.querySelector('[data-item="hsn"]');if(hsnIn)hsnIn.value=tag.hsn||'';
  const descIn=row.querySelector('[data-item="description"]');if(descIn)descIn.value=tag.printName||'';
  const grpIn=row.querySelector('[data-item="productGroup"]');if(grpIn)grpIn.value=tag.group||'';
  const stoneChg=row.querySelector('[data-item="certificateCharge"]');if(stoneChg)stoneChg.value=tag.stoneCharge||0;
  const stonePcs=row.querySelector('[data-item="stonePieces"]');if(stonePcs)stonePcs.value=tag.stonePieces||0;
  const stoneWt=row.querySelector('[data-item="stoneWeight"]');if(stoneWt)stoneWt.value=tag.stoneCarat||0;

  // 6. Rate from Rate Book (or tag.rate)
  let rate=typeof window.rcRateForMetal==='function'?window.rcRateForMetal(metalType,purityVal,p?.rateType,p?.manualRate):glRateForProduct(p,purityVal);
  if((!rate||rate<=0)&&n(tag.rate)>0)rate=n(tag.rate);
  const rateIn=row.querySelector('[data-item="rate"]');if(rateIn)rateIn.value=Number(rate||0).toFixed(2);

  // 7. Metal type attribute & hidden input
  row.dataset.metalType=metalType;
  let mField=row.querySelector('[data-item="metalType"]');
  if(!mField){
    row.insertAdjacentHTML('beforeend','<input type="hidden" data-item="metalType">');
    mField=row.querySelector('[data-item="metalType"]');
  }
  if(mField)mField.value=metalType;

  // 8. Immediately mark dirty and recalculate bill
  if(form){
    rbMarkDirty(form);
    rbRecalc(form);
  }
};

window.rbQuickTagScan=function(code,triggerEl){
  const clean=String(code||'').trim();
  if(!clean)return say('Enter or scan a tag / barcode.');
  const tag=glDocs('retail-tagging').find(t=>String(t.tagCode).toLowerCase()===clean.toLowerCase());
  if(!tag)return say('Tag "'+clean+'" not found in stock.');
  const form=document.getElementById('customerSaleForm');
  if(!form)return say('Open Retail Sales Entry to load tags.');

  // Find an empty row or add one
  let rows=[...form.querySelectorAll('.rb-item')];
  let targetRow=rows.find(r=>!r.querySelector('[data-item="tagCode"]')?.value&&!r.querySelector('[data-item="grossWeight"]')?.value);
  if(!targetRow){
    window.rbAddItem();
    rows=[...form.querySelectorAll('.rb-item')];
    targetRow=rows.at(-1);
  }
  if(targetRow){
    window.rbApplyTagData(targetRow,tag);
    const qIn=document.getElementById('rbQuickTagInput');
    if(qIn){qIn.value='';qIn.focus();}
    say('✓ Loaded '+(tag.metalType||'Gold')+' tag '+tag.tagCode+': '+(tag.product||'item')+' · Rate ₹'+rateMoney(tag.rate||row.querySelector('[data-item="rate"]')?.value||0)+'/g');
  }
};

// Listen on change, input, and keydown for tagCode inside items table
document.addEventListener('change',event=>{
  const field=event.target;
  if(field?.dataset?.item!=='tagCode'||!field.closest('.rb-item')||workspaceMode!=='retail')return;
  const tag=glDocs('retail-tagging').find(t=>String(t.tagCode).toLowerCase()===String(field.value).trim().toLowerCase());
  if(tag)window.rbApplyTagData(field.closest('.rb-item'),tag);
},true);

document.addEventListener('keydown',event=>{
  const field=event.target;
  if(event.key==='Enter'&&field?.dataset?.item==='tagCode'&&field.closest('.rb-item')&&workspaceMode==='retail'){
    event.preventDefault();
    const tag=glDocs('retail-tagging').find(t=>String(t.tagCode).toLowerCase()===String(field.value).trim().toLowerCase());
    if(tag)window.rbApplyTagData(field.closest('.rb-item'),tag);
    else say('Tag "'+field.value+'" not found in stock.');
  }
},true);

// Retail sales bill now has native rb-tag-field-unified directly in rbBillView
const glProductStyle=document.createElement('style');glProductStyle.textContent=`
.gl-product-switch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 12px}
.gl-product-card{display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto;align-items:center;text-align:left;gap:2px 10px;min-height:64px;padding:10px 14px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--white,#fff);color:var(--ink,#222);box-shadow:0 2px 8px #2d25200a}
.gl-product-card>span{grid-row:1/3;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#f4ead7;color:#8d651f;font-size:20px}
.gl-product-card b{font-size:14px}
.gl-product-card small{font-size:11px;color:var(--muted,#777)}
.gl-product-card.active{border-color:#a77a33;box-shadow:0 0 0 2px #a77a331f;background:linear-gradient(135deg,#fffcf6,#fff)}
.gl-req-separated-section{display:contents}
.gl-req-sep-header{display:none}
.gl-req-group{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--line,#e2d9c8);border-radius:10px;background:#faf7f1}
.gl-req-dropdown-btn{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:0;padding:0;border:0;border-radius:0;background:transparent;text-align:left;cursor:default;pointer-events:none}
.gl-req-right-meta{display:none}
.gl-req-dropdown-body{display:block}
.gl-req-title{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#5c4d35}
.gl-check-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 8px;margin-top:2px}
.gl-check-list label.gl-tick-chip{display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;min-height:32px!important;height:auto!important;padding:5px 8px!important;margin:0!important;border:1px solid #dfd5c3!important;border-radius:8px!important;background:#fff!important;font-size:11.5px!important;font-weight:600!important;line-height:1.2!important;color:#2c251d!important;cursor:pointer;user-select:none;box-sizing:border-box}
.gl-check-list label.gl-tick-chip:has(input:checked){border-color:#b88728!important;background:#fdf6e4!important;color:#6e4d0c!important}
.gl-check-list label.gl-tick-chip input[type="checkbox"]{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;max-width:15px!important;max-height:15px!important;padding:0!important;margin:0!important;flex:0 0 15px!important;accent-color:#18392a;border-radius:4px}
.gl-check-list label.gl-tick-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gl-span-two{grid-column:span 2}
@media(max-width:760px){
  .gl-product-switch{gap:6px;margin-bottom:8px}
  .gl-product-card{grid-template-columns:28px 1fr;gap:2px 6px;min-height:56px;padding:7px;border-radius:10px}
  .gl-product-card>span{width:28px;height:28px;font-size:16px;border-radius:8px}
  .gl-product-card b{font-size:12px;white-space:nowrap}
  .gl-product-card small{font-size:9px;line-height:1.1}
  .gl-span-two{grid-column:1/-1}
  .gl-req-separated-section{grid-column:1/-1!important;display:flex!important;flex-direction:column!important;gap:10px!important;margin:6px 0 4px!important;padding:12px!important;border:1.5px solid #e2d5c1!important;border-radius:14px!important;background:#faf6ee!important;box-sizing:border-box!important}
  .gl-req-sep-header{display:flex!important;flex-direction:column!important;gap:2px!important;padding-bottom:6px!important;border-bottom:1px dashed #d8c9b0!important}
  .gl-req-sep-header span{font-size:11.5px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.04em!important;color:#4a3b24!important}
  .gl-req-sep-header small{font-size:10.5px!important;color:#786851!important}
  .gl-req-group{padding:0!important;border:1.5px solid #dfd5c3!important;border-radius:11px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 2px 6px rgba(45,35,18,0.04)!important;gap:0!important}
  .gl-req-group.is-open{border-color:#b88728!important;box-shadow:0 4px 12px rgba(184,135,40,0.12)!important}
  .gl-req-dropdown-btn{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;width:100%!important;min-height:46px!important;padding:10px 13px!important;border:0!important;border-radius:0!important;background:linear-gradient(180deg,#fffefa 0%,#f7f1e4 100%)!important;cursor:pointer!important;pointer-events:auto!important;box-sizing:border-box!important}
  .gl-req-group.is-open .gl-req-dropdown-btn{background:linear-gradient(180deg,#fdf6e4 0%,#f5e8c7 100%)!important;border-bottom:1px solid #e6d4a7!important}
  .gl-req-title{font-size:12px!important;font-weight:800!important;color:#3d2f1a!important}
  .gl-req-right-meta{display:inline-flex!important;align-items:center!important;gap:8px!important;flex-shrink:0!important}
  .gl-req-count-badge{display:inline-flex!important;align-items:center!important;padding:2px 8px!important;border-radius:999px!important;background:#efe7d6!important;border:1px solid #d9cbb3!important;color:#655640!important;font-size:10.5px!important;font-weight:750!important}
  .gl-req-count-badge.has-selected{background:#18392a!important;border-color:#18392a!important;color:#fff!important}
  .gl-req-caret{font-size:13px!important;font-weight:900!important;color:#785a28!important;line-height:1!important}
  .gl-req-dropdown-body{display:none!important;padding:10px 11px 12px!important;background:#fffdfa!important}
  .gl-req-group.is-open .gl-req-dropdown-body{display:block!important}
  .gl-check-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;margin-top:0}
  .gl-check-list label.gl-tick-chip{min-height:34px!important;padding:5px 8px!important;font-size:11.5px!important;gap:6px!important}
  .gl-check-list label.gl-tick-chip input[type="checkbox"]{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;flex:0 0 15px!important}
}
@media(max-width:360px){
  .gl-product-card{grid-template-columns:1fr;text-align:center;padding:6px 3px;gap:2px}
  .gl-product-card>span{grid-row:auto;justify-self:center;width:25px;height:25px}
  .gl-product-card small{display:none}
}`;
document.head.append(glProductStyle);
const glOldHistory=window.updateHistoryView;
window.updateHistoryView=function(){
  let html = glOldHistory ? glOldHistory() : '';
  html = html.replace(/Goldleaf v[0-9.]+/g, 'Goldleaf v2.10.35');
  html = html.replace(/<h2>Current version<\/h2><p><b>[^<]+<\/b> · [^<]+<\/p>/, '<h2>Current version</h2><p><b>Goldleaf v2.10.35</b> · 12 Nov 2026</p>');
  html = html.replace(/<h3>v[0-9.]+ · [^<]*Current<\/h3>/g, '<h3>v2.10.30 · 12 Nov 2026</h3>');
  const v31Note = '<article class="release-note"><h3>v2.10.31 · 12 Nov 2026 · Current</h3><ul>'
    + '<li>Mobile Workspace Context Banner Removal: Completely removed redundant top workspace context banner ("GOLDLEAF · RETAIL", "RETAIL WORKSPACE", duplicate section selectors, and header identity cards) across all mobile pages.</li>'
    + '<li>Screen Real Estate Maximization: Content cards, quotation forms, and dashboards start directly below the sticky navigation bar on mobile phones.</li>'
    + '</ul></article>';
  return html.replace('<h2>Update history</h2>', '<h2>Update history</h2>' + v31Note);
};
render();
