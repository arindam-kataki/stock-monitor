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
  timeRanges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y'];
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

  chartSize: 'small' | 'medium' | 'large' = 'medium';

  @ViewChild('correlationChart')
  correlationChartRef!: ElementRef<HTMLCanvasElement>;
  private correlationChart?: Chart;
  correlationMatrix: number[][] = [];
  correlationLabels: string[] = [];

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

  getSortLabel(): string {
    switch (this.heatmapSortBy) {
      case 'change':
        return 'Performance';
      case 'volume':
        return 'Volume';
      case 'alphabetical':
        return 'Alphabetical';
      default:
        return 'Performance';
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

  // Add these methods
  decreaseChartSize(): void {
    if (this.chartSize === 'large') {
      this.chartSize = 'medium';
    } else if (this.chartSize === 'medium') {
      this.chartSize = 'small';
    }

    // Resize the chart after a brief delay to allow CSS transition
    setTimeout(() => {
      if (this.comparisonChart) {
        this.comparisonChart.resize();
      }
    }, 300);
  }

  increaseChartSize(): void {
    if (this.chartSize === 'small') {
      this.chartSize = 'medium';
    } else if (this.chartSize === 'medium') {
      this.chartSize = 'large';
    }

    // Resize the chart after a brief delay
    setTimeout(() => {
      if (this.comparisonChart) {
        this.comparisonChart.resize();
      }
    }, 300);
  }

  resetChartSize(): void {
    this.chartSize = 'medium';

    // Resize the chart after a brief delay
    setTimeout(() => {
      if (this.comparisonChart) {
        this.comparisonChart.resize();
      }
    }, 300);
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

  // ================= CORRELATION =========================

  /**
   * Calculate correlation matrix between all selected stocks
   */
  private calculateCorrelations(): void {
    if (this.selectedStocks.length < 2) {
      this.correlationMatrix = [];
      this.correlationLabels = [];
      return;
    }

    // Get price data for each stock
    const priceArrays: number[][] = [];
    this.correlationLabels = [];

    for (const stock of this.selectedStocks) {
      const data = this.stockChartData.get(stock.symbol);
      if (data && data.data && data.data.length > 0) {
        const prices = data.data.map((point) => point.close);
        priceArrays.push(prices);
        this.correlationLabels.push(stock.symbol);
      }
    }

    // Calculate correlation matrix
    const n = priceArrays.length;
    this.correlationMatrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          this.correlationMatrix[i][j] = 1; // Perfect correlation with itself
        } else if (i < j) {
          const correlation = this.calculatePearsonCorrelation(
            priceArrays[i],
            priceArrays[j]
          );
          this.correlationMatrix[i][j] = correlation;
          this.correlationMatrix[j][i] = correlation; // Matrix is symmetric
        }
      }
    }

    // Update the chart if we're in correlation view
    if (this.viewMode === 'correlation') {
      setTimeout(() => this.updateCorrelationChart(), 100);
    }
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    // Calculate means
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    // Calculate correlation
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denominatorX += dx * dx;
      denominatorY += dy * dy;
    }

    const denominator = Math.sqrt(denominatorX * denominatorY);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Update the correlation matrix chart
   */
  private updateCorrelationChart(): void {
    if (!this.correlationChartRef || this.correlationMatrix.length === 0)
      return;

    const ctx = this.correlationChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.correlationChart) {
      this.correlationChart.destroy();
    }

    // Prepare data for the heatmap
    const data: any[] = [];
    const n = this.correlationMatrix.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        data.push({
          x: this.correlationLabels[j],
          y: this.correlationLabels[i],
          v: this.correlationMatrix[i][j],
        });
      }
    }

    // Create the chart
    const config: ChartConfiguration = {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: 'Correlation',
            data: data,
            backgroundColor: (context: any) => {
              // ADD TYPE HERE
              const value = (context.raw as any).v;
              return this.getCorrelationColor(value);
            },
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            radius: (context: any) => {
              // ADD TYPE HERE
              const size = Math.min(400 / n, 40);
              return size;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Stock Correlation Matrix',
            font: { size: 16 },
          },
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: () => '',
              label: (context) => {
                const raw = context.raw as any;
                const correlation = (raw.v * 100).toFixed(1);
                if (raw.x === raw.y) {
                  return `${raw.x}: 100% (self)`;
                }
                return `${raw.x} vs ${raw.y}: ${correlation}%`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            position: 'bottom',
            labels: this.correlationLabels,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              font: {
                size: 12,
                weight: 'bold',
              },
            },
          },
          y: {
            type: 'category',
            position: 'left',
            labels: this.correlationLabels,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              font: {
                size: 12,
                weight: 'bold',
              },
            },
          },
        },
      },
    };

    this.correlationChart = new Chart(ctx, config);
  }

  /**
   * Get color for correlation value
   */
  getCorrelationColor(value: number): string {
    // Strong positive correlation (0.7 to 1.0) - Red
    if (value >= 0.7) {
      const intensity = (value - 0.7) / 0.3;
      return `rgba(220, 53, 69, ${0.5 + intensity * 0.5})`;
    }
    // Moderate positive correlation (0.3 to 0.7) - Orange
    else if (value >= 0.3) {
      const intensity = (value - 0.3) / 0.4;
      return `rgba(255, 193, 7, ${0.5 + intensity * 0.5})`;
    }
    // Weak correlation (-0.3 to 0.3) - Gray
    else if (value >= -0.3) {
      return 'rgba(108, 117, 125, 0.3)';
    }
    // Moderate negative correlation (-0.7 to -0.3) - Light Blue
    else if (value >= -0.7) {
      const intensity = Math.abs(value + 0.3) / 0.4;
      return `rgba(23, 162, 184, ${0.5 + intensity * 0.5})`;
    }
    // Strong negative correlation (-1.0 to -0.7) - Blue
    else {
      const intensity = Math.abs(value + 0.7) / 0.3;
      return `rgba(0, 123, 255, ${0.5 + intensity * 0.5})`;
    }
  }

  /**
   * Get correlation strength label
   */
  getCorrelationStrength(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 0.7) return 'Strong';
    if (absValue >= 0.3) return 'Moderate';
    return 'Weak';
  }

  /**
   * Format correlation value for display
   */
  formatCorrelation(value: number): string {
    return (value * 100).toFixed(0) + '%';
  }

  // Add these helper methods to your AnalyticsComponent class:

  /**
   * Get the most correlated pair of stocks
   */
  getMostCorrelatedPair(): {
    stock1: string;
    stock2: string;
    correlation: number;
  } | null {
    if (this.correlationMatrix.length < 2) return null;

    let maxCorr = -1;
    let pair = { stock1: '', stock2: '', correlation: 0 };

    for (let i = 0; i < this.correlationMatrix.length; i++) {
      for (let j = i + 1; j < this.correlationMatrix.length; j++) {
        const corr = this.correlationMatrix[i][j];
        if (corr > maxCorr && corr < 0.99) {
          // Exclude self-correlation
          maxCorr = corr;
          pair = {
            stock1: this.correlationLabels[i],
            stock2: this.correlationLabels[j],
            correlation: corr,
          };
        }
      }
    }

    return pair.stock1 ? pair : null;
  }

  /**
   * Get the least correlated (most diversified) pair of stocks
   */
  getLeastCorrelatedPair(): {
    stock1: string;
    stock2: string;
    correlation: number;
  } | null {
    if (this.correlationMatrix.length < 2) return null;

    let minCorr = 2;
    let pair = { stock1: '', stock2: '', correlation: 0 };

    for (let i = 0; i < this.correlationMatrix.length; i++) {
      for (let j = i + 1; j < this.correlationMatrix.length; j++) {
        const corr = Math.abs(this.correlationMatrix[i][j]);
        if (corr < minCorr) {
          minCorr = corr;
          pair = {
            stock1: this.correlationLabels[i],
            stock2: this.correlationLabels[j],
            correlation: this.correlationMatrix[i][j],
          };
        }
      }
    }

    return pair.stock1 ? pair : null;
  }

  /**
   * Calculate portfolio diversity score
   */
  getPortfolioDiversityScore(): string {
    if (this.correlationMatrix.length < 2) return 'N/A';

    let totalCorr = 0;
    let count = 0;

    for (let i = 0; i < this.correlationMatrix.length; i++) {
      for (let j = i + 1; j < this.correlationMatrix.length; j++) {
        totalCorr += Math.abs(this.correlationMatrix[i][j]);
        count++;
      }
    }

    if (count === 0) return 'N/A';

    const avgCorr = totalCorr / count;
    const diversityScore = (1 - avgCorr) * 100;
    return diversityScore.toFixed(0) + '%';
  }

  /**
   * Get diversity label based on score
   */
  getDiversityLabel(): string {
    const scoreStr = this.getPortfolioDiversityScore();
    if (scoreStr === 'N/A') return '';

    const score = parseFloat(scoreStr);
    if (score >= 70) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 30) return 'Moderate';
    return 'Low';
  }
}
