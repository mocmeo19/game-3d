# MPFB pipeline

The character (body, face parts, hair, clothes, skins) is generated with MPFB 2 (MakeHuman for Blender) and exported as GLB.
Assets come from the MakeHuman asset packs installed in `~/Library/Application Support/Blender/5.2/mpfb/data`
(unzip the downloaded packs into that folder; CC0 and CC-BY).

    python3 mpfb/catalog.py                                    # scan the library -> mpfb/catalog.json (slot, license, genders)
    # one base per race and gender (jin is the body all assets are fitted to; gon/lyn/yun also write a .delta.bin)
    #   body + eyes/brows/lashes/teeth/tongue -> public/models/<race>_<gender>.glb + _extra.json + .delta.bin
    for b in jin:female jin:male gon:female gon:male lyn:female lyn:male yun:female; do
      blender -b --python mpfb/build_character.py -- --race ${b%:*} --gender ${b#*:}
    done
    blender -b --python mpfb/build_assets.py -- --gender female        # every catalog asset -> public/models/assets/<id>.<gender>.glb|png
    blender -b --python mpfb/build_assets.py -- --gender male          #   (resumes; --force rebuilds, --only a,b limits)
    blender -b --python mpfb/build_skins.py                            # skin textures -> public/models/skins/*.webp
    python3 mpfb/gen_ts.py                                             # manifests -> src/constants/assets.ts, skins.ts, public/models/credits.json

* `slider_map.json` maps every app slider to MPFB targets (`<slider>_pos` / `<slider>_neg` morph targets).
* `lib.MACRO_SLIDERS` adds sliders driven by MPFB's macro sliders instead of single targets: cup size (`chestSize`), weight (`bodyFat`),
  muscle (`muscleTone`), age (`ageShift`) and race mix (`raceAsian/Caucasian/African`). Each is a shape key built as the difference
  between two humans created with different macro values.
* `lib.fit_morphs` gives an asset a shape key only for the morphs that move the body vertices the asset is bound to, so hats do not
  carry leg morphs and shoes do not carry head morphs.
* Slots: hair, eyebrows, eyelashes, beard, outfit, top, underwear_top, underwear_bottom, pants, skirt, gloves, shoes, hat, jewelry, accessory.
  After adding packs run `catalog.py`, build the new assets (`build_assets.py --only`), `build_skins.py` and `gen_ts.py`.
* `<race>_<gender>_extra.json`: morph names, per-bone joint offsets for every morph (the app moves the joints with the morphs),
  UV landmarks used to paint make-up / face markings.
* Each asset lists, per gender, the body vertices it hides (`hide`, ranges of original basemesh indices); the app removes
  those body triangles while the asset is worn.
* Hair / cloth textures are converted to neutral luminance maps (mean 0.8) so the app can recolour them by multiplying.
* Assets that fail to import are listed in `mpfb/out/failed.<gender>.json`.
* CC-BY assets require attribution: authors are written to `public/models/credits.json` and shown in the help dialog.
* Races (`build_character.py` `RACE_BODY`): MPFB macro overrides per race and gender — gon: tall proportions, heavy muscle;
  lyn: young, short-limbed proportions; yun (female only): slender, long-legged. Overall height is still set by the app
  (`RACE_SCALE` in `src/renderer/character/avatar.ts`). `<race>_<gender>.delta.bin` (float32 x/y/z per basemesh vertex, glTF axes)
  is the offset from the jin body; the app moves every clothing vertex by the blended delta of its 4 nearest jin body vertices.
