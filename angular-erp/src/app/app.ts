import {
  Component,
  VERSION,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import { FormsModule } from '@angular/forms';

type AppLang = 'en' | 'ta';

interface QuickModule {
  id: string;
  label: string;
  taLabel: string;
  category: string;
  icon: string;
  standalone?: boolean;
  action?: 'sync' | 'update';
}

const QUICK_MODULES: QuickModule[] = [
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

@Component({
  selector: 'gl-angular-shell',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None
})
export class App implements OnInit, OnDestroy {
  readonly ngVersion = VERSION.full;
  readonly lang = signal<AppLang>('en');
  readonly activePage = signal<string>('Dashboard');
  readonly cmdOpen = signal<boolean>(false);
  readonly cmdQuery = signal<string>('');
  readonly selectedIndex = signal<number>(0);

  // Cross-platform dynamic activity, network & pre-warm update signals
  readonly progressVisible = signal<boolean>(false);
  readonly progressScale = signal<number>(0);
  readonly netBanner = signal<'' | 'offline' | 'online'>('');
  readonly updateOverlayVisible = signal<boolean>(false);
  readonly updateTitle = signal<string>('');
  readonly updateSubtitle = signal<string>('');
  readonly updatePercent = signal<number>(0);

  readonly filteredModules = computed(() => {
    const q = this.cmdQuery().trim().toLowerCase();
    if (!q) return QUICK_MODULES;
    return QUICK_MODULES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.taLabel.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  private progressTimer: any = null;
  private hideProgressTimer: any = null;
  private netBannerTimer: any = null;
  private warmedVersion = '';
  private warmPromise: Promise<string[]> | null = null;
  private activeSyncCount = 0;

  private readonly boundRendered = () => this.syncFromHost();
  private readonly boundSyncStart = () => this.beginActivity();
  private readonly boundSyncEnd = () => this.endActivity();
  private readonly boundOnline = () => this.handleConnectivity(true);
  private readonly boundOffline = () => this.handleConnectivity(false);
  private readonly boundUpdateDetected = (ev: Event) => {
    const ver = (ev as CustomEvent)?.detail?.version || '';
    this.prewarmReleaseInBackground(ver);
  };

  ngOnInit(): void {
    const w = window as any;
    w.glAngularEngineActive = true;
    w.glAngularVersion = this.ngVersion;
    w.glOpenQuickJump = () => this.openCmd();
    w.glNgBeginActivity = () => this.beginActivity();
    w.glNgEndActivity = () => this.endActivity();
    w.glNgPrewarmUpdate = (ver?: string) => this.prewarmReleaseInBackground(ver || '');
    w.glNgApplyHotUpdate = (targetVer?: string) => this.applyHotUpdate(targetVer || '');
    w.glNgSoftRefresh = () => this.triggerDynamicSync();

    this.syncFromHost();

    window.addEventListener('gl:rendered', this.boundRendered);
    window.addEventListener('gl:lang', this.boundRendered);
    window.addEventListener('gl:manual-sync-start', this.boundSyncStart);
    window.addEventListener('gl:manual-sync-end', this.boundSyncEnd);
    window.addEventListener('online', this.boundOnline);
    window.addEventListener('offline', this.boundOffline);
    window.addEventListener('gl:update-detected', this.boundUpdateDetected);
  }

  ngOnDestroy(): void {
    window.removeEventListener('gl:rendered', this.boundRendered);
    window.removeEventListener('gl:lang', this.boundRendered);
    window.removeEventListener('gl:manual-sync-start', this.boundSyncStart);
    window.removeEventListener('gl:manual-sync-end', this.boundSyncEnd);
    window.removeEventListener('online', this.boundOnline);
    window.removeEventListener('offline', this.boundOffline);
    window.removeEventListener('gl:update-detected', this.boundUpdateDetected);
    clearInterval(this.progressTimer);
    clearTimeout(this.hideProgressTimer);
    clearTimeout(this.netBannerTimer);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
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

  onQueryChange(val: string): void {
    this.cmdQuery.set(val);
    this.selectedIndex.set(0);
  }

  syncFromHost(): void {
    try {
      const savedLang = localStorage.getItem('goldleaf-lang') === 'ta' ? 'ta' : 'en';
      if (this.lang() !== savedLang) this.lang.set(savedLang);

      const w = window as any;
      const pageName = document.body?.dataset?.['erpPage'] || w.page || 'Dashboard';
      if (this.activePage() !== pageName) this.activePage.set(pageName);
    } catch (_) {}
  }

  beginActivity(): void {
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

        // Pre-fetch in small concurrent batches so main thread & network stay silky-smooth
        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
          const slice = urls.slice(i, i + batchSize);
          await Promise.allSettled(
            slice.map(u => fetch(u, { cache: 'reload' }))
          );
        }
        return urls;
      } catch (_) {
        return [];
      }
    })();
    return this.warmPromise;
  }

  async applyHotUpdate(targetVer: string): Promise<void> {
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

      // Ensure new HTML + JS/CSS assets are already warm in cache BEFORE reloading!
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
    if (mod.action === 'sync') {
      this.triggerDynamicSync(true);
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
