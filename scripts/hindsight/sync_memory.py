#!/usr/bin/env python3
"""Load this project's memory into Hindsight (github.com/vectorize-io/hindsight, MIT) and keep it in sync.

  python3 scripts/hindsight/sync_memory.py [--url http://localhost:8888] [--bank scifi-explainer-studio]
                                           [--only claude,skills,lessons,reports,prefs] [--dry-run] [--wait]

What goes in (one Hindsight *document* per piece, so a re-run replaces it instead of duplicating it):
  prefs    the user's standing rules and preferences (how to talk to them, budgets, licences, what never to do)
  claude   CLAUDE.md, one document per ## / ### section (the decisions, the episode and round logs, lessons)
  skills   our own skills' SKILL.md files (skills/*/SKILL.md), one document each
  lessons  the Ad Studio hindsight memory (studio/memory/lessons.jsonl), one item per lesson
  reports  every REPORT.md / SUMMARY.md under ads/ and research/
Hindsight's own pipeline extracts facts, entities and time from each text, so we send the full text, not summaries.
Standard library only. The bank gets MCP server instructions, so a connecting agent knows how to use it.
"""
import argparse, hashlib, json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAX_CHARS = 12000  # per item; longer texts are split on headings/paragraphs

PREFS = """Standing rules from the user of scifi-explainer-studio (the Ad Studio / short-video project):
- Write every reply in the i-have-adhd mode: lead with the result or the next action, numbered steps with one action each, at most 5 items per list, concrete times, and end with one next step the user can do in under 2 minutes. No preamble.
- Paid credits (Higgsfield, Kling, OpenRouter, ElevenLabs paid) need a budget or an OK first; never auto-retry a paid job; a paid redo is asked first. ElevenLabs is free tier only, with premade voices.
- Never paste or ask for secrets in chat. The user declined a Zep key: never ask again.
- No real brands, people or copyrighted characters on screen; never name studios, shows, artists or reference films in prompts; never upload the user's copyrighted reference images. Public-domain books only, and credited.
- Third-party skills are linked by scripts/bootstrap.sh, not copied; AGPL tools (MiroFish, VoiceStudio) run as separate services; Lemo-Opuscar docs are followed, never copied.
- Commit and push after every work block (the cloud container is temporary). No model identifiers in commits.
- Nov 27 2026 feedback: the MAGI-2 comic-book pilot "24601" looked like AI slop and the style was off; keep working with Seedance instead of MAGI-2 for AI video.
- The user likes stickman / simple cartoon explainer videos built in three.js, "what if" questions where the first question is only answered at the end and other questions are asked and answered in between.
"""

MCP_INSTRUCTIONS = """This bank is the long-term memory of the scifi-explainer-studio repo (Ad Studio: story ads, explainers, short dramas, what-if videos, built in code and with AI video).
Before a task: recall the topic (for example "Seedance prompt rules", "caption placement", "user preferences", "budget").
After a task: retain what was learned with the context "learnings", "procedures" or "preferences" and the tag project:scifi-explainer-studio. Pass full observations, not summaries.
The user's standing rules are in the document prefs/user-rules: follow them."""


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60] or 'x'


def split_text(text, limit=MAX_CHARS):
    if len(text) <= limit:
        return [text]
    parts, cur = [], ''
    for para in re.split(r'\n(?=#{2,4} )|\n\n', text):
        if len(cur) + len(para) + 2 > limit and cur:
            parts.append(cur); cur = ''
        while len(para) > limit:
            parts.append(para[:limit]); para = para[limit:]
        cur = (cur + '\n\n' + para) if cur else para
    if cur:
        parts.append(cur)
    return parts


def md_sections(path, level_re=r'^(##|###) '):
    text = open(path, encoding='utf-8').read()
    out, head, buf = [], 'intro', []
    for line in text.split('\n'):
        if re.match(level_re, line):
            if ''.join(buf).strip():
                out.append((head, '\n'.join(buf)))
            head, buf = line.lstrip('# ').strip(), [line]
        else:
            buf.append(line)
    if ''.join(buf).strip():
        out.append((head, '\n'.join(buf)))
    return out


def mtime_iso(path):
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(os.path.getmtime(path)))


