/**
 * Goldleaf Jewellery ERP - Google Pay Style Auto-Zoom QR & Barcode Scanner
 * High-resolution 1080p stream + Hybrid Hardware/Optical Auto-Zoom + Multi-Scale Macro Decoder
 * Specifically engineered for tiny jewellery tag QR codes (6mm-15mm) & barcodes.
 */

(function(){
  'use strict';

  // Universal Scanner SVG Icon (framing reticle + QR matrix points)
  window.glScanIconSvg = '<svg class="gl-scan-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">'
    + '<path d="M2 4a2 2 0 0 1 2-2h4v2H4v4H2V4zm14-2h4a2 2 0 0 1 2 2v4h-2V4h-4V2zM2 16h2v4h4v2H4a2 2 0 0 1-2-2v-4zm18 4h-4v2h4a2 2 0 0 0 2-2v-4h-2v4zM5 8h4v4H5V8zm2 2h0v0H7v0zm8-2h4v4h-4V8zm2 2h0v0h0V10zm-8 6h4v4H7v-4zm2 2h0v0H9v0zm6-4h4v1h-4v-1zm0 3h2v1h-2v-1zm3-1h1v2h-1v-2z"/>'
    + '</svg>';

  // Audio tone and haptic feedback on successful scan
  function playScanBeep(){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
        osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.06); // E6 chime like GPay
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch(e){}
    if (navigator.vibrate) {
      try { navigator.vibrate([35, 25, 50]); } catch(e){}
    }
  }

  let activeScanner = null;
  let currentFacingMode = 'environment';
  let activeStream = null;
  let activeVideoTrack = null;
  let currentZoom = 1.0;
  let targetZoom = 1.8;
  let autoZoomEnabled = true;
  let hwZoomMin = 1.0;
  let hwZoomMax = 1.0;
  let hwZoomSupported = false;
  let autoZoomTimer = null;
  let macroScanTimer = null;
  let scanResolved = false;

  // Offscreen canvases for Multi-Scale Macro Decoding & QR Density Analysis
  let macroCanvas = null;
  let macroCtx = null;
  let analyzeCanvas = null;
  let analyzeCtx = null;
  let nativeDetector = null;

  function ensureCanvases(){
    if (!macroCanvas) {
      macroCanvas = document.createElement('canvas');
      macroCanvas.width = 680;
      macroCanvas.height = 680;
      macroCtx = macroCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!analyzeCanvas) {
      analyzeCanvas = document.createElement('canvas');
      analyzeCanvas.width = 96;
      analyzeCanvas.height = 96;
      analyzeCtx = analyzeCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!nativeDetector && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf', 'data_matrix']
        });
      } catch(e){}
    }
  }

  function clamp(val, min, max){
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Open the Google Pay Style Camera QR & Barcode Scanner modal
   * @param {Object|Function} opts - { onScan: (code) => {}, title: '...' } or callback function
   */
  window.openQrScanner = function(opts){
    if (typeof opts === 'function') {
      opts = { onScan: opts };
    } else {
      opts = opts || {};
    }
    const onScan = opts.onScan || function(code){ console.log('Scanned:', code); };
    const title = opts.title || 'Scan Tag / QR Code';

    closeQrScanner();
    scanResolved = false;
    autoZoomEnabled = true;
    currentZoom = 1.0;
    targetZoom = 2.0;
    ensureCanvases();

    const modal = document.createElement('div');
    modal.id = 'glQrScannerModal';
    modal.className = 'gl-qr-modal-backdrop gl-gpay-scanner';
    modal.innerHTML = ''
      + '<div class="gl-qr-modal-card" role="dialog" aria-modal="true" aria-label="'+title+'">'
      + '  <div class="gl-qr-modal-header">'
      + '    <h3>'
      + '      <span class="gl-gpay-badge-icon">' + window.glScanIconSvg + '</span>'
      + '      <span>' + title + '</span>'
      + '    </h3>'
      + '    <div class="gl-qr-header-actions">'
      + '      <button type="button" class="gl-qr-icon-btn" id="glQrTorchBtn" title="Toggle Flashlight" aria-label="Toggle Flashlight" style="display:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12v4z"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg></button>'
      + '      <button type="button" class="gl-qr-icon-btn" id="glQrFlipBtn" title="Flip Camera" aria-label="Flip Camera"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></button>'
      + '      <button type="button" class="gl-qr-modal-close" id="glQrCloseBtn" aria-label="Close Scanner">✕</button>'
      + '    </div>'
      + '  </div>'
      + '  <div class="gl-qr-viewport" id="glQrViewport">'
      + '    <div id="glQrReader"></div>'
      + '    <div class="gl-qr-status-pill" id="glQrStatusPill">'
      + '      <span class="gl-qr-status-dot"></span>'
      + '      <span id="glQrStatusText">✨ Auto-Zoom 2.0x • Ready for small QR</span>'
      + '    </div>'
      + '    <div class="gl-qr-reticle gl-gpay-reticle" id="glQrReticle" aria-hidden="true">'
      + '      <span class="gl-qr-corner tl"></span>'
      + '      <span class="gl-qr-corner tr"></span>'
      + '      <span class="gl-qr-corner bl"></span>'
      + '      <span class="gl-qr-corner br"></span>'
      + '      <div class="gl-qr-laser"></div>'
      + '    </div>'
      + '    <div class="gl-qr-focus-ring" id="glQrFocusRing" style="display:none"></div>'
      + '    <div class="gl-qr-zoom-pills" role="group" aria-label="Camera Zoom Presets">'
      + '      <button type="button" class="gl-qr-zpill" data-zoom="1">1x</button>'
      + '      <button type="button" class="gl-qr-zpill active" data-zoom="2">2x</button>'
      + '      <button type="button" class="gl-qr-zpill" data-zoom="3">3x</button>'
      + '      <button type="button" class="gl-qr-zpill" data-zoom="4">4x</button>'
      + '      <button type="button" class="gl-qr-zpill gl-qr-zpill-auto is-auto" id="glQrAutoToggleBtn" data-zoom="auto">✨ AUTO</button>'
      + '    </div>'
      + '  </div>'
      + '  <div class="gl-qr-modal-footer">'
      + '    <div class="gl-qr-zoom-slider-row">'
      + '      <button type="button" class="gl-qr-zoom-step" id="glQrZoomOutBtn" aria-label="Zoom Out">−</button>'
      + '      <input type="range" id="glQrZoomSlider" class="gl-qr-zoom-slider" min="1" max="5" step="0.1" value="2.0" aria-label="Camera Zoom Level">'
      + '      <button type="button" class="gl-qr-zoom-step" id="glQrZoomInBtn" aria-label="Zoom In">＋</button>'
      + '      <span class="gl-qr-zoom-readout" id="glQrZoomReadout">2.0x</span>'
      + '    </div>'
      + '    <div class="gl-qr-controls-row">'
      + '      <button type="button" class="gl-qr-tool-btn gl-gpay-upload-pill" id="glQrUploadBtn">📁 Upload QR Photo from Gallery</button>'
      + '      <input type="file" id="glQrFileInput" accept="image/*" style="display:none">'
      + '    </div>'
      + '    <p class="gl-qr-hint">Auto-zooms onto tiny jewellery tag QR codes • Pinch screen or tap 2x–4x to zoom closer</p>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('glQrCloseBtn');
    if (closeBtn) closeBtn.onclick = closeQrScanner;
    modal.onclick = function(e){
      if (e.target === modal) closeQrScanner();
    };

    const handleSuccess = function(decodedText){
      if (scanResolved || !decodedText) return;
      const clean = String(decodedText).trim();
      if (!clean) return;
      scanResolved = true;

      const reticle = document.getElementById('glQrReticle');
      if (reticle) reticle.classList.add('gl-qr-locked');
      updateStatusPill('✓ QR Code Captured: ' + clean, true);

      playScanBeep();
      setTimeout(function(){
        closeQrScanner();
        try {
          onScan(clean);
        } catch(err){
          console.error('Error in onScan callback:', err);
        }
      }, 140);
    };

    // Bind Zoom Controls (Pills, Slider, +/-, Pinch, Tap-to-Zoom)
    setupZoomInteractions();

    // Upload Image with Multi-Scale Macro Fallback
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

    // Flip Camera button
    const flipBtn = document.getElementById('glQrFlipBtn');
    if (flipBtn) {
      flipBtn.onclick = function(){
        currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
        startCamera(currentFacingMode, handleSuccess);
      };
    }

    startCamera(currentFacingMode, handleSuccess);
  };

  function updateStatusPill(msg, locked){
    const textEl = document.getElementById('glQrStatusText');
    const pillEl = document.getElementById('glQrStatusPill');
    if (textEl) textEl.textContent = msg;
    if (pillEl) {
      pillEl.classList.toggle('is-locked', !!locked);
    }
  }

  /**
   * Apply Hybrid Hardware + High-Res Optical/Digital Zoom
   * @param {number} zoomLevel - 1.0 to 5.0
   * @param {boolean} isManual - true if triggered by user tap/slider/pinch
   */
  function applyScannerZoom(zoomLevel, isManual){
    const z = clamp(Number(zoomLevel) || 1.0, 1.0, 5.0);
    currentZoom = Math.round(z * 10) / 10;

    if (isManual) {
      autoZoomEnabled = false;
      const autoBtn = document.getElementById('glQrAutoToggleBtn');
      if (autoBtn) autoBtn.classList.remove('is-auto');
      updateStatusPill('🔍 Manual Zoom ' + currentZoom.toFixed(1) + 'x • High-Res Macro', false);
    }

    // Update UI Slider & Readout & Pills
    const slider = document.getElementById('glQrZoomSlider');
    if (slider && Math.abs(Number(slider.value) - currentZoom) > 0.05) {
      slider.value = String(currentZoom);
    }
    const readout = document.getElementById('glQrZoomReadout');
    if (readout) readout.textContent = currentZoom.toFixed(1) + 'x';

    document.querySelectorAll('.gl-qr-zpill[data-zoom]').forEach(function(btn){
      const bz = btn.getAttribute('data-zoom');
      if (bz === 'auto') {
        btn.classList.toggle(' is-auto', autoZoomEnabled);
        btn.classList.toggle('active', autoZoomEnabled);
      } else {
        btn.classList.toggle('active', !autoZoomEnabled && Math.abs(Number(bz) - currentZoom) < 0.35);
      }
    });

    // Apply Hardware Zoom if supported by camera track
    let appliedHwZoom = 1.0;
    if (hwZoomSupported && activeVideoTrack) {
      appliedHwZoom = clamp(currentZoom, hwZoomMin, hwZoomMax);
      try {
        activeVideoTrack.applyConstraints({
          advanced: [{ zoom: appliedHwZoom }]
        }).catch(function(){});
      } catch(e){}
    }

    // Apply residual zoom via crisp CSS scale on video element (while decoder crops raw sensor pixels!)
    const residualDigitalZoom = clamp(currentZoom / appliedHwZoom, 1.0, 5.0);
    const videoEl = getActiveVideoElement();
    if (videoEl) {
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = isManual ? 'transform 0.12s ease-out' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
      videoEl.style.transform = residualDigitalZoom > 1.02 ? ('scale(' + residualDigitalZoom.toFixed(2) + ')') : 'scale(1)';
    }

    // Subtle Google Pay reticle pulse on zoom change
    const reticle = document.getElementById('glQrReticle');
    if (reticle) {
      reticle.classList.add('gl-qr-zooming');
      clearTimeout(reticle._zoomPulseTimer);
      reticle._zoomPulseTimer = setTimeout(function(){
        reticle.classList.remove('gl-qr-zooming');
      }, 320);
    }
  }

  window.glSetScannerZoom = function(z){
    applyScannerZoom(z, true);
  };

  function getActiveVideoElement(){
    return document.querySelector('#glQrReader video');
  }

  function setupZoomInteractions(){
    const slider = document.getElementById('glQrZoomSlider');
    const zoomOutBtn = document.getElementById('glQrZoomOutBtn');
    const zoomInBtn = document.getElementById('glQrZoomInBtn');
    const viewport = document.getElementById('glQrViewport');

    if (slider) {
      slider.oninput = function(){
        applyScannerZoom( parseFloat(slider.value), true );
      };
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = function(){
        applyScannerZoom(currentZoom - 0.5, true);
      };
    }
    if (zoomInBtn) {
      zoomInBtn.onclick = function(){
        applyScannerZoom(currentZoom + 0.5, true);
      };
    }

    document.querySelectorAll('.gl-qr-zpill').forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        const zAttr = btn.getAttribute('data-zoom');
        if (zAttr === 'auto') {
          autoZoomEnabled = true;
          btn.classList.add('is-auto', 'active');
          applyScannerZoom(2.2, false);
          updateStatusPill('✨ Auto-Zoom Active (' + currentZoom.toFixed(1) + 'x) • Scanning small QR', false);
        } else {
          applyScannerZoom(parseFloat(zAttr), true);
        }
      };
    });

    // Pinch-to-Zoom & Tap-to-Focus/Zoom on Viewport
    if (viewport) {
      let initialPinchDist = 0;
      let initialPinchZoom = 1.0;

      viewport.addEventListener('touchstart', function(e){
        if (e.touches && e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          initialPinchDist = Math.hypot(dx, dy);
          initialPinchZoom = currentZoom;
        }
      }, { passive: true });

      viewport.addEventListener('touchmove', function(e){
        if (e.touches && e.touches.length === 2 && initialPinchDist > 10) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scale = dist / initialPinchDist;
          applyScannerZoom(initialPinchZoom * scale, true);
        }
      }, { passive: true });

      // Tap on viewport to refocus and step-zoom onto small QR code
      viewport.addEventListener('click', function(e){
        if (e.target.closest('.gl-qr-zoom-pills')) return;
        const rect = viewport.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ring = document.getElementById('glQrFocusRing');
        if (ring) {
          ring.style.left = x + 'px';
          ring.style.top = y + 'px';
          ring.style.display = 'block';
          ring.classList.remove('animate');
          void ring.offsetWidth;
          ring.classList.add('animate');
          clearTimeout(ring._hideTimer);
          ring._hideTimer = setTimeout(function(){ ring.style.display = 'none'; }, 750);
        }

        // Trigger continuous refocus on track if supported
        if (activeVideoTrack) {
          try {
            activeVideoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            }).catch(function(){});
          } catch(err){}
        }

        // If zoom is currently < 2.5x, gently boost zoom on tap to help capture small QR
        if (currentZoom < 2.4) {
          applyScannerZoom(2.5, false);
          updateStatusPill('🔍 Focus & Macro Zoom 2.5x locked', false);
        }
      });
    }
  }

  /**
   * Inspect running video track capabilities (Hardware Zoom, Torch, 1080p HD, Continuous Focus)
   */
  function enhanceCameraTrack(){
    const videoEl = getActiveVideoElement();
    if (!videoEl || !videoEl.srcObject) return;
    const tracks = videoEl.srcObject.getVideoTracks ? videoEl.srcObject.getVideoTracks() : [];
    if (!tracks.length) return;

    const track = tracks[0];
    activeVideoTrack = track;
    hwZoomSupported = false;
    hwZoomMin = 1.0;
    hwZoomMax = 1.0;

    // Upgrade stream to Full HD 1080p + continuous autofocus if supported
    try {
      track.applyConstraints({
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [
          { focusMode: 'continuous' },
          { exposureMode: 'continuous' }
        ]
      }).catch(function(){});
    } catch(e){}

    // Inspect zoom & torch capabilities
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : (activeScanner && activeScanner.getRunningTrackCapabilities ? activeScanner.getRunningTrackCapabilities() : null);
      if (caps) {
        if (typeof caps.zoom === 'object' && caps.zoom !== null) {
          hwZoomSupported = true;
          hwZoomMin = caps.zoom.min || 1.0;
          hwZoomMax = caps.zoom.max || 4.0;
        } else if (typeof caps.zoom === 'number') {
          hwZoomSupported = true;
          hwZoomMax = caps.zoom;
        }

        if (caps.torch) {
          const torchBtn = document.getElementById('glQrTorchBtn');
          if (torchBtn) {
            torchBtn.style.display = 'inline-grid';
            let torchOn = false;
            torchBtn.onclick = function(){
              torchOn = !torchOn;
              try {
                track.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(function(){});
              } catch(e){}
              torchBtn.classList.toggle('active', torchOn);
            };
          }
        }
      }
    } catch(e){}

    // Google Pay style automatic entry zoom to 2.0x for small jewellery QR codes
    setTimeout(function(){
      if (!scanResolved && autoZoomEnabled) {
        applyScannerZoom(2.0, false);
        updateStatusPill('✨ Auto-Zoom 2.0x • Hold small QR inside frame', false);
      }
    }, 260);
  }

  /**
   * Analyze center of video frame for small high-contrast QR/barcode patterns
   * and automatically adjust zoom like Google Pay
   */
  function analyzeCenterForSmallQr(videoEl){
    if (!analyzeCtx || !videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;
    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const cropSize = Math.min(vw, vh) * 0.55;
      const sx = (vw - cropSize) * 0.5;
      const sy = (vh - cropSize) * 0.5;

      analyzeCtx.drawImage(videoEl, sx, sy, cropSize, cropSize, 0, 0, 96, 96);
      const img = analyzeCtx.getImageData(0, 0, 96, 96).data;

      // Measure high-frequency edge transitions in inner 36x36 core vs outer ring
      let innerEdges = 0;
      let innerSamples = 0;
      for (let y = 26; y < 70; y += 2) {
        for (let x = 26; x < 70; x += 2) {
          const idx = (y * 96 + x) * 4;
          const lum1 = img[idx] * 0.3 + img[idx + 1] * 0.59 + img[idx + 2] * 0.11;
          const lum2 = img[idx + 4] * 0.3 + img[idx + 5] * 0.59 + img[idx + 6] * 0.11;
          const lum3 = img[idx + 96 * 4] * 0.3 + img[idx + 96 * 4 + 1] * 0.59 + img[idx + 96 * 4 + 2] * 0.11;
          if (Math.abs(lum1 - lum2) > 28 || Math.abs(lum1 - lum3) > 28) {
            innerEdges++;
          }
          innerSamples++;
        }
      }
      const edgeRatio = innerSamples > 0 ? (innerEdges / innerSamples) : 0;
      return edgeRatio;
    } catch(e){
      return null;
    }
  }

  /**
   * Start Multi-Scale Macro Scan & Google Pay Auto-Zoom Engine
   * Runs alongside Html5Qrcode to decode tiny QR codes at 1x, 2.2x, and 3.8x center crops
   */
  function startMacroAutoZoomEngine(onSuccess){
    stopMacroAutoZoomEngine();
    ensureCanvases();

    let passIndex = 0;
    const zoomSweepSteps = [2.0, 2.6, 3.2, 3.8, 2.2];
    let sweepIdx = 0;

    // 1. Multi-Scale High-Definition Macro Decoder (every 135ms)
    macroScanTimer = setInterval(async function(){
      if (scanResolved) return;
      const videoEl = getActiveVideoElement();
      if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const minDim = Math.min(vw, vh);

      // Cycle across 3 zoom scales from raw 1080p sensor pixels:
      // Pass 0: Current user/auto zoom factor
      // Pass 1: 2.5x Macro Center Crop with crisp contrast boost
      // Pass 2: 3.8x Ultra-Macro Center Crop with high-contrast sharpening for tiny 8mm tags
      const passType = passIndex % 3;
      passIndex++;

      let scaleFactor = currentZoom;
      if (passType === 1) scaleFactor = Math.max(currentZoom, 2.5);
      else if (passType === 2) scaleFactor = Math.max(currentZoom * 1.35, 3.6);

      const cropSide = clamp(Math.floor(minDim / clamp(scaleFactor, 1.0, 4.8)), 120, minDim);
      const sx = Math.floor((vw - cropSide) * 0.5);
      const sy = Math.floor((vh - cropSide) * 0.5);

      try {
        macroCtx.save();
        macroCtx.clearRect(0, 0, 680, 680);
        if (passType === 1) {
          macroCtx.filter = 'contrast(1.32) brightness(1.03)';
        } else if (passType === 2) {
          macroCtx.filter = 'contrast(1.65) grayscale(1)';
        } else {
          macroCtx.filter = 'none';
        }
        macroCtx.drawImage(videoEl, sx, sy, cropSide, cropSide, 0, 0, 680, 680);
        macroCtx.restore();

        // Engine A: Native BarcodeDetector (with bounding-box auto-zoom feedback!)
        if (nativeDetector) {
          try {
            const codes = await nativeDetector.detect(macroCanvas);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              onSuccess(codes[0].rawValue);
              return;
            }
          } catch(e){}
        }

        // Engine B: Html5Qrcode internal ZXing decoder on the 680x680 HD macro crop
        if (activeScanner && activeScanner.qrcode && typeof activeScanner.qrcode.decodeAsync === 'function') {
          try {
            const res = await activeScanner.qrcode.decodeAsync(macroCanvas);
            if (res && res.text) {
              onSuccess(res.text);
              return;
            }
          } catch(e){}
        }
      } catch(e){}
    }, 135);

    // 2. Google Pay Style Smart Auto-Zoom Loop (every 1150ms)
    autoZoomTimer = setInterval(function(){
      if (scanResolved || !autoZoomEnabled) return;
      const videoEl = getActiveVideoElement();
      if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

      const edgeDensity = analyzeCenterForSmallQr(videoEl);
      if (edgeDensity !== null && edgeDensity > 0.16) {
        // Dense QR/barcode pattern detected in center — lock in closer like Google Pay!
        const nextZ = clamp(currentZoom < 2.6 ? 2.8 : (currentZoom < 3.4 ? 3.5 : 2.4), 2.0, 4.2);
        applyScannerZoom(nextZ, false);
        updateStatusPill('🔍 Small QR pattern detected • Auto-Zoom ' + nextZ.toFixed(1) + 'x', false);
      } else {
        // Progressive macro sweep for tiny jewellery tags
        sweepIdx = (sweepIdx + 1) % zoomSweepSteps.length;
        const nextZ = zoomSweepSteps[sweepIdx];
        applyScannerZoom(nextZ, false);
        updateStatusPill('✨ Auto-Zooming (' + nextZ.toFixed(1) + 'x) to capture small QR...', false);
      }
    }, 1150);
  }

  function stopMacroAutoZoomEngine(){
    if (macroScanTimer) {
      clearInterval(macroScanTimer);
      macroScanTimer = null;
    }
    if (autoZoomTimer) {
      clearInterval(autoZoomTimer);
      autoZoomTimer = null;
    }
  }

  /**
   * Multi-Scale Photo Upload Decoder (decodes full image + 2x/3.5x macro crops if QR is small in photo)
   */
  async function scanUploadedFileMacro(file, handleSuccess){
    updateStatusPill('🔍 Analyzing uploaded photo for small QR...', false);

    // First try standard scanFile
    if (activeScanner && typeof activeScanner.scanFile === 'function') {
      try {
        const res = await activeScanner.scanFile(file, true);
        if (res) {
          handleSuccess(res);
          return;
        }
      } catch(e){}
    }

    // Multi-Scale Center-Crop & Grid-Crop fallback for photos with tiny QR codes
    try {
      ensureCanvases();
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise(function(resolve, reject){
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const crops = [
        { scale: 1.0, filter: 'none' },
        { scale: 1.8, filter: 'contrast(1.3)' },
        { scale: 2.8, filter: 'contrast(1.45)' },
        { scale: 3.8, filter: 'contrast(1.65) grayscale(1)' }
      ];

      for (let i = 0; i < crops.length; i++) {
        const c = crops[i];
        const cw = Math.floor(iw / c.scale);
        const ch = Math.floor(ih / c.scale);
        const sx = Math.floor((iw - cw) * 0.5);
        const sy = Math.floor((ih - ch) * 0.5);

        macroCtx.save();
        macroCtx.clearRect(0, 0, 680, 680);
        macroCtx.filter = c.filter;
        macroCtx.drawImage(img, sx, sy, cw, ch, 0, 0, 680, 680);
        macroCtx.restore();

        if (nativeDetector) {
          try {
            const codes = await nativeDetector.detect(macroCanvas);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              URL.revokeObjectURL(imgUrl);
              handleSuccess(codes[0].rawValue);
              return;
            }
          } catch(e){}
        }

        if (activeScanner && activeScanner.qrcode && typeof activeScanner.qrcode.decodeAsync === 'function') {
          try {
            const decoded = await activeScanner.qrcode.decodeAsync(macroCanvas);
            if (decoded && decoded.text) {
              URL.revokeObjectURL(imgUrl);
              handleSuccess(decoded.text);
              return;
            }
          } catch(e){}
        }
      }
      URL.revokeObjectURL(imgUrl);
    } catch(e){}

    updateStatusPill('⚠ Could not find QR in photo • Try closer photo', false);
    if (window.say) window.say('Could not detect a QR code or barcode in that image.');
  }

  /**
   * Start camera scanning with Html5Qrcode + Macro Auto-Zoom Engine
   */
  function startCamera(facing, onSuccess){
    stopMacroAutoZoomEngine();
    if (activeScanner) {
      try {
        activeScanner.stop().catch(function(){}).finally(function(){
          activeScanner = null;
          initScanner(facing, onSuccess);
        });
        return;
      } catch(e){
        activeScanner = null;
      }
    }
    initScanner(facing, onSuccess);
  }

  function initScanner(facing, onSuccess){
    const readerEl = document.getElementById('glQrReader');
    if (!readerEl) return;

    if (window.Html5Qrcode) {
      try {
        const formats = window.Html5QrcodeSupportedFormats ? [
          window.Html5QrcodeSupportedFormats.QR_CODE,
          window.Html5QrcodeSupportedFormats.CODE_128,
          window.Html5QrcodeSupportedFormats.EAN_13,
          window.Html5QrcodeSupportedFormats.EAN_8,
          window.Html5QrcodeSupportedFormats.UPC_A,
          window.Html5QrcodeSupportedFormats.UPC_E,
          window.Html5QrcodeSupportedFormats.CODE_39,
          window.Html5QrcodeSupportedFormats.ITF,
          window.Html5QrcodeSupportedFormats.DATA_MATRIX
        ].filter(Boolean) : undefined;

        activeScanner = new window.Html5Qrcode('glQrReader', {
          formatsToSupport: formats,
          useBarCodeDetectorIfSupported: true,
          verbose: false
        });

        const config = {
          fps: 20,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(210, Math.floor(minEdge * 0.76));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0
        };

        activeScanner.start(
          { facingMode: facing },
          config,
          function(decodedText){
            onSuccess(decodedText);
          },
          function(){}
        ).then(function(){
          enhanceCameraTrack();
          startMacroAutoZoomEngine(onSuccess);
        }).catch(function(err){
          console.warn('Html5Qrcode camera error:', err);
          fallbackNativeCamera(facing, onSuccess);
        });
        return;
      } catch(err){
        console.warn('Html5Qrcode init failed:', err);
      }
    }

    fallbackNativeCamera(facing, onSuccess);
  }

  /**
   * Native Camera + Multi-Scale Macro Decoder fallback
   */
  async function fallbackNativeCamera(facing, onSuccess){
    const readerEl = document.getElementById('glQrReader');
    if (!readerEl) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.say) window.say('Camera access is not supported by this browser. Use handheld scanner or image upload.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      activeStream = stream;

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      readerEl.innerHTML = '';
      readerEl.appendChild(video);
      await video.play();

      activeScanner = {
        stop: async function(){
          stopMacroAutoZoomEngine();
          stream.getTracks().forEach(function(t){ t.stop(); });
        }
      };

      enhanceCameraTrack();
      startMacroAutoZoomEngine(onSuccess);
    } catch(err){
      console.error('Camera fallback error:', err);
      updateStatusPill('⚠ Camera blocked • Use Upload QR Photo below', false);
      if (window.say) window.say('Camera permission was blocked. Tap "Upload QR Photo" or enter tag code manually.');
    }
  }

  /**
   * Close the scanner modal and release camera resources
   */
  window.closeQrScanner = function(){
    stopMacroAutoZoomEngine();
    activeVideoTrack = null;
    if (activeScanner) {
      try {
        activeScanner.stop().catch(function(){});
      } catch(e){}
      activeScanner = null;
    }
    if (activeStream) {
      try {
        activeStream.getTracks().forEach(function(t){ t.stop(); });
      } catch(e){}
      activeStream = null;
    }
    const modal = document.getElementById('glQrScannerModal');
    if (modal) modal.remove();
  };

  /**
   * Quick Tag Bar in Sales Entry
   */
  window.openQrScannerForQuickTag = function(){
    const input = document.getElementById('rbQuickTagInput');
    window.openQrScanner({
      title: 'Scan Tag / QR for Sale',
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

  /**
   * Estimation & Quotation Tag Search
   */
  window.openQrScannerForQuote = function(){
    const input = document.getElementById('rcQuoteTagInput');
    window.openQrScanner({
      title: 'Scan Tag / QR for Quotation',
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

  /**
   * Tag Row in Sales Bill OR Retail Tagging
   */
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

  // Replace legacy rcScanTag with universal auto-zoom scanner
  window.rcScanTag = function(){
    window.openQrScannerForQuote();
  };
  window.rcScanTagForQuote = function(){
    window.openQrScannerForQuote();
  };
  window.rcScanTagRow = function(btn){
    window.openQrScannerForTagRow(btn);
  };

  // Close scanner on ESC key
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      window.closeQrScanner();
    }
  });

})();
