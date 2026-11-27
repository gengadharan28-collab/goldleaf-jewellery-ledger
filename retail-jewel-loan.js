/* Retail Jewel Loan & Auction: Complete 10-tab workflow (Loan Drafts, Interest Pay, Redemption/Release, Topup/Part-Pay, Pledge Replacement/Repledge, RePledge Redemption, Auction Prior Notice, Auction Sale Catalogue, Schemes & Charges, and Loan Reports). */
(function(){
  const title='Jewel Loan & Auction';
  let shop='',allowed=false,checkedAt=0,checking=false,drafts=[],saving=false,subTab='Drafts',editTxId='';
  const currentShop=()=>session&&workspaceMode==='retail'&&goldleafContext?.has_access?goldleafContext.shop_id||'':'';
  const emptyFilters=()=>({query:'',from:'',to:'',metal:'',scheme:''});
  let selectedDraft=null;
  const today=()=>rbNow().slice(0,10);
  const docs=k=>(typeof rcDocs==='function'?rcDocs(k):(db.retailDocuments||[]).filter(d=>(d.kind||d.type)===k));
  const saveLocalDoc=(kind,row)=>{
    if(!Array.isArray(db.retailDocuments))db.retailDocuments=[];
    const now=new Date().toISOString();
    const saved=Object.assign({id:row.id||crypto.randomUUID(),kind,type:kind,accountType:'customer',createdAt:row.createdAt||now},row,{updatedAt:now});
    const idx=db.retailDocuments.findIndex(x=>x.id===saved.id);
    if(idx<0)db.retailDocuments.unshift(saved);else db.retailDocuments[idx]=saved;
    save();if(typeof pushCloud==='function')pushCloud();
    return saved;
  };
  function field(label,name,type='text',attrs=''){
    return '<label class="rb-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" '+attrs+'></label>';
  }
  const isDemoShop=t=>t==='demo-shop-1'||(typeof platformIsDemo==='function'&&platformIsDemo());
  async function checkAccess(force=false){
    const target=currentShop();
    if(target!==shop){shop=target;allowed=false;drafts=[];checkedAt=0;creating=false;filters=emptyFilters();selectedDraft=null;shown=new Set(defaultLoanColumns);subTab='Drafts';editTxId='';}
    if(!target)return false;
    if(isDemoShop(target)){allowed=true;checkedAt=Date.now();return true;}
    if(!client)return false;
    if(!force&&(checking||Date.now()-checkedAt<10000))return allowed;
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
  async function loadCloudDrafts(){
    const target=currentShop();
    if(!target||isDemoShop(target)||!client||!allowed)return;
    const {data,error}=await client.from('goldleaf_jewel_loan_drafts').select('id,payload,created_at').eq('shop_id',target).order('created_at',{ascending:false}).limit(100);
    if(target!==currentShop()||!allowed)return;
    if(!error)drafts=data||[];
  }
  async function openLoanIntake(){
    if(!rbCanLeave()||!await checkAccess(true))return say('Jewel Loan & Auction access is off or could not be verified.');
    const target=currentShop();
    if(!isDemoShop(target)&&client){
      const {data,error}=await client.from('goldleaf_jewel_loan_drafts').select('id,payload,created_at').eq('shop_id',target).order('created_at',{ascending:false}).limit(100);
      if(target!==currentShop()||!allowed)return;
      if(error)return say(error.message);
      drafts=data||[];
    }
    page=title;edit=null;render();
  }
  window.glOpenJewelLoan=openLoanIntake;
  window.glIsJewelLoanAllowed=()=>!!allowed;
  const prevGo=window.go;
  if(typeof prevGo==='function'){
    window.go=function(target){
      if(target==='Jewel Loan'||target===title){openLoanIntake();return;}
      return prevGo.apply(this,arguments);
    };
  }
  window.glAllJewelLoans=function(){
    const cloud=drafts.map(row=>Object.assign({id:row.id,createdAt:row.created_at},row.payload||{}));
    const local=docs('retail-jewel-loan-draft');
    const seen=new Set(cloud.map(r=>String(r.reference||r.id)));
    for(const r of local)if(!seen.has(String(r.reference||r.id)))cloud.push(r);
    const topups=docs('retail-jewel-loan-topup');
    return cloud.map(l=>{
      const adj=topups.filter(t=>t.loanRef===l.reference).reduce((a,t)=>a+(t.txType==='Part Principal Payment'?-n(t.amount):n(t.amount)),0);
      return adj?Object.assign({},l,{basePrincipal:n(l.principal),principal:Math.max(0,rbRound(n(l.principal)+adj))}):l;
    });
  };
  window.glJewelLoanInterests=()=>docs('retail-jewel-loan-interest');
  window.glJewelLoanRedemptions=()=>docs('retail-jewel-loan-redemption');
  window.glSetLoanSubTab=tab=>{subTab=tab;selectedDraft=null;creating=false;editTxId='';render()};

  function navigation(){
    document.querySelectorAll('[data-retail-loan-nav]').forEach(button=>button.remove());
    if(!allowed||!currentShop()||shop!==currentShop())return;
    const nav=document.getElementById('nav');
    if(nav){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.retailLoanNav='1';
      button.setAttribute('aria-label',title);
      button.title=title;
      button.classList.toggle('active',page===title);
      if(page===title)button.setAttribute('aria-current','page');
      const ico=typeof erpIcon==='function'?erpIcon('chit'):'🔐';
      button.innerHTML='<span class="nav-icon">'+ico+'</span><span class="erp-nav-label">'+esc(title)+'</span>';
      button.onclick=openLoanIntake;
      const chitBtn=nav.querySelector('button[data-rc-sidebar="Chit"],button[aria-label="Chit"]');
      const settingsBtn=nav.querySelector('button[aria-label="Settings"]');
      if(chitBtn)chitBtn.after(button);
      else if(settingsBtn)settingsBtn.before(button);
      else nav.append(button);
      if(typeof erpFilterNavigation==='function'&&typeof erpNavQuery!=='undefined')erpFilterNavigation(erpNavQuery);
    }
    const more=document.getElementById('moreMenu');
    if(more){
      const mBtn=document.createElement('button');
      mBtn.type='button';
      mBtn.dataset.retailLoanNav='1';
      mBtn.textContent=title;
      mBtn.classList.toggle('active',page===title);
      mBtn.onclick=()=>{more.classList.remove('open');openLoanIntake();};
      more.append(mBtn);
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
    return window.glAllJewelLoans().filter(row=>{
      const customer=account(row.customerId,'customer');
      const search=[row.reference,customer?.name,customer?.mobile,customer?.phone,row.item,row.scheme].filter(Boolean).join(' ').toLowerCase();
      return (!filters.scheme||row.scheme===filters.scheme)&&(!query||search.includes(query))&&(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.metal||row.metal===filters.metal);
    });
  }

  window.glSaveLoanInterest=function(event){
    event.preventDefault();
    const f=event.currentTarget;
    if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f));
    const loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    const interestAmt=n(v.interestAmount),otherCharges=n(v.otherCharges),discount=n(v.discount);
    const netAmount=Math.max(0,rbRound(interestAmt+otherCharges-discount));
    if(!v.loanRef||netAmount<=0)return say('Select a loan reference and enter a valid interest amount.');
    saveLocalDoc('retail-jewel-loan-interest',{
      id:editTxId||undefined,
      receiptNo:String(v.receiptNo||'').trim()||('INT-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),
      loanRef:v.loanRef,
      customerId:loan.customerId||v.customerId||'',
      principal:n(v.principal||loan.principal),
      ratePerMonth:n(v.ratePerMonth||1.5),
      interestUpto:v.interestUpto||v.date||today(),
      interestAmount:interestAmt,
      otherCharges,
      discount,
      netAmount,
      paymentMode:v.paymentMode||'Cash',
      remarks:String(v.remarks||'').trim()
    });
    editTxId='';say('Loan interest payment saved.');render();
  };

  window.glSaveLoanRedemption=function(event){
    event.preventDefault();
    const f=event.currentTarget;
    if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f));
    const loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    const principal=n(v.principal||loan.principal),interestAmt=n(v.interestAmount),otherCharges=n(v.otherCharges),discount=n(v.discount),roundOff=n(v.roundOff);
    const netAmount=Math.max(0,rbRound(principal+interestAmt+otherCharges-discount+roundOff));
    if(!v.loanRef||netAmount<=0)return say('Select a loan reference and verify the release settlement amount.');
    saveLocalDoc('retail-jewel-loan-redemption',{
      id:editTxId||undefined,
      releaseNo:String(v.releaseNo||'').trim()||('REL-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),
      loanRef:v.loanRef,
      customerId:loan.customerId||v.customerId||'',
      releaseType:v.releaseType||'Customer Redemption',
      principal,
      interestUpto:v.interestUpto||v.date||today(),
      interestAmount:interestAmt,
      otherCharges,
      discount,
      roundOff,
      netAmount,
      paymentMode:v.paymentMode||'Cash',
      releasedTo:String(v.releasedTo||'').trim(),
      remarks:String(v.remarks||'').trim()
    });
    editTxId='';say('Loan redemption / release saved.');render();
  };

  window.glSaveLoanTopup=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f)),loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    if(!v.loanRef||n(v.amount)<=0)return say('Select a loan reference and enter a valid amount.');
    saveLocalDoc('retail-jewel-loan-topup',{
      EntryNo:String(v.entryNo||'').trim()||('TOP-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),loanRef:v.loanRef,customerId:loan.customerId||'',
      txType:v.txType||'Loan Topup (Additional Disbursal)',
      prevPrincipal:n(loan.principal),amount:n(v.amount),
      paymentMode:v.paymentMode||'Cash',remarks:String(v.remarks||'').trim()
    });
    say('Loan topup / part-payment saved.');render();
  };

  window.glSaveLoanRepledge=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f)),loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    if(!v.loanRef||!v.financier)return say('Select a loan reference and enter financier / replacement details.');
    saveLocalDoc('retail-jewel-loan-repledge',{
      repledgeNo:String(v.repledgeNo||'').trim()||('RPL-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),loanRef:v.loanRef,customerId:loan.customerId||'',
      financier:String(v.financier||'').trim(),
      item:String(v.item||loan.item||'Jewel').trim(),
      grossWt:n(v.grossWt||loan.gross),netWt:n(v.netWt||(n(loan.gross)-n(loan.less))),
      repledgeAmount:n(v.repledgeAmount||loan.principal),
      ratePm:n(v.ratePm||1.0),dueDate:v.dueDate||'',remarks:String(v.remarks||'').trim()
    });
    say('Pledge replacement / repledge saved.');render();
  };

  window.glSaveLoanRepledgeRed=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f));
    if(!v.repledgeNo||n(v.principalPaid)<=0)return say('Select a repledge number and enter principal paid.');
    const net=rbRound(n(v.principalPaid)+n(v.interestPaid)+n(v.otherCharges));
    saveLocalDoc('retail-jewel-loan-repledge-redemption',{
      entryNo:String(v.entryNo||'').trim()||('RPR-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),repledgeNo:v.repledgeNo,loanRef:v.loanRef||'',
      financier:String(v.financier||'').trim(),
      principalPaid:n(v.principalPaid),interestPaid:n(v.interestPaid),otherCharges:n(v.otherCharges),
      netSettled:net,paymentMode:v.paymentMode||'Bank transfer',remarks:String(v.remarks||'').trim()
    });
    say('RePledge redemption saved.');render();
  };

  window.glSaveLoanNotice=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f)),loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    if(!v.loanRef)return say('Select a loan reference.');
    const totalDue=rbRound(n(v.principal||loan.principal)+n(v.interestDue)+n(v.noticeCharges));
    saveLocalDoc('retail-jewel-loan-notice',{
      noticeNo:String(v.noticeNo||'').trim()||('APN-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),loanRef:v.loanRef,customerId:loan.customerId||'',
      principal:n(v.principal||loan.principal),interestDue:n(v.interestDue),noticeCharges:n(v.noticeCharges),
      totalDue,finalDueDate:v.finalDueDate||today(),deliveryMode:v.deliveryMode||'Registered Post',
      status:v.status||'Notice Sent',remarks:String(v.remarks||'').trim()
    });
    say('Auction prior notice recorded.');render();
  };

  window.glSaveLoanAuction=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f)),loan=window.glAllJewelLoans().find(l=>l.reference===v.loanRef)||{};
    if(!v.loanRef||n(v.reservePrice)<=0)return say('Select a loan reference and enter reserve price.');
    const netWt=n(v.netWt||(n(loan.gross)-n(loan.less)));
    saveLocalDoc('retail-jewel-loan-auction',{
      lotNo:String(v.lotNo||'').trim()||('LOT-'+Date.now().toString(36).toUpperCase().slice(-6)),
      date:v.date||today(),loanRef:v.loanRef,customerId:loan.customerId||'',
      item:String(v.item||loan.item||'Jewel').trim(),metal:v.metal||loan.metal||'Gold',
      grossWt:n(v.grossWt||loan.gross),netWt,
      reservePrice:n(v.reservePrice),winningBid:n(v.winningBid),
      bidderName:String(v.bidderName||'').trim(),bidderMobile:String(v.bidderMobile||'').trim(),
      status:v.status||'Catalogue Listed',remarks:String(v.remarks||'').trim()
    });
    say('Auction sale catalogue entry saved.');render();
  };

  window.glSaveLoanScheme=function(event){
    event.preventDefault();
    const f=event.currentTarget;if(!f.reportValidity())return;
    const v=Object.fromEntries(new FormData(f));
    if(!String(v.name||'').trim())return say('Enter a scheme name.');
    saveLocalDoc('retail-jewel-loan-scheme',{
      name:String(v.name).trim(),metal:v.metal||'Gold',
      ratePm:n(v.ratePm||1.5),penalRatePm:n(v.penalRatePm||0.5),
      tenureMonths:n(v.tenureMonths||12),maxRatePerGram:n(v.maxRatePerGram||5200),
      docChargeFlat:n(v.docChargeFlat||100),docChargePct:n(v.docChargePct||0.5),
      status:v.status||'Active'
    });
    say('Jewel loan scheme & document charges saved.');render();
  };

  window.glLoanFillRef=function(sel){
    const f=sel.form,loan=window.glAllJewelLoans().find(l=>l.reference===sel.value);
    if(!f||!loan)return;
    if(f.elements.principal)f.elements.principal.value=n(loan.principal);
    if(f.elements.customerId)f.elements.customerId.value=loan.customerId||'';
    if(f.elements.item)f.elements.item.value=loan.item||'';
    if(f.elements.grossWt)f.elements.grossWt.value=n(loan.gross);
    if(f.elements.netWt)f.elements.netWt.value=Math.max(0,n(loan.gross)-n(loan.less));
    if(f.elements.reservePrice&&!n(f.elements.reservePrice.value))f.elements.reservePrice.value=n(loan.principal);
    const days=Math.max(1,Math.floor((Date.now()-Date.parse(loan.date||today()))/86400000));
    const rate=n(f.elements.ratePerMonth?.value)||1.5;
    const estInt=rbRound(n(loan.principal)*(rate/100)*(days/30));
    if(f.elements.interestAmount&&!n(f.elements.interestAmount.value))f.elements.interestAmount.value=estInt;
    if(f.elements.interestDue&&!n(f.elements.interestDue.value))f.elements.interestDue.value=estInt;
  };

  function subTabsBar(){
    const tabs=['Drafts','Interest Pay','Redemption / Release','Jewel Loan Topup','Pledge Replacement','RePledge Redemption','Auction Prior Notice','Auction Sale Catalogue','Schemes & Charges','Loan Reports'];
    return '<div class="rco-tabs" style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">'+tabs.map(t=>'<button type="button" class="'+(subTab===t?'active':'')+'" onclick="glSetLoanSubTab(\''+t+'\')">'+esc(t)+'</button>').join('')+'</div>';
  }

  function loanSelectOptions(selected=''){
    return '<option value="">Select loan reference</option>'+window.glAllJewelLoans().map(l=>'<option value="'+esc(l.reference)+'" '+(selected===l.reference?'selected':'')+'>'+esc(l.reference)+' · '+esc(account(l.customerId,'customer')?.name||'Customer')+' ('+rateMoney(l.principal)+')</option>').join('');
  }

  function interestPayView(){
    const list=window.glJewelLoanInterests();
    const cur=editTxId?list.find(x=>x.id===editTxId):null;
    return '<section class="panel"><h2>'+(cur?'Edit Interest Payment':'Interest Pay :: Create')+'</h2>'
      +'<form onsubmit="glSaveLoanInterest(event)"><div class="rb-record-grid">'
      +field('Receipt No.','receiptNo','text','placeholder="Auto" value="'+esc(cur?.receiptNo||'')+'"')
      +field('Date','date','date','required value="'+esc(cur?.date||today())+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions(cur?.loanRef)+'</select></label>'
      +'<label class="rb-field"><span>Customer</span><select name="customerId">'+rbCustomerOptions(cur?.customerId)+'</select></label>'
      +field('Principal · ₹','principal','number','step=".01" value="'+(cur?.principal||0)+'"')
      +field('Interest Rate % / month','ratePerMonth','number','step=".01" value="'+(cur?.ratePerMonth||1.5)+'"')
      +field('Interest Upto','interestUpto','date','value="'+esc(cur?.interestUpto||today())+'"')
      +field('Interest Amount · ₹ *','interestAmount','number','required min=".01" step=".01" value="'+(cur?.interestAmount||'')+'"')
      +field('Other Charges · ₹','otherCharges','number','min="0" step=".01" value="'+(cur?.otherCharges||0)+'"')
      +field('Discount · ₹','discount','number','min="0" step=".01" value="'+(cur?.discount||0)+'"')
      +'<label class="rb-field"><span>Payment Mode</span><select name="paymentMode">'+rbOptions(['Cash','UPI','Bank transfer','Card','Cheque'],cur?.paymentMode||'Cash')+'</select></label>'
      +field('Description / Remarks','remarks','text','value="'+esc(cur?.remarks||'')+'"')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Interest Payment</button> '+(cur?'<button type="button" onclick="glSetLoanSubTab(\'Interest Pay\')">Cancel</button>':'')+'</div></form></section>'
      +'<section class="panel"><h2>Interest Payment History · '+list.length+'</h2>'
      +(list.length?table(['Date','Receipt No.','Loan No.','Customer','Principal ₹','Interest Upto','Interest ₹','Charges ₹','Discount ₹','Net Paid ₹','Mode'],list.map(r=>[
        esc(r.date),esc(r.receiptNo),esc(r.loanRef),esc(account(r.customerId,'customer')?.name||'—'),rateMoney(r.principal),esc(r.interestUpto||'—'),rateMoney(r.interestAmount),rateMoney(r.otherCharges),rateMoney(r.discount),'<b>'+rateMoney(r.netAmount)+'</b>',esc(r.paymentMode)
      ])):'<p class="muted">No interest payments recorded yet.</p>')+'</section>';
  }

  function redemptionView(){
    const list=window.glJewelLoanRedemptions();
    const cur=editTxId?list.find(x=>x.id===editTxId):null;
    return '<section class="panel"><h2>'+(cur?'Edit Release':'Redemption / Release :: Create')+'</h2>'
      +'<form onsubmit="glSaveLoanRedemption(event)"><div class="rb-record-grid">'
      +field('Release No.','releaseNo','text','placeholder="Auto" value="'+esc(cur?.releaseNo||'')+'"')
      +field('Date','date','date','required value="'+esc(cur?.date||today())+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions(cur?.loanRef)+'</select></label>'
      +'<label class="rb-field"><span>Customer</span><select name="customerId">'+rbCustomerOptions(cur?.customerId)+'</select></label>'
      +'<label class="rb-field"><span>Release Type</span><select name="releaseType">'+rbOptions(['Customer Redemption','Part Release','Auction Release'],cur?.releaseType||'Customer Redemption')+'</select></label>'
      +field('Principal · ₹ *','principal','number','required min=".01" step=".01" value="'+(cur?.principal||'')+'"')
      +field('Interest Upto','interestUpto','date','value="'+esc(cur?.interestUpto||today())+'"')
      +field('Interest Amount · ₹','interestAmount','number','min="0" step=".01" value="'+(cur?.interestAmount||0)+'"')
      +field('Other Charges · ₹','otherCharges','number','min="0" step=".01" value="'+(cur?.otherCharges||0)+'"')
      +field('Discount · ₹','discount','number','min="0" step=".01" value="'+(cur?.discount||0)+'"')
      +field('Round Off · ₹','roundOff','number','step=".01" value="'+(cur?.roundOff||0)+'"')
      +'<label class="rb-field"><span>Payment Mode</span><select name="paymentMode">'+rbOptions(['Cash','UPI','Bank transfer','Card','Cheque'],cur?.paymentMode||'Cash')+'</select></label>'
      +field('Released To','releasedTo','text','placeholder="Customer / nominee / auction buyer" value="'+esc(cur?.releasedTo||'')+'"')
      +field('Description / Remarks','remarks','text','value="'+esc(cur?.remarks||'')+'"')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Redemption / Release</button> '+(cur?'<button type="button" onclick="glSetLoanSubTab(\'Redemption / Release\')">Cancel</button>':'')+'</div></form></section>'
      +'<section class="panel"><h2>Redemption & Release History · '+list.length+'</h2>'
      +(list.length?table(['Date','Release No.','Loan No.','Customer','Release Type','Principal ₹','Interest ₹','Charges ₹','Discount ₹','Net Amount ₹','Mode','Released To'],list.map(r=>[
        esc(r.date),esc(r.releaseNo),esc(r.loanRef),esc(account(r.customerId,'customer')?.name||'—'),esc(r.releaseType),rateMoney(r.principal),rateMoney(r.interestAmount),rateMoney(r.otherCharges),rateMoney(r.discount),'<b>'+rateMoney(r.netAmount)+'</b>',esc(r.paymentMode),esc(r.releasedTo||'—')
      ])):'<p class="muted">No redemptions or releases recorded yet.</p>')+'</section>';
  }

  function topupView(){
    const list=docs('retail-jewel-loan-topup');
    return '<section class="panel"><h2>Jewel Loan Topup & Part-Payment :: Create</h2>'
      +'<form onsubmit="glSaveLoanTopup(event)"><div class="rb-record-grid">'
      +field('Entry No.','entryNo','text','placeholder="Auto"')
      +field('Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions()+'</select></label>'
      +'<label class="rb-field"><span>Transaction Type</span><select name="txType">'+rbOptions(['Loan Topup (Additional Disbursal)','Part Principal Payment'],'Loan Topup (Additional Disbursal)')+'</select></label>'
      +field('Current Principal · ₹','principal','number','readonly step=".01"')
      +field('Topup / Part Amount · ₹ *','amount','number','required min=".01" step=".01"')
      +'<label class="rb-field"><span>Payment Mode</span><select name="paymentMode">'+rbOptions(['Cash','UPI','Bank transfer','Card','Cheque'],'Cash')+'</select></label>'
      +field('Remarks','remarks','text')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Topup / Part-Payment</button></div></form></section>'
      +'<section class="panel"><h2>Loan Topup & Part-Payment History · '+list.length+'</h2>'
      +(list.length?table(['Date','Entry No.','Loan No.','Customer','Type','Prev. Principal ₹','Topup / Part ₹','Mode','Remarks'],list.map(r=>[
        esc(r.date),esc(r.EntryNo||'—'),'<b>'+esc(r.loanRef)+'</b>',esc(account(r.customerId,'customer')?.name||'—'),esc(r.txType),rateMoney(r.prevPrincipal),'<b>'+rateMoney(r.amount)+'</b>',esc(r.paymentMode),esc(r.remarks||'—')
      ])):'<p class="muted">No loan topups or part-payments recorded yet.</p>')+'</section>';
  }

  function repledgeView(){
    const list=docs('retail-jewel-loan-repledge');
    return '<section class="panel"><h2>Pledge Replacement / Financier RePledge :: Create</h2>'
      +'<form onsubmit="glSaveLoanRepledge(event)"><div class="rb-record-grid">'
      +field('RePledge No.','repledgeNo','text','placeholder="Auto"')
      +field('Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions()+'</select></label>'
      +field('Financier / Bank Name *','financier','text','required placeholder="e.g. Bank / Financier / Replacement"')
      +field('Pledge / Replacement Item','item','text','required')
      +field('Gross Wt · g','grossWt','number','step=".001" required')
      +field('Net Wt · g','netWt','number','step=".001" required')
      +field('RePledge Principal · ₹ *','repledgeAmount','number','step=".01" required')
      +field('Interest Rate % / month','ratePm','number','step=".01" value="1.0"')
      +field('Due Date','dueDate','date')
      +field('Remarks','remarks','text')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Pledge Replacement / RePledge</button></div></form></section>'
      +'<section class="panel"><h2>Pledge Replacement & RePledge List · '+list.length+'</h2>'
      +(list.length?table(['Date','RePledge No.','Loan No.','Financier / Bank','Item','Gross g','Net g','RePledge Amt ₹','Rate %/m','Due Date'],list.map(r=>[
        esc(r.date),'<b>'+esc(r.repledgeNo)+'</b>',esc(r.loanRef),'<b>'+esc(r.financier)+'</b>',esc(r.item),fmt(r.grossWt)+' g',fmt(r.netWt)+' g','<b>'+rateMoney(r.repledgeAmount)+'</b>',n(r.ratePm)+'%',esc(r.dueDate||'—')
      ])):'<p class="muted">No pledge replacements or repledges recorded yet.</p>')+'</section>';
  }

  function repledgeRedView(){
    const reps=docs('retail-jewel-loan-repledge'),list=docs('retail-jewel-loan-repledge-redemption');
    const repOpts='<option value="">Select RePledge No.</option>'+reps.map(r=>'<option value="'+esc(r.repledgeNo)+'">'+esc(r.repledgeNo)+' · '+esc(r.financier)+' ('+rateMoney(r.repledgeAmount)+')</option>').join('');
    return '<section class="panel"><h2>RePledge Redemption :: Create</h2>'
      +'<form onsubmit="glSaveLoanRepledgeRed(event)"><div class="rb-record-grid">'
      +field('Redemption Entry No.','entryNo','text','placeholder="Auto"')
      +field('Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>RePledge No. *</span><select name="repledgeNo" required>'+repOpts+'</select></label>'
      +field('Linked Loan No.','loanRef','text')
      +field('Financier / Bank','financier','text')
      +field('Principal Paid · ₹ *','principalPaid','number','required min=".01" step=".01"')
      +field('Interest Paid · ₹','interestPaid','number','min="0" step=".01" value="0"')
      +field('Other Charges · ₹','otherCharges','number','min="0" step=".01" value="0"')
      +'<label class="rb-field"><span>Payment Mode</span><select name="paymentMode">'+rbOptions(['Bank transfer','Cash','UPI','Cheque'],'Bank transfer')+'</select></label>'
      +field('Remarks','remarks','text')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save RePledge Redemption</button></div></form></section>'
      +'<section class="panel"><h2>RePledge Redemption List · '+list.length+'</h2>'
      +(list.length?table(['Date','Entry No.','RePledge No.','Financier','Principal Paid ₹','Interest Paid ₹','Charges ₹','Net Settled ₹','Mode'],list.map(r=>[
        esc(r.date),'<b>'+esc(r.entryNo)+'</b>',esc(r.repledgeNo),esc(r.financier||'—'),rateMoney(r.principalPaid),rateMoney(r.interestPaid),rateMoney(r.otherCharges),'<b>'+rateMoney(r.netSettled)+'</b>',esc(r.paymentMode)
      ])):'<p class="muted">No repledge redemptions recorded yet.</p>')+'</section>';
  }

  function auctionNoticeView(){
    const list=docs('retail-jewel-loan-notice');
    return '<section class="panel"><h2>Auction Prior Notice :: Create</h2>'
      +'<form onsubmit="glSaveLoanNotice(event)"><div class="rb-record-grid">'
      +field('Notice No.','noticeNo','text','placeholder="Auto"')
      +field('Notice Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions()+'</select></label>'
      +field('Principal · ₹','principal','number','step=".01" required')
      +field('Interest Due · ₹','interestDue','number','step=".01" required')
      +field('Notice Charges · ₹','noticeCharges','number','step=".01" value="150"')
      +field('Final Due Date *','finalDueDate','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Delivery Mode</span><select name="deliveryMode">'+rbOptions(['Registered Post','SMS & WhatsApp','Courier','Public Notice Board'],'Registered Post')+'</select></label>'
      +'<label class="rb-field"><span>Notice Status</span><select name="status">'+rbOptions(['Notice Sent','Acknowledged','Customer Responded','Moved to Auction'],'Notice Sent')+'</select></label>'
      +field('Remarks','remarks','text')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Auction Notice</button></div></form></section>'
      +'<section class="panel"><h2>Auction Prior Notices · '+list.length+'</h2>'
      +(list.length?table(['Notice Date','Notice No.','Loan No.','Customer','Principal ₹','Interest Due ₹','Notice Chg ₹','Total Demand ₹','Final Due Date','Mode','Status'],list.map(r=>[
        esc(r.date),'<b>'+esc(r.noticeNo)+'</b>','<b>'+esc(r.loanRef)+'</b>',esc(account(r.customerId,'customer')?.name||'—'),rateMoney(r.principal),rateMoney(r.interestDue),rateMoney(r.noticeCharges),'<b>'+rateMoney(r.totalDue)+'</b>',esc(r.finalDueDate),esc(r.deliveryMode),esc(r.status)
      ])):'<p class="muted">No auction prior notices issued yet.</p>')+'</section>';
  }

  function auctionCatalogueView(){
    const list=docs('retail-jewel-loan-auction');
    return '<section class="panel"><h2>Auction Sale Catalogue :: Create Lot</h2>'
      +'<form onsubmit="glSaveLoanAuction(event)"><div class="rb-record-grid">'
      +field('Catalogue Lot No.','lotNo','text','placeholder="Auto"')
      +field('Auction Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Loan No. *</span><select name="loanRef" required onchange="glLoanFillRef(this)">'+loanSelectOptions()+'</select></label>'
      +field('Jewel / Ornament','item','text','required')
      +'<label class="rb-field"><span>Metal</span><select name="metal"><option>Gold</option><option>Silver</option></select></label>'
      +field('Gross Wt · g','grossWt','number','step=".001" required')
      +field('Net Wt · g','netWt','number','step=".001" required')
      +field('Reserve Price · ₹ *','reservePrice','number','step=".01" required')
      +field('Winning Bid · ₹','winningBid','number','step=".01" value="0"')
      +field('Bidder Name','bidderName','text')
      +field('Bidder Mobile','bidderMobile','tel')
      +'<label class="rb-field"><span>Lot Status</span><select name="status">'+rbOptions(['Catalogue Listed','Sold in Auction','Settled by Customer','Withdrawn'],'Catalogue Listed')+'</select></label>'
      +field('Remarks','remarks','text')
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Auction Catalogue Lot</button></div></form></section>'
      +'<section class="panel"><h2>Auction Sale Catalogue Lots · '+list.length+'</h2>'
      +(list.length?table(['Auction Date','Lot No.','Loan No.','Item','Metal','Gross g','Net g','Reserve Price ₹','Winning Bid ₹','Bidder','Status'],list.map(r=>[
        esc(r.date),'<b>'+esc(r.lotNo)+'</b>',esc(r.loanRef),esc(r.item),esc(r.metal),fmt(r.grossWt)+' g',fmt(r.netWt)+' g',rateMoney(r.reservePrice),'<b>'+rateMoney(r.winningBid)+'</b>',esc(r.bidderName||'—'),esc(r.status)
      ])):'<p class="muted">No auction catalogue lots listed yet.</p>')+'</section>';
  }

  function schemesView(){
    const list=docs('retail-jewel-loan-scheme');
    return '<section class="panel"><h2>Jewel Loan Schemes & Document Charges</h2>'
      +'<form onsubmit="glSaveLoanScheme(event)"><div class="rb-record-grid">'
      +field('Scheme Name *','name','text','required placeholder="e.g. Gold 1.5% Monthly"')
      +'<label class="rb-field"><span>Metal</span><select name="metal"><option>Gold</option><option>Silver</option></select></label>'
      +field('Interest Rate % / month','ratePm','number','step=".01" value="1.5" required')
      +field('Penal Interest % / month','penalRatePm','number','step=".01" value="0.5"')
      +field('Tenure (Months)','tenureMonths','number','step="1" value="12"')
      +field('Max Loan Rate / gram · ₹','maxRatePerGram','number','step="1" value="5200"')
      +field('Document Charge (Flat ₹)','docChargeFlat','number','step=".01" value="100"')
      +field('Document Charge (%)','docChargePct','number','step=".01" value="0.5"')
      +'<label class="rb-field"><span>Status</span><select name="status"><option>Active</option><option>Disabled</option></select></label>'
      +'</div><div style="margin-top:10px"><button class="primary" type="submit">Save Loan Scheme</button></div></form></section>'
      +'<section class="panel"><h2>Configured Loan Schemes · '+list.length+'</h2>'
      +(list.length?table(['Scheme Name','Metal','Interest %/m','Penal %/m','Tenure','Max Rate/g ₹','Doc Charge ₹','Doc Charge %','Status'],list.map(r=>[
        '<b>'+esc(r.name)+'</b>',esc(r.metal),n(r.ratePm)+'%',n(r.penalRatePm)+'%',n(r.tenureMonths)+' m',rateMoney(r.maxRatePerGram),rateMoney(r.docChargeFlat),n(r.docChargePct)+'%',esc(r.status)
      ])):'<p class="muted">No custom schemes saved yet.</p>')+'</section>';
  }

  function loanReportsQuickView(){
    const reps=['Interest Due Report','Jewel Loan Stock Report','Jewel Loan Date Wise Report','Jewel Loan Area Wise Report','Jewel Loan Hand Stock Report','Jewel Loan Dashboard'];
    return '<section class="panel"><h2>Jewel Loan & Auction Reports</h2><p class="muted">Open any Jewel Loan report in the Retail Reports Hub:</p><div style="display:flex;flex-wrap:wrap;gap:8px">'
      +reps.map(r=>'<button type="button" class="gl-dt-btn" style="padding:10px 16px" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\''+r+'\')">📊 '+esc(r)+'</button>').join('')
      +'</div></section>';
  }

  function intake(){
    const top=header('Complete Jewel Loan & Auction Workflow: Drafts, Interest Pay, Release, Topup, RePledge, Auction & Reports.')+subTabsBar();
    if(subTab==='Interest Pay')return top+interestPayView();
    if(subTab==='Redemption / Release')return top+redemptionView();
    if(subTab==='Jewel Loan Topup')return top+topupView();
    if(subTab==='Pledge Replacement')return top+repledgeView();
    if(subTab==='RePledge Redemption')return top+repledgeRedView();
    if(subTab==='Auction Prior Notice')return top+auctionNoticeView();
    if(subTab==='Auction Sale Catalogue')return top+auctionCatalogueView();
    if(subTab==='Schemes & Charges')return top+schemesView();
    if(subTab==='Loan Reports')return top+loanReportsQuickView();
    if(selectedDraft)return top+'<section class="panel"><div class="rb-section-head"><h2>Loan draft details</h2>'
      +'<button type="button" onclick="glLoanCreate(false)">← Draft list</button></div><dl class="rb-record-grid">'
      +Object.values(loanColumns).map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(value(selectedDraft)??'—')+'</dd></div>').join('')
      +'</dl></section>';
    const schemeNames=[...new Set([...docs('retail-jewel-loan-scheme').map(s=>s.name),...window.glAllJewelLoans().map(row=>row.scheme)].filter(Boolean))].sort();
    if(creating)return top+'<button type="button" onclick="glLoanCreate(false)">← Draft list</button>'
      +'<section class="panel"><h2>New jewel loan draft</h2><form id="glJewelLoanDraft" onsubmit="glSaveJewelLoanDraft(event)"><div class="rb-record-grid">'
      +field('Loan reference','reference','text','required maxlength="60"')
      +field('Date','date','date','required value="'+today()+'"')
      +'<label class="rb-field"><span>Customer ledger</span><select name="customerId" required>'+rbCustomerOptions()+'</select></label>'
      +field('Scheme name','scheme','text','required maxlength="80" list="glLoanSchemeList"')+('<datalist id="glLoanSchemeList">'+schemeNames.map(s=>'<option value="'+esc(s)+'">').join('')+'</datalist>')
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
    const total=rows.reduce((sum,row)=>sum+n(row.principal),0);
    return top+'<section class="panel"><div class="rb-section-head"><h2>Jewel loan drafts</h2>'
      +'<button type="button" class="primary" onclick="glLoanCreate(true)">＋ Create</button></div>'
      +'<form onsubmit="glLoanFilter(event)" class="rb-record-grid">'
      +field('Search by reference, customer or item','query','search','value="'+esc(filters.query)+'"')
      +field('From','from','date','value="'+esc(filters.from)+'"')
      +field('To','to','date','value="'+esc(filters.to)+'"')
      +'<label class="rb-field"><span>Metal</span><select name="metal"><option value="">All metals</option>'+rbOptions(['Gold','Silver'],filters.metal)+'</select></label>'
      +'<label class="rb-field"><span>Scheme</span><select name="scheme"><option value="">All schemes</option>'+rbOptions(schemeNames,filters.scheme)+'</select></label>'
      +'<div><button type="submit">Apply filters</button> <button type="button" onclick="glLoanReset()">Reset</button></div></form>'
      +'<details id="glLoanColumnOptions"><summary>Display Columns</summary><div class="rb-record-grid">'
      +Object.entries(loanColumns).map(([key,[label]])=>'<label><input type="checkbox" value="'+key+'" '+(shown.has(key)?'checked':'')+' onchange="glLoanColumns(this)"> '+label+'</label>').join('')
      +'</div></details><p class="muted">'+rows.length+' matching · latest '+window.glAllJewelLoans().length+' loaded (up to 100)</p>'
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
      if(isDemoShop(target)){
        saveLocalDoc('retail-jewel-loan-draft',data);
        creating=false;render();say('Jewel loan draft saved.');return;
      }
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
      if(allowed&&!drafts.length)loadCloudDrafts();
      if(page===title&&!allowed){page='Dashboard';render();}else navigation();
    });
    return result;
  };
  setInterval(()=>{
    if(document.visibilityState==='visible'&&currentShop()&&!checking)checkAccess().then(()=>{
      if(page===title&&!allowed){page='Dashboard';render();}else navigation();
    });
  },15000);
  window.addEventListener('focus',()=>{
    if(currentShop()&&!checking)checkAccess(true).then(()=>{
      if(allowed&&!drafts.length)loadCloudDrafts();
      if(page===title&&!allowed){page='Dashboard';render();}else navigation();
    });
  });
  render();
})();
