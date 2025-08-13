// src/app/features/analytics/analytics.ts

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Chart.js
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Services and Models
import { StockDataService } from '../../core/services/stock-data/stock-data.service';
import {
  Stock,
  Ribbon,
  ChartData,
  ChartDataPoint,
  TimeRange,
} from '../../core/models/stock.models';

Chart.register(...registerables);

interface NormalizedDataSet {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  tension: number;
  borderWidth: number;
  pointRadius: number;
  pointHoverRadius: number;
}

interface HeatmapCell {
  symbol: string;
  name: string;
  change: number;
  volume: number;
  marketCap?: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatSnackBarModule,
  ],
  templateUrl: './analytics.html',
  styleUrls: ['./analytics.scss'],
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  @ViewChild('comparisonChart')
  comparisonChartRef!: ElementRef<HTMLCanvasElement>;

  // View State
  viewMode: 'comparison' | 'heatmap' | 'correlation' = 'comparison';
  loading = false;
  error: string | null = null;

  // Data
  ribbons: Ribbon[] = [];
  selectedRibbons: Ribbon[] = [];
  allStocks: Stock[] = [];
  selectedStocks: Stock[] = [];
  stockChartData: Map<string, ChartData> = new Map();

  // Chart
  private comparisonChart?: Chart;
  normalizedData: NormalizedDataSet[] = [];
  chartLabels: string[] = [];

  // Time Range
  timeRanges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y'];
  selectedTimeRange: TimeRange = '1M';

  // Comparison Settings
  showBenchmark = false;
  benchmarkSymbol = '^GSPC'; // S&P 500
  baselineDate?: Date;

  // Heatmap Data
  heatmapData: HeatmapCell[] = [];
  heatmapSortBy: 'change' | 'volume' | 'alphabetical' = 'change';

  // Performance
  topPerformerChange = 0;
  bottomPerformerChange = 0;

  // Color Palette for Charts
  private colors = [
    '#667eea',
    '#f093fb',
    '#4facfe',
    '#00f2fe',
    '#43e97b',
    '#fa709a',
    '#fee140',
    '#30cfd0',
    '#a8edea',
    '#fed6e3',
    '#ff9a9e',
    '#fecfef',
    '#a1c4fd',
    '#c2e9fb',
    '#d4fc79',
  ];

  // Performance Metrics
  topPerformer: Stock | null = null;
  bottomPerformer: Stock | null = null;
  averageChange = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private stockDataService: StockDataService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.comparisonChart) {
      this.comparisonChart.destroy();
    }
  }

  // ============== DATA LOADING ==============

  private loadData(): void {
    this.loading = true;

    // Load ribbons
    this.stockDataService.ribbons$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (ribbons) => {
        this.ribbons = ribbons.filter((r) => r.isActive);
        if (this.ribbons.length > 0 && this.selectedRibbons.length === 0) {
          // Auto-select first ribbon
          this.selectedRibbons = [this.ribbons[0]];
          this.loadStocksForRibbons();
        }
      },
      error: (error) => {
        this.error = 'Failed to load ribbons';
        this.loading = false;
      },
    });
  }

  loadStocksForRibbons(): void {
    this.selectedStocks = [];

    for (const ribbon of this.selectedRibbons) {
      // Get stocks for this ribbon
      this.stockDataService
        .getStocksBySymbols(ribbon.selectedStocks)
        .subscribe({
          next: (stocks) => {
            this.selectedStocks.push(...stocks);
            this.loadChartData();
          },
          error: (error) => {
            console.error('Error loading stocks:', error);
          },
        });
    }
  }

  private loadChartData(): void {
    // Generate mock data for each stock
    for (const stock of this.selectedStocks) {
      const data = this.generateMockChartData(stock.symbol);
      this.stockChartData.set(stock.symbol, data);
    }

    this.createNormalizedData();
    this.createHeatmapData();
    this.calculateMetrics();
    this.loading = false;
  }

  // ============== NORMALIZED COMPARISON ==============

  private createNormalizedData(): void {
    this.normalizedData = [];
    this.chartLabels = [];

    if (this.selectedStocks.length === 0) return;

    // Get the shortest dataset length
    let minDataPoints = Infinity;
    for (const stock of this.selectedStocks) {
      const data = this.stockChartData.get(stock.symbol);
      if (data && data.data.length < minDataPoints) {
        minDataPoints = data.data.length;
      }
    }

    // Create labels from first stock's data
    const firstStockData = this.stockChartData.get(
      this.selectedStocks[0].symbol
    );
    if (firstStockData) {
      this.chartLabels = firstStockData.data
        .slice(0, minDataPoints)
        .map((point) => {
          const date = new Date(point.date || point.timestamp || '');
          return this.formatDateLabel(date);
        });
    }

    // Create normalized dataset for each stock
    this.selectedStocks.forEach((stock, index) => {
      const data = this.stockChartData.get(stock.symbol);
      if (!data) return;

      const basePrice = data.data[0].close;
      const normalizedValues = data.data
        .slice(0, minDataPoints)
        .map((point) => {
          return ((point.close - basePrice) / basePrice) * 100;
        });

      this.normalizedData.push({
        label: stock.symbol,
        data: normalizedValues,
        borderColor: this.colors[index % this.colors.length],
        backgroundColor: this.colors[index % this.colors.length] + '20',
        fill: false,
        tension: 0.1,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
      });
    });

    // Add benchmark if enabled
    if (this.showBenchmark) {
      this.addBenchmarkData();
    }

    this.updateComparisonChart();
  }

  private addBenchmarkData(): void {
    // Mock benchmark data (S&P 500)
    const benchmarkData = Array.from(
      { length: this.chartLabels.length },
      (_, i) => {
        // Simulate S&P 500 performance
        return Math.sin(i * 0.1) * 5 + i * 0.05;
      }
    );

    this.normalizedData.push({
      label: 'S&P 500',
      data: benchmarkData,
      borderColor: '#ff6b6b',
      backgroundColor: '#ff6b6b20',
      fill: false,
      tension: 0.1,
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 5,
    });
  }

  private updateComparisonChart(): void {
    if (!this.comparisonChartRef) return;

    const ctx = this.comparisonChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.comparisonChart) {
      this.comparisonChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.chartLabels,
        datasets: this.normalizedData,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Normalized Performance Comparison (%)',
            font: { size: 16 },
          },
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(
                  2
                )}%`;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false,
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Change (%)',
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              callback: (value) => value + '%',
            },
          },
        },
      },
    };

    this.comparisonChart = new Chart(ctx, config);
  }

  // ============== HEATMAP ==============

  private createHeatmapData(): void {
    this.heatmapData = [];

    for (const stock of this.selectedStocks) {
      const data = this.stockChartData.get(stock.symbol);
      if (!data || data.data.length < 2) continue;

      const firstPrice = data.data[0].close;
      const lastPrice = data.data[data.data.length - 1].close;
      const change = ((lastPrice - firstPrice) / firstPrice) * 100;
      const volume = data.data[data.data.length - 1].volume;

      this.heatmapData.push({
        symbol: stock.symbol,
        name: stock.name,
        change: change,
        volume: volume,
        marketCap: stock.marketCap,
      });
    }

    this.sortHeatmap();
  }

  sortHeatmap(): void {
    switch (this.heatmapSortBy) {
      case 'change':
        this.heatmapData.sort((a, b) => b.change - a.change);
        break;
      case 'volume':
        this.heatmapData.sort((a, b) => b.volume - a.volume);
        break;
      case 'alphabetical':
        this.heatmapData.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
    }
  }

  getHeatmapColor(change: number): string {
    if (change > 5) return 'strong-positive';
    if (change > 2) return 'positive';
    if (change > 0) return 'slight-positive';
    if (change > -2) return 'slight-negative';
    if (change > -5) return 'negative';
    return 'strong-negative';
  }

  // ============== METRICS ==============

  private calculateMetrics(): void {
    if (this.heatmapData.length === 0) {
      this.topPerformer = null;
      this.bottomPerformer = null;
      this.topPerformerChange = 0;
      this.bottomPerformerChange = 0;
      this.averageChange = 0;
      return;
    }

    // Sort by performance
    const sorted = [...this.heatmapData].sort((a, b) => b.change - a.change);

    // Top performer
    const topCell = sorted[0];
    this.topPerformer =
      this.selectedStocks.find((s) => s.symbol === topCell.symbol) || null;
    this.topPerformerChange = topCell.change;

    // Bottom performer
    const bottomCell = sorted[sorted.length - 1];
    this.bottomPerformer =
      this.selectedStocks.find((s) => s.symbol === bottomCell.symbol) || null;
    this.bottomPerformerChange = bottomCell.change;

    // Average
    const sum = this.heatmapData.reduce((acc, cell) => acc + cell.change, 0);
    this.averageChange = sum / this.heatmapData.length;
  }

  // ============== USER INTERACTIONS ==============

  onRibbonSelectionChange(): void {
    this.loadStocksForRibbons();
  }

  onTimeRangeChange(range: TimeRange): void {
    this.selectedTimeRange = range;
    this.loadChartData();
  }

  toggleBenchmark(): void {
    this.showBenchmark = !this.showBenchmark;
    this.createNormalizedData();
  }

  onViewModeChange(mode: 'comparison' | 'heatmap' | 'correlation'): void {
    this.viewMode = mode;
    if (mode === 'comparison') {
      setTimeout(() => this.updateComparisonChart(), 100);
    }
  }

  addStock(): void {
    // Open dialog to add individual stocks
    this.snackBar.open('Add stock feature coming soon!', 'Close', {
      duration: 3000,
    });
  }

  exportData(): void {
    // Export chart as image or data as CSV
    this.snackBar.open('Export feature coming soon!', 'Close', {
      duration: 3000,
    });
  }

  // ============== UTILITY METHODS ==============

  private generateMockChartData(symbol: string): ChartData {
    const dataPoints: ChartDataPoint[] = [];
    const basePrice = Math.random() * 200 + 50;
    const volatility = Math.random() * 0.05 + 0.01;

    const days = this.getDataPointsForRange();

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));

      const randomChange = (Math.random() - 0.5) * volatility;
      const trend = i * 0.001; // Slight upward trend
      const close = basePrice * (1 + randomChange + trend);

      dataPoints.push({
        date: date.toISOString(),
        open: close * (1 + (Math.random() - 0.5) * 0.01),
        high: close * (1 + Math.random() * 0.02),
        low: close * (1 - Math.random() * 0.02),
        close: close,
        volume: Math.floor(Math.random() * 10000000),
      });
    }

    return {
      symbol: symbol,
      range: this.selectedTimeRange,
      count: dataPoints.length,
      data: dataPoints,
    };
  }

  private getDataPointsForRange(): number {
    switch (this.selectedTimeRange) {
      case '1D':
        return 24;
      case '5D':
        return 5;
      case '1M':
        return 30;
      case '3M':
        return 90;
      case '6M':
        return 180;
      case '1Y':
        return 365;
      default:
        return 30;
    }
  }

  // Add these methods to src/app/features/analytics/analytics.ts

  getTopPerformerChange(): number {
    if (!this.topPerformer) return 0;
    const cell = this.heatmapData.find(
      (h) => h.symbol === this.topPerformer!.symbol
    );
    return cell ? cell.change : 0;
  }

  getBottomPerformerChange(): number {
    if (!this.bottomPerformer) return 0;
    const cell = this.heatmapData.find(
      (h) => h.symbol === this.bottomPerformer!.symbol
    );
    return cell ? cell.change : 0;
  }

  private formatDateLabel(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {};

    switch (this.selectedTimeRange) {
      case '1D':
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case '5D':
        options.weekday = 'short';
        break;
      case '1M':
        options.month = 'short';
        options.day = 'numeric';
        break;
      default:
        options.month = 'short';
        options.year = '2-digit';
    }

    return date.toLocaleDateString('en-US', options);
  }

  formatChange(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  formatVolume(volume: number): string {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toString();
  }
}
