import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <section class="login-card">
        <div class="rate-bar">
          <span>24K <b>₹{{ (sb.sharedRates()?.gold24 || 7850).toLocaleString('en-IN') }}/g</b></span>
          <span>22K <b>₹{{ (sb.sharedRates()?.gold22 || 7210).toLocaleString('en-IN') }}/g</b></span>
          <span>Silver <b>₹{{ (sb.sharedRates()?.silver || 95).toLocaleString('en-IN') }}/g</b></span>
        </div>
        <div class="login-body">
          <div class="brand-crest">
            <svg width="42" height="42" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="54" stroke="#D4AF37" stroke-width="2.5"/>
              <path d="M60 20L78 35L60 66L42 35L60 20Z" fill="#D4AF37"/>
              <path d="M60 66V98" stroke="#D4AF37" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <h1>GOLDLEAF</h1>
            <p>Jewellery Atelier · Angular ERP</p>
          </div>
          <form (ngSubmit)="submit()">
            <label class="field">
              <span>Registered Email</span>
              <input name="email" type="email" [(ngModel)]="email" required autocomplete="username" placeholder="contact@showroom.com" />
            </label>
            <label class="field">
              <span>Password</span>
              <input name="password" type="password" [(ngModel)]="password" required minlength="8" autocomplete="current-password" placeholder="••••••••••••" />
            </label>
            @if (error()) {
              <p class="err">{{ error() }}</p>
            }
            <button type="submit" class="primary full" [disabled]="loading()">
              {{ loading() ? 'Signing in…' : 'Enter Showroom' }}
            </button>
          </form>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .login-wrap { min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: var(--paper); }
    .login-card { width: min(420px, 100%); background: var(--white); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow); }
    .rate-bar { display: flex; justify-content: space-between; gap: 8px; padding: 10px 16px; background: #133726; color: #f3ead9; font-size: 12px; flex-wrap: wrap; }
    .login-body { padding: 24px; }
    .brand-crest { text-align: center; margin-bottom: 18px; }
    .brand-crest h1 { margin: 8px 0 2px; font: 700 22px/1.1 Georgia, serif; letter-spacing: 2px; }
    .brand-crest p { margin: 0; font-size: 12px; color: var(--muted); }
    .field { display: grid; gap: 6px; margin-bottom: 14px; font-size: 12.5px; font-weight: 600; }
    .full { width: 100%; margin-top: 6px; }
    .err { color: #b91c1c; font-size: 12.5px; margin: 6px 0; }
  `],
})
export class LoginComponent {
  readonly sb = inject(SupabaseService);
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  async submit() {
    this.error.set('');
    this.loading.set(true);
    try {
      await this.sb.signIn(this.email.trim(), this.password);
    } catch (e: any) {
      this.error.set(e?.message || 'Sign in failed');
    } finally {
      this.loading.set(false);
    }
  }
}
