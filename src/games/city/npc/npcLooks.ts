import type { BodyLook } from '../../core/models';

/** Clothes and faces of the city's people (procedural bodies, see BotBody). */

const SKINS = [0xf1c9a5, 0xd9a77f, 0xc08a62, 0x9a6845, 0x6e4a32] as const;
const TOPS = [0xd9d4c7, 0x2b4d7a, 0x8a2f2f, 0x3e6b45, 0xe0a63a, 0x5b4a7a, 0x1f1f22, 0xc7553a, 0x7fa3c4] as const;
const TROUSERS = [0x2a2f3a, 0x4a4036, 0x1d1d20, 0x6b6f75, 0x324a66] as const;
const CAPS = [0x1f3550, 0xa83232, 0x2b2b2b, 0xe6e0d0] as const;

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length)] ?? list[0];

export function civilianLook(random: () => number): BodyLook {
  return {
    cloth: pick(TROUSERS, random),
    top: pick(TOPS, random),
    skin: pick(SKINS, random),
    head: random() < 0.25 ? 'cap' : 'bare',
    headColor: pick(CAPS, random),
  };
}

export const policeLook = (random: () => number): BodyLook => ({ cloth: 0x1b2433, top: 0x24324a, skin: pick(SKINS, random), head: 'cap', headColor: 0x141c2a });

/** Heavily armed police from three stars up. */
export const swatLook = (random: () => number): BodyLook => ({ cloth: 0x1a1c1f, top: 0x2b2f35, skin: pick(SKINS, random), head: 'helmet', headColor: 0x16181b });

/** The Rắn Lục gang wears green bandanas over dark clothes. */
export const gangLook = (random: () => number): BodyLook => ({ cloth: 0x202322, top: random() < 0.5 ? 0x2f5a35 : 0x1d1f1e, skin: pick(SKINS, random), head: random() < 0.5 ? 'balaclava' : 'cap', headColor: 0x2f7a3a });

export const allyLook = (random: () => number): BodyLook => ({ cloth: 0x3a3530, top: 0x6b4f2e, skin: pick(SKINS, random), head: 'bare' });
