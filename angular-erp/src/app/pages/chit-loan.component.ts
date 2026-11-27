import { Component, computed, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-chit-loan',
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · CHIT &amp; LOAN</div>
        <h1>{{ i18n.t('Chit & Jewel Loan') }}</h1>
      </div>
    </header>
    <div class="kpi-grid">
      <div class="card"><label>Chit Passbooks</label><b>{{ passbooks().length }}</b></div>
      <div class="card"><label>Jewel Loans</label><b>{{ loans().length }}</b></div>
    </div>
    <section class="panel">
      <h2>Active Passbooks &amp; Loans</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Type</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            @for (doc of docs(); track doc.id) {
              <tr>
                <td>{{ doc.chitNumber || doc.loanNo || doc.documentNo || doc.id?.slice(0, 8) }}</td>
                <td>{{ doc.kind }}</td>
                <td>{{ doc.status || 'Active' }}</td>
                <td>{{ doc.notes || doc.ornamentType || '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="hint">No Chit or Jewel Loan records yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
    .card label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
    .card b { display: block; margin-top: 6px; font: 600 22px/1.15 Georgia, serif; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
  `],
})
export class ChitLoanComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly passbooks = computed(() => (this.sb.ledger()['retailDocuments'] || []).filter((d: any) => d?.kind === 'retail-chit-mapping'));
  readonly loans = computed(() => (this.sb.ledger()['retailDocuments'] || []).filter((d: any) => String(d?.kind || '').includes('loan')));
  readonly docs = computed(() => [...this.passbooks(), ...this.loans()].slice(0, 30));
}
