// src/app/core/services/settings.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  autoCycle: boolean;
  cycleInterval: number;
  showVolume: boolean;
  enableNotifications: boolean;
  theme?: string;
  defaultTimeRange?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  private settingsSubject = new BehaviorSubject<AppSettings>({
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
    theme: 'light',
    defaultTimeRange: '5D',
  });

  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSettings();
  }

  // Load settings from backend
  private loadSettings(): void {
    this.getSettings().subscribe({
      next: (settings) => {
        this.settingsSubject.next(settings);
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        // Use default settings on error
      },
    });
  }

  // Get settings from SQLite backend
  getSettings(userId: string = 'default'): Observable<AppSettings> {
    return this.http
      .get<AppSettings>(`${this.apiUrl}/config/settings/${userId}`)
      .pipe(
        tap((settings) => {
          console.log('Settings loaded:', settings);
          this.settingsSubject.next(settings);
        }),
        catchError((error) => {
          console.error('Error fetching settings:', error);
          // Return current settings as fallback
          return [this.settingsSubject.value];
        })
      );
  }

  // Update settings in SQLite backend
  updateSettings(
    settings: Partial<AppSettings>,
    userId: string = 'default'
  ): Observable<any> {
    // Update local state immediately
    const updated = { ...this.settingsSubject.value, ...settings };
    this.settingsSubject.next(updated);

    // Then sync with backend
    return this.http
      .put(`${this.apiUrl}/config/settings/${userId}`, settings)
      .pipe(
        tap(() => console.log('Settings updated:', settings)),
        catchError((error) => {
          console.error('Error updating settings:', error);
          // Revert local state on error
          this.loadSettings();
          throw error;
        })
      );
  }

  // Get current settings value
  getCurrentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  // Update single setting
  updateSetting(
    key: keyof AppSettings,
    value: any,
    userId: string = 'default'
  ): Observable<any> {
    const update = { [key]: value };
    return this.updateSettings(update, userId);
  }
}
