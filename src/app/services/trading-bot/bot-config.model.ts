export interface TradingBotConfig {
  enabledTimeframes: string[];
  minScore: number;
  cooldownMs: number;
  direction: 'long-only' | 'short-only' | 'both';
  stopLossPct: number; // e.g. 0.3 = 0.3%
  takeProfitPct: number; // e.g. 0.6 = 0.6%
  riskPerTradePct: number; // means 1% of capital at risk per trade (optional feature)
}
