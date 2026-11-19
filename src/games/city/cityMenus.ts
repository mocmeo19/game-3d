import type { GameMenus } from '../core/engine/matchContext';

/** The open world's screens that free the mouse; one at a time. */
export type CityMenu = 'none' | 'map' | 'wheel' | 'shop';

export class CityMenus implements GameMenus {
  open: CityMenu = 'none';

  get anyOpen() {
    return this.open !== 'none';
  }

  closeAll() {
    this.open = 'none';
  }
}
