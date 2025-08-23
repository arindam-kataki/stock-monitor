// src/app/features/dashboard/dashboard.ts

import {
  Component,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
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
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

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
  ChartDataPoint,
  TimeRange,
  CombinedChartData,
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
    MatTableModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatSelectModule,
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
  timeRanges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M'];
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

  sortBy: string = 'symbol-asc';

  isDropdownOpen = false;
  displayedColumns: string[] = [
    'symbol',
    'name',
    'price',
    'change',
    'volume',
    'trend',
  
  ];

  stockDataSource = new MatTableDataSource<Stock>([]);
  combinedChartData: CombinedChartData | null = null; // Like analytics' normalizedData
  private combinedLabels: string[] = []; // Like analytics' chartLabels
  private combinedDatasets: any[] = [];

  realPrices: Map<string, any> = new Map();
  isFetchingPrices = false;
  lastPriceUpdate: Date | null = null;

  @ViewChildren('sparklineCanvas') sparklineCanvases!: QueryList<
    ElementRef<HTMLCanvasElement>
  >;

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
    this.loadCategories();

    this.subscribeToRealPrices();
    this.loadRealPrices();
    this.startPriceRefresh();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.loadRibbons();
      this.startRealtimeUpdates();
      this.setupSparklineRendering();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoCycle();
    this.stopRealtimeUpdates();
  }

  formatLabel(value: number): string {
    if (value >= 60) {
      const minutes = Math.floor(value / 60);
      const seconds = value % 60;
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${value}s`;
  }

  // =============== SPARKLINES ================

  private setupSparklineRendering(): void {

    // Initial render after a delay to ensure data is loaded
    setTimeout(() => {
      this.renderAllSparklines();
    }, 1000);

    // Re-render when canvas elements change (e.g., switching to list view)
    if (this.sparklineCanvases) {
      this.sparklineCanvases.changes.subscribe(() => {
        setTimeout(() => this.renderAllSparklines(), 100);
      });
    }
  }

  // Add method to render all sparklines
  private renderAllSparklines(): void {
    if (!this.sparklineCanvases) return;

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      this.sparklineCanvases.forEach((canvasRef) => {
        const canvas = canvasRef.nativeElement;
        const symbol = canvas.getAttribute('data-symbol');
        if (symbol) {
          this.drawSparkline(canvas, symbol);
        }
      });
    }, 100);
  }

  // Main sparkline drawing method
  private drawSparkline(canvas: HTMLCanvasElement, symbol: string): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chartData = this.getChartData(symbol);
    if (!chartData || !chartData.data || chartData.data.length === 0) return;

    // Get the last N points (adjust based on time range)
    const pointsToShow = this.getSparklinePoints();
    const data = chartData.data.slice(-pointsToShow);

    if (data.length < 2) return;

    // Extract prices
    const prices = data.map((d) => d.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    const padding = 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Determine color based on trend
    const isPositive = prices[prices.length - 1] >= prices[0];
    const lineColor = isPositive ? '#28a745' : '#dc3545';

    // Optional: Add a subtle gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(40, 167, 69, 0.1)');
      gradient.addColorStop(1, 'rgba(40, 167, 69, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(220, 53, 69, 0.1)');
      gradient.addColorStop(1, 'rgba(220, 53, 69, 0)');
    }

    // Draw the area fill first
    ctx.beginPath();
    prices.forEach((price, i) => {
      const x = padding + (i / (prices.length - 1)) * (width - 2 * padding);
      const y = padding + (1 - (price - min) / range) * (height - 2 * padding);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Complete the fill area
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    prices.forEach((price, i) => {
      const x = padding + (i / (prices.length - 1)) * (width - 2 * padding);
      const y = padding + (1 - (price - min) / range) * (height - 2 * padding);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Optional: Add a dot for the last point
    const lastX = width - padding;
    const lastY =
      padding +
      (1 - (prices[prices.length - 1] - min) / range) * (height - 2 * padding);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, 2 * Math.PI);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Helper method to determine number of points based on time range
  private getSparklinePoints(): number {
    switch (this.selectedTimeRange) {
      case '1D':
        return 20; // Show more detail for intraday
      case '5D':
        return 5; // One point per day
      case '1M':
        return 20; // ~1 point per trading day
      case '3M':
        return 15; // Weekly points
      case '6M':
        return 26; // Bi-weekly points
      case '1Y':
        return 52; // Weekly points
      default:
        return 20;
    }
  }

  // Call this when data updates or time range changes
  private refreshSparklines(): void {
    this.renderAllSparklines();
  }

  // =============== YAHOO DATA ================

  /**
   * Update market statistics based on current stocks
   */
  updateMarketStats(): void {
    if (this.selectedStocks.length === 0) {
      this.totalMarketCap = 0;
      this.averageChange = 0;
      this.topGainer = null;
      this.topLoser = null;
      return;
    }

    // Calculate total market cap
    this.totalMarketCap = this.selectedStocks.reduce((total, stock) => {
      const marketCap = this.parseMarketCap(stock.marketCap);
      return total + marketCap;
    }, 0);

    // Calculate average change
    const totalChange = this.selectedStocks.reduce((sum, stock) => {
      return sum + (stock.changePercent || 0);
    }, 0);
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

    console.log('Market stats updated:', {
      totalMarketCap: this.totalMarketCap,
      averageChange: this.averageChange,
      topGainer: this.topGainer?.symbol,
      topLoser: this.topLoser?.symbol,
    });
  }

  /**
   * Parse market cap string to number
   */
  private parseMarketCap(marketCapStr?: string): number {
    if (!marketCapStr) return 0;

    const multipliers: { [key: string]: number } = {
      T: 1e12, // Trillion
      B: 1e9, // Billion
      M: 1e6, // Million
      K: 1e3, // Thousand
    };

    // Handle formats like "1.5T", "850.3B", "45.2M"
    const match = marketCapStr.match(/^([\d.]+)([TBMK])?$/i);
    if (match) {
      const value = parseFloat(match[1]);
      const multiplier = multipliers[match[2]?.toUpperCase()] || 1;
      return value * multiplier;
    }

    // Try to parse as regular number
    const parsed = parseFloat(marketCapStr.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Subscribe to real prices observable
   */
  private subscribeToRealPrices(): void {
    this.stockDataService.realPrices$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prices) => {
        this.realPrices = prices;
        this.applyRealPricesToStocks();
      });
  }

  /**
   * Load real prices from database
   */
  loadRealPrices(): void {
    this.stockDataService.loadRealPrices().subscribe({
      next: (prices) => {
        this.lastPriceUpdate = new Date();
        console.log(`Loaded ${prices.length} real prices from database`);
      },
      error: (error) => {
        console.error('Error loading real prices:', error);
      },
    });
  }

  /**
   * Apply real prices to currently displayed stocks
   */
  private applyRealPricesToStocks(): void {
    if (this.selectedStocks.length === 0) return;

    let updated = false;
    this.selectedStocks.forEach((stock) => {
      const realPrice = this.realPrices.get(stock.symbol);
      if (realPrice) {
        // Update stock with real price data
        stock.price = realPrice.price;
        stock.change = realPrice.change;
        stock.changePercent = realPrice.change_percent;
        stock.volume = realPrice.volume;
        updated = true;
      }
    });

    if (updated) {
      // Trigger change detection
      this.selectedStocks = [...this.selectedStocks];
      this.updateMarketStats();
    }
  }

  /**
   * Fetch fresh prices for current category from Yahoo
   */
  fetchCategoryPrices(): void {
    if (!this.currentRibbon || this.isFetchingPrices) {
      return;
    }

    this.isFetchingPrices = true;
    const categoryId = this.currentRibbon.categoryId || '';

    if (!categoryId) {
      console.error('No category ID found for current ribbon');
      this.isFetchingPrices = false;
      return;
    }

    this.stockDataService.fetchCategoryPrices(categoryId).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(`Updated ${response.fetched} stocks`, 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        } else {
          this.snackBar.open('Failed to fetch some prices', 'Close', {
            duration: 3000,
          });
        }
      },
      error: (error) => {
        console.error('Error fetching prices:', error);
        this.snackBar.open('Error fetching prices', 'Close', {
          duration: 3000,
        });
      },
      complete: () => {
        this.isFetchingPrices = false;
      },
    });
  }

  /**
   * Get formatted last update text
   */
  getLastUpdateText(): string {
    if (!this.lastPriceUpdate) {
      return 'No prices loaded';
    }

    const now = new Date();
    const diffSeconds = Math.floor(
      (now.getTime() - this.lastPriceUpdate.getTime()) / 1000
    );

    if (diffSeconds < 60) {
      return `Updated ${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      return `Updated ${Math.floor(diffSeconds / 60)}m ago`;
    } else if (diffSeconds < 86400) {
      return `Updated ${Math.floor(diffSeconds / 3600)}h ago`;
    } else {
      return `Updated ${Math.floor(diffSeconds / 86400)}d ago`;
    }
  }

  /**
   * Check if a stock has real price data
   */
  hasRealPrice(symbol: string): boolean {
    return this.realPrices.has(symbol);
  }

  /**
   * Start automatic price refresh
   */
  private startPriceRefresh(): void {
    // Refresh every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.isFetchingPrices) {
          this.loadRealPrices();
        }
      });
  }

  /**
   * Format market cap for display
   */
  formatMarketCap(value: number): string {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
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
          }

          this.loading = false; // Just set loading to false
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
    console.log('loadChartDataForStocks called');

    if (this.selectedStocks.length === 0) {
      this.combinedChartData = null;
      return;
    }

    let loadedCount = 0;
    const totalStocks = this.selectedStocks.length;

    this.selectedStocks.forEach((stock) => {
      this.stockDataService
        .getChartData(stock.symbol, this.selectedTimeRange)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            console.log(`Loaded chart data for ${stock.symbol}`);
            this.stockChartData.set(stock.symbol, data);
            this.updateStockPriceFromChart(stock, data);

            loadedCount++;
            console.log(
              `Progress: ${loadedCount}/${totalStocks} stocks loaded`
            );

            // When all stocks are loaded, update combined chart
            if (loadedCount === totalStocks) {
              console.log('All chart data loaded, updating combined chart');
              this.updateCombinedChartData();
              this.calculateStatistics();
            }
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

  // ============= AGGREGATION ==============

  // Add this method to aggregate data to weekly points
  private aggregateToWeekly(data: ChartDataPoint[]): ChartDataPoint[] {
    if (data.length === 0) return [];

    // Helper function to safely get date
    const getPointDate = (point: ChartDataPoint): Date => {
      if (point.date) {
        return new Date(point.date);
      } else if (point.timestamp) {
        return new Date(point.timestamp);
      } else {
        // This shouldn't happen with real data, but satisfies TypeScript
        console.warn('Data point missing both date and timestamp');
        return new Date();
      }
    };

    const weeklyData: ChartDataPoint[] = [];
    let currentWeek: ChartDataPoint[] = [];
    let currentWeekStart = getPointDate(data[0]);
    currentWeekStart.setDate(
      currentWeekStart.getDate() - currentWeekStart.getDay()
    );

    data.forEach((point) => {
      const pointDate = getPointDate(point);
      const weekStart = new Date(pointDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      // Check if this point belongs to a new week
      if (
        weekStart.getTime() !== currentWeekStart.getTime() &&
        currentWeek.length > 0
      ) {
        // Aggregate the current week's data
        weeklyData.push(this.createWeeklyCandle(currentWeek));
        currentWeek = [];
        currentWeekStart = weekStart;
      }

      currentWeek.push(point);
    });

    // Don't forget the last week
    if (currentWeek.length > 0) {
      weeklyData.push(this.createWeeklyCandle(currentWeek));
    }

    console.log(
      `Aggregated ${data.length} daily points to ${weeklyData.length} weekly points`
    );
    return weeklyData;
  }

  // Also update createWeeklyCandle to handle undefined values
  private createWeeklyCandle(weekData: ChartDataPoint[]): ChartDataPoint {
    const firstDay = weekData[0];
    const lastDay = weekData[weekData.length - 1];

    return {
      date: firstDay.date, // || new Date().toISOString(), // Provide default
      timestamp: firstDay.timestamp, // || Date.now(), // Provide default
      open: firstDay.open,
      close: lastDay.close,
      high: Math.max(...weekData.map((d) => d.high)),
      low: Math.min(...weekData.map((d) => d.low)),
      volume: weekData.reduce((sum, d) => sum + d.volume, 0),
    };
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

  updateCycleInterval(): void {
    this.settingsService.updateSettings(this.settings);
    if (this.isAutoCycling) {
      this.pauseAutoCycle();
      this.resumeAutoCycle();
    }
  }

  getStatusText(): string {
    if (!this.settings.autoCycle) return 'Manual';
    if (this.isAutoCycling) return 'Auto';
    if (this.manualOverride) return 'Paused';
    return 'Stopped';
  }

  toggleAutoCycle(): void {
    if (this.settings.autoCycle) {
      this.resumeAutoCycle();
    } else {
      this.pauseAutoCycle();
    }
  }

  // ============== TIME RANGE ==============

  selectTimeRange(range: TimeRange): void {
    this.selectedTimeRange = range;
    this.loadChartDataForStocks();
    setTimeout(() => this.refreshSparklines(), 500);
  }

  // ============== VIEW MODE ==============

  setViewMode(mode: 'grid' | 'list' | 'chart'): void {
    this.viewMode = mode;
  }

  sortStocks(): void {
    const [field, direction] = this.sortBy.split('-');

    this.selectedStocks.sort((a, b) => {
      let compareValue = 0;

      switch (field) {
        case 'symbol':
          compareValue = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          compareValue = (a.price || 0) - (b.price || 0);
          break;
        case 'change':
          compareValue = (a.changePercent || 0) - (b.changePercent || 0);
          break;
        case 'volume':
          compareValue = (a.volume || 0) - (b.volume || 0);
          break;
      }

      return direction === 'desc' ||
        direction === 'worst' ||
        direction === 'low'
        ? -compareValue
        : compareValue;
    });


    if (this.stockDataSource) {
      this.stockDataSource.data = [...this.selectedStocks];
    }
  
    // If sparklines are visible, re-render them after sorting
    if (this.viewMode === 'list') {
      setTimeout(() => this.renderAllSparklines(), 100);
    }

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

  getPriceChange(symbol: string): number {
    const chartData = this.stockChartData.get(symbol);
    if (!chartData || !chartData.data || chartData.data.length < 2) return 0;

    const latest = chartData.data[chartData.data.length - 1].close;
    const previous = chartData.data[chartData.data.length - 2].close;
    return ((latest - previous) / previous) * 100;
  }

  getLatestPrice(symbol: string): number {
    const chartData = this.stockChartData.get(symbol);
    if (!chartData || !chartData.data || chartData.data.length === 0) return 0;

    // Get the last data point's close price
    return chartData.data[chartData.data.length - 1].close;
  }

  getPriceChangeAmount(symbol: string): number {
    const chartData = this.stockChartData.get(symbol);
    if (!chartData || !chartData.data || chartData.data.length < 2) return 0;

    const latest = chartData.data[chartData.data.length - 1].close;
    const previous = chartData.data[chartData.data.length - 2].close;
    return latest - previous;
  }

  getVolume(symbol: string): number {
    const chartData = this.stockChartData.get(symbol);
    if (!chartData || !chartData.data || chartData.data.length === 0) return 0;

    // Get the last data point's volume
    return chartData.data[chartData.data.length - 1].volume;
  }

  private updateCombinedChartData(): void {
    console.log('=== updateCombinedChartData START ===');

    this.combinedLabels = [];
    this.combinedDatasets = [];

    if (!this.allStocksHaveData) {
      console.log('Not all stocks have data yet');
      this.combinedChartData = null;
      return;
    }

    // Determine if we should sample the data
    const shouldSample = ['3M', '6M', '1Y'].includes(this.selectedTimeRange);

    // Get and process first stock's data for labels
    const firstStock = this.selectedStocks[0];
    const firstData = this.stockChartData.get(firstStock.symbol);

    if (firstData && firstData.data && firstData.data.length > 0) {
      // Sample to weekly if needed
      const processedData = shouldSample
        ? this.aggregateToWeekly(firstData.data)
        : firstData.data;

      // Create labels from processed data
      this.combinedLabels = processedData.map((point) =>
        this.formatDateLabel(new Date(point.date || point.timestamp || ''))
      );

      console.log(
        `Labels: ${firstData.data.length} daily → ${
          this.combinedLabels.length
        } ${shouldSample ? 'weekly' : 'daily'}`
      );
    }

    // Create datasets for each stock
    this.selectedStocks.forEach((stock, index) => {
      const data = this.stockChartData.get(stock.symbol);

      if (data && data.data && data.data.length > 0) {
        // Sample to weekly if needed
        const processedData = shouldSample
          ? this.aggregateToWeekly(data.data)
          : data.data;

        const basePrice = processedData[0].close;

        if (basePrice && basePrice > 0) {
          const normalizedPrices = processedData.map(
            (point) => ((point.close - basePrice) / basePrice) * 100
          );

          this.combinedDatasets.push({
            label: stock.symbol,
            data: normalizedPrices,
            borderColor: this.getColorForIndex(index),
            backgroundColor: this.getColorForIndex(index, 0.1),
            borderWidth: 2,
            tension: 0.1,
            fill: false,
            pointRadius: shouldSample ? 3 : 0, // Show points for weekly data
            pointHoverRadius: 5,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          });

          console.log(
            `${stock.symbol}: ${data.data.length} daily → ${
              processedData.length
            } ${shouldSample ? 'weekly' : 'daily'} points`
          );
        }
      }
    });

    // Set the combined data
    this.combinedChartData = {
      symbol: 'combined',
      range: this.selectedTimeRange,
      count: this.combinedLabels.length,
      data: [],
      chartLabels: this.combinedLabels,
      chartDatasets: this.combinedDatasets,
    };

    console.log('=== updateCombinedChartData COMPLETE ===', {
      timeRange: this.selectedTimeRange,
      sampled: shouldSample,
      labels: this.combinedLabels.length,
      datasets: this.combinedDatasets.length,
    });
  }

  private _updateCombinedChartData(): void {
    console.log('=== updateCombinedChartData START ===');
    console.log('selectedStocks:', this.selectedStocks);
    console.log('allStocksHaveData:', this.allStocksHaveData);

    // Check what data we have
    this.selectedStocks.forEach((stock) => {
      const data = this.stockChartData.get(stock.symbol);
      console.log(`Stock ${stock.symbol} data:`, {
        hasData: !!data,
        dataLength: data?.data?.length,
      });
    });

    // Reset data (like analytics does)
    this.combinedLabels = [];
    this.combinedDatasets = [];

    if (this.selectedStocks.length === 0 || !this.allStocksHaveData) {
      this.combinedChartData = null;
      return;
    }

    console.log('Updating combined chart data');

    // Get labels from first stock
    const firstStock = this.selectedStocks[0];
    const firstData = this.stockChartData.get(firstStock.symbol);

    if (firstData && firstData.data && firstData.data.length > 0) {
      this.combinedLabels = firstData.data.map((point) =>
        this.formatDateLabel(new Date(point.date || point.timestamp || ''))
      );
    }

    // Create datasets (like analytics does)
    this.selectedStocks.forEach((stock, index) => {
      const data = this.stockChartData.get(stock.symbol);

      if (data && data.data && data.data.length > 0) {
        const basePrice = data.data[0].close;

        if (basePrice && basePrice > 0) {
          const normalizedPrices = data.data.map(
            (point) => ((point.close - basePrice) / basePrice) * 100
          );

          this.combinedDatasets.push({
            label: stock.symbol,
            data: normalizedPrices,
            borderColor: this.getColorForIndex(index),
            backgroundColor: this.getColorForIndex(index, 0.1),
            borderWidth: 2,
            tension: 0.1,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4,
          });
        }
      }
    });

    // Set the combined data property (like analytics sets normalizedData)
    this.combinedChartData = {
      symbol: 'combined',
      range: this.selectedTimeRange,
      count: this.combinedLabels.length,
      data: [],
      chartLabels: this.combinedLabels,
      chartDatasets: this.combinedDatasets,
    };

    console.log('Combined chart data updated:', {
      labelsCount: this.combinedLabels.length,
      datasetsCount: this.combinedDatasets.length,
    });
  }

  private getColorForIndex(index: number, alpha: number = 1): string {
    const colors = [
      `rgba(102, 126, 234, ${alpha})`,
      `rgba(240, 147, 251, ${alpha})`,
      `rgba(79, 172, 254, ${alpha})`,
      `rgba(0, 242, 254, ${alpha})`,
      `rgba(67, 233, 123, ${alpha})`,
      `rgba(250, 112, 154, ${alpha})`,
      `rgba(254, 225, 64, ${alpha})`,
      `rgba(48, 207, 208, ${alpha})`,
    ];
    return colors[index % colors.length];
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
      case '3M':
      case '6M':
        // For weekly aggregated data, show month and week
        options.month = 'short';
        options.day = 'numeric';
        break;
      case '1Y':
        options.month = 'short';
        options.year = '2-digit';
        break;
      default:
        options.month = 'short';
        options.year = '2-digit';
    }

    return date.toLocaleDateString('en-US', options);
  }

  private _formatDateLabel(date: Date): string {
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

  get allStocksHaveData(): boolean {
    return this.selectedStocks.every((stock) => {
      const chartData = this.stockChartData.get(stock.symbol);
      return chartData && chartData.data && chartData.data.length > 0;
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

  private _parseMarketCap(marketCapStr?: string): number {
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

  // ============== DRILL DOWN ===================

  viewStockDetails(stock: Stock): void {
    // Option 1: Navigate to a detail page
    // this.router.navigate(['/stock', stock.symbol]);

    // Option 2: Open in a modal dialog
    // const dialogRef = this.dialog.open(StockDetailDialog, {
    //   width: '800px',
    //   data: { stock, chartData: this.getChartData(stock.symbol) }
    // });

    // Option 3: Expand inline (add a property to track expanded state)
    console.log('View details for:', stock.symbol);

    // For now, just show a snackbar
    this.snackBar.open(`Viewing ${stock.name} (${stock.symbol})`, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  addAlert(stock: Stock): void {
    // You could open a dialog to configure the alert
    // const dialogRef = this.dialog.open(AddAlertDialog, {
    //   width: '400px',
    //   data: { stock }
    // });

    // dialogRef.afterClosed().subscribe(result => {
    //   if (result) {
    //     this.saveAlert(stock, result);
    //   }
    // });

    // For now, just show confirmation
    this.snackBar.open(
      `Alert configuration for ${stock.symbol} - Feature coming soon!`,
      'OK',
      {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      }
    );
  }

  // Helper method for saving alerts (future implementation)
  private saveAlert(stock: Stock, alertConfig: any): void {
    console.log('Saving alert:', stock.symbol, alertConfig);
    // Implement alert saving logic
    this.snackBar.open('Alert saved successfully', 'Close', {
      duration: 3000,
    });
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

  _formatMarketCap(marketCap?: string | number): string {
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
