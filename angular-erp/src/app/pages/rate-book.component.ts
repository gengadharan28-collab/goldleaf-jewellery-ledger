import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoldleafRates, SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-rate-book',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · RATES</div>
        <h1>{{ i18n.t('Rate Book') }}</h1>
      </div>
      <div class="mode-pills">
        <button type="button" [class.primary]="mode() === 'auto'" (click)="setMode('auto')">⚖ Automatic (from 24K)</button>
        <button type="button" [class.primary]="mode() === 'manual'" (click)="setMode('manual')">✎ Manual Entry</button>
      </div>
    </header>

    <section class="panel">
      <p class="hint" style="margin-top:0">
        @if (sb.context()?.is_super_admin) {
          Super Admin · Saving updates Shared Rates (including Gold Pure Cash Rate) across all shops.
        } @else if (sb.context()?.shared_rates_enabled !== false) {
          Live shared rate is ON (managed by Super Admin). You can override &amp; save your Cash Rate anytime.
        } @else {
          Live shared rate is OFF. This shop maintains its own rates &amp; Cash Rate.
        }
      </p>

      <form (ngSubmit)="saveAll()">
        <div class="form-grid">
          <label class="field">
            <span>{{ i18n.t('Gold Pure Rate · 24K · ₹/g') }} *</span>
            <input type="number" name="gold24" min="0" step=".01" [(ngModel)]="form.gold24" (ngModelChange)="on24kChange($event)" required />
          </label>
          <label class="field">
            <span>{{ i18n.t('Gold Pure Cash Rate · 24K · ₹/g') }}</span>
            <input type="number" name="gold24Cash" min="0" step=".01" [(ngModel)]="form.gold24Cash" />
          </label>
          <label class="field">
            <span>{{ i18n.t('Gold Board Rate · 22K · ₹/g') }} *</span>
            <input type="number" name="gold22" min="0" step=".01" [(ngModel)]="form.gold22" required />
          </label>
          <label class="field">
            <span>{{ i18n.t('Gold Rate · 18K · ₹/g') }} *</span>
            <input type="number" name="gold18" min="0" step=".01" [(ngModel)]="form.gold18" required />
          </label>
          <label class="field">
            <span>{{ i18n.t('Gold Rate · 14K · ₹/g') }} *</span>
            <input type="number" name="gold14" min="0" step=".01" [(ngModel)]="form.gold14" required />
          </label>
          <label class="field">
            <span>{{ i18n.t('Silver Pure Rate · ₹/g') }} *</span>
            <input type="number" name="silver" min="0" step=".01" [(ngModel)]="form.silver" (ngModelChange)="onSilverChange($event)" required />
          </label>
          <label class="field">
            <span>Silver Board Rate · ₹/g *</span>
            <input type="number" name="silverBoard" min="0" step=".01" [(ngModel)]="form.silverBoard" required />
          </label>
          <label class="field">
            <span>Diamond Rate · ₹/g</span>
            <input type="number" name="diamond" min="0" step=".01" [(ngModel)]="form.diamond" />
          </label>
        </div>

        <div class="actions-row">
          @if (!sb.context()?.is_super_admin && sb.context()?.shared_rates_enabled !== false) {
            <button type="button" class="primary" (click)="saveCashOverride()">{{ i18n.t('Save Cash Rate') }}</button>
          } @else {
            <button type="submit" class="primary">
              {{ sb.context()?.is_super_admin ? i18n.t('Save Shared Rates') : i18n.t('Save Shop Rates') }}
            </button>
          }
        </div>
      </form>
    </section>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .mode-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
    .actions-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @media (max-width: 760px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }
  `],
})
export class RateBookComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly mode = signal<'auto' | 'manual'>('auto');

  form: GoldleafRates = {
    gold24: 0, gold24Cash: 0, gold22: 0, gold18: 0, gold14: 0, silver: 0, silverBoard: 0, diamond: 0,
  };

  constructor() {
    effect(() => {
      const r = this.sb.rates();
      this.form = { ...this.form, ...r };
    });
  }

  setMode(m: 'auto' | 'manual') {
    this.mode.set(m);
    if (m === 'auto') this.on24kChange(this.form.gold24);
  }

  on24kChange(val: number) {
    if (this.mode() !== 'auto' || !val) return;
    this.form.gold22 = Math.round((val * 22) / 24);
    this.form.gold18 = Math.round((val * 18) / 24);
    this.form.gold14 = Math.round((val * 14) / 24);
  }

  onSilverChange(val: number) {
    if (this.mode() === 'auto' && val) this.form.silverBoard = val;
  }

  async saveCashOverride() {
    const cashVal = Number(this.form.gold24Cash) || 0;
    await this.sb.saveLedger({
      shopCashRateOverride: {
        active: true,
        gold24Cash: cashVal,
        sharedUpdatedAt: String(this.sb.sharedRates()?.updatedAt || ''),
      },
      rates: { ...this.sb.rates(), gold24Cash: cashVal },
    });
    this.sb.say('Gold Pure Cash Rate saved.');
  }

  async saveAll() {
    const payload: GoldleafRates = {
      ...this.form,
      updatedAt: new Date().toISOString(),
    };
    if (this.sb.context()?.is_super_admin) {
      await this.sb.saveSharedRates(payload);
      this.sb.say('Shared rates (including Cash Rate) updated for all shops.');
    } else {
      await this.sb.saveLedger({
        shopRates: { enabled: true, ...payload },
        rates: payload,
      });
      this.sb.say('Shop rates saved.');
    }
  }
}
