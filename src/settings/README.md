# Configuration storage

Configuration lives in the browser's IndexedDB database `nams-battle-royal`, version 1, object store `settings`.
Inspect it in DevTools → Application → IndexedDB.

| Key | Configuration |
| --- | --- |
| `bns.render-settings.v1` | Resolution, shadows, antialiasing, frame-rate cap |
| `bns.audio.v1` | Audio levels and mute |
| `nams-battle-royal-combat-animations-v1` | Battle game combat animation slots and tuning (Settings → Chiến đấu) |
| `nams-battle-royal-gun-models-v1` | Battle game weapon models and their fit (Settings → Vũ khí) |
| `bns.performance-overlay.v1` | FPS / RAM overlay on every screen and its corner (Settings → Hiển thị) |
| `bns.gameplay.v1` | Sensitivity, invert Y, first-person FOV, starting view and aim style (home → Cài đặt) |

`ConfigurationGate` waits for `initializeConfigurations()` before mounting either application route.
This hydrates a memory cache so renderers and game constructors can read settings synchronously without storage I/O.
Save functions return promises and update the cache only after transaction completion.
Writes are serialized and snapshot their inputs to preserve the order of rapid changes.

On first use, the legacy localStorage keys are copied in one transaction.
Existing IndexedDB values take precedence. Legacy keys are removed only after the transaction commits.
Unreadable legacy JSON is left untouched. Aborted migrations preserve the original data and can be retried.
Character slots, character autosaves, and last-played game preferences retain their existing storage.

Validation tests: `node --test tests/app-settings.test.mjs`.
Browser integration tests: run Vite, install/provide Playwright, then run
`node tests/configuration-indexeddb.browser.mjs`.
Optional environment variables: `APP_URL`, `PLAYWRIGHT_MODULE`, and `PLAYWRIGHT_EXECUTABLE`.
