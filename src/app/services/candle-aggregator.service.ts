import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
//import { Snapshot } from './snapshot.interface'; // your snapshot type
import { SnapshotStateService } from './snapshot-state.service';

export interface Candle {
  timestamp: number; // start of candle
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable({ providedIn: 'root' })
export class CandleAggregatorService {
  // Outputs for charting and analysis
  public candles1s$ = new BehaviorSubject<Candle[]>([]);
  public candles5s$ = new BehaviorSubject<Candle[]>([]);
  public candles15s$ = new BehaviorSubject<Candle[]>([]);
  public candles1m$ = new BehaviorSubject<Candle[]>([]);
  public candles5m$ = new BehaviorSubject<Candle[]>([]);

  // Internal map to accumulate candles
  private cache: Record<string, any[]> = {
    '1s': [],
    '5s': [],
    '15s': [],
    '1m': [],
    '5m': [],
  };

  constructor(private snapshotState: SnapshotStateService) {
    // Every 1 second, refresh candles
    interval(1000).subscribe(() => {
      this.aggregate('1s', 1);
      this.aggregate('5s', 5);
      this.aggregate('15s', 15);
      this.aggregate('1m', 60);
      this.aggregate('5m', 300);
    });

    // Subscribe to all snapshots
    this.snapshotState.latestSnapshot$.subscribe((snap) => {
      if (snap) {
        Object.keys(this.cache).forEach((key) => this.cache[key].push(snap));
      }
    });
  }

  private aggregate(key: string, intervalInSec: number): void {
    const now = Date.now();
    const intervalMs = intervalInSec * 1000;

    const validSnapshots = this.cache[key].filter(
      (s) => s.timestamp >= now - intervalMs
    );

    if (validSnapshots.length === 0) return;

    const candle = this.buildCandle(validSnapshots, now - intervalMs);

    const subject = this.getSubjectForKey(key);
    const current = subject.value;
    subject.next([...current.slice(-99), candle]); // Keep only last 100
    this.cache[key] = [];
  }

  private buildCandle(snaps: any[], startTime: number): Candle {
    const prices = snaps.map((s) => s.price);
    const volumes = snaps.map((s) => s.volume?.totalSize || 0);

    return {
      timestamp: startTime,
      open: snaps[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: snaps[snaps.length - 1].price,
      volume: volumes.reduce((a, b) => a + b, 0),
    };
  }

  private getSubjectForKey(key: string): BehaviorSubject<Candle[]> {
    switch (key) {
      case '1s':
        return this.candles1s$;
      case '5s':
        return this.candles5s$;
      case '15s':
        return this.candles15s$;
      case '1m':
        return this.candles1m$;
      case '5m':
        return this.candles5m$;
      default:
        throw new Error(`Invalid key ${key}`);
    }
  }
}
