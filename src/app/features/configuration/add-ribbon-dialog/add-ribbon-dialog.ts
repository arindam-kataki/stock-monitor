// src/app/features/configuration/add-ribbon-dialog/add-ribbon-dialog.ts

import {
  Component,
  Inject,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AddRibbonDialogData,
  RibbonFormData,
  StockSelectionMap,
  StockSelectionState,
} from './add-ribbon-dialog.interface';
import {
  Category,
  Stock,
  Ribbon,
  StockAlert,
} from '../../../core/models/stock.models';

@Component({
  selector: 'app-add-ribbon-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  templateUrl: './add-ribbon-dialog.html',
  styleUrls: ['./add-ribbon-dialog.scss'],
})
export class AddRibbonDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('nameInput') nameInput!: ElementRef;

  // Form and data
  ribbonForm!: FormGroup;
  categories: Category[] = [];
  selectedCategory: Category | null = null;

  // Stock selections with alert values
  stockSelections: StockSelectionMap = {};

  // UI state
  searchQuery = '';
  showOnlySelected = false;
  selectAllState = false;
  isEditMode = false;
  validationErrors: { [symbol: string]: string } = {};

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddRibbonDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddRibbonDialogData,
    private snackBar: MatSnackBar
  ) {
    this.categories = data.categories || [];
    this.isEditMode = !!data.ribbon;
  }

  ngOnInit(): void {
    this.initializeForm();

    if (this.isEditMode && this.data.ribbon) {
      this.populateFormForEdit(this.data.ribbon);
    }
  }

  ngAfterViewInit(): void {
    // Auto-focus the name input
    setTimeout(() => {
      this.nameInput?.nativeElement?.focus();
    }, 100);
  }

  private initializeForm(): void {
    this.ribbonForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      categoryId: ['', Validators.required],
    });

    // Listen to category changes
    this.ribbonForm.get('categoryId')?.valueChanges.subscribe((categoryId) => {
      this.onCategoryChange(categoryId);
    });
  }

  private populateFormForEdit(ribbon: Ribbon): void {
    this.ribbonForm.patchValue({
      name: ribbon.name,
      categoryId: ribbon.categoryId,
    });

    // Initialize ALL stocks in the category first
    const category = this.categories.find((c) => c.id === ribbon.categoryId);
    if (category) {
      category.stocks.forEach((stock) => {
        const alert = ribbon.stockAlerts?.find(
          (a) => a.symbol === stock.symbol
        );
        const isSelected = ribbon.selectedStocks.includes(stock.symbol);

        this.stockSelections[stock.symbol] = {
          selected: isSelected,
          highValue: alert?.highValue,
          lowValue: alert?.lowValue,
        };
      });
    }

    // Set the selected category
    this.selectedCategory = category || null;
    this.updateSelectAllState();
  }

  // Computed properties
  get filteredStocks(): Stock[] {
    if (!this.selectedCategory) return [];

    let stocks = [...this.selectedCategory.stocks];

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      stocks = stocks.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(query) ||
          stock.name.toLowerCase().includes(query)
      );
    }

    // Filter to show only selected
    if (this.showOnlySelected) {
      stocks = stocks.filter(
        (stock) => this.stockSelections[stock.symbol]?.selected
      );
    }

    return stocks;
  }

  get selectedStockCount(): number {
    return Object.values(this.stockSelections).filter(
      (s: StockSelectionState) => s.selected
    ).length;
  }

  get totalStockCount(): number {
    return this.selectedCategory?.stocks.length || 0;
  }

  get selectionProgress(): number {
    if (this.totalStockCount === 0) return 0;
    return (this.selectedStockCount / this.totalStockCount) * 100;
  }

  get isFormValid(): boolean {
    return this.ribbonForm.valid && this.selectedStockCount > 0;
  }

  // Event handlers
  onCategoryChange(categoryId: string): void {
    this.selectedCategory =
      this.categories.find((c) => c.id === categoryId) || null;

    // Initialize all stocks with empty alert values
    if (this.selectedCategory) {
      // Only reset if not in edit mode or if it's a different category
      if (
        !this.isEditMode ||
        (this.data.ribbon && this.data.ribbon.categoryId !== categoryId)
      ) {
        this.stockSelections = {};
        this.searchQuery = '';
        this.showOnlySelected = false;

        // Initialize all stocks in the category
        this.selectedCategory.stocks.forEach((stock) => {
          this.stockSelections[stock.symbol] = {
            selected: false,
            highValue: undefined,
            lowValue: undefined,
          };
        });
      }
    }

    this.updateSelectAllState();
  }

  toggleStock(symbol: string): void {
    if (!this.stockSelections[symbol]) {
      this.stockSelections[symbol] = {
        selected: true,
        highValue: undefined,
        lowValue: undefined,
      };
    } else {
      this.stockSelections[symbol].selected =
        !this.stockSelections[symbol].selected;
      // Keep the high/low values even when unchecking
    }

    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    const newState = !this.selectAllState;
    this.filteredStocks.forEach((stock) => {
      if (!this.stockSelections[stock.symbol]) {
        this.stockSelections[stock.symbol] = {
          selected: newState,
          highValue: undefined,
          lowValue: undefined,
        };
      } else {
        this.stockSelections[stock.symbol].selected = newState;
      }
    });
    this.selectAllState = newState;
  }

  private updateSelectAllState(): void {
    const filtered = this.filteredStocks;
    if (filtered.length === 0) {
      this.selectAllState = false;
    } else {
      this.selectAllState = filtered.every(
        (stock) => this.stockSelections[stock.symbol]?.selected
      );
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  deselectAll(): void {
    Object.keys(this.stockSelections).forEach((symbol) => {
      this.stockSelections[symbol].selected = false;
      // Keep the high/low values
    });
    this.selectAllState = false;
  }

  save(): void {
    if (!this.isFormValid) return;

    const formValue = this.ribbonForm.value;

    // Clear all validation errors
    this.validationErrors = {};

    // Validate all high/low values before saving
    let hasValidationError = false;
    Object.entries(this.stockSelections).forEach(
      ([symbol, state]: [string, StockSelectionState]) => {
        if (state.highValue !== undefined && state.lowValue !== undefined) {
          if (state.highValue < state.lowValue) {
            this.validationErrors[
              symbol
            ] = `High (${state.highValue}) must be ≥ low (${state.lowValue})`;
            hasValidationError = true;
          }
        }
      }
    );

    if (hasValidationError) {
      // Scroll to first error
      setTimeout(() => {
        const firstError = document.querySelector('.stock-validation-error');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    // Build stock alerts array - include ALL stocks with high/low values
    const stockAlerts: StockAlert[] = [];
    Object.entries(this.stockSelections).forEach(
      ([symbol, state]: [string, StockSelectionState]) => {
        // Save alerts even for unselected stocks if they have values
        if (state.highValue !== undefined || state.lowValue !== undefined) {
          stockAlerts.push({
            symbol,
            highValue: state.highValue,
            lowValue: state.lowValue,
          });
        }
      }
    );

    // Get only selected stocks for the watch list
    const selectedStocks = Object.entries(this.stockSelections)
      .filter(([_, state]: [string, StockSelectionState]) => state.selected)
      .map(([symbol, _]) => symbol);

    const result: RibbonFormData = {
      name: formValue.name.trim(),
      categoryId: formValue.categoryId,
      categoryName: this.selectedCategory?.name || '',
      icon: this.selectedCategory?.icon || '📊',
      color: this.selectedCategory?.color || '#667eea',
      selectedStocks: selectedStocks,
      stockAlerts: stockAlerts.length > 0 ? stockAlerts : undefined,
    };

    console.log('Saving ribbon with alerts:', result);
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  // Format alert value for display
  formatAlertValue(value: number | undefined): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toFixed(2);
  }

  // Handle alert value change
  onAlertValueChange(symbol: string, type: 'high' | 'low', event: Event): void {
    const target = event.target as HTMLElement;
    const text = target.textContent?.trim() || '';

    // Remove $ sign if present
    const cleanText = text.replace(/^\$/, '');

    // Parse the value
    const value = cleanText ? parseFloat(cleanText) : undefined;

    // Initialize stock selection if it doesn't exist
    if (!this.stockSelections[symbol]) {
      this.stockSelections[symbol] = {
        selected: false,
        highValue: undefined,
        lowValue: undefined,
      };
    }

    // Store the value temporarily
    const tempValue = isNaN(value!) ? undefined : value;

    // Clear any existing validation error for this stock
    delete this.validationErrors[symbol];

    // Validate high >= low
    if (type === 'high') {
      const lowValue = this.stockSelections[symbol].lowValue;
      if (
        tempValue !== undefined &&
        lowValue !== undefined &&
        tempValue < lowValue
      ) {
        // Show inline error for this specific stock
        this.validationErrors[
          symbol
        ] = `High value (${tempValue}) must be ≥ low value (${lowValue})`;
        target.textContent = this.formatAlertValue(
          this.stockSelections[symbol].highValue
        );
        return;
      }
      this.stockSelections[symbol].highValue = tempValue;
    } else {
      const highValue = this.stockSelections[symbol].highValue;
      if (
        tempValue !== undefined &&
        highValue !== undefined &&
        tempValue > highValue
      ) {
        // Show inline error for this specific stock
        this.validationErrors[
          symbol
        ] = `Low value (${tempValue}) must be ≤ high value (${highValue})`;
        target.textContent = this.formatAlertValue(
          this.stockSelections[symbol].lowValue
        );
        return;
      }
      this.stockSelections[symbol].lowValue = tempValue;
    }

    // Update the display with formatted value
    target.textContent = this.formatAlertValue(
      this.stockSelections[symbol][type === 'high' ? 'highValue' : 'lowValue']
    );
  }

  // Show snackbar message
  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ): void {
    const snackBarRef = this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass:
        type === 'error'
          ? ['snackbar-error']
          : type === 'warning'
          ? ['snackbar-warning']
          : ['snackbar-success'],
    });
  }

  // Handle keydown events in alert value fields
  onAlertValueKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    // Allow Enter to confirm the value
    if (event.key === 'Enter') {
      event.preventDefault();
      target.blur();
      return;
    }

    // Allow Escape to cancel editing
    if (event.key === 'Escape') {
      event.preventDefault();
      // Restore original value
      const stockElement = target.closest('.stock-item-compact');
      const symbol = stockElement?.getAttribute('data-symbol');
      if (symbol) {
        // Clear any validation error for this stock
        delete this.validationErrors[symbol];

        const type = target
          .closest('.alert-value-wrapper')
          ?.querySelector('.high')
          ? 'high'
          : 'low';
        const originalValue =
          this.stockSelections[symbol]?.[
            type === 'high' ? 'highValue' : 'lowValue'
          ];
        target.textContent = this.formatAlertValue(originalValue);
      }
      target.blur();
      return;
    }

    // Allow backspace, delete, arrows, home, end
    const allowedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'Tab',
    ];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    // Allow numbers, decimal point, but prevent multiple decimals
    const currentText = target.textContent || '';
    if (event.key === '.' && currentText.includes('.')) {
      event.preventDefault();
      return;
    }

    // Only allow numbers and decimal point
    if (!/^[0-9.]$/.test(event.key)) {
      event.preventDefault();
    }
  }
  selectTopN(n: number): void {
    const stocks = this.filteredStocks.slice(0, n);
    stocks.forEach((stock) => {
      if (!this.stockSelections[stock.symbol]) {
        this.stockSelections[stock.symbol] = {
          selected: true,
          highValue: undefined,
          lowValue: undefined,
        };
      } else {
        this.stockSelections[stock.symbol].selected = true;
      }
    });
    this.updateSelectAllState();
  }

  selectByPattern(pattern: 'inverse'): void {
    this.filteredStocks.forEach((stock) => {
      if (!this.stockSelections[stock.symbol]) {
        this.stockSelections[stock.symbol] = {
          selected: true,
          highValue: undefined,
          lowValue: undefined,
        };
      } else {
        this.stockSelections[stock.symbol].selected =
          !this.stockSelections[stock.symbol].selected;
      }
    });
    this.updateSelectAllState();
  }
}
