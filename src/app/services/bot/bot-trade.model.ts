export interface BotTrade {
  id: string;
  action: 'BUY' | 'SELL';
  score: number;
  reasons: string[];
  entryPrice: number;
  exitPrice: number;
  result: 'TP' | 'SL' | 'MANUAL';
  pnl: number; // % or actual, based on strategy
  symbol: string;
  timeframe: string;
  timestamp: number;
}
