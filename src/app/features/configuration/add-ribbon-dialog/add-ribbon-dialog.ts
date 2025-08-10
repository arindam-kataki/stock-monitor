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
  AddRibbonDialogData,
  RibbonFormData,
  StockSelection,
} from './add-ribbon-dialog.interface';
import { Category, Stock, Ribbon } from '../../../core/models/stock.models';

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
})
export class AddRibbonDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('nameInput') nameInput!: ElementRef;

  // Form and data
  ribbonForm!: FormGroup;
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  stockSelections: StockSelection = {};

  // UI state
  isEditMode = false;
  searchQuery = '';
  showOnlySelected = false;
  selectAllState = false;

  // Computed properties
  get selectedStockCount(): number {
    return Object.values(this.stockSelections).filter((v) => v).length;
  }

  get totalStockCount(): number {
    return this.selectedCategory?.stocks.length || 0;
  }

  get selectionProgress(): number {
    if (this.totalStockCount === 0) return 0;
    return (this.selectedStockCount / this.totalStockCount) * 100;
  }

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

    // Filter by selection state
    if (this.showOnlySelected) {
      stocks = stocks.filter((stock) => this.stockSelections[stock.symbol]);
    }

    return stocks;
  }

  get isFormValid(): boolean {
    return this.ribbonForm.valid && this.selectedStockCount > 0;
  }

  constructor(
    public dialogRef: MatDialogRef<AddRibbonDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddRibbonDialogData,
    private fb: FormBuilder
  ) {
    this.categories = data.categories || [];
    this.isEditMode = !!data.ribbon;
    this.initializeForm();
  }

  ngOnInit(): void {
    if (this.data.ribbon) {
      this.loadRibbonData(this.data.ribbon);
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
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ],
      ],
      categoryId: ['', Validators.required],
    });

    // Listen to category changes
    this.ribbonForm.get('categoryId')?.valueChanges.subscribe((categoryId) => {
      this.onCategoryChange(categoryId);
    });
  }

  private loadRibbonData(ribbon: Ribbon): void {
    // Set form values
    this.ribbonForm.patchValue({
      name: ribbon.name,
      categoryId: ribbon.categoryId,
    });

    // Set selected stocks
    ribbon.selectedStocks.forEach((symbol) => {
      this.stockSelections[symbol] = true;
    });

    // Load the category
    this.selectedCategory =
      this.categories.find((c) => c.id === ribbon.categoryId) || null;
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategory =
      this.categories.find((c) => c.id === categoryId) || null;

    // Reset stock selections only if creating new ribbon
    if (!this.isEditMode) {
      this.stockSelections = {};
      this.searchQuery = '';
      this.showOnlySelected = false;
    }

    this.updateSelectAllState();
  }

  toggleStock(symbol: string): void {
    this.stockSelections[symbol] = !this.stockSelections[symbol];
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    const newState = !this.selectAllState;
    this.filteredStocks.forEach((stock) => {
      this.stockSelections[stock.symbol] = newState;
    });
    this.selectAllState = newState;
  }

  private updateSelectAllState(): void {
    const filtered = this.filteredStocks;
    if (filtered.length === 0) {
      this.selectAllState = false;
    } else {
      this.selectAllState = filtered.every(
        (stock) => this.stockSelections[stock.symbol]
      );
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  deselectAll(): void {
    this.stockSelections = {};
    this.selectAllState = false;
  }

  save(): void {
    if (!this.isFormValid) return;

    const formValue = this.ribbonForm.value;
    const selectedStocks = Object.keys(this.stockSelections).filter(
      (symbol) => this.stockSelections[symbol]
    );

    const result: RibbonFormData = {
      name: formValue.name.trim(),
      categoryId: formValue.categoryId,
      categoryName: this.selectedCategory?.name || '',
      icon: this.selectedCategory?.icon || '📊',
      color: this.selectedCategory?.color || '#667eea',
      selectedStocks: selectedStocks,
    };

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  // Quick selection presets
  selectTopN(n: number): void {
    const stocks = this.filteredStocks.slice(0, n);
    stocks.forEach((stock) => {
      this.stockSelections[stock.symbol] = true;
    });
    this.updateSelectAllState();
  }

  selectByPattern(pattern: 'all' | 'none' | 'inverse'): void {
    this.filteredStocks.forEach((stock) => {
      switch (pattern) {
        case 'all':
          this.stockSelections[stock.symbol] = true;
          break;
        case 'none':
          this.stockSelections[stock.symbol] = false;
          break;
        case 'inverse':
          this.stockSelections[stock.symbol] =
            !this.stockSelections[stock.symbol];
          break;
      }
    });
    this.updateSelectAllState();
  }
}
