import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StockDataService } from '../../core/services/stock-data/stock-data.service';
import {
  SettingsService,
  AppSettings,
} from '../../core/services/settings.service';
import { Category } from '../../core/models/stock.models';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss',
})
export class ConfigurationComponent implements OnInit {
  categories: Category[] = [];
  settings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };
  selectedCounts: { [categoryId: string]: number } = {};
  loading = true;
  error: string | null = null;

  constructor(
    private stockDataService: StockDataService,
    private settingsService: SettingsService
  ) {
    console.log('ConfigurationComponent constructor');
  }

  ngOnInit(): void {
    console.log('ConfigurationComponent ngOnInit');
    this.loadSettings();
    this.loadCategories();
  }

  loadSettings(): void {
    this.settings = this.settingsService.getSettings();
  }

  loadCategories(): void {
    this.loading = true;
    this.stockDataService.getCategories().subscribe({
      next: (categories) => {
        console.log('Categories loaded:', categories);
        this.categories = categories;
        this.updateSelectedCounts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.error =
          'Failed to load categories. Please check if backend is running.';
        this.loading = false;
      },
    });
  }

  toggleStock(categoryId: string, symbol: string): void {
    this.stockDataService.toggleStockSelection(categoryId, symbol);
    this.updateSelectedCounts();
  }

  isSelected(categoryId: string, symbol: string): boolean {
    return this.stockDataService.isStockSelected(categoryId, symbol);
  }

  updateSelectedCounts(): void {
    this.categories.forEach((category) => {
      const count = category.stocks.filter((stock) =>
        this.isSelected(category.id, stock.symbol)
      ).length;
      this.selectedCounts[category.id] = count;
    });
  }

  onSettingChange(): void {
    this.settingsService.updateSettings(this.settings);
  }

  formatLabel(value: number): string {
    return `${value}s`;
  }
}
