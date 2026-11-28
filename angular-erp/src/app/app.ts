import {
  Component,
  VERSION,
  PLATFORM_ID,
  inject,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  ElementRef,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

type AppLang = 'en' | 'ta';

interface QuickModule {
  id: string;
  label: string;
  taLabel: string;
  category: string;
  icon: string;
  standalone?: boolean;
  action?: 'sync' | 'update' | 'scan';
}

interface CameraDeviceItem {
  deviceId: string;
  label: string;
}

interface TagSuggestion {
  code: string;
  huid: string;
  product: string;
  metal: string;
  netWeight: string;
  purity: string;
}

const QUICK_MODULES: QuickModule[] = [
  { id: '__scan__', label: 'Open Live QR / Barcode Tag Scanner', taLabel: 'QR / பார்கோடு ஸ்கேனர் திற', category: 'Instant Action', icon: '▣', action: 'scan' },
  { id: '__sync__', label: 'Sync Cloud, Rates & Access Now (Zero Reload)', taLabel: 'கிளவுட் & விலை உடனடி ஒத்திசைவு', category: 'Instant Action', icon: '↻', action: 'sync' },
  { id: 'Dashboard', label: 'Dashboard Overview', taLabel: 'முகப்பு', category: 'Core', icon: '⌂' },
  { id: 'Sales Entry', label: 'Sales Bill & Sales Return', taLabel: 'விற்பனை & திருப்பம்', category: 'Counter', icon: '＋' },
  { id: 'Estimation / Quotation', label: 'Estimation / Quotation (80mm POS)', taLabel: 'மதிப்பீடு / கொட்டேஷன்', category: 'Counter', icon: '🧾', standalone: true },
  { id: 'Rate Book', label: 'Rate Book & 24K Cash Rate', taLabel: 'விலை பட்டியல்', category: 'Rates', icon: '⚖' },
  { id: 'Stock & Tagging', label: 'Stock, Lot Entry & QR Tagging', taLabel: 'இருப்பு & டேக்கிங்', category: 'Inventory', icon: '🏷', standalone: true },
  { id: 'Products', label: 'Products & Sub-Products', taLabel: 'பொருட்கள்', category: 'Inventory', icon: '◈', standalone: true },
  { id: 'Chit', label: 'Chit Schemes & Passbooks', taLabel: 'சீட்டு திட்டம்', category: 'Schemes', icon: '📅', standalone: true },
  { id: 'Jewel Loan', label: 'Jewel Loan & Auction', taLabel: 'நகை கடன் & ஏலம்', category: 'Finance', icon: '🔐' },
  { id: 'Accounts', label: 'Accounts, Ledgers & Day Book', taLabel: 'கணக்குகள் & பேரேடு', category: 'Finance', icon: '📒' },
  { id: 'Reports', label: 'All 129 ERP Reports Hub', taLabel: 'அனைத்து அறிக்கைகள்', category: 'Analytics', icon: '📊' },
  { id: 'Register', label: 'Customer / Party Register', taLabel: 'வாடிக்கையாளர் பதிவு', category: 'CRM', icon: '👤' },
  { id: 'Payments', label: 'Receipts & Payments', taLabel: 'கட்டணங்கள்', category: 'Finance', icon: '↙' },
  { id: 'Settings', label: 'Settings, Thermal Print & Cloud', taLabel: 'அமைப்புகள்', category: 'System', icon: '⚙' },
  { id: 'Update History', label: 'Software Update Center', taLabel: 'புதுப்பிப்பு மையம்', category: 'System', icon: '⚡' }
];

const ICON_SVGS: Record<string, string> = {
  qr: '<svg class="gl-ng-ico gl-ng-ico-qr" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="4" height="4" rx=".5"/><rect x="13" y="7" width="4" height="4" rx=".5"/><rect x="7" y="13" width="4" height="4" rx=".5"/><path d="M13 13h2v2h-2zM15 15h2v2h-2z"/></svg>',
  plus: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  save: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  print: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  pdf: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  whatsapp: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  edit: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  search: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  user: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  gold: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 18 3 22 9 12 22 2 9"/><line x1="2" y1="9" x2="22" y2="9"/></svg>',
  tag: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  receipt: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  returnIco: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  wallet: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  calendar: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  shield: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  chart: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  eye: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  home: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  settings: '<svg class="gl-ng-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

const EMOJI_OR_SYMBOL_START = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}＋−✕×✓✎💾📄📲⚡🪙💰🏷▣⌕⌂♙↙▤◷◈⚙◇↪⚖⚖️🧾📒📊👤🔐📅]/u;

