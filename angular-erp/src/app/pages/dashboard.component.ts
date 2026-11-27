import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · {{ sb.workspaceMode().toUpperCase() }}</div>
        <h1>{{ i18n.t('Dashboard') }}</h1>
      </div>
      <span class="pill">{{ sb.syncStatus() }}</span>
    </header>

    <div class="kpi-grid">
      <div class="card">
        <label>{{ i18n.t('Customers') }}</label>
        <b>{{ customerCount() }}</b>
      </div>
      <div class="card">
        <label>{{ i18n.t('Sales Bills') }}</label>
        <b>{{ salesCount() }}</b>
      </div>
      <div class="card">
        <label>{{ i18n.t('Quotations') }}</label>
        <b>{{ quoteCount() }}</b>
      </div>
      <div class="card">
        <label>24K / 24K Cash</label>
        <b>₹{{ (sb.rates().gold24 || 0).toLocaleString('en-IN') }} / ₹{{ (sb.rates().gold24Cash || 0).toLocaleString('en-IN') }}</b>
      </div>
    </div>

    <section class="panel">
      <h2>Quick Workspace</h2>
      <div class="actions-grid">
        <a routerLink="/estimation" class="action-card">
          <b>{{ i18n.t('Estimation / Quotation') }}</b>
          <small>Old Gold dropdown, Sales Return, 80mm Print &amp; WhatsApp PDF</small>
        </a>
        <a routerLink="/rate-book" class="action-card">
          <b>{{ i18n.t('Rate Book') }}</b>
          <small>24K Pure Rate, 24K Cash Rate, 22K/18K/14K &amp; Silver</small>
        </a>
        <a routerLink="/settings" class="action-card">
          <b>{{ i18n.t('Settings') }}</b>
          <small>Print columns, Old Gold rate source &amp; Mobile-to-Laptop Print Bridge</small>
        </a>
      </div>
    </section>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card b { display: block; margin-top: 8px; font: 600 22px/1.15 Georgia, serif; }
    .card label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
    .actions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .action-card { display: grid; gap: 4px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: inherit; background: var(--paper); }
    .action-card:hover { border-color: var(--gold); }
    .action-card small { color: var(--muted); font-size: 12px; }
    @media (max-width: 760px) {
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .actions-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly customerCount = computed(() => (this.sb.ledger()['customers'] || []).length);
  readonly salesCount = computed(() => (this.sb.ledger()['sales'] || []).length);
  readonly quoteCount = computed(() =>
    (this.sb.ledger()['retailDocuments'] || []).filter((d: any) => d?.kind === 'retail-estimate').length
  );
}
