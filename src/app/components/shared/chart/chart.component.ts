import { Component, Input } from '@angular/core';
import { OhlcData, HistogramData, Time } from 'lightweight-charts';

@Component({
  selector: 'stock-chart',
  standalone: true,
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css'],
  imports: [
    // If needed, import Angular directives/pipes here
  ],
})
export class ChartComponent {
  @Input() candleData: OhlcData<Time>[] = [];
  @Input() indicatorData: HistogramData<Time>[] = [];
  @Input() chartOptions: any = {}; // allow customizing chart options

  onCrosshairData(data: any): void {
    // Optionally emit to parent component or handle locally
  }
}
