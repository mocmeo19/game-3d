import { useEffect, useState } from 'react';
import { useAssetLoadProgress } from '../loading/useAssetLoadProgress';

/** Long enough for the logo animation to read as intentional, short enough not to annoy. */
const SPLASH_MIN_DURATION_MS = 1800;
/** Never keep the player behind the splash if a model hangs; the screens show their own loaders. */
const SPLASH_MAX_DURATION_MS = 10000;
/**
 * The first screen starts loading its 3D models only after it mounts, a moment after its code
 * arrives; waiting for the loader to stay idle this long keeps the splash up through that gap.
 */
const ASSET_IDLE_GRACE_MS = 400;

export interface SplashReadiness {
  isPageModuleReady: boolean;
  isReady: boolean;
}

export function useSplashReady(pageModule: Promise<unknown>): SplashReadiness {
  const [isPageModuleReady, setIsPageModuleReady] = useState(false);
  const [hasMinDurationPassed, setHasMinDurationPassed] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [areAssetsSettled, setAreAssetsSettled] = useState(false);
  const { isLoading: areAssetsLoading } = useAssetLoadProgress();

  useEffect(() => {
    let active = true;
    const markReady = () => { if (active) setIsPageModuleReady(true); };
    // A failed chunk still ends the splash so the page's own error UI can surface it.
    pageModule.then(markReady, markReady);
    return () => { active = false; };
  }, [pageModule]);

  useEffect(() => {
    const minId = window.setTimeout(() => setHasMinDurationPassed(true), SPLASH_MIN_DURATION_MS);
    const maxId = window.setTimeout(() => setHasTimedOut(true), SPLASH_MAX_DURATION_MS);
    return () => {
      window.clearTimeout(minId);
      window.clearTimeout(maxId);
    };
  }, []);

  useEffect(() => {
    if (!isPageModuleReady || !hasMinDurationPassed || areAssetsLoading) return;
    const id = window.setTimeout(() => setAreAssetsSettled(true), ASSET_IDLE_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [isPageModuleReady, hasMinDurationPassed, areAssetsLoading]);

  return { isPageModuleReady, isReady: hasTimedOut || areAssetsSettled };
}
