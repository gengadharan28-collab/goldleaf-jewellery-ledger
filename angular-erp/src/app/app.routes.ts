import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'register', loadComponent: () => import('./pages/register.component').then(m => m.RegisterComponent) },
  { path: 'sales-entry', loadComponent: () => import('./pages/sales-entry.component').then(m => m.SalesEntryComponent) },
  { path: 'estimation', loadComponent: () => import('./pages/estimation.component').then(m => m.EstimationComponent) },
  { path: 'ledger', loadComponent: () => import('./pages/ledger.component').then(m => m.LedgerComponent) },
  { path: 'chit-loan', loadComponent: () => import('./pages/chit-loan.component').then(m => m.ChitLoanComponent) },
  { path: 'stock-reports', loadComponent: () => import('./pages/stock-reports.component').then(m => m.StockReportsComponent) },
  { path: 'rate-book', loadComponent: () => import('./pages/rate-book.component').then(m => m.RateBookComponent) },
  { path: 'settings', loadComponent: () => import('./pages/settings.component').then(m => m.SettingsComponent) },
  { path: 'super-admin', loadComponent: () => import('./pages/super-admin.component').then(m => m.SuperAdminComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
