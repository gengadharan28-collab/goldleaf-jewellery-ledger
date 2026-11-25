/* Retail Jewel Loan intake. Drafts are stored only in the protected cloud table. */
(function(){
  const title='Jewel Loan & Auction';
  let shop='',allowed=false,checkedAt=0,checking=false,drafts=[],saving=false;
  const currentShop=()=>session&&workspaceMode==='retail'&&goldleafContext?.has_access?goldleafContext.shop_id||'':'';
  const emptyFilters=()=>({query:'',from:'',to:'',metal:'',scheme:''});
  let selectedDraft=null;
  const today=()=>rbNow().slice(0,10);
  function field(label,name,type='text',attrs=''){
    return '<label class="rb-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" '+attrs+'></label>';
  }
  async function checkAccess(force=false){
    const target=currentShop();
    if(target!==shop){shop=target;allowed=false;drafts=[];checkedAt=0;creating=false;filters=emptyFilters();selectedDraft=null;shown=new Set(defaultLoanColumns);}
    if(!target||!client)return false;
    if(!force&&(checking||Date.now()-checkedAt<30000))return allowed;
    checking=true;
    try{
      const {data,error}=await client.from('goldleaf_jewel_loan_access').select('enabled').eq('shop_id',target).maybeSingle();
      if(target!==currentShop())return false;
      allowed=!error&&data?.enabled===true;
      if(!allowed){drafts=[];selectedDraft=null;}
      checkedAt=Date.now();
      return allowed;
    }catch{if(target===currentShop()){allowed=false;drafts=[];selectedDraft=null;checkedAt=Date.now()}return false;}
    finally{checking=false}
  }
  async function openLoanIntake(){
    if(!rbCanLeave()||!await checkAccess(true))return say('Jewel Loan & Auction access is off or could not be verified.');
    const target=currentShop();
    const {data,error}=await client.from('goldleaf_jewel_loan_drafts').select('id,payload,created_at').eq('shop_id',target).order('created_at',{ascending:false}).limit(100);
    if(target!==currentShop()||!allowed)return;
    if(error)return say(error.message);
    drafts=data||[];
    page=title;edit=null;render();
  }
  function navigation(){
    document.querySelectorAll('[data-retail-loan-nav]').forEach(button=>button.remove());
    if(!allowed||!currentShop()||shop!==currentShop())return;
    for(const parent of [document.getElementById('nav'),document.getElementById('moreMenu')]){
      if(!parent)continue;
      const button=document.createElement('button');
      button.type='button';button.dataset.retailLoanNav='1';button.textContent=title;
      button.classList.toggle('active',page===title);button.onclick=openLoanIntake;
      parent.append(button);
    }
  }

  const loanColumns={
    reference:['Reference',p=>p.reference],date:['Date',p=>p.date],customer:['Customer',p=>account(p.customerId,'customer')?.name||'—'],
    item:['Pledge item',p=>p.item],metal:['Metal',p=>p.metal],net:['Net g',p=>fmt(n(p.gross)-n(p.less))],
    principal:['Principal ₹',p=>rateMoney(p.principal)],scheme:['Scheme',p=>p.scheme],staff:['Attended by',p=>p.staff||'—'],
    nomineeName:['Nominee',p=>p.nomineeName||'—'],nomineeType:['Nominee relationship',p=>p.nomineeType||'—'],
    purity:['Purity %',p=>p.purity||'—'],gross:['Gross g',p=>fmt(n(p.gross))],less:['Less g',p=>fmt(n(p.less))],
    charges:['Other charges ₹',p=>rateMoney(n(p.charges))],remarks:['Remarks',p=>p.remarks||'—']
  };
  const defaultLoanColumns=['reference','date','customer','item','metal','net','principal'];
  let shown=new Set(defaultLoanColumns),filters=emptyFilters(),creating=false;
  window.glLoanCreate=value=>{selectedDraft=null;creating=value;render()};
  window.glLoanView=index=>{selectedDraft=filteredLoanDrafts()[index]||null;render()};
  window.glLoanFilter=function(event){
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget));
    if(values.from&&values.to&&values.from>values.to)return say('Choose a valid date range.');
    filters=values;render();
  };
  window.glLoanReset=function(){filters=emptyFilters();selectedDraft=null;shown=new Set(defaultLoanColumns);render()};
  window.glLoanColumns=function(input){
    if(input.checked)shown.add(input.value);
    else if(shown.size>1)shown.delete(input.value);
    else input.checked=true;
    render();
    document.getElementById('glLoanColumnOptions')?.setAttribute('open','');
  };
  function filteredLoanDrafts(){
    const query=filters.query.trim().toLowerCase();
    return drafts.map(row=>row.payload).filter(row=>{
      const customer=account(row.customerId,'customer');
      const search=[row.reference,customer?.name,customer?.mobile,customer?.phone,row.item,row.scheme].filter(Boolean).join(' ').toLowerCase();
      return (!filters.scheme||row.scheme===filters.scheme)&&(!query||search.includes(query))&&(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.metal||row.metal===filters.metal);
    });
  }
  function intake(){
    const top=header('Protected loan drafts for review. Drafts do not post payments or activate loans.');
    if(selectedDraft)return top+'<section class="panel"><div class="rb-section-head"><h2>Loan draft details</h2>'
      +'<button type="button" onclick="glLoanCreate(false)">← Draft list</button></div><dl class="rb-record-grid">'
      +Object.values(loanColumns).map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(value(selectedDraft)??'—')+'</dd></div>').join('')
      +'</dl></section>';
    if(creating)return top+'<button type="button" onclick="glLoanCreate(false)">← Draft list</button>'
      +'<section class="panel"><h2>New jewel loan draft</h2><form id="glJewelLoanDraft" onsubmit="glSaveJewelLoanDraft(event)"><div class="rb-record-grid">'
      +field('Loan reference','reference','text','required maxlength="60"')
      +field('Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Customer ledger</span><select name="customerId" required>'+rbCustomerOptions()+'</select></label>'
      +field('Scheme name','scheme','text','required maxlength="80"')
      +field('Attended by','staff','text','maxlength="80"')
      +field('Nominee relationship','nomineeType','text','maxlength="80"')
      +field('Nominee name','nomineeName','text','maxlength="100"')
      +field('Jewel name','item','text','required maxlength="100"')
      +'<label class="rb-field"><span>Metal</span><select name="metal"><option>Gold</option><option>Silver</option></select></label>'
      +field('Quality / purity %','purity','number','min="0" max="100" step=".01"')
      +field('Gross weight · g','gross','number','required min=".001" step=".001"')
      +field('Stone / less weight · g','less','number','min="0" step=".001"')
      +field('Proposed principal · ₹','principal','number','required min=".01" step=".01"')
      +field('Other charges · ₹','charges','number','min="0" step=".01"')
      +field('Remarks','remarks','text','maxlength="300"')
      +'</div><button class="primary" type="submit">Save draft</button></form></section>';
    const keys=Object.keys(loanColumns).filter(key=>shown.has(key));
    const rows=filteredLoanDrafts();
    const schemes=[...new Set(drafts.map(row=>row.payload.scheme).filter(Boolean))].sort();
    const total=rows.reduce((sum,row)=>sum+n(row.principal),0);
    return top+'<section class="panel"><div class="rb-section-head"><h2>Jewel loan drafts</h2>'
      +'<button type="button" class="primary" onclick="glLoanCreate(true)">＋ Create</button></div>'
      +'<form onsubmit="glLoanFilter(event)" class="rb-record-grid">'
      +field('Search by reference, customer or item','query','search','value="'+esc(filters.query)+'"')
      +field('From','from','date','value="'+esc(filters.from)+'"')
      +field('To','to','date','value="'+esc(filters.to)+'"')
      +'<label class="rb-field"><span>Metal</span><select name="metal"><option value="">All metals</option>'+rbOptions(['Gold','Silver'],filters.metal)+'</select></label>'
      +'<label class="rb-field"><span>Scheme</span><select name="scheme"><option value="">All schemes</option>'+rbOptions(schemes,filters.scheme)+'</select></label>'
      +'<div><button type="submit">Apply filters</button> <button type="button" onclick="glLoanReset()">Reset</button></div></form>'
      +'<details id="glLoanColumnOptions"><summary>Display Columns</summary><div class="rb-record-grid">'
      +Object.entries(loanColumns).map(([key,[label]])=>'<label><input type="checkbox" value="'+key+'" '+(shown.has(key)?'checked':'')+' onchange="glLoanColumns(this)"> '+label+'</label>').join('')
      +'</div></details><p class="muted">'+rows.length+' matching · latest '+drafts.length+' loaded (up to 100)</p>'
      +(rows.length?'<div class="rb-total-history">'+table([...keys.map(key=>loanColumns[key][0]),'Action'],rows.map((row,index)=>[
        ...keys.map(key=>esc(loanColumns[key][1](row)??'—')),
        '<button type="button" onclick="glLoanView('+index+')">View</button>'
      ]))+'<p><strong>Filtered principal total '+esc(rateMoney(total))+'</strong></p>'+'</div>':'<p>No matching loan drafts.</p>')+'</section>';
  }
  window.glSaveJewelLoanDraft=async function(event){
    event.preventDefault();
    const form=event.currentTarget;
    if(saving||!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));
    const numeric=['gross','less','purity','principal','charges'];
    const data=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,numeric.includes(key)?n(value):String(value).trim()]));
    if(!account(data.customerId,'customer')||!data.reference||!data.scheme||!data.item||data.less>=data.gross||data.less<0||data.principal<=0)return say('Check the customer, scheme, pledge and principal.');
    const target=currentShop();
    saving=true;
    try{
      if(!await checkAccess(true)||target!==currentShop()){navigation();return say('Loan access is unavailable.');}
      const {data:row,error}=await client.from('goldleaf_jewel_loan_drafts').insert({shop_id:target,payload:data}).select('id,payload,created_at').single();
      if(error)throw error;
      if(target!==currentShop()||!allowed)return;
      drafts.unshift(row);creating=false;render();say('Jewel loan draft saved.');
    }catch(error){say(error.message||'Draft could not be saved.')}
    finally{saving=false}
  };
  const previous=window.render;
  window.render=function(){
    if(page===title&&(!currentShop()||!allowed||shop!==currentShop()))page='Dashboard';
    const result=previous.apply(this,arguments);
    if(page===title&&allowed&&currentShop()){const root=document.getElementById('app');if(root)root.innerHTML=intake();}
    navigation();
    if(!currentShop()){shop='';allowed=false;drafts=[];selectedDraft=null;checkedAt=0;}
    else if(!checking&&(currentShop()!==shop||Date.now()-checkedAt>=30000))checkAccess().then(()=>{
      if(page===title&&!allowed){page='Dashboard';render();}else navigation();
    });
    return result;
  };
  setInterval(()=>{
    if(document.visibilityState==='visible'&&currentShop()&&!checking)checkAccess().then(()=>{
      if(page===title&&!allowed){page='Dashboard';render();}else navigation();
    });
  },30000);
  render();
})();
