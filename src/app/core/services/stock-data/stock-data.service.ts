// Update the service to use new SQLite endpoints
export class StockDataService {
  private apiUrl = environment.apiUrl;

  // Get categories from SQLite
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/config/categories`);
  }

  // Get chart data from SQLite
  getChartData(symbol: string, range: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/stocks/${symbol}/chart/${range}`);
  }

  // Get user selections from SQLite
  getUserSelections(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/config/selections`);
  }

  // Toggle selection in SQLite
  toggleStockSelection(categoryId: string, symbol: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/config/selections/toggle`, {
      categoryId,
      symbol
    });
  }

  // Get latest prices
  getLatestPrices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stocks/latest`);
  }
}