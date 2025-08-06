export interface StrategyConfig {
  timeframe: string;
  minScore: number;
  weights: {
    rsi: number;
    macd: number;
    volumeSpike: number;
    pattern: number;
    momentum: number;
  };
  enabledIndicators: string[];
  directionFilter?: 'long-only' | 'short-only';
}
export interface AnalysisSignal {
  action: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number; // 0–100
  reasons: string[];
  timestamp: number;
  timeframe: string;
}

export function analyzeData(
  indicators: any,
  patterns: string[],
  config: StrategyConfig,
  timeframe: string
): AnalysisSignal {
  let score = 0;
  const reasons: string[] = [];

  if (
    config.enabledIndicators.includes('rsi') &&
    indicators.rsi !== undefined
  ) {
    if (indicators.rsi < 30) {
      score += config.weights.rsi;
      reasons.push('RSI Oversold');
    }
    if (indicators.rsi > 70) {
      score -= config.weights.rsi;
      reasons.push('RSI Overbought');
    }
  }

  if (
    config.enabledIndicators.includes('macd') &&
    indicators.macdHist !== undefined
  ) {
    if (indicators.macdHist > 0) {
      score += config.weights.macd;
      reasons.push('MACD Bullish Crossover');
    } else {
      score -= config.weights.macd;
      reasons.push('MACD Bearish Crossover');
    }
  }

  if (
    config.enabledIndicators.includes('volumeSpike') &&
    indicators.volumeSpike
  ) {
    score += config.weights.volumeSpike;
    reasons.push('Volume Spike Detected');
  }

  if (config.enabledIndicators.includes('pattern')) {
    for (const pattern of patterns) {
      if (pattern.toLowerCase().includes('bullish')) {
        score += config.weights.pattern;
        reasons.push(`Pattern: ${pattern}`);
      }
      if (pattern.toLowerCase().includes('bearish')) {
        score -= config.weights.pattern;
        reasons.push(`Pattern: ${pattern}`);
      }
    }
  }

  const finalAction =
    score >= config.minScore
      ? 'BUY'
      : score <= -config.minScore
      ? 'SELL'
      : 'NEUTRAL';

  return {
    action:
      config.directionFilter === 'long-only' && finalAction === 'SELL'
        ? 'NEUTRAL'
        : config.directionFilter === 'short-only' && finalAction === 'BUY'
        ? 'NEUTRAL'
        : finalAction,
    score,
    reasons,
    timestamp: Date.now(),
    timeframe,
  };
}
