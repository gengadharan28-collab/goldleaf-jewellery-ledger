import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-sales-entry',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · {{ sb.workspaceMode().toUpperCase() }}</div>
        <h1>{{ i18n.t('Sales Entry') }}</h1>
      </div>
    </header>

    <form class="panel" (ngSubmit)="saveBill()">
      <div class="grid-3">
        <label class="field">
          <span>Account *</span>
          <select [(ngModel)]="partyId" name="partyId" required>
            <option value="">Select…</option>
            @for (a of accounts(); track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Product *</span><input [(ngModel)]="product" name="product" required /></label>
        <label class="field"><span>Weight (g) *</span><input type="number" step=".001" [(ngModel)]="weight" name="weight" required /></label>
        <label class="field"><span>Purity (K)</span><input type="number" step=".1" [(ngModel)]="purity" name="purity" /></label>
        <label class="field"><span>Rate / g (₹)</span><input type="number" step=".01" [(ngModel)]="rate" name="rate" /></label>
        <label class="field"><span>Collected (₹)</span><input type="number" step=".01" [(ngModel)]="collected" name="collected" /></label>
      </div>
      <div class="actions-row">
        <b>Total: ₹ {{ total().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b>
        <button type="submit" class="primary">Save Bill</button>
      </div>
    </form>

    <section class="panel">
      <h2>Recent {{ i18n.t('Sales Bills') }}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Bill</th><th>Product</th><th>Wt (g)</th><th>Amount</th></tr></thead>
          <tbody>
            @for (s of sales().slice(0, 15); track s.id) {
              <tr>
                <td>{{ s.documentNo || s.id?.slice(0, 8) }}</td>
                <td>{{ s.product || '—' }}</td>
                <td>{{ (+(s.weight || 0)).toFixed(3) }}</td>
                <td>₹ {{ (+(s.saleAmount ?? s.amount ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="hint">No sales bills recorded yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
    .actions-row { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 12px; flex-wrap: wrap; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    @media (max-width: 640px) { .grid-3 { grid-template-columns: 1fr; } }
  `],
})
export class SalesEntryComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  partyId = '';
  product = 'Gold Ring';
  weight = 5;
  purity = 22;
  rate = this.sb.rates().gold22 || 7200;
  collected = 0;

  readonly accounts = computed(() => {
    const key = this.sb.workspaceMode() === 'retail' ? 'customers' : 'parties';
    return (this.sb.ledger()[key] || []) as any[];
  });
  readonly sales = computed(() => (this.sb.ledger()['sales'] || []) as any[]);
  total = () => Math.round((Number(this.weight) || 0) * (Number(this.rate) || 0) * 100) / 100;

  async saveBill() {
    if (!this.partyId || this.weight <= 0) return this.sb.say('Select account and weight.');
    const amt = this.total();
    const cur = [...this.sales()];
    cur.unshift({
      id: crypto.randomUUID(),
      accountType: this.sb.workspaceMode() === 'retail' ? 'customer' : 'party',
      partyId: this.partyId,
      when: new Date().toISOString().slice(0, 16),
      documentNo: 'S-' + Date.now().toString(36).toUpperCase(),
      product: this.product.trim(),
      weight: Number(this.weight),
      purity: Number(this.purity),
      ratePerGram: Number(this.rate),
      saleAmount: amt,
      amount: amt,
      collectedAmount: Number(this.collected) || 0,
      createdAt: new Date().toISOString(),
    });
    await this.sb.saveLedger({ sales: cur });
    this.sb.say('Sales bill saved.');
  }
}
