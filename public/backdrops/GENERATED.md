# Backdrops

One wide painting per theme, generated with the nano-banana-2 MCP (Gemini image, 4K, 16:9 → 5504 x 3072) as an ordinary
rectilinear 24mm-lens picture (not a panorama). The creator camera never orbits: the character turns instead.

- `flat/<id>.jpg` — the painting resized to 4096 x 2286 (quality 88). `src/renderer/EnvironmentScene.ts` samples it by view direction on a
  ground-projected skybox (`PAINTING_HFOV` = 90°, `PAINTING_HORIZON` = 0.55), so the painted floor continues into the 3D terrace.
- `thumbs/<id>.jpg` — 320 x 240 picker thumbnail (central 4:3 crop), used in `src/components/UI/LeftPanels.tsx`.

Re-create a backdrop: generate with the prompt below, resize the result to 4096 wide for `flat/`, crop the centre 4:3 and resize to
320 x 240 for `thumbs/` (Pillow: `Image.resize(..., Image.LANCZOS)`). Each prompt is "Wide cinematic concept-art background for a 3D
fantasy MMORPG character creator. Scene: …" plus the common ending:

> Camera: rectilinear 24mm wide lens at eye height 1.2 metres, straight lines stay straight, NO fisheye, NO panorama distortion, level
> camera, horizon line exactly at 55 percent from the top of the image. Foreground: several metres of clear, empty, flat <floor> in the
> lower half of the frame, centred, as the open area where a character will stand. No people, no characters, no text, no logos, no
> watermark, no frame, no borders.

| id | name | scene |
|---|---|---|
| demon_slayer | Thanh gươm diệt quỷ | Taisho-era mountain sanctuary of a demon-slaying sword corps at night: blooming wisteria forest, stone courtyard, vermilion torii path, amber lanterns, katana rack, full moon. Floor: stone courtyard. |
| japan | Nhật Bản | Kyoto temple courtyard at golden hour: cherry blossoms, five-storey pagoda, temple hall, stone lanterns, red torii, Mount Fuji. Floor: raked gravel and paving. |
| cultivation | Tu tiên | Xianxia immortal sect on a mountain peak: floating karst mountains, waterfalls, cliff pavilions, spirit-qi mist, flying swords, twisted pines. Floor: carved jade plaza. |
| celestial | Thiên giới | White-marble and gold sanctuary above a sea of clouds: fluted columns, arches, grand stairs, floating islands, divine light rays. Floor: polished marble with gold inlay. |
| demon_realm | Ác ma | Black obsidian fortress with spires and horned gates, lava rivers, blood-red sky with a dark eclipse, glowing runes. Floor: cracked basalt with faint runes. |
| desert | Sa mạc | Desert at late afternoon: golden dunes, sandstone canyon cliffs, ruined sun temple, hazy low sun, blown sand. Floor: cracked sandstone flagstones. |
| military | Quân đội | Modern army forward base at dawn: tents, sandbags, hangar, radar mast, helicopter and trucks far away, low mist. Floor: concrete apron with yellow stripes. |
| warzone | Chiến tranh | War-torn city at dusk: shattered high-rises, burnt tanks, trenches and barbed wire, smoke columns, orange fire glow. Floor: packed dirt and broken asphalt. |

Characters saved with an earlier backdrop id are mapped to the nearest theme by `LEGACY_ENVIRONMENTS` in `src/constants/presets.ts`
(applied in `sanitizeState`, `src/lib/persistence.ts`).

`lanterns` (Đêm lồng đèn) is not a painting: it is built in 3D by `buildLanterns` in `src/renderer/EnvironmentScene.ts` (black glossy floor, swaying paper lanterns, warm point lights). Its thumbnail is a screenshot of that scene.
