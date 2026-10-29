import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { GameKind } from '../components/UI/HomeScreen';
import { assetFileName, assetLoadRatio, getAssetLoadProgress } from './assetLoadProgress';
import { GAME_LOADING_CONTENT, LOADING_TIP_INTERVAL_MS } from './gameLoadingContent';
import { LoadingProgressBar } from './LoadingProgressBar';
import { useAssetLoadProgress } from './useAssetLoadProgress';
import { useRotatingIndex } from './useRotatingIndex';

interface GameLoadingScreenProps {
  gameKind: GameKind;
  /** What is being prepared, e.g. "Đang tải nhân vật…". */
  message: string;
}

export function GameLoadingScreen({ gameKind, message }: GameLoadingScreenProps) {
  const content = GAME_LOADING_CONTENT[gameKind];
  const [baselineLoaded] = useState(() => getAssetLoadProgress().itemsLoaded);
  const progress = useAssetLoadProgress();
  const ratio = assetLoadRatio(progress, baselineLoaded);
  const tip = content.tips[useRotatingIndex(content.tips.length, LOADING_TIP_INTERVAL_MS)];
  const detail = ratio === null || !progress.lastUrl
    ? message
    : `${message} ${Math.round(ratio * 100)}% · ${assetFileName(progress.lastUrl)}`;

  return (
    <div
      className="absolute inset-0 z-70 flex cursor-default font-sans flex-col items-center justify-center gap-10 overflow-hidden bg-[#060b12] px-6 text-white animate-fade-in"
      style={{ backgroundImage: `radial-gradient(ellipse at 50% 38%, ${content.glowColor}, transparent 62%)` }}
    >
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.45em] text-white/45">Đang vào game</p>
        <h1 className="mt-3 text-3xl font-bold tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-4xl">{content.title}</h1>
        <p className="mt-2 text-sm text-white/60">{content.subtitle}</p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <LoadingProgressBar ratio={ratio} label={`Tiến độ tải ${content.title}`} accentClassName={content.accentClassName} />
        <p role="status" className="truncate text-center text-xs text-white/55">{detail}</p>
      </div>

      <p key={tip} className="flex max-w-md items-start gap-2 text-center text-[13px] leading-relaxed text-white/75 animate-rise-in">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-white/50" aria-hidden />
        <span>{tip}</span>
      </p>
    </div>
  );
}
