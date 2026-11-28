// Separate platform controls from each shop's jewellery workspace.
let platformPage = (new URLSearchParams(location.search).get('admin') === '1' || /super-admin\.html$/i.test(location.pathname)) ? 'Dashboard' : '';
let platformError = '', platformLoadedUser = '', platformInvites = [], platformPlans = [];
const platformBaseRender = window.render, platformBaseGo = window.go;
const platformBaseSettings = window.settingsView, platformBaseHeader = window.header;
const platformBaseSetMode = window.setWorkspaceMode;
const platformPreviousHistory=window.updateHistoryView;
window.updateHistoryView=function(){return platformPreviousHistory().replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.4.1 · 6 Nov 2026 · Current</h3><ul><li>Added reset protection so erased shop entries cannot return from an older device.</li></ul></article>').replace('<section class="panel"><h2>Update history</h2>','<section class="panel"><h2>Update history</h2><article class="release-note"><h3>v2.4.0 · 6 Nov 2026</h3><ul><li>Separate Super Admin dashboard with signup, paid-shop and subscription controls.</li><li>Approve Retail, Wholesale or both; create shop invitations; edit subscription plans and shared rates.</li><li>Workspace permissions are checked in the cloud. Local records stay with their shop.</li></ul></article>').replace('v2.3.0 · 6 Nov 2026 · Current','v2.3.0 · 6 Nov 2026').replace('v2.0.9 · 6 Nov 2026 · Current','v2.0.9 · 6 Nov 2026').replace('Goldleaf v2.3.0','Goldleaf v2.4.0');};
const platformDate = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const platformDateTime = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN') + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
function platformShopExpiryState(s) {
  const ms = s?.expires_at ? Date.parse(s.expires_at) : 0;
  const isExpired = !ms || ms <= Date.now();
  const statusActive = ['active', 'trial'].includes(s?.subscription_status);
  const hasWorkspace = !!(s?.retail_enabled || s?.wholesale_enabled);
  return { ms, isExpired, statusActive, hasWorkspace, canEnter: statusActive && !isExpired && hasWorkspace };
}
const platformShopLoanEnabled = shop => !!(shop && (platformLoanEntitlements.has(shop.id) ? platformLoanEntitlements.get(shop.id) : shop.jewel_loan_enabled));
const platformModules = shop => [shop.retail_enabled && 'Retail', shop.wholesale_enabled && 'Wholesale', platformShopLoanEnabled(shop) && 'Jewel Loan'].filter(Boolean).join(' + ') || 'Awaiting approval';
const platformIsDemo = () => session?.user?.id === 'demo-shop-1' && session.access_token === 'demo';
const platformLink = () => location.origin + location.pathname;
const platformInput = (label, name, type = 'text', value = '', extra = '') => `<div class="field"><label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label></div>`;
function platformNav(active) {
  const items = ['Dashboard', 'Shops & access', 'Create shop', 'Users & seats', 'Payments', 'Subscription plans', 'Shared rates', 'Platform reports'];
  const icons = ['⌂','♙','＋','♟','₹','◷','◈','▥'];
  document.getElementById('nav').innerHTML = items.map((label, index) => `<button class="${active === label ? 'active' : ''}" onclick="platformOpen('${label}')"><span class="nav-icon">${icons[index]}</span><span>${label}</span></button>`).join('') + '<button onclick="platformSignOut()">↪ Sign out</button><button class="more-button" onclick="toggleMore()" aria-expanded="false"><span class="nav-icon">•••</span><span>More</span></button><div id="moreMenu" class="more-menu"><button onclick="platformOpen(\'Shared rates\')">Shared rates</button><button onclick="platformOpen(\'Platform reports\')">Platform reports</button><button onclick="platformSignOut()">Sign out</button></div>';
}
window.platformOpen = function(target = 'Dashboard') { platformPage = target; window.history.replaceState(null, '', platformLink() + '?admin=1'); render(); };
window.platformWorkspace = function() { platformPage = ''; window.history.replaceState(null, '', platformLink()); page = 'Dashboard'; render(); };
window.platformSignOut = async function() {
  if (platformIsDemo()) {
    localStorage.removeItem('goldleaf_demo_active');
    session = null;
    goldleafContext = null;
    platformLoadedUser = '';
    platformPage = '';
    db = init();
    ensureExtendedData();
    window.history.replaceState(null, '', platformLink());
    render();
    return;
  }
  try {
    const result = await client.auth.signOut();
    if (result.error) throw result.error;
    session = null; goldleafContext = null; platformLoadedUser = ''; platformLedgerShop = ''; platformPage = 'Dashboard'; platformError = '';
    localStorage.removeItem(dbkey); localStorage.removeItem(V2_CLOUD_PENDING_KEY); localStorage.removeItem('goldleaf-ctx-v2'); db = init(); ensureExtendedData(); render();
  } catch (error) { say('Could not sign out. '+error.message); }
};
function platformQuickSignOut(){return session?'<button type="button" class="platform-sign-out" onclick="platformSignOut()" aria-label="Sign out">↪ Sign out</button>':'';}
window.platformRefresh = async function(announce = false) {
  if (!session || !client) return;
  if (announce) { try { window.dispatchEvent(new CustomEvent('gl:manual-sync-start')); } catch {} }
  try {
  let waited = 0;
  while (v2CloudBusy && waited < 25) {
    await new Promise(r => setTimeout(r, 100));
    waited++;
  }
  await window.pullCloud();
  render();
  if (announce && !goldleafContext?.is_super_admin) {
    if (goldleafContext?.has_access && (goldleafContext.retail_enabled || goldleafContext.wholesale_enabled)) say('Workspace access active.');
    else if (goldleafContext && !goldleafContext.has_access) say('Subscription expired (' + platformDateTime(goldleafContext.expires_at) + '). Ask Super Admin to extend validity.');
    else say('Access status refreshed.');
  }
  } finally {
    if (announce) { try { window.dispatchEvent(new CustomEvent('gl:manual-sync-end')); } catch {} }
  }
};

function platformTop(title, subtitle) {
  document.body.classList.remove('compact-customer-sale');document.documentElement.classList.remove('compact-customer-sale');
  return (() => { const signup = new URLSearchParams(location.search).has('signup') || !!window.goldleafShopInvite; const adminEntry = new URLSearchParams(location.search).has('admin'); const eyebrow = signup ? 'GOLDLEAF · SHOP REGISTRATION' : adminEntry ? 'GOLDLEAF · SUPER ADMIN' : 'GOLDLEAF · JEWELLERY ERP'; return `<header class="top"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="muted">${subtitle}</div></div><div class="header-actions">${platformQuickSignOut()}<button onclick="toggleTheme()">${appTheme === 'dark' ? '☀ Light' : '☾ Dark'}</button><button onclick="platformRefresh(true)">Refresh</button></div></header>`; })();
}
function platformPlanOptions(current = 'trial') {
  return ['trial','demo','monthly','yearly'].map(plan => `<option value="${plan}" ${plan === current ? 'selected' : ''}>${plan === 'trial' ? 'Free trial · 7 days' : plan === 'demo' ? 'Demo · 7 days' : plan === 'monthly' ? 'Monthly · 1 month' : 'Yearly · 1 year'}</option>`).join('');
}
function platformExtendSelectHtml(shop, isExpired) {
  const defaultPlan = isExpired ? (['trial','demo','monthly','yearly'].includes(shop?.plan) ? shop.plan : 'trial') : '';
  return `<div class="field"><label>Validity / extend plan<select name="extend_plan">`
    + `<option value="" ${!defaultPlan ? 'selected' : ''}>${isExpired ? 'Keep expired (stays blocked)' : 'Keep current expiry (' + platformDateTime(shop?.expires_at) + ')'}</option>`
    + `<option value="trial" ${defaultPlan === 'trial' ? 'selected' : ''}>Extend +7 days (Free trial)</option>`
    + `<option value="demo" ${defaultPlan === 'demo' ? 'selected' : ''}>Extend +7 days (Demo)</option>`
    + `<option value="monthly" ${defaultPlan === 'monthly' ? 'selected' : ''}>Extend +1 month (Monthly)</option>`
    + `<option value="yearly" ${defaultPlan === 'yearly' ? 'selected' : ''}>Extend +1 year (Yearly)</option>`
    + `</select></label></div>`;
}
const platformLoanEntitlements=new Map();
window.platformSaveLoanEntitlement=async function(shopId,enabled){
  const flag=!!enabled;
  const rpcRes=await client.rpc('goldleaf_admin_set_loan_access',{p_shop_id:shopId,p_enabled:flag});
  if(!rpcRes.error)return null;
  const tblRes=await client.from('goldleaf_jewel_loan_access').upsert({shop_id:shopId,enabled:flag},{onConflict:'shop_id'});
  return tblRes.error||null;
};
window.platformSetLoanAccess=async function(input){
  const shopId=input.dataset.shopId,enabled=input.checked;
  if(!client||!goldleafContext?.is_super_admin||!shopId){input.checked=!enabled;return;}
  input.disabled=true;
  try{
    const error=await window.platformSaveLoanEntitlement(shopId,enabled);
    if(error)throw error;
    platformLoanEntitlements.set(shopId,enabled);
    const shop=goldleafAdminShops.find(s=>s.id===shopId);
    if(shop)shop.jewel_loan_enabled=enabled;
    say('Jewel Loan & Auction access '+(enabled?'enabled':'disabled')+'.');
  }catch(error){
    input.checked=!enabled;
    say(error.message||'Could not save loan access.');
  }finally{
    input.disabled=false;
  }
};
function platformAccessFields(shop = {}) {
  const toggle=(name,label,checked,help)=>`<label class="platform-access-toggle"><input type="checkbox" name="${name}" ${checked?'checked':''}><span class="platform-toggle-track" aria-hidden="true"><span></span></span><span><b>${label}</b><small>${help}</small></span></label>`;
  const loanChecked=platformShopLoanEnabled(shop);
  return `<div class="platform-checks">${toggle('retail','Retail',!!shop.retail_enabled,'Customer workspace')}${toggle('wholesale','Wholesale',!!shop.wholesale_enabled,'Party workspace')}${toggle('shared_rates','Live shared rate',shop.shared_rates_enabled!==false,'Auto-update from Super Admin')}${shop.id?`<label class="platform-access-toggle"><input type="checkbox" name="jewel_loan" data-shop-id="${esc(shop.id)}" ${loanChecked?'checked':''} onchange="platformSetLoanAccess(this)"><span class="platform-toggle-track" aria-hidden="true"><span></span></span><span><b>Jewel Loan &amp; Auction</b><small>Allow Jewel Loan &amp; Auction module</small></span></label>`:''}</div>`;
}
function platformDashboard() {
  const shops = goldleafAdminShops, paid = shops.filter(s => s.payment_count > 0), active = shops.filter(s => ['active','trial'].includes(s.subscription_status) && Date.parse(s.expires_at) > Date.now());
  return platformTop('Super Admin', 'Your shop registrations, subscriptions, access and shared rates.') + `<div class="cards platform-metrics">${card('SIGNED-UP SHOPS', shops.length)}${card('PAID SHOPS', paid.length)}${card('ACTIVE SHOPS', active.length)}${card('AWAITING ACCESS', shops.filter(s => !s.retail_enabled && !s.wholesale_enabled).length)}${card('TOTAL USERS', shops.reduce((sum,s) => sum + n(s.owner_count) + n(s.member_count), 0))}${card('PAYMENTS RECORDED', rateMoney(shops.reduce((sum,s) => sum + n(s.total_paid), 0)))}</div><section class="panel"><h2>Shop signup link</h2><p>Share this link. Shops register their details and receive a 7-day trial. You approve Retail, Wholesale, or both.</p><div class="platform-link"><input readonly aria-label="Shop signup link" value="${esc(platformLink() + '?signup=1')}"><button onclick="platformCopySignup()">Copy link</button><button class="primary" onclick="platformOpen('Create shop')">Create shop invitation</button></div></section><section class="panel"><h2>Recent registrations</h2>${shops.length ? table(['Shop','Owner email','Registered','Plan','Workspace access','Payment','Actions'], shops.slice(0,8).map(s => { const st = platformShopExpiryState(s); return [esc(s.shop_name),esc(s.email),platformDate(s.created_at),esc(s.plan) + (st.isExpired ? ' · EXPIRED' : !st.statusActive ? ' · ' + esc(s.subscription_status) : ''),platformModules(s),s.payment_count > 0 ? 'Paid · ' + rateMoney(s.total_paid) : 'No payment recorded',`<div class="platform-row-actions"><button type="button" class="platform-icon-action" title="Edit registration" aria-label="Edit ${esc(s.shop_name)}" onclick="platformEditRegistration('${s.id}')">✎</button><button type="button" class="platform-icon-action danger" title="Delete registration" aria-label="Delete ${esc(s.shop_name)}" onclick="platformDeleteRegistration('${s.id}')">⌫</button></div>`]; })) : '<div class="empty">No shops registered yet.</div>'}</section><p class="hint">Paid counts use payments you record after receiving money. Renewing a trial or changing seats does not mark a shop as paid.</p><div id="platformRegistrationDialog"></div>`;
}
function platformUsersView(){
  const shops=goldleafAdminShops,totalOwners=shops.reduce((s,x)=>s+n(x.owner_count),0),totalMembers=shops.reduce((s,x)=>s+n(x.member_count),0);
  return platformTop('Users & seats','Review shop owners, staff usage and Super Admin-controlled seat limits.')+`<div class="cards platform-metrics">${card('TOTAL OWNERS',totalOwners)}${card('TOTAL STAFF',totalMembers)}${card('OWNER SEATS',shops.reduce((s,x)=>s+n(x.owner_seats),0))}${card('USER SEATS',shops.reduce((s,x)=>s+n(x.user_seats),0))}</div><section class="panel"><h2>Seat usage by shop</h2>${shops.length?table(['Shop','Owner email','Owners used / allowed','Users used / allowed','Access'],shops.map(x=>[esc(x.shop_name),esc(x.email),n(x.owner_count)+' / '+n(x.owner_seats),n(x.member_count)+' / '+n(x.user_seats),platformModules(x)])):'<div class="empty">No registered shops yet.</div>'}</section>`;
}
function platformPaymentsView(){
  const shops=goldleafAdminShops,paid=shops.filter(x=>n(x.payment_count)>0),total=shops.reduce((s,x)=>s+n(x.total_paid),0);
  return platformTop('Payments','Monitor recorded subscription receipts and unpaid shops.')+`<div class="cards platform-metrics">${card('PAYING SHOPS',paid.length)}${card('UNPAID SHOPS',shops.length-paid.length)}${card('PAYMENTS RECORDED',shops.reduce((s,x)=>s+n(x.payment_count),0))}${card('TOTAL RECEIVED',rateMoney(total))}</div><section class="panel"><h2>Payment summary</h2>${shops.length?table(['Shop','Plan','Payment records','Received','Expires','Status'],shops.map(x=>[esc(x.shop_name),esc(x.plan),n(x.payment_count),rateMoney(x.total_paid),platformDate(x.expires_at),esc(x.subscription_status)])):'<div class="empty">No payment information yet.</div>'}</section>`;
}
function platformReportsView(){
  const shops=goldleafAdminShops,retail=shops.filter(x=>x.retail_enabled).length,wholesale=shops.filter(x=>x.wholesale_enabled).length,both=shops.filter(x=>x.retail_enabled&&x.wholesale_enabled).length,expired=shops.filter(x=>platformShopExpiryState(x).isExpired).length;
  return platformTop('Platform reports','A compact overview of registrations, access, subscriptions and adoption.')+`<div class="cards platform-metrics">${card('REGISTERED SHOPS',shops.length)}${card('RETAIL ENABLED',retail)}${card('WHOLESALE ENABLED',wholesale)}${card('BOTH WORKSPACES',both)}${card('EXPIRED',expired)}${card('AWAITING ACCESS',shops.filter(x=>!x.retail_enabled&&!x.wholesale_enabled).length)}</div><section class="panel"><h2>Platform account report</h2>${shops.length?table(['Shop','Registered','Plan','Workspace','Users','Payments','Expiry'],shops.map(x=>[esc(x.shop_name),platformDate(x.created_at),esc(x.plan),platformModules(x),n(x.owner_count)+n(x.member_count),rateMoney(x.total_paid),platformDate(x.expires_at)])):'<div class="empty">No platform records yet.</div>'}</section>`;
}
window.platformEditRegistration=function(shopId){const s=goldleafAdminShops.find(x=>x.id===shopId);if(!s)return;const host=document.getElementById('platformRegistrationDialog');if(!host)return;host.innerHTML=`<div class="platform-dialog-backdrop" onclick="if(event.target===this)platformCloseRegistrationDialog()"><section class="platform-dialog" role="dialog" aria-modal="true" aria-labelledby="platformEditTitle"><div class="goldleaf-admin-head"><div><h2 id="platformEditTitle">Edit registration</h2><div class="muted">${esc(s.email)}</div></div><button type="button" aria-label="Close" onclick="platformCloseRegistrationDialog()">×</button></div><form onsubmit="platformSaveRegistration(event)"><input type="hidden" name="shop_id" value="${s.id}"><div class="grid">${platformInput('Shop name *','shop_name','text',s.shop_name,'required maxlength="120"')}${platformInput('GST number *','gst_number','text',s.gst_number,'required maxlength="15" pattern="[A-Za-z0-9]{15}"')}${platformInput('Phone *','phone','tel',s.phone,'required minlength="10" maxlength="20"')}<div class="field wide"><label>Address *<textarea name="address" required maxlength="500">${esc(s.address)}</textarea></label></div></div><div class="right"><button type="button" onclick="platformCloseRegistrationDialog()">Cancel</button><button class="primary">Save changes</button></div></form></section></div>`;};
window.platformCloseRegistrationDialog=function(){const host=document.getElementById('platformRegistrationDialog');if(host)host.innerHTML='';};
window.platformSaveRegistration=async function(event){event.preventDefault();const f=new FormData(event.target);await platformMutation('goldleaf_admin_update_registration',{p_shop_id:f.get('shop_id'),p_shop_name:String(f.get('shop_name')).trim(),p_gst_number:String(f.get('gst_number')).trim(),p_address:String(f.get('address')).trim(),p_phone:String(f.get('phone')).trim()},'Shop registration updated.');platformCloseRegistrationDialog();};
window.platformDeleteRegistration=async function(shopId){const s=goldleafAdminShops.find(x=>x.id===shopId);if(!s)return;if(!confirm(`Delete ${s.shop_name} from active registrations?\n\nIts login access will be suspended immediately. The cloud data is retained for recovery.`))return;await platformMutation('goldleaf_admin_archive_shop',{p_shop_id:shopId},'Shop registration deleted and access suspended.');};
window.platformCopySignup = async function() { try { await navigator.clipboard.writeText(platformLink() + '?signup=1'); say('Shop signup link copied.'); } catch { say('Copy the signup link shown on this page.'); } };
function platformShops() {
  return platformTop('Shops & access', 'Approve workspaces, manage seats, renew plans and record payments.') + (goldleafAdminShops.map(s => {
    const st = platformShopExpiryState(s);
    const pillClass = (st.isExpired || !st.statusActive) ? 'platform-pill-expired' : !st.hasWorkspace ? 'platform-pill-warn' : 'platform-pill-ok';
    const pillLabel = st.isExpired ? `${s.plan} · EXPIRED` : !st.statusActive ? `${s.plan} · ${s.subscription_status}` : !st.hasWorkspace ? `${s.plan} · awaiting workspace` : `${s.plan} · ${s.subscription_status} (active)`;
    const alertHtml = st.isExpired
      ? `<div class="platform-expiry-alert"><b>Access blocked — EXPIRED on ${platformDateTime(s.expires_at)}.</b> Changing Account status alone does not extend an expired date. Pick an extension under <i>Validity / extend plan</i> below and click <b>Save access &amp; seats</b>.</div>`
      : !st.statusActive
        ? `<div class="platform-expiry-alert"><b>Access paused (${esc(s.subscription_status)}).</b> Set Account status to <i>active</i> or <i>trial</i> and click <b>Save access &amp; seats</b> to restore access.</div>`
        : !st.hasWorkspace
          ? `<div class="platform-expiry-alert platform-expiry-warn"><b>Workspace approval needed.</b> Enable Retail, Wholesale, or both below and click <b>Save access &amp; seats</b>.</div>`
          : '';
    return `<section class="panel platform-shop"><div class="goldleaf-admin-head"><div><h2>${esc(s.shop_name)}</h2><div>${esc(s.email)} · ${esc(s.phone)}</div><div class="muted">GST ${esc(s.gst_number)} · ${esc(s.address)}</div></div><span class="pill ${pillClass}">${esc(pillLabel)}</span></div><p>Registered ${platformDate(s.created_at)} · Expires <b>${platformDateTime(s.expires_at)}</b>${st.isExpired ? ' (EXPIRED)' : ''} · ${platformModules(s)} · ${s.payment_count > 0 ? 'Paid ' + rateMoney(s.total_paid) : 'No payment recorded'}</p>${alertHtml}<form onsubmit="platformSaveAccess(event)"><input type="hidden" name="shop_id" value="${s.id}"><div class="grid"><div class="field wide" style="grid-column:1/-1"><label>Allowed workspaces &amp; modules</label>${platformAccessFields(s)}</div><div class="field"><label>Account status<select name="status">${['trial','active','expired','suspended'].map(v=>`<option ${v===s.subscription_status?'selected':''}>${v}</option>`).join('')}</select></label></div>${platformExtendSelectHtml(s, st.isExpired)}${platformInput('User seats','user_seats','number',s.user_seats,'min="0" step="1" required')}${platformInput('Owner seats','owner_seats','number',s.owner_seats,'min="1" step="1" required')}</div><div class="right"><button class="primary">Save access &amp; seats</button></div></form><div class="platform-shop-actions"><form onsubmit="platformRenew(event)"><input type="hidden" name="shop_id" value="${s.id}"><label>Quick renew subscription<select name="plan">${platformPlanOptions(s.plan)}</select></label><button>Apply renewal</button></form><form onsubmit="platformRecordPayment(event)"><input type="hidden" name="shop_id" value="${s.id}"><label>Received payment · ₹<input name="amount" type="number" min=".01" step=".01" required></label><label>Receipt / reference<input name="reference" maxlength="160" required></label><button>Record received payment</button></form></div></section>`;
  }).join('') || '<section class="panel empty">No shop registrations yet. Share the signup link from your Dashboard.</section>');
}
async function platformMutation(name, args, message) {
  const result = await client.rpc(name, args); if (result.error) { say(result.error.message); return false; }
  await platformRefresh(); say(message); return true;
}
window.platformSaveAccess = async function(event) {
  event.preventDefault(); const f = new FormData(event.target);
  const shopId = f.get('shop_id'), status = String(f.get('status') || ''), extendPlan = String(f.get('extend_plan') || '');
  const shop = goldleafAdminShops.find(s => s.id === shopId), st = platformShopExpiryState(shop);
  const willExtend = !!extendPlan && ['active', 'trial'].includes(status);
  if (!willExtend && st.isExpired && ['active', 'trial'].includes(status)) {
    if (!confirm('This shop’s expiry date (' + platformDateTime(shop?.expires_at) + ') has already passed. Without choosing an extension plan, the shop will STILL see "Subscription needs renewal". Save without extending?')) return;
  } else {
    if (!confirm(willExtend ? 'Save workspace permissions, set status to "' + status + '", and extend validity (' + extendPlan + ')?' : 'Save this shop’s workspace permissions, status and seat limits?')) return;
  }
  if (willExtend) {
    const renew = await client.rpc('goldleaf_admin_renew', { p_shop_id: shopId, p_plan: extendPlan });
    if (renew.error) { say(renew.error.message); return; }
  }
  if (shopId) {
    const loanEnabled = f.has('jewel_loan');
    const loanErr = await window.platformSaveLoanEntitlement(shopId, loanEnabled);
    if (loanErr) { say(loanErr.message || 'Could not save Jewel Loan access.'); return; }
    platformLoanEntitlements.set(shopId, loanEnabled);
    if (shop) shop.jewel_loan_enabled = loanEnabled;
  }
  await platformMutation('goldleaf_admin_save_access_v2',{p_shop_id:shopId,p_retail:f.has('retail'),p_wholesale:f.has('wholesale'),p_shared_rates:f.has('shared_rates'),p_status:status,p_users:n(f.get('user_seats')),p_owners:n(f.get('owner_seats'))}, willExtend ? 'Shop access saved and validity extended.' : 'Shop access saved.');
};
window.platformRenew = async function(event) {
  event.preventDefault(); const f = new FormData(event.target);
  if (!confirm('Apply the selected subscription renewal?')) return;
  const shop = goldleafAdminShops.find(s => s.id === f.get('shop_id'));
  const note = (!shop?.retail_enabled && !shop?.wholesale_enabled) ? 'Subscription renewed. Remember to enable Retail/Wholesale above and save.' : 'Subscription renewed.';
  await platformMutation('goldleaf_admin_renew',{p_shop_id:f.get('shop_id'),p_plan:f.get('plan')}, note);
};
window.platformRecordPayment = async function(event) { event.preventDefault(); const f=new FormData(event.target); if (!confirm('Record ₹'+f.get('amount')+' as already received? This does not collect money or renew the plan.')) return; await platformMutation('goldleaf_admin_record_payment',{p_shop_id:f.get('shop_id'),p_amount:n(f.get('amount')),p_reference:String(f.get('reference')).trim()},'Payment receipt saved.'); };
function platformCreateShop() {
  return platformTop('Create shop', 'Prepare the shop details and share a secure signup invitation. The owner chooses their password.') + `<section class="panel"><form onsubmit="platformCreateInvite(event)"><div class="grid">${platformInput('Shop name *','shop_name','text','','required')}${platformInput('Owner email *','email','email','','required')}${platformInput('GST number *','gst','text','','required maxlength="15" pattern="[A-Za-z0-9]{15}"')}${platformInput('Phone *','phone','tel','','required minlength="10"')}<div class="field wide"><label>Shop address *<textarea name="address" required></textarea></label></div><div class="field wide" style="grid-column:1/-1"><label>Allowed workspaces</label>${platformAccessFields()}</div><div class="field"><label>Starting plan<select name="plan">${platformPlanOptions()}</select></label></div></div><div class="right"><button class="primary">Create invitation link</button></div></form><div id="platformInviteOutput" hidden></div></section><section class="panel"><h2>Pending invitations</h2>${platformInvites.length ? table(['Shop','Owner email','Access','Plan','Link expires'],platformInvites.map(i=>[esc(i.shop_name),esc(i.email),platformModules(i),esc(i.plan),platformDate(i.expires_at)])) : '<div class="empty">No pending shop invitations.</div>'}</section>`;
}
window.platformCreateInvite = async function(event) {
  event.preventDefault(); const f=new FormData(event.target); const {data,error}=await client.rpc('goldleaf_admin_prepare_shop',{p_details:{shop_name:f.get('shop_name'),email:f.get('email'),gst_number:f.get('gst'),address:f.get('address'),phone:f.get('phone'),plan:f.get('plan'),retail_enabled:f.has('retail'),wholesale_enabled:f.has('wholesale')}});
  if(error)return say(error.message); const output=document.getElementById('platformInviteOutput'); output.hidden=false; output.innerHTML='<p>Share this invitation privately with the shop owner. It expires in 7 days.</p><input readonly aria-label="New shop invitation" value="'+esc(platformLink()+'?shop_invite='+encodeURIComponent(data))+'">'; say('Shop invitation created.');
};
function platformPlansView() {
  return platformTop('Subscription plans','These plan details also appear on each shop’s account dashboard.') + platformPlans.map(p=>`<section class="panel"><form onsubmit="platformSavePlan(event)"><input type="hidden" name="code" value="${esc(p.code)}"><h2>${esc(p.name)}</h2><div class="grid">${platformInput('Plan name','name','text',p.name,'required')}${platformInput('Price · ₹ (blank = contact admin)','price','number',p.price??'','min="0" step=".01"')}<div class="field wide"><label>Description<textarea name="description" maxlength="500">${esc(p.description)}</textarea></label></div></div><div class="right"><button class="primary">Save plan</button></div></form></section>`).join('');
}
window.platformSavePlan=async function(event){event.preventDefault();const f=new FormData(event.target);await platformMutation('goldleaf_admin_save_plan',{p_code:f.get('code'),p_name:f.get('name'),p_price:f.get('price')===''?null:n(f.get('price')),p_description:f.get('description')},'Plan details saved.');};
window.glLoginRole = window.glLoginRole || 'admin';
window.glSwitchLoginRole = function(role) {
  window.glLoginRole = role === 'staff' ? 'staff' : 'admin';
  document.querySelectorAll('.c2-tab[data-role]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === window.glLoginRole);
  });
  const lbl = document.getElementById('glLoginEmailLabel');
  const inp = document.getElementById('email');
  const btn = document.getElementById('glLoginSubmitBtn');
  if (lbl) lbl.textContent = window.glLoginRole === 'staff' ? 'Staff Counter Email' : 'Registered Email';
  if (inp) inp.placeholder = window.glLoginRole === 'staff' ? 'staff@showroom.com' : 'contact@showroom.com';
  if (btn) btn.textContent = window.glLoginRole === 'staff' ? 'Enter Staff Counter' : 'Enter Showroom';
};
window.glGetLoginRates = function() {
  let r = (typeof db !== 'undefined' && db?.rates) ? db.rates : {};
  if (!Number(r.gold24)) {
    try {
      const cached = JSON.parse(localStorage.getItem('goldleaf-cached-public-rates') || 'null');
      if (cached && Number(cached.gold24) > 0) r = cached;
    } catch {}
  }
  const g24 = Number(r.gold24) || 7850;
  const g22 = Number(r.gold22) || Math.round(g24 * 0.916);
  const slv = Number(r.silver) || Number(r.silverBoard) || 95;
  const fmtR = v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + '/g';
  return { g24: fmtR(g24), g22: fmtR(g22), slv: fmtR(slv) };
};
window.glRefreshLoginRates = async function() {
  try {
    if (client) {
      const res = await client.rpc('goldleaf_get_shared_rates');
      if (res?.data && Number(res.data.gold24) > 0) {
        db.rates = Object.assign({}, db.rates, res.data);
        localStorage.setItem('goldleaf-cached-public-rates', JSON.stringify(db.rates));
      }
    }
  } catch {}
  const rates = window.glGetLoginRates();
  const el24 = document.getElementById('glLoginRate24');
  const el22 = document.getElementById('glLoginRate22');
  const elSlv = document.getElementById('glLoginRateSilver');
  if (el24) el24.textContent = rates.g24;
  if (el22) el22.textContent = rates.g22;
  if (elSlv) elSlv.textContent = rates.slv;
  say('Live market rates refreshed.');
};
window.glBrandLogoSvg = '<svg class="gl-brand-crest-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="glRoyalGold" x1="15" y1="10" x2="105" y2="110" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#FCE79C"/><stop offset="45%" stop-color="#D4AF37"/><stop offset="100%" stop-color="#9A711C"/></linearGradient></defs><circle cx="60" cy="60" r="54" stroke="url(#glRoyalGold)" stroke-width="2.2" stroke-dasharray="4 2" opacity="0.55"/><polygon points="60,8 96,23 111,60 96,97 60,112 24,97 9,60 24,23" stroke="url(#glRoyalGold)" stroke-width="2.5" fill="none"/><path d="M60 20L78 35L60 66L42 35L60 20Z" fill="url(#glRoyalGold)"/><path d="M42 35H78M60 20L51 35L60 66L69 35L60 20Z" stroke="#10231B" stroke-width="1.6"/><path d="M58 72C42 72 26 60 24 42C39 43 52 54 58 72Z" fill="url(#glRoyalGold)"/><path d="M62 72C78 72 94 60 96 42C81 43 68 54 62 72Z" fill="url(#glRoyalGold)"/><path d="M58 88C43 87 31 79 27 65C40 67 51 75 58 88Z" fill="url(#glRoyalGold)" opacity="0.88"/><path d="M62 88C77 87 89 79 93 65C80 67 69 75 62 88Z" fill="url(#glRoyalGold)" opacity="0.88"/><path d="M60 66V98" stroke="url(#glRoyalGold)" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="101" r="3" fill="#FCE79C"/></svg>';
function platformLoginView() {
  const signup = new URLSearchParams(location.search).has('signup') || !!window.goldleafShopInvite;
  const adminEntry = new URLSearchParams(location.search).has('admin') || /super-admin\.html$/i.test(location.pathname);
  const rates = window.glGetLoginRates();
  const isStaff = window.glLoginRole === 'staff';
  const subText = signup ? 'Showroom Registration • ERP' : adminEntry ? 'Super Admin • Platform Console' : 'Jewellery Atelier • ERP';
  const tabsHtml = signup
    ? '<div class="c2-tabs"><button type="button" class="c2-tab active" style="cursor:default">Register New Showroom</button></div>'
    : adminEntry
      ? '<div class="c2-tabs"><button type="button" class="c2-tab active" style="cursor:default">Super Admin Login</button></div>'
      : '<div class="c2-tabs" role="tablist" aria-label="Account role"><button type="button" class="c2-tab ' + (!isStaff ? 'active' : '') + '" data-role="admin" onclick="glSwitchLoginRole(\'admin\')">Shop Admin</button><button type="button" class="c2-tab ' + (isStaff ? 'active' : '') + '" data-role="staff" onclick="glSwitchLoginRole(\'staff\')">Staff Counter</button></div>';
  const emailLabel = signup ? 'Owner Email *' : adminEntry ? 'Super Admin Email' : (isStaff ? 'Staff Counter Email' : 'Registered Email');
  const emailPlaceholder = signup ? 'owner@showroom.com' : adminEntry ? 'admin@goldleaf.in' : (isStaff ? 'staff@showroom.com' : 'contact@showroom.com');
  const emailVal = (!signup && adminEntry) ? 'gengadharan28@gmail.com' : '';
  const passLabel = signup ? 'Choose Password *' : adminEntry ? 'Master Password' : 'Password';
  const submitLabel = signup ? 'Create Shop Account' : adminEntry ? 'Enter Super Admin' : (isStaff ? 'Enter Staff Counter' : 'Enter Showroom');
  const extraSignupFields = (signup && !window.goldleafShopInvite)
    ? '<div class="c2-signup-grid">'
      + '<div class="c2-group"><label class="c2-label" for="shopName">Shop Name *</label><input class="c2-input" id="shopName" name="shop_name" type="text" placeholder="Showroom Name" required></div>'
      + '<div class="c2-group"><label class="c2-label" for="shopGst">GST Number *</label><input class="c2-input" id="shopGst" name="gst" type="text" pattern="[A-Za-z0-9]{15}" maxlength="15" placeholder="15-digit GSTIN" required></div>'
      + '<div class="c2-group c2-wide"><label class="c2-label" for="shopPhone">Phone Number *</label><input class="c2-input" id="shopPhone" name="phone" type="tel" minlength="10" placeholder="10-digit mobile number" required></div>'
      + '<div class="c2-group c2-wide"><label class="c2-label" for="shopAddress">Showroom Address *</label><textarea class="c2-input" id="shopAddress" name="address" placeholder="Full street & city address" required></textarea></div>'
      + '</div>'
    : '';
  const footerLeft = signup
    ? '<span>Already registered? <a href="./">Sign in</a></span>'
    : adminEntry
      ? '<span><a href="./">← Showroom Login</a></span>'
      : '<span>New Showroom? <a href="?signup=1">Register shop</a></span>';
  return `<section class="c2-auth-card platform-login"><div class="c2-rate-bar"><div class="c2-rate-items"><span>24K <b id="glLoginRate24">${esc(rates.g24)}</b></span><span class="c2-rate-dot">•</span><span>22K <b id="glLoginRate22">${esc(rates.g22)}</b></span><span class="c2-rate-dot">•</span><span>Silver <b id="glLoginRateSilver">${esc(rates.slv)}</b></span></div><span class="c2-live-pill"><span class="c2-live-dot"></span>Live Rate</span></div><div class="c2-body"><div class="c2-header"><div class="c2-logo-mark" aria-hidden="true">${window.glBrandLogoSvg}</div><h1 class="c2-title">GOLDLEAF</h1><p class="c2-sub">${subText}</p></div>${tabsHtml}<form onsubmit="platformLogin(event)"><div class="c2-group"><label class="c2-label" id="glLoginEmailLabel" for="email">${emailLabel}</label><input class="c2-input" id="email" name="email" type="email" value="${esc(emailVal)}" placeholder="${emailPlaceholder}" autocomplete="username" required></div><div class="c2-group"><label class="c2-label" for="password">${passLabel}</label><input class="c2-input" id="password" name="password" type="password" placeholder="••••••••••••" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="${signup ? 12 : 8}"></div>${extraSignupFields}<input id="url" hidden value="${esc(db.cloud.url)}"><input id="key" hidden value="${esc(db.cloud.key)}"><button type="submit" id="glLoginSubmitBtn" class="c2-btn primary">${submitLabel}</button><p id="cloudMsg" class="c2-msg" role="status">${esc(platformError)}</p></form><div class="c2-links">${footerLeft}<a href="javascript:void(0)" onclick="glRefreshLoginRates()">Refresh Rates</a></div></div></section>`;
}
window.platformLoginView = platformLoginView;
window.platformLogin=async function(event){event.preventDefault();await window.auth(new URLSearchParams(location.search).has('signup')||window.goldleafShopInvite?'signup':'login');};
window.settingsView=function(){return platformBaseSettings().replace(/<section class="panel goldleaf-admin">[\s\S]*?(?=<section class="panel"><h2>Products<\/h2>)/,'');};
window.header=function(sub,buttons=''){let html=platformBaseHeader(sub,buttons);if(session&&goldleafContext){if(!goldleafContext.retail_enabled&&!goldleafContext.is_super_admin)html=html.replace(/<button[^>]*onclick="setWorkspaceMode\('retail'\)"[^>]*>Retail<\/button>/,'');if(!goldleafContext.wholesale_enabled&&!goldleafContext.is_super_admin)html=html.replace(/<button[^>]*onclick="setWorkspaceMode\('wholesale'\)"[^>]*>Wholesale<\/button>/,'');if(page==='Dashboard')html=html.replace('<div class="header-actions">','<div class="header-actions">'+platformQuickSignOut());}return html;};
window.setWorkspaceMode=function(mode){if(session&&goldleafContext&&!goldleafContext.is_super_admin&&!goldleafContext[mode+'_enabled'])return say('This workspace has not been enabled by Super Admin.');return platformBaseSetMode(mode);};
function platformViewStateKey(){return 'goldleaf-view-'+(goldleafContext?.shop_id||session?.user?.id||'');}
window.goldleafRememberView=function(){if(!session||!goldleafContext||goldleafContext.is_super_admin)return;try{localStorage.setItem(platformViewStateKey(),JSON.stringify({page,workspaceMode,retailSection:localStorage.getItem('goldleaf-retail-section')||'Bill'}));}catch{}}
window.setWorkspaceMode=function(mode){if(session&&goldleafContext&&!goldleafContext.is_super_admin&&!goldleafContext[mode+'_enabled'])return say('This workspace has not been enabled by Super Admin.');const result=platformBaseSetMode(mode);goldleafRememberView();return result;};
window.go=function(target){if(!session){return render();}if(target==='Super Admin')return platformOpen();if(session&&goldleafContext&&!goldleafContext.is_super_admin){if(/^Customer/.test(target)&&!goldleafContext.retail_enabled||/^Party/.test(target)&&!goldleafContext.wholesale_enabled)return say('Ask Super Admin to enable this workspace.');}const result=platformBaseGo(target);goldleafRememberView();return result;};
const platformOriginalDash=window.dash;
window.dash=function(){
  let html=platformOriginalDash().replace(/<section class="panel goldleaf-plan-card">[\s\S]*?<\/section>/g,'');
  if(session&&goldleafContext){
    const c=goldleafContext,text=[c.shop_name,c.plan+' · '+c.subscription_status,'Expires '+platformDate(c.expires_at),'Access: '+platformModules(c),Number(c.owner_seats||1)+' owner / '+Number(c.user_seats??1)+' user',c.plan_description,c.plan_price!=null?rateMoney(c.plan_price):'Contact Super Admin for pricing'].filter(Boolean).join('  ·  ');
    html+='<div class="platform-subscription-runner" role="note" aria-label="Shop subscription" tabindex="0"><span class="subscription-readable">'+esc(text)+'</span><div class="subscription-ticker" aria-hidden="true" style="--ticker-duration:'+Math.max(28,Math.ceil(text.length/4))+'s"><span>'+esc(text)+'</span><span>'+esc(text)+'</span></div></div>';
  }
  return html;
};
window.render=function(){
  const urlParams=new URLSearchParams(location.search);
  const adminLink=urlParams.has('admin')||/super-admin\.html$/i.test(location.pathname),signupLink=urlParams.has('signup')||!!window.goldleafShopInvite;
  if(!session && (urlParams.has('demo') || urlParams.has('chit') || localStorage.getItem('goldleaf_demo_active') === '1')){
    session = { user: { id: 'demo-shop-1', email: 'owner@goldleaf.com' }, access_token: 'demo' };
    goldleafContext = {
      shop_id: 'demo-shop-1',
      has_access: true,
      is_super_admin: false,
      retail_enabled: true,
      wholesale_enabled: true,
      shop_name: 'Goldleaf Jewellery Atelier'
    };
    db = init();
    try {
      db = Object.assign(db, JSON.parse(localStorage.getItem(platformStorageKey()) || 'null'));
    } catch {}
    ensureExtendedData();
    setCloudStatus('Demo · this device');
    workspaceMode = 'retail';
    localStorage.setItem('goldleaf_demo_active', '1');
    localStorage.setItem('goldleaf-workspace-mode', 'retail');
    if(!page || page === 'Dashboard' || urlParams.has('chit')) page = 'Chit';
  }
  if(!session&&!window.goldleafAuthReady){document.body.classList.add('gl-auth-active');document.getElementById('nav').innerHTML='';document.getElementById('app').innerHTML='<div class="gl-boot-state" role="status" aria-live="polite"><span class="gl-boot-dot" aria-hidden="true"></span><span>Opening Goldleaf…</span></div>';return;}
  if(!session){document.body.classList.add('gl-auth-active');document.body.classList.remove('rb-active','rc-active','compact-customer-sale');document.getElementById('nav').innerHTML='<button class="active">'+(signupLink?'Shop registration':adminLink?'Super Admin':'Sign in')+'</button>';document.getElementById('app').innerHTML=platformLoginView();return;}document.body.classList.remove('gl-auth-active');
  if(session&&!goldleafContext){document.getElementById('nav').innerHTML='';document.getElementById('app').innerHTML=platformTop('Loading your account','Checking your shop and access permissions…')+'<section class="panel"><p role="status">'+esc(platformError||'Connecting to Goldleaf cloud…')+'</p><button onclick="platformRefresh()">Try again</button><button onclick="platformSignOut()">Sign out</button></section>';return;}
  if(session&&goldleafContext){
    if(platformLoadedUser!==session.user.id){platformLoadedUser=session.user.id;if(goldleafContext.is_super_admin)platformPage='Dashboard';else{platformPage='';let saved=null;try{saved=JSON.parse(localStorage.getItem(platformViewStateKey())||'null')}catch{}if(saved&&['retail','wholesale'].includes(saved.workspaceMode)&&goldleafContext[saved.workspaceMode+'_enabled']){workspaceMode=saved.workspaceMode;if(typeof saved.page==='string'&&saved.page.length<80)page=saved.page;if(saved.retailSection)localStorage.setItem('goldleaf-retail-section',saved.retailSection)}else if(goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled)workspaceMode='retail';else if(goldleafContext.wholesale_enabled)workspaceMode='wholesale';}if(!goldleafContext.is_super_admin)window.history.replaceState(null,'',platformLink());}
    if(goldleafContext.is_super_admin){if(!platformPage)platformPage='Dashboard';platformNav(platformPage);let html=platformPage==='Shops & access'?platformShops():platformPage==='Create shop'?platformCreateShop():platformPage==='Users & seats'?platformUsersView():platformPage==='Payments'?platformPaymentsView():platformPage==='Subscription plans'?platformPlansView():platformPage==='Shared rates'?platformTop('Shared rates','Save rates here to update every shop’s Rate Book.')+rateBookView().replace(/^[\s\S]*?<\/header>/,''):platformPage==='Platform reports'?platformReportsView():platformDashboard();document.getElementById('app').innerHTML=html+(platformError?'<section class="panel" role="alert">'+esc(platformError)+'</section>':'')+'<footer class="app-version">Goldleaf v'+(window.GOLDLEAF_VERSION||'2.10.20')+'</footer>';return;}
    if(!goldleafContext.is_super_admin&&(!goldleafContext.has_access||!goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled)){document.getElementById('nav').innerHTML='<button class="active">My subscription</button><button onclick="platformRefresh(true)">Refresh access</button><button onclick="platformSignOut()">Sign out</button>';document.getElementById('app').innerHTML=platformTop(goldleafContext.has_access?'Waiting for workspace approval':'Subscription needs renewal',goldleafContext.shop_name)+`<section class="panel"><h2>${esc(goldleafContext.plan)} plan</h2><p>Expires ${platformDateTime(goldleafContext.expires_at)} · Status: <b>${esc(goldleafContext.subscription_status||'trial')}</b> · Workspaces: <b>${platformModules(goldleafContext)}</b></p><p>${esc(goldleafContext.plan_description||'')}</p><p>${goldleafContext.has_access?'Your shop is registered. Super Admin will enable Retail, Wholesale, or both.':'Your records remain saved. Ask Super Admin to extend validity / apply renewal (changing Account status without extending the expiry date will still show expired).'}</p><div class="platform-subscription"><button type="button" class="primary" onclick="platformRefresh(true)">↻ Refresh access</button><a href="mailto:gengadharan28@gmail.com">Contact Super Admin</a></div></section>`;return;}
    if(!goldleafContext.is_super_admin&&!goldleafContext[workspaceMode+'_enabled']){workspaceMode=goldleafContext.retail_enabled?'retail':'wholesale';page='Dashboard';}
  }
  platformBaseRender();
  if(goldleafContext?.is_super_admin){const nav=document.getElementById('nav');nav.insertAdjacentHTML('beforeend','<button onclick="platformOpen()">◈ Super Admin</button>');nav.querySelector('#moreMenu')?.insertAdjacentHTML('beforeend','<button onclick="platformOpen()">Super Admin</button>');}
};
window.goldleafShopInvite=new URLSearchParams(location.search).get('shop_invite')||'';
// Keep local records bound to the shop that created them. A different login
// starts from its own cloud ledger rather than importing this browser's records.
function platformStorageKey(){return goldleafContext?.shop_id?'goldleaf-shop-'+goldleafContext.shop_id:'';}
function platformReadShopCache(shopId){
  try{
    const cached=JSON.parse(localStorage.getItem('goldleaf-shop-'+shopId)||'null');
    if(!cached||cached.cacheVersion!==2||cached.shop_id!==shopId||cached.user_id!==session?.user?.id||!cached.payload||typeof cached.payload!=='object')return null;
    return cached.payload;
  }catch{return null}
}
function platformWriteShopCache(){
  const key=platformStorageKey();
  if(!key||!session?.user?.id||platformIsDemo())return;
  localStorage.setItem(key,JSON.stringify({cacheVersion:2,shop_id:goldleafContext.shop_id,user_id:session.user.id,payload:db,saved_at:new Date().toISOString()}));
}
let platformLedgerShop='';
const GL_CTX_CACHE_KEY='goldleaf-ctx-v2';
function platformWriteContextCache(){
  if(!session?.user?.id||!goldleafContext||platformIsDemo())return;
  try{
    localStorage.setItem(GL_CTX_CACHE_KEY,JSON.stringify({
      v:2,
      user_id:session.user.id,
      context:goldleafContext,
      updated_at:v2LastCloudUpdatedAt||'',
      admin:goldleafContext.is_super_admin?{
        shops:goldleafAdminShops,
        invites:platformInvites,
        plans:platformPlans,
        loans:[...platformLoanEntitlements.entries()]
      }:null
    }));
  }catch{}
}
window.glTryInstantHydrate=function(sess){
  if(!sess?.user?.id||platformIsDemo())return false;
  try{
    const raw=JSON.parse(localStorage.getItem(GL_CTX_CACHE_KEY)||'null');
    if(!raw||raw.v!==2||raw.user_id!==sess.user.id||!raw.context)return false;
    goldleafContext=raw.context;
    if(raw.updated_at)v2LastCloudUpdatedAt=raw.updated_at;
    if(goldleafContext.is_super_admin&&raw.admin){
      goldleafAdminShops=Array.isArray(raw.admin.shops)?raw.admin.shops:[];
      platformInvites=Array.isArray(raw.admin.invites)?raw.admin.invites:[];
      platformPlans=Array.isArray(raw.admin.plans)?raw.admin.plans:[];
      platformLoanEntitlements.clear();
      for(const [k,val] of raw.admin.loans||[])platformLoanEntitlements.set(k,!!val);
    }
    if(goldleafContext.shop_id){
      const local=platformReadShopCache(goldleafContext.shop_id);
      if(local){
        db=Object.assign(init(),local);
        ensureExtendedData();
        platformLedgerShop=goldleafContext.shop_id;
      }
      try{
        const sr=JSON.parse(localStorage.getItem('goldleaf-cached-public-rates')||'null');
        if(sr&&Number(sr.gold24)>0){
          db.sharedRates=sr;
          if(goldleafContext.shared_rates_enabled!==false)db.rates=Object.assign({},sr);
        }
      }catch{}
      setCloudStatus('Cloud · '+(goldleafContext.shop_name||sess.user.email));
    }
    return true;
  }catch{return false;}
};
const platformPreviousSave=window.save;
const platformPreviousAuthForm=window.authForm;
window.authForm=function(){if(session){goldleafContext=null;platformLoadedUser='';platformLedgerShop='';localStorage.removeItem(GL_CTX_CACHE_KEY);}return platformPreviousAuthForm();};
window.save = function () {
  if (platformIsDemo()) {
    localStorage.setItem(platformStorageKey(), JSON.stringify(db));
    return;
  }
  if (db.recordsResetToken) {
    for (const key of ['parties', 'customers', 'sales', 'payments', 'retailSuppliers', 'retailDocuments']) {
      for (const row of db[key] || []) row.recordsResetToken = db.recordsResetToken;
    }
  }
  const result = platformPreviousSave();
  if (session && platformStorageKey()) platformWriteShopCache();
  localStorage.removeItem(dbkey);
  return result;
};
function platformStoreLedger(){platformWriteShopCache();localStorage.removeItem(dbkey);}
function platformAdoptCloudReset(payload){
  if(!payload?.recordsResetToken||payload.recordsResetToken===db.recordsResetToken)return false;
  db=Object.assign(init(),payload);ensureExtendedData();edit=null;
  localStorage.removeItem('goldleaf-device-backup-before-shop-login');
  localStorage.removeItem(V2_CLOUD_PENDING_KEY);platformStoreLedger();return true;
}
window.pullCloud=async function(){
  if(!session||!client||v2CloudBusy||platformIsDemo())return;
  v2CloudBusy=true;
  try{
    const context=await client.rpc('goldleaf_my_context');if(context.error)throw context.error;
    const previous=goldleafContext;goldleafContext=context.data;
    if(!goldleafContext?.shop_id&&!goldleafContext?.is_super_admin)throw new Error('This login does not have a shop. Contact Super Admin.');
    const needsLedger=goldleafContext.has_access&&(goldleafContext.retail_enabled||goldleafContext.wholesale_enabled);
    const adminRequests=goldleafContext.is_super_admin
      ? Promise.all([client.rpc('goldleaf_admin_list_shops'),client.rpc('goldleaf_admin_list_onboarding'),client.rpc('goldleaf_list_plans'),client.from('goldleaf_jewel_loan_access').select('shop_id,enabled')])
      : Promise.resolve(null);
    const [shared,response,adminResponses]=await Promise.all([
      client.rpc('goldleaf_get_shared_rates'),
      needsLedger?client.rpc('goldleaf_read_ledger'):Promise.resolve(null),
      adminRequests
    ]);
    if(adminResponses){
      const [shops,onboarding,plans,loanAccess]=adminResponses;
      for(const result of [shops,onboarding,plans])if(result.error)throw result.error;
      [goldleafAdminShops,platformInvites,platformPlans]=[shops,onboarding,plans].map(result=>result.data||[]);
      platformLoanEntitlements.clear();
      for(const s of goldleafAdminShops)if(typeof s.jewel_loan_enabled==='boolean')platformLoanEntitlements.set(s.id,s.jewel_loan_enabled);
      if(!loanAccess.error){for(const row of loanAccess.data||[])platformLoanEntitlements.set(row.shop_id,!!row.enabled);}
    }
    platformWriteContextCache();
    if(shared.error)throw shared.error;
    if(shared.data&&Number(shared.data.gold24)>0)try{localStorage.setItem('goldleaf-cached-public-rates',JSON.stringify(shared.data));}catch{}
    if(!goldleafContext.has_access||!goldleafContext.retail_enabled&&!goldleafContext.wholesale_enabled){db.rates=shared.data||{};platformError='';setCloudStatus((goldleafContext.has_access?'Awaiting workspace · ':'Subscription expired · ')+(goldleafContext.shop_name||session.user.email));render();return;}
    if(response.error)throw response.error;
    const remote=response.data||{},shop=goldleafContext.shop_id;
    const unchangedHydrated=!!(previous&&platformLedgerShop===shop&&v2LastCloudUpdatedAt&&remote.updated_at&&v2LastCloudUpdatedAt===remote.updated_at&&localStorage.getItem(V2_CLOUD_PENDING_KEY)!=='1'&&previous.retail_enabled===goldleafContext.retail_enabled&&previous.wholesale_enabled===goldleafContext.wholesale_enabled&&previous.jewel_loan_enabled===goldleafContext.jewel_loan_enabled&&JSON.stringify(db.sharedRates||{})===JSON.stringify(shared.data||{}));
    const resetApplied=platformAdoptCloudReset(remote.payload);
    if(platformLedgerShop!==shop){
      localStorage.removeItem('goldleaf-device-backup-before-shop-login');
      const local=platformReadShopCache(shop);
      db=local&&(!remote.payload?.recordsResetToken||local.recordsResetToken===remote.payload.recordsResetToken)?v2MergeCloudLedgers(remote.payload,local,true):Object.assign(init(),remote.payload||{});
      platformLedgerShop=shop;if(JSON.stringify(db)!==JSON.stringify(remote.payload||{}))localStorage.setItem(V2_CLOUD_PENDING_KEY,'1');
    }else if(previous?.retail_enabled!==goldleafContext.retail_enabled||previous?.wholesale_enabled!==goldleafContext.wholesale_enabled){db=Object.assign(init(),remote.payload||{});localStorage.removeItem(V2_CLOUD_PENDING_KEY);}
    else if(!unchangedHydrated){const pending=localStorage.getItem(V2_CLOUD_PENDING_KEY)==='1';db=v2MergeCloudLedgers(remote.payload,db,pending);if(JSON.stringify(db.retailDocuments||[])!==JSON.stringify(remote.payload?.retailDocuments||[])||JSON.stringify(db.retailSuppliers||[])!==JSON.stringify(remote.payload?.retailSuppliers||[])||JSON.stringify(db.wholesaleLots||[])!==JSON.stringify(remote.payload?.wholesaleLots||[])||JSON.stringify(db.wholesalePacketSales||[])!==JSON.stringify(remote.payload?.wholesalePacketSales||[]))localStorage.setItem(V2_CLOUD_PENDING_KEY,'1');}
    ensureExtendedData();db.sharedRates=shared.data||{};db.rates=goldleafContext?.shared_rates_enabled!==false?Object.assign({},db.sharedRates):(db.shopRates?.enabled?Object.assign({},db.shopRates):db.rates);v2LastCloudUpdatedAt=remote.updated_at||'';platformStoreLedger();platformWriteContextCache();platformError='';
    setCloudStatus(localStorage.getItem(V2_CLOUD_PENDING_KEY)==='1'?'Entry saved here · waiting to sync':'Cloud · '+goldleafContext.shop_name);if(resetApplied||(!unchangedHydrated&&!v2HasFocusedEdit())||!previous||previous.retail_enabled!==goldleafContext.retail_enabled||previous.wholesale_enabled!==goldleafContext.wholesale_enabled||previous.jewel_loan_enabled!==goldleafContext.jewel_loan_enabled)render();
  }catch(error){platformError=error.message;window.v2LastSyncError=error.message;setCloudStatus('Cloud connection needs attention');if(!v2HasFocusedEdit())render();}
  finally{v2CloudBusy=false;}
};
window.pushCloud=async function(){
  if(!session||!client||!goldleafContext?.shop_id||!goldleafContext.has_access||platformIsDemo())return;
  if(v2CloudBusy){v2CloudQueuedPush=true;return;}v2CloudBusy=true;localStorage.setItem(V2_CLOUD_PENDING_KEY,'1');
  try{
    do{v2CloudQueuedPush=false;let written=false;
      for(let attempt=0;attempt<4&&!written;attempt++){
        const remote=await client.rpc('goldleaf_read_ledger');if(remote.error)throw remote.error;
        if(platformAdoptCloudReset(remote.data?.payload)){say('Old shop entries were cleared. Please enter your new record again.');render();return;}
        db=v2MergeCloudLedgers(remote.data?.payload,db,true);
        const write=await client.rpc('goldleaf_save_ledger',{p_payload:db,p_expected:remote.data?.updated_at||null});if(write.error)throw write.error;
        if(write.data){
          const confirmed=await client.rpc('goldleaf_read_ledger');if(confirmed.error)throw confirmed.error;
          for(const key of ['retailDocuments','retailSuppliers']){
            const saved=new Map((confirmed.data?.payload?.[key]||[]).map(row=>[row.id,row]));
            if((db[key]||[]).some(row=>!saved.has(row.id)||String(saved.get(row.id).updatedAt||saved.get(row.id).createdAt||'')!==String(row.updatedAt||row.createdAt||'')))throw new Error('Cloud has not confirmed the Retail records. Your entries remain saved on this device. Cloud Retail storage needs updating.');
          }
          written=true;v2LastCloudUpdatedAt=write.data;
        }
      }
      if(!written)throw new Error('Records changed on another device. Your entry is saved here and will retry.');
      platformStoreLedger();platformWriteContextCache();localStorage.removeItem(V2_CLOUD_PENDING_KEY);window.v2LastSyncError='';const cloudEl=document.getElementById('cloudState');if(cloudEl)cloudEl.title='';setCloudStatus('Cloud · '+goldleafContext.shop_name);
    }while(v2CloudQueuedPush);
  }catch(error){const rawMsg=String(error?.message||'');const needsSql=/Retail supplier is missing/i.test(rawMsg)&&(db.retailDocuments||[]).some(d=>d?.kind==='retail-product-group'||d?.kind==='retail-model');platformError=needsSql?'Cloud Retail schema needs supabase_retail_features.sql update to sync Product Group / Model records.':rawMsg;window.v2LastSyncError=platformError;const cloudEl=document.getElementById('cloudState');if(cloudEl)cloudEl.title=platformError;setCloudStatus('Entry saved here · waiting to sync');}
  finally{v2CloudBusy=false;}
};
window.v2CheckCloudForChanges=async function(){if(!session||!client||platformIsDemo()||v2CloudBusy||v2CloudCheckBusy||document.visibilityState!=='visible')return;v2CloudCheckBusy=true;try{await pullCloud();if(localStorage.getItem(V2_CLOUD_PENDING_KEY)==='1')await pushCloud();}finally{v2CloudCheckBusy=false;}};
// Prevent rate reminders from covering the platform sign-in and control screens.
const platformCheckRateReminder=window.checkRateReminder;
window.checkRateReminder=function(){if(platformPage||new URLSearchParams(location.search).has('signup'))return;return platformCheckRateReminder();};
document.querySelector('[aria-label="Daily rate reminder"]')?.remove();
// Render the administrative route before any jewellery workspace.
const platformStyle=document.createElement('style');platformStyle.textContent=`.platform-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}.platform-metrics .card{min-width:0!important}.platform-link{display:flex;gap:10px;flex-wrap:wrap}.platform-link input{flex:1;min-width:200px}.platform-login{max-width:640px;margin:35px auto!important}.platform-login .field{margin-bottom:16px}.platform-login input,.platform-login textarea{width:100%;margin-top:7px}.platform-checks{display:flex;gap:20px;padding:12px 0}.platform-checks label{display:flex;align-items:center;gap:8px}.platform-checks input{width:20px;height:20px}.platform-shop-actions{display:flex;flex-wrap:wrap;gap:24px;border-top:1px solid #d6d2c8;margin-top:16px;padding-top:16px}.platform-shop-actions form{display:flex;align-items:end;flex-wrap:wrap;gap:10px}.platform-shop-actions label{display:grid;gap:6px}.platform-subscription{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.platform-subscription p{margin:0}.platform-shop .grid input,.platform-shop .grid select{width:100%;margin-top:6px}.platform-pill-expired{background:#fdf0ed!important;color:#983c32!important;border:1px solid #d8a8a2!important;font-weight:700}.platform-pill-warn{background:#fdf6e7!important;color:#7a5812!important;border:1px solid #dfd0a8!important;font-weight:700}.platform-pill-ok{background:#edf7f0!important;color:#17593a!important;border:1px solid #9ed0b4!important;font-weight:700}.platform-expiry-alert{margin:10px 0 14px;padding:10px 12px;border-radius:8px;border:1px solid #d8a8a2;background:#fdf0ed;color:#7b2b22;font-size:13px;line-height:1.45}.platform-expiry-warn{border-color:#dfd0a8;background:#fdf6e7;color:#6c4c0e}html[data-theme="dark"] .platform-pill-expired{background:#3d2421!important;color:#ffc6be!important;border-color:#80514a!important}html[data-theme="dark"] .platform-pill-warn{background:#3a311e!important;color:#f5d58c!important;border-color:#746032!important}html[data-theme="dark"] .platform-pill-ok{background:#1b3326!important;color:#9ee0ba!important;border-color:#3a6b50!important}html[data-theme="dark"] .platform-expiry-alert{background:#3a2220;color:#ffd0ca;border-color:#7c4d47}html[data-theme="dark"] .platform-expiry-warn{background:#382e1d;color:#f7d996;border-color:#6d5932}@media(max-width:760px){.platform-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.platform-metrics .card b{font-size:22px!important}.platform-shop-actions form,.platform-shop-actions label{width:100%}.platform-shop-actions button{width:100%}.platform-login{margin:15px 0!important}.platform-link button{width:100%}.platform-checks{gap:16px}.goldleaf-admin-head{flex-wrap:wrap}}`;document.head.append(platformStyle);
render();

