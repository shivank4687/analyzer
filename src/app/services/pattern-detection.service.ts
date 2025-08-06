import { Injectable } from '@angular/core';
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectedPattern {
  name: string;
  strength: number; // 1–10
  direction: 'bullish' | 'bearish' | 'neutral';
  candleIndexes: number[]; // where pattern occurred
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PatternDetectionService {
  detectAll(candles: Candle[]): DetectedPattern[] {
    const patterns: any[] = [];

    if (candles.length < 5) return patterns;

    for (let i = 2; i < candles.length; i++) {
      const c = candles[i];
      const c1 = candles[i - 1];
      const c2 = candles[i - 2];

      if (this.isDoji(c))
        patterns.push(
          this.buildPattern('Doji', 'neutral', [i], c.timestamp, 3)
        );
      if (this.isHammer(c))
        patterns.push(
          this.buildPattern('Hammer', 'bullish', [i], c.timestamp, 6)
        );
      if (this.isInvertedHammer(c))
        patterns.push(
          this.buildPattern('Inverted Hammer', 'bullish', [i], c.timestamp, 5)
        );
      if (this.isEngulfing(c1, c))
        patterns.push(
          this.buildPattern(
            'Engulfing',
            this.engulfingDirection(c1, c),
            [i - 1, i],
            c.timestamp,
            7
          )
        );
      if (this.isMorningStar(c2, c1, c))
        patterns.push(
          this.buildPattern(
            'Morning Star',
            'bullish',
            [i - 2, i - 1, i],
            c.timestamp,
            8
          )
        );
      if (this.isEveningStar(c2, c1, c))
        patterns.push(
          this.buildPattern(
            'Evening Star',
            'bearish',
            [i - 2, i - 1, i],
            c.timestamp,
            8
          )
        );
      if (this.isThreeWhiteSoldiers(candles, i))
        patterns.push(
          this.buildPattern(
            'Three White Soldiers',
            'bullish',
            [i - 2, i - 1, i],
            c.timestamp,
            9
          )
        );
      if (this.isThreeBlackCrows(candles, i))
        patterns.push(
          this.buildPattern(
            'Three Black Crows',
            'bearish',
            [i - 2, i - 1, i],
            c.timestamp,
            9
          )
        );
    }

    return patterns;
  }

  private buildPattern(
    name: string,
    direction: 'bullish' | 'bearish' | 'neutral',
    candleIndexes: number[],
    timestamp: number,
    strength: number
  ): DetectedPattern {
    return { name, direction, candleIndexes, timestamp, strength };
  }

  // --- Pattern Logic ---

  private isDoji(c: Candle): boolean {
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    return body <= 0.1 * range;
  }

  private isHammer(c: Candle): boolean {
    const body = Math.abs(c.close - c.open);
    const lowerShadow = c.open > c.close ? c.low - c.close : c.low - c.open;
    return lowerShadow > 2 * body && c.close > c.open;
  }

  private isInvertedHammer(c: Candle): boolean {
    const body = Math.abs(c.close - c.open);
    const upperShadow = c.open > c.close ? c.open - c.high : c.close - c.high;
    return Math.abs(upperShadow) > 2 * body && c.close > c.open;
  }

  private isEngulfing(c1: Candle, c2: Candle): boolean {
    const isBullish =
      c1.close < c1.open &&
      c2.close > c2.open &&
      c2.open < c1.close &&
      c2.close > c1.open;

    const isBearish =
      c1.close > c1.open &&
      c2.close < c2.open &&
      c2.open > c1.close &&
      c2.close < c1.open;

    return isBullish || isBearish;
  }

  private engulfingDirection(c1: Candle, c2: Candle): 'bullish' | 'bearish' {
    return c2.close > c2.open ? 'bullish' : 'bearish';
  }

  private isMorningStar(c1: Candle, c2: Candle, c3: Candle): boolean {
    return (
      c1.close < c1.open &&
      this.isDoji(c2) &&
      c3.close > c3.open &&
      c3.close > c1.open
    );
  }

  private isEveningStar(c1: Candle, c2: Candle, c3: Candle): boolean {
    return (
      c1.close > c1.open &&
      this.isDoji(c2) &&
      c3.close < c3.open &&
      c3.close < c1.open
    );
  }

  private isThreeWhiteSoldiers(candles: Candle[], i: number): boolean {
    return (
      candles[i - 2].close < candles[i - 2].open &&
      candles[i - 1].close > candles[i - 1].open &&
      candles[i].close > candles[i].open &&
      candles[i].close > candles[i - 1].close
    );
  }

  private isThreeBlackCrows(candles: Candle[], i: number): boolean {
    return (
      candles[i - 2].close > candles[i - 2].open &&
      candles[i - 1].close < candles[i - 1].open &&
      candles[i].close < candles[i].open &&
      candles[i].close < candles[i - 1].close
    );
  }
}
