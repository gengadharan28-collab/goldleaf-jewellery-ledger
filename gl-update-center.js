// Authoritative Goldleaf Software Update Engine & Release Center (v2.13.0)
(function () {
  const CURRENT_VERSION = '2.13.0';
  const CURRENT_BUILD = 'goldleaf-shell-v2406';
  const CURRENT_DATE = '26 Nov 2026';

  window.GOLDLEAF_VERSION = CURRENT_VERSION;
  window.GL_APP_VERSION = CURRENT_VERSION;
  window.GL_BUILD_ID = CURRENT_BUILD;
  window.GL_RELEASE_DATE = CURRENT_DATE;

  const GL_RELEASES = [
    {
      version: '2.13.0',
      date: '26 Nov 2026',
      tag: 'Current',
      category: 'Platform & Security',
      title: 'Modern Software Update Center & Complete ERP Suite',
      notes: [
        'Replaced legacy Update History patching with a unified live Update Center featuring real-time version.json + Service Worker polling, atomic cache-busting updates, and instant cache diagnostics.',
        'Completed the 32-category / 129-report Reports Hub with an expandable Reports sidebar menu, 10 domain filter pills, and safe early-boot routing.',
        'Fixed Demo mode data loading in Jewel Loan and unified Cost Structure navigation ordering.'
      ]
    },
    {
      version: '2.12.9',
      date: '26 Nov 2026',
      tag: 'Major',
      category: 'Sales & POS Print',
      title: 'High-Darkness Thermal & PDF Printing + Sales Bill Delete',
      notes: [
        'Increased thermal POS (80mm / 58mm) and PDF print darkness with 3x raster scaling, crisp monochrome stroke darkening, and table-free Estimation layouts.',
        'Added Delete action on Sales Bills (Retail & Wholesale) with automatic Stock Tag status restoration, Chit passbook reversal, and Payment sync.'
      ]
    },
    {
      version: '2.12.8',
      date: '25 Nov 2026',
      tag: 'Major',
      category: 'Accounts',
      title: 'Dedicated Accounts & Unified Stock & Tagging Modules',
      notes: [
        'Organized Accounts under its own expandable sidebar roof with Ledger Statements, Account Groups, Save-All Opening Balances, Day Book, Trial Balance, P&L, and Vouchers.',
        'Unified all 21 Stock & Tagging workflows under one roof including Lot Entry, Tagging, Detail Lists, Display Columns, Stock Vouchers, Stock Verification, Reorder Alerts, and Gift Vouchers.'
      ]
    },
    {
      version: '2.12.0',
      date: '21 Nov 2026',
      tag: 'Feature',
      category: 'Chit & Jewel Loan',
      title: 'Jewel Loan Module, Chit Passbooks & Scheme Maturity',
      notes: [
        'Added Jewel Loan pledged-item workflow, interest calculation, partial/full redemption, and loan register reports.',
        'Expanded Chit Schemes with automated installment schedules, bonus rules, passbook printing, and bill settlement integration.'
      ]
    },
    {
      version: '2.11.0',
      date: '16 Nov 2026',
      tag: 'Feature',
      category: 'Sales & POS Print',
      title: 'Thermal 80mm / 58mm Direct Print & QR Scanner',
      notes: [
        'Added direct thermal printer helper with clean monochrome typography, UPI QR payment block, and auto-cut spacing.',
        'Integrated camera & USB barcode/QR tag scanner directly inside Retail Sales Entry and Estimation.'
      ]
    },
    {
      version: '2.10.90',
      date: '16 Nov 2026',
      tag: 'Feature',
      category: 'Stock & Tagging',
      title: 'Stock Verification, Lot Entry & Tagging Workflows',
      notes: [
        'Added barcode/QR batch Stock Verification with missing/matched counters and audit snapshots.',
        'Added Lot Entry inward tracking with gross/stone/net weight splits and direct Tag generation.'
      ]
    },
    {
      version: '2.10.75',
      date: '15 Nov 2026',
      tag: 'Feature',
      category: 'Reports & GST',
      title: 'GST Tax Reports, Trade Summaries & Drill-Down Tables',
      notes: [
        'Added interactive drill-down data tables with CSV/PDF export across sales, purchases, and tax registers.',
        'Added GSTR-1 / HSN / Old Gold purchase summary views with separate gold gram and rupee totals.'
      ]
    },
    {
      version: '2.8.7',
      date: '7 Nov 2026',
      tag: 'UI',
      category: 'Platform & Security',
      title: 'Retail & Wholesale ERP Shell, Sidebar Search & Dark Mode',
      notes: [
        'Introduced the collapsible ERP sidebar with quick page search, shortcut toolbar, and Retail/Wholesale workspace switcher.',
        'Added full Dark / Night theme support and protected unsaved invoice forms from background refreshes.'
      ]
    },
    {
      version: '2.6.0',
      date: '6 Nov 2026',
      tag: 'Core',
      category: 'Sales & POS Print',
      title: 'Two-Step Customer Sales, Old Gold Exchange & Rate Book',
      notes: [
        'Added multi-item Old Gold Exchange with testing purity calculation, making charges, and optional GST toggle.',
        'Added daily Retail Rate Book (24K, 22K, 18K, 14K, Silver) with AM/PM slot reminders.'
      ]
    }
  ];

  const RELEASE_CATEGORIES = [
    'All Releases',
    'Platform & Security',
    'Reports & GST',
    'Accounts',
    'Stock & Tagging',
    'Sales & POS Print',
    'Chit & Jewel Loan'
  ];

  const updateState = {
    status: 'idle', // idle | checking | up-to-date | update-available | offline | error
    lastCheckedAt: null,
    remoteRelease: null,
    swState: 'checking',
    search: '',
    category: 'All Releases'
  };

  function compareVersions(a, b) {
    const pa = String(a || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] || 0;
      const db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  function hasPendingServiceWorker() {
    return !!(window.glPendingWorker || window.glSwRegistration?.waiting);
  }

  function isRemoteNewer(remote) {
    if (!remote) return false;
    if (remote.version && compareVersions(remote.version, CURRENT_VERSION) > 0) return true;
    if (remote.build && remote.build !== CURRENT_BUILD && remote.version === CURRENT_VERSION) return true;
    return false;
  }

  window.glIsUpdatePending = function () {
    return !!(hasPendingServiceWorker() || window.glUpdateAvailable || isRemoteNewer(updateState.remoteRelease));
  };

  function getActiveReleaseBannerData() {
    const remote = updateState.remoteRelease;
    if (remote && isRemoteNewer(remote)) {
      return {
        version: remote.version || CURRENT_VERSION,
        title: remote.title || 'New Goldleaf Update Available',
        releasedAt: remote.releasedAt || CURRENT_DATE,
        highlights: Array.isArray(remote.highlights) && remote.highlights.length
          ? remote.highlights
          : GL_RELEASES[0].notes
      };
    }
    const latest = GL_RELEASES[0];
    return {
      version: CURRENT_VERSION,
      title: latest.title,
      releasedAt: latest.date,
      highlights: latest.notes
    };
  }

  function ensureUpdateStyles() {
    if (document.getElementById('glUpdateUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'glUpdateUiStyles';
    style.textContent = `
      @keyframes glFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes glPopIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes glSpin { to { transform: rotate(360deg); } }
      #glUpdateModal { animation: glFadeIn .18s ease-out; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
      #glUpdateModal .gl-update-modal-card { animation: glPopIn .2s ease-out; max-height: 90dvh; display: flex; flex-direction: column; }
      #glUpdateModal .gl-update-modal-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .gl-update-overlay { position: fixed; inset: 0; z-index: 20000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(10, 31, 21, 0.94); color: #f3ead9; font-family: system-ui, -apple-system, sans-serif; animation: glFadeIn .16s ease-out; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 24px; text-align: center; }
      .gl-update-spinner { width: 38px; height: 38px; border-radius: 50%; border: 3px solid rgba(243, 234, 217, 0.22); border-top-color: #10b981; animation: glSpin .75s linear infinite; }
      @media (max-width: 560px) {
        #glUpdateModal .gl-update-features-grid { grid-template-columns: 1fr !important; }
        #glUpdateModal .gl-update-modal-actions { flex-direction: column-reverse !important; align-items: stretch !important; }
        #glUpdateModal .gl-update-modal-actions > div { width: 100%; display: grid !important; grid-template-columns: 1fr 1fr; }
        #glUpdateModal .gl-update-modal-actions > button { text-align: center; }
      }
    `;
    document.head.appendChild(style);
  }

  function showApplyingOverlay(titleText, subText) {
    ensureUpdateStyles();
    let overlay = document.getElementById('glApplyingUpdateOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'glApplyingUpdateOverlay';
      overlay.className = 'gl-update-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div class="gl-update-spinner" aria-hidden="true"></div>'
      + '<div style="font-size:16px;font-weight:750;letter-spacing:-0.2px">' + esc(titleText || 'Updating Goldleaf ERP…') + '</div>'
      + '<div style="font-size:12.5px;color:#c9c0b1;max-width:300px;line-height:1.45">' + esc(subText || 'Applying the latest version cleanly. Your records are safe.') + '</div>';
  }

  window.glShowUpdatePrompt = function (reason = 'loaded') {
    ensureUpdateStyles();
    const info = getActiveReleaseBannerData();
    const existing = document.getElementById('glUpdateModal');
    if (existing) {
      if (existing.dataset.version === String(info.version) && existing.dataset.reason === String(reason)) return;
      existing.remove();
    }

    const cards = info.highlights.slice(0, 4).map((text, idx) => {
      const icons = ['📊', '📒', '🏷️', '🖨️'];
      return '<div class="gl-update-feature-card" style="background:var(--paper,#fbf9f4);border:1px solid var(--line,#e2e8f0);border-radius:9px;padding:9px 11px">'
        + '<div style="display:flex;align-items:flex-start;gap:7px">'
        + '<span style="font-size:15px;line-height:1.2">' + (icons[idx] || '⚡') + '</span>'
        + '<span style="font-size:11.5px;color:var(--ink,#1e293b);line-height:1.4">' + esc(text) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');

    const html = '<div id="glUpdateModal" class="retail-modal-backdrop" data-version="' + esc(info.version) + '" data-reason="' + esc(reason) + '" role="dialog" aria-modal="true" style="z-index:10000;display:flex;align-items:center;justify-content:center">'
      + '<section class="retail-modal gl-update-modal-card" style="max-width:540px;width:92%;padding:0;border-radius:14px;overflow:hidden;box-shadow:0 18px 45px rgba(0,0,0,0.4);border:1px solid #75603c">'
      + '<div style="background:linear-gradient(135deg,#133726,#0a1f15);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(212,175,55,0.25)">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:inline-grid;place-items:center;font-size:20px;box-shadow:0 2px 10px rgba(16,185,129,0.35);flex-shrink:0" aria-hidden="true">🚀</span>'
      + '<div>'
      + '<h2 style="margin:0;font-size:16px;color:#f3ead9;font-weight:750;letter-spacing:-0.2px">' + (reason === 'waiting' || isRemoteNewer(updateState.remoteRelease) ? 'New Update Ready' : 'Goldleaf ERP Updated') + '</h2>'
      + '<p style="margin:2px 0 0;font-size:11px;color:#c9c0b1">v' + esc(info.version) + ' · ' + esc(info.releasedAt) + '</p>'
      + '</div>'
      + '</div>'
      + '<button type="button" onclick="glDismissUpdate()" style="background:transparent;border:0;color:#f3ead9;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1" aria-label="Close">✕</button>'
      + '</div>'
      + '<div class="gl-update-modal-body" style="padding:18px 20px;font-size:12.5px;line-height:1.5;background:var(--white,#fff);color:var(--ink,#172a21)">'
      + '<div class="gl-update-callout" style="background:linear-gradient(135deg,#f0fdf4,#e8f5e9);border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;gap:12px;align-items:center">'
      + '<span style="font-size:22px;flex-shrink:0" aria-hidden="true">⚡</span>'
      + '<div>'
      + '<b style="font-size:13px;color:#065f46;display:block">' + esc(info.title) + '</b>'
      + '<span style="font-size:11.5px;color:#047857;line-height:1.4">Apply the latest build cleanly without losing your saved local or cloud records.</span>'
      + '</div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted,#64748b);margin-bottom:9px">Highlights in v' + esc(info.version) + '</div>'
      + '<div class="gl-update-features-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:18px">' + cards + '</div>'
      + '<div class="gl-update-modal-actions" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;border-top:1px solid var(--line,#edf0ed)">'
      + '<button type="button" onclick="glCloseUpdatePrompt();go(\'Update History\')" style="background:transparent;border:0;color:var(--gold,#b89559);font-size:11.5px;font-weight:600;padding:4px 6px;cursor:pointer;text-decoration:underline">Open Update Center</button>'
      + '<div style="display:flex;gap:8px">'
      + '<button type="button" class="gl-update-not-now-btn" onclick="glDismissUpdate()" style="min-height:38px;padding:8px 18px;font-size:12.5px;font-weight:650;border-radius:8px;border:1px solid var(--line,#cbd5e1);background:#f8fafc;color:var(--ink,#334155);cursor:pointer">Later</button>'
      + '<button type="button" class="primary gl-update-now-btn" onclick="glApplyUpdate()" style="min-height:38px;padding:8px 22px;font-size:12.5px;font-weight:750;border-radius:8px;background:linear-gradient(135deg,#059669,#047857);border:1px solid #059669;color:#fff;cursor:pointer;box-shadow:0 3px 12px rgba(5,150,105,0.3)">⚡ Update Now</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</section>'
      + '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof window.glUpdatePillVisibility === 'function') window.glUpdatePillVisibility(true);
  };

  window.glApplyUpdate = async function () {
    const targetVer = updateState.remoteRelease?.version || CURRENT_VERSION;
    localStorage.setItem('gl_last_promoted_version', targetVer);
    localStorage.removeItem('gl_update_snooze');
    sessionStorage.setItem('gl_update_success_banner', targetVer);

    const waitingWorker = window.glPendingWorker || window.glSwRegistration?.waiting || null;
    window.glPendingWorker = null;
    window.glUpdateAvailable = false;
    if (typeof window.glUpdatePillVisibility === 'function') window.glUpdatePillVisibility(false);
    showApplyingOverlay('Updating to v' + targetVer + '…', 'Refreshing app files cleanly without losing any saved data.');
    if (typeof window.glCloseUpdatePrompt === 'function') window.glCloseUpdatePrompt();

    let reloaded = false;
    const doReload = (bustCache = false) => {
      if (reloaded) return;
      reloaded = true;
      if (bustCache) {
        const url = new URL(window.location.href);
        url.searchParams.set('_upd', Date.now().toString());
        window.location.replace(url.toString());
      } else {
        window.location.reload();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => doReload(false), { once: true });
      try {
        if (waitingWorker) {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } else if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (e) {}
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => k.startsWith('goldleaf-shell-'))
            .map(k => caches.delete(k))
        );
      } catch (e) {}
    }

    setTimeout(() => doReload(!waitingWorker), 650);
  };

  window.glForceHardRefresh = async function () {
    showApplyingOverlay('Refreshing Goldleaf ERP…', 'Clearing cached files and loading the latest build.');
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) reg.active.postMessage({ type: 'CLEAR_CACHES' });
        await reg?.update().catch(() => {});
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('goldleaf-shell-')).map(k => caches.delete(k)));
      }
    } catch (e) {}
    sessionStorage.setItem('gl_update_success_banner', CURRENT_VERSION);
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  };

  async function detectSwStatus() {
    if (!('serviceWorker' in navigator)) {
      updateState.swState = 'Not supported';
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) window.glSwRegistration = reg;
      if (!reg) updateState.swState = 'Not registered';
      else if (reg.waiting) updateState.swState = 'Update waiting to install';
      else if (reg.installing) updateState.swState = 'Installing update...';
      else if (reg.active) updateState.swState = 'Active · Offline ready';
      else updateState.swState = 'Standby';
    } catch (e) {
      updateState.swState = 'Unavailable';
    }
  }

  function isUpdateHistoryPage() {
    return (typeof page !== 'undefined' && page === 'Update History') || !!document.getElementById('glReleaseTimeline');
  }

  window.glCheckForUpdate = async function (manual = false) {
    if (updateState.status === 'checking') return;
    if (!navigator.onLine) {
      updateState.status = 'offline';
      updateState.lastCheckedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (manual && typeof window.say === 'function') window.say('You are offline. Connect to internet to check for updates.');
      if (isUpdateHistoryPage()) render();
      return;
    }

    updateState.status = 'checking';
    if (manual && isUpdateHistoryPage()) render();

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          window.glSwRegistration = reg;
          await reg.update().catch(() => {});
          if (reg.waiting) {
            window.glPendingWorker = reg.waiting;
            window.glUpdateAvailable = true;
          }
        }
      }

      const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        updateState.remoteRelease = data;
        if (isRemoteNewer(data) || hasPendingServiceWorker()) {
          window.glUpdateAvailable = true;
          updateState.status = 'update-available';
        } else {
          updateState.status = 'up-to-date';
        }
      } else {
        updateState.status = hasPendingServiceWorker() ? 'update-available' : 'up-to-date';
      }
    } catch (e) {
      updateState.status = hasPendingServiceWorker() ? 'update-available' : 'error';
    }

    await detectSwStatus();
    updateState.lastCheckedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (typeof window.erpSyncUpdatePill === 'function') window.erpSyncUpdatePill();

    if (manual) {
      if (updateState.status === 'update-available') {
        window.glShowUpdatePrompt('waiting');
      } else if (updateState.status === 'up-to-date' && typeof window.say === 'function') {
        window.say('You are on the latest Goldleaf version (v' + CURRENT_VERSION + ').');
      }
    }
    if (isUpdateHistoryPage()) render();
  };

  window.glSetUpdateFilter = function (category) {
    updateState.category = category || 'All Releases';
    if (isUpdateHistoryPage()) render();
  };

  window.glSetUpdateSearch = function (val) {
    updateState.search = String(val || '');
    const list = document.getElementById('glReleaseTimeline');
    if (list) list.innerHTML = renderReleaseCards();
  };

  function renderReleaseCards() {
    const q = updateState.search.trim().toLowerCase();
    const filtered = GL_RELEASES.filter(rel => {
      if (updateState.category !== 'All Releases' && rel.category !== updateState.category) return false;
      if (!q) return true;
      return (rel.version + ' ' + rel.title + ' ' + rel.category + ' ' + rel.notes.join(' ')).toLowerCase().includes(q);
    });

    if (!filtered.length) {
      return '<div class="empty">No release notes match your search or filter.</div>';
    }

    return filtered.map(rel => {
      const isCurrent = rel.version === CURRENT_VERSION;
      const badgeBg = isCurrent ? 'background:#059669;color:#fff' : 'background:var(--mint,#eef2ef);color:var(--green,#133726)';
      return '<article class="release-note gl-release-card" style="padding:14px 16px;margin:0 0 12px;border:1px solid var(--line);border-radius:12px;background:var(--white)">'
        + '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<span style="padding:3px 9px;border-radius:999px;font-size:11px;font-weight:750;' + badgeBg + '">v' + esc(rel.version) + (isCurrent ? ' · Current' : '') + '</span>'
        + '<span style="font-size:11.5px;color:var(--muted);font-weight:600">' + esc(rel.date) + '</span>'
        + '<span style="padding:2px 8px;border-radius:6px;font-size:10.5px;border:1px solid var(--line);color:var(--muted)">' + esc(rel.category) + '</span>'
        + '</div>'
        + '</div>'
        + '<h3 style="margin:4px 0 6px;font-size:15px;color:var(--ink)">' + esc(rel.title) + '</h3>'
        + '<ul style="margin:0;padding-left:18px;color:var(--muted);line-height:1.65;font-size:13px">'
        + rel.notes.map(n => '<li>' + esc(n) + '</li>').join('')
        + '</ul>'
        + '</article>';
    }).join('');
  }

  window.updateHistoryView = function () {
    const updateReady = window.glIsUpdatePending();
    const statusText = updateState.status === 'checking'
      ? 'Checking server for updates...'
      : updateReady
        ? 'Update available (v' + esc(updateState.remoteRelease?.version || CURRENT_VERSION) + ')'
        : updateState.status === 'offline'
          ? 'Offline mode'
          : 'Up to date · Running latest release';
    const statusBadgeColor = updateReady ? '#b45309' : updateState.status === 'offline' ? '#64748b' : '#059669';

    return header('Software Update Center & complete release timeline.')
      + '<section class="panel gl-update-hero" style="border:1px solid var(--line)">'
      + '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:14px">'
      + '<div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">'
      + '<span style="padding:4px 10px;border-radius:999px;font-size:11px;font-weight:750;background:' + statusBadgeColor + ';color:#fff">' + esc(statusText) + '</span>'
      + '<span style="font-size:11.5px;color:var(--muted)">' + (updateState.lastCheckedAt ? 'Last checked: ' + esc(updateState.lastCheckedAt) : 'Auto-checks on load & focus') + '</span>'
      + '</div>'
      + '<h2 style="margin:0 0 4px">Goldleaf ERP v' + esc(CURRENT_VERSION) + '</h2>'
      + '<p class="muted" style="margin:0">Build <code>' + esc(CURRENT_BUILD) + '</code> · Released ' + esc(CURRENT_DATE) + ' · Engine: ' + esc(updateState.swState) + '</p>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
      + (updateReady ? '<button type="button" class="primary" onclick="glApplyUpdate()">⚡ Install Update Now</button>' : '')
      + '<button type="button" class="' + (updateReady ? '' : 'primary') + '" onclick="glCheckForUpdate(true)" ' + (updateState.status === 'checking' ? 'disabled' : '') + '>' + (updateState.status === 'checking' ? 'Checking…' : '↻ Check for Updates') + '</button>'
      + '<button type="button" onclick="glForceHardRefresh()" title="Clears cached shell files and reloads fresh from server">⚡ Force Refresh Cache</button>'
      + '</div>'
      + '</div>'
      + '</section>'
      + '<section class="panel">'
      + '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">'
      + '<h2 style="margin:0">Release Timeline</h2>'
      + '<input type="search" placeholder="Search updates (e.g. Reports, Accounts, Thermal)…" value="' + esc(updateState.search) + '" oninput="glSetUpdateSearch(this.value)" style="min-width:240px;max-width:340px;min-height:36px;padding:6px 10px;border-radius:8px;border:1px solid var(--line)">'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">'
      + RELEASE_CATEGORIES.map(cat => '<button type="button" class="' + (updateState.category === cat ? 'primary' : '') + '" style="min-height:32px;padding:4px 10px;font-size:11.5px;border-radius:999px" onclick="glSetUpdateFilter(\'' + esc(cat) + '\')">' + esc(cat) + '</button>').join('')
      + '</div>'
      + '<div id="glReleaseTimeline">' + renderReleaseCards() + '</div>'
      + '</section>';
  };

  window.appVersionFooter = function () {
    return '<div class="app-version"><span>Goldleaf v' + CURRENT_VERSION + ' · ' + CURRENT_DATE + '</span><button type="button" onclick="go(\'Update History\')">Update Center</button></div>';
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_ACTIVATED') {
        detectSwStatus();
        if (typeof window.erpSyncUpdatePill === 'function') window.erpSyncUpdatePill();
      }
    });
  }

  window.addEventListener('load', () => {
    detectSwStatus();
    setTimeout(() => {
      if (navigator.onLine) window.glCheckForUpdate(false);
    }, 2500);
  });
})();
