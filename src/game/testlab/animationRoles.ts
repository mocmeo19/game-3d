/** What a library clip is for: a body state (idle … climb) or an action played through once (stab … throw). */
export type MixRole = 'idle' | 'walk' | 'run' | 'runback' | 'runleft' | 'jump' | 'crouch' | 'crouchwalk' | 'crawl' | 'proneidle' | 'sit' | 'lie' | 'roll' | 'vault' | 'climb' | 'stab' | 'slash' | 'fire' | 'reload' | 'throw' | 'throwrun' | 'throwcrouch';
/** The weapon a clip was made for (null: for a character with empty hands). */
export type MixCtx = 'rifle' | 'knife' | 'sword' | null;
export const ROLE_LABEL: Record<MixRole, string> = {
  idle: 'Đứng yên', walk: 'Đi', run: 'Chạy', runback: 'Chạy lùi', runleft: 'Chạy ngang', jump: 'Nhảy', crouch: 'Ngồi xổm', crouchwalk: 'Đi khom', crawl: 'Bò', proneidle: 'Nằm sấp',
  sit: 'Ngồi', lie: 'Nằm ngửa', roll: 'Lăn', vault: 'Vượt', climb: 'Leo', stab: 'Đâm dao', slash: 'Chém dao', fire: 'Bắn', reload: 'Nạp đạn', throw: 'Ném lựu đạn', throwrun: 'Ném lựu đạn khi chạy', throwcrouch: 'Ném lựu đạn khi ngồi xổm'
};
export const CTX_LABEL: Record<Exclude<MixCtx, null>, string> = { rifle: 'cầm súng', knife: 'cầm dao', sword: 'cầm kiếm' };
