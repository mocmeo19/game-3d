import type { P2 } from '../core/agents/nav';
import type { ShopItemId } from './activities/gunShop';
import type { DialogueLine } from './story/missionTypes';
import type { ProtagonistId } from './story/protagonists';

/** What a mark on the minimap and the big map stands for. */
export type BlipKind = 'mission' | 'objective' | 'enemy' | 'target' | 'police' | 'gunShop' | 'hospital' | 'store' | 'job' | 'paint' | 'waypoint';

export interface MapBlip {
  id: string;
  kind: BlipKind;
  x: number;
  z: number;
  label: string;
  /** Initial on a story mission marker (who plays it). */
  letter?: string;
}

/** A big centred title: a mission starting, passed or failed, or the player down or arrested. */
export interface CityBanner {
  id: number;
  kind: 'mission' | 'passed' | 'failed' | 'wasted' | 'busted' | 'info';
  title: string;
  subtitle: string;
}

export interface ShopItemView {
  id: ShopItemId;
  name: string;
  detail: string;
  price: number;
  isOwned: boolean;
  canAfford: boolean;
}

export interface ProtagonistView {
  id: ProtagonistId;
  name: string;
  role: string;
  money: number;
  place: string;
  isActive: boolean;
  isUnlocked: boolean;
}

/** The open world's part of the HUD state. */
export interface CityView {
  hero: { id: ProtagonistId; name: string };
  money: number;
  wanted: { stars: number; isSearching: boolean };
  vehicle: { name: string; speedKmh: number; health: number } | null;
  /** What F does here ("F: Lên xe"), or ''. */
  prompt: string;
  /** 0..1 of something being held (robbing a till, an arrest); null when nothing is. */
  progress: { label: string; share: number } | null;
  missionTitle: string;
  objective: string;
  dialogue: DialogueLine | null;
  banner: CityBanner | null;
  menu: 'none' | 'map' | 'wheel' | 'shop';
  shop: { title: string; items: ShopItemView[] } | null;
  heroes: ProtagonistView[];
  me: { x: number; z: number; yaw: number };
  blips: MapBlip[];
  waypoint: P2 | null;
  /** GPS route to the waypoint or the mission target, simplified. */
  route: P2[];
  placeName: string;
  story: { passed: number; total: number };
  /** The world rectangle the map picture covers (m). */
  mapBounds: MapBounds;
  /** The top-down picture of the city the maps draw under their marks. */
  mapImageUrl: string;
  /** The city tiles around the player are drawn (until then, after the start or a respawn, a loading cover hides them). */
  isAreaReady: boolean;
}

export interface MapBounds {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export const EMPTY_CITY_VIEW: CityView = {
  hero: { id: 'kha', name: '' },
  money: 0,
  wanted: { stars: 0, isSearching: false },
  vehicle: null,
  prompt: '',
  progress: null,
  missionTitle: '',
  objective: '',
  dialogue: null,
  banner: null,
  menu: 'none',
  shop: null,
  heroes: [],
  me: { x: 0, z: 0, yaw: 0 },
  blips: [],
  waypoint: null,
  route: [],
  placeName: '',
  story: { passed: 0, total: 0 },
  mapBounds: { x0: 0, z0: 0, x1: 1, z1: 1 },
  mapImageUrl: '',
  isAreaReady: false,
};
