import {
  Component,
  Input,
  OnInit,
  ViewChild,
  ElementRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

@Component({
  selector: 'app-stock-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [
    `
      .chart-container {
        position: relative;
        height: 200px;
        width: 100%;
      }
    `,
  ],
})
export class StockChartComponent implements OnInit, OnChanges {
  @ViewChild('chartCanvas', { static: true })
  chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() symbol: string = '';
  @Input() timeRange: string = '5D';
  @Input() chartType: 'line' | 'candlestick' | 'bar' = 'line';

  private chart: Chart | null = null;

  ngOnInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['timeRange'] && !changes['timeRange'].firstChange) {
      this.updateChart();
    }
  }

  private generateMockDataWithVolume(): {
    labels: string[];
    prices: number[];
    volumes: number[];
  } {
    const data = this.generateMockData();
    const volumes = data.prices.map(() => Math.floor(Math.random() * 10000000));
    return { ...data, volumes };
  }

  private createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Generate mock data based on time range
    const data = this.generateMockDataWithVolume();

    const config: ChartConfiguration = {
      type: 'line' as ChartType,
      data: {
        labels: data.labels,
        datasets: [
          {
            label: this.symbol,
            data: data.prices,
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: 'rgb(102, 126, 234)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => {
                return `$${context.parsed.y.toFixed(2)}`;
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
            ticks: {
              maxTicksLimit: 6,
              color: '#999',
            },
          },
          y: {
            display: true,
            position: 'right',
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              color: '#999',
              callback: function (value) {
                return '$' + value;
              },
            },
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private generateMockData(): { labels: string[]; prices: number[] } {
    const labels: string[] = [];
    const prices: number[] = [];
    const basePrice = 100 + Math.random() * 400;

    let dataPoints = 0;
    switch (this.timeRange) {
      case '1D':
        dataPoints = 78; // Every 5 min for 6.5 hours
        break;
      case '5D':
        dataPoints = 5;
        break;
      case '1M':
        dataPoints = 22;
        break;
      case '6M':
        dataPoints = 26;
        break;
      case '1Y':
        dataPoints = 52;
        break;
      default:
        dataPoints = 5;
    }

    for (let i = 0; i < dataPoints; i++) {
      // Generate labels based on time range
      if (this.timeRange === '1D') {
        const hour = 9 + Math.floor(i / 12);
        const minute = (i % 12) * 5;
        labels.push(`${hour}:${minute.toString().padStart(2, '0')}`);
      } else if (this.timeRange === '5D') {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        labels.push(days[i]);
      } else if (this.timeRange === '1M') {
        labels.push(`Day ${i + 1}`);
      } else if (this.timeRange === '6M') {
        labels.push(`Week ${i + 1}`);
      } else {
        labels.push(`Month ${i + 1}`);
      }

      // Generate price with random walk
      const change = (Math.random() - 0.5) * 10;
      const newPrice = i === 0 ? basePrice : prices[i - 1] + change;
      prices.push(Math.max(newPrice, basePrice * 0.8)); // Prevent too low prices
    }

    return { labels, prices };
  }

  private updateChart(): void {
    if (!this.chart) return;

    const data = this.generateMockData();
    this.chart.data.labels = data.labels;
    this.chart.data.datasets[0].data = data.prices;
    this.chart.update();
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
