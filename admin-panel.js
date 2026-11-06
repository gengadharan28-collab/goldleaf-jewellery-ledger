// Separate platform controls from each shop's jewellery workspace.
let platformPage = new URLSearchParams(location.search).get('admin') === '1' ? 'Dashboard' : '';
let platformError = '', platformLoadedUser = '', platformInvites = [], platformPlans = [];
const platformBaseRender = window.render, platformBaseGo = window.go;
const platformBaseSettings = window.settingsView, platformBaseHeader = window.header;
const platformBaseSetMode = window.setWorkspaceMode;
const platformPreviousHistory=window.updateHistoryView;
window.updateHistoryView=function(){return platformPreviousHistory().replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.4.1 · 6 Nov 2026 · Current</h3><ul><li>Added reset protection so erased shop entries cannot return from an older device.</li></ul></article>').replace('<section class="panel"><h2>Update history</h2>','<section class="panel"><h2>Update history</h2><article class="release-note"><h3>v2.4.0 · 6 Nov 2026</h3><ul><li>Separate Super Admin dashboard with signup, paid-shop and subscription controls.</li><li>Approve Retail, Wholesale or both; create shop invitations; edit subscription plans and shared rates.</li><li>Workspace permissions are checked in the cloud. Local records stay with their shop.</li></ul></article>').replace('v2.3.0 · 6 Nov 2026 · Current','v2.3.0 · 6 Nov 2026').replace('v2.0.9 · 6 Nov 2026 · Current','v2.0.9 · 6 Nov 2026').replace('Goldleaf v2.3.0','Goldleaf v2.4.0');};
const platformDate = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const platformModules = shop => [shop.retail_enabled && 'Retail', shop.wholesale_enabled && 'Wholesale'].filter(Boolean).join(' + ') || 'Awaiting approval';
const platformLink = () => location.origin + location.pathname;
const platformInput = (label, name, type = 'text', value = '', extra = '') => `<div class="field"><label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label></div>`;
function platformNav(active) {
  const items = ['Dashboard', 'Shops & access', 'Create shop', 'Subscription plans', 'Shared rates'];
  document.getElementById('nav').innerHTML = items.map((label, i) => `<button class="${active === label ? 'active' : ''}" onclick="platformOpen('${label}')"><span class="nav-icon">${['⌂','♙','＋','◷','◈'][i]}</span><span>${label}</span></button>`).join('') + '<button onclick="platformWorkspace()">◇ My shop workspace</button><button onclick="platformSignOut()">↪ Sign out</button>';
}
window.platformOpen = function(target = 'Dashboard') { platformPage = target; history.replaceState(null, '', platformLink() + '?admin=1'); render(); };
window.platformWorkspace = function() { platformPage = ''; history.replaceState(null, '', platformLink()); page = 'Dashboard'; render(); };
window.platformSignOut = async function() { await client.auth.signOut(); session = null; goldleafContext = null; platformLoadedUser = ''; platformPage = 'Dashboard'; render(); };
window.platformRefresh = async function() { if (!session || !client) return; await window.pullCloud(); render(); };

function platformTop(title, subtitle) {
  document.body.classList.remove('compact-customer-sale');document.documentElement.classList.remove('compact-customer-sale');
  return `<header class="top"><div><div class="eyebrow">GOLDLEAF · SUPER ADMIN</div><h1>${title}</h1><div class="muted">${subtitle}</div></div><div class="header-actions"><button onclick="toggleTheme()">${appTheme === 'dark' ? '☀ Light' : '☾ Dark'}</button><button onclick="platformRefresh()">Refresh</button></div></header>`;
}
function platformPlanOptions(current = 'trial') {
  return ['trial','demo','monthly','yearly'].map(plan => `<option value="${plan}" ${plan === current ? 'selected' : ''}>${plan === 'trial' ? 'Free trial · 7 days' : plan === 'demo' ? 'Demo · 7 days' : plan === 'monthly' ? 'Monthly · 1 month' : 'Yearly · 1 year'}</option>`).join('');
}
function platformAccessFields(shop = {}) {
  return `<div class="platform-checks"><label><input type="checkbox" name="retail" ${shop.retail_enabled ? 'checked' : ''}> Retail</label><label><input type="checkbox" name="wholesale" ${shop.wholesale_enabled ? 'checked' : ''}> Wholesale</label></div>`;
}
function platformDashboard() {
  const shops = goldleafAdminShops, paid = shops.filter(s => s.payment_count > 0), active = shops.filter(s => ['active','trial'].includes(s.subscription_status) && Date.parse(s.expires_at) > Date.now());
  return platformTop('Super Admin', 'Your shop registrations, subscriptions, access and shared rates.') + `<div class="cards platform-metrics">${card('SIGNED-UP SHOPS', shops.length)}${card('PAID SHOPS', paid.length)}${card('ACTIVE SHOPS', active.length)}${card('AWAITING ACCESS', shops.filter(s => !s.retail_enabled && !s.wholesale_enabled).length)}${card('TOTAL USERS', shops.reduce((sum,s) => sum + n(s.owner_count) + n(s.member_count), 0))}${card('PAYMENTS RECORDED', rateMoney(shops.reduce((sum,s) => sum + n(s.total_paid), 0)))}</div><section class="panel"><h2>Shop signup link</h2><p>Share this link. Shops register their details and receive a 7-day trial. You approve Retail, Wholesale, or both.</p><div class="platform-link"><input readonly aria-label="Shop signup link" value="${esc(platformLink() + '?signup=1')}"><button onclick="platformCopySignup()">Copy link</button><button class="primary" onclick="platformOpen('Create shop')">Create shop invitation</button></div></section><section class="panel"><h2>Recent registrations</h2>${shops.length ? table(['Shop','Owner email','Registered','Plan','Workspace access','Payment'], shops.slice(0,8).map(s => [esc(s.shop_name),esc(s.email),platformDate(s.created_at),esc(s.plan),platformModules(s),s.payment_count > 0 ? 'Paid · ' + rateMoney(s.total_paid) : 'No payment recorded'])) : '<div class="empty">No shops registered yet.</div>'}</section><p class="hint">Paid counts use payments you record after receiving money. Renewing a trial or changing seats does not mark a shop as paid.</p>`;
}
window.platformCopySignup = async function() { try { await navigator.clipboard.writeText(platformLink() + '?signup=1'); say('Shop signup link copied.'); } catch { say('Copy the signup link shown on this page.'); } };
function platformShops() {
  return platformTop('Shops & access', 'Approve workspaces, manage seats, renew plans and record payments.') + (goldleafAdminShops.map(s => `<section class="panel platform-shop"><div class="goldleaf-admin-head"><div><h2>${esc(s.shop_name)}</h2><div>${esc(s.email)} · ${esc(s.phone)}</div><div class="muted">GST ${esc(s.gst_number)} · ${esc(s.address)}</div></div><span class="pill">${esc(s.plan)} · ${esc(s.subscription_status)}</span></div><p>Registered ${platformDate(s.created_at)} · Expires ${platformDate(s.expires_at)} · ${platformModules(s)} · ${s.payment_count > 0 ? 'Paid ' + rateMoney(s.total_paid) : 'No payment recorded'}</p><form onsubmit="platformSaveAccess(event)"><input type="hidden" name="shop_id" value="${s.id}"><div class="grid"><div class="field"><label>Allowed workspaces</label>${platformAccessFields(s)}</div><div class="field"><label>Account status<select name="status">${['trial','active','expired','suspended'].map(v=>`<option ${v===s.subscription_status?'selected':''}>${v}</option>`).join('')}</select></label></div>${platformInput('User seats','user_seats','number',s.user_seats,'min="0" step="1" required')}${platformInput('Owner seats','owner_seats','number',s.owner_seats,'min="1" step="1" required')}</div><div class="right"><button class="primary">Save access & seats</button></div></form><div class="platform-shop-actions"><form onsubmit="platformRenew(event)"><input type="hidden" name="shop_id" value="${s.id}"><label>Renew subscription<select name="plan">${platformPlanOptions(s.plan)}</select></label><button>Apply renewal</button></form><form onsubmit="platformRecordPayment(event)"><input type="hidden" name="shop_id" value="${s.id}"><label>Received payment · ₹<input name="amount" type="number" min=".01" step=".01" required></label><label>Receipt / reference<input name="reference" maxlength="160" required></label><button>Record received payment</button></form></div></section>`).join('') || '<section class="panel empty">No shop registrations yet. Share the signup link from your Dashboard.</section>');
}
async function platformMutation(name, args, message) {
  const result = await client.rpc(name, args); if (result.error) { say(result.error.message); return false; }
  await platformRefresh(); say(message); return true;
}
window.platformSaveAccess = async function(event) {
  event.preventDefault(); const f = new FormData(event.target);
  if (!confirm('Save this shop’s workspace permissions, status and seat limits?')) return;
  await platformMutation('goldleaf_admin_save_access',{p_shop_id:f.get('shop_id'),p_retail:f.has('retail'),p_wholesale:f.has('wholesale'),p_status:f.get('status'),p_users:n(f.get('user_seats')),p_owners:n(f.get('owner_seats'))},'Shop access saved.');
};
window.platformRenew = async function(event) { event.preventDefault(); const f = new FormData(event.target); if (!confirm('Apply the selected subscription renewal?')) return; await platformMutation('goldleaf_admin_renew',{p_shop_id:f.get('shop_id'),p_plan:f.get('plan')},'Subscription renewed.'); };
window.platformRecordPayment = async function(event) { event.preventDefault(); const f=new FormData(event.target); if (!confirm('Record ₹'+f.get('amount')+' as already received? This does not collect money or renew the plan.')) return; await platformMutation('goldleaf_admin_record_payment',{p_shop_id:f.get('shop_id'),p_amount:n(f.get('amount')),p_reference:String(f.get('reference')).trim()},'Payment receipt saved.'); };
function platformCreateShop() {
  return platformTop('Create shop', 'Prepare the shop details and share a secure signup invitation. The owner chooses their password.') + `<section class="panel"><form onsubmit="platformCreateInvite(event)"><div class="grid">${platformInput('Shop name *','shop_name','text','','required')}${platformInput('Owner email *','email','email','','required')}${platformInput('GST number *','gst','text','','required maxlength="15" pattern="[A-Za-z0-9]{15}"')}${platformInput('Phone *','phone','tel','','required minlength="10"')}<div class="field wide"><label>Shop address *<textarea name="address" required></textarea></label></div><div class="field"><label>Allowed workspaces</label>${platformAccessFields()}</div><div class="field"><label>Starting plan<select name="plan">${platformPlanOptions()}</select></label></div></div><div class="right"><button class="primary">Create invitation link</button></div></form><div id="platformInviteOutput" hidden></div></section><section class="panel"><h2>Pending invitations</h2>${platformInvites.length ? table(['Shop','Owner email','Access','Plan','Link expires'],platformInvites.map(i=>[esc(i.shop_name),esc(i.email),platformModules(i),esc(i.plan),platformDate(i.expires_at)])) : '<div class="empty">No pending shop invitations.</div>'}</section>`;
}
window.platformCreateInvite = async function(event) {
  event.preventDefault(); const f=new FormData(event.target); const {data,error}=await client.rpc('goldleaf_admin_prepare_shop',{p_details:{shop_name:f.get('shop_name'),email:f.get('email'),gst_number:f.get('gst'),address:f.get('address'),phone:f.get('phone'),plan:f.get('plan'),retail_enabled:f.has('retail'),wholesale_enabled:f.has('wholesale')}});
  if(error)return say(error.message); const output=document.getElementById('platformInviteOutput'); output.hidden=false; output.innerHTML='<p>Share this invitation privately with the shop owner. It expires in 7 days.</p><input readonly aria-label="New shop invitation" value="'+esc(platformLink()+'?shop_invite='+encodeURIComponent(data))+'">'; say('Shop invitation created.');
};
function platformPlansView() {
  return platformTop('Subscription plans','These plan details also appear on each shop’s account dashboard.') + platformPlans.map(p=>`<section class="panel"><form onsubmit="platformSavePlan(event)"><input type="hidden" name="code" value="${esc(p.code)}"><h2>${esc(p.name)}</h2><div class="grid">${platformInput('Plan name','name','text',p.name,'required')}${platformInput('Price · ₹ (blank = contact admin)','price','number',p.price??'','min="0" step=".01"')}<div class="field wide"><label>Description<textarea name="description" maxlength="500">${esc(p.description)}</textarea></label></div></div><div class="right"><button class="primary">Save plan</button></div></form></section>`).join('');
}
window.platformSavePlan=async function(event){event.preventDefault();const f=new FormData(event.target);await platformMutation('goldleaf_admin_save_plan',{p_code:f.get('code'),p_name:f.get('name'),p_price:f.get('price')===''?null:n(f.get('price')),p_description:f.get('description')},'Plan details saved.');};
function platformLoginView() {
  const signup=new URLSearchParams(location.search).has('signup')||!!window.goldleafShopInvite;
  const adminEntry=new URLSearchParams(location.search).has('admin');
  return platformTop(signup?'Register your shop':adminEntry?'Super Admin sign in':'Goldleaf sign in', signup?'Create your account. Your workspace access is approved by Goldleaf Super Admin.':'Sign in with your Goldleaf administrator account.') + `<section class="panel platform-login"><form onsubmit="platformLogin(event)">${platformInput('Email address','email','email',signup||!adminEntry?'':'gengadharan28@gmail.com','id="email" autocomplete="username" required')}${platformInput('Password','password','password','','id="password" autocomplete="current-password" required minlength="8"')}${signup&&!window.goldleafShopInvite?'<div class="grid">'+platformInput('Shop name *','shop_name','text','','id="shopName" required')+platformInput('GST number *','gst','text','','id="shopGst" required pattern="[A-Za-z0-9]{15}" maxlength="15"')+platformInput('Phone *','phone','tel','','id="shopPhone" required minlength="10"')+'<div class="field"><label>Address *<textarea id="shopAddress" required></textarea></label></div></div>':''}<input id="url" hidden value="${esc(db.cloud.url)}"><input id="key" hidden value="${esc(db.cloud.key)}"><button class="primary">${signup?'Create shop account':'Sign in'}</button><p id="cloudMsg" role="status">${esc(platformError)}</p></form>${signup?'<a href="?admin=1">Already registered? Sign in</a>':'<p>Use your existing Goldleaf password. Your Supabase dashboard login is a separate account.</p><a href="?signup=1">Register a shop</a>'}</section>`;
}
window.platformLogin=async function(event){event.preventDefault();await window.auth(new URLSearchParams(location.search).has('signup')||window.goldleafShopInvite?'signup':'login');};
window.settingsView=function(){return platformBaseSettings().replace(/<section class="panel goldleaf-admin">[\s\S]*?(?=<section class="panel"><h2>Products<\/h2>)/,'');};
window.header=function(sub,buttons=''){let html=platformBaseHeader(sub,buttons);if(session&&goldleafContext){if(!goldleafContext.retail_enabled&&!goldleafContext.is_super_admin)html=html.replace(/<button[^>]*onclick="setWorkspaceMode\('retail'\)"[^>]*>Retail<\/button>/,'');if(!goldleafContext.wholesale_enabled&&!goldleafContext.is_super_admin)html=html.replace(/<button[^>]*onclick="setWorkspaceMode\('wholesale'\)"[^>]*>Wholesale<\/button>/,'');}return html;};
window.setWorkspaceMode=function(mode){if(session&&goldleafContext&&!goldleafContext.is_super_admin&&!goldleafContext[mode+'_enabled'])return say('This workspace has not been enabled by Super Admin.');return platformBaseSetMode(mode);};
window.go=function(target){if(target==='Super Admin')return platformOpen();if(session&&goldleafContext&&!goldleafContext.is_super_admin){if(/^Customer/.test(target)&&!goldleafContext.retail_enabled||/^Party/.test(target)&&!goldleafContext.wholesale_enabled)return say('Ask Super Admin to enable this workspace.');}return platformBaseGo(target);};
const platformOriginalDash=window.dash;
window.dash=function(){let html=platformOriginalDash();if(session&&goldleafContext)html='<section class="panel platform-subscription"><b>'+esc(goldleafContext.shop_name)+'</b><span class="pill">'+esc(goldleafContext.plan)+' · '+esc(goldleafContext.subscription_status)+'</span><p>Plan expires '+platformDate(goldleafContext.expires_at)+' · Access: '+platformModules(goldleafContext)+'</p><p>'+esc(goldleafContext.plan_description||'')+' '+(goldleafContext.plan_price!=null?rateMoney(goldleafContext.plan_price):'Contact Super Admin for subscription pricing.')+'</p></section>'+html;return html;};
window.render=function(){
  const adminLink=new URLSearchParams(location.search).has('admin'),signupLink=new URLSearchParams(location.search).has('signup')||!!window.goldleafShopInvite;
  if(!session){document.getElementById('nav').innerHTML='<button class="active">'+(signupLink?'Shop registration':adminLink?'Super Admin':'Sign in')+'</button>';document.getElementById('app').innerHTML=platformLoginView();return;}
  if(session&&!goldleafContext){document.getElementById('nav').innerHTML='';document.getElementById('app').innerHTML=platformTop('Loading your account','Checking your shop and access permissions…')+'<section class="panel"><p role="status">'+esc(platformError||'Connecting to Goldleaf cloud…')+'</p><button onclick="platformRefresh()">Try again</button><button onclick="platformSignOut()">Sign out</button></section>';return;}
  if(session&&goldleafContext){
    if(platformLoadedUser!==session.user.id){platformLoadedUser=session.user.id;if(goldleafContext.is_super_admin)platformPage='Dashboard';else{platformPage='';if(goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled)workspaceMode='retail';else if(goldleafContext.wholesale_enabled)workspaceMode='wholesale';}if(!goldleafContext.is_super_admin)history.replaceState(null,'',platformLink());}
    if(goldleafContext.is_super_admin&&platformPage){platformNav(platformPage);let html=platformPage==='Shops & access'?platformShops():platformPage==='Create shop'?platformCreateShop():platformPage==='Subscription plans'?platformPlansView():platformPage==='Shared rates'?platformTop('Shared rates','Save rates here to update every shop’s Rate Book.')+rateBookView().replace(/^[\s\S]*?<\/header>/,''):platformDashboard();document.getElementById('app').innerHTML=html+(platformError?'<section class="panel" role="alert">'+esc(platformError)+'</section>':'')+'<footer class="app-version">Goldleaf v2.4.1</footer>';return;}
    if(!goldleafContext.is_super_admin&&(!goldleafContext.has_access||!goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled)){document.getElementById('nav').innerHTML='<button class="active">My subscription</button><button onclick="platformRefresh()">Refresh access</button><button onclick="platformSignOut()">Sign out</button>';document.getElementById('app').innerHTML=platformTop(goldleafContext.has_access?'Waiting for workspace approval':'Subscription needs renewal',goldleafContext.shop_name)+`<section class="panel"><h2>${esc(goldleafContext.plan)} plan</h2><p>Expires ${platformDate(goldleafContext.expires_at)}</p><p>${esc(goldleafContext.plan_description||'')}</p><p>${goldleafContext.has_access?'Your shop is registered. Super Admin will enable Retail, Wholesale, or both.':'Your records remain saved. Contact Super Admin to renew your plan.'}</p><a href="mailto:gengadharan28@gmail.com">Contact Super Admin</a></section>`;return;}
    if(!goldleafContext.is_super_admin&&!goldleafContext[workspaceMode+'_enabled'])workspaceMode=goldleafContext.retail_enabled?'retail':'wholesale';
  }
  platformBaseRender();
  if(goldleafContext?.is_super_admin)document.getElementById('nav').insertAdjacentHTML('afterbegin','<button onclick="platformOpen()">◈ Super Admin</button>');
};
window.goldleafShopInvite=new URLSearchParams(location.search).get('shop_invite')||'';
// Keep local records bound to the shop that created them. A different login
// starts from its own cloud ledger rather than importing this browser's records.
function platformStorageKey(){return goldleafContext?.shop_id?'goldleaf-shop-'+goldleafContext.shop_id:'';}
let platformLedgerShop='';
const platformPreviousSave=window.save;
const platformPreviousAuthForm=window.authForm;
window.authForm=function(){if(session){goldleafContext=null;platformLoadedUser='';platformLedgerShop='';}return platformPreviousAuthForm();};
window.save=function(){if(db.recordsResetToken)for(const key of ['parties','customers','sales','payments'])for(const row of db[key]||[])row.recordsResetToken=db.recordsResetToken;const result=platformPreviousSave();if(session&&platformStorageKey())localStorage.setItem(platformStorageKey(),JSON.stringify(db));return result;};
function platformStoreLedger(){localStorage.setItem(dbkey,JSON.stringify(db));if(platformStorageKey())localStorage.setItem(platformStorageKey(),JSON.stringify(db));}
function platformAdoptCloudReset(payload){
  if(!payload?.recordsResetToken||payload.recordsResetToken===db.recordsResetToken)return false;
  db=Object.assign(init(),payload);ensureExtendedData();edit=null;
  localStorage.removeItem('goldleaf-device-backup-before-shop-login');
  localStorage.removeItem(V2_CLOUD_PENDING_KEY);platformStoreLedger();return true;
}
window.pullCloud=async function(){
  if(!session||!client||v2CloudBusy)return;
  v2CloudBusy=true;
  try{
    const context=await client.rpc('goldleaf_my_context');if(context.error)throw context.error;
    const previous=goldleafContext;goldleafContext=context.data;
    if(!goldleafContext?.shop_id&&!goldleafContext?.is_super_admin)throw new Error('This login does not have a shop. Contact Super Admin.');
    if(goldleafContext.is_super_admin){const responses=await Promise.all([client.rpc('goldleaf_admin_list_shops'),client.rpc('goldleaf_admin_list_onboarding'),client.rpc('goldleaf_list_plans')]);for(const response of responses)if(response.error)throw response.error;[goldleafAdminShops,platformInvites,platformPlans]=responses.map(r=>r.data||[]);}
    const shared=await client.rpc('goldleaf_get_shared_rates');if(shared.error)throw shared.error;
    if(!goldleafContext.has_access||!goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled){db.rates=shared.data||{};platformError='';render();return;}
    const response=await client.rpc('goldleaf_read_ledger');if(response.error)throw response.error;
    const remote=response.data||{},shop=goldleafContext.shop_id;
    const resetApplied=platformAdoptCloudReset(remote.payload);
    if(platformLedgerShop!==shop){
      if(!remote.payload?.recordsResetToken)localStorage.setItem('goldleaf-device-backup-before-shop-login',JSON.stringify(db));
      const local=JSON.parse(localStorage.getItem(platformStorageKey())||'null');
      db=local&&(!remote.payload?.recordsResetToken||local.recordsResetToken===remote.payload.recordsResetToken)?v2MergeCloudLedgers(remote.payload,local,true):Object.assign(init(),remote.payload||{});
      platformLedgerShop=shop;localStorage.removeItem(V2_CLOUD_PENDING_KEY);
    }else if(previous?.retail_enabled!==goldleafContext.retail_enabled||previous?.wholesale_enabled!==goldleafContext.wholesale_enabled){db=Object.assign(init(),remote.payload||{});localStorage.removeItem(V2_CLOUD_PENDING_KEY);}
    else db=localStorage.getItem(V2_CLOUD_PENDING_KEY)==='1'?v2MergeCloudLedgers(remote.payload,db,true):Object.assign(init(),remote.payload||{});
    ensureExtendedData();db.rates=shared.data||{};v2LastCloudUpdatedAt=remote.updated_at||'';platformStoreLedger();platformError='';
    setCloudStatus('Cloud · '+goldleafContext.shop_name);if(resetApplied||!v2HasFocusedEdit()||!previous||previous.retail_enabled!==goldleafContext.retail_enabled||previous.wholesale_enabled!==goldleafContext.wholesale_enabled)render();
  }catch(error){platformError=error.message;setCloudStatus('Cloud connection needs attention');if(!v2HasFocusedEdit())render();}
  finally{v2CloudBusy=false;}
};
window.pushCloud=async function(){
  if(!session||!client||!goldleafContext?.shop_id||!goldleafContext.has_access)return;
  if(v2CloudBusy){v2CloudQueuedPush=true;return;}v2CloudBusy=true;localStorage.setItem(V2_CLOUD_PENDING_KEY,'1');
  try{
    do{v2CloudQueuedPush=false;let written=false;
      for(let attempt=0;attempt<4&&!written;attempt++){
        const remote=await client.rpc('goldleaf_read_ledger');if(remote.error)throw remote.error;
        if(platformAdoptCloudReset(remote.data?.payload)){say('Old shop entries were cleared. Please enter your new record again.');render();return;}
        db=v2MergeCloudLedgers(remote.data?.payload,db,true);
        const write=await client.rpc('goldleaf_save_ledger',{p_payload:db,p_expected:remote.data?.updated_at||null});if(write.error)throw write.error;
        if(write.data){written=true;v2LastCloudUpdatedAt=write.data;}
      }
      if(!written)throw new Error('Records changed on another device. Your entry is saved here and will retry.');
      platformStoreLedger();localStorage.removeItem(V2_CLOUD_PENDING_KEY);setCloudStatus('Cloud · '+goldleafContext.shop_name);
    }while(v2CloudQueuedPush);
  }catch(error){platformError=error.message;setCloudStatus('Entry saved here · waiting to sync');}
  finally{v2CloudBusy=false;}
};
window.v2CheckCloudForChanges=async function(){if(!session||!client||v2CloudBusy||v2CloudCheckBusy||document.visibilityState!=='visible')return;v2CloudCheckBusy=true;try{await pullCloud();if(localStorage.getItem(V2_CLOUD_PENDING_KEY)==='1')await pushCloud();}finally{v2CloudCheckBusy=false;}};
// Prevent rate reminders from covering the platform sign-in and control screens.
const platformCheckRateReminder=window.checkRateReminder;
window.checkRateReminder=function(){if(platformPage||new URLSearchParams(location.search).has('signup'))return;return platformCheckRateReminder();};
document.querySelector('[aria-label="Daily rate reminder"]')?.remove();
// Render the administrative route before any jewellery workspace.
const platformStyle=document.createElement('style');platformStyle.textContent=`.platform-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}.platform-metrics .card{min-width:0!important}.platform-link{display:flex;gap:10px;flex-wrap:wrap}.platform-link input{flex:1;min-width:200px}.platform-login{max-width:640px;margin:35px auto!important}.platform-login .field{margin-bottom:16px}.platform-login input,.platform-login textarea{width:100%;margin-top:7px}.platform-checks{display:flex;gap:20px;padding:12px 0}.platform-checks label{display:flex;align-items:center;gap:8px}.platform-checks input{width:20px;height:20px}.platform-shop-actions{display:flex;flex-wrap:wrap;gap:24px;border-top:1px solid #d6d2c8;margin-top:16px;padding-top:16px}.platform-shop-actions form{display:flex;align-items:end;flex-wrap:wrap;gap:10px}.platform-shop-actions label{display:grid;gap:6px}.platform-subscription{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.platform-subscription p{margin:0}.platform-shop .grid input,.platform-shop .grid select{width:100%;margin-top:6px}@media(max-width:760px){.platform-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.platform-metrics .card b{font-size:22px!important}.platform-shop-actions form,.platform-shop-actions label{width:100%}.platform-shop-actions button{width:100%}.platform-login{margin:15px 0!important}.platform-link button{width:100%}.platform-checks{gap:16px}.goldleaf-admin-head{flex-wrap:wrap}}`;document.head.append(platformStyle);
render();

window.goldleafV2Ready=true;
window.dispatchEvent(new Event('goldleaf-v2-ready'));
if(session)window.pullCloud();
