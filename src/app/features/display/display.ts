// src/app/features/display/display.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';

// Services
import {
  SettingsService,
  AppSettings,
} from '../../core/services/settings.service';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatButtonToggleModule,
    MatSelectModule,
  ],
  templateUrl: './display.html',
  styleUrl: './display.scss',
})
export class DisplayComponent implements OnInit {
  // Settings
  settings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };

  // Additional display settings
  displaySettings = {
    defaultTimeRange: '1D',
    defaultChartType: 'line',
    reduceAnimations: false,
    dataRefreshRate: '30s',
    theme: 'light',
    compactMode: false,
    showGridLines: true,
    showLegend: true,
  };

  // Time range options
  timeRangeOptions = ['1D', '5D', '1M', '6M', '1Y'];

  // Chart type options
  chartTypeOptions = ['line', 'candlestick', 'area', 'bar'];

  // Refresh rate options
  refreshRateOptions = [
    { value: 'realtime', label: 'Real-time' },
    { value: '30s', label: '30 seconds' },
    { value: '1m', label: '1 minute' },
    { value: '5m', label: '5 minutes' },
  ];

  // UI State
  loading = false;
  saving = false;

  constructor(
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadDisplaySettings();
  }

  // Load settings from service
  loadSettings(): void {
    this.loading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings: AppSettings) => {
        this.settings = settings;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading settings:', error);
        this.showSnackBar('Failed to load settings', 'error');
        this.loading = false;
      },
    });
  }

  // Load display settings from localStorage
  loadDisplaySettings(): void {
    try {
      const stored = localStorage.getItem('displaySettings');
      if (stored) {
        this.displaySettings = {
          ...this.displaySettings,
          ...JSON.parse(stored),
        };
      }
    } catch (error) {
      console.error('Error loading display settings:', error);
    }
  }

  // Save settings when changed
  onSettingChange(): void {
    this.saving = true;
    this.settingsService.updateSettings(this.settings).subscribe({
      next: () => {
        this.showSnackBar('Settings saved', 'success');
        this.saving = false;
      },
      error: (error: any) => {
        console.error('Error saving settings:', error);
        this.showSnackBar('Failed to save settings', 'error');
        this.saving = false;
      },
    });
  }

  // Update display setting
  onDisplaySettingChange(setting: string, value: any): void {
    (this.displaySettings as any)[setting] = value;
    this.saveDisplaySettings();
  }

  // Save display settings
  saveDisplaySettings(): void {
    try {
      localStorage.setItem(
        'displaySettings',
        JSON.stringify(this.displaySettings)
      );
      this.showSnackBar('Display settings updated', 'success');
    } catch (error) {
      console.error('Error saving display settings:', error);
      this.showSnackBar('Failed to save display settings', 'error');
    }
  }

  // Reset settings to defaults
  resetToDefaults(): void {
    this.settings = {
      autoCycle: true,
      cycleInterval: 15,
      showVolume: true,
      enableNotifications: false,
    };

    this.displaySettings = {
      defaultTimeRange: '1D',
      defaultChartType: 'line',
      reduceAnimations: false,
      dataRefreshRate: '30s',
      theme: 'light',
      compactMode: false,
      showGridLines: true,
      showLegend: true,
    };

    this.onSettingChange();
    this.saveDisplaySettings();
  }

  // Test notification permission
  async testNotifications(): Promise<void> {
    if (!('Notification' in window)) {
      this.showSnackBar(
        'Notifications not supported in this browser',
        'warning'
      );
      return;
    }

    if (Notification.permission === 'denied') {
      this.showSnackBar(
        'Notifications are blocked. Please enable them in browser settings',
        'warning'
      );
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('Stock Monitor Pro', {
        body: 'Notifications are working!',
        icon: '/assets/icons/icon-128x128.png',
      });
      this.showSnackBar('Test notification sent!', 'success');
      return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('Stock Monitor Pro', {
        body: 'Notifications enabled successfully!',
        icon: '/assets/icons/icon-128x128.png',
      });
      this.showSnackBar('Notifications enabled!', 'success');
    } else {
      this.showSnackBar('Notification permission denied', 'warning');
    }
  }

  // Show snackbar notification
  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ): void {
    const config = {
      duration: 3000,
      horizontalPosition: 'end' as const,
      verticalPosition: 'bottom' as const,
      panelClass: [`snackbar-${type}`],
    };

    this.snackBar.open(message, 'Close', config);
  }

  // Get formatted cycle interval display
  getCycleIntervalDisplay(): string {
    const interval = this.settings.cycleInterval;
    if (interval < 60) {
      return `${interval} seconds`;
    } else {
      const minutes = Math.floor(interval / 60);
      const seconds = interval % 60;
      return seconds > 0
        ? `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} seconds`
        : `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  // Get performance recommendation based on settings
  getPerformanceRecommendation(): string {
    if (this.settings.cycleInterval < 10) {
      return 'Fast cycling may impact performance';
    } else if (this.settings.cycleInterval > 30) {
      return 'Slower cycling for better battery life';
    } else {
      return 'Balanced performance';
    }
  }

  // Export all settings
  exportSettings(): void {
    const allSettings = {
      appSettings: this.settings,
      displaySettings: this.displaySettings,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(allSettings, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `display-settings-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.showSnackBar('Settings exported', 'success');
  }

  // Import settings
  importSettings(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);

        if (imported.appSettings) {
          this.settings = { ...this.settings, ...imported.appSettings };
          this.onSettingChange();
        }

        if (imported.displaySettings) {
          this.displaySettings = {
            ...this.displaySettings,
            ...imported.displaySettings,
          };
          this.saveDisplaySettings();
        }

        this.showSnackBar('Settings imported successfully', 'success');
      } catch (error) {
        console.error('Error importing settings:', error);
        this.showSnackBar('Failed to import settings', 'error');
      }
    };

    reader.readAsText(file);
    input.value = '';
  }
}