@Component({
  selector: 'gl-angular-shell',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None
})
export class App implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild('qrVideo') qrVideoRef?: ElementRef<HTMLVideoElement>;

  readonly ngVersion = VERSION.full;
  readonly ssrHydrated = signal<boolean>(false);
  readonly lang = signal<AppLang>('en');
  readonly activePage = signal<string>('Dashboard');
  readonly cmdOpen = signal<boolean>(false);
  readonly cmdQuery = signal<string>('');
  readonly selectedIndex = signal<number>(0);

  // Activity, connectivity & update signals
  readonly progressVisible = signal<boolean>(false);
  readonly progressScale = signal<number>(0);
  readonly netBanner = signal<'' | 'offline' | 'online'>('');
  readonly updateOverlayVisible = signal<boolean>(false);
  readonly updateTitle = signal<string>('');
  readonly updateSubtitle = signal<string>('');
  readonly updatePercent = signal<number>(0);

  // Advanced Angular v22 QR & Barcode Scanner signals
  readonly qrOpen = signal<boolean>(false);
  readonly qrTitle = signal<string>('Scan QR / Tag Barcode');
  readonly qrStatus = signal<string>('Auto-zoom active • Ready for small jewellery QR');
  readonly qrLocked = signal<boolean>(false);
  readonly qrZoom = signal<number>(2.0);
  readonly qrAutoZoom = signal<boolean>(true);
  readonly qrTorch = signal<boolean>(false);
  readonly qrGlareFilter = signal<boolean>(false);
  readonly qrBatchMode = signal<boolean>(false);
  readonly qrBatchCount = signal<number>(0);
  readonly qrCameras = signal<CameraDeviceItem[]>([]);
  readonly qrSelectedCameraId = signal<string>('');
  readonly qrManualCode = signal<string>('');
  readonly qrRecentCodes = signal<string[]>([]);
  readonly qrMatchedTag = signal<TagSuggestion | null>(null);
  readonly qrFocusPos = signal<{ x: number; y: number } | null>(null);
  readonly qrCatalogTick = signal<number>(0);

  readonly filteredModules = computed(() => {
    const q = this.cmdQuery().trim().toLowerCase();
    if (!q) return QUICK_MODULES;
    return QUICK_MODULES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.taLabel.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  readonly qrTagSuggestions = computed<TagSuggestion[]>(() => {
    this.qrCatalogTick();
    if (!this.isBrowser) return [];
    const q = this.qrManualCode().trim().toLowerCase();
    const w = window as any;
    const docs: any[] = Array.isArray(w.db?.retailDocuments) ? w.db.retailDocuments : [];
    const tags = docs.filter(d => d && (d.kind === 'retail-tagging' || d.type === 'retail-tagging') && d.tagCode);
    const matched = q
      ? tags.filter(t =>
          String(t.tagCode || '').toLowerCase().includes(q) ||
          String(t.huid || '').toLowerCase().includes(q) ||
          String(t.product || '').toLowerCase().includes(q)
        )
      : tags.filter(t => (t.status || 'In stock') === 'In stock');
    return matched.slice(0, 6).map(t => ({
      code: String(t.tagCode || ''),
      huid: String(t.huid || ''),
      product: String(t.product || 'Jewellery'),
      metal: String(t.metalType || 'Gold'),
      netWeight: Number(t.netWeight ?? Math.max(0, (Number(t.grossWeight) || 0) - (Number(t.lessWeight) || 0))).toFixed(3),
      purity: String(t.purity || '92')
    }));
  });

  private progressTimer: any = null;
  private hideProgressTimer: any = null;
  private netBannerTimer: any = null;
  private warmedVersion = '';
  private warmPromise: Promise<string[]> | null = null;
  private activeSyncCount = 0;

  // Icon observer state
  private domObserver: MutationObserver | null = null;
  private iconDecorateTimer: any = null;
  private isDecorating = false;

  // QR scanner engine state
  private qrOnScanCallback: ((code: string) => void) | null = null;
  private qrStream: MediaStream | null = null;
  private qrTrack: MediaStreamTrack | null = null;
  private qrFacing: 'environment' | 'user' = 'environment';
  private hwZoomSupported = false;
  private hwZoomMin = 1.0;
  private hwZoomMax = 1.0;
  private qrScanTimer: any = null;
  private qrAutoZoomTimer: any = null;
  private qrNativeDetector: any = null;
  private qrZxingHelper: any = null;
  private macroCanvas: HTMLCanvasElement | null = null;
  private macroCtx: CanvasRenderingContext2D | null = null;
  private spotterCanvas: HTMLCanvasElement | null = null;
  private spotterCtx: CanvasRenderingContext2D | null = null;
  private lastBatchHit = '';
  private lastBatchTime = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1.0;

  private readonly boundRendered = () => {
    this.syncFromHost();
    this.scheduleIconDecorate();
  };
  private readonly boundSyncStart = () => this.beginActivity();
  private readonly boundSyncEnd = () => this.endActivity();
  private readonly boundOnline = () => this.handleConnectivity(true);
  private readonly boundOffline = () => this.handleConnectivity(false);
  private readonly boundUpdateDetected = (ev: Event) => {
    const ver = (ev as CustomEvent)?.detail?.version || '';
    this.prewarmReleaseInBackground(ver);
  };

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.ssrHydrated.set(true);
    const w = window as any;
    w.glAngularEngineActive = true;
    w.glAngularSsrHydrated = true;
    w.glAngularVersion = this.ngVersion;
    w.glOpenQuickJump = () => this.openCmd();
    w.glNgBeginActivity = () => this.beginActivity();
    w.glNgEndActivity = () => this.endActivity();
    w.glNgPrewarmUpdate = (ver?: string) => this.prewarmReleaseInBackground(ver || '');
    w.glNgApplyHotUpdate = (targetVer?: string) => this.applyHotUpdate(targetVer || '');
    w.glNgSoftRefresh = () => this.triggerDynamicSync();
    w.glNgDecorateIcons = () => this.scheduleIconDecorate();

    // Load recent scanned tags
    try {
      const savedRecent = JSON.parse(sessionStorage.getItem('gl-ng-qr-recent') || '[]');
      if (Array.isArray(savedRecent)) this.qrRecentCodes.set(savedRecent.slice(0, 6));
    } catch (_) {}

    // Upgrade global QR scanner hooks to Angular v22 Advanced Scanner
    const installAngularScanner = () => {
      w.openQrScanner = (opts?: any) => this.openScanner(opts);
      w.closeQrScanner = () => this.closeScanner();
      w.glSetScannerZoom = (z: number) => this.setManualZoom(z);
    };
    installAngularScanner();
    setTimeout(installAngularScanner, 0);
    window.addEventListener('load', installAngularScanner, { once: true });

    this.syncFromHost();
    this.scheduleIconDecorate();

    if (typeof MutationObserver !== 'undefined' && document.body) {
      this.domObserver = new MutationObserver(mutations => {
        if (this.isDecorating) return;
        for (const m of mutations) {
          const t = m.target as HTMLElement | null;
          if (!t || t.closest?.('gl-angular-shell,#pdfPrintArea,#rcTagPrintSheet')) continue;
          if (m.addedNodes.length > 0) {
            this.scheduleIconDecorate();
            break;
          }
        }
      });
      this.domObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('gl:rendered', this.boundRendered);
    window.addEventListener('gl:lang', this.boundRendered);
    window.addEventListener('gl:manual-sync-start', this.boundSyncStart);
    window.addEventListener('gl:manual-sync-end', this.boundSyncEnd);
    window.addEventListener('online', this.boundOnline);
    window.addEventListener('offline', this.boundOffline);
    window.addEventListener('gl:update-detected', this.boundUpdateDetected);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('gl:rendered', this.boundRendered);
    window.removeEventListener('gl:lang', this.boundRendered);
    window.removeEventListener('gl:manual-sync-start', this.boundSyncStart);
    window.removeEventListener('gl:manual-sync-end', this.boundSyncEnd);
    window.removeEventListener('online', this.boundOnline);
    window.removeEventListener('offline', this.boundOffline);
    window.removeEventListener('gl:update-detected', this.boundUpdateDetected);
    this.domObserver?.disconnect();
    this.stopScannerHardware();
    clearInterval(this.progressTimer);
    clearTimeout(this.hideProgressTimer);
    clearTimeout(this.netBannerTimer);
    clearTimeout(this.iconDecorateTimer);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if (this.qrOpen() && ev.key === 'Escape') {
      ev.preventDefault();
      this.closeScanner();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (this.cmdOpen()) {
        this.closeCmd();
      } else {
        this.openCmd();
      }
      return;
    }

    if (!this.cmdOpen()) return;

    const list = this.filteredModules();
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeCmd();
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (list.length) this.selectedIndex.update(i => (i + 1) % list.length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (list.length) this.selectedIndex.update(i => (i - 1 + list.length) % list.length);
    } else if (ev.key === 'Enter') {
      const picked = list[this.selectedIndex()];
      if (picked) {
        ev.preventDefault();
        this.jumpTo(picked);
      }
    }
  }

  // =========================================================================
  // Angular v22 Universal Contextual Icon Decorator (All ERP Pages)
  // =========================================================================
  private scheduleIconDecorate(): void {
    if (!this.isBrowser) return;
    clearTimeout(this.iconDecorateTimer);
    this.iconDecorateTimer = setTimeout(() => this.decorateAllPageIcons(), 24);
  }

  private pickIconKey(text: string, hint = ''): string {
    const s = (text + ' ' + hint).toLowerCase();
    if (/qr|barcode|scan tag|scan qr|camera scan/.test(s)) return 'qr';
    if (/whatsapp|\bwa\b/.test(s)) return 'whatsapp';
    if (/80mm|58mm|print|thermal|slip|passbook/.test(s)) return 'print';
    if (/pdf|a4|a5|export|csv|excel|download/.test(s)) return 'pdf';
    if (/delete|remove|trash/.test(s)) return 'trash';
    if (/\bedit\b|modify/.test(s)) return 'edit';
    if (/return|refund|reverse/.test(s)) return 'returnIco';
    if (/save|apply|submit|confirm|settle|update|convert/.test(s)) return 'save';
    if (/\badd\b|\bnew\b|create|register a /.test(s)) return 'plus';
    if (/search|filter|browse|find|lookup/.test(s)) return 'search';
    if (/view|preview|inspect|details|history/.test(s)) return 'eye';
    if (/old gold|rate|purity|karat|24k|22k|metal|diamond|silver|gold sold|gold taken|pure gold/.test(s)) return 'gold';
    if (/loan|pledge|auction|access|security|super admin|permission/.test(s)) return 'shield';
    if (/chit|scheme|instalment|due|maturity|date|period|monthly/.test(s)) return 'calendar';
    if (/tag|stock|lot|huid|product|ornament|packet|inventory|pieces/.test(s)) return 'tag';
    if (/payment|receipt|collect|cash|cheque|gpay|upi|advance|split|bank/.test(s)) return 'wallet';
    if (/customer|party|parties|nominee|member|supplier|user|seat/.test(s)) return 'user';
    if (/sale|bill|invoice|quotation|estimate/.test(s)) return 'receipt';
    if (/ledger|summary|report|balance|total|owing|account|day book|profit/.test(s)) return 'chart';
    if (/home|dashboard/.test(s)) return 'home';
    if (/setting|backup|cloud|theme/.test(s)) return 'settings';
    return '';
  }

  private decorateAllPageIcons(): void {
    if (!this.isBrowser || this.isDecorating) return;
    if (document.body?.classList.contains('printing-customer-bill') || document.body?.classList.contains('goldleaf-tag-printing')) return;

    this.isDecorating = true;
    try {
      const roots = [
        document.getElementById('app'),
        ...Array.from(document.querySelectorAll('.retail-modal:not(.gl-ng-qr-sheet)'))
      ].filter(Boolean) as HTMLElement[];

      for (const root of roots) {
        // 1. Auto-attach a contextual "Scan QR" button next to standalone tag/barcode/HUID search or entry inputs across all pages
        root.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="number"]):not([type="date"]):not([type="datetime-local"]):not([data-gl-qr-attached])').forEach(inp => {
          inp.setAttribute('data-gl-qr-attached', '1');
          if (inp.closest('.rc-scan-wrap,.rc-q-tag-wrap,.rb-tag-field-unified,#rcQuoteTagBar,gl-angular-shell,#pdfPrintArea,#rcTagPrintSheet')) return;
          const attrBlob = ((inp.name || '') + ' ' + (inp.id || '') + ' ' + (inp.placeholder || '')).toLowerCase();
          if (!/(tagcode|tag_code|barcode|\bhuid\b|scan tag|search tag|tag \/ huid|qr)/.test(attrBlob)) return;
          const parent = inp.parentElement;
          if (!parent || parent.querySelector('.gl-scan-btn,[onclick*="QrScanner"],[onclick*="ScanTag"]')) return;

          const wrap = document.createElement('div');
          wrap.className = 'gl-ng-inline-qr-wrap';
          inp.before(wrap);
          wrap.appendChild(inp);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'gl-ng-scan-qr-pill';
          btn.setAttribute('data-gl-ico', '1');
          btn.title = 'Scan QR / Barcode';
          btn.setAttribute('aria-label', 'Scan QR');
          btn.innerHTML = ICON_SVGS['qr'] + '<span>Scan QR</span>';
          btn.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            this.openScanner({
              title: 'Scan QR / Tag Code',
              onScan: (code: string) => {
                inp.value = code;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          });
          wrap.appendChild(btn);
        });

        // 2. Upgrade existing scan buttons so every QR trigger clearly shows crisp QR icon (and "Scan QR" label where text exists)
        root.querySelectorAll<HTMLButtonElement>('button[onclick*="QrScanner"]:not([data-gl-ico]),button[onclick*="ScanTag"]:not([data-gl-ico]),button.gl-scan-btn:not([data-gl-ico]),button.rc-quote-scan-tab:not([data-gl-ico])').forEach(btn => {
          btn.setAttribute('data-gl-ico', '1');
          const rawTxt = (btn.textContent || '').trim();
          const isIconOnly = btn.classList.contains('gl-scan-btn') || btn.classList.contains('rc-quote-scan-tab') || rawTxt === '' || rawTxt === '▣';
          if (isIconOnly) {
            if (!btn.querySelector('svg')) btn.innerHTML = ICON_SVGS['qr'];
            if (!btn.title) btn.title = 'Scan QR / Barcode';
          } else {
            const cleanTxt = rawTxt.replace(/^[▣🏷📷]\s*/u, '').trim();
            const finalLbl = /qr/i.test(cleanTxt) ? cleanTxt : 'Scan QR';
            btn.innerHTML = ICON_SVGS['qr'] + '<span>' + finalLbl + '</span>';
            btn.classList.add('gl-ng-has-ico');
          }
        });

        // 3. Decorate Section Headings (.panel h2, .top h1, .rb-header h1) across all pages
        root.querySelectorAll<HTMLElement>('.top h1:not([data-gl-ico]), .rb-header h1:not([data-gl-ico]), .panel h2:not([data-gl-ico]), .rb-section-head h2:not([data-gl-ico]), .rc-section-title h2:not([data-gl-ico])').forEach(h => {
          h.setAttribute('data-gl-ico', '1');
          if (h.closest('#pdfPrintArea,#rcTagPrintSheet,.c2-auth-card')) return;
          if (h.querySelector('svg,.gl-ng-ico')) return;
          const txt = (h.textContent || '').trim();
          if (!txt || EMOJI_OR_SYMBOL_START.test(txt)) return;
          const key = this.pickIconKey(txt);
          if (key && ICON_SVGS[key]) {
            h.insertAdjacentHTML('afterbegin', '<span class="gl-ng-head-ico" aria-hidden="true">' + ICON_SVGS[key] + '</span>');
            h.classList.add('gl-ng-head-with-ico');
          }
        });

        // 4. Decorate KPI / Dashboard Card Labels (.card label, .erp-metric > span)
        root.querySelectorAll<HTMLElement>('.cards .card > label:not([data-gl-ico]), .erp-metric > span:first-child:not([data-gl-ico])').forEach(lbl => {
          lbl.setAttribute('data-gl-ico', '1');
          if (lbl.querySelector('svg,.gl-ng-ico')) return;
          const txt = (lbl.textContent || '').trim();
          if (!txt || EMOJI_OR_SYMBOL_START.test(txt)) return;
          const key = this.pickIconKey(txt, 'summary');
          if (key && ICON_SVGS[key]) {
            lbl.insertAdjacentHTML('afterbegin', ICON_SVGS[key]);
            lbl.classList.add('gl-ng-lbl-with-ico');
          }
        });

        // 5. Decorate Action Buttons, Tabs & Adjustment Buttons across all pages
        root.querySelectorAll<HTMLButtonElement>('button:not([data-gl-ico])').forEach(btn => {
          btn.setAttribute('data-gl-ico', '1');
          if (btn.closest('#pdfPrintArea,#rcTagPrintSheet,.c2-tabs,.business-mode,.rc-gst-pill')) return;
          if (btn.querySelector('svg,.gl-ng-ico,img')) return;
          const txt = (btn.textContent || '').trim();
          if (!txt || txt.length <= 2 || txt === '×' || txt === '✕' || EMOJI_OR_SYMBOL_START.test(txt)) return;
          const hint = (btn.getAttribute('onclick') || '') + ' ' + (btn.className || '');
          const key = this.pickIconKey(txt, hint);
          if (!key || !ICON_SVGS[key]) return;
          const firstSpan = btn.querySelector(':scope > span:first-child');
          if (firstSpan && btn.classList.contains('exchange-toggle')) {
            firstSpan.insertAdjacentHTML('afterbegin', ICON_SVGS[key] + ' ');
          } else {
            btn.insertAdjacentHTML('afterbegin', ICON_SVGS[key]);
            btn.classList.add('gl-ng-has-ico');
          }
        });
      }
    } catch (_) {
    } finally {
      this.isDecorating = false;
    }
  }

  // =========================================================================
  // Advanced Angular v22 Live QR, Barcode & HUID Scanner
  // =========================================================================
  openScanner(opts?: any): void {
    if (!this.isBrowser) return;
    const cfg = typeof opts === 'function' ? { onScan: opts } : (opts || {});
    this.qrOnScanCallback = cfg.onScan || ((code: string) => console.log('Scanned:', code));
    this.qrTitle.set(cfg.title || 'Scan QR / Jewellery Tag');
    this.qrStatus.set('Starting Full-HD camera • Auto-zoom ready');
    this.qrLocked.set(false);
    this.qrZoom.set(2.0);
    this.qrAutoZoom.set(true);
    this.qrTorch.set(false);
    this.qrBatchCount.set(0);
    this.qrManualCode.set('');
    this.qrMatchedTag.set(null);
    this.qrCatalogTick.update(v => v + 1);
    this.qrOpen.set(true);

    this.ensureQrDecoders();
    setTimeout(() => {
      this.enumerateQrCameras();
      this.startQrCameraStream();
    }, 30);
  }

  closeScanner(): void {
    this.stopScannerHardware();
    this.qrOpen.set(false);
    this.qrLocked.set(false);
  }

  toggleQrBatchMode(): void {
    this.qrBatchMode.update(v => !v);
    const on = this.qrBatchMode();
    this.qrStatus.set(on ? 'Batch Mode ON • Scan multiple tags continuously' : 'Single Scan Mode • Auto-closes on hit');
  }

  toggleQrGlareFilter(): void {
    this.qrGlareFilter.update(v => !v);
  }

  async toggleQrTorch(): Promise<void> {
    const next = !this.qrTorch();
    this.qrTorch.set(next);
    if (this.qrTrack) {
      try {
        await (this.qrTrack as any).applyConstraints({ advanced: [{ torch: next }] });
      } catch (_) {}
    }
  }

  flipQrCamera(): void {
    const cams = this.qrCameras();
    if (cams.length > 1) {
      const curIdx = cams.findIndex(c => c.deviceId === this.qrSelectedCameraId());
      const nextCam = cams[(curIdx + 1) % cams.length];
      if (nextCam) {
        this.qrSelectedCameraId.set(nextCam.deviceId);
        this.startQrCameraStream(nextCam.deviceId);
        return;
      }
    }
    this.qrFacing = this.qrFacing === 'environment' ? 'user' : 'environment';
    this.qrSelectedCameraId.set('');
    this.startQrCameraStream();
  }

  onSelectQrCamera(deviceId: string): void {
    this.qrSelectedCameraId.set(deviceId);
    this.startQrCameraStream(deviceId);
  }

  setManualZoom(z: number): void {
    this.qrAutoZoom.set(false);
    this.applyQrZoom(z, true);
    this.qrStatus.set('Optical zoom locked at ' + this.qrZoom().toFixed(1) + 'x');
  }

  enableAutoZoom(): void {
    this.qrAutoZoom.set(true);
    const nextZ = this.qrZoom() < 2.0 ? 2.2 : this.qrZoom();
    this.applyQrZoom(nextZ, false);
    this.qrStatus.set('Smart Auto-Zoom (' + this.qrZoom().toFixed(1) + 'x) • Scanning small QR');
  }

  onZoomSliderInput(raw: string | number): void {
    this.setManualZoom(Number(raw) || 1.0);
  }

  onStageTap(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    if (target?.closest('button,input,select,.gl-ng-qr-zoombar')) return;
    const stage = ev.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    this.qrFocusPos.set({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    setTimeout(() => this.qrFocusPos.set(null), 650);
    if (this.qrTrack) {
      try {
        (this.qrTrack as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      } catch (_) {}
    }
    if (this.qrZoom() < 2.6) {
      this.applyQrZoom(2.6, false);
      this.qrStatus.set('Focused & zoomed to 2.6x for tag detail');
    }
  }

  onStageTouchStart(ev: TouchEvent): void {
    if (ev.touches && ev.touches.length === 2) {
      this.pinchStartDist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
      this.pinchStartZoom = this.qrZoom();
    }
  }

  onStageTouchMove(ev: TouchEvent): void {
    if (ev.touches && ev.touches.length === 2 && this.pinchStartDist > 12) {
      const dist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
      this.setManualZoom(this.pinchStartZoom * (dist / this.pinchStartDist));
    }
  }

  submitManualQrCode(codeOverride?: string): void {
    const clean = String(codeOverride ?? this.qrManualCode() ?? '').trim();
    if (!clean) return;
    this.resolveQrHit(clean);
  }

  async onQrFileSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.qrStatus.set('Analyzing uploaded tag image across 5 macro scales…');
    this.ensureQrDecoders();

    if (this.qrZxingHelper && typeof this.qrZxingHelper.scanFile === 'function') {
      try {
        const direct = await this.qrZxingHelper.scanFile(file, false);
        if (direct) {
          this.resolveQrHit(direct);
          input.value = '';
          return;
        }
      } catch (_) {}
    }

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const passes = [
        { scale: 1.0, filter: 'none' },
        { scale: 1.8, filter: 'contrast(1.35)' },
        { scale: 2.8, filter: 'contrast(1.55)' },
        { scale: 3.6, filter: 'contrast(1.75) grayscale(1)' },
        { scale: 1.4, filter: 'invert(1) contrast(1.6) grayscale(1)' }
      ];
      for (const p of passes) {
        if (!this.macroCtx || !this.macroCanvas) break;
        const cw = Math.floor(iw / p.scale);
        const ch = Math.floor(ih / p.scale);
        const sx = Math.floor((iw - cw) * 0.5);
        const sy = Math.floor((ih - ch) * 0.5);
        this.macroCtx.save();
        this.macroCtx.clearRect(0, 0, 720, 720);
        this.macroCtx.filter = p.filter;
        this.macroCtx.drawImage(img, sx, sy, cw, ch, 0, 0, 720, 720);
        this.macroCtx.restore();

        const decoded = await this.decodeMacroCanvas();
        if (decoded) {
          URL.revokeObjectURL(url);
          input.value = '';
          this.resolveQrHit(decoded);
          return;
        }
      }
      URL.revokeObjectURL(url);
    } catch (_) {}

    input.value = '';
    this.qrStatus.set('No QR detected in photo • Try closer photo or type code below');
    const w = window as any;
    if (typeof w.say === 'function') w.say('Could not detect a QR code or barcode in that image.');
  }

  private ensureQrDecoders(): void {
    const w = window as any;
    if (!w.Html5Qrcode && !document.querySelector('script[data-goldleaf-html5qr]')) {
      const s = document.createElement('script');
      s.src = './html5-qrcode.min.js?v=2.10.54';
      s.async = true;
      s.dataset['goldleafHtml5qr'] = '1';
      s.onload = () => this.initZxingInstance();
      document.head.appendChild(s);
    } else {
      this.initZxingInstance();
    }

    if (!this.macroCanvas) {
      this.macroCanvas = document.createElement('canvas');
      this.macroCanvas.width = 720;
      this.macroCanvas.height = 720;
      this.macroCtx = this.macroCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.spotterCanvas) {
      this.spotterCanvas = document.createElement('canvas');
      this.spotterCanvas.width = 96;
      this.spotterCanvas.height = 96;
      this.spotterCtx = this.spotterCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.qrNativeDetector && 'BarcodeDetector' in window) {
      try {
        this.qrNativeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix']
        });
      } catch (_) {}
    }
  }

  private initZxingInstance(): void {
    const w = window as any;
    if (this.qrZxingHelper || !w.Html5Qrcode) return;
    try {
      let host = document.getElementById('glQrHiddenZxingHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'glQrHiddenZxingHost';
        host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:10px;height:10px;overflow:hidden;pointer-events:none;opacity:0';
        document.body.appendChild(host);
      }
      this.qrZxingHelper = new w.Html5Qrcode('glQrHiddenZxingHost', { verbose: false });
    } catch (_) {}
  }

  private async enumerateQrCameras(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || ('Camera ' + (idx + 1))
        }));
      this.qrCameras.set(cams);
    } catch (_) {}
  }

  private async startQrCameraStream(explicitDeviceId?: string): Promise<void> {
    this.stopScannerHardware();
    if (!navigator.mediaDevices?.getUserMedia) {
      this.qrStatus.set('Camera unavailable • Use Quick Tag Search or Upload Photo below');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      const videoConstraints: any = explicitDeviceId
        ? {
            deviceId: { exact: explicitDeviceId },
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 },
            focusMode: { ideal: 'continuous' }
          }
        : {
            facingMode: { ideal: this.qrFacing },
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 },
            focusMode: { ideal: 'continuous' }
          };
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    } catch (_) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: explicitDeviceId ? { deviceId: { exact: explicitDeviceId } } : { facingMode: { ideal: this.qrFacing } },
          audio: false
        });
      } catch (__) {
        this.qrStatus.set('Camera permission needed • Use Quick Search or Upload Photo below');
        return;
      }
    }

    if (!this.qrOpen()) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    this.qrStream = stream;
    await this.enumerateQrCameras();

    const video = this.qrVideoRef?.nativeElement;
    if (!video) return;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (_) {}

    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      this.qrTrack = tracks[0];
      const settings = this.qrTrack.getSettings?.() || {};
      if (settings.deviceId) this.qrSelectedCameraId.set(settings.deviceId);
      this.hwZoomSupported = false;
      this.hwZoomMin = 1.0;
      this.hwZoomMax = 1.0;
      try {
        const caps: any = (this.qrTrack as any).getCapabilities?.();
        if (caps?.zoom) {
          this.hwZoomSupported = true;
          this.hwZoomMin = typeof caps.zoom === 'object' ? (caps.zoom.min || 1.0) : 1.0;
          this.hwZoomMax = typeof caps.zoom === 'object' ? (caps.zoom.max || 5.0) : Number(caps.zoom) || 5.0;
        }
      } catch (_) {}
      try {
        (this.qrTrack as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }]
        }).catch(() => {});
      } catch (_) {}
    }

    setTimeout(() => {
      if (this.qrOpen() && this.qrAutoZoom()) {
        this.applyQrZoom(2.0, false);
        this.qrStatus.set('Auto-zoom 2.0x • Hold jewellery tag QR inside frame');
      }
    }, 180);

    this.startQrDecodeLoops(video);
  }

  private applyQrZoom(level: number, isManual: boolean): void {
    const z = Math.round(Math.max(1.0, Math.min(5.0, Number(level) || 1.0)) * 10) / 10;
    this.qrZoom.set(z);

    let appliedHw = 1.0;
    if (this.hwZoomSupported && this.qrTrack) {
      appliedHw = Math.max(this.hwZoomMin, Math.min(this.hwZoomMax, z));
      try {
        (this.qrTrack as any).applyConstraints({ advanced: [{ zoom: appliedHw }] }).catch(() => {});
      } catch (_) {}
    }

    const residual = Math.max(1.0, Math.min(5.0, z / appliedHw));
    const video = this.qrVideoRef?.nativeElement;
    if (video) {
      video.style.transformOrigin = 'center center';
      video.style.transition = isManual ? 'transform 0.12s ease-out' : 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
      video.style.transform = residual > 1.01 ? `scale(${residual.toFixed(2)})` : 'scale(1)';
    }
  }

  private startQrDecodeLoops(video: HTMLVideoElement): void {
    let pass = 0;
    const autoSteps = [2.0, 2.7, 3.4, 4.0, 2.3];
    let stepIdx = 0;

    this.qrScanTimer = setInterval(async () => {
      if (!this.qrOpen() || (this.qrLocked() && !this.qrBatchMode()) || video.readyState < 2 || !video.videoWidth) return;

      // Fast direct native pass
      if (this.qrNativeDetector && pass % 2 === 0) {
        try {
          const hits = await this.qrNativeDetector.detect(video);
          if (hits?.length && hits[0].rawValue) {
            this.resolveQrHit(hits[0].rawValue);
            return;
          }
        } catch (_) {}
      }

      if (!this.macroCtx || !this.macroCanvas) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const minDim = Math.min(vw, vh);
      const mode = pass % 4;
      pass++;

      let cropZoom = this.qrZoom();
      if (mode === 1) cropZoom = Math.max(cropZoom, 2.6);
      else if (mode === 2) cropZoom = Math.max(cropZoom * 1.35, 3.8);
      else if (mode === 3) cropZoom = Math.max(cropZoom, 2.4);

      const side = Math.max(110, Math.min(minDim, Math.floor(minDim / Math.max(1.0, Math.min(4.8, cropZoom)))));
      const sx = Math.floor((vw - side) * 0.5);
      const sy = Math.floor((vh - side) * 0.5);

      try {
        this.macroCtx.save();
        this.macroCtx.clearRect(0, 0, 720, 720);
        if (mode === 1 || this.qrGlareFilter()) {
          this.macroCtx.filter = 'contrast(1.42) brightness(1.02)';
        } else if (mode === 2) {
          this.macroCtx.filter = 'contrast(1.7) grayscale(1)';
        } else if (mode === 3) {
          // Inverted foil/black-tag pass for shiny gold or dark laser-etched tags
          this.macroCtx.filter = 'invert(1) contrast(1.6) grayscale(1)';
        } else {
          this.macroCtx.filter = 'none';
        }
        this.macroCtx.drawImage(video, sx, sy, side, side, 0, 0, 720, 720);
        this.macroCtx.restore();

        const decoded = await this.decodeMacroCanvas();
        if (decoded) {
          this.resolveQrHit(decoded);
        }
      } catch (_) {}
    }, 105);

    this.qrAutoZoomTimer = setInterval(() => {
      if (!this.qrOpen() || !this.qrAutoZoom() || video.readyState < 2) return;
      const density = this.detectCenterContrast(video);
      if (density > 0.15) {
        const nextZ = this.qrZoom() < 2.6 ? 2.8 : (this.qrZoom() < 3.4 ? 3.6 : 2.5);
        this.applyQrZoom(nextZ, false);
        this.qrStatus.set('Small tag QR spotted • Auto-zooming ' + nextZ.toFixed(1) + 'x');
      } else {
        stepIdx = (stepIdx + 1) % autoSteps.length;
        const nextZ = autoSteps[stepIdx];
        this.applyQrZoom(nextZ, false);
        this.qrStatus.set('Auto-zoom ' + nextZ.toFixed(1) + 'x • Scanning tag QR / Barcode…');
      }
    }, 950);
  }

  private async decodeMacroCanvas(): Promise<string> {
    if (!this.macroCanvas) return '';
    if (this.qrNativeDetector) {
      try {
        const hits = await this.qrNativeDetector.detect(this.macroCanvas);
        if (hits?.length && hits[0].rawValue) return String(hits[0].rawValue).trim();
      } catch (_) {}
    }
    if (this.qrZxingHelper?.qrcode?.decodeAsync) {
      try {
        const zHit = await this.qrZxingHelper.qrcode.decodeAsync(this.macroCanvas);
        if (zHit?.text) return String(zHit.text).trim();
      } catch (_) {}
    }
    return '';
  }

  private detectCenterContrast(video: HTMLVideoElement): number {
    if (!this.spotterCtx || !video.videoWidth) return 0;
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const side = Math.min(vw, vh) * 0.5;
      this.spotterCtx.drawImage(video, (vw - side) * 0.5, (vh - side) * 0.5, side, side, 0, 0, 96, 96);
      const data = this.spotterCtx.getImageData(0, 0, 96, 96).data;
      let transitions = 0;
      let checks = 0;
      for (let y = 24; y < 72; y += 2) {
        for (let x = 24; x < 72; x += 2) {
          const i = (y * 96 + x) * 4;
          const l1 = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          const l2 = data[i + 4] * 0.3 + data[i + 5] * 0.59 + data[i + 6] * 0.11;
          const l3 = data[i + 384] * 0.3 + data[i + 385] * 0.59 + data[i + 386] * 0.11;
          if (Math.abs(l1 - l2) > 26 || Math.abs(l1 - l3) > 26) transitions++;
          checks++;
        }
      }
      return checks > 0 ? transitions / checks : 0;
    } catch (_) {
      return 0;
    }
  }

  private resolveQrHit(rawCode: string): void {
    const clean = String(rawCode || '').trim();
    if (!clean) return;

    const now = Date.now();
    if (this.qrBatchMode() && clean === this.lastBatchHit && now - this.lastBatchTime < 1800) {
      return;
    }
    this.lastBatchHit = clean;
    this.lastBatchTime = now;

    // Lookup matching tag preview
    const w = window as any;
    const docs: any[] = Array.isArray(w.db?.retailDocuments) ? w.db.retailDocuments : [];
    const found = docs.find(
      d =>
        d &&
        (d.kind === 'retail-tagging' || d.type === 'retail-tagging') &&
        (String(d.tagCode || '').toLowerCase() === clean.toLowerCase() ||
          String(d.huid || '').toLowerCase() === clean.toLowerCase())
    );
    if (found) {
      this.qrMatchedTag.set({
        code: String(found.tagCode || clean),
        huid: String(found.huid || ''),
        product: String(found.product || 'Jewellery'),
        metal: String(found.metalType || 'Gold'),
        netWeight: Number(found.netWeight ?? Math.max(0, (Number(found.grossWeight) || 0) - (Number(found.lessWeight) || 0))).toFixed(3),
        purity: String(found.purity || '92')
      });
    } else {
      this.qrMatchedTag.set(null);
    }

    // Save to recent list
    const updatedRecent = [clean, ...this.qrRecentCodes().filter(c => c !== clean)].slice(0, 6);
    this.qrRecentCodes.set(updatedRecent);
    try {
      sessionStorage.setItem('gl-ng-qr-recent', JSON.stringify(updatedRecent));
    } catch (_) {}

    this.playQrBeep();
    this.qrLocked.set(true);

    if (this.qrBatchMode()) {
      this.qrBatchCount.update(c => c + 1);
      this.qrStatus.set(`✓ Scanned #${this.qrBatchCount()}: ${clean} • Ready for next tag`);
      try {
        this.qrOnScanCallback?.(clean);
      } catch (_) {}
      setTimeout(() => this.qrLocked.set(false), 450);
    } else {
      this.qrStatus.set('✓ Scanned: ' + clean);
      const cb = this.qrOnScanCallback;
      setTimeout(() => {
        this.closeScanner();
        try {
          cb?.(clean);
        } catch (_) {}
      }, 150);
    }
  }

  private playQrBeep(): void {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.055);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      }
    } catch (_) {}
    try {
      navigator.vibrate?.([35, 20, 45]);
    } catch (_) {}
  }

  private stopScannerHardware(): void {
    clearInterval(this.qrScanTimer);
    clearInterval(this.qrAutoZoomTimer);
    this.qrScanTimer = null;
    this.qrAutoZoomTimer = null;
    this.qrTrack = null;
    if (this.qrStream) {
      try {
        this.qrStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.qrStream = null;
    }
  }

  // =========================================================================
  // Command Palette, Sync & Hot Update
  // =========================================================================
  onQueryChange(val: string): void {
    this.cmdQuery.set(val);
    this.selectedIndex.set(0);
  }

  syncFromHost(): void {
    if (!this.isBrowser) return;
    try {
      const savedLang = localStorage.getItem('goldleaf-lang') === 'ta' ? 'ta' : 'en';
      if (this.lang() !== savedLang) this.lang.set(savedLang);

      const w = window as any;
      const pageName = document.body?.dataset?.['erpPage'] || w.page || 'Dashboard';
      if (this.activePage() !== pageName) this.activePage.set(pageName);
    } catch (_) {}
  }

  beginActivity(): void {
    if (!this.isBrowser) return;
    this.activeSyncCount++;
    clearTimeout(this.hideProgressTimer);
    if (!this.progressVisible()) {
      this.progressScale.set(0.18);
      this.progressVisible.set(true);
    }
    clearInterval(this.progressTimer);
    this.progressTimer = setInterval(() => {
      const cur = this.progressScale();
      if (cur < 0.88) {
        this.progressScale.set(Math.min(0.88, cur + (0.9 - cur) * 0.18));
      }
    }, 120);
  }

  endActivity(): void {
    if (!this.isBrowser) return;
    this.activeSyncCount = Math.max(0, this.activeSyncCount - 1);
    if (this.activeSyncCount > 0) return;
    clearInterval(this.progressTimer);
    this.progressScale.set(1);
    this.hideProgressTimer = setTimeout(() => {
      this.progressVisible.set(false);
      this.progressScale.set(0);
    }, 220);
  }

  private handleConnectivity(isOnline: boolean): void {
    if (!this.isBrowser) return;
    clearTimeout(this.netBannerTimer);
    if (!isOnline) {
      this.netBanner.set('offline');
    } else {
      this.netBanner.set('online');
      this.triggerDynamicSync(false);
      this.netBannerTimer = setTimeout(() => this.netBanner.set(''), 2400);
    }
  }

  async triggerDynamicSync(announce = true): Promise<void> {
    if (!this.isBrowser) return;
    const w = window as any;
    this.beginActivity();
    try {
      if (typeof w.platformRefresh === 'function') {
        await w.platformRefresh(announce);
      } else if (typeof w.pullCloud === 'function') {
        await w.pullCloud();
        if (typeof w.render === 'function') w.render();
      }
    } finally {
      this.endActivity();
    }
  }

  private extractShellUrls(html: string): string[] {
    const urls = new Set<string>(['./', './index.html']);
    const attrRegex = /(?:src|href)=["'](\.\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(html)) !== null) {
      if (m[1]) urls.add(m[1]);
    }
    return [...urls];
  }

  prewarmReleaseInBackground(versionHint = ''): Promise<string[]> {
    if (!this.isBrowser) return Promise.resolve([]);
    if (this.warmPromise && (this.warmedVersion === versionHint || !versionHint)) {
      return this.warmPromise;
    }
    this.warmedVersion = versionHint;
    this.warmPromise = (async () => {
      try {
        const res = await fetch('./index.html?_prewarm=' + Date.now(), { cache: 'no-cache' });
        if (!res.ok) return [];
        const html = await res.text();
        const urls = this.extractShellUrls(html);

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'PREWARM_URLS', urls });
        }

        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
          const slice = urls.slice(i, i + batchSize);
          await Promise.allSettled(slice.map(u => fetch(u, { cache: 'reload' })));
        }
        return urls;
      } catch (_) {
        return [];
      }
    })();
    return this.warmPromise;
  }

  async applyHotUpdate(targetVer: string): Promise<void> {
    if (!this.isBrowser) return;
    const w = window as any;
    const ver = targetVer || w.GOLDLEAF_VERSION || '';
    this.updateTitle.set('Updating Goldleaf ERP' + (ver ? ' to v' + ver : '') + '…');
    this.updateSubtitle.set('Pre-warming latest modules in background for an instant zero-lag switch.');
    this.updatePercent.set(22);
    this.updateOverlayVisible.set(true);

    try {
      const pctTimer = setInterval(() => {
        const cur = this.updatePercent();
        if (cur < 90) this.updatePercent.set(cur + 9);
      }, 90);

      await Promise.race([
        this.prewarmReleaseInBackground(ver),
        new Promise(resolve => setTimeout(resolve, 1800))
      ]);

      clearInterval(pctTimer);
      this.updatePercent.set(100);
      this.updateSubtitle.set('Switching instantaneously — your saved data is intact.');

      let reloaded = false;
      const finishReload = () => {
        if (reloaded) return;
        reloaded = true;
        const url = new URL(window.location.href);
        url.searchParams.delete('_upd');
        url.searchParams.set('gl_fresh', '1');
        window.location.replace(url.toString());
      };

      if ('serviceWorker' in navigator) {
        const reg = w.glSwRegistration || (await navigator.serviceWorker.getRegistration().catch(() => null));
        if (reg) {
          await reg.update().catch(() => {});
          const waiting = w.glPendingWorker || reg.waiting;
          if (waiting) {
            navigator.serviceWorker.addEventListener('controllerchange', finishReload, { once: true });
            waiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(finishReload, 220);
            return;
          }
        }
      }

      setTimeout(finishReload, 80);
    } catch (_) {
      window.location.reload();
    }
  }

  openCmd(): void {
    if (!this.isBrowser) return;
    this.syncFromHost();
    this.cmdQuery.set('');
    this.selectedIndex.set(0);
    this.cmdOpen.set(true);
    setTimeout(() => document.getElementById('glNgCmdInput')?.focus(), 20);
  }

  closeCmd(): void {
    this.cmdOpen.set(false);
  }

  jumpTo(mod: QuickModule): void {
    this.cmdOpen.set(false);
    if (!this.isBrowser) return;
    if (mod.action === 'sync') {
      this.triggerDynamicSync(true);
      return;
    }
    if (mod.action === 'scan') {
      const w = window as any;
      if (typeof w.openQrScannerForQuickTag === 'function' && document.getElementById('customerSaleForm')) {
        w.openQrScannerForQuickTag();
      } else if (typeof w.openQrScannerForQuote === 'function' && document.getElementById('rcEstimateForm')) {
        w.openQrScannerForQuote();
      } else {
        this.openScanner({
          title: 'Universal Tag / QR Lookup',
          onScan: (code: string) => {
            if (typeof w.say === 'function') w.say('✓ Scanned Tag: ' + code);
          }
        });
      }
      return;
    }
    const w = window as any;
    if (mod.standalone && typeof w.rcOpenStandalone === 'function') {
      w.rcOpenStandalone(mod.id);
    } else if (typeof w.go === 'function') {
      w.go(mod.id);
    }
  }
}
