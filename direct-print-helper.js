(function(){
  'use strict';
  const HELPER='http://127.0.0.1:17655';
  const THERMAL=new Set(['thermal-80','thermal-estimate-80','thermal-estimate-grid-80','thermal-58','thermal-estimate-58']);
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
    for(let i=0;i<pixels.length;i+=4){
      const luminance=(299*pixels[i]+587*pixels[i+1]+114*pixels[i+2])/1000;
      const val=luminance<170?0:255;
      pixels[i]=pixels[i+1]=pixels[i+2]=val;
      pixels[i+3]=255;
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
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:72mm;height:10px;border:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>'
      +'html{margin:0!important;padding:0!important;width:72mm!important;background:#fff!important;}body{margin:0!important;padding:0!important;width:72mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;overflow:hidden!important;}'
      +PDF_DOCUMENT_CSS
      +'.gl-pdf-thermal,.pdf-thermal-ticket,.pdf-thermal-estimate-grid-80{display:block!important;position:relative!important;margin:0!important;width:72mm!important;max-width:72mm!important;height:auto!important;padding:0!important;border:'+(sharpEstimate?'0':'2px solid #000')+'!important;box-sizing:border-box!important;box-shadow:none!important;background:#fff!important;color:#000!important;overflow:hidden!important;}'
      +'.gl-pdf,.gl-pdf *{color:#000!important;-webkit-text-fill-color:#000!important;-webkit-text-stroke:0!important;font-weight:400!important;text-rendering:geometricPrecision!important}'
      +'.grid80-top,.grid80-product-total,.grid80-summary-row.grid80-highlight,.est-plain-head,.est-plain-highlight,.thermal-items-head,.thermal-total-highlight{border-top-width:1.5px!important;border-bottom-width:1.5px!important;border-color:#000!important}'
      +'.grid80-meta,.grid80-plain-item,.grid80-sec-label,.est-plain-item,.est-plain-section{border-color:#000!important;border-width:1px!important}'
      +(sharpEstimate?'.gl-pdf,.gl-pdf *,.gl-pdf b,.gl-pdf strong,.gl-pdf th,.gl-pdf td,.gl-pdf h1,.gl-pdf h2,.gl-pdf h3,.gl-pdf small,.gl-pdf span{font-family:monospace!important;font-variant-numeric:tabular-nums!important;color:#000!important;-webkit-text-fill-color:#000!important;font-weight:400!important;-webkit-text-stroke:0!important;text-shadow:none!important;text-rendering:geometricPrecision!important;background-color:transparent!important}.gl-pdf{background-color:#fff!important}':'')
      +'</style></head><body>'+pdfDocument(model,cfg,template)+'</body></html>');
    doc.close();
    try{
      await doc.fonts?.ready;
      await Promise.all(Array.from(doc.images||[]).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})));
      const receipt=doc.querySelector('.pdf-thermal-estimate-grid-80,.pdf-thermal-ticket,.gl-pdf-thermal,.gl-pdf')||doc.body;
      const receiptHeight=Math.max(receipt.getBoundingClientRect().height,receipt.scrollHeight);
      frame.style.height=Math.ceil(receiptHeight+2)+'px';
      const canvas=await window.html2canvas(doc.body,{scale:3,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,logging:false,width:Math.ceil(72*96/25.4),height:Math.ceil(receiptHeight+2)});
      sharpenThermalEstimate(canvas);
      return canvas.toDataURL('image/png');
    }finally{
      frame.remove();
    }
  }
  async function sendToLocalHelper(printer,imageDataUrl,widthMm){
    const res=await fetch(HELPER+'/print',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({printer:printer||'CITIZEN CT-D150',imageDataUrl,widthMm:widthMm||80,cut:true})
    });
    const body=await res.text();
    if(!res.ok) throw new Error(body||'Citizen helper rejected the print job');
    let result={};
    try{result=JSON.parse(body||'{}');}catch(_){}
    if(result.ok===false) throw new Error(result.error||'Citizen print failed');
    return true;
  }
  async function queueRemotePrint(imageDataUrl){
    const shopId=(typeof goldleafContext!=='undefined'?goldleafContext?.shop_id:window.goldleafContext?.shop_id)||(typeof session!=='undefined'?session?.user?.id:null);
    if(typeof client==='undefined'||!client||typeof session==='undefined'||!session||!shopId){
      throw new Error('Sign in to send print jobs to your Laptop Print Station.');
    }
    const {error}=await client.from('goldleaf_print_jobs').insert({
      shop_id:shopId,
      printer:'CITIZEN CT-D150',
      image_data_url:imageDataUrl,
      width_mm:80,
      status:'pending'
    });
    if(error) throw new Error(error.message||'Could not queue remote print job.');
    return true;
  }
  async function directPrint(model,mode,template){
    if(!THERMAL.has(template)) return false;
    const now=Date.now();
    if(now-lastPrintAt<4000) return true;
    lastPrintAt=now;
    const cfg=typeof pdfConfig==='function'?pdfConfig(mode):{};
    try{
      const localUp=await helperReady();
      if(localUp){
        notify('Sending receipt to Citizen printer…');
        const imageDataUrl=await renderReceipt(model,mode,template);
        await sendToLocalHelper('CITIZEN CT-D150',imageDataUrl,80);
        notify('Printed successfully');
        return true;
      }
      if(cfg.remotePrintFromMobile){
        notify('Sending receipt to Laptop Citizen printer…');
        const imageDataUrl=await renderReceipt(model,mode,template);
        await queueRemotePrint(imageDataUrl);
        notify('Sent to Laptop Citizen Print Station!');
        return true;
      }
      notify('Sending receipt to Citizen printer…');
      const imageDataUrl=await renderReceipt(model,mode,template);
      await sendToLocalHelper('CITIZEN CT-D150',imageDataUrl,80);
      notify('Printed successfully');
      return true;
    }catch(err){
      lastPrintAt=0;
      throw err;
    }
  }
  let stationBusy=false;
  async function pollRemotePrintJobs(manual){
    if(stationBusy) return;
    const cfgR=typeof pdfConfig==='function'?pdfConfig('retail'):{};
    const cfgW=typeof pdfConfig==='function'?pdfConfig('wholesale'):{};
    const enabled=!!(cfgR.remotePrintStation||cfgW.remotePrintStation||cfgR.remotePrintFromMobile||cfgW.remotePrintFromMobile);
    if(!enabled&&!manual) return;
    const shopId=(typeof goldleafContext!=='undefined'?goldleafContext?.shop_id:window.goldleafContext?.shop_id)||(typeof session!=='undefined'?session?.user?.id:null);
    if(typeof client==='undefined'||!client||typeof session==='undefined'||!session||!shopId){
      if(manual) notify('Sign in to check mobile print queue.');
      return;
    }
    stationBusy=true;
    try{
      if(!(await helperReady())){
        if(manual) notify('Citizen print helper is not running on this laptop.');
        return;
      }
      const {data,error}=await client.from('goldleaf_print_jobs')
        .select('id,printer,image_data_url,width_mm')
        .eq('shop_id',shopId)
        .eq('status','pending')
        .order('created_at',{ascending:true})
        .limit(5);
      if(error){
        if(manual) notify('Print queue error: '+error.message,'error');
        return;
      }
      if(!Array.isArray(data)||!data.length){
        if(manual) notify('No pending mobile print jobs.');
        return;
      }
      for(const job of data){
        try{
          await sendToLocalHelper(job.printer||'CITIZEN CT-D150',job.image_data_url,job.width_mm||80);
          await client.from('goldleaf_print_jobs').update({status:'printed',printed_at:new Date().toISOString()}).eq('id',job.id);
          notify('Printed mobile job on Citizen CT-D150');
        }catch(jobErr){
          await client.from('goldleaf_print_jobs').update({status:'error',error_message:String(jobErr?.message||jobErr)}).eq('id',job.id);
          notify('Laptop print error: '+String(jobErr?.message||jobErr),'error');
        }
      }
    }catch(_){}
    finally{stationBusy=false;}
  }
  setInterval(()=>pollRemotePrintJobs(false),3000);
  window.addEventListener('load',()=>setTimeout(()=>pollRemotePrintJobs(false),1500));
  window.addEventListener('goldleaf-v2-ready',()=>setTimeout(()=>pollRemotePrintJobs(false),800));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollRemotePrintJobs(false);});
  // pdf-templates.js owns the single print entry point. Wrapping the global
  // function here can dispatch the Citizen job and Chrome's 279 mm dialog.
  window.goldleafDirectPrint={health:helperReady,print:directPrint,pollRemote:pollRemotePrintJobs,helperUrl:HELPER};
})();
