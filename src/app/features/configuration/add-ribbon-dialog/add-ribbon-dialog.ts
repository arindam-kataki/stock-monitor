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
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

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
  ],
  templateUrl: './add-ribbon-dialog.html',
  styleUrls: ['./add-ribbon-dialog.scss'],
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate(
          '300ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '300ms ease-in',
          style({ opacity: 0, transform: 'translateY(-10px)' })
        ),
      ]),
    ]),
  ],
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
  viewMode: 'grid' | 'list' = 'list'; // Default to list view for better alert visibility

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddRibbonDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddRibbonDialogData
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

    // Initialize stock selections with existing alerts
    if (ribbon.selectedStocks && ribbon.selectedStocks.length > 0) {
      ribbon.selectedStocks.forEach((symbol) => {
        const alert = ribbon.stockAlerts?.find((a) => a.symbol === symbol);
        this.stockSelections[symbol] = {
          selected: true,
          highValue: alert?.highValue,
          lowValue: alert?.lowValue,
          highEnabled: alert?.highEnabled || false,
          lowEnabled: alert?.lowEnabled || false,
        };
      });
    }

    // Set the selected category
    this.selectedCategory =
      this.categories.find((c) => c.id === ribbon.categoryId) || null;
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

    // Reset stock selections only if creating new ribbon
    if (!this.isEditMode) {
      this.stockSelections = {};
      this.searchQuery = '';
      this.showOnlySelected = false;
    }

    // Initialize stock selections for the category
    if (this.selectedCategory && !this.isEditMode) {
      this.selectedCategory.stocks.forEach((stock) => {
        if (!this.stockSelections[stock.symbol]) {
          this.stockSelections[stock.symbol] = {
            selected: false,
            highEnabled: false,
            lowEnabled: false,
          };
        }
      });
    }

    this.updateSelectAllState();
  }

  toggleStock(symbol: string): void {
    if (!this.stockSelections[symbol]) {
      this.stockSelections[symbol] = {
        selected: true,
        highEnabled: false,
        lowEnabled: false,
      };
    } else {
      this.stockSelections[symbol].selected =
        !this.stockSelections[symbol].selected;

      // Clear alert values if deselecting
      if (!this.stockSelections[symbol].selected) {
        this.stockSelections[symbol].highValue = undefined;
        this.stockSelections[symbol].lowValue = undefined;
        this.stockSelections[symbol].highEnabled = false;
        this.stockSelections[symbol].lowEnabled = false;
      }
    }

    this.updateSelectAllState();
  }

  toggleView(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
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
      this.stockSelections[symbol] = {
        selected: false,
        highEnabled: false,
        lowEnabled: false,
      };
    });
    this.selectAllState = false;
  }

  save(): void {
    if (!this.isFormValid) return;

    const formValue = this.ribbonForm.value;

    // Build stock alerts array
    const stockAlerts: StockAlert[] = [];
    Object.entries(this.stockSelections).forEach(
      ([symbol, state]: [string, StockSelectionState]) => {
        if (state.selected && (state.highEnabled || state.lowEnabled)) {
          stockAlerts.push({
            symbol,
            highValue: state.highEnabled ? state.highValue : undefined,
            lowValue: state.lowEnabled ? state.lowValue : undefined,
            highEnabled: state.highEnabled,
            lowEnabled: state.lowEnabled,
          });
        }
      }
    );

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

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  // Quick selection methods
  selectTopN(n: number): void {
    const stocks = this.filteredStocks.slice(0, n);
    stocks.forEach((stock) => {
      if (!this.stockSelections[stock.symbol]) {
        this.stockSelections[stock.symbol] = {
          selected: true,
          highEnabled: false,
          lowEnabled: false,
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
          highEnabled: false,
          lowEnabled: false,
        };
      } else {
        this.stockSelections[stock.symbol].selected =
          !this.stockSelections[stock.symbol].selected;
      }
    });
    this.updateSelectAllState();
  }

  isStockSelected(symbol: string): boolean {
    return this.stockSelections[symbol]?.selected || false;
  }
}
