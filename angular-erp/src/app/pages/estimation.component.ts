import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-estimation',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · RETAIL</div>
        <h1>{{ i18n.t('Estimation / Quotation') }}</h1>
      </div>
      <div class="head-actions">
        <button type="button" (click)="showOldGold.set(!showOldGold())">+ {{ i18n.t('Old Gold Exchange') }}</button>
        <button type="button" (click)="showSalesReturn.set(!showSalesReturn())">+ {{ i18n.t('Sales Return') }}</button>
      </div>
    </header>

    <section class="panel">
      <div class="grid-3">
        <label class="field">
          <span>Product</span>
          <input [(ngModel)]="product" name="product" placeholder="e.g. Ring / Chain" />
        </label>
        <label class="field">
          <span>Gross Wt (g)</span>
          <input type="number" step=".001" [(ngModel)]="gross" name="gross" />
        </label>
        <label class="field">
          <span>Less Wt (g)</span>
          <input type="number" step=".001" [(ngModel)]="less" name="less" />
        </label>
        <label class="field">
          <span>Wastage (%)</span>
          <input type="number" step=".01" [(ngModel)]="wastage" name="wastage" />
        </label>
        <label class="field">
          <span>Rate / g (₹)</span>
          <input type="number" step=".01" [(ngModel)]="rate" name="rate" />
        </label>
        <label class="field">
          <span>Making (₹)</span>
          <input type="number" step=".01" [(ngModel)]="making" name="making" />
        </label>
      </div>
      <div class="summary-bar">
        <span>Net Wt: <b>{{ netWeight().toFixed(3) }} g</b></span>
        <span>Item Amount: <b>₹ {{ itemAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b></span>
      </div>
    </section>

    @if (showOldGold()) {
      <section class="panel og-panel">
        <div class="panel-top">
          <h3>{{ i18n.t('Old Gold Exchange') }}</h3>
          <b>Credit: ₹ {{ ogAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b>
        </div>
        <div class="grid-3">
          <label class="field">
            <span>Weight (g)</span>
            <input type="number" step=".001" [(ngModel)]="ogGross" name="ogGross" />
          </label>
          <label class="field">
            <span>Less (g)</span>
            <input type="number" step=".001" [(ngModel)]="ogLess" name="ogLess" />
          </label>
          <label class="field">
            <span class="label-row">
              <span>Pure Rate</span>
              @if (sb.pdfSettings().oldGoldRateSource === 'both') {
                <select [(ngModel)]="ogSource" (ngModelChange)="applyOgSource($event)" name="ogSource" class="mini-select">
                  <option value="rateBook">Pure Rate Book</option>
                  <option value="cashRate">Gold Pure Cash Rate</option>
                </select>
              }
            </span>
            <input type="number" step=".01" [(ngModel)]="ogPureRate" (ngModelChange)="recalcOgRate()" name="ogPureRate" />
          </label>
          <label class="field">
            <span>Touch (%)</span>
            <input type="number" step=".01" [(ngModel)]="ogTouch" (ngModelChange)="recalcOgRate()" name="ogTouch" />
          </label>
          <label class="field">
            <span>Rate (₹/g)</span>
            <input type="number" step=".01" [(ngModel)]="ogRate" name="ogRate" />
          </label>
        </div>
      </section>
    }

    @if (showSalesReturn()) {
      <section class="panel ret-panel">
        <h3>{{ i18n.t('Sales Return') }}</h3>
        <div class="grid-3">
          <label class="field">
            <span>Return Net Wt (g)</span>
            <input type="number" step=".001" [(ngModel)]="retWeight" name="retWeight" />
          </label>
          <label class="field">
            <span>Return Credit (₹)</span>
            <input type="number" step=".01" [(ngModel)]="retAmount" name="retAmount" />
          </label>
          <label class="field">
            <span>Reason</span>
            <input [(ngModel)]="retReason" name="retReason" placeholder="Optional reason" />
          </label>
        </div>
      </section>
    }

    <div class="final-card panel">
      <span>Final Payable</span>
      <b>₹ {{ finalTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b>
    </div>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 5px; font-size: 12px; font-weight: 600; }
    .label-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .mini-select { min-height: 24px !important; padding: 2px 6px !important; font-size: 11px !important; width: auto !important; }
    .summary-bar, .panel-top, .final-card { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
    .og-panel { border-color: #f59e0b; }
    .ret-panel { border-color: #b45309; }
    .final-card { border-top: 0; font-size: 18px; }
    @media (max-width: 760px) { .grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 480px) { .grid-3 { grid-template-columns: 1fr; } }
  `],
})
export class EstimationComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);

  showOldGold = signal(false);
  showSalesReturn = signal(false);

  product = 'Gold Ring';
  gross = 10;
  less = 0;
  wastage = 10;
  rate = this.sb.rates().gold22 || 7200;
  making = 500;

  ogSource: 'rateBook' | 'cashRate' = 'rateBook';
  ogGross = 0;
  ogLess = 0;
  ogPureRate = this.sb.rates().gold24 || 7850;
  ogTouch = 91.6;
  ogRate = Math.round((this.ogPureRate * this.ogTouch) / 100);

  retWeight = 0;
  retAmount = 0;
  retReason = '';

  netWeight = () => Math.max(0, (Number(this.gross) || 0) - (Number(this.less) || 0));
  itemAmount = () => {
    const net = this.netWeight();
    const wstWt = (net * (Number(this.wastage) || 0)) / 100;
    return Math.round(((net + wstWt) * (Number(this.rate) || 0) + (Number(this.making) || 0)) * 100) / 100;
  };
  ogAmount = () => {
    const net = Math.max(0, (Number(this.ogGross) || 0) - (Number(this.ogLess) || 0));
    return Math.round(net * (Number(this.ogRate) || 0) * 100) / 100;
  };
  finalTotal = () => Math.max(0, this.itemAmount() - this.ogAmount() - (Number(this.retAmount) || 0));

  applyOgSource(src: 'rateBook' | 'cashRate') {
    const r = this.sb.rates();
    this.ogPureRate = src === 'cashRate' ? (r.gold24Cash || r.gold24 || 0) : (r.gold24 || 0);
    this.recalcOgRate();
  }

  recalcOgRate() {
    this.ogRate = Math.round((((Number(this.ogPureRate) || 0) * (Number(this.ogTouch) || 0)) / 100) * 100) / 100;
  }
}
