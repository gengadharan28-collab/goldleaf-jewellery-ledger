// Shop-owned PDF layouts, branding, and optional Retail GST.
const pdfPreviousFocusedEdit=window.v2HasFocusedEdit;
window.v2HasFocusedEdit=function(){return pdfPreviousFocusedEdit()||!!document.querySelector('.more-menu.open,#pdfTemplatePreview,#pdfDocumentPreview,#pdfSettingsForm[data-dirty="1"]');};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const d=document.getElementById('pdfDocumentPreview')||document.getElementById('pdfTemplatePreview');if(d){event.preventDefault();d.remove();}}});

const PDF_LAYOUTS = {
  classic: { name: 'Classic Invoice', description: 'Traditional bordered tax invoice · A4 portrait', size: 'A4 portrait', kind: 'sales' },
  detailed: { name: 'Detailed Manufacturing', description: 'Full line-item calculations & weights · A4 landscape', size: 'A4 landscape', kind: 'sales' },
  modern: { name: 'Modern Branded', description: 'Clean jewel-tone header with branded cards · A4 portrait', size: 'A4 portrait', kind: 'sales' },
  'compact-a5-p': { name: 'Compact Bill (A5 Portrait)', description: 'Clean half-sheet slip for laser/deskjet · A5 portrait', size: 'A5 portrait', kind: 'sales' },
  'compact-a5-l': { name: 'Compact Bill (A5 Landscape)', description: 'Wide half-sheet invoice format · A5 landscape', size: 'A5 landscape', kind: 'sales' },
  'thermal-80': { name: 'Thermal POS Slip (80mm / 3")', description: 'Continuous roll receipt with UPI QR code · 3-inch POS', size: '80mm auto', kind: 'sales' },
  'thermal-58': { name: 'Thermal POS Slip (58mm / 2")', description: 'Pocket continuous roll receipt · 2-inch mini POS', size: '58mm auto', kind: 'sales' }
};

const PDF_ESTIMATE_LAYOUTS = {
  'detailed-estimate': { name: 'Detailed Quotation', description: 'Full estimate with item breakdown, gold rate & terms · A4 portrait', size: 'A4 portrait', kind: 'estimate' },
  'compact-estimate-a5': { name: 'Compact Quote (A5 Portrait)', description: 'Half-sheet customer quote slip · A5 portrait', size: 'A5 portrait', kind: 'estimate' },
  'compact-estimate-a5l': { name: 'Compact Quote (A5 Landscape)', description: 'Horizontal half-sheet estimate slip · A5 landscape', size: 'A5 landscape', kind: 'estimate' },
  'thermal-estimate-80': { name: 'Thermal Estimate Slip (80mm / 3")', description: 'Continuous roll counter quotation with gold rate & QR · 3-inch POS', size: '80mm auto', kind: 'estimate' },
  'thermal-estimate-58': { name: 'Thermal Estimate Slip (58mm / 2")', description: 'Mini 2-inch continuous roll estimate slip', size: '58mm auto', kind: 'estimate' }
};

