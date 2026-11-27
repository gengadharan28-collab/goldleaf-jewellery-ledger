import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · {{ sb.workspaceMode().toUpperCase() }}</div>
        <h1>{{ i18n.t('Register') }}</h1>
      </div>
      <input type="search" [(ngModel)]="query" placeholder="Search name or phone…" style="max-width:260px" />
    </header>

    <form class="panel" (ngSubmit)="addAccount()">
      <h2>Add {{ sb.workspaceMode() === 'retail' ? 'Customer' : 'Party' }}</h2>
      <div class="grid-3">
        <label class="field"><span>Name *</span><input [(ngModel)]="name" name="name" required /></label>
        <label class="field"><span>Phone</span><input [(ngModel)]="phone" name="phone" type="tel" /></label>
        <label class="field"><span>City</span><input [(ngModel)]="city" name="city" /></label>
      </div>
      <div class="actions-row"><button type="submit" class="primary">Save</button></div>
    </form>

    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>City</th></tr></thead>
          <tbody>
            @for (row of filtered(); track row.id) {
              <tr><td><b>{{ row.name }}</b></td><td>{{ row.phone || '—' }}</td><td>{{ row.city || '—' }}</td></tr>
            } @empty {
              <tr><td colspan="3" class="hint">No accounts found.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
    .actions-row { display: flex; justify-content: flex-end; margin-top: 12px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    @media (max-width: 640px) { .grid-3 { grid-template-columns: 1fr; } }
  `],
})
export class RegisterComponent {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  query = signal('');
  name = '';
  phone = '';
  city = '';

  readonly listKey = computed(() => (this.sb.workspaceMode() === 'retail' ? 'customers' : 'parties'));
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = (this.sb.ledger()[this.listKey()] || []) as any[];
    if (!q) return rows;
    return rows.filter(r => `${r.name || ''} ${r.phone || ''} ${r.city || ''}`.toLowerCase().includes(q));
  });

  async addAccount() {
    if (!this.name.trim()) return;
    const key = this.listKey();
    const cur = [...(this.sb.ledger()[key] || [])];
    cur.unshift({
      id: crypto.randomUUID(),
      name: this.name.trim(),
      phone: this.phone.trim(),
      city: this.city.trim(),
      createdAt: new Date().toISOString(),
    });
    await this.sb.saveLedger({ [key]: cur });
    this.name = ''; this.phone = ''; this.city = '';
    this.sb.say('Account saved.');
  }
}
