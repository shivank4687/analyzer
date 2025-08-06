export interface BotTrade {
  action: 'BUY' | 'SELL';
  score: number;
  reason: string[];
  timeframe: string;
  timestamp: number;
  entryPrice: number;
  exitPrice?: number;
  result?: 'TP' | 'SL' | 'MANUAL';
  pnl?: number;
}
