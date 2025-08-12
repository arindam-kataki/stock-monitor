// src/app/core/services/settings.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay } from 'rxjs/operators';

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
  private readonly STORAGE_KEY = 'app-settings';

  private settingsSubject = new BehaviorSubject<AppSettings>(
    this.getDefaultSettings()
  );
  public settings$ = this.settingsSubject.asObservable();

  constructor() {
    this.loadSettingsFromStorage();
  }

  private getDefaultSettings(): AppSettings {
    return {
      autoCycle: true,
      cycleInterval: 15,
      showVolume: true,
      enableNotifications: false,
    };
  }

  private loadSettingsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        this.settingsSubject.next(settings);
      }
    } catch (error) {
      console.error('Error loading settings from storage:', error);
    }
  }

  getSettings(): Observable<AppSettings> {
    return of(this.settingsSubject.value).pipe(
      delay(100) // Simulate API call
    );
  }

  updateSettings(settings: Partial<AppSettings>): Observable<void> {
    try {
      const currentSettings = this.settingsSubject.value;
      const updatedSettings = { ...currentSettings, ...settings };

      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSettings));

      // Update BehaviorSubject
      this.settingsSubject.next(updatedSettings);

      // Return observable for consistency
      return of(void 0).pipe(
        delay(100) // Simulate API call
      );
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  resetSettings(): Observable<void> {
    const defaultSettings = this.getDefaultSettings();
    return this.updateSettings(defaultSettings);
  }

  // Get specific setting value
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settingsSubject.value[key];
  }

  // Update specific setting
  updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Observable<void> {
    return this.updateSettings({ [key]: value });
  }
}
