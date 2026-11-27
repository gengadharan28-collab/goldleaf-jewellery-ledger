import { Component, computed, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-stock-reports',
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · STOCK &amp; REPORTS</div>
        <h1>{{ i18n.t('Stock & Reports') }}</h1>
      </div>
    </header>
    <div class="kpi-grid">
      <div class="card"><label>In-Stock Tags</label><b>{{ inStockTags().length }}</b></div>
      <div class="card"><label>Total Sales Value</label><b>₹ {{ totalSales().toLocaleString('en-IN') }}</b></div>
      <div class="card"><label>Sales Returns</label><b>{{ returns().length }}</b></div>
    </div>
    <section class="panel">
      <h2>Stock Tags</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tag / Barcode</th><th>Product</th><th>Net Wt (g)</th><th>Status</th></tr></thead>
          <tbody>
            @for (t of tags().slice(0, 25); track t.id) {
              <tr>
                <td>{{ t.barcode || t.tagNo || t.id?.slice(0, 8) }}</td>
                <td>{{ t.product || '—' }}</td>
                <td>{{ (+(t.netWeight || t.weight || 0)).toFixed(3) }}</td>
                <td>{{ t.status || 'In stock' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="hint">No stock tags recorded yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
    .card label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
    .card b { display: block; margin-top: 6px; font: 600 22px/1.15 Georgia, serif; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr; } }
  `],
})
export class StockReportsComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly tags = computed(() => (this.sb.ledger()['retailDocuments'] || []).filter((d: any) => d?.kind === 'retail-tagging'));
  readonly inStockTags = computed(() => this.tags().filter((t: any) => t.status === 'In stock'));
  readonly returns = computed(() => (this.sb.ledger()['payments'] || []).filter((p: any) => p?.retailKind === 'return'));
  readonly totalSales = computed(() =>
    (this.sb.ledger()['sales'] || []).reduce((s: number, x: any) => s + (Number(x.saleAmount ?? x.amount) || 0), 0)
  );
}
