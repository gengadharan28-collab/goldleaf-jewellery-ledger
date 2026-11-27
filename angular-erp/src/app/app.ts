import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/supabase.service';
import { I18nService } from './core/i18n.service';
import { PrintService } from './core/print.service';
import { LoginComponent } from './pages/login.component';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LoginComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly sb = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  private readonly printer = inject(PrintService);
  readonly drawerOpen = signal(false);

  constructor() {
    this.printer.startStationPolling();
  }
}
