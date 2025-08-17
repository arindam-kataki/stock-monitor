// src/app/shared/components/stock-chart/stock-chart.ts

import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import {
  ChartData,
  CombinedChartData,
  TimeRange,
} from '../../../core/models/stock.models';
import { Stock } from '../../../core/models/stock.models';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-stock-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-chart.html',
  styleUrls: ['./stock-chart.scss'],
})
export class StockChartComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() symbol: string = '';
  @Input() data?: ChartData | CombinedChartData;
  @Input() timeRange: TimeRange = '1D';
  @Input() showVolume: boolean = true;
  @Input() height: number = 300;
  @Input() minimal: boolean = false;
  @Input() stocks?: any[]; // For future combined view

  private chart?: Chart;

  private colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#95E77E',
    '#FFD93D',
    '#6C5CE7',
    '#A8E6CF',
    '#FD79A8',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#74B9FF',
    '#A29BFE',
  ];

  // Check if this is a combined chart
  private isCombinedChart(): boolean {
    return !!(
      this.symbol === 'combined' &&
      this.stocks &&
      this.stocks.length > 0
    );
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.chartCanvas &&
      (changes['data'] || changes['timeRange'] || changes['showVolume'])
    ) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private createChart(): void {
    console.log('createChart called', {
      hasCanvas: !!this.chartCanvas,
      hasData: !!this.data,
      dataLength: this.data?.data?.length,
      isCombined: this.isCombinedChart(),
    });

    if (!this.chartCanvas || !this.data) {
      console.warn('Missing canvas or data');
      return;
    }

    // Different validation for combined vs single charts
    if (this.isCombinedChart()) {
      const combinedData = this.data as CombinedChartData;
      console.log('Combined chart data:', {
        hasChartLabels: !!combinedData.chartLabels,
        hasChartDatasets: !!combinedData.chartDatasets,
        labelsLength: combinedData.chartLabels?.length,
        datasetsLength: combinedData.chartDatasets?.length,
      });

      // Combined charts don't use data.data, they use chartLabels and chartDatasets
      if (
        !combinedData.chartLabels ||
        !combinedData.chartDatasets ||
        combinedData.chartDatasets.length === 0
      ) {
        console.warn('Combined chart missing labels or datasets');
        return;
      }
      // Continue to create the chart - don't return here!
    } else {
      // Single chart validation - only check data.data for non-combined charts
      if (!this.data.data || this.data.data.length === 0) {
        console.warn('Single chart missing data');
        return;
      }
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }

    const chartData = this.prepareChartData();
    console.log('Prepared chart data:', chartData);

    const chartOptions = this.getChartOptions();
    console.log('Chart options:', chartOptions);

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    try {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: chartOptions,
      });
      console.log('Chart created successfully');
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }

  private updateChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }
    this.createChart();
  }

  private prepareChartData(): any {
    if (this.isCombinedChart()) {
      return this.prepareCombinedChartData();
    }

    if (!this.data || !this.data.data) {
      return { labels: [], datasets: [] };
    }

    const labels = this.data.data.map((point) => {
      const date = new Date(point.date || point.timestamp || '');
      return this.formatDateLabel(date);
    });

    const priceData = this.data.data.map((point) => point.close);
    const volumeData = this.data.data.map((point) => point.volume);

    const datasets: any[] = [
      {
        label: `${this.symbol} Price`,
        data: priceData,
        borderColor: this.getPriceColor(),
        backgroundColor: this.getPriceColor(0.1),
        borderWidth: this.minimal ? 1 : 2,
        tension: 0.1,
        fill: !this.minimal,
        pointRadius: this.minimal ? 0 : 2,
        pointHoverRadius: this.minimal ? 2 : 4,
        yAxisID: 'y',
      },
    ];

    if (this.showVolume && !this.minimal) {
      datasets.push({
        label: 'Volume',
        data: volumeData,
        type: 'bar',
        backgroundColor: 'rgba(128, 128, 128, 0.3)',
        borderColor: 'rgba(128, 128, 128, 0.5)',
        borderWidth: 1,
        yAxisID: 'y1',
      });
    }

    return { labels, datasets };
  }

  private prepareCombinedChartData(): any {
    // Check if we have the CombinedChartData structure with chartLabels and chartDatasets
    const combinedData = this.data as CombinedChartData;

    // First, check if we have the pre-processed combined data from dashboard
    if (
      combinedData &&
      combinedData.chartLabels &&
      combinedData.chartDatasets
    ) {
      // Directly use the pre-prepared data from getCombinedChartData()
      return {
        labels: combinedData.chartLabels,
        datasets: combinedData.chartDatasets,
      };
    }

    // Fallback: If we don't have pre-processed data, create it here
    // This handles the case where stocks are passed but data isn't pre-processed
    if (
      this.stocks &&
      this.stocks.length > 0 &&
      this.data &&
      this.data.data &&
      this.data.data.length > 0
    ) {
      const datasets: any[] = [];
      let labels: string[] = [];

      // Create labels from the data points
      labels = this.data.data.map((point) => {
        const date = new Date(point.date || point.timestamp || '');
        return this.formatDateLabel(date);
      });

      // Create a normalized dataset for each stock
      // Since all stocks share the same data array, we need to calculate normalized values
      this.stocks.forEach((stock, index) => {
        // For demonstration, we'll use the same data for all stocks
        // In a real scenario, you'd need to separate the data per stock
        const priceData = this.data!.data.map((point) => point.close);

        // Normalize prices to percentage change from start
        if (priceData.length > 0) {
          const basePrice = priceData[0];
          const normalizedPrices = priceData.map(
            (price) => ((price - basePrice) / basePrice) * 100
          );

          datasets.push({
            label: stock.symbol || `Stock ${index + 1}`,
            data: normalizedPrices,
            borderColor: this.getStockColor(index),
            backgroundColor: this.getStockColor(index, 0.1),
            borderWidth: 2,
            tension: 0.1,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBorderWidth: 0,
            pointHoverBorderWidth: 2,
            pointHoverBorderColor: this.getStockColor(index),
          });
        }
      });

      return { labels, datasets };
    }

    // If no valid data structure is found, return empty chart data
    console.warn('No valid data structure found for combined chart');
    return { labels: [], datasets: [] };
  }

  // Helper method to get consistent colors for stocks
  private getStockColor(index: number, alpha: number = 1): string {
    // Use the existing colors array or define inline
    const colors = [
      `rgba(102, 126, 234, ${alpha})`, // Purple
      `rgba(240, 147, 251, ${alpha})`, // Pink
      `rgba(79, 172, 254, ${alpha})`, // Blue
      `rgba(0, 242, 254, ${alpha})`, // Cyan
      `rgba(67, 233, 123, ${alpha})`, // Green
      `rgba(250, 112, 154, ${alpha})`, // Rose
      `rgba(254, 225, 64, ${alpha})`, // Yellow
      `rgba(48, 207, 208, ${alpha})`, // Teal
      `rgba(168, 237, 234, ${alpha})`, // Light Teal
      `rgba(254, 214, 227, ${alpha})`, // Light Pink
      `rgba(255, 154, 158, ${alpha})`, // Coral
      `rgba(254, 207, 239, ${alpha})`, // Light Purple
    ];

    return colors[index % colors.length];
  }

  // Add the formatDateLabel method if it doesn't exist
  private _formatDateLabel(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {};

    switch (this.timeRange) {
      case '1D':
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case '5D':
        options.weekday = 'short';
        options.hour = '2-digit';
        break;
      case '1M':
        options.month = 'short';
        options.day = 'numeric';
        break;
      case '3M':
      case '6M':
        options.month = 'short';
        options.day = 'numeric';
        break;
      case '1Y':
        options.month = 'short';
        options.year = '2-digit';
        break;
      case '5Y':
        options.year = 'numeric';
        options.month = 'short';
        break;
      default:
        options.month = 'short';
        options.day = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  }

  private getCombinedChartOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y;
              const change = value - 100;
              const changeStr =
                change >= 0
                  ? `+${change.toFixed(2)}%`
                  : `${change.toFixed(2)}%`;
              return `${context.dataset.label}: ${value.toFixed(
                2
              )} (${changeStr})`;
            },
          },
        },
        annotation: {
          annotations: {
            baseline: {
              type: 'line',
              yMin: 100,
              yMax: 100,
              borderColor: '#667eea',
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                content: 'Baseline (100)',
                enabled: true,
                position: 'end',
              },
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false,
          },
        },
        y: {
          display: true,
          position: 'left',
          grid: {
            color: '#f0f0f0',
          },
          ticks: {
            callback: function (value: any) {
              return value.toFixed(0);
            },
          },
          title: {
            display: true,
            text: 'Normalized Value',
          },
        },
      },
    };
  }

  private getChartOptions(): any {
    if (this.isCombinedChart()) {
      return this.getCombinedChartOptions();
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: !this.minimal,
        },
        tooltip: {
          enabled: !this.minimal,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;

              if (label.includes('Price')) {
                return `${label}: $${value.toFixed(2)}`;
              } else if (label === 'Volume') {
                return `${label}: ${this.formatVolume(value)}`;
              }
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: this.minimal ? this.getMinimalScales() : this.getFullScales(),
    };
  }

  private getFullScales(): any {
    const scales: any = {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: this.getMaxTicks(),
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Price ($)',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    };

    if (this.showVolume) {
      scales.y1 = {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Volume',
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value: any) => this.formatVolume(value),
        },
      };
    }

    return scales;
  }

  private getMinimalScales(): any {
    return {
      x: { display: false },
      y: { display: false },
    };
  }

  private formatDateLabel(date: Date): string {
    switch (this.timeRange) {
      case '1D':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      case '5D':
      case '1M':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      default:
        return date.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
    }
  }

  private getMaxTicks(): number {
    switch (this.timeRange) {
      case '1D':
        return 8;
      case '5D':
        return 5;
      case '1M':
        return 6;
      case '3M':
        return 6;
      case '6M':
        return 6;
      case '1Y':
        return 12;
      default:
        return 10;
    }
  }

  private getPriceColor(alpha: number = 1): string {
    if (!this.data || this.data.data.length < 2) {
      return `rgba(102, 126, 234, ${alpha})`;
    }

    const firstPrice = this.data.data[0].close;
    const lastPrice = this.data.data[this.data.data.length - 1].close;

    if (lastPrice > firstPrice) {
      return `rgba(34, 197, 94, ${alpha})`; // Green for gain
    } else if (lastPrice < firstPrice) {
      return `rgba(239, 68, 68, ${alpha})`; // Red for loss
    } else {
      return `rgba(102, 126, 234, ${alpha})`; // Blue for neutral
    }
  }

  private formatVolume(value: number): string {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toString();
  }
}
