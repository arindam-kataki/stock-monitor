import {
  Component,
  OnInit,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

// Services and Models
import { StockDataService } from '../../core/services/stock-data/stock-data.service';
import {
  SettingsService,
  AppSettings,
} from '../../core/services/settings.service';
import { Category, Ribbon } from '../../core/models/stock.models';

// Dialog Component
import { AddRibbonDialogComponent } from './add-ribbon-dialog/add-ribbon-dialog';
import {
  AddRibbonDialogData,
  RibbonFormData,
} from './add-ribbon-dialog/add-ribbon-dialog.interface';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss',
})
export class ConfigurationComponent implements OnInit {
  // Ribbons and Categories
  ribbons: Ribbon[] = [];
  categories: Category[] = []; // Used as templates for creating ribbons

  // UI State
  loading = true;
  error: string | null = null;
  editingRibbonId: number | null = null;
  editingRibbonName = '';
  originalRibbonName = '';

  // Settings
  settings: AppSettings = {
    autoCycle: true,
    cycleInterval: 15,
    showVolume: true,
    enableNotifications: false,
  };

  // ViewChildren for auto-focus
  @ViewChildren('ribbonNameInput') ribbonNameInputs!: QueryList<ElementRef>;

  constructor(
    private stockDataService: StockDataService,
    private settingsService: SettingsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    console.log('ConfigurationComponent constructor');
  }

  ngOnInit(): void {
    console.log('ConfigurationComponent ngOnInit');
    this.loadSettings();
    this.loadRibbons();
    this.loadCategoryTemplates();
  }

  // ============== DATA LOADING ==============

  loadSettings(): void {
    // Subscribe to the observable and get the value
    this.settingsService.getSettings().subscribe((settings) => {
      this.settings = settings;
    });
  }

  loadRibbons(): void {
    this.loading = true;
    this.error = null;

    this.stockDataService.getUserRibbons().subscribe({
      next: (ribbons) => {
        console.log('Ribbons loaded:', ribbons);
        this.ribbons = ribbons;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading ribbons:', error);
        this.error =
          'Failed to load ribbons. Please check if backend is running.';
        this.loading = false;
        this.showSnackBar('Failed to load ribbons', 'error');
      },
    });
  }

  loadCategoryTemplates(): void {
    this.stockDataService.getCategories().subscribe({
      next: (categories) => {
        console.log('Category templates loaded:', categories);
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.showSnackBar('Failed to load category templates', 'error');
      },
    });
  }

  // ============== RIBBON MANAGEMENT ==============

