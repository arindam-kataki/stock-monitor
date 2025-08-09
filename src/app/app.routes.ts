// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/configuration',
    pathMatch: 'full'
  },
  {
    path: 'configuration',
    loadComponent: () => import('./features/configuration/configuration').then(m => m.ConfigurationComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'analytics',
    loadComponent: () => import('./features/analytics/analytics').then(m => m.AnalyticsComponent)
  },
  {
    path: '**',
    redirectTo: '/configuration'
  }
];