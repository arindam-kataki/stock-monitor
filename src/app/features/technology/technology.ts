// src/app/features/technology/technology.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-technology',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './technology.html',
  styleUrls: ['./technology.scss'],
})
export class TechnologyComponent {
  // All technologies in alphabetical order
  technologies = [
    'Angular',
    'Angular Material',
    'Chart.js',
    'Express.js',
    'Nginx',
    'Node.js',
    'REST API',
    'RxJS',
    'SCSS',
    'SQLite',
    'TypeScript',
  ];

  // Preselected stock tickers (corrected - no UBER)
  preselectedStocks = [
    'AAPL',
    'AMZN',
    'CVX',
    'DIS',
    'EBAY',
    'F',
    'GM',
    'GOOGL',
    'HD',
    'JNJ',
    'JPM',
    'MA',
    'META',
    'MSFT',
    'NEE',
    'NFLX',
    'NKE',
    'NVDA',
    'ORCL',
    'PFE',
    'PYPL',
    'QQQ',
    'SBUX',
    'SHOP',
    'SPY',
    'TM',
    'TSLA',
    'UNH',
    'V',
    'WMT',
    'XOM',
  ];
}
