// src/app/features/dashboard/dashboard.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Services and Models
import { StockDataService } from '../../core/services/stock-data/stock-data.service';
import {
  SettingsService,
  AppSettings,
} from '../../core/services/settings.service';
import {
  Category,
  Ribbon,
  Stock,
  ChartData,
  TimeRange,
} from '../../core/models/stock.models';

// Chart Component
import { StockChartComponent } from '../../shared/components/stock-chart/stock-chart';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatBadgeModule,
    MatDividerModule,
    MatSnackBarModule,
    StockChartComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Ribbons and Categories
  ribbons: Ribbon[] = [];
  activeRibbons: Ribbon[] = [];
  categories: Category[] = [];
  currentRibbon: Ribbon | null = null;
  currentRibbonIndex = 0;

  // Selected Stocks for Current Ribbon
  selectedStocks: Stock[] = [];
  stockChartData: Map<string, ChartData> = new Map();

  // Time Range Selection
  timeRanges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y'];
  selectedTimeRange: TimeRange = '1D';

  // Auto-cycle
  isAutoCycling = false;
  cycleInterval$?: Subscription;
  manualOverride = false;
  cycleProgress = 0;

  // Settings
  settings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };

  // UI State
  loading = true;
  error: string | null = null;
  viewMode: 'grid' | 'list' | 'chart' = 'grid';

  // Real-time updates
  private destroy$ = new Subject<void>();
  private realtimeUpdateInterval$?: Subscription;

  // Statistics
  totalMarketCap = 0;
  averageChange = 0;
  topGainer: Stock | null = null;
  topLoser: Stock | null = null;

  constructor(
    private stockDataService: StockDataService,
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {
    console.log('DashboardComponent constructor');
  }

  ngOnInit(): void {
    console.log('DashboardComponent ngOnInit');
    this.loadSettings();
    this.loadRibbons();
    this.loadCategories();
    this.startRealtimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoCycle();
    this.stopRealtimeUpdates();
  }

  // ============== DATA LOADING ==============

  loadSettings(): void {
    this.settingsService
      .getSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.settings = settings;

        // Restart auto-cycle if settings changed
        if (settings.autoCycle && !this.manualOverride) {
          this.startAutoCycle();
        } else {
          this.stopAutoCycle();
        }
      });
  }

  loadRibbons(): void {
    this.loading = true;
    this.error = null;

    this.stockDataService
      .getUserRibbons()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ribbons) => {
          console.log('Ribbons loaded:', ribbons);
          this.ribbons = ribbons;
          this.activeRibbons = ribbons.filter((r) => r.isActive);

          if (this.activeRibbons.length > 0) {
            this.selectRibbon(0);
          } else {
            this.loading = false;
            this.error =
              'No active ribbons configured. Please configure ribbons in the Configuration page.';
          }
        },
        error: (error) => {
          console.error('Error loading ribbons:', error);
          this.error =
            'Failed to load ribbons. Please check if backend is running.';
          this.loading = false;
        },
      });
  }

  loadCategories(): void {
    this.stockDataService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          console.log('Categories loaded:', categories);
          this.categories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        },
      });
  }

  // ============== RIBBON MANAGEMENT ==============

  selectRibbon(index: number): void {
    if (index < 0 || index >= this.activeRibbons.length) return;

    this.currentRibbonIndex = index;
    this.currentRibbon = this.activeRibbons[index];
    this.loadRibbonStocks(this.currentRibbon);
    this.resetCycleProgress();
  }

  loadRibbonStocks(ribbon: Ribbon): void {
    if (!ribbon) return;

    // Get the category for this ribbon
    const category = this.categories.find((c) => c.id === ribbon.categoryId);

    if (category) {
      // Filter stocks based on ribbon's selected symbols
      this.selectedStocks = category.stocks.filter((stock) =>
        ribbon.selectedStocks.includes(stock.symbol)
      );

      // Load chart data for each selected stock
      this.loadChartDataForStocks();

      // Calculate statistics
      this.calculateStatistics();
    } else {
      this.selectedStocks = [];
    }

    this.loading = false;
  }

  loadChartDataForStocks(): void {
    this.selectedStocks.forEach((stock) => {
      this.stockDataService
        .getChartData(stock.symbol, this.selectedTimeRange)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.stockChartData.set(stock.symbol, data);
            this.updateStockPriceFromChart(stock, data);
          },
          error: (error) => {
            console.error(
              `Error loading chart data for ${stock.symbol}:`,
              error
            );
          },
        });
    });
  }

  updateStockPriceFromChart(stock: Stock, chartData: ChartData): void {
    if (chartData.data && chartData.data.length > 0) {
      const latestData = chartData.data[chartData.data.length - 1];
      const previousData = chartData.data[chartData.data.length - 2];

      stock.price = latestData.close;

      if (previousData) {
        stock.change = latestData.close - previousData.close;
        stock.changePercent = (stock.change / previousData.close) * 100;
      }

      stock.volume = latestData.volume;
    }
  }

  // ============== AUTO-CYCLE ==============

  startAutoCycle(): void {
    if (this.isAutoCycling || this.activeRibbons.length <= 1) return;

    this.stopAutoCycle();
    this.isAutoCycling = true;
    this.manualOverride = false;

    const intervalMs = this.settings.cycleInterval * 1000;

    // Progress animation
    this.cycleInterval$ = interval(100)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cycleProgress += 100 / (intervalMs / 100);

        if (this.cycleProgress >= 100) {
          this.nextRibbon();
          this.cycleProgress = 0;
        }
      });

    this.showSnackBar('Auto-cycling started', 'info');
  }

  stopAutoCycle(): void {
    if (this.cycleInterval$) {
      this.cycleInterval$.unsubscribe();
      this.cycleInterval$ = undefined;
    }
    this.isAutoCycling = false;
    this.cycleProgress = 0;
  }

  pauseAutoCycle(): void {
    this.stopAutoCycle();
    this.manualOverride = true;
    this.showSnackBar('Auto-cycling paused', 'info');
  }

  resumeAutoCycle(): void {
    this.manualOverride = false;
    if (this.settings.autoCycle) {
      this.startAutoCycle();
    }
  }

  resetCycleProgress(): void {
    this.cycleProgress = 0;
  }

  // ============== RIBBON NAVIGATION ==============

  nextRibbon(): void {
    const nextIndex = (this.currentRibbonIndex + 1) % this.activeRibbons.length;
    this.selectRibbon(nextIndex);
  }

  previousRibbon(): void {
    const prevIndex =
      this.currentRibbonIndex === 0
        ? this.activeRibbons.length - 1
        : this.currentRibbonIndex - 1;
    this.selectRibbon(prevIndex);
  }

  manualSelectRibbon(index: number): void {
    this.selectRibbon(index);
    this.pauseAutoCycle();
  }

  // ============== TIME RANGE ==============

  selectTimeRange(range: TimeRange): void {
    this.selectedTimeRange = range;
    this.loadChartDataForStocks();
  }

  // ============== VIEW MODE ==============

  setViewMode(mode: 'grid' | 'list' | 'chart'): void {
    this.viewMode = mode;
  }

  // ============== REAL-TIME UPDATES ==============

  startRealtimeUpdates(): void {
    // Update prices every 30 seconds
    this.realtimeUpdateInterval$ = interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshPrices();
      });
  }

  stopRealtimeUpdates(): void {
    if (this.realtimeUpdateInterval$) {
      this.realtimeUpdateInterval$.unsubscribe();
    }
  }

  refreshPrices(): void {
    this.stockDataService
      .getLatestPrices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (prices) => {
          this.updateStockPrices(prices);
          this.calculateStatistics();
        },
        error: (error) => {
          console.error('Error refreshing prices:', error);
        },
      });
  }

  updateStockPrices(pricesMap: any): void {
    this.selectedStocks.forEach((stock) => {
      const priceData = pricesMap[stock.symbol];
      if (priceData) {
        stock.price = priceData.price;
        stock.change = priceData.change;
        stock.changePercent = priceData.changePercent;
        stock.volume = priceData.volume;
      }
    });
  }

  // ============== STATISTICS ==============

  calculateStatistics(): void {
    if (this.selectedStocks.length === 0) return;

    // Calculate total market cap
    this.totalMarketCap = this.selectedStocks.reduce((sum, stock) => {
      const marketCap = this.parseMarketCap(stock.marketCap);
      return sum + marketCap;
    }, 0);

    // Calculate average change
    const totalChange = this.selectedStocks.reduce(
      (sum, stock) => sum + (stock.changePercent || 0),
      0
    );
    this.averageChange = totalChange / this.selectedStocks.length;

    // Find top gainer and loser
    this.topGainer = this.selectedStocks.reduce(
      (max, stock) =>
        (stock.changePercent || 0) > (max?.changePercent || -Infinity)
          ? stock
          : max,
      null as Stock | null
    );

    this.topLoser = this.selectedStocks.reduce(
      (min, stock) =>
        (stock.changePercent || 0) < (min?.changePercent || Infinity)
          ? stock
          : min,
      null as Stock | null
    );
  }

  private parseMarketCap(marketCapStr?: string): number {
    if (!marketCapStr) return 0;

    const multipliers: { [key: string]: number } = {
      B: 1e9,
      M: 1e6,
      K: 1e3,
    };

    const match = marketCapStr.match(/^([\d.]+)([BMK])?$/);
    if (match) {
      const value = parseFloat(match[1]);
      const multiplier = multipliers[match[2]] || 1;
      return value * multiplier;
    }

    return 0;
  }

  // ============== UTILITY METHODS ==============

  getMockPrice(): string {
    return (Math.random() * 500 + 100).toFixed(2);
  }

  getMockChange(): number {
    return (Math.random() - 0.5) * 10;
  }

  getChartData(symbol: string): ChartData | undefined {
    return this.stockChartData.get(symbol);
  }

  formatPrice(price?: number): string {
    if (!price) return '0.00';
    return price.toFixed(2);
  }

  formatChange(change?: number): string {
    if (!change) return '0.00';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  }

  formatChangePercent(changePercent?: number): string {
    if (!changePercent) return '0.00%';
    const sign = changePercent >= 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(2)}%`;
  }

  formatVolume(volume?: number): string {
    if (!volume) return '0';

    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(2)}K`;
    }

    return volume.toString();
  }

  formatMarketCap(marketCap?: string | number): string {
    if (typeof marketCap === 'string') return marketCap;
    if (!marketCap) return 'N/A';

    const value =
      typeof marketCap === 'number' ? marketCap : parseFloat(marketCap);

    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }

    return `$${value.toFixed(2)}`;
  }

  getRibbonProgress(index: number): number {
    if (index === this.currentRibbonIndex && this.isAutoCycling) {
      return this.cycleProgress;
    }
    return 0;
  }

  isRibbonActive(index: number): boolean {
    return index === this.currentRibbonIndex;
  }

  getStockChangeClass(stock: Stock): string {
    const change = stock.changePercent || 0;
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  }

  // ============== NOTIFICATIONS ==============

  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ): void {
    const config = {
      duration: 3000,
      horizontalPosition: 'end' as const,
      verticalPosition: 'bottom' as const,
      panelClass: [`snackbar-${type}`],
    };

    this.snackBar.open(message, 'Close', config);
  }

  // ============== EXPORT FUNCTIONALITY ==============

  exportDashboardData(): void {
    const exportData = {
      ribbon: this.currentRibbon?.name,
      stocks: this.selectedStocks.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
      })),
      timeRange: this.selectedTimeRange,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-${this.currentRibbon?.name}-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.showSnackBar('Dashboard data exported', 'success');
  }

  // ============== REFRESH ==============

  refreshDashboard(): void {
    this.loading = true;
    this.loadRibbons();
    this.refreshPrices();
  }
}
