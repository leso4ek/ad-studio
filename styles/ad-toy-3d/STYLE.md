# Toy 3D / 玩具3D — Style Prompt

Made from a blank page; techniques from brick-toy in Lemo-Opuscar (borrows: glass-product, white-model). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
The story plays on a shallow tabletop stage: the same characters, products and rooms become rounded matte solids (spheres, rounded boxes, capsules, bevelled extrusions) like soft vinyl toys under a studio light. Friendly, premium-playful.

It is **not** photoreal 3D or a CG film, not clay (no fingerprints or squash), not low-poly (everything is smooth and rounded).

## 2. Materials & rendering
MeshPhysicalMaterial, roughness 0.62, sheen 0.4, light clearcoat; RoomEnvironment reflections at 45 %; hemisphere + key (PCF soft shadows) + cool rim; ACES tone mapping. Places become relief slabs at the back and a real floor box; 2D depth below the floor line maps to distance from the camera.

## 3. Colour logic
Pastels with one saturated accent; product colours exact; dusk warms, night blues.

## 4. Type & subtitles
Baloo 2 800 with a dark extruded side (stacked offsets) and outline; call to action on a coral pill; captions on a dark rounded pill.

## 5. Motion quality
Full 24 fps; the kit's eases; characters blink and lip-flap on their lines.

## 6. Camera grammar
A slightly high camera (looking down at the stage), slow pushes via zoom; transitions iris or cut.

## 7. Sound palette
Soft pops on cuts, "warm" or "bouncy" music. All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The product lit by a warm point light at the reveal; tiny contact shadows that make it feel like a real tabletop.

## 9. Pitfalls of the medium
Software WebGL (no GPU) renders slowly; render on the user's NVIDIA PC. Face decals float slightly in front of heads, so keep faces frontal.

## 10. Engine
`studio/kit/styles/ad-toy-3d.js` (three.js via the library's import map). Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Any place; tabletop openings with the camera rising; endings with the product on a turntable. Story, cast, places, pacing and copy are free in every ad.
