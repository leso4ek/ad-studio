// Ad Studio · the JSON Schemas of every Claude decision. The same schemas are passed to `claude -p --json-schema`,
// written into decision-inbox requests, and checked by validate.mjs before a stage counts as done.
const S = (properties, required = Object.keys(properties), extra = {}) => ({ type: 'object', properties, required, ...extra });
const str = (d) => ({ type: 'string', ...(d ? { description: d } : {}) });
const num = (d) => ({ type: 'number', ...(d ? { description: d } : {}) });
const arr = (items, min, max) => ({ type: 'array', items, ...(min !== undefined ? { minItems: min } : {}), ...(max !== undefined ? { maxItems: max } : {}) });

export const STYLES = ['ad-paper-cutout', 'ad-riso-print', 'ad-midcentury-toon', 'ad-kinetic-type', 'ad-toy-3d'];
export const PRODUCT_KINDS = ['bottle', 'jar', 'box', 'tube', 'can', 'pouch', 'cup', 'device', 'brush'];
export const PLACE_KINDS = ['kitchen', 'bedroom', 'office', 'bathroom', 'cafe', 'street', 'park', 'sky', 'studio'];
export const POSES = ['neutral', 'happy', 'sad', 'tired', 'surprised', 'point', 'wave', 'think', 'cheer', 'hold', 'annoyed'];
export const PROPS = ['mug', 'steam', 'clock', 'alarm', 'phone', 'plant', 'fern', 'fern-droopy', 'lamp', 'bed', 'desk', 'laptop', 'book', 'bag', 'sun', 'moon', 'cloud', 'star', 'sparkle', 'heart', 'arrow', 'drop', 'leaf', 'zzz', 'chair', 'sofa', 'tree'];
export const ANIMS = ['bob', 'float', 'breathe', 'pop', 'pulse', 'slide-l', 'slide-r', 'slide-up', 'drop', 'exit-l', 'exit-r', 'shake', 'wobble', 'spin', 'wave', 'talk', 'reveal', 'fade-in', 'fade-out'];
const hex = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };

export const brief = S({
  product: S({ name: str('an original, invented brand name'), kind: { type: 'string', enum: PRODUCT_KINDS }, what: str('what it is, one line'), benefit: str('the one honest benefit'),
    proof: arr(str(), 1, 5), label: str('word printed on the pack, max 10 characters'), colors: S({ body: hex, cap: hex, label: hex, labelInk: hex, accent: hex }) }),
  audience: S({ who: str(), moment: str('the everyday moment where the need appears'), pain: str() }),
  claims: arr(str('a claim we may make, provable from proof'), 1, 6),
  noClaims: arr(str('things we must not say'), 0, 8),
  format: S({ aspect: { type: 'string', enum: ['9:16', '16:9'] }, seconds: { type: 'number', minimum: 10, maximum: 60 } }),
  tone: str(), fictional: { type: 'boolean' }, reason: str('why this product and angle'),
});

export const premises = S({
  premises: arr(S({ id: str(), logline: str(), emotion: str(), productRole: str('how the product causes the turn'), hookIdea: str() }), 6, 12),
  chosen: str('id of the chosen premise'), reason: str(), runnerUp: str(),
});

export const hooks = S({
  hooks: arr(S({ id: { type: 'string', enum: ['A', 'B', 'C'] }, type: str('e.g. odd image, question, conflict mid-action, number, POV'), onScreen: str('the text on screen in the first 1-3 s'), visual: str(), vo: str('first spoken words, may be empty') }), 3, 3),
  lead: { type: 'string', enum: ['A', 'B', 'C'] }, reason: str(),
});

export const story = S({
  spine: arr(str(), 6, 8),
  acts: arr(S({ act: { type: 'integer', minimum: 1, maximum: 5 }, name: str(), t0: num(), t1: num(), beats: str() }), 5, 5),
  turn: str('how the product causes the turn'), emotion: str('the one emotion'), reason: str(),
});

export const brandmap = S({
  plant: S({ t: num(), how: str() }), pulses: arr(S({ t: num(), how: str() }), 1, 4), reveal: S({ t: num(), how: str() }), tag: S({ t: num(), line: str() }),
  claims: arr(S({ text: str(), basis: str('which brief proof backs it') }), 1, 5), reason: str(),
});

export const style = S({
  style: { type: 'string', enum: STYLES }, reason: str(),
  alternatives: arr(S({ style: { type: 'string', enum: STYLES }, why_not: str() }), 1, 4),
});

