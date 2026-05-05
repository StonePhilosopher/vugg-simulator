"""Entry point for `python -m vugg` — preserves the legacy `python vugg.py` CLI.

The real CLI body lives in vugg/__init__.py as `main()`. This file is a thin
shim so module-style invocation works after the vugg.py → vugg/ package move.
"""
from . import main

if __name__ == "__main__":
    main()