let pdfProfile=null,pdfProfileShop='',pdfProfileLoading=false;
const pdfMode=()=>workspaceMode==='retail'?'retail':'wholesale';
const pdfMoney=value=>'₹ '+n(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const pdfRound=value=>Math.round((n(value)+Number.EPSILON)*100)/100;

function pdfConfig(mode=pdfMode()){
  const saved=db.pdfSettings?.[mode]||{},profile=pdfProfileShop===goldleafContext?.shop_id?pdfProfile||{}:{};
  const defaults = {
    template: 'classic',
    estimateTemplate: 'detailed-estimate',
    thermalSize: '3inch',
    thermalFeed: 3,
    estimateBottomMargin: "Thanks for visiting! Quotations are valid for today's gold rate only and subject to bullion market fluctuations.",
    shopName: goldleafContext?.shop_name||'Your jewellery shop',
    address: profile.address||'',
    phone: profile.phone||'',
    gstNumber: profile.gst_number||'',
    headerText: '',
    footerText: 'Thank you for your business. Estimates are subject to gold rate changes.',
    alignment: 'template',
    // Print Column & Field Visibility Toggles
    showGrossLess: true,
    showNetWeight: true,
    showWastage: true,
    showMaking: true,
    showHuid: true,
    showStones: true,
    showExchange: true,
    showBankQR: true,
    showTerms: true,
    showExpiry: true,
    // Bank & Payment QR details
    bankName: '',
    bankBranch: '',
    accountNo: '',
    ifsc: '',
    upiId: '',
    gst: { enabled: false, rate: 3, mode: 'cgst_sgst', hsn: '' }
  };
  return Object.assign(defaults, saved, {
    template: PDF_LAYOUTS[saved.template] ? saved.template : 'classic',
    estimateTemplate: PDF_ESTIMATE_LAYOUTS[saved.estimateTemplate] ? saved.estimateTemplate : 'detailed-estimate',
    gst: Object.assign({ enabled: false, rate: 3, mode: 'cgst_sgst', hsn: '' }, saved.gst || {})
  });
}

async function pdfLoadProfile(){
  if(!client||!session||!goldleafContext?.shop_id||pdfProfileLoading||pdfProfileShop===goldleafContext.shop_id)return;
  pdfProfileLoading=true;const shopId=goldleafContext.shop_id;
  try{const {data,error}=await client.from('goldleaf_shops').select('shop_name,address,phone,gst_number').eq('id',shopId).single();if(!error&&goldleafContext?.shop_id===shopId){pdfProfile=data;pdfProfileShop=shopId;if(page==='Settings'&&!v2HasFocusedEdit()&&!document.getElementById('pdfSettingsForm')?.dataset.dirty)render();}}catch{}finally{pdfProfileLoading=false;}
}

const pdfPreviousMerge=window.v2MergeCloudLedgers;
window.v2MergeCloudLedgers=function(remote,local,preferLocal=true){
  const merged=pdfPreviousMerge(remote,local,preferLocal);merged.pdfSettings={};
  for(const mode of ['retail','wholesale']){const a=remote?.pdfSettings?.[mode],b=local?.pdfSettings?.[mode];if(a||b)merged.pdfSettings[mode]=b&&(!a||Date.parse(b.updatedAt||'')>Date.parse(a.updatedAt||''))?b:a;}
  return merged;
};

function pdfSettingField(label,name,value,type='text',extra=''){return '<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';}

function pdfSettingsPanel(){
  const mode=pdfMode(),c=pdfConfig(mode),retail=mode==='retail';
  
  // Sales bill layout choices
  const salesCards=Object.entries(PDF_LAYOUTS).map(([id,item])=>
    '<div class="pdf-choice '+(c.template===id?'selected':'')+'">'
    +'<label><input type="radio" name="template" value="'+id+'" '+(c.template===id?'checked':'')+'>'
    +'<b>'+item.name+'</b><span class="pdf-mini pdf-mini-'+(id.startsWith('thermal')?'thermal':id.startsWith('compact')?'compact':id)+'"><i></i><i></i><i></i></span>'
    +'<small>'+esc(item.description)+'</small></label>'
    +'<button type="button" onclick="previewPdfTemplate(\''+id+'\',\'bill\')">Preview</button>'
    +'</div>'
  ).join('');

  // Estimation layout choices (Retail mode only)
  const estimateCards = retail ? Object.entries(PDF_ESTIMATE_LAYOUTS).map(([id,item])=>
    '<div class="pdf-choice '+(c.estimateTemplate===id?'selected':'')+'">'
    +'<label><input type="radio" name="estimateTemplate" value="'+id+'" '+(c.estimateTemplate===id?'checked':'')+'>'
    +'<b>'+item.name+'</b><span class="pdf-mini pdf-mini-'+(id.startsWith('thermal')?'thermal':id.includes('compact')?'compact':'detailed')+'"><i></i><i></i><i></i></span>'
    +'<small>'+esc(item.description)+'</small></label>'
    +'<button type="button" onclick="previewPdfTemplate(\''+id+'\',\'estimate\')">Preview</button>'
    +'</div>'
  ).join('') : '';

  const estimateSection = retail ? 
    '<div class="pdf-settings-subhead"><h3>Estimation & Quotation Print Format</h3><p class="hint">Choose default layout for customer quotations and estimations across desktop and thermal printers.</p></div>'
    +'<div class="pdf-choices pdf-estimate-choices">'+estimateCards+'</div>' : '';

  // Field visibility toggles
  const toggles = retail ?
    '<fieldset class="pdf-toggles-fieldset">'
    +'<legend>Print Field & Column Visibility</legend>'
    +'<p class="hint">Toggle item details, weights, stone details, and banking information shown on Sales Bills and Estimations.</p>'
    +'<div class="pdf-toggle-grid">'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showGrossLess" '+(c.showGrossLess?'checked':'')+'> Gross Wt & Less Wt</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showNetWeight" '+(c.showNetWeight?'checked':'')+'> Net Gold / Silver Weight</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showWastage" '+(c.showWastage?'checked':'')+'> Wastage % & Wastage Wt</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showMaking" '+(c.showMaking?'checked':'')+'> Making Charges / Labour</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showHuid" '+(c.showHuid?'checked':'')+'> HUID / Tag Barcode</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showStones" '+(c.showStones?'checked':'')+'> Stone & Diamond Breakup</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showExchange" '+(c.showExchange?'checked':'')+'> Old Gold Exchange Details</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showBankQR" '+(c.showBankQR?'checked':'')+'> Bank Details & UPI Payment QR</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showTerms" '+(c.showTerms?'checked':'')+'> Terms & Signature Blocks</label>'
    +'<label class="pdf-checkbox"><input type="checkbox" name="showExpiry" '+(c.showExpiry?'checked':'')+'> Estimation Expiry / Validity Date</label>'
    +'</div>'
    +'</fieldset>' : '';

  // Thermal POS Printer Configuration
  const thermalSettings = 
    '<fieldset class="pdf-thermal-settings">'
    +'<legend>Thermal POS Printer Configuration</legend>'
    +'<p class="hint">Configure default thermal roll width, feed spacing, and estimation disclaimer footer.</p>'
    +'<div class="grid">'
    +'<label class="field">Thermal Printer Roll Size<select name="thermalSize">'
    +'<option value="3inch" '+(c.thermalSize==='3inch'?'selected':'')+'>3 Inch (80mm) · Standard POS (Recommended)</option>'
    +'<option value="2inch" '+(c.thermalSize==='2inch'?'selected':'')+'>2 Inch (58mm) · Mini Bluetooth Slip</option>'
    +'<option value="4inch" '+(c.thermalSize==='4inch'?'selected':'')+'>4 Inch (100mm) · Wide Thermal</option>'
    +'<option value="custom" '+(c.thermalSize==='custom'?'selected':'')+'>Custom Width</option>'
    +'</select></label>'
    +pdfSettingField('Feed blank lines at end','thermalFeed',c.thermalFeed,'number','min="0" max="10" step="1"')
    +'</div>'
    +'<label class="field wide">Default Estimation Bottom Margin / Disclaimer Text<textarea name="estimateBottomMargin" rows="2" maxlength="300">'+esc(c.estimateBottomMargin||'')+'</textarea></label>'
    +'</fieldset>';

  // Bank & UPI QR Settings
  const bankSettings = 
    '<fieldset class="pdf-bank-settings">'
    +'<legend>Shop Bank Account & UPI Payment Details</legend>'
    +'<p class="hint">Bank account details and UPI ID generate a scannable dynamic payment QR code on printed bills and quotations.</p>'
    +'<div class="grid">'
    +pdfSettingField('Bank name','bankName',c.bankName||'','text','placeholder="e.g. State Bank of India / HDFC Bank"')
    +pdfSettingField('Branch name','bankBranch',c.bankBranch||'','text','placeholder="e.g. Main Branch, Madurai"')
    +pdfSettingField('Account number','accountNo',c.accountNo||'','text','placeholder="e.g. 50200012345678"')
    +pdfSettingField('IFSC code','ifsc',c.ifsc||'','text','placeholder="e.g. SBIN0001234" maxlength="11"')
    +pdfSettingField('UPI ID for Payment QR Code','upiId',c.upiId||'','text','placeholder="e.g. yourshop@upi / 9876543210@okaxis"')
    +'</div>'
    +'</fieldset>';

  // Optional Retail GST Settings
  const gst=retail?'<fieldset class="pdf-gst-settings"><legend>Optional Retail GST</legend><label class="pdf-checkbox"><input type="checkbox" name="gstEnabled" '+(c.gst.enabled?'checked':'')+'> Enable GST by default for new Retail bills</label><p class="hint">GST can be switched on or off for each bill. It is calculated on the new sale after discount, before old gold credit and collection.</p><div class="grid">'+pdfSettingField('GST percentage','gstRate',c.gst.rate,'number','min="0" max="100" step=".01"')+'<label class="field">Tax split<select name="gstMode"><option value="cgst_sgst" '+(c.gst.mode!=='igst'?'selected':'')+'>CGST + SGST</option><option value="igst" '+(c.gst.mode==='igst'?'selected':'')+'>IGST</option></select></label>'+pdfSettingField('Default HSN · optional','hsn',c.gst.hsn)+'</div></fieldset>':'';

  return '<section class="panel pdf-settings-panel">'
    +'<div class="pdf-settings-header">'
    +'<h2>'+ (retail?'Retail':'Wholesale')+' · Bill & PDF Print Settings</h2>'
    +'<p class="hint">Select templates for Sales Bills and Estimations across A4, A5, and Thermal 80mm/58mm sizes. Formats are saved and used across your workspace.</p>'
    +'</div>'
    +'<form id="pdfSettingsForm" data-mode="'+mode+'" oninput="this.dataset.dirty=1" onsubmit="savePdfSettings(event)">'
    +'<div class="pdf-settings-subhead"><h3>Sales Bill & Invoice Print Format</h3><p class="hint">Choose default layout for customer sales tax bills and invoices.</p></div>'
    +'<div class="pdf-choices">'+salesCards+'</div>'
    +estimateSection
    +toggles
    +thermalSettings
    +bankSettings
    +'<div class="pdf-settings-subhead"><h3>Shop Header & Branding</h3></div>'
    +'<div class="grid">'
    +pdfSettingField('Shop name *','shopName',c.shopName,'text','required maxlength="160"')
    +pdfSettingField('Phone','phone',c.phone,'tel')
    +(retail?pdfSettingField('GSTIN · header','gstNumber',c.gstNumber,'text','maxlength="15"'):'')
    +'<label class="field">Header alignment<select name="alignment"><option value="template" '+(c.alignment==='template'?'selected':'')+'>Use template style</option><option value="left" '+(c.alignment==='left'?'selected':'')+'>Left</option><option value="center" '+(c.alignment==='center'?'selected':'')+'>Centre</option></select></label>'
    +'<label class="field wide">Shop address<textarea name="address" rows="2" maxlength="500">'+esc(c.address)+'</textarea></label>'
    +'<label class="field wide">Extra header line<textarea name="headerText" rows="2" maxlength="250">'+esc(c.headerText)+'</textarea></label>'
    +'<label class="field wide">Footer / terms<textarea name="footerText" rows="2" maxlength="800">'+esc(c.footerText)+'</textarea></label>'
    +'</div>'
    +gst
    +'<div class="right" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">'
    +'<button type="button" onclick="previewPdfTemplate(null,\'bill\')">Preview Bill</button>'
    +(retail?'<button type="button" onclick="previewPdfTemplate(null,\'estimate\')">Preview Estimation</button>':'')
    +'<button class="primary">Save PDF Settings</button>'
    +'</div>'
    +'<p id="pdfSettingsMessage" role="status" class="hint"></p>'
    +'</form>'
    +'</section>';
}

function pdfReadSettingsForm(){
  const form=document.getElementById('pdfSettingsForm');if(!form)return pdfConfig();
  const f=new FormData(form),mode=form.dataset.mode,c=pdfConfig(mode);
  return Object.assign({},c,{
    template: f.get('template')||'classic',
    estimateTemplate: f.get('estimateTemplate')||'detailed-estimate',
    thermalSize: f.get('thermalSize')||'3inch',
    thermalFeed: parseInt(f.get('thermalFeed')||3, 10),
    estimateBottomMargin: String(f.get('estimateBottomMargin')||'').trim(),
    showGrossLess: f.has('showGrossLess'),
    showNetWeight: f.has('showNetWeight'),
    showWastage: f.has('showWastage'),
    showMaking: f.has('showMaking'),
    showHuid: f.has('showHuid'),
    showStones: f.has('showStones'),
    showExchange: f.has('showExchange'),
    showBankQR: f.has('showBankQR'),
    showTerms: f.has('showTerms'),
    showExpiry: f.has('showExpiry'),
    bankName: String(f.get('bankName')||'').trim(),
    bankBranch: String(f.get('bankBranch')||'').trim(),
    accountNo: String(f.get('accountNo')||'').trim(),
    ifsc: String(f.get('ifsc')||'').trim().toUpperCase(),
    upiId: String(f.get('upiId')||'').trim(),
    shopName: String(f.get('shopName')||'').trim(),
    phone: String(f.get('phone')||'').trim(),
    gstNumber: String(f.get('gstNumber')||'').trim().toUpperCase(),
    address: String(f.get('address')||'').trim(),
    headerText: String(f.get('headerText')||'').trim(),
    footerText: String(f.get('footerText')||'').trim(),
    alignment: f.get('alignment')||'template',
    gst: mode==='retail'?{enabled:f.has('gstEnabled'),rate:n(f.get('gstRate')),mode:f.get('gstMode')==='igst'?'igst':'cgst_sgst',hsn:String(f.get('hsn')||'').trim()}:c.gst
  });
}

window.savePdfSettings=function(event){
  event.preventDefault();const c=pdfReadSettingsForm(),mode=event.target.dataset.mode;
  if(!c.shopName)return say('Enter the shop name.');
  if(mode==='retail'&&c.gst.enabled&&(c.gst.rate<=0||c.gst.rate>100))return say('Enter a GST percentage above 0 and up to 100, or switch GST off.');
  if(mode==='retail'&&c.gst.enabled&&!/^[A-Za-z0-9]{15}$/.test(c.gstNumber))return say('Enter your 15-character GSTIN in the PDF header to enable GST.');
  db.pdfSettings=Object.assign({},db.pdfSettings,{[mode]:Object.assign({},c,{updatedAt:new Date().toISOString()})});
  save();render();say((mode==='retail'?'Retail':'Wholesale')+' PDF settings saved.');
};

const pdfPreviousSettings=window.settingsView;
window.settingsView=function(){
  pdfLoadProfile();const html=pdfPreviousSettings(),end=html.indexOf('</header>');
  return end<0?pdfSettingsPanel()+html:html.slice(0,end+9)+pdfSettingsPanel()+html.slice(end+9);
};

const pdfBaseCustomerTotals=window.customerSaleTotals;
window.customerSaleTotals=function(x){
  const t=pdfBaseCustomerTotals(x),enabled=!!x.gstEnabled,rate=enabled?n(x.gstRate):0,mode=x.gstMode==='igst'?'igst':'cgst_sgst',taxableValue=pdfRound(t.final),gstAmount=enabled?pdfRound(taxableValue*rate/100):0,cgst=mode==='cgst_sgst'?pdfRound(gstAmount/2):0;
  return Object.assign({},t,{taxableValue,gstEnabled:enabled,gstRate:rate,gstMode:mode,gstAmount,cgst,sgst:mode==='cgst_sgst'?pdfRound(gstAmount-cgst):0,igst:mode==='igst'?gstAmount:0,final:pdfRound(taxableValue+gstAmount)});
};

function pdfGSTInputs(form){return {gstEnabled:!!form.elements.gstEnabled?.checked,gstRate:n(form.elements.gstRate?.value),gstMode:form.elements.gstMode?.value||'cgst_sgst'};}
function pdfRetailTotals(form){const f=form.elements;return customerSaleTotals({weight:f.weight.value,purity:f.purity.value,rate24:f.rate24.value,wastage:f.wastage.value,pieces:f.pieces.value,makingPerPiece:f.makingPerPiece.value,discount:f.discount.value,...pdfGSTInputs(form)});}
function pdfGSTEntryConfig(sale){return sale?{enabled:!!sale.gstEnabled,rate:n(sale.gstRate)||3,mode:sale.gstMode||'cgst_sgst',hsn:sale.hsn||''}:pdfConfig('retail').gst;}
function pdfGSTEntryMarkup(sale){
  const c=pdfGSTEntryConfig(sale);
  return '<div id="retailGSTPanel" class="retail-modal-backdrop hidden" aria-hidden="true" onclick="if(event.target===this)toggleRetailGST(false)"><section class="retail-modal erp-gst-modal" role="dialog" aria-modal="true" aria-labelledby="retailGSTTitle"><div class="retail-modal-head"><div><h2 id="retailGSTTitle">GST · optional</h2><p>Apply or remove GST for this bill.</p></div><button type="button" aria-label="Close GST" onclick="toggleRetailGST(false)">Close</button></div><div class="retail-modal-scroll"><label class="pdf-checkbox"><input name="gstEnabled" type="checkbox" '+(c.enabled?'checked':'')+' onchange="calcSale(this.form)"> Apply GST to this bill</label><div class="retail-gst-options '+(c.enabled?'':'hidden')+'"><div class="grid">'+pdfSettingField('GST %','gstRate',c.rate,'number','min="0" max="100" step=".01" oninput="calcSale(this.form)"')+'<label class="field">Tax split<select name="gstMode" onchange="calcSale(this.form)"><option value="cgst_sgst" '+(c.mode!=='igst'?'selected':'')+'>CGST + SGST</option><option value="igst" '+(c.mode==='igst'?'selected':'')+'>IGST</option></select></label>'+pdfSettingField('HSN · optional','hsn',c.hsn)+'</div><p class="hint">Taxable value: <b id="retailTaxableValue">₹ 0.00</b></p><p class="hint" id="retailGSTSplit"></p><p class="erp-gst-total">GST total <b id="retailGSTAmount">₹ 0.00</b></p></div></div><div class="retail-modal-actions"><button type="button" onclick="removeRetailGST()">Remove GST</button><button type="button" class="primary" onclick="finishRetailGST()">Done</button></div></section></div>';
}

const pdfPreviousSalesView=window.salesView;
window.salesView=function(){let html=pdfPreviousSalesView();if(moduleAccountType()==='customer'){const old=db.sales.find(x=>x.id===edit&&ownerType(x)==='customer'),c=pdfGSTEntryConfig(old),button='<button id="retailGSTToggle" class="exchange-toggle erp-gst-toggle" type="button" aria-expanded="false" aria-controls="retailGSTPanel" onclick="toggleRetailGST(true)">'+(c.enabled?'GST '+n(c.rate)+'%':'＋ Add GST')+'</button>';html=html.replace(/(<button id="oldGoldToggle"[\s\S]*?<\/button>)/,'<div class="retail-exchange-buttons">$1'+button+'</div>');html=html.replace('<div id="oldGoldPanel"',pdfGSTEntryMarkup(old)+'<div id="oldGoldPanel"');setTimeout(()=>{const f=document.getElementById('customerSaleForm');if(f)calcSale(f);},0);}return html;};
const pdfPreviousCalcSale=window.calcSale;
window.calcSale=function(form){pdfPreviousCalcSale(form);if(form?.elements.accountType?.value!=='customer')return;const t=pdfRetailTotals(form),options=form.querySelector('.retail-gst-options');options?.classList.toggle('hidden',!t.gstEnabled);const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};set('retailTaxableValue',pdfMoney(t.taxableValue));set('retailGSTAmount',pdfMoney(t.gstAmount));set('retailGSTSplit',t.gstMode==='igst'?'IGST '+pdfMoney(t.igst):'CGST '+pdfMoney(t.cgst)+' + SGST '+pdfMoney(t.sgst));const label=form.querySelector('#saleAfterDiscount')?.previousElementSibling;if(label)label.textContent=t.gstEnabled?'New sale including GST':'New sale after discount';window.erpSyncGSTButton?.(form);};
const pdfPreviousSaveSale=window.saveSale;
window.saveSale=function(event){const f=event.target;if(f.elements.accountType?.value==='customer'){const gst=pdfGSTInputs(f);if(gst.gstEnabled&&(gst.gstRate<=0||gst.gstRate>100)){event.preventDefault();return say('Enter a valid GST percentage, or switch it off.');}}return pdfPreviousSaveSale(event);};

