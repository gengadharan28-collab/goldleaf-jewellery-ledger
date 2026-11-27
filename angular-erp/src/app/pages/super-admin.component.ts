import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-super-admin',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">GOLDLEAF · SUPER ADMIN</div>
        <h1>Super Admin</h1>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a routerLink="/rate-book" class="btn-link">Shared Rates</a>
        <button type="button" class="primary" (click)="loadShops()">↻ Refresh Shops</button>
      </div>
    </header>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Shop</th><th>Email</th><th>Plan</th><th>Status</th><th>Live Shared Rate</th></tr></thead>
          <tbody>
            @for (s of shops(); track s.id) {
              <tr>
                <td><b>{{ s.shop_name }}</b></td>
                <td>{{ s.email }}</td>
                <td>{{ s.plan }}</td>
                <td>{{ s.subscription_status }}</td>
                <td>{{ s.shared_rates_enabled !== false ? 'ON' : 'OFF' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="hint">Click Refresh Shops (Super Admin account required).</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 0; font: 600 28px/1.15 Georgia, serif; }
    .btn-link { display: inline-flex; align-items: center; padding: 8px 14px; border: 1px solid var(--line); border-radius: 10px; text-decoration: none; color: inherit; background: var(--white); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
  `],
})
export class SuperAdminComponent {
  private readonly sb = inject(SupabaseService);
  readonly shops = signal<any[]>([]);

  constructor() {
    if (this.sb.context()?.is_super_admin) this.loadShops();
  }

  async loadShops() {
    const { data, error } = await this.sb.client.rpc('goldleaf_admin_list_shops');
    if (error) return this.sb.say(error.message);
    this.shops.set(Array.isArray(data) ? data : []);
  }
}