const quickSignOutHistory=window.updateHistoryView;
window.updateHistoryView=function(){return quickSignOutHistory().replace('v2.4.1 · 6 Nov 2026 · Current','v2.4.1 · 6 Nov 2026').replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.4.2 · 6 Nov 2026 · Current</h3><ul><li>Added a visible Sign out button at the top of shop and Super Admin dashboards on phone and desktop.</li><li>Arranged all six Super Admin counts in one compact row.</li></ul></article>');};
const quickSignOutStyle=document.createElement('style');quickSignOutStyle.textContent='.platform-metrics{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:8px!important;margin-bottom:14px}.platform-metrics .card{padding:11px 10px!important;min-width:0!important;min-height:76px!important;border-radius:12px!important;display:flex;flex-direction:column;justify-content:space-between;gap:6px}.platform-metrics .card label{font-size:10px!important;line-height:1.3;letter-spacing:.04em!important;margin:0;white-space:normal}.platform-metrics .card b{font-size:23px!important;line-height:1.1;margin:0;white-space:nowrap}.platform-metrics .card:last-child b{font-size:19px!important}@media(max-width:760px){.platform-metrics{gap:4px!important}.platform-metrics .card{padding:8px 5px!important;min-height:68px!important;border-radius:8px!important;gap:5px}.platform-metrics .card label{font-size:7px!important;letter-spacing:0!important;line-height:1.35;min-height:20px}.platform-metrics .card b{font-size:18px!important}.platform-metrics .card:last-child b{font-size:11px!important}}.platform-sign-out{min-height:44px!important;white-space:nowrap;color:#983c32;border-color:#d8a8a2;background:#fff5f2;font-weight:600}html[data-theme="dark"] .platform-sign-out{color:#ffc6be;border-color:#80514a;background:#3d2824}';document.head.append(quickSignOutStyle);
const subscriptionFooterHistory=window.updateHistoryView;
window.updateHistoryView=function(){return subscriptionFooterHistory().replace('v2.4.2 · 6 Nov 2026 · Current','v2.4.2 · 6 Nov 2026').replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.4.3 · 6 Nov 2026 · Current</h3><ul><li>Moved shop, plan, expiry and access information from the top panels to a small running line at the bottom of each shop dashboard.</li></ul></article>');};
const subscriptionFooterStyle=document.createElement('style');subscriptionFooterStyle.textContent='.platform-subscription-runner{max-width:100%;margin:18px 0 0;padding:7px 0;border-top:1px solid #d9d5cb;overflow:hidden;color:#686c64;font-size:10px;line-height:1.5;white-space:nowrap}.subscription-ticker{display:flex;width:max-content;animation:subscription-scroll var(--ticker-duration,40s) linear infinite}.subscription-ticker>span{flex-shrink:0;padding-right:60px}.platform-subscription-runner:hover .subscription-ticker,.platform-subscription-runner:focus .subscription-ticker{animation-play-state:paused}.subscription-readable{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}html[data-theme="dark"] .platform-subscription-runner{color:#b5b9b1;border-color:#454b45}@keyframes subscription-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.platform-subscription-runner{overflow-x:auto}.subscription-ticker{animation:none}.subscription-ticker>span+span{display:none}}';document.head.append(subscriptionFooterStyle);
const registrationActionStyle=document.createElement('style');registrationActionStyle.textContent='.platform-row-actions{display:flex;align-items:center;gap:6px;white-space:nowrap}.platform-icon-action{width:32px!important;height:32px!important;min-height:32px!important;padding:0!important;border-radius:9px!important;font-size:17px!important;display:inline-grid!important;place-items:center;background:#f7f3e9;color:#72562a;border-color:#dfd2b8}.platform-icon-action.danger{background:#fff2ef;color:#a23b32;border-color:#e4b8b2}.platform-dialog-backdrop{position:fixed;inset:0;z-index:500;background:rgba(15,25,21,.62);display:grid;place-items:center;padding:16px}.platform-dialog{width:min(680px,100%);max-height:90dvh;overflow:auto;background:var(--white);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.32)}.platform-dialog textarea{width:100%;min-height:88px;margin-top:6px}html[data-theme="dark"] .platform-icon-action{background:#302d25;color:#f1dca9;border-color:#5b523f}html[data-theme="dark"] .platform-icon-action.danger{background:#402523;color:#ffc2b9;border-color:#744943}@media(max-width:760px){.platform-row-actions{gap:4px}.platform-icon-action{width:29px!important;height:29px!important;min-height:29px!important;font-size:15px!important}.platform-dialog{padding:13px;border-radius:13px}}';document.head.append(registrationActionStyle);
const platformLayoutStyle=document.createElement('style');platformLayoutStyle.textContent='.platform-metrics{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(145px,1fr))!important;gap:10px!important;margin:0 0 14px!important}.platform-metrics .card{min-width:0!important;min-height:74px!important;padding:12px 13px!important;border-radius:10px!important;overflow:hidden}.platform-metrics .card label{min-height:0!important;font-size:9px!important;line-height:1.25!important;letter-spacing:.035em!important;white-space:normal!important}.platform-metrics .card b,.platform-metrics .card:last-child b{font-size:18px!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere}.platform-shop{padding:15px!important}.platform-shop .goldleaf-admin-head{gap:10px;align-items:flex-start}.platform-shop .goldleaf-admin-head h2{font-size:17px!important;margin:0 0 3px}.platform-shop>p{margin:8px 0;font-size:12px;line-height:1.45}.platform-shop .grid{grid-template-columns:repeat(auto-fit,minmax(155px,1fr))!important;gap:9px!important}.platform-shop .field{min-width:0}.platform-shop .field label{font-size:10px}.platform-shop .field input,.platform-shop .field select{min-height:36px!important;font-size:12px!important}.platform-shop-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important;margin-top:12px!important;padding-top:12px!important}.platform-shop-actions form{display:grid!important;grid-template-columns:minmax(130px,1fr) auto;gap:8px!important;align-items:end}.platform-shop-actions label{min-width:0}.platform-shop-actions input,.platform-shop-actions select{width:100%;min-width:0}.platform-shop-actions button{white-space:nowrap}.platform-link{align-items:center}.platform-link input{min-height:38px}.main>.panel>.table,.main>.panel .table{max-width:100%;overflow-x:auto}.main>.panel table{width:100%}.main>.panel th,.main>.panel td{vertical-align:middle}.top{align-items:center}.top .header-actions{align-items:center}@media(min-width:1180px){.platform-metrics{grid-template-columns:repeat(6,minmax(0,1fr))!important}}@media(max-width:900px){.platform-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}.platform-shop-actions{grid-template-columns:1fr!important}}@media(max-width:760px){.platform-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.platform-metrics .card{min-height:72px!important;padding:10px!important}.platform-metrics .card label{font-size:8px!important}.platform-metrics .card b,.platform-metrics .card:last-child b{font-size:16px!important}.platform-shop{padding:11px!important}.platform-shop .goldleaf-admin-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto}.platform-shop .goldleaf-admin-head>div{min-width:0;overflow-wrap:anywhere}.platform-shop .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.platform-shop .field.wide{grid-column:1/-1}.platform-shop-actions form{grid-template-columns:1fr!important}.platform-shop-actions button{width:100%}.platform-checks{padding:6px 0!important;gap:10px!important;flex-wrap:wrap}.platform-checks input{width:17px!important;height:17px!important}.platform-expiry-alert{font-size:10px!important;padding:8px!important}.platform-link{display:grid!important;grid-template-columns:1fr 1fr!important}.platform-link input{grid-column:1/-1;min-width:0!important;width:100%}.platform-link button{width:100%!important}.top{padding:9px 10px!important;margin-bottom:9px!important}.top h1{font-size:17px!important}.top .muted{font-size:9px!important}.top .header-actions button{min-height:33px!important;padding:5px 8px!important;font-size:9px!important}}@media(max-width:390px){.platform-shop .grid{grid-template-columns:1fr!important}.platform-shop .field.wide{grid-column:auto}.platform-metrics .card b,.platform-metrics .card:last-child b{font-size:14px!important}}';document.head.append(platformLayoutStyle);


