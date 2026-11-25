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
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-goldleaf-html2canvas]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');
      s.src='./html2canvas.min.js?v=1.4.1';
      s.dataset.goldleafHtml2canvas='1';
      s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    }).catch(()=>null);
    return !!window.html2canvas;
  }
  function sharpenThermalEstimate(canvas){
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return;
    const w=canvas.width,h=canvas.height;
    const image=context.getImageData(0,0,w,h);
    const pixels=image.data;
    const mask=new Uint8Array(w*h);
    for(let i=0,p=0;i<pixels.length;i+=4,p++){
      const luminance=(299*pixels[i]+587*pixels[i+1]+114*pixels[i+2])/1000;
      mask[p]=luminance<238?1:0;
    }
    // 1-subpixel horizontal reinforcement at scale:3 so thin monospace strokes stay pitch-black after printer downscaling
    for(let y=0;y<h;y++){
      const row=y*w;
      for(let x=0;x<w;x++){
        const dark=mask[row+x]||(x>0&&mask[row+x-1]&&!(x+1<w&&mask[row+x+1]));
        const val=dark?0:255;
        const idx=(row+x)*4;
        pixels[idx]=pixels[idx+1]=pixels[idx+2]=val;
      }
    }
    context.putImageData(image,0,0);
  }
  async function renderReceipt(model,mode,template){
    if(!(await ensureRasterizer())) throw new Error('Receipt renderer unavailable');
    const cfg=pdfConfig(mode);
    const sharpEstimate=mode==='retail'&&(model.kind==='estimate'||template.startsWith('thermal-estimate-'));
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    // Render a slightly wider white canvas than the receipt.  The CT-D150 raw
    // raster path has a small non-printable edge; this safety gutter prevents
    // the right-most column and amounts from being clipped on paper.
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:80mm;height:10px;border:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>'
      +'html{margin:0!important;padding:0!important;width:80mm!important;background:#fff!important;}body{margin:0!important;padding:2mm 0!important;width:80mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;overflow:hidden!important;}'
      +PDF_DOCUMENT_CSS
      +'.gl-pdf-thermal,.pdf-thermal-ticket,.pdf-thermal-estimate-grid-80{display:block!important;position:relative!important;margin:0 auto!important;width:78mm!important;max-width:78mm!important;height:auto!important;padding:1mm!important;border:1.5px solid #000!important;box-sizing:border-box!important;box-shadow:none!important;background:#fff!important;color:#000!important;overflow:hidden!important;}'
      +'.grid80-items{width:100%!important;max-width:100%!important;table-layout:fixed!important}.grid80-item-total-cell,.grid80-item-total-box,.grid80-product-total,.grid80-summary-row{max-width:100%!important;box-sizing:border-box!important;overflow:hidden!important}.grid80-tot-right{min-width:0!important;max-width:100%!important}.grid80-tot-val{font-size:16px!important;max-width:36mm!important;overflow:visible!important;text-overflow:clip!important;text-align:right!important}.grid80-readable-total,.grid80-product-total,.grid80-summary-row{padding-right:2mm!important}.grid80-product-total b,.grid80-summary-row b{max-width:36mm!important;overflow:visible!important;text-align:right!important}'
      +(sharpEstimate?'.gl-pdf,.gl-pdf *,.gl-pdf b,.gl-pdf strong,.gl-pdf th,.gl-pdf td,.gl-pdf h1,.gl-pdf h2,.gl-pdf h3,.gl-pdf small,.gl-pdf span{font-family:"Consolas","Courier New","Lucida Console",Monaco,monospace!important;font-variant-numeric:tabular-nums!important;color:#000!important;font-weight:500!important;-webkit-text-stroke:0!important;text-shadow:none!important;-webkit-font-smoothing:none!important;text-rendering:geometricPrecision!important}.gl-pdf th,.gl-pdf td,.gl-pdf hr,.gl-pdf [class*="grid80-"]{border-color:#000!important;background-color:#fff!important}':'')
      +'</style></head><body>'+pdfDocument(model,cfg,template)+'</body></html>');
    doc.close();
    try{
      await doc.fonts?.ready;
      await Promise.all(Array.from(doc.images||[]).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})));
      const receipt=doc.querySelector('.pdf-thermal-estimate-grid-80,.pdf-thermal-ticket,.gl-pdf-thermal,.gl-pdf')||doc.body;
      const receiptHeight=Math.max(receipt.getBoundingClientRect().height,receipt.scrollHeight);
      frame.style.height=Math.ceil(receiptHeight+(4*96/25.4)+2)+'px';
      const canvas=await window.html2canvas(doc.body,{scale:3,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,logging:false,width:Math.ceil(80*96/25.4),height:Math.ceil(receiptHeight+(4*96/25.4))});
      if(sharpEstimate)sharpenThermalEstimate(canvas);
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
    try{
      notify('Sending receipt to Citizen printer…');
      const imageDataUrl=await renderReceipt(model,mode,template);
      const res=await fetch(HELPER+'/print',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        cache:'no-store',
        body:JSON.stringify({printer:'CITIZEN CT-D150',imageDataUrl,widthMm:64,cut:true})
      });
      const body=await res.text();
      if(!res.ok) throw new Error(body||'Citizen helper rejected the print job');
      let result={};
      try{result=JSON.parse(body||'{}');}catch(_){}
      if(result.ok===false) throw new Error(result.error||'Citizen print failed');
      notify('Printed successfully');
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
