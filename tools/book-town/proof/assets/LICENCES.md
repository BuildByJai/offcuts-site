# Asset licences — Book Town graphics proof

Everything in `tools/book-town/proof/assets/` is CC0 (public domain) unless noted. Sources and processing are listed so each file can be traced back.

## Libraries (loaded from jsDelivr, not stored here)

| Library | Version | Licence |
|---|---|---|
| three.js (`three.webgpu.js` + addons) | 0.170.0 | MIT |
| Rapier physics (`@dimforge/rapier3d-compat`) | 0.14.0 | Apache-2.0 |

## HDRIs (`assets/hdri/`) — Poly Haven, CC0

Downloaded at 1K `.hdr`, used as the environment map and sky.

| File | Source |
|---|---|
| `autumn_field_puresky_1k.hdr` | https://polyhaven.com/a/autumn_field_puresky |
| `kloofendal_48d_partly_cloudy_puresky_1k.hdr` | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| `kloppenheim_06_puresky_1k.hdr` | https://polyhaven.com/a/kloppenheim_06_puresky |

## PBR texture sets (`assets/textures/`)

Each set is three WebP files: `<name>_col` (albedo), `<name>_nrm` (OpenGL normal), `<name>_arm` (R = ambient occlusion, G = roughness, B = metalness). Resized to 1K (2K for the set marked ²ᴷ) and converted with Pillow.

### Poly Haven — CC0 (https://polyhaven.com/textures)

| Set | Source |
|---|---|
| `bark_brown_02` | https://polyhaven.com/a/bark_brown_02 |
| `beige_wall_001` | https://polyhaven.com/a/beige_wall_001 |
| `clay_roof_tiles_02` | https://polyhaven.com/a/clay_roof_tiles_02 |
| `cobblestone_floor_08` | https://polyhaven.com/a/cobblestone_floor_08 |
| `grey_roof_tiles_02` | https://polyhaven.com/a/grey_roof_tiles_02 |
| `painted_plaster_wall` | https://polyhaven.com/a/painted_plaster_wall |
| `patterned_paving_02` ²ᴷ | https://polyhaven.com/a/patterned_paving_02 |
| `precast_stone_paving` | https://polyhaven.com/a/precast_stone_paving |
| `rectangular_paving` | https://polyhaven.com/a/rectangular_paving |
| `red_brick` | https://polyhaven.com/a/red_brick |
| `roof_slates_02` | https://polyhaven.com/a/roof_slates_02 |
| `weathered_brown_planks` | https://polyhaven.com/a/weathered_brown_planks |
| `white_plaster_02` | https://polyhaven.com/a/white_plaster_02 |

### ambientCG — CC0 (https://ambientcg.com)

| Set | Source |
|---|---|
| `Bricks059` | https://ambientcg.com/a/Bricks059 |
| `Bricks075A` | https://ambientcg.com/a/Bricks075A |
| `Fabric086` | https://ambientcg.com/a/Fabric086 |
| `Grass004` | https://ambientcg.com/a/Grass004 |
| `PaintedPlaster012` | https://ambientcg.com/a/PaintedPlaster012 |
| `PaintedPlaster017` | https://ambientcg.com/a/PaintedPlaster017 |

## Models (`assets/models/`) — Poly Haven, CC0 (https://polyhaven.com/models)

Downloaded as 1K glTF, converted to GLB with meshopt compression and WebP textures (gltf-transform).

| File | Source |
|---|---|
| `Barrel_01.glb` | https://polyhaven.com/a/Barrel_01 |
| `CoffeeCart_01.glb` | https://polyhaven.com/a/CoffeeCart_01 |
| `Lantern_01.glb` | https://polyhaven.com/a/Lantern_01 |
| `celandine_01.glb` | https://polyhaven.com/a/celandine_01 |
| `concrete_cat_statue.glb` | https://polyhaven.com/a/concrete_cat_statue |
| `dandelion_01.glb` | https://polyhaven.com/a/dandelion_01 |
| `flower_heliophila.glb` | https://polyhaven.com/a/flower_heliophila |
| `grass_medium_01.glb` | https://polyhaven.com/a/grass_medium_01 |
| `metal_trash_can.glb` | https://polyhaven.com/a/metal_trash_can |
| `outdoor_table_chair_set_01.glb` | https://polyhaven.com/a/outdoor_table_chair_set_01 |
| `potted_plant_02.glb` | https://polyhaven.com/a/potted_plant_02 |
| `potted_plant_04.glb` | https://polyhaven.com/a/potted_plant_04 |
| `shrub_01.glb` | https://polyhaven.com/a/shrub_01 |
| `shrub_04.glb` | https://polyhaven.com/a/shrub_04 |
| `shrub_sorrel_01.glb` | https://polyhaven.com/a/shrub_sorrel_01 |
| `street_lamp_01.glb` | https://polyhaven.com/a/street_lamp_01 |
| `wooden_crate_01.glb` | https://polyhaven.com/a/wooden_crate_01 |
| `wooden_picnic_table.glb` | https://polyhaven.com/a/wooden_picnic_table |

Trees, hedges and grass blades are built in code (`js/trees.js`, `js/grass.js`) using the texture sets above and a leaf sprite painted at load time.

## Character (`assets/character/`)

| File | Source | Licence |
|---|---|---|
| `woman.glb` | Quaternius — "Animated Woman" (https://quaternius.com/packs/animatedwoman.html), FBX converted to GLB with three.js (scaled to metres, hips drift removed so every clip plays in place), meshopt-compressed | CC0 |

The palette texture is generated at load (`js/character.js`, `paletteTexture`) so each townsperson gets their own colours. This is the placeholder until the Mixamo character set from section 9 of the brief arrives.

## Ad placeholders

`../assets/ads/placeholder-*.png` are the existing Book Town placeholder posters (made for this repo).
