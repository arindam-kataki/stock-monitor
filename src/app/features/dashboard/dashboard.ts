import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StockChartComponent } from '../../shared/components/stock-chart/stock-chart'; // Add this!
import { StockDataService } from '../../core/services/stock-data/stock-data.service';
import {
  SettingsService,
  AppSettings,
} from '../../core/services/settings.service';
import { Category } from '../../core/models/stock.models';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    StockChartComponent, // Add this!
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  currentCategoryIndex = 0;
  currentCategory: Category | null = null;
  selectedStocks: any[] = [];
  settings: AppSettings;

  timeRanges = ['1D', '5D', '1M', '6M', '1Y'];
  selectedTimeRange = '5D';

  cycleSubscription?: Subscription;
  isAutoCycling = false;

  loading = true;

  constructor(
    private stockDataService: StockDataService,
    private settingsService: SettingsService
  ) {
    this.settings = this.settingsService.getSettings();
  }

  ngOnInit(): void {
    this.loadData();
    this.setupAutoCycle();
  }

  ngOnDestroy(): void {
    this.stopAutoCycle();
  }

  loadData(): void {
    this.stockDataService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        if (categories.length > 0) {
          this.selectCategory(0);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.loading = false;
      },
    });

    // Subscribe to settings changes
    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
      if (settings.autoCycle && !this.isAutoCycling) {
        this.startAutoCycle();
      } else if (!settings.autoCycle && this.isAutoCycling) {
        this.stopAutoCycle();
      }
    });
  }

  selectCategory(index: number): void {
    this.currentCategoryIndex = index;
    this.currentCategory = this.categories[index];
    this.loadSelectedStocks();
  }

  loadSelectedStocks(): void {
    if (!this.currentCategory) return;

    // Get selected stocks for current category
    const selectedSymbols = this.stockDataService.getSelectedStocks(
      this.currentCategory.id
    );
    this.selectedStocks = this.currentCategory.stocks.filter((stock) =>
      selectedSymbols.includes(stock.symbol)
    );

    // If no stocks selected, show all stocks in category (limit to 4)
    if (this.selectedStocks.length === 0) {
      this.selectedStocks = this.currentCategory.stocks.slice(0, 4);
    }
  }

  setupAutoCycle(): void {
    if (this.settings.autoCycle) {
      this.startAutoCycle();
    }
  }

  startAutoCycle(): void {
    this.stopAutoCycle(); // Clear any existing subscription
    this.isAutoCycling = true;

    this.cycleSubscription = interval(
      this.settings.cycleInterval * 1000
    ).subscribe(() => {
      this.nextCategory();
    });
  }

  stopAutoCycle(): void {
    if (this.cycleSubscription) {
      this.cycleSubscription.unsubscribe();
      this.cycleSubscription = undefined;
    }
    this.isAutoCycling = false;
  }

  nextCategory(): void {
    const nextIndex = (this.currentCategoryIndex + 1) % this.categories.length;
    this.selectCategory(nextIndex);
  }

  previousCategory(): void {
    const prevIndex =
      this.currentCategoryIndex === 0
        ? this.categories.length - 1
        : this.currentCategoryIndex - 1;
    this.selectCategory(prevIndex);
  }

  manualSelectCategory(index: number): void {
    this.stopAutoCycle(); // Stop auto-cycle when manually selecting
    this.selectCategory(index);
  }

  selectTimeRange(range: string): void {
    this.selectedTimeRange = range;
    // TODO: Reload chart data for new time range
  }

  // Mock price data for now
  getMockPrice(): string {
    return (Math.random() * 500 + 100).toFixed(2);
  }

  getMockChange(): number {
    return Math.random() * 10 - 5;
  }
}
