export const ENVIRONMENTS = [
  { id: 'lanterns', name: 'Đêm lồng đèn', icon: '🏮', skyColor: '#000000', groundColor: '#050505', lightColor: '#ff9a5a' },
  { id: 'bamboo', name: 'Rừng trúc đêm trăng', icon: '🎋', skyColor: '#04100e', groundColor: '#0b1a16', lightColor: '#d8fff0' },
  { id: 'snow', name: 'Núi tuyết cực quang', icon: '❄️', skyColor: '#0a1630', groundColor: '#dfe9f5', lightColor: '#e6f0ff' },
  { id: 'neon', name: 'Phố neon mưa đêm', icon: '🌃', skyColor: '#08060f', groundColor: '#07070d', lightColor: '#ff2fb0' },
  { id: 'lotus', name: 'Hồ sen đêm', icon: '🪷', skyColor: '#040f1a', groundColor: '#07202c', lightColor: '#ff9ac8' },
  { id: 'crystal', name: 'Hang tinh thể', icon: '💎', skyColor: '#06030c', groundColor: '#120c1e', lightColor: '#9a6bff' },
  { id: 'demon_slayer', name: 'Thanh gươm diệt quỷ', icon: '🗡️', skyColor: '#2b3070', groundColor: '#56516b', lightColor: '#d6dcff' },
  { id: 'japan', name: 'Nhật Bản', icon: '🏯', skyColor: '#e9b9a0', groundColor: '#b4a592', lightColor: '#ffd9b0' },
  { id: 'cultivation', name: 'Tu tiên', icon: '🏔️', skyColor: '#a6d9d2', groundColor: '#8fb3a6', lightColor: '#fff0c8' },
  { id: 'celestial', name: 'Thiên giới', icon: '☁️', skyColor: '#cfd9ee', groundColor: '#e8e4da', lightColor: '#fff4d6' },
  { id: 'demon_realm', name: 'Ác ma', icon: '😈', skyColor: '#4a1812', groundColor: '#221c1b', lightColor: '#ff7a45' },
  { id: 'desert', name: 'Sa mạc', icon: '🏜️', skyColor: '#d9a86a', groundColor: '#c9a877', lightColor: '#ffe0a8' },
  { id: 'pubg_aircraft', name: 'PUBG · Khoang máy bay', icon: '✈️', skyColor: '#827e70', groundColor: '#55564c', lightColor: '#ffe0b0' },
  { id: 'pubg_airbase', name: 'PUBG · Căn cứ không quân', icon: '🛫', skyColor: '#a79a83', groundColor: '#77766c', lightColor: '#ffd6a0' },
  { id: 'pubg_containers', name: 'PUBG · Bãi container', icon: '🚢', skyColor: '#718797', groundColor: '#626e74', lightColor: '#d9eaf2' },
  { id: 'military', name: 'Quân đội', icon: '🪖', skyColor: '#55637a', groundColor: '#8b8f91', lightColor: '#dbe6f5' },
  { id: 'warzone', name: 'Chiến tranh', icon: '💥', skyColor: '#3a2a26', groundColor: '#5d544a', lightColor: '#ffb070' }
];

/** Backdrop ids of earlier versions, mapped to the closest current theme so saved characters keep a valid scene. */
export const LEGACY_ENVIRONMENTS: Record<string, string> = {
  wisteria_night: 'demon_slayer', misty_woods: 'demon_slayer', sakura_garden: 'japan', stone_gate: 'japan', blue_dusk: 'cultivation',
  cloud_temple: 'celestial', heavens_reach: 'celestial', studio: 'celestial', dragons_fall: 'demon_realm'
};

