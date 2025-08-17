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
import { ChartData, TimeRange } from '../../../core/models/stock.models';
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
  @Input() data?: ChartData;
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
    if (
      !this.chartCanvas ||
      !this.data ||
      !this.data.data ||
      this.data.data.length === 0
    ) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const chartData = this.prepareChartData();
    const chartOptions = this.getChartOptions();

    this.chart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });
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
    const datasets: any[] = [];
    let labels: string[] = [];

    // Get labels from first stock's data
    if (this.stocks.length > 0 && this.data) {
      const firstStockData = this.data.data;
      labels = firstStockData.map((point) => {
        const date = new Date(point.date || point.timestamp || '');
        return this.formatDateLabel(date);
      });
    }

    // Create normalized dataset for each stock
    this.stocks.forEach((stock, index) => {
      // Extract this stock's data from the combined data
      const stockData =
        this.data?.data.filter((point) =>
          point.date?.startsWith(`${stock.symbol}_`)
        ) || [];

      if (stockData.length === 0) return;

      // Normalize data to start at 100
      const firstValue = stockData[0].close;
      const normalizedData = stockData.map((point) => ({
        x: point.date?.replace(`${stock.symbol}_`, ''),
        y: (point.close / firstValue) * 100,
      }));

      datasets.push({
        label: stock.symbol,
        data: normalizedData.map((d) => d.y),
        borderColor: this.colors[index % this.colors.length],
        backgroundColor: this.colors[index % this.colors.length] + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.1,
        fill: false,
      });
    });

    return { labels, datasets };
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
