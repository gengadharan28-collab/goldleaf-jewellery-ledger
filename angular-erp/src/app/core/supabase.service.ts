import { Injectable, computed, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

export interface GoldleafRates {
  gold24: number;
  gold24Cash?: number;
  gold22: number;
  gold18: number;
  gold14: number;
  silver: number;
  silverBoard: number;
  diamond?: number;
  entryDate?: string;
  entrySlot?: string;
  updatedAt?: string;
}

export interface GoldleafContext {
  shop_id: string;
  shop_name: string;
  is_super_admin: boolean;
  has_access: boolean;
  retail_enabled: boolean;
  wholesale_enabled: boolean;
  shared_rates_enabled?: boolean;
  plan?: string;
  subscription_status?: string;
}

export interface PdfSettings {
  estimateTemplate: string;
  showGrossLess: boolean;
  showNetWeight: boolean;
  showWastage: boolean;
  showRate: boolean;
  showMaking: boolean;
  showExpiry: boolean;
  oldGoldRateSource: 'both' | 'rateBook' | 'cashRate';
  remotePrintStation: boolean;
  remotePrintFromMobile: boolean;
}

const SUPABASE_URL = 'https://wnfxbzzewibxppfssqyq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ttfbhy42ax6cBol29sSKAw_bp2SufL1';

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  estimateTemplate: 'thermal-estimate-80',
  showGrossLess: true,
  showNetWeight: true,
  showWastage: true,
  showRate: true,
  showMaking: true,
  showExpiry: true,
  oldGoldRateSource: 'both',
  remotePrintStation: false,
  remotePrintFromMobile: false,
};

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  readonly authReady = signal(false);
  readonly session = signal<Session | null>(null);
  readonly context = signal<GoldleafContext | null>(null);
  readonly workspaceMode = signal<'retail' | 'wholesale'>(
    (localStorage.getItem('goldleaf-workspace-mode') as 'retail' | 'wholesale') || 'retail'
  );
  readonly theme = signal<'light' | 'dark'>(
    (localStorage.getItem('goldleaf-theme') as 'light' | 'dark') || 'light'
  );
  readonly ledger = signal<Record<string, any>>({
    customers: [],
    parties: [],
    sales: [],
    payments: [],
    retailDocuments: [],
    rates: { gold24: 0, gold24Cash: 0, gold22: 0, gold18: 0, gold14: 0, silver: 0, silverBoard: 0 },
    rateHistory: [],
    pdfSettings: { retail: { ...DEFAULT_PDF_SETTINGS }, wholesale: { ...DEFAULT_PDF_SETTINGS } },
  });
  readonly sharedRates = signal<GoldleafRates | null>(null);
  readonly syncStatus = signal('Connecting…');
  readonly toastMessage = signal<string | null>(null);

  readonly rates = computed<GoldleafRates>(() => {
    const db = this.ledger();
    return (db['rates'] as GoldleafRates) || {
      gold24: 0, gold24Cash: 0, gold22: 0, gold18: 0, gold14: 0, silver: 0, silverBoard: 0
    };
  });

  readonly pdfSettings = computed<PdfSettings>(() => {
    const mode = this.workspaceMode();
    const saved = this.ledger()['pdfSettings']?.[mode] || {};
    return { ...DEFAULT_PDF_SETTINGS, ...saved };
  });

  constructor() {
    this.applyTheme(this.theme());
    this.initAuth();
  }

  private async initAuth() {
    try {
      const { data } = await this.client.auth.getSession();
      this.session.set(data.session);
      if (data.session) {
        await this.pullCloud();
      } else {
        await this.refreshPublicRates();
      }
    } finally {
      this.authReady.set(true);
    }
    this.client.auth.onAuthStateChange((_evt, sess) => {
      this.session.set(sess);
      if (sess) this.pullCloud();
      else this.context.set(null);
    });
  }

  say(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) this.toastMessage.set(null);
    }, 3200);
  }

  toggleTheme() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem('goldleaf-theme', next);
    this.applyTheme(next);
  }

  private applyTheme(t: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', t);
  }

  setWorkspaceMode(mode: 'retail' | 'wholesale') {
    this.workspaceMode.set(mode);
    localStorage.setItem('goldleaf-workspace-mode', mode);
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.pullCloud();
  }

  async signOut() {
    await this.client.auth.signOut();
    this.session.set(null);
    this.context.set(null);
  }

  async refreshPublicRates() {
    const { data } = await this.client.rpc('goldleaf_get_shared_rates');
    if (data) this.sharedRates.set(data as GoldleafRates);
  }

  async pullCloud() {
    if (!this.session()) return;
    try {
      const [ctxRes, sharedRes] = await Promise.all([
        this.client.rpc('goldleaf_my_context'),
        this.client.rpc('goldleaf_get_shared_rates'),
      ]);
      if (ctxRes.error) throw ctxRes.error;
      const ctx = ctxRes.data as GoldleafContext;
      this.context.set(ctx);
      const shared = (sharedRes.data || {}) as GoldleafRates;
      this.sharedRates.set(shared);

      if (!ctx.shop_id) return;
      const { data: ledgerRow } = await this.client
        .from('goldleaf_shop_ledgers')
        .select('payload,updated_at')
        .eq('shop_id', ctx.shop_id)
        .maybeSingle();

      const nextDb = { ...this.ledger(), ...(ledgerRow?.payload || {}) };
      nextDb['sharedRates'] = shared;

      if (ctx.shared_rates_enabled !== false) {
        const merged = { ...shared };
        const ov = nextDb['shopCashRateOverride'];
        if (ov?.active && String(ov.sharedUpdatedAt || '') === String(shared.updatedAt || '')) {
          merged.gold24Cash = Number(ov.gold24Cash) || 0;
        }
        nextDb['rates'] = merged;
      } else if (nextDb['shopRates']?.enabled) {
        nextDb['rates'] = { ...nextDb['shopRates'] };
      }

      this.ledger.set(nextDb);
      this.syncStatus.set(`Cloud · ${ctx.shop_name || 'Connected'}`);
    } catch (err: any) {
      this.syncStatus.set('Cloud sync attention');
      this.say(err?.message || 'Could not sync cloud ledger.');
    }
  }

  async saveLedger(patch: Record<string, any>) {
    const ctx = this.context();
    const nextDb = { ...this.ledger(), ...patch };
    this.ledger.set(nextDb);
    if (!this.session() || !ctx?.shop_id) return;
    const updated = new Date().toISOString();
    const { error } = await this.client
      .from('goldleaf_shop_ledgers')
      .upsert({ shop_id: ctx.shop_id, payload: nextDb, updated_at: updated });
    if (error) throw error;
    this.syncStatus.set(`Cloud · ${ctx.shop_name || 'Saved'}`);
  }

  async saveSharedRates(rates: GoldleafRates) {
    const { error } = await this.client.rpc('goldleaf_admin_set_shared_rates', { p_rates: rates });
    if (error) throw error;
    this.sharedRates.set(rates);
    await this.saveLedger({ rates });
  }
}
