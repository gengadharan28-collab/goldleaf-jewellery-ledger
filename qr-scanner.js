/**
 * Goldleaf Jewellery ERP - Universal QR & Barcode Camera Scanner
 * Provides high-speed camera scanning for Retail Sales, Quotation, and Tagging
 * Icon-only trigger buttons with zero text clutter, fully optimized for Mobile & Desktop.
 */

(function(){
  'use strict';

  // Universal Scanner SVG Icon (framing reticle + barcode matrix points, no text words)
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
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 tone
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch(e){}
    if (navigator.vibrate) {
      try { navigator.vibrate([40, 20, 40]); } catch(e){}
    }
  }

  let activeScanner = null;
  let currentFacingMode = 'environment';
  let activeStream = null;

  /**
   * Open the Camera QR & Barcode Scanner modal
   * @param {Object} opts - { onScan: (code) => {}, title: '...' }
   */
  window.openQrScanner = function(opts){
    opts = opts || {};
    const onScan = opts.onScan || function(code){ console.log('Scanned:', code); };
    const title = opts.title || 'Scan Tag / Barcode';

    // Remove any existing scanner modal
    closeQrScanner();

    // Create modal DOM
    const modal = document.createElement('div');
    modal.id = 'glQrScannerModal';
    modal.className = 'gl-qr-modal-backdrop';
    modal.innerHTML = ''
      + '<div class="gl-qr-modal-card" role="dialog" aria-modal="true" aria-label="'+title+'">'
      + '  <div class="gl-qr-modal-header">'
      + '    <h3>'
      + '      <span style="display:inline-flex;color:#34d399;">' + window.glScanIconSvg + '</span>'
      + '      <span>' + title + '</span>'
      + '    </h3>'
      + '    <button type="button" class="gl-qr-modal-close" id="glQrCloseBtn" aria-label="Close Scanner">✕</button>'
      + '  </div>'
      + '  <div class="gl-qr-viewport">'
      + '    <div id="glQrReader"></div>'
      + '    <div class="gl-qr-reticle" aria-hidden="true">'
      + '      <span class="gl-qr-corner tl"></span>'
      + '      <span class="gl-qr-corner tr"></span>'
      + '      <span class="gl-qr-corner bl"></span>'
      + '      <span class="gl-qr-corner br"></span>'
      + '      <div class="gl-qr-laser"></div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="gl-qr-modal-footer">'
      + '    <div class="gl-qr-controls-row">'
      + '      <button type="button" class="gl-qr-tool-btn" id="glQrFlipBtn">🔄 Flip Camera</button>'
      + '      <button type="button" class="gl-qr-tool-btn" id="glQrTorchBtn" style="display:none">🔦 Torch</button>'
      + '      <button type="button" class="gl-qr-tool-btn" id="glQrUploadBtn">📁 Upload Image</button>'
      + '      <input type="file" id="glQrFileInput" accept="image/*" style="display:none">'
      + '    </div>'
      + '    <p class="gl-qr-hint">Hold tag QR code or barcode steadily inside the frame</p>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('glQrCloseBtn');
    if (closeBtn) closeBtn.onclick = closeQrScanner;
    modal.onclick = function(e){
      if (e.target === modal) closeQrScanner();
    };

    const handleSuccess = function(decodedText){
      playScanBeep();
      closeQrScanner();
      try {
        onScan(decodedText);
      } catch(err){
        console.error('Error in onScan callback:', err);
      }
    };

    // Upload Image fallback
    const uploadBtn = document.getElementById('glQrUploadBtn');
    const fileInput = document.getElementById('glQrFileInput');
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = function(){ fileInput.click(); };
      fileInput.onchange = function(e){
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (activeScanner && typeof activeScanner.scanFile === 'function') {
          activeScanner.scanFile(file, true)
            .then(handleSuccess)
            .catch(function(){
              if (window.say) window.say('Could not detect a QR code or barcode in that image.');
              else alert('No barcode or QR code detected in the uploaded image.');
            });
        }
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

    // Start scanner with current facing mode
    startCamera(currentFacingMode, handleSuccess);
  };

  /**
   * Start camera scanning with Html5Qrcode or native fallback
   */
  function startCamera(facing, onSuccess){
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
          window.Html5QrcodeSupportedFormats.ITF
        ] : undefined;

        activeScanner = new window.Html5Qrcode('glQrReader', {
          formatsToSupport: formats,
          verbose: false
        });

        const config = {
          fps: 15,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(200, Math.floor(minEdge * 0.72));
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
          function(err){
            // scanning loop frame error (normal while searching)
          }
        ).then(function(){
          // Check if torch is supported
          checkTorchSupport();
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
   * Native Camera + BarcodeDetector fallback if Html5Qrcode is unavailable
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
        video: { facingMode: { ideal: facing } },
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

      let active = true;
      activeScanner = {
        stop: async function(){
          active = false;
          stream.getTracks().forEach(function(t){ t.stop(); });
        }
      };

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf']
        });
        const scanLoop = async function(){
          if (!active) return;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              active = false;
              onSuccess(barcodes[0].rawValue);
              return;
            }
          } catch(e){}
          if (active) requestAnimationFrame(scanLoop);
        };
        requestAnimationFrame(scanLoop);
      } else {
        if (window.say) window.say('Camera preview active. Position barcode inside frame or use file upload.');
      }
    } catch(err){
      console.error('Camera fallback error:', err);
      if (window.say) window.say('Camera permission was blocked. Tap "Upload Image" or enter tag code manually.');
    }
  }

  function checkTorchSupport(){
    try {
      const torchBtn = document.getElementById('glQrTorchBtn');
      if (!torchBtn || !activeScanner) return;
      const capabilities = activeScanner.getRunningTrackCapabilities();
      if (capabilities && capabilities.torch) {
        torchBtn.style.display = 'inline-flex';
        let torchOn = false;
        torchBtn.onclick = function(){
          torchOn = !torchOn;
          activeScanner.applyVideoConstraints({
            advanced: [{ torch: torchOn }]
          });
          torchBtn.textContent = torchOn ? '🔦 Torch On' : '🔦 Torch';
        };
      }
    } catch(e){}
  }

  /**
   * Close the scanner modal and release camera resources
   */
  window.closeQrScanner = function(){
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
      title: 'Scan Tag / Barcode for Sale',
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
      title: 'Scan Tag / HUID for Quotation',
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
   * Tag Row in Retail Tagging
   */
  window.openQrScannerForTagRow = function(btn){
    const field = btn.closest('.rc-scan-wrap')?.querySelector('input');
    if (!field) return;
    window.openQrScanner({
      title: 'Scan Item Tag / Barcode',
      onScan: function(code){
        field.value = code;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.say) window.say('✓ Scanned Tag: ' + code);
      }
    });
  };

  // Replace legacy rcScanTag with universal scanner
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
