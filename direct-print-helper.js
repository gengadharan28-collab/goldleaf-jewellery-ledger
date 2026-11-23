(function(){
  'use strict';
  const HELPER='http://127.0.0.1:17655';
  const THERMAL=new Set(['thermal-80','thermal-estimate-80','thermal-estimate-grid-80']);
  let lastPrintAt=0;

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
      +'html{margin:0!important;padding:0!important;width:64mm!important;background:#fff!important;}body{margin:0!important;padding:2mm 0!important;width:64mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;}'
      +PDF_DOCUMENT_CSS
      +'.gl-pdf-thermal,.pdf-thermal-ticket,.pdf-thermal-estimate-grid-80{display:block!important;position:relative!important;margin:0 auto!important;width:62mm!important;max-width:62mm!important;height:auto!important;padding:1mm!important;border:1.5px solid #000!important;box-sizing:border-box!important;box-shadow:none!important;background:#fff!important;color:#000!important;}'
      +'</style></head><body>'+pdfDocument(model,cfg,template)+'</body></html>');
    doc.close();
    try{
      await doc.fonts?.ready;
      await Promise.all(Array.from(doc.images||[]).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})));
      const receipt=doc.querySelector('.pdf-thermal-estimate-grid-80,.pdf-thermal-ticket,.gl-pdf-thermal,.gl-pdf')||doc.body;
      const receiptHeight=Math.max(receipt.getBoundingClientRect().height,receipt.scrollHeight);
      frame.style.height=Math.ceil(receiptHeight+(4*96/25.4)+2)+'px';
      const canvas=await window.html2canvas(doc.body,{scale:3,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,logging:false,width:Math.ceil(64*96/25.4),height:Math.ceil(receiptHeight+(4*96/25.4))});
      return canvas.toDataURL('image/png');
    }finally{
      frame.remove();
    }
  }
  async function directPrint(model,mode,template){
    if(!THERMAL.has(template)) return false;
    const now=Date.now();
    if(now-lastPrintAt<4000) return true;
    lastPrintAt=now;
    const targetName='GoldleafCitizenPrintBridge';
    let bridge=document.getElementById('goldleafCitizenPrintBridge');
    if(!bridge){
      bridge=document.createElement('iframe');
      bridge.id='goldleafCitizenPrintBridge';
      bridge.name=targetName;
      bridge.setAttribute('aria-hidden','true');
      bridge.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;visibility:hidden;';
      document.body.appendChild(bridge);
    }
    try{
      notify('Sending receipt to Citizen printer…');
      const imageDataUrl=await renderReceipt(model,mode,template);
      const form=document.createElement('form');
      form.method='POST';
      form.action=HELPER+'/print-form';
      form.target=targetName;
      form.style.display='none';
      const fields={printer:'CITIZEN CT-D150',imageDataUrl,widthMm:'64',cut:'true'};
      Object.entries(fields).forEach(([name,value])=>{
        const input=document.createElement('input');
        input.type='hidden';input.name=name;input.value=value;form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      setTimeout(()=>form.remove(),1000);
      notify('Receipt sent to Citizen printer');
      return true;
    }catch(err){
      lastPrintAt=0;
      throw err;
    }
  }
  // pdf-templates.js owns the single print entry point. Wrapping the global
  // function here can dispatch the Citizen job and Chrome's 279 mm dialog.
  window.goldleafDirectPrint={health:helperReady,print:directPrint,helperUrl:HELPER};
})();
