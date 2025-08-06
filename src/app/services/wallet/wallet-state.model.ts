import { WalletPosition } from './wallet-position.model';

export interface WalletState {
  usdt: number; // available balance
  positions: WalletPosition[];
  equity: number; // usdt + PnL from open positions
  pnlHistory: number[]; // for plotting PnL over time
}
