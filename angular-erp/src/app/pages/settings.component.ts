import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DEFAULT_PDF_SETTINGS, PdfSettings, SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';
import { PrintService } from '../core/print.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · SETTINGS</div>
        <h1>{{ i18n.t('Settings') }}</h1>
      </div>
    </header>

    <form class="panel" (ngSubmit)="save()">
      <h2>Print Field &amp; Column Visibility</h2>
      <div class="checks-grid">
        <label><input type="checkbox" [(ngModel)]="cfg.showGrossLess" name="showGrossLess" /> Gross Wt &amp; Less Wt</label>
        <label><input type="checkbox" [(ngModel)]="cfg.showNetWeight" name="showNetWeight" /> Net Gold / Silver Weight</label>
        <label><input type="checkbox" [(ngModel)]="cfg.showWastage" name="showWastage" /> Wastage % &amp; Amount</label>
        <label><input type="checkbox" [(ngModel)]="cfg.showRate" name="showRate" /> Metal Rate / Gram</label>
        <label><input type="checkbox" [(ngModel)]="cfg.showMaking" name="showMaking" /> Making Charges / Labour</label>
        <label><input type="checkbox" [(ngModel)]="cfg.showExpiry" name="showExpiry" /> Estimation Validity Date</label>
      </div>

      <h2>Old Gold Pure Rate Source</h2>
      <label class="field" style="max-width:340px">
        <span>Old Gold Pure Rate Option</span>
        <select [(ngModel)]="cfg.oldGoldRateSource" name="oldGoldRateSource">
          <option value="both">Both (Show Dropdown in Old Gold)</option>
          <option value="rateBook">Pure Rate Book only</option>
          <option value="cashRate">Gold Pure Cash Rate only</option>
        </select>
      </label>

      <h2>Mobile to Laptop Thermal Print Bridge</h2>
      <div class="checks-grid">
        <label><input type="checkbox" [(ngModel)]="cfg.remotePrintStation" name="remotePrintStation" /> Laptop Print Station (Receive &amp; auto-print mobile jobs)</label>
        <label><input type="checkbox" [(ngModel)]="cfg.remotePrintFromMobile" name="remotePrintFromMobile" /> Send Mobile Prints to Laptop Printer</label>
      </div>

      <div class="actions-row">
        <button type="button" (click)="printer.pollRemoteJobs(true)">↻ Check Mobile Print Queue Now</button>
        <button type="submit" class="primary">{{ i18n.t('Save Settings') }}</button>
      </div>
    </form>
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    h2 { font-size: 16px; margin: 18px 0 10px; }
    h2:first-child { margin-top: 0; }
    .checks-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .checks-grid label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .checks-grid input { min-height: 18px; width: 18px; padding: 0; }
    .field { display: grid; gap: 6px; font-size: 12.5px; font-weight: 600; }
    .actions-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    @media (max-width: 640px) { .checks-grid { grid-template-columns: 1fr; } }
  `],
})
export class SettingsComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly printer = inject(PrintService);
  cfg: PdfSettings = { ...DEFAULT_PDF_SETTINGS };

  constructor() {
    effect(() => {
      this.cfg = { ...this.sb.pdfSettings() };
    });
  }

  async save() {
    const mode = this.sb.workspaceMode();
    const cur = this.sb.ledger()['pdfSettings'] || {};
    await this.sb.saveLedger({
      pdfSettings: { ...cur, [mode]: { ...this.cfg } },
    });
    this.sb.say('Settings saved.');
  }
}
