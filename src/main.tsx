import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigurationGate } from './settings/ConfigurationGate';
import { PerformanceOverlay } from './performance/PerformanceOverlay';
import { SplashScreen } from './splash/SplashScreen';
import './index.css';

const loadApp = () => import('./App').then((module) => ({ default: module.App }));
const loadSettingsPage = () => import('./settings/SettingsPage').then((module) => ({ default: module.SettingsPage }));
const loadUvEditorPage = () => import('./uvEditor/UvEditorPage').then((module) => ({ default: module.UvEditorPage }));
const path = window.location.pathname;
const loadPage = /^\/settings\/?$/.test(path) ? loadSettingsPage : /^\/uv-editor\/?$/.test(path) ? loadUvEditorPage : loadApp;
// Start fetching the page now so it downloads while the splash and configuration load.
const pageModule = loadPage();
const Page = lazy(() => pageModule);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigurationGate>
      <Suspense fallback={<div className="grid h-dvh place-items-center bg-[#09131e] text-white">Đang mở ứng dụng…</div>}>
        <Page />
      </Suspense>
      <PerformanceOverlay />
    </ConfigurationGate>
    <SplashScreen pageModule={pageModule} />
  </React.StrictMode>
);