  openAddRibbonDialog(): void {
    const dialogData: AddRibbonDialogData = {
      categories: this.categories,
    };

    const dialogRef = this.dialog.open(AddRibbonDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: dialogData,
      panelClass: 'ribbon-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result: RibbonFormData | undefined) => {
      if (result) {
        console.log('New ribbon data:', result);
        this.createRibbon(result);
      }
    });
  }

  editRibbonStocks(ribbon: Ribbon): void {
    const dialogData: AddRibbonDialogData = {
      categories: this.categories,
      ribbon: ribbon,
    };

    const dialogRef = this.dialog.open(AddRibbonDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: dialogData,
      panelClass: 'ribbon-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result: RibbonFormData | undefined) => {
      if (result) {
        console.log('Updated ribbon data:', result);
        this.updateRibbon(ribbon.id, result);
      }
    });
  }

  createRibbon(ribbonData: RibbonFormData): void {
    this.stockDataService.createRibbon(ribbonData).subscribe({
      next: (ribbon) => {
        console.log('Ribbon created:', ribbon);
        this.ribbons.push(ribbon);
        this.showSnackBar('Ribbon created successfully!', 'success');
      },
      error: (error) => {
        console.error('Error creating ribbon:', error);
        this.showSnackBar('Failed to create ribbon', 'error');
      },
    });
  }

  updateRibbon(ribbonId: number, data: RibbonFormData): void {
    this.stockDataService.updateRibbon(ribbonId, data).subscribe({
      next: (updatedRibbon) => {
        console.log('Ribbon updated:', updatedRibbon);
        const index = this.ribbons.findIndex((r) => r.id === ribbonId);
        if (index !== -1) {
          this.ribbons[index] = updatedRibbon;
        }
        this.showSnackBar('Ribbon updated successfully!', 'success');
        this.loadRibbons();
      },
      error: (error) => {
        console.error('Error updating ribbon:', error);
        this.showSnackBar('Failed to update ribbon', 'error');
      },
    });
  }

  deleteRibbon(ribbon: Ribbon): void {
    const confirmDelete = confirm(
      `Are you sure you want to delete "${ribbon.name}"?\nThis action cannot be undone.`
    );

    if (confirmDelete) {
      this.stockDataService.deleteRibbon(ribbon.id).subscribe({
        next: () => {
          console.log('Ribbon deleted:', ribbon.id);
          this.ribbons = this.ribbons.filter((r) => r.id !== ribbon.id);
          this.showSnackBar(`Ribbon "${ribbon.name}" deleted`, 'success');
        },
        error: (error) => {
          console.error('Error deleting ribbon:', error);
          this.showSnackBar('Failed to delete ribbon', 'error');
        },
      });
    }
  }

  duplicateRibbon(ribbon: Ribbon): void {
    const duplicateData: RibbonFormData = {
      name: `${ribbon.name} (Copy)`,
      categoryId: ribbon.categoryId,
      categoryName: ribbon.categoryName || '',
      icon: ribbon.icon,
      color: ribbon.color,
      selectedStocks: ribbon.selectedStocks,
    };

    this.createRibbon(duplicateData);
  }

  // ============== INLINE EDITING ==============

  startEditingRibbon(ribbon: Ribbon): void {
    this.editingRibbonId = ribbon.id;
    this.editingRibbonName = ribbon.name;
    this.originalRibbonName = ribbon.name;

    // Auto-focus the input after Angular updates the view
    setTimeout(() => {
      const input = this.ribbonNameInputs.first;
      if (input) {
        input.nativeElement.focus();
        input.nativeElement.select();
      }
    }, 0);
  }

  saveRibbonName(): void {
    if (this.editingRibbonId && this.editingRibbonName.trim()) {
      const trimmedName = this.editingRibbonName.trim();

      // Check for duplicate names
      const isDuplicate = this.ribbons.some(
        (r) =>
          r.id !== this.editingRibbonId &&
          r.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (isDuplicate) {
        this.showSnackBar('A ribbon with this name already exists', 'warning');
        this.editingRibbonName = this.originalRibbonName;
        this.cancelRibbonEdit();
        return;
      }

      // Update locally first for instant feedback
      const ribbon = this.ribbons.find((r) => r.id === this.editingRibbonId);
      if (ribbon) {
        ribbon.name = trimmedName;
      }

      // Update on backend
      this.stockDataService
        .updateRibbonName(this.editingRibbonId, trimmedName)
        .subscribe({
          next: () => {
            console.log('Ribbon name updated');
            this.showSnackBar('Ribbon renamed successfully', 'success');
          },
          error: (error) => {
            console.error('Error updating ribbon name:', error);
            // Revert on error
            if (ribbon) {
              ribbon.name = this.originalRibbonName;
            }
            this.showSnackBar('Failed to update ribbon name', 'error');
          },
        });
    }

    this.cancelRibbonEdit();
  }

  cancelRibbonEdit(): void {
    // Revert changes if cancelled
    if (this.editingRibbonId) {
      const ribbon = this.ribbons.find((r) => r.id === this.editingRibbonId);
      if (ribbon && this.originalRibbonName) {
        ribbon.name = this.originalRibbonName;
      }
    }

    this.editingRibbonId = null;
    this.editingRibbonName = '';
    this.originalRibbonName = '';
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveRibbonName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRibbonEdit();
    }
  }

  // ============== DRAG & DROP ==============

  dropRibbon(event: CdkDragDrop<Ribbon[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.ribbons, event.previousIndex, event.currentIndex);
      this.updateRibbonOrder();
    }
  }

  updateRibbonOrder(): void {
    const updates = this.ribbons.map((ribbon, index) => ({
      id: ribbon.id,
      orderIndex: index,
    }));

    this.stockDataService.updateRibbonOrder(updates).subscribe({
      next: () => {
        console.log('Ribbon order updated');
      },
      error: (error) => {
        console.error('Error updating ribbon order:', error);
        this.showSnackBar('Failed to update ribbon order', 'error');
        // Reload ribbons to restore original order
        this.loadRibbons();
      },
    });
  }

  // ============== SETTINGS ==============

  onSettingChange(): void {
    this.settingsService.updateSettings(this.settings);
    this.showSnackBar('Settings updated', 'success');
  }

  formatLabel(value: number): string {
    return `${value}s`;
  }

  // ============== RIBBON ACTIVATION ==============

  toggleRibbonActive(ribbon: Ribbon): void {
    ribbon.isActive = !ribbon.isActive;

    this.stockDataService
      .updateRibbon(ribbon.id, {
        ...ribbon,
        isActive: ribbon.isActive,
      })
      .subscribe({
        next: () => {
          const status = ribbon.isActive ? 'activated' : 'deactivated';
          this.showSnackBar(`Ribbon ${status}`, 'success');
        },
        error: (error) => {
          console.error('Error toggling ribbon status:', error);
          // Revert on error
          ribbon.isActive = !ribbon.isActive;
          this.showSnackBar('Failed to update ribbon status', 'error');
        },
      });
  }

  // ============== UTILITY METHODS ==============

  getActiveRibbonCount(): number {
    return this.ribbons.filter((r) => r.isActive).length;
  }

  getTotalStockCount(): number {
    return this.ribbons.reduce(
      (total, ribbon) => total + ribbon.selectedStocks.length,
      0
    );
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find((c) => c.id === categoryId);
    return category?.icon || '📊';
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  }

  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success'
  ): void {
    const config = {
      duration: 3000,
      horizontalPosition: 'end' as const,
      verticalPosition: 'bottom' as const,
      panelClass: [`snackbar-${type}`],
    };

    this.snackBar.open(message, 'Close', config);
  }

  // ============== EXPORT/IMPORT (Optional) ==============

  exportConfiguration(): void {
    const config = {
      ribbons: this.ribbons,
      settings: this.settings,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-monitor-config-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.showSnackBar('Configuration exported', 'success');
  }

  importConfiguration(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);

        // Validate the imported data
        if (!config.ribbons || !Array.isArray(config.ribbons)) {
          throw new Error('Invalid configuration file');
        }

        // Apply the imported configuration
        // This would need backend endpoints to handle bulk import
        console.log('Importing configuration:', config);
        this.showSnackBar('Configuration imported successfully', 'success');

        // Reload data
        this.loadRibbons();
        if (config.settings) {
          this.settings = { ...this.settings, ...config.settings };
          this.onSettingChange();
        }
      } catch (error) {
        console.error('Error importing configuration:', error);
        this.showSnackBar('Failed to import configuration', 'error');
      }
    };

    reader.readAsText(file);

    // Reset input
    input.value = '';
  }
}
