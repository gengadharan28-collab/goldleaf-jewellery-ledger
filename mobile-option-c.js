/* Goldleaf Mobile Option C: phone-first section cards. Desktop UI remains unchanged. */
(function(){
  const mq=window.matchMedia('(max-width:760px)');
  const style=document.createElement('style');
  style.id='goldleaf-option-c-style';
  style.textContent=`
@media(max-width:760px){
 body.optionc-mobile{background:#fbf7ef!important;color:#332d22!important}
 body.optionc-mobile .erp-workbar{position:sticky!important;top:0!important;z-index:80!important;min-height:58px!important;height:58px!important;justify-content:space-between!important;padding:5px 12px!important;background:rgba(255,253,248,.96)!important;border-bottom:1px solid #eadfc9!important;box-shadow:0 3px 12px #6147190d!important}
 body.optionc-mobile .erp-bar-left{flex:1 1 0!important;min-width:38px!important}
 body.optionc-mobile .erp-page-tab,body.optionc-mobile .erp-shortcuts,body.optionc-mobile .erp-rate-chip,body.optionc-mobile .erp-user-badge,body.optionc-mobile .erp-toolbar-signout,body.optionc-mobile .erp-install-shortcut{display:none!important}
 body.optionc-mobile .erp-sidebar-toggle{display:grid!important;width:40px!important;height:40px!important;min-height:40px!important;place-items:center!important;border:0!important;background:transparent!important;color:#70501f!important}
 body.optionc-mobile .erp-workbar:after{content:'Goldleaf';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#76541e;font:600 24px/1 Georgia,serif;letter-spacing:.15px;pointer-events:none}
 body.optionc-mobile .erp-bar-right{flex:1 1 0!important;justify-content:flex-end!important;gap:4px!important}
 body.optionc-mobile #app.main{padding:12px 13px calc(108px + env(safe-area-inset-bottom))!important;min-height:calc(100dvh - 58px)!important;background:linear-gradient(180deg,#fcf8f0 0%,#f8f3e9 100%)!important}
 body.optionc-mobile .top,body.optionc-mobile .rc-screen>.rb-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:3px 0 13px!important;padding:14px!important;border:1px solid #eadfc9!important;border-radius:19px!important;background:linear-gradient(135deg,#fffefa,#f4ead5)!important;box-shadow:0 5px 18px #72592b10!important}
 body.optionc-mobile .rc-screen>.rb-header .eyebrow{display:block!important;margin-bottom:4px!important;color:#a27a36!important;font-size:9px!important;letter-spacing:1.6px!important}
 body.optionc-mobile .rc-screen>.rb-header h1,body.optionc-mobile .top h1{display:flex!important;align-items:center!important;gap:10px!important;margin:0!important;color:#392b18!important;font:600 22px/1.15 Georgia,serif!important}
 body.optionc-mobile .rc-screen>.rb-header h1:before{content:'✦';display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:13px;background:linear-gradient(145deg,#d6a94e,#b67c21);color:white;font:600 21px Georgia,serif;box-shadow:0 4px 10px #9c711f30}
 body.optionc-mobile .rc-screen>.rb-header .rb-tools{display:none!important}
 body.optionc-mobile .top .muted{font-size:11px!important;line-height:1.35!important}
 body.optionc-mobile .panel,body.optionc-mobile .rc-content>.panel,body.optionc-mobile .rc-content>form>.panel{padding:13px!important;margin:0 0 11px!important;border:1px solid #e9dfcf!important;border-radius:17px!important;background:#fffefa!important;box-shadow:0 4px 14px #6147190c!important}
 body.optionc-mobile .panel h2,body.optionc-mobile .rc-content h2{color:#3b301f!important;font-size:15px!important;line-height:1.3!important}
 body.optionc-mobile .rc-section-title{align-items:center!important;gap:9px!important}
 body.optionc-mobile .rc-section-title h2{border:0!important;padding:0!important;margin:0!important}
 body.optionc-mobile .rc-grid,body.optionc-mobile .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
 body.optionc-mobile .rc-grid>label:not(.rc-wide),body.optionc-mobile .grid>.field:not(.wide){grid-column:auto!important;min-width:0!important}
 body.optionc-mobile .rc-wide,body.optionc-mobile .wide{grid-column:1/-1!important}
 body.optionc-mobile input,body.optionc-mobile select,body.optionc-mobile textarea{min-width:0!important;max-width:100%!important;min-height:45px!important;border:1px solid #e6dcc9!important;border-radius:12px!important;background:#fffefa!important;color:#332d22!important;font-size:15px!important}
 body.optionc-mobile button{min-height:44px!important;border-radius:12px!important;touch-action:manipulation}
 body.optionc-mobile .primary{border-color:#c18a2d!important;background:linear-gradient(135deg,#d6aa51,#b77e24)!important;color:#fff!important;box-shadow:0 4px 10px #a9782825!important}
 body.optionc-mobile .cards{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 body.optionc-mobile .cards .card{border:1px solid #eadfcf!important;border-top:3px solid #d0a148!important;border-radius:14px!important;background:#fffefa!important}
 body.optionc-mobile .cards .card:nth-child(3n+2){background:#f0f5ef!important;border-top-color:#8db99b!important}
 body.optionc-mobile .cards .card:nth-child(3n){background:#f8eee5!important;border-top-color:#d79b70!important}
 body.optionc-mobile .cards .card label{font-size:9px!important;color:#766a55!important}
 body.optionc-mobile .cards .card b{font-size:17px!important;color:#352b1d!important}
 body.optionc-mobile .right,body.optionc-mobile .rc-actions{position:static!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:11px 0 0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
 body.optionc-mobile .table,body.optionc-mobile .rc-content .table{max-width:100%!important;overflow:visible!important;border:0!important;background:transparent!important}
 body.optionc-mobile .table table,body.optionc-mobile .rc-content table{display:block!important;width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0 9px!important;background:transparent!important}
 body.optionc-mobile .table thead,body.optionc-mobile .rc-content table thead{display:none!important}
 body.optionc-mobile .table tbody,body.optionc-mobile .rc-content table tbody{display:grid!important;gap:9px!important}
 body.optionc-mobile .table tbody tr,body.optionc-mobile .rc-content table tbody tr{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 12px!important;padding:8px 12px!important;border:1px solid #eadfcf!important;border-radius:15px!important;background:#fffefa!important;box-shadow:0 3px 10px #6147190a!important}
 body.optionc-mobile .table td,body.optionc-mobile .rc-content table td{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:3px!important;min-width:0!important;padding:8px 0!important;border-bottom:1px solid #f0e9de!important;text-align:left!important;font-size:12px!important;overflow-wrap:anywhere!important}
 body.optionc-mobile .table td:before,body.optionc-mobile .rc-content table td:before{content:attr(data-label)!important;color:#9b7a45!important;font-size:9px!important;font-weight:800!important;letter-spacing:.55px!important;text-transform:uppercase!important}
 body.optionc-mobile .table td:last-child,body.optionc-mobile .rc-content table td:last-child{grid-column:1/-1!important;border-bottom:0!important}
 body.optionc-mobile .more-menu{background:#fffefa!important;border:1px solid #eadfcf!important}
 body.optionc-mobile .more-menu button{background:#f4efe4!important;color:#554426!important}
 body.optionc-tagging #app.main{padding-bottom:calc(177px + env(safe-area-inset-bottom))!important}
 body.optionc-tagging .optionc-quick-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin:11px 0 13px!important}
 body.optionc-tagging .optionc-quick-actions button{display:flex!important;min-width:0!important;min-height:70px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:8px 4px!important;border:1px solid transparent!important;font-size:11px!important;font-weight:750!important;line-height:1.15!important;white-space:normal!important}
 body.optionc-tagging .optionc-quick-actions button:before{font-size:18px!important;line-height:1}
 body.optionc-tagging .optionc-quick-actions .new-batch{background:#eee2f6!important;border-color:#e4d5ee!important;color:#59406d!important}
 body.optionc-tagging .optionc-quick-actions .scan-shortcut{background:#e4f1e6!important;border-color:#d4e7d8!important;color:#295c3b!important}
 body.optionc-tagging .optionc-quick-actions .add-product{background:#faeadc!important;border-color:#f1deca!important;color:#784923!important}
 body.optionc-tagging .optionc-batch-details{overflow:hidden!important;margin:0 0 10px!important;border:1px solid #eadfcf!important;border-radius:16px!important;background:linear-gradient(135deg,#fffefa,#f7efdf)!important;box-shadow:0 3px 11px #6147190c!important}
 body.optionc-tagging .optionc-batch-details>summary{display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:50px!important;padding:12px!important;color:#4b3617!important;font-size:14px!important;font-weight:800!important;list-style:none!important;cursor:pointer!important}
 body.optionc-tagging .optionc-batch-details>summary::-webkit-details-marker,body.optionc-tagging .optionc-item-details>summary::-webkit-details-marker{display:none!important}
 body.optionc-tagging .optionc-batch-details>summary:before{content:'▱';display:grid;place-items:center;width:26px;height:26px;margin-right:8px;border-radius:8px;background:#f1e1bc;color:#8a5c14;font-size:16px}
 body.optionc-tagging .optionc-batch-details>summary:after{content:'⌄';margin-left:auto;color:#7d5b22;font-size:19px}
 body.optionc-tagging .optionc-batch-details[open]>summary{border-bottom:1px solid #eadfcf}
 body.optionc-tagging .optionc-batch-details[open]>summary:after{content:'⌃'}
 body.optionc-tagging .optionc-batch-grid{padding:10px!important}
 body.optionc-tagging .rc-tag-batch-meta{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
 body.optionc-tagging .rc-tag-modebar{display:grid!important;gap:7px!important;margin:12px 0!important;padding:11px!important;border:1px solid #eadfcf!important;border-radius:15px!important;background:#fffefa!important}
 body.optionc-tagging .rc-tag-modebar>b{color:#78613c!important;font-size:10px!important;text-transform:uppercase!important;letter-spacing:.7px!important}
 body.optionc-tagging .rc-tag-modebar>div{display:grid!important;grid-template-columns:1fr 1fr!important;width:100%!important;gap:6px!important;padding:0!important;background:transparent!important}
 body.optionc-tagging .rc-tag-modebar button{min-height:44px!important;border:1px solid #e7dcc8!important;border-radius:12px!important;background:#fffefa!important;color:#5c4b30!important;font-weight:750!important}
 body.optionc-tagging .rc-tag-modebar button.active{border-color:#c18a2d!important;background:#d4a346!important;color:#fff!important;box-shadow:0 3px 9px #b47c2427!important}
 body.optionc-tagging .optionc-scan-card{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:0 0 12px!important;padding:11px!important;border:1px solid #e8d6b5!important;border-radius:15px!important;background:linear-gradient(110deg,#fff9ed,#f7ead4)!important}
 body.optionc-tagging .optionc-scan-card .scan-copy{display:grid!important;gap:3px!important;color:#493719!important}
 body.optionc-tagging .optionc-scan-card .scan-copy b{font-size:13px!important}
 body.optionc-tagging .optionc-scan-card .scan-copy small{font-size:10px!important;color:#806b47!important}
 body.optionc-tagging .optionc-scan-card button{min-width:48px!important;min-height:48px!important;background:#efdcb9!important;border-color:#e5cfaa!important;color:#7e5318!important;font-size:18px!important}
 body.optionc-tagging .rc-tag-row{overflow:hidden!important;margin:10px 0!important;padding:10px!important;border:1px solid #eadfcf!important;border-left:4px solid #d8a23d!important;border-radius:16px!important;background:#fffefa!important;box-shadow:0 4px 12px #6147190c!important}
 body.optionc-tagging .rc-tag-row>header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin:0!important;padding:0 0 8px!important;border-bottom:1px solid #f0e8db!important}
 body.optionc-tagging .rc-tag-row>header:before{content:'TAG ITEM'!important;color:#a77b32!important;font-size:9px!important;font-weight:850!important;letter-spacing:1px!important}
 body.optionc-tagging .rc-tag-row>header b{margin-right:auto!important;color:#3b301f!important;font-size:12px!important}
 body.optionc-tagging .rc-tag-row .rc-tag-remove{min-height:30px!important;padding:4px 8px!important;font-size:10px!important}
 body.optionc-tagging .optionc-item-details{margin-top:8px!important}
 body.optionc-tagging .optionc-item-details>summary{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:4px 9px!important;align-items:center!important;padding:10px!important;border:1px solid #f0e5d3!important;border-radius:12px!important;background:#fffaf0!important;list-style:none!important;cursor:pointer!important}
 body.optionc-tagging .optionc-item-details>summary:after{content:'⌄';grid-column:2;grid-row:1/3;color:#92631c;font-size:18px}
 body.optionc-tagging .optionc-item-details[open]>summary{border-radius:12px 12px 0 0!important;border-bottom:0!important}
 body.optionc-tagging .optionc-item-details[open]>summary:after{content:'⌃'}
 body.optionc-tagging .optionc-item-title{color:#332719!important;font-size:12px!important;font-weight:800!important}
 body.optionc-tagging .optionc-item-meta{color:#8b744e!important;font-size:10px!important}
 body.optionc-tagging .optionc-item-weight{grid-column:2!important;grid-row:1!important;padding:5px 8px!important;border-radius:99px!important;background:#f9ebcf!important;color:#714912!important;font-size:11px!important;font-weight:800!important}
 body.optionc-tagging .optionc-item-details>.rc-tag-fields{padding:10px!important;border:1px solid #f0e5d3!important;border-top:0!important;border-radius:0 0 12px 12px!important;background:#fffefa!important}
 body.optionc-tagging .rc-tag-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 body.optionc-tagging .rc-tag-fields label{min-width:0!important;font-size:10px!important;color:#75664c!important}
 body.optionc-tagging .rc-tag-fields .rc-tag-wide{grid-column:1/-1!important}
 body.optionc-tagging .rc-tag-fields input,body.optionc-tagging .rc-tag-fields select{min-height:43px!important;padding:7px!important;font-size:14px!important}
 body.optionc-tagging .rc-tag-fields .rc-scan-wrap{grid-template-columns:minmax(0,1fr) 46px!important}
 body.optionc-tagging .rc-tag-fields .rc-scan-wrap button{min-height:43px!important}
 body.optionc-tagging .optionc-batch-summary{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:12px 0!important}
 body.optionc-tagging .optionc-batch-summary>div{display:grid!important;gap:4px!important;padding:11px!important;border:1px solid #e9dfcf!important;border-radius:13px!important;background:#fffefa!important}
 body.optionc-tagging .optionc-batch-summary span{color:#8a795c!important;font-size:9px!important;font-weight:800!important;letter-spacing:.5px!important;text-transform:uppercase!important}
 body.optionc-tagging .optionc-batch-summary b{color:#3b301f!important;font-size:16px!important}
 body.optionc-tagging .rc-tag-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;padding:9px!important;border:1px solid #eadfcf!important;border-radius:14px!important;background:#fffefa!important}
 body.optionc-tagging .rc-tag-actions .primary{display:none!important}
 body.optionc-tagging .rc-tag-actions button{min-height:42px!important;padding:7px!important;font-size:10px!important}
 body.optionc-tagging .optionc-bottom-actions{position:fixed!important;left:10px!important;right:10px!important;bottom:calc(76px + env(safe-area-inset-bottom))!important;z-index:75!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding:9px!important;border:1px solid #eadfcf!important;border-radius:17px!important;background:rgba(255,253,248,.97)!important;box-shadow:0 8px 25px #47320f20!important;backdrop-filter:blur(12px)!important}
 body.optionc-tagging .optionc-bottom-actions button{min-height:48px!important;font-size:12px!important;font-weight:800!important}
 body.optionc-tagging .optionc-bottom-actions .camera{border-color:#e7d3ad!important;background:#fff3dd!important;color:#77501a!important}
 body.optionc-tagging .retail-modal-backdrop:not(.hidden)~.optionc-bottom-actions{display:none!important}
 html[data-theme='dark'] body.optionc-mobile{background:#191c1a!important}
 html[data-theme='dark'] body.optionc-mobile #app.main{background:linear-gradient(180deg,#1b1e1c,#20231f)!important}
 html[data-theme='dark'] body.optionc-mobile .erp-workbar{background:rgba(31,35,32,.97)!important;border-color:#45463d!important}
 html[data-theme='dark'] body.optionc-mobile .erp-workbar:after{color:#e1c384!important}
 html[data-theme='dark'] body.optionc-mobile .rc-screen>.rb-header,html[data-theme='dark'] body.optionc-mobile .panel,html[data-theme='dark'] body.optionc-mobile .table tbody tr{background:#232824!important;border-color:#41483e!important}
 html[data-theme='dark'] body.optionc-mobile .rc-screen>.rb-header h1,html[data-theme='dark'] body.optionc-mobile .panel h2{color:#f2e8d2!important}
 html[data-theme='dark'] body.optionc-tagging .optionc-batch-details,html[data-theme='dark'] body.optionc-tagging .optionc-scan-card,html[data-theme='dark'] body.optionc-tagging .rc-tag-row,html[data-theme='dark'] body.optionc-tagging .optionc-bottom-actions{background:#252923!important;border-color:#4c4b3d!important}
 html[data-theme='dark'] body.optionc-tagging .optionc-item-details>summary,html[data-theme='dark'] body.optionc-tagging .optionc-item-details>.rc-tag-fields,html[data-theme='dark'] body.optionc-tagging .optionc-batch-summary>div{background:#202521!important;border-color:#45483e!important}
 html[data-theme='dark'] body.optionc-mobile input,html[data-theme='dark'] body.optionc-mobile select,html[data-theme='dark'] body.optionc-mobile textarea{background:#202420!important;border-color:#4a5048!important;color:#eee7d8!important}
}
@media(max-width:430px){body.optionc-mobile #app.main{padding-left:10px!important;padding-right:10px!important}body.optionc-mobile .erp-workbar:after{font-size:22px!important}body.optionc-mobile .rc-screen>.rb-header h1{font-size:20px!important}body.optionc-mobile .optionc-quick-actions button{min-height:66px!important;font-size:10px!important}body.optionc-tagging .rc-tag-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
`;
  document.head.append(style);
  const app=document.getElementById('app');
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e};
  function restoreDesktop(){
    document.body.classList.remove('optionc-mobile','optionc-tagging');
    document.querySelector('.optionc-bottom-actions')?.remove();
    document.querySelector('.optionc-quick-actions')?.remove();
    document.querySelector('.optionc-scan-card')?.remove();
    document.querySelector('.optionc-batch-summary')?.remove();
    document.querySelectorAll('.optionc-item-details').forEach(d=>{const f=d.querySelector('.rc-tag-fields');if(f)d.parentNode.insertBefore(f,d);d.remove()});
    document.querySelectorAll('.optionc-batch-details').forEach(d=>{const m=d.querySelector('.rc-tag-batch-meta');if(m)d.parentNode.insertBefore(m,d);d.remove()});
    document.querySelectorAll('.optionc-tagging-form').forEach(f=>f.classList.remove('optionc-tagging-form'));
  }
  function syncSummaries(form){
    form.querySelectorAll('.rc-tag-row').forEach((row,i)=>{
      const s=row.querySelector('.optionc-item-details>summary');if(!s)return;
      const val=k=>row.querySelector('[data-tag="'+k+'"]')?.value||'';
      const product=row.querySelector('[data-tag="productId"]')?.selectedOptions?.[0]?.textContent?.trim();
      const title=product&&product!=='Select product'?product:'New jewellery item';
      const tag=val('tagCode').trim()||'Scan or enter tag code';
      const weight=Number(val('netWeight'))||0,pcs=Number(val('pieces'))||1;
      s.replaceChildren();
      s.append(make('span','optionc-item-title',(i+1)+'. '+title));
      s.append(make('span','optionc-item-weight',weight.toFixed(3)+' g'));
      s.append(make('span','optionc-item-meta',tag+' · '+pcs+' pc'+(pcs===1?'':'s')));
    });
    const summary=form.querySelector('.optionc-batch-summary');if(summary){const count=form.querySelectorAll('.rc-tag-row').length;const total=[...form.querySelectorAll('[data-tag="netWeight"]')].reduce((n,e)=>n+(Number(e.value)||0),0);summary.querySelector('[data-count]').textContent=String(count);summary.querySelector('[data-weight]').textContent=total.toFixed(3)+' g'}
    const details=form.querySelector('.optionc-batch-details');if(details){const lot=form.elements.lotEntry?.value?.trim();const s=details.querySelector('summary .optionc-batch-caption');if(s)s.textContent=lot?'Batch / Lot · '+lot:'Batch / Lot details'}
  }
  function enhance(){
    if(!mq.matches){restoreDesktop();return}
    document.body.classList.add('optionc-mobile');
    const form=app?.querySelector('#rcTagBatchForm');
    const tagging=!!form;
    document.body.classList.toggle('optionc-tagging',tagging);
    document.querySelector('.optionc-bottom-actions')?.remove();
    if(!tagging)return;
    form.classList.add('optionc-tagging-form');
    let meta=form.querySelector('.rc-tag-batch-meta');
    if(meta&&!meta.closest('.optionc-batch-details')){
      const d=document.createElement('details');d.className='optionc-batch-details';d.open=true;
      const s=document.createElement('summary'),caption=make('span','optionc-batch-caption','Batch / Lot details');s.append(caption);
      const content=document.createElement('div');content.className='optionc-batch-grid';
      meta.parentNode.insertBefore(d,meta);d.append(s,content);content.append(meta);
    }
    let mode=form.querySelector('.rc-tag-modebar');
    if(mode&&!form.querySelector('.optionc-scan-card')){
      const scan=document.createElement('div');scan.className='optionc-scan-card';
      const copy=document.createElement('span');copy.className='scan-copy';copy.append(make('b','','Scan barcode'),make('small','','Use your phone camera or barcode scanner'));
      const btn=make('button','camera','⌗');btn.type='button';btn.setAttribute('aria-label','Scan tag with camera');btn.onclick=()=>{const b=form.querySelector('#rcTagRows .rc-scan-wrap button');if(b)b.click()};
      scan.append(copy,btn);mode.insertAdjacentElement('afterend',scan);
    }
    let rows=form.querySelector('#rcTagRows');
    if(rows){
      rows.querySelectorAll('.rc-tag-row').forEach(row=>{
        const fields=row.querySelector('.rc-tag-fields');
        if(fields&&!fields.closest('.optionc-item-details')){
          const d=document.createElement('details');d.className='optionc-item-details';
          const s=document.createElement('summary');
          fields.parentNode.insertBefore(d,fields);d.append(s,fields);
        }
      });
      let sum=form.querySelector('.optionc-batch-summary');
      if(!sum){sum=document.createElement('div');sum.className='optionc-batch-summary';sum.innerHTML='<div><span>Tag items</span><b data-count>0</b></div><div><span>Total net weight</span><b data-weight>0.000 g</b></div>';rows.insertAdjacentElement('afterend',sum)}
    }
    const firstPanel=app.querySelector('.rc-screen.rc-standalone .rc-content>.panel'),section=firstPanel?.querySelector('.rc-section-title');
    if(section&&!firstPanel.querySelector('.optionc-quick-actions')){
      const actions=document.createElement('div');actions.className='optionc-quick-actions';
      const add=(label,cls,icon,fn)=>{const b=make('button',cls,label);b.type='button';b.insertAdjacentText('afterbegin',icon+' ');b.onclick=fn;actions.append(b)};
      add('New Batch','new-batch','▱',()=>{if(window.rbCanLeave?.()===false)return;form.querySelector('.rc-tag-actions button:last-child')?.click()});
      add('Scan Tag','scan-shortcut','▥',()=>{const b=form.querySelector('#rcTagRows .rc-scan-wrap button');if(b)b.click()});
      add('Add Product','add-product','◇',()=>window.rcOpenStandalone?.('Products'));
      section.insertAdjacentElement('afterend',actions);
    }
    const sticky=document.createElement('div');sticky.className='optionc-bottom-actions';
    const cam=make('button','camera','▣  Camera Scan');cam.type='button';cam.onclick=()=>{const b=form.querySelector('#rcTagRows .rc-scan-wrap button');if(b)b.click()};
    const save=make('button','primary','＋ Save Tagging');save.type='button';save.onclick=()=>form.requestSubmit();sticky.append(cam,save);document.body.append(sticky);
    syncSummaries(form);
  }
  let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})};
  const observer=new MutationObserver(schedule);if(app)observer.observe(app,{childList:true,subtree:true});
  document.addEventListener('input',e=>{const f=e.target.closest?.('#rcTagBatchForm');if(f)syncSummaries(f)});
  document.addEventListener('change',e=>{const f=e.target.closest?.('#rcTagBatchForm');if(f)syncSummaries(f)});
  window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);
  setInterval(()=>{if(document.body.classList.contains('optionc-tagging')){const f=app?.querySelector('#rcTagBatchForm');if(f)syncSummaries(f)}},1200);
  const previousHistory=window.updateHistoryView;
  if(typeof previousHistory==='function'&&!previousHistory.__optionC){
    const updated=function(){let html=previousHistory.apply(this,arguments);const note='<article class="release-note"><h3>v2.10.16 · 9 Nov 2026 · Current</h3><ul><li>Mobile pages now use the selected Option C app layout with section cards, expandable Tagging details, camera scan shortcuts and stacked item cards.</li><li>Desktop layouts and saved Retail records are unchanged.</li></ul></article>';return /<h2[^>]*>Update history</h2>/i.test(html)?html.replace(/(<h2[^>]*>Update history</h2>)/i,'$1'+note):note+html};updated.__optionC=true;window.updateHistoryView=updated;
  }
  enhance();
})();
