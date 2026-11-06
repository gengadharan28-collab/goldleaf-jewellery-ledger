// Shared ERP presentation and reliable Retail entry dialogs.
const erpThemeLink=document.createElement('link');erpThemeLink.rel='stylesheet';erpThemeLink.href='./erp-theme.css?v=2.5.0-r1';document.head.append(erpThemeLink);
window.toggleTheme=function(){appTheme=appTheme==='dark'?'light':'dark';document.documentElement.dataset.theme=appTheme;localStorage.setItem('goldleaf-theme',appTheme);document.querySelectorAll('[onclick="toggleTheme()"]') .forEach(button=>{button.textContent=appTheme==='dark'?'☀'+(button.closest('.retail-sale-tools')?'':' Light'):'☾'+(button.closest('.retail-sale-tools')?'':' Dark');button.setAttribute('aria-label',appTheme==='dark'?'Switch to light theme':'Switch to dark theme');});};
function erpMarkEntryDirty(form=document.getElementById('customerSaleForm')){if(form?.dataset)form.dataset.entryDirty='1';}
for(const eventName of ['input','change'])document.addEventListener(eventName,event=>{const form=event.target.closest?.('#customerSaleForm');if(form)erpMarkEntryDirty(form);},true);
const erpPreviousEditCheck=window.v2HasFocusedEdit;
window.v2HasFocusedEdit=function(){return erpPreviousEditCheck()||document.body.classList.contains('retail-entry-dialog-open')||!!document.querySelector('#customerSaleForm[data-entry-dirty="1"]');};
function erpRefreshDialogState(){const open=!!document.querySelector('#oldGoldPanel:not(.hidden),#retailGSTPanel:not(.hidden)');document.body.classList.toggle('retail-entry-dialog-open',open);return open;}
function erpSetEntryDialog(id,force,buttonId){
  const panel=document.getElementById(id),button=document.getElementById(buttonId);if(!panel)return;
  const open=typeof force==='boolean'?force:panel.classList.contains('hidden');
  if(open)for(const otherId of ['oldGoldPanel','retailGSTPanel'])if(otherId!==id){const other=document.getElementById(otherId);other?.classList.add('hidden');other?.setAttribute('aria-hidden','true');const otherButton=document.getElementById(otherId==='oldGoldPanel'?'oldGoldToggle':'retailGSTToggle');otherButton?.setAttribute('aria-expanded','false');if(otherId==='oldGoldPanel'&&otherButton)otherButton.textContent='＋ Old Gold Exchange';}
  panel.classList.toggle('hidden',!open);panel.setAttribute('aria-hidden',String(!open));button?.setAttribute('aria-expanded',String(open));erpRefreshDialogState();
  if(id==='oldGoldPanel'&&button)button.textContent=open?'− Close exchange':'＋ Old Gold Exchange';
  if(open){const focus=id==='retailGSTPanel'?panel.querySelector('[name="gstEnabled"]'):panel.querySelector('input:not([type="hidden"]),select');focus?.focus({preventScroll:true});}
  else{button?.focus({preventScroll:true});requestAnimationFrame(()=>{if(!erpRefreshDialogState()&&page==='Sales Entry'&&workspaceMode==='retail')fitRetailSaleScreen();});}
}
window.toggleOldGold=function(force){erpSetEntryDialog('oldGoldPanel',force,'oldGoldToggle');};
window.toggleRetailGST=function(force){erpSetEntryDialog('retailGSTPanel',force,'retailGSTToggle');};
window.erpSyncGSTButton=function(form=document.getElementById('customerSaleForm')){const button=document.getElementById('retailGSTToggle');if(!button||!form)return;const enabled=!!form.elements.gstEnabled?.checked,rate=n(form.elements.gstRate?.value);button.textContent=enabled?'GST '+rate+'%':'＋ Add GST';button.classList.toggle('is-enabled',enabled);};
window.removeRetailGST=function(){const form=document.getElementById('customerSaleForm');if(!form?.elements.gstEnabled)return;form.elements.gstEnabled.checked=false;erpMarkEntryDirty(form);calcSale(form);toggleRetailGST(false);};
window.finishRetailGST=function(){const form=document.getElementById('customerSaleForm');if(!form)return;const gst=pdfGSTInputs(form);if(gst.gstEnabled&&(gst.gstRate<=0||gst.gstRate>100)){say('Enter a GST percentage above 0 and up to 100, or remove GST.');form.elements.gstRate?.focus();return;}calcSale(form);toggleRetailGST(false);};
const erpPreviousAddExchange=window.addExchangeLine,erpPreviousRemoveExchange=window.removeExchangeLine;
window.addExchangeLine=function(){erpMarkEntryDirty();return erpPreviousAddExchange();};
window.removeExchangeLine=function(button){erpMarkEntryDirty(button?.closest('form'));return erpPreviousRemoveExchange(button);};
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(document.querySelector('#retailGSTPanel:not(.hidden)')){event.preventDefault();toggleRetailGST(false);}else if(document.querySelector('#oldGoldPanel:not(.hidden)')){event.preventDefault();toggleOldGold(false);}});
const erpPreviousReminder=window.checkRateReminder;
window.checkRateReminder=function(){if(document.body.classList.contains('retail-entry-dialog-open')||document.getElementById('pdfTemplatePreview'))return;return erpPreviousReminder();};
function erpDecorate(){document.body.dataset.erp='true';const brand=document.querySelector('.brand');if(brand&&!brand.querySelector('.erp-brand-mark'))brand.innerHTML='<span class="erp-brand-mark" aria-hidden="true">G</span><span>Goldleaf<small>JEWELLERY ERP</small></span>';erpRefreshDialogState();erpSyncGSTButton();}
const erpPreviousRender=window.render;
window.render=function(){const result=erpPreviousRender();erpDecorate();return result;};
erpThemeLink.addEventListener('load',()=>{if(page==='Sales Entry'&&workspaceMode==='retail'&&!erpRefreshDialogState())requestAnimationFrame(fitRetailSaleScreen);});
const erpHistoryBase=window.updateHistoryView;
window.updateHistoryView=function(){return erpHistoryBase().replace('Goldleaf v2.4.0','Goldleaf v2.5.0').replace('v2.4.4 · 6 Nov 2026 · Current','v2.4.4 · 6 Nov 2026').replace('<h2>Update history</h2>','<h2>Update history</h2><article class="release-note"><h3>v2.5.0 · 6 Nov 2026 · Current</h3><ul><li>Applied a shared ERP theme to Retail, Wholesale, Super Admin, registers, reports and Settings, with light and dark palettes.</li><li>Changed optional GST to a compact button and dialog beside Old Gold Exchange.</li><li>Kept exchange and GST dialogs attached to the viewport, and protected unsaved invoice entries from background refresh.</li></ul></article>');};
render();
