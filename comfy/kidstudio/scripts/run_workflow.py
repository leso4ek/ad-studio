"""Queue a Kid Studio workflow on a running ComfyUI and wait for it.

  python scripts/run_workflow.py workflows/04_shot_draft.json --set 1.shot_number=3
  python scripts/run_workflow.py workflows/02_character_sheet.json --set 3.take=2      # save take 2 (cached, no new cost)

--set NODE.INPUT=VALUE overrides an input (VALUE is parsed as JSON when possible, else used as a string).
Prints each node's UI text and any error; exit code 1 on failure.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid


def call(base, path, body=None):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workflow")
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--timeout", type=int, default=3600)
    a = ap.parse_args()
    wf = json.load(open(a.workflow, encoding="utf-8"))
    for s in a.set:
        key, val = s.split("=", 1)
        nid, inp = key.split(".", 1)
        try:
            val = json.loads(val)
        except json.JSONDecodeError:
            pass
        wf[nid]["inputs"][inp] = val
    try:
        r = call(a.server, "/prompt", {"prompt": wf, "client_id": str(uuid.uuid4())})
    except urllib.error.HTTPError as e:
        print("ComfyUI refused the workflow:", e.read().decode()[:2000])
        sys.exit(1)
    pid = r["prompt_id"]
    print(f"queued {a.workflow} as {pid}")
    t0 = time.time()
    while time.time() - t0 < a.timeout:
        h = call(a.server, f"/history/{pid}")
        if pid in h:
            item = h[pid]
            st = item.get("status", {})
            for nid, out in item.get("outputs", {}).items():
                title = wf.get(nid, {}).get("_meta", {}).get("title", nid)
                for t in out.get("text", []):
                    print(f"[{nid} {title}] {t}")
                for im in out.get("images", []):
                    print(f"[{nid} {title}] image: {im.get('subfolder', '')}/{im['filename']} ({im['type']})")
            if st.get("status_str") == "error":
                for m in st.get("messages", []):
                    if m[0] == "execution_error":
                        d = m[1]
                        print(f"ERROR in node {d.get('node_id')} ({d.get('node_type')}): {d.get('exception_message')}")
                sys.exit(1)
            print(f"done in {time.time() - t0:.0f}s")
            return
        time.sleep(2)
    print("timed out waiting for ComfyUI")
    sys.exit(1)


if __name__ == "__main__":
    main()
