import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BotTrade } from './bot-trade.model';
import { BotTradeStats } from './bot-trade-stats.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({ providedIn: 'root' })
export class BotTradeLogService {
  private readonly trades$ = new BehaviorSubject<BotTrade[]>([]);
  private readonly stats$ = new BehaviorSubject<BotTradeStats>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgPnL: 0,
    totalPnL: 0,
    maxGain: 0,
    maxLoss: 0,
  });

  constructor() {}

  getTradeLogs$() {
    return this.trades$.asObservable();
  }

  getStats$() {
    return this.stats$.asObservable();
  }

  logTrade(trade: Omit<BotTrade, 'id'>) {
    const fullTrade: BotTrade = { id: uuidv4(), ...trade };
    const updatedTrades = [...this.trades$.value, fullTrade].slice(-1000); // limit max

    this.trades$.next(updatedTrades);
    this.updateStats(updatedTrades);
  }

  private updateStats(trades: BotTrade[]) {
    const total = trades.length;
    const wins = trades.filter((t) => t.pnl > 0).length;
    const losses = trades.filter((t) => t.pnl <= 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgPnL = total ? totalPnL / total : 0;
    const winRate = total ? (wins / total) * 100 : 0;
    const maxGain = Math.max(...trades.map((t) => t.pnl));
    const maxLoss = Math.min(...trades.map((t) => t.pnl));

    this.stats$.next({
      totalTrades: total,
      wins,
      losses,
      winRate,
      avgPnL,
      totalPnL,
      maxGain,
      maxLoss,
    });
  }

  clearLogs() {
    this.trades$.next([]);
    this.stats$.next({
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgPnL: 0,
      totalPnL: 0,
      maxGain: 0,
      maxLoss: 0,
    });
  }

  getTradeList() {
    return this.trades$.value;
  }

  getCurrentStats() {
    return this.stats$.value;
  }
}
