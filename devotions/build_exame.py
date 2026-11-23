#!/usr/bin/env python3
"""Build texts/exame.json from the verbatim source lists in sources/.

Usage: python3 -I build_exame.py   (rerun after editing sources/ or EXCLUDE)

Questions stay word for word; only the first letter is capitalised for display. Each keeps a
short source label, shown in the message. EXCLUDE drops, by index in each source file,
duplicates (Opus Dei's "pedido de perdão" page repeats Pope Francis's list, kept here from the
CNBB), long quotes and items that don't stand alone.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXCLUDE = {
    "opusdei-faus.json": {5, 14, 15, 36, 37, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51,
                          52, 55, 56, 58, 65},
    "padre-paulo-ricardo.json": {5, 13},
    "ramalho-cnbb.json": {0, 1, 2},  # Pe. Ramalho's 3 basic questions close every message
}
LABELS = [
    ("clerus.org", "Pe. Francisco Faus"),
    ("opusdei.org", "Opus Dei"),
    ("padrepauloricardo", "Pe. Paulo Ricardo"),
    ("fecomvirtudes", "Pe. Paulo Ramalho"),
    ("cnbbsul1", "CNBB Sul 1"),
    ("cnbb.org.br", "CNBB · Papa Francisco"),
]


def label(url):
    for key, name in LABELS:
        if key in url:
            return name
    raise SystemExit(f"no label for {url}")


def main():
    areas = {}
    for f in sorted((HERE / "sources").glob("*.json")):
        qs = json.loads(f.read_text(encoding="utf-8"))["questions"]
        for i, q in enumerate(qs):
            if i in EXCLUDE.get(f.name, ()):
                continue
            text = q["q"].strip()
            text = text[0].upper() + text[1:]
            text = text.replace("pensamento quando com", "pensamento quanto com")  # typo on cnbb.org.br
            areas.setdefault(q["area"], []).append({"q": text, "fonte": label(q["url"])})
    out = {"_about": "Gerado por build_exame.py a partir de sources/ (texto literal das fontes)."}
    out.update(dict(sorted(areas.items())))
    (HERE / "texts" / "exame.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print({k: len(v) for k, v in areas.items()}, sum(len(v) for v in areas.values()))


if __name__ == "__main__":
    main()