def collect(only):
    docs = []  # (document_id, context, timestamp, text, tags)
    tag = 'project:scifi-explainer-studio'
    if 'prefs' in only:
        docs.append(('prefs/user-rules', 'preferences', time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), PREFS, [tag, 'preferences']))
    if 'claude' in only:
        p = os.path.join(ROOT, 'CLAUDE.md')
        for head, body in md_sections(p):
            docs.append((f'claude-md/{slug(head)}', 'project memory (CLAUDE.md)', mtime_iso(p), body, [tag, 'claude-md']))
    if 'skills' in only:
        sk = os.path.join(ROOT, 'skills')
        for name in sorted(os.listdir(sk)):
            f = os.path.join(sk, name, 'SKILL.md')
            if os.path.isfile(f) and not os.path.islink(os.path.join(sk, name)):
                docs.append((f'skill/{name}', f'the {name} skill (procedures)', mtime_iso(f), open(f, encoding='utf-8').read(), [tag, 'skill']))
    if 'lessons' in only:
        f = os.path.join(ROOT, 'studio', 'memory', 'lessons.jsonl')
        if os.path.isfile(f):
            for line in open(f, encoding='utf-8'):
                if not line.strip():
                    continue
                L = json.loads(line)
                text = (f"Ad Studio lesson ({L.get('kind')}, stage {L.get('stage')}, confidence {L.get('confidence')}, seen in {', '.join(L.get('ads', []))}): "
                        f"{L.get('lesson')} When: {L.get('when')}. Goal: {L.get('goal')}. Evidence: {L.get('evidence')}")
                docs.append((f"lesson/{L['id']}", 'learnings', L.get('updated') or L.get('created'), text, [tag, 'lesson', f"stage:{L.get('stage')}"]))
    if 'reports' in only:
        for base in ('ads', 'research'):
            for dp, dn, fn in os.walk(os.path.join(ROOT, base)):
                dn[:] = [d for d in dn if not d.startswith('.') and d not in ('node_modules', '.venv')]
                for n in fn:
                    if n in ('REPORT.md', 'SUMMARY.md'):
                        f = os.path.join(dp, n); rel = os.path.relpath(f, ROOT)
                        docs.append((f'report/{rel}', f'report: {rel}', mtime_iso(f), open(f, encoding='utf-8').read(), [tag, 'report']))
    return docs


def call(url, method='GET', body=None, timeout=120):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('HINDSIGHT_URL', 'http://localhost:8888'))
    ap.add_argument('--bank', default='scifi-explainer-studio')
    ap.add_argument('--only', default='prefs,claude,skills,lessons,reports')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--wait', action='store_true', help='retain synchronously (slower, shows errors at once)')
    a = ap.parse_args()
    only = set(a.only.split(','))
    docs = collect(only)
    state_f = os.path.join(ROOT, 'scripts', 'hindsight', '.synced.json')
    state = json.load(open(state_f)) if os.path.exists(state_f) else {}
    todo = []
    for doc_id, ctx, ts, text, tags in docs:
        h = hashlib.sha1(text.encode()).hexdigest()
        if state.get(f'{a.bank}:{doc_id}') == h:
            continue
        todo.append((doc_id, ctx, ts, text, tags, h))
    chars = sum(len(t[3]) for t in todo)
    print(f'{len(docs)} documents, {len(todo)} new or changed, {chars:,} characters to send to {a.url} bank {a.bank}')
    if a.dry_run:
        for t in todo:
            print(f'  {t[0]}  ({len(t[3]):,} chars)')
        return
    base = f"{a.url.rstrip('/')}/v1/default/banks/{a.bank}"
    try:
        call(base, 'PUT', {
            'reflect_mission': 'The long-term memory of the scifi-explainer-studio project (Ad Studio) and its user: what was built, what worked, what failed and why, and how the user wants to work.',
            'retain_mission': 'Keep decisions and their reasons, measured results (scores, costs, durations, loudness), lessons and fixes, tool and model behaviour, prices and budgets, and the user\'s preferences and rules. Ignore boilerplate.'})
    except urllib.error.HTTPError as e:
        print(f'  bank create/update: HTTP {e.code} (continuing)')
    try:
        call(f'{base}/config', 'PATCH', {'updates': {'mcp_server_instructions': MCP_INSTRUCTIONS}})
    except urllib.error.HTTPError as e:
        print(f'  MCP instructions not set: HTTP {e.code} {e.read().decode()[:200]}')
    sent = 0
    for doc_id, ctx, ts, text, tags, h in todo:
        parts = split_text(text)
        items = [{'content': p, 'context': ctx, 'timestamp': ts, 'document_id': doc_id if len(parts) == 1 else f'{doc_id}#{i + 1}', 'tags': tags}
                 for i, p in enumerate(parts)]
        try:
            call(f'{base}/memories', 'POST', {'items': items, 'async': not a.wait}, timeout=900)
        except urllib.error.HTTPError as e:
            print(f'  FAILED {doc_id}: HTTP {e.code} {e.read().decode()[:300]}'); continue
        state[f'{a.bank}:{doc_id}'] = h; sent += 1
        print(f'  retained {doc_id} ({len(parts)} part{"s" * (len(parts) > 1)})')
        json.dump(state, open(state_f, 'w'), indent=1)
    print(f'done: {sent} documents sent. MCP endpoint: {a.url.rstrip("/")}/mcp/{a.bank}/')


if __name__ == '__main__':
    main()
