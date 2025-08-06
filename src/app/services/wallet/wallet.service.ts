import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WalletState } from './wallet-state.model';
import { WalletPosition } from './wallet-position.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly defaultBalance = 1000;
  private readonly state$ = new BehaviorSubject<WalletState>({
    usdt: this.defaultBalance,
    positions: [],
    equity: this.defaultBalance,
    pnlHistory: [],
  });

  constructor() {}

  getState$() {
    return this.state$.asObservable();
  }

  getState() {
    return this.state$.value;
  }

  reset() {
    this.state$.next({
      usdt: this.defaultBalance,
      positions: [],
      equity: this.defaultBalance,
      pnlHistory: [],
    });
  }

  openPosition(
    symbol: string,
    side: 'BUY' | 'SELL',
    entryPrice: number,
    size: number
  ): boolean {
    const state = this.getState();
    const cost = size * entryPrice;

    if (state.usdt < cost) return false;

    const position: WalletPosition = {
      id: uuidv4(),
      symbol,
      side,
      entryPrice,
      size,
      timestamp: Date.now(),
    };

    const updatedState: WalletState = {
      ...state,
      usdt: state.usdt - cost,
      positions: [...state.positions, position],
    };

    this.state$.next(updatedState);
    return true;
  }

  closePosition(positionId: string, exitPrice: number) {
    const state = this.getState();
    const position = state.positions.find((p) => p.id === positionId);
    if (!position) return;

    const isLong = position.side === 'BUY';
    const pnl =
      (exitPrice - position.entryPrice) * position.size * (isLong ? 1 : -1);
    const refund = position.size * exitPrice;

    const updatedPositions = state.positions.filter((p) => p.id !== positionId);
    const updatedUsdt = state.usdt + refund + pnl;
    const updatedPnlHistory = [...state.pnlHistory, pnl];

    this.state$.next({
      ...state,
      usdt: updatedUsdt,
      positions: updatedPositions,
      equity: updatedUsdt,
      pnlHistory: updatedPnlHistory,
    });
  }

  updateEquity(currentPrice: number) {
    const state = this.getState();
    const unrealizedPnL = state.positions.reduce((acc, p) => {
      const diff =
        (currentPrice - p.entryPrice) * p.size * (p.side === 'BUY' ? 1 : -1);
      return acc + diff;
    }, 0);

    const updatedEquity = state.usdt + unrealizedPnL;

    this.state$.next({
      ...state,
      equity: updatedEquity,
    });
  }
}
