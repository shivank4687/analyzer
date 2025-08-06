import { Injectable } from '@angular/core';
import { AnalysisService } from '../analysis.service';
import { BehaviorSubject } from 'rxjs';
import { BotTrade } from './bot-trade.model';
import { TradingBotConfig } from './bot-config.model';

@Injectable({ providedIn: 'root' })
export class TradingBotService {
  private isRunning = false;
  private intervalRef: any;
  private lastTradeTime = 0;
  private currentPosition: BotTrade | null = null;
  private config: TradingBotConfig = {
    enabledTimeframes: ['1m', '5s'],
    minScore: 3,
    cooldownMs: 30_000,
    direction: 'both',
    stopLossPct: 0.3, // ← Required
    takeProfitPct: 0.6, // ← Required
    riskPerTradePct: 1.0,
  };

  public trades$ = new BehaviorSubject<BotTrade[]>([]);
  public status$ = new BehaviorSubject<'IDLE' | 'RUNNING' | 'COOLING_DOWN'>(
    'IDLE'
  );

  constructor(private analysis: AnalysisService) {}

  start(configOverrides?: Partial<TradingBotConfig>) {
    if (this.isRunning) return;

    this.config = { ...this.config, ...configOverrides };
    this.isRunning = true;
    this.status$.next('RUNNING');

    this.intervalRef = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop() {
    clearInterval(this.intervalRef);
    this.isRunning = false;
    this.status$.next('IDLE');
  }

  private tick(): void {
    if (!this.isRunning) return;

    const now = Date.now();

    // 1. Check for open position and evaluate SL/TP
    if (this.currentPosition) {
      const currentPrice = this.analysis.getCurrentPrice();
      if (!currentPrice) return;

      const entry = this.currentPosition.entryPrice;
      const isLong = this.currentPosition.action === 'BUY';

      const { stopLossPct, takeProfitPct } = this.config;

      // Calculate % change based on position direction
      const priceDiffPct =
        ((currentPrice - entry) / entry) * 100 * (isLong ? 1 : -1);

      if (priceDiffPct <= -stopLossPct) {
        this.closePosition('SL', currentPrice, priceDiffPct);
        this.status$.next('COOLING_DOWN');
        return;
      }

      if (priceDiffPct >= takeProfitPct) {
        this.closePosition('TP', currentPrice, priceDiffPct);
        this.status$.next('COOLING_DOWN');
        return;
      }

      this.status$.next('RUNNING');
      return; // Do not enter new trade while holding position
    }

    // 2. Enforce cooldown if last trade was recent
    if (now - this.lastTradeTime < this.config.cooldownMs) {
      this.status$.next('COOLING_DOWN');
      return;
    }

    // 3. Check signals from configured timeframes
    for (const timeframe of this.config.enabledTimeframes) {
      const signal = this.analysis.getLatestSignal(timeframe);
      if (!signal) continue;

      const { action, score } = signal;

      // Must meet minimum score
      if (score < this.config.minScore || action === 'NEUTRAL') continue;

      // Respect long-only or short-only config
      if (
        (this.config.direction === 'long-only' && action === 'SELL') ||
        (this.config.direction === 'short-only' && action === 'BUY')
      ) {
        continue;
      }

      // 4. Enter trade
      this.executeTrade(signal);
      this.status$.next('RUNNING');
      return; // Only one trade per tick
    }

    // 5. No valid trade
    this.status$.next('RUNNING');
  }

  private executeTrade(signal: any) {
    if (this.currentPosition) return; // already in a trade

    const currentPrice = this.analysis.getCurrentPrice(); // snapshot-based
    if (!currentPrice) return;

    const trade: BotTrade = {
      action: signal.action,
      score: signal.score,
      reason: signal.reasons,
      timestamp: Date.now(),
      timeframe: signal.timeframe,
      entryPrice: currentPrice,
    };

    this.currentPosition = trade;
    console.log(`[BOT] Entry: ${trade.action} @ ${trade.entryPrice}`);
  }

  private closePosition(
    result: 'TP' | 'SL' | 'MANUAL',
    exitPrice: number,
    pnl: number
  ) {
    if (!this.currentPosition) return;

    const completedTrade = {
      ...this.currentPosition,
      exitPrice,
      result,
      pnl,
    };

    const updated = [...this.trades$.value.slice(-99), completedTrade];
    this.trades$.next(updated);

    console.log(
      `[BOT] Exit (${result}) @ ${exitPrice} | PnL: ${pnl.toFixed(2)}%`
    );

    this.currentPosition = null;
    this.lastTradeTime = Date.now();
  }

  getCurrentConfig(): TradingBotConfig {
    return this.config;
  }
}
