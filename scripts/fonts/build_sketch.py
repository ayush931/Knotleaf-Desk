"""Build Knotleaf Sketch from pinned OFL sources; not required for app builds.

Run in a venv with fonttools==4.68.0 and brotli==1.2.1 installed.
"""
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REVISION = "43932aa9375e60fbcb930b0f865f2f60eae9d206"
BASE = f"https://raw.githubusercontent.com/arrowtype/shantell-sans/{REVISION}/"
OUTPUT = Path(__file__).resolve().parents[2] / "public/fonts/knotleaf-sketch"
SOURCES = {
    "ShantellSans[BNCE,INFM,SPAC,wght].ttf": "d98a7913853f78d71aa0b86daf66b5eddb5a3266c07bfd51ef70632b88c41084",
    "ShantellSans-Italic[BNCE,INFM,SPAC,wght].ttf": "269eb72414b3e7eb66fe5159ce507a61266485c41dbcbc1b44a25fadeb4a2c71",
}


def download(path, digest):
    with urlopen(BASE + quote(path), timeout=60) as response:
        data = response.read()
    if sha256(data).hexdigest() != digest:
        raise ValueError(f"Source checksum changed: {path}")
    return data


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source, digest in SOURCES.items():
        font = TTFont(BytesIO(download("fonts/shantell_sans-for-googlefonts/" + source, digest)))
        # Open marker shapes, restrained baseline bounce and a little breathing room.
        # Keep a real weight axis and separate real italic outlines for formatting.
        instantiateVariableFont(font, {"INFM": 30, "BNCE": 8, "SPAC": 6, "wght": (400, 500, 700)}, inplace=True)
        # Fix a restrained set of hand-drawn alternates per letter. Contextual
        # randomization would otherwise choose different glyphs in a DOM run and
        # the canvas renderer's independently styled character runs.
        alternates = {"a": "a.alt1", "e": "e.alt2", "g": "g.alt1", "r": "r.alt2", "t": "t.alt1", "y": "y.alt3"}
        for table in font["cmap"].tables:
            if table.isUnicode():
                for letter, glyph in alternates.items():
                    if ord(letter) in table.cmap and glyph in font.getGlyphOrder():
                        table.cmap[ord(letter)] = glyph
        options = subset.Options()
        options.layout_features = [tag for tag in options.layout_features if tag != "calt"]
        options.name_IDs = ["*"]
        options.name_legacy = True
        options.name_languages = ["*"]
        # Axis clipping can remove an invariant glyph's empty gvar entry.
        # Keep empty entries explicit before the subsetter prunes glyphs.
        for glyph in font.getGlyphOrder():
            font["gvar"].variations.setdefault(glyph, [])
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=font.getBestCmap().keys())
        subsetter.subset(font)
        italic = "Italic" in source
        style = "Italic" if italic else "Regular"
        postscript = "KnotleafSketch-Italic" if italic else "KnotleafSketch-Regular"
        names = font["name"]
        replacements = {
            1: "Knotleaf Sketch", 2: style, 3: f"1.000;Knotleaf;{postscript}",
            4: f"Knotleaf Sketch {style}", 6: postscript,
            10: "Knotleaf whiteboard tuning of Shantell Sans: INFM 30, BNCE 8, SPAC 6. Licensed under OFL-1.1.",
            16: "Knotleaf Sketch", 17: style, 18: f"Knotleaf Sketch {style}",
            25: "KnotleafSketch",
        }
        for record in list(names.names):
            if record.nameID in replacements:
                names.setName(replacements[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
        for name_id, value in replacements.items():
            names.setName(value, name_id, 3, 1, 0x409)
        # Upstream named-instance PostScript names identify the original family.
        font["fvar"].instances = []
        font.recalcTimestamp = False
        font.flavor = "woff2"
        target = OUTPUT / ("knotleaf-sketch-italic.woff2" if italic else "knotleaf-sketch.woff2")
        font.save(target)
        print(f"{target.name}: {target.stat().st_size:,} bytes")
    (OUTPUT / "OFL.txt").write_bytes(download("OFL.txt", "ebfce7d104d597c385b71e9fbf8f0e2034e73320f857086105dc265b82c05caa"))


if __name__ == "__main__":
    build()
