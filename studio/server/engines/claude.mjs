// Ad Studio · engine "claude": runs Claude Code headless for a decision and streams what it does to the app.
//   claude -p "<stage prompt>" --output-format stream-json --verbose --json-schema '<schema>'
//          --session-id <uuid> (first call) | --resume <uuid> (later calls: one session per ad, so context carries over)
//          --append-system-prompt-file skills/ad-studio-director/SKILL.md --strict-mcp-config
//          --permission-mode acceptEdits --allowedTools Read Write Edit Glob Grep "Bash(node:*)" "Bash(python3:*)"
// Runs in the ad's folder; the kit, the skills and the library are added read-only with --add-dir.
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { run, which, readJSON, writeJSON, REPO, STUDIO } from '../util.mjs';
import { emit } from '../bus.mjs';
import { directorDir } from '../stages.mjs';

export const id = 'claude';
export async function available(cfg) {
  const bin = cfg.claude?.bin || 'claude';
  const p = await which(bin);
  if (!p) return { ok: false, why: `"${bin}" not on PATH (install Claude Code and log in)` };
  const v = await run(bin, ['--version']).catch(() => ({ code: 1 }));
  return v.code === 0 ? { ok: true, detail: v.out.trim() } : { ok: false, why: 'claude --version failed' };
}

function summarize(ev) {
  // stream-json events → short lines the app shows in the "Claude live" pane
  if (ev.type === 'system' && ev.subtype === 'init') return [{ kind: 'init', text: `session ${ev.session_id?.slice(0, 8)} · ${ev.model || ''}` }];
  if (ev.type === 'assistant') return (ev.message?.content || []).map(c => {
    if (c.type === 'text') return { kind: 'text', text: c.text };
    if (c.type === 'thinking') return { kind: 'thinking', text: c.thinking?.slice(0, 600) || '' };
    if (c.type === 'tool_use') {
      const i = c.input || {};
      const what = i.file_path || i.path || i.pattern || i.command || i.description || '';
      return { kind: 'tool', tool: c.name, text: String(what).slice(0, 300) };
    }
    return null;
  }).filter(Boolean);
  if (ev.type === 'user') return (ev.message?.content || []).filter(c => c.type === 'tool_result').map(c => ({ kind: 'result', text: (typeof c.content === 'string' ? c.content : JSON.stringify(c.content)).slice(0, 240), error: !!c.is_error }));
  if (ev.type === 'result') return [{ kind: 'done', text: `${ev.subtype} · ${(ev.duration_ms / 1000).toFixed(1)} s${ev.total_cost_usd ? ` · $${ev.total_cost_usd.toFixed(3)} at list price` : ''}` }];
  return [];
}

/** decide({slug, adDir, stage, prompt, schema}) → {output, meta} */
export async function decide(cfg, { slug, adDir, stage, prompt, schema, signal, opts = {} }) {
  // opts.fresh: a new one-off session (not the ad's long resumed one) · opts.noSkill: skip the skill system prompt
  // opts.noTools: see below · opts.effort / opts.maxTurns: per-call overrides. Used where token use matters (the audience test).
  const proj = opts.fresh ? {} : readJSON(path.join(adDir, 'project.json'), {});
  const bin = cfg.claude?.bin || 'claude';
  const resume = !!proj.claudeSession;
  const sid = proj.claudeSession || crypto.randomUUID();
  const skill = path.join(REPO, 'skills', 'ad-studio-director', 'SKILL.md');
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--json-schema', JSON.stringify(schema),
    ...(resume ? ['--resume', sid] : ['--session-id', sid]),
    ...(opts.noSkill ? [] : ['--append-system-prompt', fs.readFileSync(skill, 'utf8')]),
    '--strict-mcp-config', '--permission-mode', 'acceptEdits',
    // opts.noTools: no tools at all and a neutral cwd (no project CLAUDE.md): ~3.5k context tokens instead of ~40k
    ...(opts.noTools ? ['--tools', ''] : ['--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(node:*)', 'Bash(python3:*)', 'Bash(ls:*)',
      '--add-dir', path.join(STUDIO, 'kit'), '--add-dir', path.join(REPO, 'skills'), '--add-dir', path.join(REPO, 'research'), '--add-dir', path.join(REPO, 'styles'),
      ...(fs.existsSync(directorDir(cfg)) ? ['--add-dir', directorDir(cfg)] : [])]),
    '--max-turns', String(opts.maxTurns || cfg.claude?.maxTurns || 30)];
  if (cfg.claude?.model) args.push('--model', cfg.claude.model);
  if (opts.effort || cfg.claude?.effort) args.push('--effort', opts.effort || cfg.claude.effort);
  if (cfg.claude?.fallbackModel) args.push('--fallback-model', cfg.claude.fallbackModel);
  // the session id is saved before the call, so a crash still resumes the same conversation
  if (!opts.fresh) writeJSON(path.join(adDir, 'project.json'), { ...readJSON(path.join(adDir, 'project.json'), {}), claudeSession: sid });
  emit('claude', { slug, stage, kind: 'start', text: `${resume ? 'resuming' : 'starting'} Claude Code session ${sid.slice(0, 8)}` });
  let result = null;
  const r = await run(bin, args, {
    cwd: opts.noTools ? os.tmpdir() : adDir, signal,
    onLine: (line, which) => {
      if (which === 'err') { if (line.trim()) emit('claude', { slug, stage, kind: 'stderr', text: line.slice(0, 300) }); return; }
      let ev; try { ev = JSON.parse(line); } catch { return; }
      if (ev.type === 'result') result = ev;
      for (const s of summarize(ev)) emit('claude', { slug, stage, ...s });
    },
  });
  if (r.aborted) throw new Error('cancelled');
  if (!result) throw new Error(`claude exited ${r.code} without a result: ${r.err.slice(-400)}`);
  if (result.is_error) throw new Error(`claude: ${result.subtype}: ${String(result.result || '').slice(0, 400)}`);
  let output = result.structured_output;
  if (!output) { const m = /\{[\s\S]*\}/.exec(result.result || ''); if (m) try { output = JSON.parse(m[0]); } catch { /* fall through */ } }
  if (!output) throw new Error('claude returned no structured output');
  return { output, meta: { engine: 'claude', session: sid, cost_usd_list: result.total_cost_usd, turns: result.num_turns, ms: result.duration_ms } };
}
