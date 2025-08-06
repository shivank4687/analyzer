export interface WalletPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  size: number;
  timestamp: number;
}
