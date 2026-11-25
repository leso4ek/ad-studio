# Voxel Stage / 体素舞台 — Style Prompt

Built on our own `ad-toy-3d` (three.js in the Ad Studio kit); the word-at-a-time captions borrow the pacing idea of text-flash-cuts in Lemo-Opuscar. An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible). The look is the grammar of short 3D skit videos; no creator, character or show is named or copied.

## 1. Essence, and what it is not
Two box-built characters talk a problem through on a small stage that floats in a dark indigo void. Everything is made of bevelled blocks: people, a talking plant, the product, the props, a few set pieces. It feels like a toy skit filmed with a real lens: shallow focus, light dots in the dark, a key and a rim.

It is **not** a block-building game (no textured pixel skins, no world terrain), not low-poly (no triangles or facets, only boxes), not a full room (the place is a hint of a set, never walls on all sides), and not photoreal.

## 2. Materials & rendering
Every solid is a box with a small bevel (14 % of its smallest side) and a matte plastic finish: Phong, low shininess, a faint highlight. Faces and labels are flat decals on the box front. Lighting: a warm key from front-left (it alone casts shadows, onto the floor), a cool blue rim from back-right, a weak pink rim from back-left, a lilac sky / plum ground fill. Every standing thing also gets a soft blob contact shadow. The floor is a tiled plane that fades to transparent, so it melts into the 2D backdrop: a navy gradient, a soft glow behind the stage, out-of-focus light discs (warm amber, pink, cyan, white, violet) that drift slowly, grow as the lens closes in, and shift with the camera. A vignette closes the frame.

## 3. Colour logic
The stage is always dark (navy for day, plum for dusk, deep blue for night); the colour belongs to the characters and the product. Cast and product colours come from the bible unchanged. The window glows pale blue by day, peach at dusk, dim blue with a moon block at night. Accent yellow (#FFD23F) is reserved for emphasis: the highlighted caption word, the step title, the call-to-action button, the last line of a hook.

## 4. Type & subtitles
Cards: Archivo Black, white face, a dark outline and a stepped extruded side going down-right; a two-line hook turns its last line yellow. Small lines: Inter 800 with a dark outline. Call to action: a yellow block button with a darker side. Captions: either a dark rounded plate with white Inter (default), or, with `captionMode: "words"`, one to three words at a time, big, upper-case, white with a heavy dark outline and a hard drop shadow, one emphasis word in yellow (the product name, then a number, then the longest word that isn't a filler), each chunk popping in. Word timings come from the cue's `words` when present, else the cue text is split by length.

## 5. Motion quality
Full 24 fps. Characters never freeze: a slow bob, breathing in the torso, a small head sway, blinks. The speaker's mouth cycles through four block shapes while its cue plays; the head nods a little and the arm gestures. A listener turns its head toward whoever is speaking. Plants sway; a talking plant's fronds bounce.

## 6. Camera grammar
The kit's directed camera becomes a real lens: half of each push is a dolly, half a lens change, aimed at the subject's depth so the framing matches the bible's shot size. Close-ups alternate between the two speakers; slow pushes on lines; a wide to reveal. Because the heads are wide, a close framing on a person stops where the head fills about three quarters of the frame width (a CU shows the whole face); on a talking plant, close framings centre on the face on its pot. Low and high angles also move the camera down or up.

## 7. Sound palette
Soft pops on cuts and card pops, "bouncy" or "warm" music. All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The STEP bar: with `overlay.steps` (`[{t0, t1, label, title}]`), a plate at the top of the 9:16 safe zone reads "STEP 1 · TITLE" with the title in yellow and a row of dashes that fill as the steps pass. The reveal: the product on a block pedestal under a warm point light. A cast member with `kind: "plant"` is a potted fern with a face on the pot: its fronds droop when sad, tired or annoyed and lift and spread when happy, cheering or surprised.

## 9. Pitfalls of the medium
Software WebGL (no GPU) takes about 0.6–0.8 s a frame at 1080×1920; a GPU renders it in a few milliseconds. Text cards sit over the void, so keep them clear of the face in a CU (the step bar owns y 0.14–0.20). Very small props read as a few cubes; give them scale. Hair styles: short, bob, long, bun, ponytail, curly, cap, bald.

## 10. Engine
`studio/kit/styles/ad-voxel-3d.js` (three.js via the page's import map), driven by `studio/kit/page.js` and `camera.js`. Characters, the talking plant, products and the main props (fern, watering can, capful, mug, steam, drop, sparkle, leaf, heart) have voxel builds; any other prop or product kind is voxelized from the shared 2D shapes. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Any cast (people, kids, a plant), any product kind, any place (kitchen, bedroom, office, bathroom, café, street, park, studio), any time of day, step bars or none, plate or word captions. Story, cast, places, pacing and copy are free in every ad.
