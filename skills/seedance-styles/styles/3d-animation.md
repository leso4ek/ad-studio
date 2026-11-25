# 3D Animation (3D and stop-motion)
<!-- generated from studio/styles/catalog/3d-animation.json by studio/bin/catalog.mjs; edit the JSON -->

**Looks like:** modelled, rounded forms with appealing stylised proportions; smooth surfaces with soft subsurface skin and clean materials; dimensional depth with soft depth of field; volumetric light, warm bounce and clear rim light.
**Best for:** character-led family stories, products shown in true shape and material, warm, emotional turns, mascots with personality. **Products:** almost any physical product, especially bottles, packaging, toys, devices and food; warm, family-friendly, optimistic brands.

## STYLE block (paste verbatim into every shot prompt and every sheet prompt)
Stylised 3D animated feature look: characters are modelled with rounded, appealing proportions, slightly large heads and eyes, simplified hands and soft sculpted hair masses; skin has soft subsurface scattering, fabrics show gentle fibre texture, glass and plastic read as clean physical materials; dimensional depth with a soft depth of field; warm key light, cool fill, a clear rim light separating each figure, warm bounce light from surfaces and visible volumetric light shafts through windows; rich but controlled colour; global illumination and soft contact shadows ground everything.

## Rendering
- Line: no outlines: forms read by modelling, rim light and shadow
- Shading: physically based shading with subsurface skin, soft ambient occlusion and contact shadows
- Colour: rich, warm, harmonious colour script per scene; saturated accents on characters; product colours and materials exact
- Texture: subtle surface detail: fabric weave, wood grain, slight skin pores smoothed away; clean, never gritty
- Lighting: warm key, cool fill, rim light, bounce light and volumetric shafts; soft depth of field

## MOTION block
Full character animation at 24 fps on ones: clear anticipation, follow-through and overlapping action in hair and clothes, gentle squash and stretch on faces, appealing arcs; weight and timing exaggerated a little past real life; eyes and brows carry the acting.

## CAMERA habits
Virtual-camera grammar used with restraint: a slow dolly or crane, a gentle push-in on emotion, rack focus between product and face, a low-angle wide for scale; physically plausible moves, no impossible spins.

## Avoid (name these instances only when the shot is at risk)
- photoreal humans with real skin pores
- uncanny realistic eyes on stylised faces
- glossy plastic-toy skin
- faces changing shape between shots
- printed fake text on packaging and signs

## Element sheets for consistency
Each character sheet is a 3D turnaround render (front, three-quarter, side, back) in neutral grey studio light, plus two expressions; places get a wide and a reverse render in the scene's lighting; the product is a clean 3D render with exact shape, materials and label colours, ideally from our own Blender model.

## Where Seedance goes wrong in this style
Seedance holds this style well, but faces drift between shots (eye spacing, nose shape, hair volume); send the turnaround in every shot. It can push toward photorealism in close-ups; repeat 'stylised 3D animated, rounded proportions'. Labels warp on rotating products; keep the label toward the lens and cut in the real packshot if needed.

## Models
Sheets and places: `bytedance-seed/seedream-5-5` · video: `bytedance/seedance-2.5` (draft on Flash 480p, final on 2.5 720p with the same prompt, references and seed).

## Example still (our own generation)
Prompt: Stylised 3D animated still: a woman in her thirties with a dark sculpted bun and an orange knit top, rounded appealing proportions and expressive eyes, holds a small green glass bottle with a yellow cap whose glass catches warm light; a sunny modelled kitchen with soft depth of field and volumetric light shafts through the window, a droopy fern on the windowsill, warm key, cool fill, a clear rim light, soft contact shadows on the counter. Vertical 9:16. No text.

## Sources (look, don't copy)
- [Kling AI · Cartoon Styles for AI (3D Animation Style)](https://kling.ai/blog/cartoon-styles-for-ai)
