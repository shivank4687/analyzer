import { Injectable } from '@angular/core';
import { CandleAggregatorService } from './candle-aggregator.service';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { PatternDetectionService } from './pattern-detection.service';
import { analyzeData, StrategyConfig, AnalysisSignal } from './analysis-engine';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  public signals$ = new BehaviorSubject<AnalysisSignal[]>([]);

  private strategyConfigs: StrategyConfig[] = [
    {
      timeframe: '1m',
      minScore: 2,
      weights: {
        rsi: 1,
        macd: 1,
        volumeSpike: 1,
        pattern: 1,
        momentum: 1,
      },
      enabledIndicators: ['rsi', 'macd', 'pattern', 'volumeSpike'],
      directionFilter: 'long-only',
    },
  ];

  constructor(
    private candles: CandleAggregatorService,
    private indicators: TechnicalIndicatorsService,
    private patterns: PatternDetectionService
  ) {
    // Example: use 1m candles
    this.candles.candles1m$.subscribe((candleList) => {
      if (candleList.length < 3) return;

      const lastCandles = candleList.slice(-3);
      const indicatorData = this.indicators.compute(lastCandles); // your implementation
      const foundPatterns = this.patterns
        .detectAll(candleList)
        .map((p) => p.name);

      for (const config of this.strategyConfigs) {
        const signal = analyzeData(
          indicatorData,
          foundPatterns,
          config,
          config.timeframe
        );
        this.appendSignal(signal);
      }
    });
  }

  getCurrentPrice() {
    return 1;
  }
  private appendSignal(signal: AnalysisSignal) {
    const current = this.signals$.value;
    const updated = [...current.slice(-99), signal];
    this.signals$.next(updated);
  }

  public getLatestSignal(timeframe: string): AnalysisSignal | undefined {
    return this.signals$.value.filter((s) => s.timeframe === timeframe).at(-1);
  }
}