const layer = {
  type: 'object', required: ['type'],
  properties: {
    type: { type: 'string', enum: ['char', 'product', 'prop', 'text'] }, id: str(), kind: { type: 'string', enum: PROPS }, x: num(), y: num(), scale: num(), z: num(),
    pose: { type: 'string', enum: POSES }, face: { type: 'string', enum: ['left', 'right', 'front'] }, flip: { type: 'boolean' },
    anim: arr({ type: 'string', pattern: `^(${ANIMS.join('|')})(:[0-9.]+)?$` }), move: arr(num(), 1, 2), moveT: arr(num(), 2, 2), t0: num(), t1: num(),
    text: str(), role: { type: 'string', enum: ['hook', 'card', 'label', 'price', 'sub', 'small', 'cta'] }, size: num(), w: num(), align: { type: 'string', enum: ['left', 'center', 'right'] },
    color: str(), bg: { type: 'boolean' }, bgColor: str(), rot: num(), l16: { type: 'object' }, pass: { type: 'boolean' },
  },
};
const shot = S({
  id: str(), t0: num(), t1: num(), act: { type: 'integer', minimum: 1, maximum: 5 }, beat: str('hook | plant | pulse | reveal | tag | story'), place: str(), time: { type: 'string', enum: ['day', 'dusk', 'night'] },
  trans: { type: 'string', enum: ['cut', 'wipe', 'slide', 'iris', 'fade', 'stripes'] }, camera: { type: 'object' }, bg: str(), seed: num(), custom: str(), note: str(),
  layers: arr(layer, 0, 14),
}, ['id', 't0', 't1', 'layers']);

export const bible = S({
  slug: str(), title: str(), style: { type: 'string', enum: STYLES }, dur: { type: 'number', minimum: 8, maximum: 60 },
  stylePara: str('the locked style paragraph'),
  product: S({ name: str(), kind: { type: 'string', enum: PRODUCT_KINDS }, label: str(), colors: { type: 'object' } }, ['name', 'kind']),
  cast: { type: 'object', additionalProperties: S({ skin: hex, hair: hex, hairStyle: { type: 'string', enum: ['short', 'bob', 'long', 'bun', 'curly', 'bald'] }, top: hex, bottom: hex, shoe: hex, build: { type: 'string', enum: ['slim', 'round', 'tall', 'average'] }, age: { type: 'string', enum: ['adult', 'kid'] }, role: str() }, ['skin', 'hairStyle']) },
  places: { type: 'object', additionalProperties: S({ kind: { type: 'string', enum: PLACE_KINDS }, time: { type: 'string', enum: ['day', 'dusk', 'night'] }, props: arr({ type: 'object' }) }, ['kind']) },
  palette: { type: 'object' },
  shots: arr(shot, 3, 14),
  vo: S({ voice: str('Kokoro voice id, e.g. af_heart, am_michael, bf_emma'), speed: num(), lines: arr(S({ id: str(), text: str(), at: num('start second'), speaker: str('narrator or a cast id') }, ['id', 'text', 'at']), 1, 14) }, ['lines']),
  captions: { type: 'boolean' },
  endcard: S({ t0: num(), logo: str(), line: str(), cta: str(), bg: str() }, ['t0', 'logo']),
  music: S({ mood: { type: 'string', enum: ['warm', 'bouncy', 'jazzy', 'lofi', 'bright', 'tender'] }, bpm: num() }, ['mood']),
  sfx: arr(S({ t: num(), type: str() }, ['t', 'type'])),
  variants: S({ hooks: arr(S({ id: { type: 'string', enum: ['A', 'B', 'C'] }, shots: arr({ type: 'object' }) }, ['id', 'shots'])) }),
  custom: { type: 'boolean' }, reason: str('why this shot plan, two or three sentences'),
}, ['slug', 'style', 'dur', 'product', 'cast', 'places', 'shots', 'vo', 'endcard', 'music']);

export const frames = S({
  verdict: { type: 'string', enum: ['approve', 'revised'] },
  notes: arr(S({ shot: str(), issue: str(), fix: str() }, ['issue']), 0, 20),
  changed: { type: 'boolean', description: 'true if you edited bible.json in this turn' }, reason: str(),
});

export const scorecard = S({
  scores: arr(S({ rule: str(), score: { type: 'integer', minimum: 1, maximum: 5 }, note: str() }), 7, 7),
  total: num(), verdict: str(), fixes: arr(str(), 0, 8), bestHook: { type: 'string', enum: ['A', 'B', 'C'] }, reason: str(),
});

// stage 13: the audience test (MiroFish). Setup = the simulation question + viewer segments; verdict = read of its report.
const int15 = { type: 'integer', minimum: 1, maximum: 5 };
export const audienceSetup = S({
  requirement: str('one paragraph for MiroFish: who sees the ad where, and what to predict (stop scrolling, watch to the end, remember the brand, trust the claims, want to buy, which opening works best)'),
  segments: arr(S({ name: str(), who: str(), mindset: str('how they scroll, what makes them stop or skip, one honest doubt') }), 3, 5),
  reason: str(),
});
export const audience = S({
  scores: S({ stopScroll: int15, watchThrough: int15, brandRecall: int15, trust: int15, clickIntent: int15 }),
  bestHook: { type: 'string', enum: ['A', 'B', 'C', 'unclear'] },
  comments: arr(S({ who: str(), text: str(), tone: { type: 'string', enum: ['positive', 'neutral', 'negative'] } }), 3, 8),
  fixes: arr(str(), 1, 5), risks: arr(str(), 0, 5),
  confidence: { type: 'string', enum: ['low', 'medium'], description: 'a simulation, never high' },
  reason: str(),
});

export const SCHEMAS = { brief, premises, hooks, story, brandmap, style, bible, frames, scorecard, audienceSetup, audience };
