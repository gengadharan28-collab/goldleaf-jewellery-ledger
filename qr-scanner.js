/**
 * Goldleaf Jewellery ERP - Authentic Google Pay Full-Screen QR & Barcode Scanner
 * Uses Direct 1080p Full-HD Stream + Native BarcodeDetector (ML Kit) + ZXing Multi-Scale Macro Decoder
 * Features Google Pay 4-color rounded viewfinder, automatic small-QR zoom, and "Upload from gallery" pill.
 */

(function(){
  'use strict';

  // Universal Scanner SVG Icon
  window.glScanIconSvg = '<svg class="gl-scan-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">'
    + '<path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/>'
    + '</svg>';

  function playScanBeep(){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.055);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch(e){}
    if (navigator.vibrate) {
      try { navigator.vibrate([35, 20, 45]); } catch(e){}
    }
  }

  let activeStream = null;
  let activeVideoTrack = null;
  let activeVideoEl = null;
  let zxingHelper = null;
  let nativeDetector = null;
  let currentFacingMode = 'environment';
  let currentZoom = 1.0;
  let autoZoomEnabled = true;
  let hwZoomMin = 1.0;
  let hwZoomMax = 1.0;
  let hwZoomSupported = false;
  let scanLoopTimer = null;
  let autoZoomTimer = null;
  let scanResolved = false;

  let macroCanvas = null;
  let macroCtx = null;
  let spotterCanvas = null;
  let spotterCtx = null;

  function ensureDecoders(){
    if (!macroCanvas) {
      macroCanvas = document.createElement('canvas');
      macroCanvas.width = 720;
      macroCanvas.height = 720;
      macroCtx = macroCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!spotterCanvas) {
      spotterCanvas = document.createElement('canvas');
      spotterCanvas.width = 96;
      spotterCanvas.height = 96;
      spotterCtx = spotterCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!nativeDetector && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf', 'data_matrix']
        });
      } catch(e){}
    }
    if (!zxingHelper && window.Html5Qrcode) {
      try {
        let hiddenHost = document.getElementById('glQrHiddenZxingHost');
        if (!hiddenHost) {
          hiddenHost = document.createElement('div');
          hiddenHost.id = 'glQrHiddenZxingHost';
          hiddenHost.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:10px;height:10px;overflow:hidden;pointer-events:none;opacity:0';
          document.body.appendChild(hiddenHost);
        }
        zxingHelper = new window.Html5Qrcode('glQrHiddenZxingHost', { verbose: false });
      } catch(e){}
    }
  }

  function clamp(val, min, max){
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Open the Authentic Google Pay Full-Screen QR & Barcode Scanner
   * @param {Object|Function} opts - { onScan: (code) => {}, title: '...' } or callback
   */
  window.openQrScanner = function(opts){
    if (typeof opts === 'function') {
      opts = { onScan: opts };
    } else {
      opts = opts || {};
    }
    const onScan = opts.onScan || function(code){ console.log('Scanned:', code); };
    const title = opts.title || 'Scan any QR code or tag';

    closeQrScanner();
    scanResolved = false;
    autoZoomEnabled = true;
    currentZoom = 1.0;
    ensureDecoders();

    const modal = document.createElement('div');
    modal.id = 'glQrScannerModal';
    modal.className = 'gl-qr-modal-backdrop gl-gpay-screen';
    modal.innerHTML = ''
      + '<div class="gl-gpay-container" role="dialog" aria-modal="true" aria-label="' + title + '">'
      + '  <video id="glGpayVideo" class="gl-gpay-video" autoplay playsinline muted></video>'
      + '  <div class="gl-gpay-scrim">'
      + '    <header class="gl-gpay-topbar">'
      + '      <button type="button" class="gl-gpay-topbtn" id="glQrCloseBtn" aria-label="Close scanner">'
      + '        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      + '      </button>'
      + '      <div class="gl-gpay-topactions">'
      + '        <button type="button" class="gl-gpay-topbtn" id="glQrTorchBtn" title="Toggle Flashlight" aria-label="Toggle Flashlight">'
      + '          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12v4z"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg>'
      + '        </button>'
      + '        <button type="button" class="gl-gpay-topbtn" id="glQrFlipBtn" title="Switch Camera" aria-label="Switch Camera">'
      + '          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>'
      + '        </button>'
      + '      </div>'
      + '    </header>'
      + '    <div class="gl-gpay-center-stage" id="glQrViewport">'
      + '      <div class="gl-gpay-status-chip" id="glQrStatusPill">'
      + '        <span class="gl-gpay-status-dot"></span>'
      + '        <span id="glQrStatusText">Auto-zoom active • Ready for small QR</span>'
      + '      </div>'
      + '      <div class="gl-gpay-cutout" id="glQrReticle">'
      + '        <span class="gl-gpay-corner c-blue"></span>'
      + '        <span class="gl-gpay-corner c-red"></span>'
      + '        <span class="gl-gpay-corner c-yellow"></span>'
      + '        <span class="gl-gpay-corner c-green"></span>'
      + '      </div>'
      + '      <div class="gl-qr-focus-ring" id="glQrFocusRing" style="display:none"></div>'
      + '      <div class="gl-gpay-zoom-bar" role="group" aria-label="Zoom controls">'
      + '        <button type="button" class="gl-qr-zpill" data-zoom="1">1x</button>'
      + '        <button type="button" class="gl-qr-zpill active" data-zoom="2">2x</button>'
      + '        <button type="button" class="gl-qr-zpill" data-zoom="3">3x</button>'
      + '        <button type="button" class="gl-qr-zpill" data-zoom="4">4x</button>'
      + '        <button type="button" class="gl-qr-zpill is-auto" id="glQrAutoToggleBtn" data-zoom="auto">Auto <b id="glQrZoomReadout">2.0x</b></button>'
      + '      </div>'
      + '      <button type="button" class="gl-gpay-gallery-btn" id="glQrUploadBtn">'
      + '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
      + '        <span>Upload from gallery</span>'
      + '      </button>'
      + '      <input type="file" id="glQrFileInput" accept="image/*" style="display:none">'
      + '    </div>'
      + '    <footer class="gl-gpay-bottom-sheet">'
      + '      <div class="gl-gpay-sheet-handle"></div>'
      + '      <h4>' + title + '</h4>'
      + '      <p>Hold your phone steady • Camera automatically zooms in on small jewellery tag QR codes</p>'
      + '    </footer>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('glQrCloseBtn');
    if (closeBtn) closeBtn.onclick = closeQrScanner;

    const handleSuccess = function(decodedText){
      if (scanResolved || !decodedText) return;
      const clean = String(decodedText).trim();
      if (!clean) return;
      scanResolved = true;

      const reticle = document.getElementById('glQrReticle');
      if (reticle) reticle.classList.add('is-locked');
      updateStatus('✓ Scanned: ' + clean, true);

      playScanBeep();
      setTimeout(function(){
        closeQrScanner();
        try {
          onScan(clean);
        } catch(err){
          console.error('Error in onScan callback:', err);
        }
      }, 150);
    };

    bindGpayControls(handleSuccess);
    startDirectGpayCamera(currentFacingMode, handleSuccess);
  };

  function updateStatus(text, locked){
    const el = document.getElementById('glQrStatusText');
    const pill = document.getElementById('glQrStatusPill');
    if (el) el.textContent = text;
    if (pill) pill.classList.toggle('is-locked', !!locked);
  }

  /**
   * Apply Hybrid Hardware + Optical/Sensor Zoom (1.0x to 5.0x)
   */
  function applyScannerZoom(zoomLevel, isManual){
    const z = clamp(Number(zoomLevel) || 1.0, 1.0, 5.0);
    currentZoom = Math.round(z * 10) / 10;

    if (isManual) {
      autoZoomEnabled = false;
      updateStatus('Zoom ' + currentZoom.toFixed(1) + 'x locked', false);
    }

    const readout = document.getElementById('glQrZoomReadout');
    if (readout) readout.textContent = currentZoom.toFixed(1) + 'x';

    document.querySelectorAll('.gl-qr-zpill[data-zoom]').forEach(function(btn){
      const bz = btn.getAttribute('data-zoom');
      if (bz === 'auto') {
        btn.classList.toggle('is-auto', autoZoomEnabled);
        btn.classList.toggle('active', autoZoomEnabled);
      } else {
        btn.classList.toggle('active', Math.abs(Number(bz) - currentZoom) < 0.35);
      }
    });

    // 1. Hardware camera zoom (both top-level and advanced constraint formats for Android/iOS compatibility)
    let appliedHw = 1.0;
    if (hwZoomSupported && activeVideoTrack) {
      appliedHw = clamp(currentZoom, hwZoomMin, hwZoomMax);
      try {
        activeVideoTrack.applyConstraints({
          advanced: [{ zoom: appliedHw }]
        }).catch(function(){
          try { activeVideoTrack.applyConstraints({ zoom: appliedHw }).catch(function(){}); } catch(e){}
        });
      } catch(e){}
    }

    // 2. Smooth residual optical scale on full-screen <video>
    const residualScale = clamp(currentZoom / appliedHw, 1.0, 5.0);
    if (activeVideoEl) {
      activeVideoEl.style.transformOrigin = 'center center';
      activeVideoEl.style.transition = isManual ? 'transform 0.14s ease-out' : 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
      activeVideoEl.style.transform = residualScale > 1.01 ? ('scale(' + residualScale.toFixed(2) + ')') : 'scale(1)';
    }

    // 3. Google Pay 4-color frame contract/breathe feedback
    const reticle = document.getElementById('glQrReticle');
    if (reticle) {
      reticle.classList.add('is-zooming');
      clearTimeout(reticle._zTimer);
      reticle._zTimer = setTimeout(function(){
        reticle.classList.remove('is-zooming');
      }, 320);
    }
  }

  window.glSetScannerZoom = function(z){
    applyScannerZoom(z, true);
  };

  function bindGpayControls(handleSuccess){
    // Zoom pill buttons
    document.querySelectorAll('.gl-qr-zpill').forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        const zAttr = btn.getAttribute('data-zoom');
        if (zAttr === 'auto') {
          autoZoomEnabled = true;
          const nextZ = currentZoom < 2.0 ? 2.2 : currentZoom;
          applyScannerZoom(nextZ, false);
          updateStatus('Auto-zoom (' + currentZoom.toFixed(1) + 'x) • Scanning small QR', false);
        } else {
          applyScannerZoom(parseFloat(zAttr), true);
        }
      };
    });

    // Gallery upload button
    const uploadBtn = document.getElementById('glQrUploadBtn');
    const fileInput = document.getElementById('glQrFileInput');
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = function(){ fileInput.click(); };
      fileInput.onchange = function(e){
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        scanUploadedFileMacro(file, handleSuccess);
      };
    }

    // Flip camera button
    const flipBtn = document.getElementById('glQrFlipBtn');
    if (flipBtn) {
      flipBtn.onclick = function(){
        currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
        startDirectGpayCamera(currentFacingMode, handleSuccess);
      };
    }

    // Torch button
    const torchBtn = document.getElementById('glQrTorchBtn');
    if (torchBtn) {
      let torchOn = false;
      torchBtn.onclick = function(){
        torchOn = !torchOn;
        if (activeVideoTrack) {
          try {
            activeVideoTrack.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(function(){});
          } catch(e){}
        }
        torchBtn.classList.toggle('is-active', torchOn);
      };
    }

    // Pinch-to-zoom & Tap-to-focus/zoom on center stage
    const stage = document.getElementById('glQrViewport');
    if (stage) {
      let startDist = 0;
      let startZoom = 1.0;

      stage.addEventListener('touchstart', function(e){
        if (e.touches && e.touches.length === 2) {
          startDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          startZoom = currentZoom;
        }
      }, { passive: true });

      stage.addEventListener('touchmove', function(e){
        if (e.touches && e.touches.length === 2 && startDist > 12) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          applyScannerZoom(startZoom * (dist / startDist), true);
        }
      }, { passive: true });

      stage.addEventListener('click', function(e){
        if (e.target.closest('button')) return;
        const rect = stage.getBoundingClientRect();
        const ring = document.getElementById('glQrFocusRing');
        if (ring) {
          ring.style.left = (e.clientX - rect.left) + 'px';
          ring.style.top = (e.clientY - rect.top) + 'px';
          ring.style.display = 'block';
          ring.classList.remove('animate');
          void ring.offsetWidth;
          ring.classList.add('animate');
          clearTimeout(ring._t);
          ring._t = setTimeout(function(){ ring.style.display = 'none'; }, 700);
        }
        if (activeVideoTrack) {
          try {
            activeVideoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function(){});
          } catch(err){}
        }
        // Step zoom up on tap if currently < 2.6x
        if (currentZoom < 2.6) {
          applyScannerZoom(2.6, false);
          updateStatus('Focused & zoomed to 2.6x', false);
        }
      });
    }
  }

  /**
   * Open Camera Directly in Full HD (1920x1080) like Google Pay
   * Avoids Html5Qrcode's 640x480 VGA lock so tiny QR codes are razor-sharp
   */
  async function startDirectGpayCamera(facing, onSuccess){
    stopEngines();
    const video = document.getElementById('glGpayVideo');
    if (!video) return;
    activeVideoEl = video;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateStatus('Camera not supported • Tap Upload from gallery', false);
      return;
    }

    let stream = null;
    try {
      // Request Full HD 1080p + continuous autofocus from frame 1
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { min: 1280, ideal: 1920, max: 3840 },
          height: { min: 720, ideal: 1080, max: 2160 },
          focusMode: { ideal: 'continuous' }
        },
        audio: false
      });
    } catch(err1) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false
        });
      } catch(err2) {
        updateStatus('Camera permission needed • Or tap Upload from gallery', false);
        return;
      }
    }

    if (scanResolved || !document.getElementById('glQrScannerModal')) {
      stream.getTracks().forEach(function(t){ t.stop(); });
      return;
    }

    activeStream = stream;
    video.srcObject = stream;
    try { await video.play(); } catch(e){}

    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      activeVideoTrack = tracks[0];
      hwZoomSupported = false;
      hwZoomMin = 1.0;
      hwZoomMax = 1.0;

      try {
        const caps = activeVideoTrack.getCapabilities ? activeVideoTrack.getCapabilities() : null;
        if (caps) {
          if (typeof caps.zoom === 'object' && caps.zoom !== null) {
            hwZoomSupported = true;
            hwZoomMin = caps.zoom.min || 1.0;
            hwZoomMax = caps.zoom.max || 5.0;
          } else if (typeof caps.zoom === 'number') {
            hwZoomSupported = true;
            hwZoomMax = caps.zoom;
          }
        }
      } catch(e){}

      try {
        activeVideoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }]
        }).catch(function(){});
      } catch(e){}
    }

    // Google Pay Instant Macro Auto-Zoom (glides from 1.0x -> 2.0x on open for small tags)
    setTimeout(function(){
      if (!scanResolved && autoZoomEnabled) {
        applyScannerZoom(2.0, false);
        updateStatus('Auto-zoom 2.0x • Hold small QR inside frame', false);
      }
    }, 220);

    startGpayScanAndAutoZoomLoop(video, onSuccess);
  }

  /**
   * Detect small high-contrast QR/barcode patch in the center of the video
   */
  function detectSmallQrCandidate(videoEl){
    if (!spotterCtx || !videoEl || !videoEl.videoWidth) return 0;
    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const side = Math.min(vw, vh) * 0.5;
      const sx = (vw - side) * 0.5;
      const sy = (vh - side) * 0.5;

      spotterCtx.drawImage(videoEl, sx, sy, side, side, 0, 0, 96, 96);
      const data = spotterCtx.getImageData(0, 0, 96, 96).data;

      let sharpTransitions = 0;
      let totalChecks = 0;
      for (let y = 24; y < 72; y += 2) {
        for (let x = 24; x < 72; x += 2) {
          const i = (y * 96 + x) * 4;
          const l1 = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          const l2 = data[i + 4] * 0.3 + data[i + 5] * 0.59 + data[i + 6] * 0.11;
          const l3 = data[i + 384] * 0.3 + data[i + 385] * 0.59 + data[i + 386] * 0.11;
          if (Math.abs(l1 - l2) > 26 || Math.abs(l1 - l3) > 26) {
            sharpTransitions++;
          }
          totalChecks++;
        }
      }
      return totalChecks > 0 ? (sharpTransitions / totalChecks) : 0;
    } catch(e){
      return 0;
    }
  }

  /**
   * High-Speed Dual-Engine Multi-Scale Scan + Google Pay Auto-Zoom Loop
   */
  function startGpayScanAndAutoZoomLoop(videoEl, onSuccess){
    stopEngines();
    ensureDecoders();

    let framePass = 0;
    const autoSteps = [2.0, 2.7, 3.4, 4.0, 2.3];
    let stepIdx = 0;

    // 1. Multi-Scale Decoder Loop (every 110ms ~ 9fps across 3 zoom scales)
    scanLoopTimer = setInterval(async function(){
      if (scanResolved || !videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const minDim = Math.min(vw, vh);

      // Fast Native Pass directly on full-res video element (ML Kit hardware path)
      if (nativeDetector && framePass % 2 === 0) {
        try {
          const directHits = await nativeDetector.detect(videoEl);
          if (directHits && directHits.length > 0 && directHits[0].rawValue) {
            onSuccess(directHits[0].rawValue);
            return;
          }
        } catch(e){}
      }

      // 3-Scale Center Crop from 1080p sensor for small QR codes:
      // Scale 0: Current zoom level crop
      // Scale 1: 2.6x Macro center crop + contrast boost
      // Scale 2: 3.8x Ultra-Macro center crop + high-contrast sharpening for tiny 8mm tags
      const mode = framePass % 3;
      framePass++;

      let cropZoom = currentZoom;
      if (mode === 1) cropZoom = Math.max(currentZoom, 2.6);
      else if (mode === 2) cropZoom = Math.max(currentZoom * 1.35, 3.8);

      const cropSide = clamp(Math.floor(minDim / clamp(cropZoom, 1.0, 4.8)), 110, minDim);
      const sx = Math.floor((vw - cropSide) * 0.5);
      const sy = Math.floor((vh - cropSide) * 0.5);

      try {
        macroCtx.save();
        macroCtx.clearRect(0, 0, 720, 720);
        if (mode === 1) {
          macroCtx.filter = 'contrast(1.35) brightness(1.03)';
        } else if (mode === 2) {
          macroCtx.filter = 'contrast(1.65) grayscale(1)';
        } else {
          macroCtx.filter = 'none';
        }
        macroCtx.drawImage(videoEl, sx, sy, cropSide, cropSide, 0, 0, 720, 720);
        macroCtx.restore();

        if (nativeDetector) {
          try {
            const cropHits = await nativeDetector.detect(macroCanvas);
            if (cropHits && cropHits.length > 0 && cropHits[0].rawValue) {
              onSuccess(cropHits[0].rawValue);
              return;
            }
          } catch(e){}
        }

        if (zxingHelper && zxingHelper.qrcode && typeof zxingHelper.qrcode.decodeAsync === 'function') {
          try {
            const zxingHit = await zxingHelper.qrcode.decodeAsync(macroCanvas);
            if (zxingHit && zxingHit.text) {
              onSuccess(zxingHit.text);
              return;
            }
          } catch(e){}
        }
      } catch(e){}
    }, 110);

    // 2. Google Pay Smart Auto-Zoom Adjuster (every 950ms)
    autoZoomTimer = setInterval(function(){
      if (scanResolved || !autoZoomEnabled || !videoEl || videoEl.readyState < 2) return;

      const qrDensity = detectSmallQrCandidate(videoEl);
      if (qrDensity > 0.15) {
        // Small QR contrast pattern spotted in center -> zoom in closer like Google Pay!
        const nextZ = clamp(currentZoom < 2.6 ? 2.8 : (currentZoom < 3.4 ? 3.6 : 2.5), 2.0, 4.2);
        applyScannerZoom(nextZ, false);
        updateStatus('Small QR detected • Auto-zooming ' + nextZ.toFixed(1) + 'x', false);
      } else {
        stepIdx = (stepIdx + 1) % autoSteps.length;
        const nextZ = autoSteps[stepIdx];
        applyScannerZoom(nextZ, false);
        updateStatus('Auto-zoom ' + nextZ.toFixed(1) + 'x • Scanning small QR...', false);
      }
    }, 950);
  }

  function stopEngines(){
    if (scanLoopTimer) {
      clearInterval(scanLoopTimer);
      scanLoopTimer = null;
    }
    if (autoZoomTimer) {
      clearInterval(autoZoomTimer);
      autoZoomTimer = null;
    }
  }

  /**
   * Multi-Scale Gallery Photo Scanner
   */
  async function scanUploadedFileMacro(file, handleSuccess){
    updateStatus('Scanning photo for QR code...', false);
    ensureDecoders();

    if (zxingHelper && typeof zxingHelper.scanFile === 'function') {
      try {
        const res = await zxingHelper.scanFile(file, false);
        if (res) {
          handleSuccess(res);
          return;
        }
      } catch(e){}
    }

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise(function(resolve, reject){
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const passes = [
        { scale: 1.0, filter: 'none' },
        { scale: 1.8, filter: 'contrast(1.3)' },
        { scale: 2.8, filter: 'contrast(1.45)' },
        { scale: 3.8, filter: 'contrast(1.65) grayscale(1)' }
      ];

      for (let i = 0; i < passes.length; i++) {
        const p = passes[i];
        const cw = Math.floor(iw / p.scale);
        const ch = Math.floor(ih / p.scale);
        const sx = Math.floor((iw - cw) * 0.5);
        const sy = Math.floor((ih - ch) * 0.5);

        macroCtx.save();
        macroCtx.clearRect(0, 0, 720, 720);
        macroCtx.filter = p.filter;
        macroCtx.drawImage(img, sx, sy, cw, ch, 0, 0, 720, 720);
        macroCtx.restore();

        if (nativeDetector) {
          try {
            const hits = await nativeDetector.detect(macroCanvas);
            if (hits && hits.length > 0 && hits[0].rawValue) {
              URL.revokeObjectURL(url);
              handleSuccess(hits[0].rawValue);
              return;
            }
          } catch(e){}
        }

        if (zxingHelper && zxingHelper.qrcode && typeof zxingHelper.qrcode.decodeAsync === 'function') {
          try {
            const zHit = await zxingHelper.qrcode.decodeAsync(macroCanvas);
            if (zHit && zHit.text) {
              URL.revokeObjectURL(url);
              handleSuccess(zHit.text);
              return;
            }
          } catch(e){}
        }
      }
      URL.revokeObjectURL(url);
    } catch(e){}

    updateStatus('No QR found in photo • Try holding camera closer', false);
    if (window.say) window.say('Could not detect a QR code or barcode in that image.');
  }

  window.closeQrScanner = function(){
    stopEngines();
    activeVideoTrack = null;
    activeVideoEl = null;
    if (activeStream) {
      try {
        activeStream.getTracks().forEach(function(t){ t.stop(); });
      } catch(e){}
      activeStream = null;
    }
    const modal = document.getElementById('glQrScannerModal');
    if (modal) modal.remove();
  };

  window.openQrScannerForQuickTag = function(){
    const input = document.getElementById('rbQuickTagInput');
    window.openQrScanner({
      title: 'Scan Tag QR / Barcode for Sale',
      onScan: function(code){
        if (input) {
          input.value = code;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (window.rbQuickTagScan) {
          window.rbQuickTagScan(code);
        }
      }
    });
  };

  window.openQrScannerForQuote = function(){
    const input = document.getElementById('rcQuoteTagInput');
    window.openQrScanner({
      title: 'Scan Tag QR / Barcode for Quotation',
      onScan: function(code){
        if (input) {
          input.value = code;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (window.rcQuoteLoadTag) {
          window.rcQuoteLoadTag();
        }
      }
    });
  };

  window.openQrScannerForQuoteRow = function(btn){
    const row = btn?.closest('tr.rc-quote-row');
    const tagIn = row?.querySelector('[data-q="tagCode"]');
    window.openQrScanner({
      title: 'Scan Quotation Item Tag',
      onScan: function(code){
        if (tagIn) {
          tagIn.value = code;
          const matched = (typeof rcDocs === 'function')
            ? rcDocs('retail-tagging').find(t => String(t.tagCode).toLowerCase() === String(code).trim().toLowerCase())
            : null;
          if (matched && row) {
            const setQ = (k, v) => { const el = row.querySelector('[data-q="'+k+'"]'); if (el && v !== undefined) el.value = v; };
            setQ('product', matched.product || '');
            setQ('metalType', matched.metalType || 'Gold');
            setQ('purity', matched.purity || 92);
            setQ('grossWeight', matched.grossWeight || 0);
            setQ('stoneWeight', matched.stoneWeight || matched.lessWeight || 0);
            setQ('netWeight', matched.netWeight || Math.max(0, (Number(matched.grossWeight)||0) - (Number(matched.lessWeight)||0)));
            setQ('wastageMode', matched.wastageMode || 'percent');
            setQ('wastage', matched.wastage || 0);
            setQ('makingMode', matched.makingMode || 'piece');
            setQ('makingRate', matched.makingRate || 0);
            if (window.rcQuoteRowCalc) window.rcQuoteRowCalc(tagIn);
          }
        }
      }
    });
  };

  window.openQrScannerForTagRow = function(btn){
    if (!btn) return;
    const rbRow = btn.closest('.rb-item');
    if (rbRow) {
      const tagIn = rbRow.querySelector('[data-item="tagCode"]');
      window.openQrScanner({
        title: 'Scan Item Tag / QR Code',
        onScan: function(code){
          if (tagIn) {
            tagIn.value = code;
            if (typeof window.rbTagRowChanged === 'function') {
              window.rbTagRowChanged(tagIn);
            } else {
              tagIn.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });
      return;
    }

    const field = btn.closest('.rc-scan-wrap')?.querySelector('input');
    if (!field) return;
    window.openQrScanner({
      title: 'Scan Item Tag / QR Code',
      onScan: function(code){
        field.value = code;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.say) window.say('✓ Scanned Tag: ' + code);
      }
    });
  };

  window.rcScanTag = function(){
    window.openQrScannerForQuote();
  };
  window.rcScanTagForQuote = function(){
    window.openQrScannerForQuote();
  };
  window.rcScanTagRow = function(btn){
    window.openQrScannerForTagRow(btn);
  };

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      window.closeQrScanner();
    }
  });

})();
