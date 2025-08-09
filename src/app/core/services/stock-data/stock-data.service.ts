import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Category } from '../../models/stock.models';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StockDataService {
  private apiUrl = environment.apiUrl;
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private selectedStocksSubject = new BehaviorSubject<{
    [categoryId: string]: string[];
  }>({});
  public selectedStocks$ = this.selectedStocksSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCategories();
    this.loadSelectionsFromLocalStorage();
  }

  loadCategories(): void {
    this.http
      .get<Category[]>(`${this.apiUrl}/categories`)
      .pipe(
        tap((categories) => {
          console.log('Loaded categories from API:', categories);
          this.categoriesSubject.next(categories);
        }),
        catchError((error) => {
          console.error('Error loading categories:', error);
          return of([]);
        })
      )
      .subscribe();
  }

  getCategories(): Observable<Category[]> {
    return this.categories$;
  }

  toggleStockSelection(categoryId: string, symbol: string): void {
    const currentSelections = this.selectedStocksSubject.value;
    const categorySelections = currentSelections[categoryId] || [];

    const index = categorySelections.indexOf(symbol);
    if (index > -1) {
      categorySelections.splice(index, 1);
    } else {
      categorySelections.push(symbol);
    }

    currentSelections[categoryId] = categorySelections;
    this.selectedStocksSubject.next(currentSelections);
    this.saveToLocalStorage(currentSelections);
  }

  isStockSelected(categoryId: string, symbol: string): boolean {
    const selections = this.selectedStocksSubject.value[categoryId] || [];
    return selections.includes(symbol);
  }

  private saveToLocalStorage(selections: {
    [categoryId: string]: string[];
  }): void {
    localStorage.setItem('selectedStocks', JSON.stringify(selections));
  }

  private loadSelectionsFromLocalStorage(): void {
    const saved = localStorage.getItem('selectedStocks');
    if (saved) {
      this.selectedStocksSubject.next(JSON.parse(saved));
    }
  }

  getSelectedStocks(categoryId: string): string[] {
    return this.selectedStocksSubject.value[categoryId] || [];
  }
}
