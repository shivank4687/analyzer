import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  ElementRef,
  Renderer2,
  SimpleChanges,
  ViewChild,
  OnInit,
  OnDestroy,
  EventEmitter,
  Output,
} from '@angular/core';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { MatCardModule } from '@angular/material/card';
import { ChartService } from '../../services/chart.service';
import { CHART_OPTIONS, SERIES_OPTIONS } from './chart.options';

const INDICATORS_CONFIG: any = SERIES_OPTIONS;

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss',
})
export class ChartComponent
  implements OnChanges, OnDestroy, OnInit, AfterViewInit
{
  @ViewChild('chartWrapper', { static: true }) chartWrapper!: ElementRef;
  @ViewChild('candleChart', { static: true }) chartContainer!: ElementRef;

  private resizeObserver!: ResizeObserver;

  @ViewChild('macdChart', { static: true }) macdChartContainer!: ElementRef;

  private toolTip!: HTMLElement;
  @Input() applied_indicators: any = {};
  @Input() chart_id: any = 'candle-chart';
  @Input() analysis: any = false;
  @Input() indicators_to_show: any = [];
  @Input() candles: any[] = [];
  @Input() candle_updates: any[] = [];
  @Input() predictions: any = { close: [] };
  @Output() candleClick = new EventEmitter<any>();
  chart: any;
  charts: any = {};
  candleSeries: any;
  predictedSeries: any;
  indicator_series: any = {};
  indicator_charts: any = {};
  selected_indicators: any = [];
  fibonacci_lines: any = [];
  constructor(
    private renderer: Renderer2,
    private chartService: ChartService
  ) {}
  ngOnInit(): void {
    if (!this.analysis) {
      this.subscribeIndicators();
    }
  }
  ngOnChanges(changes: SimpleChanges): void {
    if ('candles' in changes) {
      if (this.candles.length && !this.chart) {
        if (this.analysis) {
          setTimeout(() => {
            this.createChart('candle');
            this.candleSeries.setData(this.candles);

            this.chart
              .timeScale()
              .setVisibleRange(this.zoomLevels(this.candles));
          });
        } else {
          this.createChart('candle');
          this.candleSeries.setData(this.candles);

          this.chart.timeScale().setVisibleRange(this.zoomLevels(this.candles));
        }
        // this.chart.timeScale().fitContent();
      } else if (this.chart) {
        const visibleRange = this.chart.timeScale().getVisibleRange();
        this.candleSeries.setData(this.candles);
        if (visibleRange) {
          // this.chart.timeScale().setVisibleRange(visibleRange);
        } else {
          // this.chart.timeScale().fitContent();
        }
      }
    }

    if ('applied_indicators' in changes) {
      this.fibonacci_lines.forEach((line: any) =>
        this.indicator_series['fibonacci'].removePriceLine(line)
      );
      this.fibonacci_lines = [];
      if (this.chart) this.updateIndicators();
    }

    if ('candle_updates' in changes) {
      let updates = 1;
      if (this.candle_updates.length) {
        let last_candle =
          this.candle_updates[this.candle_updates.length - updates];
        let current_last_candle = this.candles[this.candles.length - 1];

        while (last_candle.time >= current_last_candle.time) {
          this.candleSeries.update(last_candle);
          break;
          updates++;
          last_candle =
            this.candle_updates[this.candle_updates.length - updates];
        }
        console.log('TOTAL UPDATED CANDLES ' + (updates - 1));
        //  this.candleSeries.update(
        //   this.candle_updates[this.candle_updates.length - 1]
        // );
        //   this.candleSeries.update(
        //     this.candle_updates[this.candle_updates.length - 1]
        //   );
        // this.candle_updates.forEach((e) => this.candleSeries.update(e));
      }
    }

    if ('predictions' in changes) {
      if (this.predictions.close.length && !this.chart) {
        // this.createChart();
        this.chart.timeScale().fitContent();
      } else if (this.chart) {
        // console.log('setting new data');
        // this.chart.remove();
        // this.createChart();
        this.predictedSeries.setData(this.predictions.close);
        this.chart.timeScale().fitContent();
      }
    }

    if ('indicators_to_show' in changes) {
      if (this.indicators_to_show) {
        this.selected_indicators = this.indicators_to_show;
        if (this.chart) this.updateIndicators();
      }
    }
  }
  ngAfterViewInit(): void {
    // this.createChart();
  }

  updateIndicators() {
    for (let indicator of this.selected_indicators) {
      if (this.applied_indicators[indicator]?.length)
        this.setIndicator(indicator, this.applied_indicators[indicator]);
    }
    Object.keys(this.indicator_series).forEach((e: any) => {
      if (this.selected_indicators.indexOf(e) == -1)
        if (e == 'fibonacci') {
          this.fibonacci_lines.forEach((line: any) =>
            this.indicator_series[e].removePriceLine(line)
          );
          this.fibonacci_lines = [];
        } else {
          this.indicator_series[e].setData([]);
        }
    });
  }
  setIndicator(indicator: any, data: any) {
    let chart = this.charts[indicator] || this.chart;
    if (INDICATORS_CONFIG[indicator].candle_series) {
      this.indicator_series[indicator] = this.candleSeries;
    }
    if (INDICATORS_CONFIG[indicator] && !this.indicator_series[indicator]) {
      if (
        INDICATORS_CONFIG[indicator].seperate_chart &&
        !this.charts[indicator]
      ) {
        this.createChart(indicator);
      }

      chart = this.charts[indicator] || this.chart;
      this.indicator_series[indicator] = chart.addSeries(
        INDICATORS_CONFIG[indicator].series,
        INDICATORS_CONFIG[indicator].options
      );
    }
    //  else if (!this.indicator_series[indicator]) {
    //   this.indicator_series[indicator] = this.chart.addSeries(LineSeries);
    // }
    if (INDICATORS_CONFIG[indicator].map_data) {
      data = INDICATORS_CONFIG[indicator].map_data(data);
    }
    if (indicator == 'fibonacci') {
      if (this.fibonacci_lines.length) return;
      data.forEach((priceLine: any) => {
        let line = this.indicator_series[indicator].createPriceLine(priceLine);
        this.fibonacci_lines.push(line);
      });
      return;
    }
    this.indicator_series[indicator].setData(data);

    if (INDICATORS_CONFIG[indicator].price_scaling) {
      chart.priceScale(indicator).applyOptions({
        scaleMargins: {
          top: 0.8, // push MACD below main chart
          bottom: 0,
        },
      });
      // chart.applyOptions({
      //   rightPriceScale: {
      //     visible: true,
      //   },
      //   layout: {
      //     backgroundColor: '#ffffff',
      //     textColor: '#000000',
      //   },
      // });
    }
  }

  subscribeIndicators() {
    this.chartService.getIndicators().subscribe((i: any) => {
      this.selected_indicators = i;
      this.updateIndicators();
    });
  }

  createChart(type: any) {
    switch (type) {
      case 'candle':
        const container = this.chartWrapper.nativeElement;
        this.chart = createChart(this.chart_id, {
          ...CHART_OPTIONS[type],
          width: container.clientWidth,
          height: container.clientHeight,
        });
        this.candleSeries = this.addChartSeries(this.chart, 'candle');
        this.subcribeCrossHair(this.chart);
        this.createTooltip();
        this.resizeObserver = new ResizeObserver(() => {
          const { clientWidth, clientHeight } = container;
          this.chart.resize(clientWidth, clientHeight);
        });
        this.resizeObserver.observe(container);
        this.chart.timeScale().fitContent();
        if (this.analysis) this.updateIndicators();
        break;
      case 'macd':
        this.charts[type] = createChart('macd-chart', CHART_OPTIONS[type]);
      // this.charts[type].subscribeCrosshairMove(syncCrosshairMacd);
    }

    // this.predictedSeries = this.chart.addSeries(LineSeries);
  }

  addChartSeries(chart: any, type: any) {
    if (!SERIES_OPTIONS[type]) {
      alert('Series Options Not found');
      return;
    }
    const { series, options } = SERIES_OPTIONS[type];
    return chart.addSeries(series, options);
  }

  subcribeCrossHair(chart: any) {
    const chartContainerNative = this.chartContainer.nativeElement;
    chart.subscribeCrosshairMove((param: any) => {
      // If no point/time or point outside container bounds, hide tooltip
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerNative.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerNative.clientHeight
      ) {
        this.renderer.setStyle(this.toolTip, 'display', 'none');
        return;
      }

      let price = null;
      if (param.seriesData && param.seriesData.get(this.candleSeries)) {
        price = param.seriesData.get(this.candleSeries);
      } else if (
        param.seriesPrices &&
        param.seriesPrices.get(this.candleSeries)
      ) {
        price = param.seriesPrices.get(this.candleSeries);
      }

      if (!price) {
        this.renderer.setStyle(this.toolTip, 'display', 'none');
        return;
      }

      this.renderer.setStyle(this.toolTip, 'display', 'block');
      this.renderer.setStyle(this.toolTip, 'left', param.point.x + 20 + 'px');
      this.renderer.setStyle(this.toolTip, 'top', param.point.y + 20 + 'px');

      // Update tooltip HTML content
      this.toolTip.innerHTML =
        `<b>Open:</b> ${price.open}<br>` +
        `<b>High:</b> ${price.high}<br>` +
        `<b>Low:</b> ${price.low}<br>` +
        `<b>Close:</b> ${price.close}<br>` +
        `<b>Points:</b> ${Math.round(price.open - price.close)}`;
    });
    if (this.analysis) {
      // chart.subscribeClick(this.candleClicked.bind(this));
      chart.subscribeClick((param: any) => this.candleClicked(param));
    }
  }

  candleClicked(param: any) {
    if (param.time) {
      this.candleClick.emit(param);
    }
  }
  zoomLevels(data: any) {
    const n = 55; // Number of candles you'd like before and after the center (so total 2n visible)
    const totalCandles = data.length;
    const lastCandleIndex = totalCandles - 1;

    // Define the center to be the last candle
    const centerTime = data[lastCandleIndex].time;

    // Compute left and right time boundaries
    const leftIndex = Math.max(0, lastCandleIndex - n);
    const rightIndex = Math.min(totalCandles - 1, lastCandleIndex + n);

    const fromTime = data[leftIndex].time;
    const toTime = data[rightIndex].time;
    return { from: fromTime, to: toTime };
    //     const logicalRange = {
    //       from: candles.length - N,
    //       to: candles.length,
    //     };
    //     chart.timeScale().setVisibleLogicalRange(logicalRange);
    //     const lastTime = candles[candles.length - 1].time;
    // const durationSeconds = 2 * 60 * 60; // e.g., 2 hours
    // const fromTime = lastTime - durationSeconds;
    // chart.timeScale().setVisibleRange({
    //   from: fromTime,
    //   to: lastTime,
    // });
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver?.disconnect();
    }
    if (this.chart) {
      this.chart?.remove();
    }
  }
  createTooltip() {
    this.toolTip = this.renderer.createElement('div');

    this.renderer.setStyle(this.toolTip, 'position', 'absolute');
    this.renderer.setStyle(this.toolTip, 'display', 'none');
    this.renderer.setStyle(this.toolTip, 'left', '12px');
    this.renderer.setStyle(this.toolTip, 'top', '12px');
    this.renderer.setStyle(this.toolTip, 'background', 'rgba(33, 33, 33, 0.9)');
    this.renderer.setStyle(this.toolTip, 'color', '#fff');
    this.renderer.setStyle(this.toolTip, 'padding', '8px 12px');
    this.renderer.setStyle(this.toolTip, 'border-radius', '4px');
    this.renderer.setStyle(this.toolTip, 'z-index', '1000');
    this.renderer.setStyle(this.toolTip, 'pointer-events', 'none');
    this.renderer.setStyle(this.toolTip, 'font-size', '13px');

    this.renderer.appendChild(this.chartContainer.nativeElement, this.toolTip);
  }

  syncCrosshairMacd(param: any) {
    if (param === undefined || param.time === undefined) return;
    this.charts['macd'].moveCrosshair(param);
  }
}
