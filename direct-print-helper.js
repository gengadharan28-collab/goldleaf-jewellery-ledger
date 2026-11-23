(function(){
  'use strict';
  const HELPER='http://127.0.0.1:17655';
  const THERMAL=new Set(['thermal-80','thermal-estimate-80','thermal-estimate-grid-80']);
  let patchTimer=0;

  function notify(message,type){
    if(typeof window.say==='function') window.say(message,type);
  }
  async function helperReady(){
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),650);
    try{
      const res=await fetch(HELPER+'/health',{cache:'no-store',signal:ctl.signal});
      return res.ok;
    }catch(_){return false;}finally{clearTimeout(timer);}
  }
  async function ensureRasterizer(){
    if(window.html2canvas) return true;
    if(!window.html2pdf){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
        s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
      }).catch(()=>null);
    }
    return !!window.html2canvas;
  }
  async function renderReceipt(model,mode,template){
    if(!(await ensureRasterizer())) throw new Error('Receipt renderer unavailable');
    const cfg=pdfConfig(mode);
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:64mm;height:10px;border:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>'
      +'html,body{margin:0!important;padding:0!important;width:64mm!important;background:#fff!important;color:#000!important;}'
      +PDF_DOCUMENT_CSS
      +'.gl-pdf-thermal,.pdf-thermal-ticket,.pdf-thermal-estimate-grid-80{display:block!important;position:relative!important;margin:0 auto!important;width:62mm!important;max-width:62mm!important;height:auto!important;padding:1mm!important;border:1.5px solid #000!important;box-sizing:border-box!important;box-shadow:none!important;background:#fff!important;color:#000!important;}'
      +'</style></head><body>'+pdfDocument(model,cfg,template)+'</body></html>');
    doc.close();
    try{
      await doc.fonts?.ready;
      await Promise.all(Array.from(doc.images||[]).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})));
      const target=doc.querySelector('.pdf-thermal-estimate-grid-80,.pdf-thermal-ticket,.gl-pdf-thermal,.gl-pdf')||doc.body;
      const rect=target.getBoundingClientRect();
      frame.style.height=Math.ceil(Math.max(rect.height,target.scrollHeight,doc.body.scrollHeight)+2)+'px';
      const canvas=await window.html2canvas(target,{scale:3,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,logging:false});
      return canvas.toDataURL('image/png');
    }finally{
      frame.remove();
    }
  }
  async function directPrint(model,mode,template){
    if(!THERMAL.has(template)) return false;
    if(!(await helperReady())) return false;
    notify('Sending receipt to Citizen printer…');
    const imageDataUrl=await renderReceipt(model,mode,template);
    const res=await fetch(HELPER+'/print',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({printer:'CITIZEN CT-D150',imageDataUrl,widthMm:64,cut:true})
    });
    if(!res.ok) throw new Error((await res.text())||'Direct print failed');
    notify('Printed successfully');
    return true;
  }
  function patch(){
    if(typeof window.pdfTriggerPrint!=='function') return false;
    if(window.pdfTriggerPrint.__goldleafDirect) return true;
    const original=window.pdfTriggerPrint;
    const wrapped=async function(model,mode,forcedTemplate=null,allowMissingGst=false){
      const cfg=pdfConfig(mode);
      const isEstimate=model.kind==='estimate'||String(model.title||'').includes('ESTIMATION')||String(model.title||'').includes('QUOTATION');
      const template=forcedTemplate||(isEstimate?(cfg.estimateTemplate||'detailed-estimate'):(cfg.template||'classic'));
      try{
        if(await directPrint(model,mode,template)) return;
      }catch(err){
        console.warn('Goldleaf direct print fallback',err);
        notify('Direct printer unavailable — opening normal print preview.');
      }
      return original.call(this,model,mode,forcedTemplate,allowMissingGst);
    };
    wrapped.__goldleafDirect=true;
    window.pdfTriggerPrint=wrapped;
    return true;
  }
  if(!patch()) patchTimer=setInterval(()=>{if(patch())clearInterval(patchTimer);},100);
  window.goldleafDirectPrint={health:helperReady,print:directPrint,helperUrl:HELPER};
})();