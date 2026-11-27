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

type NgDesign = 'atelier' | 'saas' | 'obsidian';
type AppLang = 'en' | 'ta';

interface QuickModule {
  id: string;
  label: string;
  taLabel: string;
  category: string;
  icon: string;
  standalone?: boolean;
}

const QUICK_MODULES: QuickModule[] = [
  { id: 'Dashboard', label: 'Dashboard Overview', taLabel: 'முகப்பு', category: 'Core', icon: '⌂' },
  { id: 'Estimation / Quotation', label: 'Estimation / Quotation (80mm POS)', taLabel: 'மதிப்பீடு / கொட்டேஷன்', category: 'Counter', icon: '🧾', standalone: true },
  { id: 'Sales Entry', label: 'Sales Bill & Sales Return', taLabel: 'விற்பனை & திருப்பம்', category: 'Counter', icon: '＋' },
  { id: 'Rate Book', label: 'Rate Book & 24K Cash Rate', taLabel: 'விலை பட்டியல்', category: 'Rates', icon: '⚖' },
  { id: 'Stock & Tagging', label: 'Stock, Lot Entry & QR Tagging', taLabel: 'இருப்பு & டேக்கிங்', category: 'Inventory', icon: '🏷', standalone: true },
  { id: 'Products', label: 'Products & Sub-Products', taLabel: 'பொருட்கள்', category: 'Inventory', icon: '◈', standalone: true },
  { id: 'Chit', label: 'Chit Schemes & Passbooks', taLabel: 'சீட்டு திட்டம்', category: 'Schemes', icon: '📅', standalone: true },
  { id: 'Jewel Loan', label: 'Jewel Loan & Redemptions', taLabel: 'நகை கடன்', category: 'Finance', icon: '🔐' },
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
  readonly design = signal<NgDesign>('atelier');
  readonly lang = signal<AppLang>('en');
  readonly gold24 = signal<number>(0);
  readonly gold24Cash = signal<number>(0);
  readonly gold22 = signal<number>(0);
  readonly silver = signal<number>(0);
  readonly activePage = signal<string>('Dashboard');
  readonly printerLocal = signal<boolean>(false);
  readonly cmdOpen = signal<boolean>(false);
  readonly cmdQuery = signal<string>('');

  readonly filteredModules = computed(() => {
    const q = this.cmdQuery().trim().toLowerCase();
    if (!q) return QUICK_MODULES;
    return QUICK_MODULES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.taLabel.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  private syncTimer: any = null;
  private printTimer: any = null;

  ngOnInit(): void {
    const w = window as any;
    w.glAngularEngineActive = true;
    w.glAngularVersion = this.ngVersion;
    w.glOpenQuickJump = () => this.openCmd();

    this.syncFromHost();
    this.checkPrinter();

    this.syncTimer = setInterval(() => this.syncFromHost(), 900);
    this.printTimer = setInterval(() => this.checkPrinter(), 12000);
  }

  ngOnDestroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.printTimer) clearInterval(this.printTimer);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.cmdOpen.update(v => !v);
      if (this.cmdOpen()) {
        this.cmdQuery.set('');
        setTimeout(() => document.getElementById('glNgCmdInput')?.focus(), 30);
      }
    } else if (ev.key === 'Escape' && this.cmdOpen()) {
      ev.preventDefault();
      this.cmdOpen.set(false);
    }
  }

  syncFromHost(): void {
    try {
      const savedDesign = (localStorage.getItem('goldleaf-ng-design') || 'atelier') as NgDesign;
      const validDesign: NgDesign = ['atelier', 'saas', 'obsidian'].includes(savedDesign) ? savedDesign : 'atelier';
      if (this.design() !== validDesign) this.design.set(validDesign);

      const savedLang = localStorage.getItem('goldleaf-lang') === 'ta' ? 'ta' : 'en';
      if (this.lang() !== savedLang) this.lang.set(savedLang);

      const w = window as any;
      const pageName = document.body?.dataset?.['erpPage'] || w.page || 'Dashboard';
      if (this.activePage() !== pageName) this.activePage.set(pageName);

      // Read global db rates (db is a top-level lexical or window state; read via helper if exposed or localStorage fallback)
      const rates = typeof w.glGetLiveRatesSnapshot === 'function'
        ? w.glGetLiveRatesSnapshot()
        : this.readStoredRates();

      if (rates) {
        this.gold24.set(Number(rates.gold24) || 0);
        this.gold24Cash.set(Number(rates.gold24Cash) || 0);
        this.gold22.set(Number(rates.gold22) || (rates.gold24 ? Math.round((Number(rates.gold24) * 22) / 24) : 0));
        this.silver.set(Number(rates.silver) || 0);
      }
    } catch (_) {}
  }

  private readStoredRates(): any {
    try {
      const raw = localStorage.getItem('goldleaf-ledger-v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const r = parsed?.rates || {};
      const cashOverride = Number(parsed?.shopCashRateOverride) || 0;
      return {
        gold24: Number(r.gold24) || 0,
        gold24Cash: cashOverride > 0 ? cashOverride : (Number(r.gold24Cash) || 0),
        gold22: Number(r.gold22) || 0,
        silver: Number(r.silver) || 0
      };
    } catch (_) {
      return null;
    }
  }

  async checkPrinter(): Promise<void> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch('http://127.0.0.1:17655/health', { signal: ctrl.signal });
      clearTimeout(t);
      this.printerLocal.set(res.ok);
    } catch (_) {
      this.printerLocal.set(false);
    }
  }

  pickDesign(next: NgDesign): void {
    this.design.set(next);
    const w = window as any;
    if (typeof w.glSetDesign === 'function') {
      w.glSetDesign(next);
    } else {
      localStorage.setItem('goldleaf-ng-design', next);
      document.documentElement.setAttribute('data-ng-design', next);
    }
  }

  pickLang(next: AppLang): void {
    this.lang.set(next);
    const w = window as any;
    if (typeof w.glSetLanguage === 'function') {
      w.glSetLanguage(next);
    }
  }

  openRates(): void {
    const w = window as any;
    if (typeof w.go === 'function') w.go('Rate Book');
  }

  openCmd(): void {
    this.cmdQuery.set('');
    this.cmdOpen.set(true);
    setTimeout(() => document.getElementById('glNgCmdInput')?.focus(), 30);
  }

  closeCmd(): void {
    this.cmdOpen.set(false);
  }

  jumpTo(mod: QuickModule): void {
    this.cmdOpen.set(false);
    const w = window as any;
    if (mod.standalone && typeof w.rcOpenStandalone === 'function') {
      w.rcOpenStandalone(mod.id);
    } else if (typeof w.go === 'function') {
      w.go(mod.id);
    }
  }

  formatInr(val: number): string {
    return val > 0 ? '₹' + val.toLocaleString('en-IN') : '—';
  }
}
