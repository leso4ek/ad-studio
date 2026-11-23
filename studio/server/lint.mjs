// Ad Studio · the claims and fairness lint (story-ad-playbook rule 7: kind contrast, honest claims).
// Errors stop the pipeline until the story is fixed; warnings are shown on the decision card.
const RULES = [
  { level: 'error', id: 'absolute', re: /\b(the best|#\s?1|number one|world'?s (best|first)|unbeatable|guaranteed?|100\s?%|never fails|risk[- ]free)\b/i, why: 'absolute claim: needs proof the brief does not give' },
  { level: 'error', id: 'health', re: /\b(cures?|heals?|treats?|prevents?|clinically|doctor[- ]recommended|detox|boosts? immunity|weight loss|burns? fat)\b/i, why: 'health or medical claim' },
  { level: 'error', id: 'pressure', re: /\b(ask your (mum|mom|dad|parents)|buy (it )?now or|only \d+ left|last chance|act now|don'?t miss out)\b/i, why: 'pressure selling (and never aimed at children)' },
  { level: 'error', id: 'fake-social', re: /\b(\d+(\.\d+)?\s?(k|m|million|thousand) (happy )?(customers|users|people) (love|trust)|everyone is buying|viral sensation)\b/i, why: 'social proof the brief does not back' },
  { level: 'warn', id: 'comparative', re: /\b(better than|unlike (other|the other)|competitors?|other brands?)\b/i, why: 'comparison: name no rival and keep it provable' },
  { level: 'warn', id: 'scare', re: /\b(you'?ll regret|ashamed|disgusting|ugly|loser)\b/i, why: 'shaming contrast: the playbook asks for kind contrast' },
  { level: 'warn', id: 'price', re: /(\$|€|£)\s?\d/, why: 'price on screen: check it is real and current' },
];
// real brands we must not show or name (a short list of the usual suspects; the skill tells Claude to invent names)
const BRANDS = ['coca-cola', 'coke', 'pepsi', 'nike', 'adidas', 'apple', 'iphone', 'samsung', 'google', 'amazon', 'starbucks', 'mcdonald', 'red bull', 'nestle', 'nescafe', 'colgate', 'oral-b', 'gillette', 'loreal', "l'oreal", 'nivea', 'dove', 'lego', 'disney', 'pixar', 'marvel', 'tiktok', 'instagram', 'youtube', 'netflix', 'spotify', 'ikea', 'tesla', 'evangelion', 'pokemon', 'nintendo', 'barbie', 'mattel', 'hasbro'];

export function lintText(text, where = '') {
  const out = [];
  for (const r of RULES) { const m = r.re.exec(text); if (m) out.push({ level: r.level, rule: r.id, where, match: m[0], why: r.why }); }
  const low = text.toLowerCase();
  for (const b of BRANDS) if (new RegExp(`(^|[^a-z])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(low)) out.push({ level: 'error', rule: 'real-brand', where, match: b, why: 'a real brand or IP: invent an original name' });
  return out;
}

/** Every on-screen or spoken string of a bible (texts, voice lines, end card, product label). */
export function lintBible(b) {
  const issues = [];
  const add = (t, w) => t && issues.push(...lintText(String(t), w));
  add(b.product?.name, 'product.name'); add(b.product?.label, 'product.label');
  for (const s of b.shots || []) for (const l of s.layers || []) if (l.type === 'text') add(l.text, `${s.id}.${l.id || 'text'}`);
  for (const l of b.vo?.lines || []) add(l.text, `vo.${l.id}`);
  for (const k of ['logo', 'line', 'cta']) add(b.endcard?.[k], `endcard.${k}`);
  for (const h of b.variants?.hooks || []) for (const s of h.shots || []) for (const l of s.layers || []) if (l.type === 'text') add(l.text, `hook${h.id}.${s.id}`);
  return issues;
}

export function lintObject(o, where = '') {
  const issues = [];
  const walk = (v, w) => { if (typeof v === 'string') issues.push(...lintText(v, w)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!/^(reason|why|why_not|basis|notes?|alternatives)$/.test(k)) walk(x, w ? `${w}.${k}` : k); };
  walk(o, where); return issues;
}
