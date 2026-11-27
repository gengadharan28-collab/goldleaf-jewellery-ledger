import { Component, computed, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-ledger',
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · LEDGER</div>
        <h1>{{ i18n.t('Ledger') }}</h1>
      </div>
    </header>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Weight (g)</th><th>Amount (₹)</th></tr></thead>
          <tbody>
            @for (row of entries(); track row.id) {
              <tr>
                <td>{{ (row.when || row.createdAt || '').slice(0, 10) }}</td>
                <td>{{ row.kind || row.retailKind || 'Sale' }}</td>
                <td>{{ row.product || row.documentNo || '—' }}</td>
                <td>{{ (+(row.returnWeight || row.weight || 0)).toFixed(3) }}</td>
                <td>₹ {{ (+(row.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="hint">No ledger entries yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
  `],
})
export class LedgerComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly entries = computed(() => [
    ...(this.sb.ledger()['sales'] || []),
    ...(this.sb.ledger()['payments'] || []),
  ].slice(0, 30));
}
