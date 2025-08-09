// src/app/core/services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
  private defaultSettings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(
    this.loadSettings()
  );
  public settings$ = this.settingsSubject.asObservable();

  private loadSettings(): AppSettings {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : this.defaultSettings;
  }

  updateSettings(settings: Partial<AppSettings>): void {
    const current = this.settingsSubject.value;
    const updated = { ...current, ...settings };
    this.settingsSubject.next(updated);
    localStorage.setItem('appSettings', JSON.stringify(updated));
  }

  getSettings(): AppSettings {
    return this.settingsSubject.value;
  }
}
