# PUBG-inspired lobby backgrounds

Generated with the built-in `image_gen` tool using the user's reference for military lobby mood and composition. These are original empty environments for the existing character renderer.

The tool returned 1672 × 941 images (the requested 3840 × 2160 was not delivered). Runtime assets preserve that native resolution as JPEG quality 88; picker thumbnails are central crops resized to 320 × 240 at quality 85. No upscaling is applied.

Select these scenes in **Nền và camera**. Scene lighting is configured in `src/renderer/environmentLooks.ts`; the existing on-demand backdrop loader handles these images.

## pubg_aircraft

- Background: `flat/pubg_aircraft.jpg`
- Thumbnail: `thumbs/pubg_aircraft.jpg`

Prompt:

> Use case: stylized-concept. Asset type: wide 16:9 game character lobby background, landscape 3840x2160. Primary request: PUBG-inspired realistic military cargo airplane interior, viewed from inside looking out through open rear ramp toward golden cloudy sunset. Reference mood: dark ribbed olive fuselage walls, exposed rails, dim red side lights, symmetrical perspective, realistic metallic floor extending across foreground, bright soft sky at rear. Composition: eye-level camera centered along fuselage, horizon exactly halfway up image, ultra-wide rectilinear 100 degree field of view, large empty central standing area for a separately rendered full-body character. Detailed cinematic physically based game environment, subdued olive charcoal and warm gold, clean readable center. NO people, characters, text, logos, interface, watermark, circle podium or weapons in foreground. Single complete background image, not a collage.

## pubg_airbase

- Background: `flat/pubg_airbase.jpg`
- Thumbnail: `thumbs/pubg_airbase.jpg`

Prompt:

> Use case: stylized-concept. Asset type: 16:9 landscape realistic game character lobby background, 3840x2160. PUBG-inspired military airbase at sunset, seen from within a large weathered open-front aircraft hangar. Large hangar beams frame left and right, distant parked cargo aircraft on left, supply crates along far edges, runway and distant mountains. Muted olive grey steel, warm amber dusk and hazy pale sky. Cinematic AAA physically based environment, realistic textures. Rectilinear 24mm lens, level camera at 1.2 meters, horizon exactly 55 percent down from top. Empty central concrete floor filling lower half for a separately rendered character, unobstructed center with no props nearby, no circular platform. No people, characters, text, logos, interface, watermark, borders. Single complete scene.

## pubg_containers

- Background: `flat/pubg_containers.jpg`
- Thumbnail: `thumbs/pubg_containers.jpg`

Prompt:

> Use case: stylized-concept. Asset type: 16:9 landscape realistic AAA battle royale character lobby background, 3840x2160. PUBG-inspired abandoned coastal container terminal at misty blue dawn: weathered muted blue and rust red shipping containers stacked on the left and right edges, distant gantry cranes and faint mountain silhouettes, chainlink fencing at distance, soft low drifting mist. Clear empty central wet asphalt forecourt reflecting cool daylight and a few distant amber industrial lamps. Cinematic physically based videogame environment, gritty believable materials, restrained contrast, cold grey blue palette with rusty accents. Camera rectilinear 24mm lens at 1.2 metres, level, horizon exactly 55 percent down from top. Broad empty foreground lower half for separately rendered full-body character, unobstructed central silhouette space. No people, no characters, no text, no logos, no interface, no watermark, no circular podium, no nearby weapons, no collage, no borders.

