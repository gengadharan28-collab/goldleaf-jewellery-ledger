/* Retail Jewel Loan intake. Drafts are stored only in the protected cloud table. */
(function(){
  const title='Jewel Loan & Auction';
  let shop='',allowed=false,checkedAt=0,checking=false,drafts=[],saving=false;
  const currentShop=()=>session&&workspaceMode==='retail'&&goldleafContext?.has_access?goldleafContext.shop_id||'':'';
  const today=()=>rbNow().slice(0,10);
  function field(label,name,type='text',attrs=''){
    return '<label class="rb-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" '+attrs+'></label>';
  }
  async function checkAccess(force=false){
    const target=currentShop();
    if(target!==shop){shop=target;allowed=false;drafts=[];checkedAt=0;}
    if(!target||!client)return false;
    if(!force&&(checking||Date.now()-checkedAt<30000))return allowed;
    checking=true;
    try{
      const {data,error}=await client.from('goldleaf_jewel_loan_access').select('enabled').eq('shop_id',target).maybeSingle();
      if(target!==currentShop())return false;
      allowed=!error&&data?.enabled===true;
      if(!allowed)drafts=[];
      checkedAt=Date.now();
      return allowed;
    }catch{if(target===currentShop()){allowed=false;drafts=[];checkedAt=Date.now()}return false;}
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
  function intake(){
    const rows=drafts.map(({payload:p})=>[esc(p.reference),esc(p.date),esc(account(p.customerId,'customer')?.name||'—'),esc(p.item),esc(p.metal),fmt(p.gross-p.less),rateMoney(p.principal)]);
    return header('Record pledge details for review. Drafts do not post payments or activate loans.')
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
      +'</div><button class="primary" type="submit">Save draft</button></form></section>'
      +'<section class="panel"><h2>Recent loan drafts</h2>'+(rows.length?table(['Reference','Date','Customer','Pledge item','Metal','Net g','Principal ₹'],rows):'<p>No drafts yet.</p>')+'</section>';
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
      drafts.unshift(row);render();say('Jewel loan draft saved.');
    }catch(error){say(error.message||'Draft could not be saved.')}
    finally{saving=false}
  };
  const previous=window.render;
  window.render=function(){
    if(page===title&&(!currentShop()||!allowed||shop!==currentShop()))page='Dashboard';
    const result=previous.apply(this,arguments);
    if(page===title&&allowed&&currentShop()){const root=document.getElementById('app');if(root)root.innerHTML=intake();}
    navigation();
    if(!currentShop()){shop='';allowed=false;drafts=[];checkedAt=0;}
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
