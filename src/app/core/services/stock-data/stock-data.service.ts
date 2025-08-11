// src/app/core/services/stock-data/stock-data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Stock,
  Category,
  ChartData,
  Ribbon,
  UserSelection,
} from '../../models/stock.models';
import { RibbonFormData } from '../../../features/configuration/add-ribbon-dialog/add-ribbon-dialog.interface';

@Injectable({
  providedIn: 'root',
})
export class StockDataService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  // BehaviorSubjects for state management
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private ribbonsSubject = new BehaviorSubject<Ribbon[]>([]);
  public ribbons$ = this.ribbonsSubject.asObservable();

  private selectedStocksSubject = new BehaviorSubject<{
    [key: string]: string[];
  }>({});
  public selectedStocks$ = this.selectedStocksSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCategories();
  }

  // ============== CATEGORIES ==============

  // Load categories on initialization
  private loadCategories(): void {
    this.getCategories().subscribe({
      next: (categories) => {
        this.categoriesSubject.next(categories);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading categories:', error);
      },
    });
  }

  // Get categories from backend
  getCategories(): Observable<Category[]> {
    this.loadingSubject.next(true);

    return this.http.get<Category[]>(`${this.apiUrl}/config/categories`).pipe(
      tap((categories) => {
        console.log('Categories loaded:', categories);
        this.categoriesSubject.next(categories);
        this.loadingSubject.next(false);
      }),
      catchError(this.handleError)
    );
  }

  // ============== RIBBONS ==============

  // Get user's ribbons
  getUserRibbons(userId?: string): Observable<Ribbon[]> {
    const url = userId
      ? `${this.apiUrl}/ribbons/${userId}`
      : `${this.apiUrl}/ribbons`;

    return this.http.get<Ribbon[]>(url).pipe(
      tap((ribbons) => {
        console.log('Ribbons loaded:', ribbons);
        this.ribbonsSubject.next(ribbons);
      }),
      catchError(this.handleError)
    );
  }

  // Create new ribbon
  createRibbon(ribbonData: RibbonFormData): Observable<Ribbon> {
    // Ensure stockAlerts is included in the payload
    const payload = {
      ...ribbonData,
      stockAlerts: ribbonData.stockAlerts || [],
    };

    console.log('Creating ribbon with payload:', payload);

    return this.http.post<Ribbon>(`${this.apiUrl}/ribbons`, payload).pipe(
      tap((ribbon) => {
        console.log('Ribbon created with alerts:', ribbon);
        const currentRibbons = this.ribbonsSubject.value;
        this.ribbonsSubject.next([...currentRibbons, ribbon]);
      }),
      catchError(this.handleError)
    );
  }

  // Update ribbon with alerts
  updateRibbon(
    ribbonId: number,
    data: Partial<RibbonFormData> | any
  ): Observable<Ribbon> {
    // Ensure stockAlerts is included in the payload
    const payload = {
      ...data,
      stockAlerts: data.stockAlerts || [],
    };

    console.log('Updating ribbon with payload:', payload);

    return this.http
      .put<Ribbon>(`${this.apiUrl}/ribbons/${ribbonId}`, payload)
      .pipe(
        tap((updatedRibbon) => {
          console.log('Ribbon updated with alerts:', updatedRibbon);
          const currentRibbons = this.ribbonsSubject.value;
          const index = currentRibbons.findIndex((r) => r.id === ribbonId);
          if (index !== -1) {
            currentRibbons[index] = updatedRibbon;
            this.ribbonsSubject.next([...currentRibbons]);
          }
        }),
        catchError(this.handleError)
      );
  }

  // Update ribbon name only
  updateRibbonName(ribbonId: number, name: string): Observable<any> {
    return this.http
      .patch(`${this.apiUrl}/ribbons/${ribbonId}/name`, { name })
      .pipe(
        tap(() => {
          console.log('Ribbon name updated');
          const currentRibbons = this.ribbonsSubject.value;
          const ribbon = currentRibbons.find((r) => r.id === ribbonId);
          if (ribbon) {
            ribbon.name = name;
            this.ribbonsSubject.next([...currentRibbons]);
          }
        }),
        catchError(this.handleError)
      );
  }

  // Delete ribbon
  deleteRibbon(ribbonId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ribbons/${ribbonId}`).pipe(
      tap(() => {
        console.log('Ribbon deleted:', ribbonId);
        const currentRibbons = this.ribbonsSubject.value;
        const filtered = currentRibbons.filter((r) => r.id !== ribbonId);
        this.ribbonsSubject.next(filtered);
      }),
      catchError(this.handleError)
    );
  }

  // Update ribbon order
  updateRibbonOrder(
    updates: Array<{ id: number; orderIndex: number }>
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/ribbons/order/batch`, updates).pipe(
      tap(() => console.log('Ribbon order updated')),
      catchError(this.handleError)
    );
  }

  // ============== CHART DATA ==============

  // Get chart data from backend
  getChartData(symbol: string, range: string): Observable<ChartData> {
    return this.http
      .get<ChartData>(`${this.apiUrl}/stocks/${symbol}/chart/${range}`)
      .pipe(
        tap((data) =>
          console.log(
            `Chart data loaded for ${symbol} (${range}):`,
            data.count,
            'points'
          )
        ),
        catchError(this.handleError)
      );
  }

  // ============== USER SELECTIONS (Legacy - for backward compatibility) ==============

  // Get user selections
  getUserSelections(userId?: string): Observable<UserSelection[]> {
    const url = userId
      ? `${this.apiUrl}/config/selections/${userId}`
      : `${this.apiUrl}/config/selections`;

    return this.http.get<UserSelection[]>(url).pipe(
      tap((selections) => console.log('User selections loaded:', selections)),
      catchError(this.handleError)
    );
  }

  // Toggle stock selection (legacy)
  toggleStockSelection(categoryId: string, symbol: string): void {
    const currentSelections = this.selectedStocksSubject.value;
    if (!currentSelections[categoryId]) {
      currentSelections[categoryId] = [];
    }

    const index = currentSelections[categoryId].indexOf(symbol);
    if (index > -1) {
      currentSelections[categoryId].splice(index, 1);
    } else {
      currentSelections[categoryId].push(symbol);
    }

    this.selectedStocksSubject.next({ ...currentSelections });

    // Persist to backend
    this.http
      .post(`${this.apiUrl}/config/selections/toggle`, {
        categoryId,
        symbol,
      })
      .subscribe({
        next: () => console.log('Selection toggled'),
        error: (error: HttpErrorResponse) =>
          console.error('Error toggling selection:', error),
      });
  }

  // Check if stock is selected (legacy)
  isStockSelected(categoryId: string, symbol: string): boolean {
    const selections = this.selectedStocksSubject.value;
    return selections[categoryId]?.includes(symbol) || false;
  }

  // Get selected stocks for a category (legacy)
  getSelectedStocks(categoryId: string): Stock[] {
    const category = this.categoriesSubject.value.find(
      (c) => c.id === categoryId
    );
    const selections = this.selectedStocksSubject.value[categoryId] || [];

    if (!category) return [];

    return category.stocks.filter((stock) => selections.includes(stock.symbol));
  }

  // ============== REAL-TIME PRICES ==============

  // Get latest prices
  getLatestPrices(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stocks/latest`).pipe(
      tap((prices) => console.log('Latest prices loaded')),
      catchError(this.handleError)
    );
  }

  // Update real-time price
  updateRealtimePrice(
    symbol: string,
    price: number,
    change: number,
    changePercent: number,
    volume: number
  ): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/stocks/${symbol}/realtime`, {
        price,
        change,
        changePercent,
        volume,
      })
      .pipe(catchError(this.handleError));
  }

  // ============== CATEGORY MANAGEMENT ==============

  // Update category name
  updateCategoryName(categoryId: string, name: string): Observable<any> {
    return this.http
      .put(`${this.apiUrl}/config/categories/${categoryId}`, { name })
      .pipe(
        tap(() => {
          const categories = this.categoriesSubject.value;
          const category = categories.find((c) => c.id === categoryId);
          if (category) {
            category.name = name;
            this.categoriesSubject.next([...categories]);
          }
        }),
        catchError(this.handleError)
      );
  }

  // ============== ERROR HANDLING ==============

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;

      if (error.status === 0) {
        errorMessage =
          'Cannot connect to server. Please check if the backend is running.';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found';
      } else if (error.status === 500) {
        errorMessage = 'Server error occurred';
      }
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // ============== UTILITY METHODS ==============

  // Clear all data
  clearData(): void {
    this.categoriesSubject.next([]);
    this.ribbonsSubject.next([]);
    this.selectedStocksSubject.next({});
    this.loadingSubject.next(false);
  }

  // Refresh all data
  refreshData(): void {
    this.loadCategories();
    this.getUserRibbons().subscribe();
  }
}
