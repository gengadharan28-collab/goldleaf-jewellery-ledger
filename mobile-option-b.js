/* Goldleaf mobile Option B: one compact workspace/page line across all phone screens. */
(function(){
  const mq=window.matchMedia('(max-width:760px)');
  const app=document.getElementById('app');
  const style=document.createElement('style');
  style.textContent=
    '@media(max-width:760px){'+
    'body .erp-workbar{display:flex!important;align-items:center!important;gap:7px!important;padding:5px 9px!important;min-height:52px!important;height:52px!important}'+
    'body .erp-bar-left{flex:0 0 auto!important;width:auto!important;min-width:0!important}'+
    'body .erp-sidebar-toggle{width:36px!important;height:36px!important;min-height:36px!important}'+
    'body .erp-page-tab,body .erp-shortcuts,body .erp-rate-chip,body .erp-user-badge,body .erp-toolbar-signout,body .erp-install-shortcut{display:none!important}'+
    'body .optionb-header-label{display:block!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:center!important;color:#76541e!important;font:600 clamp(12px,3.8vw,16px)/1.1 Georgia,serif!important}'+
    'body .erp-bar-right{flex:0 0 auto!important;width:auto!important;min-width:0!important;justify-content:flex-end!important}'+
    'body #app .top{display:flex!important;min-height:0!important;margin:0 0 6px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}'+
    'body #app .top>div:first-child{display:none!important}'+
    'body #app .top .header-actions{display:flex!important;justify-content:flex-end!important;flex-wrap:wrap!important;gap:5px!important}'+
    'body #app .rb-header{display:none!important}'+
    'body #app .rc-mobile-select:has(select[aria-label="Retail workspace"]){font-size:0!important;line-height:0!important;margin-top:0!important}'+
    'body #app .rc-mobile-select:has(select[aria-label="Retail workspace"]) select{font-size:16px!important;line-height:1.25!important}'+
    'body #app .retail-sale-top{min-height:0!important;margin:0 0 6px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}'+
    'body #app .retail-sale-top .retail-title{display:none!important}'+
    'body #app .retail-sale-top .retail-sale-tools{display:flex!important;justify-content:flex-end!important;gap:5px!important}'+
    '}';
  document.head.appendChild(style);
  function sync(){
    if(!mq.matches){document.querySelector('.optionb-header-label')?.remove();return}
    const bar=document.querySelector('#erpWorkbar');if(!bar)return;
    let badge=bar.querySelector('.optionb-header-label');
    if(!badge){badge=document.createElement('span');badge.className='optionb-header-label';badge.setAttribute('aria-label','Current Goldleaf page');bar.insertBefore(badge,bar.querySelector('.erp-bar-right'))}
    const host=app?.querySelector('.retail-sale-top,.top,.rb-header')||app;
    const eyebrow=host?.querySelector('.eyebrow')?.textContent?.trim()||'';
    const title=(host?.querySelector('h1')?.textContent||'').replace(/^s*✦s*/,'').trim();
    const workspace=/WHOLESALE/i.test(eyebrow)?'Wholesale':/RETAIL/i.test(eyebrow)?'Retail':/SUPERs*ADMIN|ADMIN/i.test(eyebrow)?'Admin':'';
    badge.textContent=['Goldleaf',workspace,title].filter(Boolean).join(' · ');
  }
  let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync()})}
  if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);sync();
  const oldHistory=window.updateHistoryView;
  if(typeof oldHistory==='function'&&!oldHistory.__optionB){
    const updated=function(){let html=oldHistory.apply(this,arguments);html=html.replace(/Goldleaf v[0-9.]+<\/b> · [^<]+/,'Goldleaf v2.10.20</b> · 9 Nov 2026');if(!html.includes('v2.10.20 · 9 Nov 2026 · Current'))html='<article class="release-note"><h3>v2.10.20 · 9 Nov 2026 · Current</h3><ul><li>Applied the selected compact, single-line Goldleaf, workspace and page heading across mobile screens.</li><li>Removed the oversized mobile workspace banner.</li></ul></article>'+html;return html};updated.__optionB=true;window.updateHistoryView=updated;
  }
})();
