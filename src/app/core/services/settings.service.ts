// src/app/core/services/settings.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppSettings {
  autoCycle: boolean;
  cycleInterval: number;
  showVolume: boolean;
  enableNotifications: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly STORAGE_KEY = 'stock-monitor-settings';

  private defaultSettings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };

  private settingsSubject: BehaviorSubject<AppSettings>;
  public settings$: Observable<AppSettings>;

  constructor() {
    const savedSettings = this.loadFromStorage();
    this.settingsSubject = new BehaviorSubject<AppSettings>(savedSettings);
    this.settings$ = this.settingsSubject.asObservable();
  }

  // Get current settings as an Observable
  getSettings(): Observable<AppSettings> {
    return this.settings$;
  }

  // Get current settings value synchronously
  getSettingsValue(): AppSettings {
    return this.settingsSubject.value;
  }

  // Update settings
  updateSettings(settings: Partial<AppSettings>): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = { ...currentSettings, ...settings };

    this.settingsSubject.next(updatedSettings);
    this.saveToStorage(updatedSettings);
  }

  // Update a single setting
  updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings = { ...currentSettings, [key]: value };

    this.settingsSubject.next(updatedSettings);
    this.saveToStorage(updatedSettings);
  }

  // Reset to default settings
  resetToDefaults(): void {
    this.settingsSubject.next(this.defaultSettings);
    this.saveToStorage(this.defaultSettings);
  }

  // Private methods for storage
  private loadFromStorage(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return { ...this.defaultSettings, ...parsed };
      }
    } catch (error) {
      console.error('Error loading settings from storage:', error);
    }
    return this.defaultSettings;
  }

  private saveToStorage(settings: AppSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to storage:', error);
    }
  }
}