function pdfTable(heads,rows){return '<table class="gl-pdf-table"><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function pdfTotals(rows){return '<table class="pdf-totals"><tbody>'+rows.map(([label,value,highlight])=>'<tr class="'+(highlight?'pdf-highlight':'')+'"><th>'+esc(label)+'</th><td>'+esc(value)+'</td></tr>').join('')+'</tbody></table>';}

function pdfHeader(model,c,isThermal=false){
  const align=c.alignment==='template'?(isThermal?'center':''):c.alignment;
  return '<header class="pdf-brand '+align+'">'
    +'<h1>'+esc(c.shopName)+'</h1>'
    +[c.address,c.phone?'Phone: '+c.phone:'',model.retail&&c.gstNumber?'GSTIN: '+c.gstNumber:'',c.headerText].filter(Boolean).map(text=>'<p>'+esc(text)+'</p>').join('')
    +'</header>'
    +'<div class="pdf-document-title">'+esc(model.title)+'</div>'
    +'<div class="pdf-meta">'
    +'<div><b>'+esc(model.entityLabel||'Customer')+': '+esc(model.entityName)+'</b><p>'+esc(model.entityDetails||'')+'</p></div>'
    +'<div><b>'+esc(model.reference||'')+'</b><p>'+esc(model.date||'')+'</p>'+(model.validUntil?'<p class="pdf-expiry-tag">Valid Until: '+esc(model.validUntil)+'</p>':'')+'</div>'
    +'</div>';
}

function pdfBankAndQRMarkup(c){
  if(!c.showBankQR || (!c.accountNo && !c.upiId)) return '';
  const qrUrl = c.upiId ? 'https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=4&data=' + encodeURIComponent('upi://pay?pa=' + c.upiId + '&pn=' + encodeURIComponent(c.shopName) + '&cu=INR') : '';
  return '<div class="pdf-bank-section">'
    +'<div class="pdf-bank-details">'
    +'<b>Bank Details for NEFT / RTGS / UPI:</b>'
    +(c.bankName ? '<p>Bank: ' + esc(c.bankName) + (c.bankBranch ? ' (' + esc(c.bankBranch) + ')' : '') + '</p>' : '')
    +(c.accountNo ? '<p>Account No: ' + esc(c.accountNo) + '</p>' : '')
    +(c.ifsc ? '<p>IFSC Code: ' + esc(c.ifsc) + '</p>' : '')
    +(c.upiId ? '<p>UPI ID: ' + esc(c.upiId) + '</p>' : '')
    +'</div>'
    +(qrUrl ? '<div class="pdf-bank-qr"><img src="' + qrUrl + '" alt="UPI QR" width="90" height="90"><small>Scan & Pay via UPI</small></div>' : '')
    +'</div>';
}

function pdfBillChitTag(item){
  const parts=[];
  if(n(item.chitWeight)>0)parts.push('Chit '+fmt(item.chitWeight)+'g');
  if(n(item.wastageDiscountAmount)>0)parts.push('VA−'+pdfMoney(item.wastageDiscountAmount));
  if(n(item.makingDiscountAmount)>0)parts.push('MC−'+pdfMoney(item.makingDiscountAmount));
  return parts.length?' ['+parts.join(' · ')+']':'';
}

function pdfBillColumns(item,template,retail,c={}){
  const showGrossLess = c.showGrossLess ?? true;
  const showNet = c.showNetWeight ?? true;
  const showWst = c.showWastage ?? true;
  const showMc = c.showMaking ?? true;
  const showHuid = c.showHuid ?? true;

  if(!retail){
    if(template==='compact-a5-p' || template==='compact-a5-l')return {heads:['Product','Weight / purity / wastage','Pcs','Pure payable g','Hallmark ₹'],row:[item.product,fmt(item.weight)+' g · '+item.purity+'% + '+item.wastage+'%',item.pieces,fmt(item.pure),pdfMoney(item.hallmark)]};
    if(template==='modern')return {heads:['Jewellery','Gross g','Purity %','Wastage %','Pure payable g','Hallmark type','Hallmark ₹'],row:[item.product,fmt(item.weight),item.purity,item.wastage,fmt(item.pure),item.hallmarkType||'—',pdfMoney(item.hallmark)]};
    return {heads:['Product','Weight g','Pcs','Purity %','Wastage %','Pure payable g','Hallmark','Fee / pc ₹','Hallmark total ₹'],row:[item.product,fmt(item.weight),item.pieces,item.purity,item.wastage,fmt(item.pure),item.hallmarkType||'—',pdfMoney(item.hallmarkRate),pdfMoney(item.hallmark)]};
  }

  const chitTag = pdfBillChitTag(item);

  if(template==='detailed' || template==='detailed-estimate'){
    const heads=['Item / Description'];
    const row=[item.product + (showHuid && item.huid ? ' [HUID: ' + item.huid + ']' : (showHuid && item.tagCode ? ' [' + item.tagCode + ']' : '')) + chitTag];
    if(item.hsn){ heads.push('HSN'); row.push(item.hsn); }
    heads.push('Pcs'); row.push(item.pieces||1);
    if(showGrossLess){ heads.push('Gross g','Less g'); row.push(fmt(item.grossWeight||item.weight), fmt(item.lessWeight||0)); }
    if(showNet){ heads.push('Net g'); row.push(fmt(item.netWeight||item.weight)); }
    heads.push('Purity'); row.push(item.purity ? item.purity + (String(item.purity).includes('%')||String(item.purity).includes('K')?'':'K') : '22K');
    heads.push('Rate / g ₹'); row.push(pdfMoney(item.rate));
    if(showWst){ heads.push('Wst %'); row.push(item.wastage||'0'); }
    if(showMc){ heads.push('Making ₹'); row.push(pdfMoney(item.makingTotal||item.making||0)); }
    heads.push('Subtotal ₹'); row.push(pdfMoney(item.subtotal));
    return { heads, row };
  }

  if(template==='compact-a5-p' || template==='compact-a5-l' || template==='compact-estimate-a5' || template==='compact-estimate-a5l'){
    return {heads:['Item','Weight / Purity','Pcs','Making ₹','Value ₹'],row:[item.product + (showHuid && item.huid ? ' ('+item.huid+')' : '') + chitTag,fmt(item.netWeight||item.weight)+' g · '+(item.purity||22)+'K',item.pieces||1,pdfMoney(item.makingTotal||item.making||0),pdfMoney(item.subtotal)]};
  }

  if(template==='modern'){
    return {heads:['Jewellery','Net Weight g','Purity','Rate / g ₹','Wastage %','Making ₹','Value ₹'],row:[item.product + chitTag,fmt(item.netWeight||item.weight),(item.purity||22)+'K',pdfMoney(item.rate),item.wastage||'0',pdfMoney(item.makingTotal||item.making||0),pdfMoney(item.subtotal)]};
  }

  // Classic default
  const heads=['Description'];
  const row=[item.product + (showHuid && item.huid ? ' · HUID: '+item.huid : '') + chitTag];
  heads.push('Pcs'); row.push(item.pieces||1);
  if(showGrossLess){ heads.push('Gross g'); row.push(fmt(item.grossWeight||item.weight)); }
  if(showNet){ heads.push('Net g'); row.push(fmt(item.netWeight||item.weight)); }
  heads.push('Purity'); row.push((item.purity||22)+'K');
  heads.push('Rate / g ₹'); row.push(pdfMoney(item.rate));
  if(showWst){ heads.push('Wst %'); row.push(item.wastage||'0'); }
  if(showMc){ heads.push('Making ₹'); row.push(pdfMoney(item.makingTotal||item.making||0)); }
  heads.push('Value ₹'); row.push(pdfMoney(item.subtotal));
  return { heads, row };
}

function pdfThermalMarkup(model,c,size='80mm'){
  const is58 = size==='58mm' || c.thermalSize==='2inch';
  const divider = is58 ? '--------------------------------' : '--------------------------------------------';
  const doubleDivider = is58 ? '================================' : '============================================';
  const items = model.invoiceItems?.length ? model.invoiceItems : (model.item ? [model.item] : []);

  let html = '<div class="pdf-thermal-ticket '+(is58?'pdf-thermal-58':'pdf-thermal-80')+'">'
    +'<div class="thermal-center thermal-bold thermal-title">'+esc(c.shopName)+'</div>'
    +(c.address ? '<div class="thermal-center thermal-addr">'+esc(c.address)+'</div>' : '')
    +(c.phone ? '<div class="thermal-center">Tel: '+esc(c.phone)+'</div>' : '')
    +(model.retail && c.gstNumber ? '<div class="thermal-center">GSTIN: '+esc(c.gstNumber)+'</div>' : '')
    +'<div class="thermal-center thermal-doc-title">'+esc(model.title)+'</div>'
    +'<div class="thermal-divider">'+divider+'</div>'
    +'<div class="thermal-row"><span>Date: '+esc(model.date)+'</span><span>'+esc(model.reference||'')+'</span></div>'
    +'<div class="thermal-row"><span>'+esc(model.entityLabel||'Cust')+': <b>'+esc(model.entityName)+'</b></span>'+(model.entityDetails?'<span>'+esc(model.entityDetails)+'</span>':'')+'</div>'
    +(model.validUntil ? '<div class="thermal-row thermal-bold"><span>ESTIMATE VALIDITY:</span><span>'+esc(model.validUntil)+'</span></div>' : '')
    +'<div class="thermal-divider">'+divider+'</div>';

  // Items
  html += '<div class="thermal-items-head">'
    +'<span>Item / Description</span>'
    +'<span class="thermal-right">Amount (₹)</span>'
    +'</div>';

  for(const it of items){
    const desc = it.product + (c.showHuid && it.huid ? ' [HUID:'+it.huid+']' : '');
    const metaParts = [];
    if(c.showGrossLess && (it.grossWeight || it.lessWeight)) metaParts.push('Gr:'+fmt(it.grossWeight||it.weight)+'g Less:'+fmt(it.lessWeight||0)+'g');
    if(c.showNetWeight) metaParts.push('Net:'+fmt(it.netWeight||it.weight)+'g');
    if(it.purity) metaParts.push(it.purity + (String(it.purity).includes('%')||String(it.purity).includes('K')?'':'K'));
    if(it.rate) metaParts.push('@'+pdfMoney(it.rate));
    if(c.showWastage && n(it.wastage)>0) metaParts.push('Wst:'+it.wastage+'%');
    if(c.showMaking && n(it.makingTotal||it.making)>0) metaParts.push('MC:'+pdfMoney(it.makingTotal||it.making));

    html += '<div class="thermal-item-entry">'
      +'<div class="thermal-item-main"><b>'+esc(desc)+'</b><span class="thermal-right thermal-bold">'+pdfMoney(it.subtotal)+'</span></div>'
      +'<div class="thermal-item-meta">'+esc(metaParts.join(' | '))+'</div>'
      +'</div>';
  }

  // Old Gold Exchange
  if(c.showExchange && model.exchange?.length){
    html += '<div class="thermal-divider">'+divider+'</div>'
      +'<div class="thermal-center thermal-bold">OLD GOLD EXCHANGE</div>';
    for(const og of model.exchange){
      html += '<div class="thermal-item-entry">'
        +'<div class="thermal-item-main"><span>'+esc(og.product||'Old Gold')+' ('+fmt(og.weight)+'g @ '+n(og.testingPurity||og.purity)+'%)</span><span class="thermal-right">− '+pdfMoney(og.amount)+'</span></div>'
        +'</div>';
    }
  }

  // Chit Gold Scheme Breakdown
  if(model.chit){
    const ch = model.chit;
    const covWt = (ch.items||[]).reduce((s,x)=>s+n(x.coveredWeight||x.chitWeight),0) || ch.usedWeight;
    html += '<div class="thermal-divider">'+divider+'</div>'
      +'<div class="thermal-center thermal-bold">CHIT GOLD SCHEME'+(ch.passbook?' ('+esc(ch.passbook)+')':'')+'</div>';
    if(ch.schemeName || ch.duesText){
      html += '<div class="thermal-row"><span>'+esc(ch.schemeName||ch.mode||'Chit Plan')+'</span><span class="thermal-right">'+esc(ch.duesText?'Dues '+ch.duesText:'')+'</span></div>';
    }
    if(ch.accumWeight>0 || ch.usedWeight>0){
      html += '<div class="thermal-row"><span>Wt Adj: '+fmt(ch.usedWeight)+' / '+fmt(ch.accumWeight)+'g</span><span class="thermal-right">'+(ch.avgRate>0?'Avg '+pdfMoney(ch.avgRate)+'/g':'')+'</span></div>';
      const rb = n(ch.rateBenefit);
      html += '<div class="thermal-row"><span>'+(rb<0?'Rate Diff':'Rate Protection')+'</span><span class="thermal-right">'+(rb<0?'− ':'+')+pdfMoney(Math.abs(rb))+'</span></div>';
    } else if(ch.accumWeight>0 && !ch.considerChitWeight){
      html += '<div class="thermal-row"><span>Weight Protection</span><span class="thermal-right">OFF (Cash Credit)</span></div>';
    }
    if(ch.wastageDiscount>0 || ch.makingDiscount>0){
      html += '<div class="thermal-row"><span>Waivers ('+fmt(covWt)+'g)</span><span class="thermal-right">VA '+pdfMoney(ch.wastageDiscount)+' | MC '+pdfMoney(ch.makingDiscount)+'</span></div>';
    }
    html += '<div class="thermal-row"><span>Paid'+(ch.bonus>0?' + Bonus':'')+(ch.deduction>0?' − Ded':'')+'</span><span class="thermal-right">'+pdfMoney(ch.paid)+(ch.bonus>0?' +'+pdfMoney(ch.bonus):'')+(ch.deduction>0?' −'+pdfMoney(ch.deduction):'')+'</span></div>';
    html += '<div class="thermal-row thermal-bold"><span>Chit Less (Post-Tax)</span><span class="thermal-right">− '+pdfMoney(ch.amount)+'</span></div>';
  }

  // Totals
  html += '<div class="thermal-divider">'+doubleDivider+'</div>';
  for(const [label, val, highlight] of (model.totals||[])){
    html += '<div class="thermal-row '+(highlight?'thermal-bold thermal-total-highlight':'')+'">'
      +'<span>'+esc(label)+'</span><span class="thermal-right">'+esc(val)+'</span>'
      +'</div>';
  }
  html += '<div class="thermal-divider">'+doubleDivider+'</div>';

  // Bank & UPI QR Code for thermal
  if(c.showBankQR && c.upiId){
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=' + encodeURIComponent('upi://pay?pa=' + c.upiId + '&pn=' + encodeURIComponent(c.shopName) + '&cu=INR');
    html += '<div class="thermal-center thermal-qr">'
      +'<img src="'+qrUrl+'" width="80" height="80" alt="UPI QR">'
      +'<div>Scan & Pay with GPay / PhonePe / Paytm</div>'
      +'</div>';
  }

  // Footer Disclaimer
  const disclaimer = model.kind==='estimate' ? (c.estimateBottomMargin || c.footerText) : c.footerText;
  if(c.showTerms && disclaimer){
    html += '<div class="thermal-center thermal-footer-text">'+esc(disclaimer)+'</div>';
  }

  // Blank feed lines
  const feedCount = Math.max(1, parseInt(c.thermalFeed||3, 10));
  html += '<div class="thermal-feed" style="height:'+(feedCount * 14)+'px"></div>';
  html += '</div>';
  return html;
}

function pdfChitMarkup(model){
  const ch = model?.chit;
  if(!ch) return '';
  const covWt = (ch.items||[]).reduce((s,x)=>s+n(x.coveredWeight||x.chitWeight),0) || n(ch.usedWeight);
  const rb = n(ch.rateBenefit);
  const preTaxNet = pdfRound(rb + n(ch.wastageDiscount) + n(ch.makingDiscount));
  const modeLabel = ch.usedWeight>0
    ? fmt(ch.usedWeight)+' g (Weight ON)'
    : (ch.accumWeight>0 ? '0.000 g ('+(ch.considerChitWeight?'No Metal Match':'Weight OFF · Cash Only')+')' : 'Cash / Amount Plan');
  const metaParts = [
    ch.passbook ? 'Passbook: '+ch.passbook : '',
    ch.schemeName ? ch.schemeName : '',
    ch.mode ? ch.mode : '',
    ch.ornamentType ? ch.ornamentType : '',
    ch.duesText ? 'Dues: '+ch.duesText : ''
  ].filter(Boolean);

  const compRows = [];
  if(ch.usedWeight>0 || rb!==0){
    const rbNote = rb>0 ? '+ '+pdfMoney(rb)+' saved' : rb<0 ? '− '+pdfMoney(Math.abs(rb))+' (Bill rate < Chit avg)' : '₹ 0.00 (Matched)';
    const rbCls = rb>0 ? 'pdf-chit-pos' : rb<0 ? 'pdf-chit-neg' : '';
    compRows.push('<tr><th>Gold Rate Protection (Pre-Tax)</th><td>'+esc(fmt(ch.usedWeight)+' g covered @ Avg '+(ch.avgRate>0?pdfMoney(ch.avgRate)+'/g':'—')+' vs bill gold rate')+'</td><td class="'+rbCls+'">'+esc(rbNote)+'</td></tr>');
  } else if(ch.accumWeight>0 && !ch.considerChitWeight){
    compRows.push('<tr><th>Weight Protection Mode</th><td>'+esc('Consider Chit Weight OFF — full item priced at bill rate; cash paid credited post-tax')+'</td><td>Cash Credit Only</td></tr>');
  }
  if(ch.wastageDiscount>0 || ch.wastageBenefitPercent>0){
    compRows.push('<tr><th>Wastage (VA) Waiver (Pre-Tax)</th><td>'+esc((ch.wastageBenefitPercent>0?ch.wastageBenefitPercent+'% VA waiver':'Scheme VA waiver')+(covWt>0?' on '+fmt(covWt)+' g':''))+'</td><td class="pdf-chit-pos">'+esc('+ '+pdfMoney(ch.wastageDiscount)+' saved')+'</td></tr>');
  }
  if(ch.makingDiscount>0 || ch.noMakingCharge || ch.mcBenefitRate>0){
    const mcBasis = ch.noMakingCharge ? ('Zero MC on '+fmt(covWt)+' g covered') : (ch.mcBenefitRate>0 ? 'MC −'+pdfMoney(ch.mcBenefitRate)+'/g on '+fmt(covWt)+' g' : 'Scheme MC waiver');
    compRows.push('<tr><th>Making Charge (MC) Waiver (Pre-Tax)</th><td>'+esc(mcBasis)+'</td><td class="pdf-chit-pos">'+esc('+ '+pdfMoney(ch.makingDiscount)+' saved')+'</td></tr>');
  }
  if(ch.usedWeight>0 || rb!==0 || ch.wastageDiscount>0 || ch.makingDiscount>0){
    const preTxt = preTaxNet>=0 ? ('+ '+pdfMoney(preTaxNet)+' saved pre-tax') : ('− '+pdfMoney(Math.abs(preTaxNet))+' net rate diff');
    compRows.push('<tr><th>Pre-Tax Scheme Net Impact</th><td>Already adjusted in item Gold / Wastage / Making totals above before GST</td><td class="'+(preTaxNet>=0?'pdf-chit-pos':'pdf-chit-neg')+'">'+esc(preTxt)+'</td></tr>');
  }
  compRows.push('<tr><th>Chit Paid Principal</th><td>'+esc(ch.passbook?'Passbook '+ch.passbook+' total paid':'Accumulated chit paid')+'</td><td>'+esc(pdfMoney(ch.paid))+'</td></tr>');
  if(ch.bonus>0) compRows.push('<tr><th>Chit Bonus (+)</th><td>Scheme / maturity bonus added</td><td class="pdf-chit-pos">'+esc('+ '+pdfMoney(ch.bonus))+'</td></tr>');
  if(ch.deduction>0) compRows.push('<tr><th>Chit Deduction (−)</th><td>Scheme / closure deduction</td><td class="pdf-chit-neg">'+esc('− '+pdfMoney(ch.deduction))+'</td></tr>');
  compRows.push('<tr class="pdf-chit-highlight"><th>Post-Tax Chit Credit Deducted</th><td>'+esc('Paid'+(ch.bonus>0?' + Bonus':'')+(ch.deduction>0?' − Deduction':'')+' (lessed after GST)')+'</td><td>'+esc('− '+pdfMoney(ch.amount))+'</td></tr>');

  let itemHtml = '';
  if(ch.items?.length && (ch.usedWeight>0 || ch.wastageDiscount>0 || ch.makingDiscount>0)){
    itemHtml = '<table class="gl-pdf-table pdf-chit-subtable"><thead><tr><th>Item (Chit Split)</th><th>Net g</th><th>Chit g</th><th>Non-Chit g</th><th>Chit Paid ₹</th><th>Rate ±₹</th><th>VA Waiver ₹</th><th>MC Waiver ₹</th><th>Adj Total ₹</th></tr></thead><tbody>'
      +ch.items.map(it=>{
        const irb = n(it.rateBenefit);
        const irbStr = irb>0 ? '+ '+pdfMoney(irb) : irb<0 ? '− '+pdfMoney(Math.abs(irb)) : pdfMoney(0);
        return '<tr><td>'+esc(it.product)+'</td><td>'+esc(fmt(it.netWeight))+'</td><td>'+esc(fmt(it.chitWeight))+'</td><td>'+esc(fmt(it.nonChitWeight))+'</td><td>'+esc(pdfMoney(it.chitPaidAmount))+'</td><td class="'+(irb>0?'pdf-chit-pos':irb<0?'pdf-chit-neg':'')+'">'+esc(irbStr)+'</td><td>'+esc(pdfMoney(it.wastageDiscountAmount))+'</td><td>'+esc(pdfMoney(it.makingDiscountAmount))+'</td><td>'+esc(pdfMoney(it.subtotal))+'</td></tr>';
      }).join('')
      +'</tbody></table>';
  }

  return '<section class="pdf-chit-section">'
    +'<div class="pdf-chit-head"><b>Chit Gold Scheme Adjustment</b><span>'+esc(metaParts.join(' · '))+'</span></div>'
    +'<div class="pdf-chit-kpis">'
    +'<div class="pdf-chit-kpi"><small>Passbook / Accumulated</small><strong>'+esc((ch.accumWeight>0?fmt(ch.accumWeight)+' g · ':'')+pdfMoney(ch.paid))+'</strong></div>'
    +'<div class="pdf-chit-kpi"><small>Chit Avg Rate</small><strong>'+esc(ch.avgRate>0?pdfMoney(ch.avgRate)+'/g':'Amount Plan')+'</strong></div>'
    +'<div class="pdf-chit-kpi"><small>Weight Adjusted</small><strong>'+esc(modeLabel)+'</strong></div>'
    +'<div class="pdf-chit-kpi"><small>Post-Tax Chit Less</small><strong>'+esc('− '+pdfMoney(ch.amount))+'</strong></div>'
    +'</div>'
    +'<table class="gl-pdf-table pdf-chit-table"><thead><tr><th>Scheme Component</th><th>Calculation / Basis</th><th>Impact / Amount</th></tr></thead><tbody>'+compRows.join('')+'</tbody></table>'
    +itemHtml
    +'</section>';
}

function pdfBillMarkup(model,c,template){
  const items = model.invoiceItems?.length ? model.invoiceItems : (model.item ? [model.item] : []);
  let heads = [];
  const rows = [];

  for(let i=0; i<items.length; i++){
    const cols = pdfBillColumns(items[i], template, model.retail, c);
    if(i===0) heads = cols.heads;
    rows.push(cols.row);
  }

  let content = pdfTable(heads, rows);
  content += pdfChitMarkup(model);

  if(c.showExchange && model.exchange?.length){
    content += '<h3 class="pdf-section-title">Old Gold Exchange</h3>'
      +pdfTable(['Product / Description','Gross g','Testing Purity %','Net Pure g','Rate / g ₹','Credit Amount ₹'],
        model.exchange.map(x=>[x.product, fmt(x.grossWeight||x.weight), (x.testingPurity||x.purity)+'%', fmt(x.pureGrams||x.weight), pdfMoney(x.rate), pdfMoney(x.amount)]));
  }

  content += pdfTotals(model.totals||[]);
  content += pdfBankAndQRMarkup(c);
  return content;
}

function pdfDocument(model,c,forcedTemplate=null){
  const sample = model.sample ? '<div class="pdf-sample">SAMPLE PREVIEW · not a saved transaction</div>' : '';
  const isEstimate = model.kind==='estimate' || String(model.title||'').includes('ESTIMATION') || String(model.title||'').includes('QUOTATION');
  const template = forcedTemplate || (isEstimate ? (c.estimateTemplate || 'detailed-estimate') : (c.template || 'classic'));
  const isThermal = template.startsWith('thermal');

  if(isThermal){
    return '<article class="gl-pdf gl-pdf-thermal pdf-'+template+'">'
      +sample
      +pdfThermalMarkup(model, c, template.includes('58') ? '58mm' : '80mm')
      +'</article>';
  }

  return '<article class="gl-pdf pdf-'+template+' '+(model.kind==='ledger'?'pdf-ledger':isEstimate?'pdf-estimate':'pdf-bill')+'">'
    +sample
    +pdfHeader(model, c, false)
    +(model.heads && model.rows && (!model.invoiceItems || model.kind==='purchase' || model.kind==='ledger') ? pdfTable(model.heads, model.rows) + pdfTotals(model.totals||[]) + (model.kind==='purchase'?pdfBankAndQRMarkup(c):'') : pdfBillMarkup(model, c, template))
    +(c.showTerms ? '<div class="pdf-signatures"><span>Customer / Party Signature</span><span>Authorised Signatory</span></div><footer>'+esc(isEstimate ? (c.estimateBottomMargin || c.footerText) : c.footerText)+'</footer>' : '')
    +'</article>';
}

function pdfDateText(value){return value?new Date(value).toLocaleString('en-IN'):'';}

function pdfBillModel(form,retail){
  const f=form.elements,type=retail?'customer':'party',entity=account(f.partyId.value,type),weight=n(f.weight.value),purity=n(f.purity.value),pieces=n(f.pieces.value),wastage=n(f.wastage.value),reference=f.id.value?'Bill ref: '+f.id.value.slice(0,12).toUpperCase():'DRAFT · unsaved entry';
  const chitDoc=(window.rcDocs?window.rcDocs('retail-chit-mapping'):[]).find(m=>m.id===f.chitMappingId?.value);
  const chitLabel=chitDoc?'Chit Passbook: '+chitDoc.chitNumber:(f.chitMappingId?.value?'Chit Passbook: '+f.chitMappingId.value:'');
  const model={kind:'bill',retail,title:retail?'JEWELLERY SALES BILL':'WHOLESALE PARTY SALES BILL',entityLabel:retail?'Customer':'Party',entityName:entity.name,entityDetails:[entity.address,accountCity(entity.id,type),entity.phone||entity.mobile,chitLabel].filter(Boolean).join(' · '),reference,date:pdfDateText(f.when.value)};
  if(retail){
    const t=pdfRetailTotals(form);model.taxEnabled=t.gstEnabled;
    const lines=exchangeRows(form).filter(x=>x.hasEntry),exchange=pdfRound(lines.reduce((sum,x)=>sum+x.amount,0)),collected=n(f.collectedAmount.value),balance=pdfRound(t.final-exchange-collected);
    model.item={product:f.product.value,weight,purity,pieces,wastage,rate:n(f.ratePerGram.value),gold:t.goldAmount,wastageAmount:t.wastageAmount,makingRate:n(f.makingPerPiece.value),making:t.makingTotal,subtotal:t.subtotal,hsn:f.hsn?.value||''};
    model.invoiceItems=[model.item];
    model.exchange=lines;
    model.totals=[['Gold value',pdfMoney(t.goldAmount)],['Wastage',pdfMoney(t.wastageAmount)],['Making charges',pdfMoney(t.makingTotal)],['Discount','− '+pdfMoney(t.discount)],['New sale after discount',pdfMoney(t.taxableValue)]];
    if(t.gstEnabled){
      if(t.gstMode==='igst')model.totals.push(['IGST '+t.gstRate+'%',pdfMoney(t.igst)]);
      else model.totals.push(['CGST '+t.gstRate/2+'%',pdfMoney(t.cgst)],['SGST '+t.gstRate/2+'%',pdfMoney(t.sgst)]);
      model.totals.push(['New sale including GST',pdfMoney(t.final)]);
    }
    model.totals.push(['Old gold exchange credit','− '+pdfMoney(exchange)],['Collected · '+(f.collectedMethod?.value||'Cash'),pdfMoney(collected)],['Payment reference',f.collectedReference?.value||'—'],[balance<0?'Customer credit':'Balance to collect',pdfMoney(Math.abs(balance)),true]);
  } else {
    const pure=weight*(purity+wastage)/100,hallmarkRate=n(f.hallmarkChargePerPiece?.value),hallmark=pdfRound(pieces*hallmarkRate);
    model.item={product:f.product.value,weight,purity,pieces,wastage,pure,hallmarkRate,hallmarkType:f.hallmarkType?.value||'',hallmark};
    model.invoiceItems=[model.item];
    model.totals=[['Gross gold weight',fmt(weight)+' g'],['Payable pure gold',fmt(pure)+' g',true],['Hallmark charge · '+pieces+' pcs × '+pdfMoney(hallmarkRate),pdfMoney(hallmark)],['Hallmark amount due',pdfMoney(hallmark),true]];
  }
  return model;
}

function pdfLedgerModel(type,template){
  const retail=type==='customer',entity=account(filter[retail?'customer':'party'],type);if(!entity)return null;
  const rows=tx(entity.id,type),opening=accountOpening(entity,type)+openingBefore(entity.id,type),cashOpening=retail?0:v2PartyAmountBefore(entity.id);let goldOrMoney=opening,cash=cashOpening;
  const detailed=template==='detailed'||template==='detailed-estimate',modern=template==='modern';
  const heads=retail?(detailed?['Date','Entry','Product / details','Weight g','Purity K','Wastage %','Purchase ₹','GST ₹','Old gold g / ₹','Paid ₹','Method / reference','Balance ₹']:['Date','Entry / jewellery','Purchase ₹','Old gold credit ₹','Paid ₹','Balance ₹']):(detailed?['Date','Entry','Product / payment','Gross g','Purity / testing','Wastage %','Gold debit g','Gold credit g','Cash paid ₹','Hallmark ±₹','Gold balance g','Amount balance ₹']:modern?['Date','Product / payment','Gold debit g','Gold credit g','Cash paid ₹','Hallmark ±₹','Gold balance g','Amount balance ₹']:['Date','Entry / details','Gold debit g','Gold credit g','Cash paid ₹','Hallmark ±₹','Gold balance g','Amount balance ₹']);
  const data=rows.map(row=>{const sale=row.type==='Sale';goldOrMoney+=row.amount;cash+=retail?0:v2PartyAmountDelta(row);const rowWhen=window.whenShow?whenShow(row):String(row.when||row.date||row.createdAt||'').slice(0,16).replace('T',' ')||'—';if(retail){const returned=row.retailKind==='return',entry=returned?'Sales return':row.retailKind?row.kind:row.type,purchase=sale?v2SalePurchase(row):returned?row.amount:0,paid=sale||returned?0:-row.amount,old=sale?n(row.exchangeAmount):0,details=sale?row.product:row.desc,method=row.method||row.collectedMethod||row.kind||'—';return detailed?[rowWhen,entry,details,sale?fmt(row.weight):returned?fmt(-n(row.returnWeight)):'—',sale?v2RetailPurityText(row):'—',sale?(row.wastageLabel||row.wastage):'—',sale||returned?pdfMoney(purchase):'—',sale&&row.gstEnabled?pdfMoney(row.gstAmount):'—',sale&&old?fmt(v2OldGoldWeight(row))+' g / '+pdfMoney(old):'—',paid?pdfMoney(paid):'—',method+(row.reference?' · '+row.reference:''),pdfMoney(goldOrMoney)]:[rowWhen,entry+' · '+details,sale||returned?pdfMoney(purchase):'—',old?pdfMoney(old):'—',paid?pdfMoney(paid):'—',pdfMoney(goldOrMoney)];}const detail=sale?row.product:row.desc,cashPaid=!sale&&row.kind==='Cash'?n(row.amountOriginal??row.cashAmount??0):0;const original=!sale?db.payments.find(p=>p.id===row.id):null,actualCash=original?.kind==='Cash'?n(original.amount):cashPaid,debit=sale?row.amount:0,credit=sale?0:-row.amount,delta=v2PartyAmountDelta(row);if(detailed)return [rowWhen,row.type,detail,sale||row.kind!=='Cash'?fmt(row.weight):'—',sale?row.purity+'%':row.kind==='Cash'?'—':row.purity+'%',sale?row.wastage+'%':'—',debit?fmt(debit):'—',credit?fmt(credit):'—',actualCash?pdfMoney(actualCash):'—',delta?pdfMoney(delta):'—',fmt(goldOrMoney),pdfMoney(cash)];const common=[rowWhen,row.type+' · '+detail,debit?fmt(debit):'—',credit?fmt(credit):'—',actualCash?pdfMoney(actualCash):'—',delta?pdfMoney(delta):'—',fmt(goldOrMoney),pdfMoney(cash)];return common;});
  const sales=rows.filter(x=>x.type==='Sale'),paid=rows.filter(x=>x.type==='Payment'),totals=retail?[['Opening balance',pdfMoney(opening)],['Total gold purchased',fmt(sales.reduce((s,x)=>s+n(x.weight),0))+' g'],['Total purchase value',pdfMoney(sales.reduce((s,x)=>s+v2SalePurchase(x),0))],['Old gold exchange credit',pdfMoney(sales.reduce((s,x)=>s+n(x.exchangeAmount),0))],['Sales return credit',pdfMoney(-paid.filter(x=>x.retailKind==='return').reduce((s,x)=>s+x.amount,0))],['Total paid',pdfMoney(-paid.filter(x=>x.retailKind!=='return').reduce((s,x)=>s+x.amount,0))],[goldOrMoney<0?'Customer credit':'Closing balance pending',pdfMoney(Math.abs(goldOrMoney)),true]]:[['Opening gold balance',fmt(opening)+' g'],['Opening hallmark amount',pdfMoney(cashOpening)],['Total gold taken',fmt(sales.reduce((s,x)=>s+n(x.weight),0))+' g'],['Pure gold payable',fmt(sales.reduce((s,x)=>s+x.amount,0))+' g'],['Gold credited',fmt(-paid.reduce((s,x)=>s+x.amount,0))+' g'],[goldOrMoney<0?'Closing gold credit':'Closing gold balance',fmt(Math.abs(goldOrMoney))+' g',true],[cash<0?'Closing amount credit':'Closing hallmark amount balance',pdfMoney(Math.abs(cash)),true]];
  return {kind:'ledger',retail,title:retail?'CUSTOMER TRANSACTION LEDGER':'PARTY TRANSACTION LEDGER',entityLabel:retail?'Customer':'Party',entityName:entity.name,entityDetails:[accountCity(entity.id,type),entity.phone||entity.mobile].filter(Boolean).join(' · '),reference:filter.mode||'All Dates',date:filter.mode==='Single Date'?filter.date:filter.mode==='Date Range'?[filter.from,filter.to].filter(Boolean).join(' to '):filter.mode==='Monthly'?filter.month:'All dates',heads,rows:data,totals};
}

let pdfActiveDocPreview = null;

function pdfTriggerPrint(model,mode,forcedTemplate=null,allowMissingGst=false){
  const c=pdfConfig(mode);
  if(!allowMissingGst&&model.retail&&model.taxEnabled&&!/^[A-Za-z0-9]{15}$/.test(c.gstNumber))return say('Set the shop GSTIN in Retail PDF Settings before printing a GST bill.');

  const isEstimate = model.kind==='estimate' || String(model.title||'').includes('ESTIMATION') || String(model.title||'').includes('QUOTATION');
  const template = forcedTemplate || (isEstimate ? (c.estimateTemplate || 'detailed-estimate') : (c.template || 'classic'));

  let root=document.getElementById('goldleafPdfRoot');
  if(!root){root=document.createElement('div');root.id='goldleafPdfRoot';document.body.append(root);}
  root.innerHTML=pdfDocument(model, c, template);

  let pageStyle=document.getElementById('goldleafPdfPageStyle');
  if(!pageStyle){pageStyle=document.createElement('style');pageStyle.id='goldleafPdfPageStyle';document.head.append(pageStyle);}

  let pageSize = 'A4 portrait';
  let pageMargin = '10mm';
  if(template === 'detailed' || template === 'compact-estimate-a5l' || template === 'compact-a5-l'){
    pageSize = template.startsWith('compact') ? 'A5 landscape' : 'A4 landscape';
    pageMargin = '8mm';
  } else if(template === 'compact-a5-p' || template === 'compact-estimate-a5'){
    pageSize = 'A5 portrait';
    pageMargin = '8mm';
  } else if(template === 'thermal-80' || template === 'thermal-estimate-80'){
    pageSize = '80mm auto';
    pageMargin = '2mm 3mm';
  } else if(template === 'thermal-58' || template === 'thermal-estimate-58'){
    pageSize = '58mm auto';
    pageMargin = '1mm 2mm';
  }

  pageStyle.textContent='@page goldleafDocument{size:'+pageSize+';margin:'+pageMargin+'}.gl-pdf{page:goldleafDocument}';
  document.body.classList.add('goldleaf-pdf-printing');
  window.addEventListener('afterprint',()=>document.body.classList.remove('goldleaf-pdf-printing'),{once:true});
  setTimeout(()=>window.print(),100);
}

function pdfRenderDocumentModal(){
  const state = pdfActiveDocPreview;
  if(!state) return;
  const { model, mode, template, config } = state;
  const isEstimate = model.kind==='estimate' || String(model.title||'').includes('ESTIMATION') || String(model.title||'').includes('QUOTATION');
  const layouts = isEstimate ? PDF_ESTIMATE_LAYOUTS : PDF_LAYOUTS;
  const chosen = layouts[template] ? template : (isEstimate ? 'detailed-estimate' : 'classic');
  state.template = chosen;
  const missingGstin = !!(model.retail && model.taxEnabled && !/^[A-Za-z0-9]{15}$/.test(config.gstNumber));

  document.getElementById('pdfTemplatePreview')?.remove();
  document.getElementById('pdfDocumentPreview')?.remove();
  const modal=document.createElement('div');
  modal.id='pdfDocumentPreview';
  modal.className='retail-modal-backdrop pdf-preview-overlay';
  modal.addEventListener('click',e=>{if(e.target===modal){modal.remove();pdfActiveDocPreview=null;}});

  const pillHtml = Object.entries(layouts).map(([id,item])=>{
    const shortName = item.name.replace(' Manufacturing','').replace(' Branded','').replace(' Bill ',' ').replace(' Quote ',' ').replace('Slip ','').replace(' Portrait',' P').replace(' Landscape',' L').replace('Receipt ','').replace('Estimate ','');
    return '<button type="button" class="pdf-preview-pill '+(id===chosen?'active':'')+'" data-pdf-layout="'+esc(id)+'" onclick="pdfSwitchDocumentPreview(\''+esc(id)+'\')">'+esc(shortName)+'</button>';
  }).join('');

  modal.innerHTML='<section class="retail-modal pdf-preview-modal" role="dialog" aria-modal="true" aria-label="PDF document preview">'
    +'<div class="retail-modal-head">'
    +'<div><h2>'+esc(model.title||'DOCUMENT PDF')+' · <span id="pdfPreviewLayoutTitle">'+esc(layouts[chosen]?.name||chosen)+'</span></h2>'
    +'<p>'+esc((model.reference||'Live view')+' · '+(model.entityName||'')+(model.chit?.passbook?' · Chit '+model.chit.passbook:''))+'</p></div>'
    +'<div class="pdf-preview-head-actions">'
    +'<button type="button" class="primary" onclick="pdfPrintPreviewActive()">Print / Save PDF</button>'
    +'<button type="button" onclick="document.getElementById(\'pdfDocumentPreview\')?.remove()">Close</button>'
    +'</div></div>'
    +(missingGstin?'<div class="pdf-preview-warning">GST is enabled on this bill, but Shop GSTIN (15 chars) is not set in Retail PDF Settings — showing draft preview.</div>':'')
    +'<div class="pdf-preview-toolbar"><div class="pdf-preview-pills">'+pillHtml+'</div></div>'
    +'<iframe title="Live PDF preview"></iframe>'
    +'</section>';

  document.body.append(modal);
  const frame=modal.querySelector('iframe');
  if(frame){
    frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:18px;background:#e8ecea}'+PDF_DOCUMENT_CSS+'</style></head><body>'+pdfDocument(model,config,chosen)+'</body></html>';
  }
}

window.pdfSwitchDocumentPreview=function(layoutId){
  if(!pdfActiveDocPreview)return;
  const { model, config } = pdfActiveDocPreview;
  const isEstimate = model.kind==='estimate' || String(model.title||'').includes('ESTIMATION') || String(model.title||'').includes('QUOTATION');
  const layouts = isEstimate ? PDF_ESTIMATE_LAYOUTS : PDF_LAYOUTS;
  if(!layouts[layoutId])return;
  pdfActiveDocPreview.template = layoutId;
  const modal=document.getElementById('pdfDocumentPreview');
  if(!modal)return pdfRenderDocumentModal();
  const titleEl=modal.querySelector('#pdfPreviewLayoutTitle');
  if(titleEl)titleEl.textContent=layouts[layoutId].name||layoutId;
  modal.querySelectorAll('.pdf-preview-pill').forEach(btn=>btn.classList.toggle('active',btn.dataset.pdfLayout===layoutId));
  const frame=modal.querySelector('iframe');
  if(frame){
    frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:18px;background:#e8ecea}'+PDF_DOCUMENT_CSS+'</style></head><body>'+pdfDocument(model,config,layoutId)+'</body></html>';
  }
};

window.pdfPrintPreviewActive=function(){
  if(!pdfActiveDocPreview)return;
  const { model, mode, template } = pdfActiveDocPreview;
  const isDraft = !!(model.sample || String(model.reference||'').startsWith('DRAFT'));
  pdfTriggerPrint(model, mode, template, isDraft);
};

async function pdfPrintModel(model,mode,forcedTemplate=null,options={}){
  await pdfLoadProfile();const c=pdfConfig(mode);
  const isEstimate = model.kind==='estimate' || String(model.title||'').includes('ESTIMATION') || String(model.title||'').includes('QUOTATION');
  const template = forcedTemplate || (isEstimate ? (c.estimateTemplate || 'detailed-estimate') : (c.template || 'classic'));
  if(options?.directPrint){
    return pdfTriggerPrint(model, mode, template, false);
  }
  pdfActiveDocPreview = { model, mode, template, config: c };
  pdfRenderDocumentModal();
}

window.printCustomerSaleBill=function(forcedTemplate=null){
  const form=document.getElementById('customerSaleForm');if(!form||form.elements.accountType.value!=='customer')return say('Open a customer bill first.');if(!form.reportValidity())return;
  const gst=pdfGSTInputs(form);if(gst.gstEnabled&&(gst.gstRate<=0||gst.gstRate>100))return say('Enter a valid GST percentage, or switch it off.');
  const model=pdfBillModel(form,true),t=pdfRetailTotals(form);if(t.discount>t.subtotal)return say('Discount exceeds the new sale value.');
  const exchange=(model.exchange||[]).reduce((s,x)=>s+x.amount,0);if(n(form.elements.collectedAmount.value)>Math.max(0,pdfRound(t.final-exchange)))return say('Collected amount exceeds the bill balance.');
  for(const item of model.exchange)if(!item.product||item.weight<=0||item.testingPurity<1||item.testingPurity>100||item.rate<=0)return say('Complete each old gold exchange item.');
  pdfPrintModel(model,'retail',forcedTemplate);
};

window.printWholesaleSaleBill=function(){
  const form=document.getElementById('customerSaleForm');if(!form||form.elements.accountType.value!=='party')return say('Open a party sale first.');if(!form.reportValidity())return;
  pdfPrintModel(pdfBillModel(form,false),'wholesale');
};

const pdfPreviousPicker=window.toggleBillTemplatePicker;
window.toggleBillTemplatePicker=function(force){if(force===false)return pdfPreviousPicker(false);return printCustomerSaleBill();};
const pdfPreviousHeader=window.header;
window.header=function(sub,buttons=''){if(page==='Sales Entry'&&moduleAccountType()==='party')buttons+='<button type="button" onclick="printWholesaleSaleBill()">View bill PDF</button>';return pdfPreviousHeader(sub,buttons);};
window.viewLedgerPdf=function(type){const mode=type==='customer'?'retail':'wholesale',model=pdfLedgerModel(type,pdfConfig(mode).template);if(!model)return say('Select an account to view its ledger PDF.');pdfPrintModel(model,mode);};

function pdfSampleModel(mode,kind,template){
  const retail=mode==='retail';
  if(kind==='ledger')return {
    sample:true,kind:'ledger',retail,title:retail?'CUSTOMER LEDGER':'PARTY LEDGER',entityLabel:retail?'Customer':'Party',entityName:retail?'Sample Customer':'Sample Party',reference:'Sample report',date:'All dates',
    heads:retail?['Date','Jewellery / receipt','Purchase ₹','Old gold ₹','Paid ₹','Balance ₹']:['Date','Product','Gold debit g','Gold credit g','Cash paid ₹','Hallmark ₹','Gold balance g','Amount balance ₹'],
    rows:retail?[['06/11/2026','Gold ring','₹ 60,000.00','₹ 10,000.00','—','₹ 50,000.00'],['06/11/2026','Cash receipt','—','—','₹ 45,000.00','₹ 5,000.00']]:[['06/11/2026','Bangle','97.500','—','—','₹ 200.00','97.500','₹ 200.00'],['06/11/2026','Metal payment','—','50.000','—','—','47.500','₹ 200.00']],
    totals:retail?[['Opening balance','₹ 0.00'],['Closing balance','₹ 5,000.00',true]]:[['Opening gold','0.000 g'],['Closing gold','47.500 g',true],['Closing hallmark amount','₹ 200.00',true]]
  };

  const isEstimate = kind==='estimate';
  const item1 = retail?{product:'Gold Necklace (22K 916)',huid:'HD8891',weight:16.500,grossWeight:16.500,lessWeight:0.300,netWeight:16.200,purity:22,pieces:1,wastage:6,rate:7250,gold:117450,wastageAmount:7047,makingRate:450,makingTotal:7290,subtotal:131787,hsn:'7113'}:{product:'Gold bangle',weight:100,purity:92,wastage:5.5,pieces:2,pure:97.5,hallmarkType:'HUID',hallmarkRate:100,hallmark:200};
  const item2 = retail?{product:'Diamond Stud Earrings',huid:'DM1042',weight:4.200,grossWeight:4.200,lessWeight:0.150,netWeight:4.050,purity:18,pieces:1,wastage:4,rate:6100,gold:24705,wastageAmount:988,makingRate:600,makingTotal:2430,subtotal:28123,hsn:'7113'}:null;
  const items = [item1, item2].filter(Boolean);

  const exchange = retail?[{product:'Old Gold Chain (Tested 91.6%)',weight:5.400,grossWeight:5.400,lessWeight:0.200,testingPurity:91.6,rate:6900,amount:35880}]:[];

  const totals = retail ? [
    ['Items total', '₹ 1,59,910.00'],
    ['Wastage value', '₹ 8,035.00'],
    ['Making charges', '₹ 9,720.00'],
    ['Special discount', '− ₹ 1,910.00'],
    ['Taxable sales value', '₹ 1,58,000.00'],
    ['Old gold exchange credit', '− ₹ 35,880.00'],
    ['NET PAYABLE', '₹ 1,22,120.00', true]
  ] : [
    ['Gross gold', '100.000 g'],
    ['Payable pure gold', '97.500 g', true],
    ['Hallmark amount due', '₹ 200.00', true]
  ];

  return {
    sample: true,
    kind: isEstimate ? 'estimate' : 'bill',
    retail,
    title: isEstimate ? 'ESTIMATION / QUOTATION' : (retail ? 'JEWELLERY TAX INVOICE' : 'WHOLESALE PARTY SALES BILL'),
    entityLabel: retail ? 'Customer' : 'Party',
    entityName: 'Smt. Priya Sundaram',
    entityDetails: '12 South Car Street, Madurai · 9842100000',
    reference: isEstimate ? 'EST-2026-0042' : 'BILL-2026-0189',
    date: '12/11/2026 05:30 PM',
    validUntil: isEstimate ? '12/11/2026 (Valid for today only)' : '',
    item: item1,
    invoiceItems: items,
    exchange: exchange,
    totals: totals
  };
}

window.previewPdfTemplate=async function(template=null,kind='bill'){
  await pdfLoadProfile();const c=pdfReadSettingsForm();
  const isEstimate = kind==='estimate';
  const chosen = template || (isEstimate ? c.estimateTemplate : c.template);
  const model=pdfSampleModel(pdfMode(),kind,chosen);

  if(kind==='bill'&&c.gst?.enabled){
    const gst=pdfRound(158000*n(c.gst.rate)/100),cgst=pdfRound(gst/2);
    const taxRows=c.gst.mode==='igst'?[['IGST '+c.gst.rate+'%',pdfMoney(gst)]]:[['CGST '+c.gst.rate/2+'%',pdfMoney(cgst)],['SGST '+c.gst.rate/2+'%',pdfMoney(pdfRound(gst-cgst))]];
    model.totals.splice(5,0,...taxRows,['New sale including GST',pdfMoney(158000+gst)]);
    model.totals[model.totals.length-1]=['Balance due',pdfMoney(122120+gst),true];
  }

  document.getElementById('pdfTemplatePreview')?.remove();
  const modal=document.createElement('div');
  modal.id='pdfTemplatePreview';
  modal.className='retail-modal-backdrop pdf-preview-overlay';
  const templateName = PDF_LAYOUTS[chosen]?.name || PDF_ESTIMATE_LAYOUTS[chosen]?.name || chosen;
  
  modal.innerHTML='<section class="retail-modal pdf-preview-modal" role="dialog" aria-modal="true" aria-label="PDF template preview">'
    +'<div class="retail-modal-head">'
    +'<div><h2>'+esc(templateName)+' · '+(isEstimate?'Estimation Preview':kind==='bill'?'Bill Preview':'Ledger Preview')+'</h2><p>Interactive sample preview · your shop details and live items render when printing.</p></div>'
    +'<button type="button" onclick="document.getElementById(\'pdfTemplatePreview\').remove()">Close</button>'
    +'</div>'
    +'<div class="row" style="display:flex;gap:8px;padding:8px 12px;background:#f6f8f7;border-radius:8px;margin-bottom:8px">'
    +'<button type="button" class="'+(!isEstimate&&kind==='bill'?'primary':'')+'" onclick="previewPdfTemplate(\''+c.template+'\',\'bill\')">Sample Bill</button>'
    +(pdfMode()==='retail'?'<button type="button" class="'+(isEstimate?'primary':'')+'" onclick="previewPdfTemplate(\''+c.estimateTemplate+'\',\'estimate\')">Sample Estimation</button>':'')
    +'<button type="button" class="'+(kind==='ledger'?'primary':'')+'" onclick="previewPdfTemplate(\''+c.template+'\',\'ledger\')">Sample Ledger</button>'
    +'</div>'
    +'<iframe title="PDF sample preview"></iframe>'
    +'</section>';

  document.body.append(modal);
  modal.querySelector('iframe').srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:18px;background:#f0f2f1}'+PDF_DOCUMENT_CSS+'</style></head><body>'+pdfDocument(model,c,chosen)+'</body></html>';
};

const PDF_DOCUMENT_CSS=`
.gl-pdf{font:11px/1.45 Arial,Helvetica,sans-serif;color:#202624;background:#fff;overflow-wrap:anywhere;box-shadow:0 3px 12px rgba(0,0,0,.08);margin:0 auto;max-width:850px;padding:24px}
.gl-pdf *{box-sizing:border-box}
.pdf-brand{padding:16px 14px;border-bottom:2px solid #aa864b;margin-bottom:12px}
.pdf-brand h1{margin:0 0 6px;font:700 24px/1.2 Georgia,serif;color:#18201b;letter-spacing:.3px}
.pdf-brand p{margin:3px 0;white-space:pre-line;font-size:10px;color:#46524b}
.pdf-brand.center{text-align:center!important}
.pdf-brand.left{text-align:left!important}
.pdf-document-title{text-align:center;letter-spacing:1.8px;font-size:12px;font-weight:800;margin:14px 0;text-transform:uppercase;color:#2c3b33}
.pdf-meta{display:grid;grid-template-columns:1.3fr 1fr;gap:14px;border-bottom:1px solid #bbb;padding-bottom:12px;margin-bottom:16px}
.pdf-meta>div:last-child{text-align:right}
.pdf-meta p{margin:4px 0;font-size:10px;color:#444}
.pdf-expiry-tag{color:#b33e28;font-weight:750;background:#fdeeed;display:inline-block;padding:2px 6px;border-radius:4px;margin-top:4px!important}

.gl-pdf table,.gl-pdf-table{display:table!important;width:100%!important;min-width:0!important;border-collapse:collapse!important;table-layout:auto!important;margin:10px 0}
.gl-pdf thead{display:table-header-group!important;position:static!important;width:auto!important;height:auto!important;clip:auto!important;overflow:visible!important}
.gl-pdf tbody{display:table-row-group!important}
.gl-pdf tr{display:table-row!important;break-inside:avoid;page-break-inside:avoid;box-shadow:none!important;padding:0!important}
.gl-pdf th,.gl-pdf td{display:table-cell!important;border:1px solid #bbb!important;padding:7px 6px!important;text-align:left!important;vertical-align:top;font-size:9px;line-height:1.45;white-space:normal;overflow-wrap:anywhere}
.gl-pdf td:before{display:none!important}
.gl-pdf th{background:#f2ede3!important;color:#242820!important;font-size:8px;font-weight:700;letter-spacing:.2px;text-transform:none}
.pdf-section-title{font-size:11px;font-weight:750;margin:16px 0 6px;color:#1e2d25;border-bottom:1px solid #ccc;padding-bottom:4px}

.gl-pdf .pdf-totals{margin:18px 0 0 auto;width:58%!important;min-width:270px!important}
.pdf-totals th{background:#fff!important;font-size:10px;font-weight:600}
.pdf-totals td{text-align:right!important;font-weight:700;font-size:11px}
.pdf-totals .pdf-highlight th,.pdf-totals .pdf-highlight td{background:#f2e4bf!important;border:2px solid #a47e38!important;font-size:12px;color:#171d19!important}

.pdf-bank-section{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:12px;background:#faf8f5;border:1px dashed #c2aa80;border-radius:8px;break-inside:avoid}
.pdf-bank-details b{font-size:10px;color:#1b2e25;display:block;margin-bottom:4px}
.pdf-bank-details p{margin:2px 0;font-size:9.5px;color:#333}
.pdf-bank-qr{text-align:center;padding-left:12px}
.pdf-bank-qr img{display:block;margin:0 auto 4px;border:1px solid #ddd;padding:3px;background:#fff}
.pdf-bank-qr small{font-size:8px;font-weight:700;color:#2a503e}

.pdf-signatures{display:flex;justify-content:space-between;margin-top:32px;font-size:10px;break-inside:avoid;padding-top:12px}
.gl-pdf footer{margin-top:20px;border-top:1px solid #aaa;padding-top:10px;font-size:9px;white-space:pre-line;text-align:center;color:#666}

/* Classic Style */
.pdf-classic .pdf-brand{text-align:center;border:2px solid #a78950;background:#fffdf7}

/* Compact A5 Styles */
.pdf-compact-a5-p,.pdf-compact-a5-l,.pdf-compact-estimate-a5,.pdf-compact-estimate-a5l{font-size:10px;max-width:620px;padding:16px}
.pdf-compact-a5-p .pdf-brand,.pdf-compact-estimate-a5 .pdf-brand{padding:8px 0;margin-bottom:6px}
.pdf-compact-a5-p .pdf-brand h1,.pdf-compact-estimate-a5 .pdf-brand h1{font-size:18px}
.pdf-compact-a5-p .pdf-meta,.pdf-compact-estimate-a5 .pdf-meta{gap:8px;margin-bottom:8px}
.pdf-compact-a5-p th,.pdf-compact-a5-p td,.pdf-compact-estimate-a5 th,.pdf-compact-estimate-a5 td{padding:4px!important;font-size:8px}
.pdf-compact-a5-p .pdf-totals,.pdf-compact-estimate-a5 .pdf-totals{width:75%!important}

/* Detailed Landscape Styles */
.pdf-detailed,.pdf-detailed-estimate{max-width:1050px}
.pdf-detailed th,.pdf-detailed td,.pdf-detailed-estimate th,.pdf-detailed-estimate td{font-size:8px;padding:5px!important}
.pdf-detailed th{background:#e4eaf0!important}
.pdf-detailed .pdf-brand{border-bottom-color:#405d78}

/* Modern Branded Styles */
.pdf-modern .pdf-brand{background:#213b34;color:#fff;border-bottom:4px solid #bfa16c;padding:18px;border-radius:6px 6px 0 0}
.pdf-modern .pdf-brand h1{color:#fff}
.pdf-modern .pdf-brand p{color:#d5dfda}
.pdf-modern th{background:#213b34!important;color:#fff!important}
.pdf-modern tbody tr:nth-child(even) td{background:#f3f6f4}
.pdf-modern .pdf-highlight td,.pdf-modern .pdf-highlight th{background:#213b34!important;color:#fff!important}
.pdf-modern .pdf-totals th{color:#213b34!important;background:#fff!important}

/* Thermal POS Receipts (80mm & 58mm) */
.gl-pdf-thermal{background:#fff;padding:8px;font-family:"Courier New",Courier,monospace;line-height:1.25;box-shadow:0 1px 6px rgba(0,0,0,.15);border:1px dashed #aaa}
.pdf-thermal-80{max-width:300px;font-size:9.5px}
.pdf-thermal-58{max-width:220px;font-size:8.5px;padding:4px}
.thermal-center{text-align:center}
.thermal-right{text-align:right}
.thermal-bold{font-weight:bold}
.thermal-title{font-size:13px;letter-spacing:.3px;margin-bottom:2px}
.thermal-addr{font-size:8px;margin-bottom:3px}
.thermal-doc-title{font-size:11px;margin:5px 0;font-weight:800;letter-spacing:.8px}
.thermal-divider{overflow:hidden;white-space:nowrap;margin:4px 0;font-family:monospace;letter-spacing:-1px}
.thermal-row{display:flex;justify-content:space-between;margin:2px 0}
.thermal-items-head{display:flex;justify-content:space-between;font-weight:bold;margin:4px 0 2px;border-bottom:1px dashed #777;padding-bottom:2px}
.thermal-item-entry{margin:4px 0}
.thermal-item-main{display:flex;justify-content:space-between}
.thermal-item-meta{font-size:8px;color:#333;margin-top:1px}
.thermal-total-highlight{font-size:11px;border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 0;margin:3px 0}
.thermal-qr{margin:8px 0}
.thermal-qr img{display:block;margin:0 auto 2px;background:#fff;padding:2px}
.thermal-qr div{font-size:7.5px;font-weight:bold}
.thermal-footer-text{font-size:8px;margin-top:6px;line-height:1.3}

.pdf-sample{font-size:10px;text-align:center;color:#9b382c;border:1px dashed #ba7b72;padding:6px;margin-bottom:10px;background:#fff7f6}
.pdf-ledger th,.pdf-ledger td{font-size:8px}
.pdf-ledger .pdf-totals{width:65%!important}
.pdf-chit-section{margin:12px 0 8px;padding:10px 12px;border:1.5px solid #2e6b4e;border-radius:6px;background:#f7fcf9;break-inside:avoid;page-break-inside:avoid}
.pdf-chit-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;border-bottom:1px solid #cde4d6;padding-bottom:6px;margin-bottom:8px}
.pdf-chit-head b{font-size:10.5px;color:#14532d;letter-spacing:.3px;text-transform:uppercase}
.pdf-chit-head span{font-size:9px;color:#334155;font-weight:600}
.pdf-chit-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px}
.pdf-chit-kpi{background:#fff;border:1px solid #d5e8dc;border-radius:4px;padding:5px 7px}
.pdf-chit-kpi small{display:block;font-size:7.5px;color:#475569;text-transform:uppercase;letter-spacing:.2px}
.pdf-chit-kpi strong{display:block;font-size:9.5px;color:#111827;margin-top:1px}
.pdf-chit-section table{margin:6px 0 2px!important}
.pdf-chit-section th{background:#e4f2ea!important;color:#134e2a!important;font-size:8px}
.pdf-chit-subtable th,.pdf-chit-subtable td{font-size:7.5px!important;padding:4px!important}
.pdf-chit-pos{color:#15803d;font-weight:700}
.pdf-chit-neg{color:#b45309;font-weight:700}
.pdf-chit-highlight th,.pdf-chit-highlight td{background:#e6f6ec!important;border-color:#2e6b4e!important;font-weight:700!important;color:#14532d!important}
.pdf-compact-a5-p .pdf-chit-kpis,.pdf-compact-estimate-a5 .pdf-chit-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}

@media print{
  .gl-pdf{box-shadow:none!important;margin:0!important;padding:0!important;max-width:100%!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .pdf-meta,.pdf-brand{break-inside:avoid}
  .pdf-totals,.pdf-bank-section,.pdf-signatures,.pdf-chit-section{break-inside:avoid}
}
`;

const pdfStyle=document.createElement('style');
pdfStyle.textContent=PDF_DOCUMENT_CSS+`
#goldleafPdfRoot{display:none}
.pdf-settings-panel h2{font-size:18px;margin:0 0 4px}
.pdf-settings-subhead{margin:20px 0 8px}
.pdf-settings-subhead h3{font-size:14px;margin:0;color:#1e352b}
.pdf-settings-subhead p{margin:2px 0 0;font-size:12px;color:var(--muted)}
.pdf-choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
.pdf-choice{display:flex;flex-direction:column;gap:8px;padding:11px;border:1px solid var(--line);border-radius:10px;background:#fff;transition:border-color .15s}
.pdf-choice.selected{border:2px solid #ac8954;background:#fffdfa}
.pdf-choice>label{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;cursor:pointer}
.pdf-choice input[type=radio],.pdf-checkbox input{min-height:18px;width:18px;accent-color:#315849}
.pdf-choice small,.pdf-mini{grid-column:1/-1}
.pdf-choice small{font-size:10.5px;color:var(--muted);line-height:1.3}
.pdf-choice button{align-self:flex-start;font-size:11px;padding:3px 8px}
.pdf-mini{display:grid;grid-template-columns:2fr 1fr 1fr;height:54px;border:1px solid #bca67c;border-top:8px solid #bca67c;background:#fff;border-radius:3px;overflow:hidden}
.pdf-mini i{border-right:1px solid #eee;background:repeating-linear-gradient(#fff 0 10px,#eee 11px 12px)}
.pdf-mini-compact{height:46px;margin:4px 10px}
.pdf-mini-detailed{grid-template-columns:repeat(5,1fr);border-top-color:#57738d}
.pdf-mini-modern{border-top-color:#24453b}
.pdf-mini-thermal{grid-template-columns:1fr;border-top-color:#666;height:62px;width:38px;margin:2px auto}
.pdf-toggles-fieldset,.pdf-thermal-settings,.pdf-bank-settings,.pdf-gst-settings{margin:18px 0 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:#fafbfc}
.pdf-toggles-fieldset legend,.pdf-thermal-settings legend,.pdf-bank-settings legend,.pdf-gst-settings legend{padding:0 6px;font-weight:700;font-size:13px;color:#233c30}
.pdf-toggle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.pdf-checkbox{display:flex;gap:8px;align-items:center;font-size:12.5px;cursor:pointer}
.pdf-settings-panel textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13px}
.pdf-preview-overlay{z-index:60}
.pdf-preview-modal{width:min(1180px,100%);height:92dvh;display:flex;flex-direction:column;gap:8px}
.pdf-preview-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pdf-preview-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;background:#f4f7f5;border:1px solid #dbe4de;border-radius:8px;flex-wrap:wrap}
.pdf-preview-pills{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pdf-preview-pill{background:#fff;color:#1e293b;border:1px solid #cbd5e1;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer}
.pdf-preview-pill:hover{border-color:#2e6b4e;color:#14532d}
.pdf-preview-pill.active{background:#18392a;color:#fff;border-color:#18392a}
.pdf-preview-warning{padding:7px 10px;border-radius:6px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;font-size:12px;font-weight:600}
.pdf-preview-modal iframe{flex:1;width:100%;min-height:0;border:1px solid #ddd;background:#fff;border-radius:6px}
@media(max-width:850px){
  .pdf-choices{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .pdf-toggle-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
}
@media(max-width:540px){
  .pdf-choices{grid-template-columns:1fr;gap:8px}
  .pdf-toggle-grid{grid-template-columns:1fr;gap:6px}
}
@media print{
  body.goldleaf-pdf-printing>:not(#goldleafPdfRoot){display:none!important}
  body.goldleaf-pdf-printing #goldleafPdfRoot{display:block!important;width:100%;margin:0;padding:0}
  html,body.goldleaf-pdf-printing{height:auto!important;overflow:visible!important;background:#fff!important}
}
`;
document.head.append(pdfStyle);

const pdfHistoryBase=window.updateHistoryView;
window.updateHistoryView=function(){
  return pdfHistoryBase()
    .replace('v2.4.3 · 6 Nov 2026 · Current','v2.4.3 · 6 Nov 2026')
    .replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.10.44 · Current</h3><ul><li>Added complete Sales Bill & Estimation format selection in Settings across A4 portrait/landscape, A5 compact, and 80mm/58mm thermal rolls.</li><li>Integrated column visibility toggles (Gross/Less, Net, Wastage, Making, HUID, Stones, Exchange, Bank & UPI QR).</li><li>Added live interactive template preview and instant estimation format switching.</li></ul></article>');
};

window.goldleafV2Ready=true;
window.dispatchEvent(new Event('goldleaf-v2-ready'));
if(session)window.pullCloud();
render();
