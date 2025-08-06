import { Injectable } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { SnapshotStateService } from './snapshot-state.service';
interface IndicatorResult {
  timeframe: string;
  priceChange: number;
  priceMomentum: number;
  priceVolatility: number;
  avgVolume: number;
  volumeDelta: number;
  volumeImbalance: number;
  maxTradeSize: number;
  aggressiveVolumeRatio: number;
  depthImbalance: number;
  spreadAvg: number;
  orderFlowPressure: number;
  obVolatility: number;
  wallDetectionScore: number;
  slope: number;
  acceleration: number;
  earlyReversal: number;
}

@Injectable({ providedIn: 'root' })
export class IndicatorService {
  constructor(private state: SnapshotStateService) {}

  public indicators$: Observable<IndicatorResult[]> = combineLatest([
    this.state.last1Second$,
    this.state.last5Seconds$,
    this.state.last15Seconds$,
    this.state.last30Seconds$,
    this.state.last1Minute$,
    this.state.last3Minutes$,
    this.state.last5Minutes$,
    this.state.last15Minutes$,
  ]).pipe(
    map(([s1, s5, s15, s30, s1m, s3m, s5m, s15m]): IndicatorResult[] => [
      this.calc('1s', s1),
      this.calc('5s', s5),
      this.calc('15s', s15),
      this.calc('30s', s30),
      this.calc('1m', s1m),
      this.calc('3m', s3m),
      this.calc('5m', s5m),
      this.calc('15m', s15m),
    ])
  );

  private calc(tf: string, snaps: any[]): IndicatorResult {
    const n = snaps.length;
    if (n < 2) {
      return {
        timeframe: tf,
        priceChange: 0,
        priceMomentum: 0,
        priceVolatility: 0,
        avgVolume: 0,
        volumeDelta: 0,
        volumeImbalance: 0,
        maxTradeSize: 0,
        aggressiveVolumeRatio: 0,
        depthImbalance: 0,
        spreadAvg: 0,
        orderFlowPressure: 0,
        obVolatility: 0,
        wallDetectionScore: 0,
        slope: 0,
        acceleration: 0,
        earlyReversal: 0,
      };
    }

    const first = snaps[0];
    const last = snaps[n - 1];
    const deltaT = (last.timestamp - first.timestamp) / 1000;

    const prices = snaps.map((s) => s.price);
    const priceChange = ((last.price - first.price) / first.price) * 100;
    const priceMomentum = deltaT ? (last.price - first.price) / deltaT : 0;
    const priceVolatility = stddev(prices);

    const avgVolume =
      snaps.reduce((sum, s) => sum + (s.volume?.totalSize || 0), 0) / n;
    const totalBuy = snaps.reduce((s, x) => s + (x.volume?.buySize || 0), 0);
    const totalSell = snaps.reduce((s, x) => s + (x.volume?.sellSize || 0), 0);
    const volumeDelta = totalBuy - totalSell;
    const volumeImbalance =
      totalBuy + totalSell > 0 ? (totalBuy / (totalBuy + totalSell)) * 100 : 0;

    const trades = snaps.flatMap((s) => s.volume?.recentTrades || []);
    const maxTradeSize = Math.max(...trades.map((t) => t.size || 0), 0);
    const largeTrades = trades.filter((t) => t.size > avgVolume);
    const aggressiveVolumeRatio =
      trades.length > 0 ? (largeTrades.length / trades.length) * 100 : 0;

    const buyDepth = avg(snaps.map((s) => s.orderBook?.buyDepth || 0));
    const sellDepth = avg(snaps.map((s) => s.orderBook?.sellDepth || 0));
    const depthImbalance = sellDepth ? buyDepth / sellDepth : 0;

    const spreadAvg = avg(snaps.map((s) => s.orderBook?.spread || 0));
    const orderFlowPressure = (priceChange / spreadAvg) * depthImbalance || 0;

    const bidVols = snaps.map((s) => s.orderBook?.buyDepth || 0);
    const askVols = snaps.map((s) => s.orderBook?.sellDepth || 0);
    const obVolatility = (stddev(bidVols) + stddev(askVols)) / 2;

    const topSizes = snaps
      .map((s) => [
        s.orderBook?.topBid?.size || 0,
        s.orderBook?.topAsk?.size || 0,
      ])
      .flat();
    const totalDepth = buyDepth + sellDepth;
    const wallDetectionScore = totalDepth
      ? (Math.max(...topSizes) / totalDepth) * 100
      : 0;

    const slope = linearSlope(snaps.map((s) => s.price));
    const acceleration =
      (snaps[n - 1].price -
        2 * snaps[Math.floor(n / 2)].price +
        snaps[0].price) /
      Math.pow(n, 2);

    const earlyReversal =
      (depthImbalance > 1 && priceMomentum < 0) ||
      (depthImbalance < 1 && priceMomentum > 0)
        ? 1
        : 0;

    return {
      timeframe: tf,
      priceChange,
      priceMomentum,
      priceVolatility,
      avgVolume,
      volumeDelta,
      volumeImbalance,
      maxTradeSize,
      aggressiveVolumeRatio,
      depthImbalance,
      spreadAvg,
      orderFlowPressure,
      obVolatility,
      wallDetectionScore,
      slope,
      acceleration,
      earlyReversal,
    };
  }
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(values: number[]): number {
  const mean = avg(values);
  const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(avg(squareDiffs));
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const x = values.map((_, i) => i);
  const meanX = avg(x);
  const meanY = avg(values);

  const num = x.reduce(
    (sum, xi, i) => sum + (xi - meanX) * (values[i] - meanY),
    0
  );
  const den = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);

  return den ? num / den : 0;
}
