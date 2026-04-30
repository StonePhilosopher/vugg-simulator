#!/usr/bin/env python3
"""Guardrail: detect when data/minerals.json has been reformatted.

The existing file uses hand-tuned formatting (inline single-line objects
for `test_cases[].fluid`, etc.) that Python's stdlib `json.dump(indent=2)`
cannot losslessly round-trip — any tool that loads + re-dumps will
mass-reformat the file. This script catches that situation by comparing
the *structural* diff (parsed-JSON paths added/removed/changed) against
the *line* diff (raw text churn).

If the structural diff is small (a few keys/values changed) but the line
diff is large (hundreds of lines changed), the file has been reformatted
— either intentionally or as a side effect of a tool round-trip.

Usage:
    python tools/check-minerals-diff.py            # check working tree vs HEAD
    python tools/check-minerals-diff.py --staged   # check staged vs HEAD

Exit codes:
    0 — no concerning churn detected (or no diff at all)
    1 — line churn > threshold while structural churn is small (suspect reformat)
    2 — git command failed or file not present

Tunable thresholds at the top of the file. Defaults err on the side of
catching reformatting; override with environment variables if needed.
"""
import json
import os
import subprocess
import sys
import argparse
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MINERALS_PATH = "data/minerals.json"

# Heuristics. The "alarm" condition is: many lines changed, few
# structural changes. A small change (one mineral, one field) typically
# touches 1-15 lines. A reformatting touches hundreds.
LINE_CHURN_THRESHOLD = int(os.environ.get("MINERALS_LINE_CHURN_THRESHOLD", 80))
STRUCT_CHANGES_PER_LINE_THRESHOLD = float(
    os.environ.get("MINERALS_STRUCT_PER_LINE_RATIO", 0.15)
)
# i.e., if (struct_changes / line_changes) < 0.15 the file looks reformatted


def git(args, **kwargs):
    """Run `git args...` from the repo root; return stdout text."""
    result = subprocess.run(
        ["git"] + list(args),
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        **kwargs,
    )
    if result.returncode != 0:
        sys.stderr.write(f"git {' '.join(args)} failed:\n{result.stderr}\n")
        sys.exit(2)
    return result.stdout


def fetch_head_text():
    """Return the HEAD copy of data/minerals.json as text."""
    return git(["show", f"HEAD:{MINERALS_PATH}"])


def fetch_working_or_staged_text(use_staged):
    """Return either the staged or working-tree copy as text."""
    if use_staged:
        return git(["show", f":0:{MINERALS_PATH}"])
    path = REPO_ROOT / MINERALS_PATH
    return path.read_text(encoding="utf-8")


def count_diff_lines(use_staged):
    """Count lines changed in minerals.json per `git diff --numstat`."""
    args = ["diff", "--numstat"]
    if use_staged:
        args.append("--cached")
    args.extend(["--", MINERALS_PATH])
    out = git(args)
    if not out.strip():
        return 0  # no diff
    parts = out.split()
    if len(parts) < 2:
        return 0
    added, removed = parts[0], parts[1]
    if added == "-" or removed == "-":
        return -1  # binary file (shouldn't happen for json)
    return int(added) + int(removed)


def flatten_paths(node, prefix=""):
    """Yield (path, value) for every leaf in the parsed JSON.

    Lists are flattened with [N] indices; dicts with .key. Leaves are
    primitives (str, int, float, bool, None) and EMPTY containers.
    """
    if isinstance(node, dict):
        if not node:
            yield prefix, {}
            return
        for k, v in node.items():
            yield from flatten_paths(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(node, list):
        if not node:
            yield prefix, []
            return
        for i, v in enumerate(node):
            yield from flatten_paths(v, f"{prefix}[{i}]")
    else:
        yield prefix, node


def count_struct_changes(old_text, new_text):
    """Count semantic differences between two parsed-JSON snapshots.

    Returns the number of leaf-level paths that differ (added, removed,
    or value-changed). Insensitive to whitespace, key ordering, and
    inline-vs-multi-line formatting.
    """
    old_data = json.loads(old_text)
    new_data = json.loads(new_text)
    old_leaves = dict(flatten_paths(old_data))
    new_leaves = dict(flatten_paths(new_data))

    added = set(new_leaves) - set(old_leaves)
    removed = set(old_leaves) - set(new_leaves)
    common = set(old_leaves) & set(new_leaves)
    changed = {p for p in common if old_leaves[p] != new_leaves[p]}

    return len(added) + len(removed) + len(changed), {
        "added": sorted(added)[:10],
        "removed": sorted(removed)[:10],
        "changed": sorted(changed)[:10],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--staged",
        action="store_true",
        help="Compare staged (index) vs HEAD instead of working tree vs HEAD.",
    )
    args = parser.parse_args()

    line_churn = count_diff_lines(args.staged)
    if line_churn == 0:
        print(f"[ok] no diff in {MINERALS_PATH}")
        return 0
    if line_churn < 0:
        sys.stderr.write(f"[error] {MINERALS_PATH} appears to be binary\n")
        return 2

    old_text = fetch_head_text()
    new_text = fetch_working_or_staged_text(args.staged)

    struct_changes, samples = count_struct_changes(old_text, new_text)

    print(f"  line churn:        {line_churn}")
    print(f"  structural changes: {struct_changes}")

    if line_churn < LINE_CHURN_THRESHOLD:
        print(f"[ok] line churn under threshold ({LINE_CHURN_THRESHOLD})")
        return 0

    ratio = struct_changes / line_churn if line_churn else 0
    if ratio < STRUCT_CHANGES_PER_LINE_THRESHOLD:
        sys.stderr.write(
            f"\n[WARN] {MINERALS_PATH} looks reformatted.\n"
            f"  Lines changed:        {line_churn}\n"
            f"  Structural changes:   {struct_changes}\n"
            f"  Ratio:                {ratio:.3f} (threshold: "
            f"{STRUCT_CHANGES_PER_LINE_THRESHOLD})\n"
            f"\n"
            f"This pattern (many lines changed, few structural changes)\n"
            f"usually means the file was round-tripped through a JSON\n"
            f"library that doesn't preserve hand-tuned formatting (inline\n"
            f"single-line objects for test_cases[].fluid, etc.).\n"
            f"\n"
            f"Sample structural changes detected:\n"
        )
        for category, paths in samples.items():
            if paths:
                sys.stderr.write(f"  {category}:\n")
                for p in paths:
                    sys.stderr.write(f"    {p}\n")
        sys.stderr.write(
            f"\n"
            f"If you intended a bulk format change, set\n"
            f"MINERALS_LINE_CHURN_THRESHOLD higher and re-run, or\n"
            f"--force-style if calling this from a workflow.\n"
            f"\n"
            f"Otherwise: revert and use surgical text edits (Edit tool /\n"
            f"sed-like substitutions) instead of json.load + json.dump.\n"
        )
        return 1

    print(f"  ratio: {ratio:.3f} (threshold: {STRUCT_CHANGES_PER_LINE_THRESHOLD})")
    print(f"[ok] structural changes match line churn — looks like a real edit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
