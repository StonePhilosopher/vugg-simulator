#!/usr/bin/env python3
"""Generate ASCII art strings for embedding in the Vugg Simulator."""
import json, subprocess, sys
from pathlib import Path

TOOLS = Path(__file__).parent
PROJECT = TOOLS.parent
PHOTOS = PROJECT / "photos" / "source"

# Game colors (hex without #)
MINERALS = {
    "calcite":   {"photo": "calcite.jpg",   "color": "ffd699", "width": 45},
    "fluorite":  {"photo": "fluorite.jpg",  "color": "b088dd", "width": 45},
    "quartz":    {"photo": "quartz.jpg",    "color": "e8e8e8", "width": 45},
    "malachite": {"photo": "malachite.jpg", "color": "2e8b57", "width": 45},
}

results = {}

for mineral, cfg in MINERALS.items():
    photo = PHOTOS / cfg["photo"]
    if not photo.exists():
        print(f"  SKIP {mineral}")
        continue
    
    # Run converter, capture plain text output
    cmd = [
        sys.executable, str(TOOLS / "photo-to-ascii.py"),
        str(photo),
        "--width", str(cfg["width"]),
        "--charset", "dense",
        "--invert",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')
    # Skip the info line
    if lines and lines[0].startswith('['):
        lines = lines[1:]
    
    ascii_art = '\n'.join(lines)
    results[mineral] = ascii_art
    print(f"  ✓ {mineral}: {len(lines)} lines, {cfg['width']} chars wide")

# Write as JS module
out = PROJECT / "photos" / "mineral-ascii.js"
with open(out, 'w') as f:
    f.write("// Auto-generated ASCII art from real specimen photos\n")
    f.write("const MINERAL_ASCII = ")
    json.dump(results, f, indent=2)
    f.write(";\n")

print(f"\n  Wrote {out}")
