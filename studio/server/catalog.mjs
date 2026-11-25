// Ad Studio · the Seedance style catalogue (the AI-video route): one JSON per style in studio/styles/catalog/,
// validated here, and rendered into one guide per style in skills/seedance-styles/styles/<slug>.md so a prompt
// loads only the chosen style's file. Example stills are our own generations (never copied reference art).
import fs from 'fs';
import path from 'path';
import { STUDIO, REPO } from './util.mjs';
import { validate } from './validate.mjs';

export const CATALOG = path.join(STUDIO, 'styles', 'catalog');
export const FAMILIES = { 'traditional-2d': 'Traditional 2D animation', 'anime-manga': 'Anime and manga', '3d-stopmotion': '3D and stop-motion', 'comic-graphic': 'Comic and graphic art', 'digital-vector': 'Digital and vector', handcrafted: 'Handcrafted illustration', retro: 'Retro and nostalgic', experimental: 'Experimental and mixed media' };
const str = { type: 'string', minLength: 3 }, strs = (min = 1) => ({ type: 'array', items: str, minItems: min });
export const ENTRY = {
  type: 'object', required: ['slug', 'name', 'family', 'traits', 'bestFor', 'suits', 'stylePara', 'rendering', 'motion', 'camera', 'avoid', 'sheets', 'risk', 'models', 'example', 'sources'],
  properties: {
    slug: { type: 'string', pattern: '^[a-z0-9-]+$' }, name: str, family: { type: 'string', enum: Object.keys(FAMILIES) },
    traits: strs(3), bestFor: strs(2), suits: str, stylePara: { type: 'string', minLength: 200 },
    rendering: { type: 'object', required: ['line', 'shading', 'colour', 'texture', 'lighting'], properties: { line: str, shading: str, colour: str, texture: str, lighting: str } },
    motion: str, camera: str, avoid: strs(3), sheets: str, risk: str,
    models: { type: 'object', required: ['sheets', 'video'], properties: { sheets: str, video: str } },
    example: { type: 'object', required: ['prompt'], properties: { prompt: { type: 'string', minLength: 120 }, file: str } },
    sources: { type: 'array', minItems: 1, items: { type: 'object', required: ['title', 'url'], properties: { title: str, url: { type: 'string', pattern: '^https://' } } } },
  },
};
// names the style text must never contain: studios, franchises and artists (describe the grammar, never the source)
export const BANNED = /\b(disney|pixar|ghibli|miyazaki|dreamworks|aardman|laika|cartoon network|nickelodeon|simpsons|futurama|family guy|rick and morty|south park|hanna[- ]barbera|looney|warner|fleischer|tezuka|toriyama|one piece|naruto|dragon ball|pok[eé]mon|sanrio|hello kitty|marvel|dc comics|tintin|herg[eé]|peanuts|schulz|calvin and hobbes|spider-?verse|arcane|minecraft|lego|playmobil|funko|wes anderson|tim burton|warhol|lichtenstein|seuss|beatrix potter)\b/i;

export function load() {
  if (!fs.existsSync(CATALOG)) return [];
  return fs.readdirSync(CATALOG).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8')));
}
export function check(e) {
  const errs = validate(ENTRY, e).map(x => `${e.slug}: ${x}`);
  const text = JSON.stringify({ ...e, sources: [] });
  const m = text.match(BANNED); if (m) errs.push(`${e.slug}: names "${m[0]}" (describe the look, never a studio, show or artist)`);
  if (e.example?.prompt && !/no text/i.test(e.example.prompt)) errs.push(`${e.slug}: the example prompt must end with "No text."`);
  return errs;
}

/** One guide per style for the skill (generated; edit the JSON, not the .md). */
export function guide(e) {
  const r = e.rendering;
  return `# ${e.name} (${FAMILIES[e.family]})
<!-- generated from studio/styles/catalog/${e.slug}.json by studio/bin/catalog.mjs; edit the JSON -->

**Looks like:** ${e.traits.join('; ')}.
**Best for:** ${e.bestFor.join(', ')}. **Products:** ${e.suits}.

## STYLE block (paste verbatim into every shot prompt and every sheet prompt)
${e.stylePara}

## Rendering
- Line: ${r.line}
- Shading: ${r.shading}
- Colour: ${r.colour}
- Texture: ${r.texture}
- Lighting: ${r.lighting}

## MOTION block
${e.motion}

## CAMERA habits
${e.camera}

## Avoid (name these instances only when the shot is at risk)
${e.avoid.map(a => `- ${a}`).join('\n')}

## Element sheets for consistency
${e.sheets}

## Where Seedance goes wrong in this style
${e.risk}

## Models
Sheets and places: \`${e.models.sheets}\` · video: \`${e.models.video}\` (draft on Flash 480p, final on 2.5 720p with the same prompt, references and seed).

## Example still (our own generation)
Prompt: ${e.example.prompt}
${e.example.file ? `\n![${e.name}](../../../studio/styles/catalog/examples/${path.basename(e.example.file)})\n` : ''}
## Sources (look, don't copy)
${e.sources.map(s => `- [${s.title}](${s.url})`).join('\n')}
`;
}
export function writeGuides() {
  const dir = path.join(REPO, 'skills', 'seedance-styles', 'styles');
  fs.mkdirSync(dir, { recursive: true });
  const all = load();
  for (const e of all) fs.writeFileSync(path.join(dir, `${e.slug}.md`), guide(e));
  return all.length;
}
