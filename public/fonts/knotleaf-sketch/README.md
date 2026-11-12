# Knotleaf Sketch

A custom whiteboard tuning of **Shantell Sans**, designed by Shantell Martin
with Arrow Type. This is a derivative font, not an independently drawn typeface
or a copy of Excalifont. The upright marker-letter direction takes inspiration
from hand-drawn whiteboards, with open counters and restrained irregularity.

- Informality 30/100; bounce 8/100; spacing 6/100.
- Real variable weights 400–700 and separate true italic outlines.
- Fixed hand-drawn alternates for a, e, g, r, t and y; contextual randomization
  is disabled so canvas glyph runs and editable text use consistent letters.
- All upstream Unicode coverage retained (Latin, Greek and Cyrillic). Other
  scripts use the existing browser fallback stack.
- Saved `sketch` font ID; existing `hand` remains Caveat.

Source: https://github.com/arrowtype/shantell-sans
Pinned revision: 43932aa9375e60fbcb930b0f865f2f60eae9d206

Copyright 2022 The Shantell Sans Project Authors.
Distributed under SIL Open Font License 1.1; see OFL.txt in this directory.
The original copyright, authorship and license metadata are retained in the
font files. Knotleaf-specific family/PostScript names distinguish this build.

To rebuild, create a Python venv, install `fonttools==4.68.0 brotli==1.2.1`, then
run `python scripts/fonts/build_sketch.py` from the repository root. The script
verifies SHA-256 digests before processing source fonts and license. Generated
WOFF2 files are checked in; app builds and editing require no font-generator
installation or third-party font request.
