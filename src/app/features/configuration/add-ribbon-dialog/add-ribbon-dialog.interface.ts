import { Category, Ribbon } from '../../../core/models/stock.models';

/**
 * Data passed to the Add Ribbon Dialog
 */
export interface AddRibbonDialogData {
  categories: Category[];
  ribbon?: Ribbon; // If provided, dialog operates in edit mode
}

/**
 * Form data returned from the dialog
 */
export interface RibbonFormData {
  name: string;
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  selectedStocks: string[];
}

/**
 * Stock selection state
 */
export interface StockSelection {
  [symbol: string]: boolean;
}

/**
 * Dialog result type
 */
export type AddRibbonDialogResult = RibbonFormData | undefined;

/**
 * Stock filter options
 */
export interface StockFilterOptions {
  searchQuery: string;
  showOnlySelected: boolean;
  sortBy?: 'symbol' | 'name' | 'marketCap';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Quick selection preset
 */
export interface QuickSelectionPreset {
  label: string;
  icon: string;
  action: () => void;
  color?: string;
}
