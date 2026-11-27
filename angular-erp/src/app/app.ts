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
  readonly lang = signal<AppLang>('en');
  readonly activePage = signal<string>('Dashboard');
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

  ngOnInit(): void {
    const w = window as any;
    w.glAngularEngineActive = true;
    w.glAngularVersion = this.ngVersion;
    w.glOpenQuickJump = () => this.openCmd();

    this.syncFromHost();
    this.syncTimer = setInterval(() => this.syncFromHost(), 1200);
  }

  ngOnDestroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
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
      const savedLang = localStorage.getItem('goldleaf-lang') === 'ta' ? 'ta' : 'en';
      if (this.lang() !== savedLang) this.lang.set(savedLang);

      const w = window as any;
      const pageName = document.body?.dataset?.['erpPage'] || w.page || 'Dashboard';
      if (this.activePage() !== pageName) this.activePage.set(pageName);
    } catch (_) {}
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
}
