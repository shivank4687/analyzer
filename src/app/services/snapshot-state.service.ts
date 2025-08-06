import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface Snapshot {
  timestamp: number;
  price: number;
  marketStats: any;
  orderBook: any;
  volume: {
    totalSize: number;
    buySize: number;
    sellSize: number;
    recentTrades: any[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class SnapshotStateService {
  private allSnapshots: Snapshot[] = [];
  private lastTimestamp: number = 0;

  public latestSnapshot$ = new BehaviorSubject<Snapshot | null>(null);

  // Subsets by timeframe
  public last1Second$ = new BehaviorSubject<Snapshot[]>([]);
  public last5Seconds$ = new BehaviorSubject<Snapshot[]>([]);
  public last15Seconds$ = new BehaviorSubject<Snapshot[]>([]);
  public last30Seconds$ = new BehaviorSubject<Snapshot[]>([]);
  public last1Minute$ = new BehaviorSubject<Snapshot[]>([]);
  public last3Minutes$ = new BehaviorSubject<Snapshot[]>([]);
  public last5Minutes$ = new BehaviorSubject<Snapshot[]>([]);
  public last15Minutes$ = new BehaviorSubject<Snapshot[]>([]);
  constructor() {
    this.loadFromChromeStorage();
  }

  private loadFromChromeStorage() {
    chrome.storage.local.get('analysisData', (result: any) => {
      const data = result.analysisData || [];
      this.allSnapshots = data;
      this.lastTimestamp = data.length ? data[data.length - 1].timestamp : 0;
      this.refreshSubjects();
    });
  }

  public handleNewSnapshot(snapshot: Snapshot) {
    if (snapshot.timestamp === this.lastTimestamp) return;

    this.lastTimestamp = snapshot.timestamp;
    this.allSnapshots.push(snapshot);

    // Keep max 300 entries
    // if (this.allSnapshots.length > 300) {
    //   this.allSnapshots.shift();
    // }

    this.refreshSubjects();
  }

  private refreshSubjects() {
    const now = Date.now();

    this.latestSnapshot$.next(
      this.allSnapshots[this.allSnapshots.length - 1] || null
    );

    const timeframeMap = [
      { subject: this.last1Second$, seconds: 1 },
      { subject: this.last5Seconds$, seconds: 5 },
      { subject: this.last15Seconds$, seconds: 15 },
      { subject: this.last30Seconds$, seconds: 30 },
      { subject: this.last1Minute$, seconds: 60 },
      { subject: this.last3Minutes$, seconds: 180 },
      { subject: this.last5Minutes$, seconds: 300 },
      { subject: this.last15Minutes$, seconds: 900 },
    ];

    for (const { subject, seconds } of timeframeMap) {
      const filtered = this.allSnapshots.filter(
        (s) => s.timestamp >= now - seconds * 1000
      );
      subject.next(filtered);
    }
  }
}
