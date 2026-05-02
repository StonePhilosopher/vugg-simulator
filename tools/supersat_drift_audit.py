"""Supersat drift audit — diff every supersaturation_<species>() between
vugg.py and index.html.

sync-spec.js validates declarative drift in data/minerals.json (T_range,
fluorescence, etc.) but doesn't catch math drift in supersaturation
formulas. This script parses both runtimes, extracts each supersat
function body, normalizes it (strip whitespace, comments, JS↔Python
syntactic noise like 'this.'↔'self.', '||'↔'or', math semantics), and
flags species whose normalized bodies differ.

Output: per-species diagnosis (CLEAN, COSMETIC, DIVERGENT) plus
side-by-side body view for divergent cases.

Run: python tools/supersat_drift_audit.py
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PY = REPO / "vugg.py"
JS = REPO / "index.html"


def extract_python_supersats(text: str) -> dict[str, str]:
    """Find every 'def supersaturation_X(self) -> float:' body.

    Returns {species: body_text} where body is the lines under the def
    until dedent.
    """
    out: dict[str, str] = {}
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        m = re.match(r'^(\s*)def supersaturation_(\w+)\s*\(', lines[i])
        if not m:
            i += 1
            continue
        indent = len(m.group(1))
        species = m.group(2)
        body = []
        i += 1
        # Skip docstring
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i < len(lines) and lines[i].strip().startswith(('"""', "'''")):
            quote = lines[i].strip()[:3]
            if lines[i].strip().endswith(quote) and len(lines[i].strip()) > 3:
                i += 1
            else:
                i += 1
                while i < len(lines) and quote not in lines[i]:
                    i += 1
                i += 1
        # Now collect body until dedent
        while i < len(lines):
            line = lines[i]
            if line.strip() == "":
                body.append(line)
                i += 1
                continue
            current_indent = len(line) - len(line.lstrip())
            if current_indent <= indent and line.strip():
                break
            body.append(line)
            i += 1
        out[species] = "\n".join(body)
    return out


def extract_js_supersats(text: str) -> dict[str, str]:
    """Find every 'supersaturation_X() { ... }' method.

    Returns {species: body_text} where body is content between the
    matching braces.
    """
    out: dict[str, str] = {}
    for match in re.finditer(r'supersaturation_(\w+)\s*\(\s*\)\s*\{', text):
        species = match.group(1)
        start = match.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
            i += 1
        body = text[start:i-1]
        # Only keep the FIRST hit per species (index.html may have
        # duplicate references in spec-fallback comment blocks)
        if species not in out:
            out[species] = body
    return out


def normalize_body(body: str, lang: str) -> str:
    """Normalize a supersat function body for comparison.

    Strips comments, whitespace, and language-specific syntactic noise.
    """
    text = body
    # Strip comments
    if lang == "py":
        text = re.sub(r'#.*', '', text)
    else:
        text = re.sub(r'//.*', '', text)
        text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    # Drop docstrings (Python only — extract_python_supersats already
    # tries to skip but be safe)
    text = re.sub(r'"""[\s\S]*?"""', '', text)
    text = re.sub(r"'''[\s\S]*?'''", '', text)
    # Common syntactic substitutions
    if lang == "py":
        text = text.replace("self.", "X.")
        text = text.replace(" and ", " && ")
        text = text.replace(" or ", " || ")
        text = text.replace("not ", "!")
        text = text.replace("True", "true")
        text = text.replace("False", "false")
        text = text.replace("None", "null")
        text = text.replace("max(", "Math.max(")
        text = text.replace("min(", "Math.min(")
        text = text.replace("abs(", "Math.abs(")
        # math.exp → Math.exp etc
        text = re.sub(r'\bmath\.', 'Math.', text)
        # Python snake_case → JS camelCase for known shared properties
        text = text.replace("effective_temperature", "effectiveTemperature")
        text = text.replace("silica_equilibrium", "silica_equilibrium")  # same in both
    else:  # js
        text = text.replace("this.", "X.")
        text = text.replace("const ", "")
        text = text.replace("let ", "")
        text = text.replace("var ", "")
        text = text.replace(";", "")
        # JS sometimes uses optional chaining or nullish coalescing
        text = re.sub(r'\?\?', '||', text)
    # Whitespace normalization
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text


def fingerprint(normalized: str) -> tuple:
    """Coarse signature: set of numeric constants + set of fluid fields used.

    If two implementations have the same set of constants and reference
    the same fluid fields, they're probably structurally equivalent.
    """
    nums = sorted(set(re.findall(r'\d+\.?\d*', normalized)))
    fields = sorted(set(re.findall(r'X\.\w+', normalized)))
    return (tuple(nums), tuple(fields))


def main() -> int:
    py_text = PY.read_text(encoding="utf-8")
    js_text = JS.read_text(encoding="utf-8")

    py_supersats = extract_python_supersats(py_text)
    js_supersats = extract_js_supersats(js_text)

    print(f"Found {len(py_supersats)} supersat functions in vugg.py")
    print(f"Found {len(js_supersats)} supersat functions in index.html")
    print()

    only_py = sorted(set(py_supersats) - set(js_supersats))
    only_js = sorted(set(js_supersats) - set(py_supersats))
    common = sorted(set(py_supersats) & set(js_supersats))

    if only_py:
        print(f"Only in Python ({len(only_py)}): {', '.join(only_py)}")
        print()
    if only_js:
        print(f"Only in JS ({len(only_js)}): {', '.join(only_js)}")
        print()

    clean = []
    cosmetic = []
    divergent = []

    for species in common:
        py_norm = normalize_body(py_supersats[species], "py")
        js_norm = normalize_body(js_supersats[species], "js")
        py_fp = fingerprint(py_norm)
        js_fp = fingerprint(js_norm)

        if py_norm == js_norm:
            clean.append(species)
        elif py_fp == js_fp:
            cosmetic.append(species)
        else:
            divergent.append((species, py_fp, js_fp))

    print(f"=== CLEAN ({len(clean)}) — normalized bodies match ===")
    if clean:
        for sp in clean:
            print(f"  ✓ {sp}")
    print()

    print(f"=== COSMETIC ({len(cosmetic)}) — same constants + fields, formatting differs ===")
    if cosmetic:
        for sp in cosmetic:
            print(f"  ~ {sp}")
    print()

    print(f"=== DIVERGENT ({len(divergent)}) — structural drift ===")
    for sp, py_fp, js_fp in divergent:
        print(f"\n  ✗ {sp}")
        py_nums, py_fields = py_fp
        js_nums, js_fields = js_fp
        only_py_nums = set(py_nums) - set(js_nums)
        only_js_nums = set(js_nums) - set(py_nums)
        only_py_fields = set(py_fields) - set(js_fields)
        only_js_fields = set(js_fields) - set(py_fields)
        if only_py_nums:
            print(f"    constants only in Python: {sorted(only_py_nums)}")
        if only_js_nums:
            print(f"    constants only in JS:     {sorted(only_js_nums)}")
        if only_py_fields:
            print(f"    fluid fields only in Python: {sorted(only_py_fields)}")
        if only_js_fields:
            print(f"    fluid fields only in JS:     {sorted(only_js_fields)}")

    print()
    print(f"Summary: {len(clean)} clean / {len(cosmetic)} cosmetic / {len(divergent)} DIVERGENT")
    return len(divergent)


if __name__ == "__main__":
    raise SystemExit(0 if main() == 0 else 1)
