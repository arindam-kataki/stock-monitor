import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/configuration',
    pathMatch: 'full'
  },
  {
    path: 'configuration',
    loadComponent: () => import('./features/configuration/configuration.component')
      .then(m => m.ConfigurationComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component')
      .then(m => m.DashboardComponent)
  },
  {
    path: 'analytics',
    loadComponent: () => import('./features/analytics/analytics.component')
      .then(m => m.AnalyticsComponent)
  }
];