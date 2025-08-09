import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
// Import from models instead of defining here
import { Category, Stock } from '../../models/stock.models';

// Remove the duplicate interface definitions (Stock, Category)
// Keep only these additional interfaces:
export interface ChartData {
  symbol: string;
  range: string;
  count: number;
  data: Array<{
    date?: string;
    timestamp?: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export interface UserSelection {
  category_id: string;
  symbol: string;
  stock_name: string;
  category_name: string;
  category_icon: string;
}

@Injectable({
  providedIn: 'root',
})
export class StockDataService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  // BehaviorSubjects for state management
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private selectedStocksSubject = new BehaviorSubject<{
    [key: string]: string[];
  }>({});
  public selectedStocks$ = this.selectedStocksSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCategories();
  }

  // Load categories on initialization
  private loadCategories(): void {
    this.getCategories().subscribe({
      next: (categories) => {
        this.categoriesSubject.next(categories);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      },
    });
  }

  // Get categories from SQLite backend
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

  // Get chart data from SQLite backend
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

  // Get user selections from SQLite
  getUserSelections(userId?: string): Observable<UserSelection[]> {
    const url = userId
      ? `${this.apiUrl}/config/selections/${userId}`
      : `${this.apiUrl}/config/selections`;

    return this.http.get<UserSelection[]>(url).pipe(
      tap((selections) => console.log('User selections loaded:', selections)),
      catchError(this.handleError)
    );
  }

  // Toggle stock selection in SQLite
  toggleStockSelection(
    categoryId: string,
    symbol: string,
    userId: string = 'default'
  ): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/config/selections/toggle`, {
        userId,
        categoryId,
        symbol,
      })
      .pipe(
        tap(() => {
          // Update local state
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

          this.selectedStocksSubject.next(currentSelections);
          console.log('Stock selection toggled:', categoryId, symbol);
        }),
        catchError(this.handleError)
      );
  }

  // Get latest prices for all stocks
  getLatestPrices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stocks/latest`).pipe(
      tap((prices) =>
        console.log('Latest prices loaded:', prices.length, 'stocks')
      ),
      catchError(this.handleError)
    );
  }

  // Get stock statistics
  getStockStats(symbol: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stocks/${symbol}/stats`).pipe(
      tap((stats) => console.log('Stock stats loaded for', symbol, stats)),
      catchError(this.handleError)
    );
  }

  // Check if stock is selected (local state)
  isStockSelected(categoryId: string, symbol: string): boolean {
    const selections = this.selectedStocksSubject.value[categoryId] || [];
    return selections.includes(symbol);
  }

  // Get selected stocks for a category (local state)
  getSelectedStocks(categoryId: string): string[] {
    return this.selectedStocksSubject.value[categoryId] || [];
  }

  // Load selections from backend and update local state
  loadUserSelections(userId: string = 'default'): void {
    this.getUserSelections(userId).subscribe({
      next: (selections) => {
        // Convert array of selections to grouped object
        const grouped: { [key: string]: string[] } = {};

        selections.forEach((selection) => {
          if (!grouped[selection.category_id]) {
            grouped[selection.category_id] = [];
          }
          grouped[selection.category_id].push(selection.symbol);
        });

        this.selectedStocksSubject.next(grouped);
        console.log('Local selections updated:', grouped);
      },
      error: (error) => {
        console.error('Error loading user selections:', error);
      },
    });
  }

  updateCategoryName(categoryId: string, newName: string): Observable<any> {
    return this.http
      .put(`${this.apiUrl}/config/categories/${categoryId}`, {
        name: newName,
      })
      .pipe(
        tap(() => {
          // Update local state
          const categories = this.categoriesSubject.value;
          const category = categories.find((c) => c.id === categoryId);
          if (category) {
            category.name = newName;
            this.categoriesSubject.next([...categories]);
          }
        }),
        catchError(this.handleError)
      );
  }

  // Error handler
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    console.error(errorMessage);
    this.loadingSubject.next(false);
    return throwError(() => new Error(errorMessage));
  }

  // Utility method to refresh all data
  refreshAll(): void {
    this.loadCategories();
    this.loadUserSelections();
    this.getLatestPrices().subscribe();
  }
}
