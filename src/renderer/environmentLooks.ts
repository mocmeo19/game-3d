import type { EnvironmentType } from '../types/character';

interface EnvLook {
  /** Ground colour of the painting, for the gradient shown while it loads. */
  floor: string;
  /** Average sky colour of the painting (clear colour behind everything). */
  sky: number;
  /** Height of the painting's horizon above its bottom edge (fraction). */
  horizon: number;
  ambient: [number, number];
  key: [number, number];
  fill: [number, number];
  rim: [number, number];
  shadow: number;
  particles?: { count: number; color: number; size: number; motion: 'up' | 'fast_up' | 'down_drift' | 'float' };
}

export const LOOKS: Record<EnvironmentType, EnvLook> = {
  lanterns: {
    floor: '#2a2220',
    sky: 0x000000, horizon: 0.5,
    ambient: [0x3a2a28, 0.55], key: [0xffd2a0, 1.5], fill: [0x6a3a30, 0.45], rim: [0xff8a4a, 2.2],
    shadow: 0.55,
    particles: { count: 60, color: 0xffb070, size: 0.02, motion: 'up' }
  },
  demon_slayer: {
    floor: '#56516b',
    sky: 0x2b3070, horizon: 0.5,
    ambient: [0x8f93d6, 1.15], key: [0xd6dcff, 2.2], fill: [0x9a7be0, 0.85], rim: [0xffb066, 1.9],
    shadow: 0.45,
    particles: { count: 85, color: 0xcfb8ff, size: 0.025, motion: 'down_drift' }
  },
  japan: {
    floor: '#b4a592',
    sky: 0xe9b9a0, horizon: 0.5,
    ambient: [0xe6d3cf, 1.2], key: [0xffd9b0, 2.5], fill: [0xf3c3d0, 0.8], rim: [0xffb38a, 2.0],
    shadow: 0.35,
    particles: { count: 70, color: 0xffc9dc, size: 0.025, motion: 'down_drift' }
  },
  cultivation: {
    floor: '#8fb3a6',
    sky: 0xa6d9d2, horizon: 0.5,
    ambient: [0xcfeee6, 1.2], key: [0xfff0c8, 2.4], fill: [0x9fe0ff, 0.9], rim: [0xffd98a, 2.0],
    shadow: 0.35,
    particles: { count: 80, color: 0xbffff0, size: 0.03, motion: 'float' }
  },
  celestial: {
    floor: '#e8e4da',
    sky: 0xcfd9ee, horizon: 0.5,
    ambient: [0xeaf0ff, 1.3], key: [0xfff4d6, 2.6], fill: [0xbfd8ff, 0.9], rim: [0xffe7a8, 2.0],
    shadow: 0.3,
    particles: { count: 70, color: 0xfff2b0, size: 0.03, motion: 'up' }
  },
  demon_realm: {
    floor: '#221c1b',
    sky: 0x4a1812, horizon: 0.5,
    ambient: [0x5a1c14, 1.2], key: [0xff7a45, 2.4], fill: [0x7d6b9a, 0.5], rim: [0xff4a1f, 3.0],
    shadow: 0.55,
    particles: { count: 150, color: 0xff5a1a, size: 0.045, motion: 'fast_up' }
  },
  desert: {
    floor: '#c9a877',
    sky: 0xd9a86a, horizon: 0.5,
    ambient: [0xf1d9b0, 1.2], key: [0xffe0a8, 2.7], fill: [0x9fc8e8, 0.7], rim: [0xffc070, 2.0],
    shadow: 0.4,
    particles: { count: 90, color: 0xf0d8a8, size: 0.02, motion: 'float' }
  },
  military: {
    floor: '#8b8f91',
    sky: 0x55637a, horizon: 0.5,
    ambient: [0xaebdd0, 1.15], key: [0xdbe6f5, 2.2], fill: [0x8fa6c4, 0.8], rim: [0xffb070, 1.6],
    shadow: 0.45
  },
  bamboo: {
    floor: '#2c4a3a',
    sky: 0x04100e, horizon: 0.5,
    ambient: [0x3a6a58, 0.9], key: [0xd8fff0, 1.7], fill: [0x4a8a78, 0.6], rim: [0xa8ffe0, 2.0],
    shadow: 0.5
  },
  snow: {
    floor: '#dbe6f2',
    sky: 0x0a1630, horizon: 0.5,
    ambient: [0x9fb8e0, 1.1], key: [0xe6f0ff, 2.0], fill: [0x7da0e0, 0.8], rim: [0x9fffd8, 1.8],
    shadow: 0.35,
    particles: { count: 160, color: 0xffffff, size: 0.03, motion: 'down_drift' }
  },
  neon: {
    floor: '#16161f',
    sky: 0x08060f, horizon: 0.5,
    ambient: [0x3a2a5a, 0.8], key: [0xfff0ff, 1.5], fill: [0x2fe0ff, 0.9], rim: [0xff2fb0, 2.8],
    shadow: 0.6
  },
  lotus: {
    floor: '#2a5a5a',
    sky: 0x040f1a, horizon: 0.5,
    ambient: [0x3a6a88, 0.9], key: [0xfff0d8, 1.7], fill: [0x6aa8d8, 0.7], rim: [0xff9ac8, 2.0],
    shadow: 0.5
  },
  crystal: {
    floor: '#2a2040',
    sky: 0x06030c, horizon: 0.5,
    ambient: [0x4a3a7a, 0.9], key: [0xf0e8ff, 1.5], fill: [0x35e0ff, 0.8], rim: [0xff4fd0, 2.6],
    shadow: 0.55,
    particles: { count: 60, color: 0xd8c8ff, size: 0.025, motion: 'up' }
  },
  misty_dusk: {
    floor: '#4a4650',
    sky: 0x8e7f90, horizon: 0.5,
    ambient: [0x8a7fa0, 1.0], key: [0xffc8a0, 1.9], fill: [0x7f8fc0, 0.7], rim: [0xff9a6a, 2.2],
    shadow: 0.45
  },
  pubg_aircraft: {
    floor: '#55564c',
    sky: 0x827e70, horizon: 0.5,
    ambient: [0xc2c5bf, 1.0], key: [0xffe0b0, 2.0], fill: [0x96abc2, 0.7], rim: [0xffc887, 2.2],
    shadow: 0.5
  },
  pubg_airbase: {
    floor: '#77766c',
    sky: 0xa79a83, horizon: 0.5,
    ambient: [0xd6cdbb, 1.1], key: [0xffd6a0, 2.3], fill: [0x9aafc5, 0.8], rim: [0xffb76b, 2.0],
    shadow: 0.45
  },
  survival_lobby: {
    floor: '#6b6c61',
    sky: 0x8c969b, horizon: 0.5,
    ambient: [0xc5cbd0, 1.1], key: [0xffe0b5, 2.1], fill: [0x9eb7ce, 0.8], rim: [0xffce94, 1.8],
    shadow: 0.45
  },
  pubg_containers: {
    floor: '#626e74',
    sky: 0x718797, horizon: 0.5,
    ambient: [0xb2cad8, 1.1], key: [0xd9eaf2, 2.0], fill: [0x85a6bd, 0.8], rim: [0xffc18a, 1.5],
    shadow: 0.4
  },
  warzone: {
    floor: '#5d544a',
    sky: 0x3a2a26, horizon: 0.5,
    ambient: [0x8a6a5a, 1.1], key: [0xffb070, 2.3], fill: [0x7b7f8f, 0.6], rim: [0xff6a2a, 2.8],
    shadow: 0.5,
    particles: { count: 110, color: 0xff7a2a, size: 0.03, motion: 'up' }
  }
};

