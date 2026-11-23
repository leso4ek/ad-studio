// Ad Studio · a small JSON Schema checker (the subset the stage schemas use: type, required, properties,
// additionalProperties:false, items, enum, minItems, maxItems, minimum, maximum, minLength, pattern).
export function validate(schema, value, at = '$') {
  const errs = [];
  const T = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
  const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
  if (T) {
    const t = typeOf(value), ok = T.includes(t) || (t === 'integer' && T.includes('number'));
    if (!ok) { errs.push(`${at}: expected ${T.join('|')}, got ${t}`); return errs; }
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) errs.push(`${at}: too short`);
    if (schema.maxLength && value.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${at}: above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, `${at}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}: missing "${k}"`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) errs.push(...validate(s, value[k], `${at}.${k}`));
    if (schema.additionalProperties === false) for (const k of Object.keys(value)) if (!(k in (schema.properties || {}))) errs.push(`${at}: unexpected "${k}"`);
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
      for (const k of Object.keys(value)) if (!(k in (schema.properties || {}))) errs.push(...validate(schema.additionalProperties, value[k], `${at}.${k}`));
  }
  return errs;
}
