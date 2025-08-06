import { Injectable } from '@angular/core';
import { Candle } from './candle-aggregator.service'; // define this interface if not yet
@Injectable({ providedIn: 'root' })
export class TechnicalIndicatorsService {
  compute(candles: Candle[]): Record<string, any> {
    if (candles.length < 30) return {};

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    const latest = (arr: number[]) => arr[arr.length - 1];

    const rsi = latest(this.rsi(closes, 14));
    const macd = this.macd(closes);
    const macdHist = latest(macd.histogram);
    const momentum = latest(this.momentum(closes, 10));
    const roc = latest(this.roc(closes, 10));
    const atr = latest(this.atr(highs, lows, closes, 14));
    const bb = this.bollingerBands(closes, 20);
    const bbLatest = bb[bb.length - 1];
    const bbWidth =
      bbLatest && bbLatest.upper && bbLatest.lower
        ? bbLatest.upper - bbLatest.lower
        : undefined;

    const obv = latest(this.obv(closes, volumes));
    const mfi = latest(this.mfi(highs, lows, closes, volumes, 14));

    // Simple volume spike detection
    const avgVolume = avg(volumes.slice(-10, -1));
    const volumeSpike = volumes[volumes.length - 1] > avgVolume * 1.5;

    return {
      rsi,
      macdHist,
      momentum,
      roc,
      atr,
      bollingerBandWidth: bbWidth,
      obv,
      mfi,
      volumeSpike,
    };
  }
  // --- Trend Indicators ---
  sma(prices: number[], period: number): number[] {
    return prices.map((_, i) =>
      i < period - 1 ? NaN : avg(prices.slice(i - period + 1, i + 1))
    );
  }

  ema(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let emaPrev = prices[0];
    return prices.map((p, i) => {
      if (i === 0) return p;
      emaPrev = p * k + emaPrev * (1 - k);
      return emaPrev;
    });
  }

  macd(prices: number[], fast = 12, slow = 26, signal = 9) {
    const fastEMA = this.ema(prices, fast);
    const slowEMA = this.ema(prices, slow);
    const macdLine = fastEMA.map((v, i) => v - slowEMA[i]);
    const signalLine = this.ema(macdLine, signal);
    const histogram = macdLine.map((v, i) => v - signalLine[i]);

    return { macdLine, signalLine, histogram };
  }

  // --- Momentum Indicators ---
  rsi(prices: number[], period = 14): number[] {
    let gains = 0,
      losses = 0;
    const rsi: number[] = [];

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    gains /= period;
    losses /= period;

    rsi[period] = 100 - 100 / (1 + gains / losses);

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        gains = (gains * (period - 1) + diff) / period;
        losses = (losses * (period - 1)) / period;
      } else {
        gains = (gains * (period - 1)) / period;
        losses = (losses * (period - 1) - diff) / period;
      }
      rsi[i] = 100 - 100 / (1 + gains / losses);
    }

    return rsi;
  }

  momentum(prices: number[], period: number): number[] {
    return prices.map((p, i) => (i < period ? NaN : p - prices[i - period]));
  }

  roc(prices: number[], period: number): number[] {
    return prices.map((p, i) =>
      i < period ? NaN : ((p - prices[i - period]) / prices[i - period]) * 100
    );
  }

  // --- Volatility ---
  atr(
    highs: number[],
    lows: number[],
    closes: number[],
    period = 14
  ): number[] {
    const tr = highs.map((h, i) => {
      const prevClose = closes[i - 1] || closes[0];
      return Math.max(
        h - lows[i],
        Math.abs(h - prevClose),
        Math.abs(lows[i] - prevClose)
      );
    });

    return this.ema(tr, period);
  }

  bollingerBands(prices: number[], period = 20, multiplier = 2) {
    return prices.map((_, i) => {
      if (i < period - 1) return null;
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = avg(slice);
      const std = stddev(slice);
      return {
        upper: mean + multiplier * std,
        middle: mean,
        lower: mean - multiplier * std,
      };
    });
  }

  // --- Volume ---
  obv(prices: number[], volumes: number[]): number[] {
    const obv: number[] = [0];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) obv[i] = obv[i - 1] + volumes[i];
      else if (prices[i] < prices[i - 1]) obv[i] = obv[i - 1] - volumes[i];
      else obv[i] = obv[i - 1];
    }
    return obv;
  }

  mfi(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    period = 14
  ): number[] {
    const typicalPrice = closes.map(
      (_, i) => (highs[i] + lows[i] + closes[i]) / 3
    );
    const moneyFlow = typicalPrice.map((tp, i) => tp * volumes[i]);

    const mfi: number[] = [];

    for (let i = period; i < closes.length; i++) {
      let posMF = 0,
        negMF = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrice[j] > typicalPrice[j - 1]) posMF += moneyFlow[j];
        else negMF += moneyFlow[j];
      }
      const mfRatio = posMF / (negMF || 1);
      mfi[i] = 100 - 100 / (1 + mfRatio);
    }

    return mfi;
  }
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = avg(arr);
  return Math.sqrt(
    arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / arr.length
  );
}
