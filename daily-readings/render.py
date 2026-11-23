#!/usr/bin/env python3
"""Build the daily-readings message: CNBB text verbatim, the LLM's notes around it.

Usage: python3 render.py readings.json notes.json > message.md

readings.json: the output of fetch_cnbb.py. The Scripture comes only from here.
notes.json: what the LLM writes, never Scripture text:
  {"titles":  {"primeira_leitura": "Gálatas 5,1-6", ...},     (optional, short reference)
   "context": {"primeira_leitura": "one or two lines", ...},  (per reading kind)
   "em_poucas_palavras": ["bullet", "bullet"],
   "para_levar": {"frase": "exact words from the readings", "ref": "Gl 5,6"}}

After building, it checks that every reading's words appear in the message in order and
unchanged, and that "para_levar" is a phrase from the readings; on any failure it exits 1
and prints nothing to stdout. Stdlib only; writes nothing to disk.
"""
import json
import re
import sys

LABEL = {
    "primeira_leitura": "1ª Leitura",
    "segunda_leitura": "2ª Leitura",
    "salmo": "Salmo",
    "aclamacao": "Aclamação ao Evangelho",
    "sequencia": "Sequência",
    "evangelho": "Evangelho",
    "leitura": "Leitura",
}
COLOR = {"verde": "🟩", "vermelho": "🟥", "roxo": "🟪", "branco": "⬜", "rosa": "🩷", "preto": "⬛"}
CLOSINGS = ("Palavra do Senhor.", "Palavra da Salvação.")


def split_reference(ref):
    """'Leitura da Carta ... aos Gálatas 5,1-6' -> ('Leitura da Carta ... aos Gálatas', '5,1-6')."""
    m = re.search(r"\s(\d+(?:\(\d+\))?,.*)$", ref)
    # Only a spoken announcement ("Leitura da…", "Proclamação do…") is an intro; "Sl 118…" stays whole.
    if not m or len(ref[: m.start()].split()) < 3:
        return "", ref.strip()
    return ref[: m.start()].strip(), m.group(1).strip()


def body(text, kind):
    """The text as Markdown: a blank line only before a verse or the closing; verses in bold."""
    lines = text.split("\n")
    out = []
    for i, l in enumerate(lines):
        if not l.strip():
            nxt = next((x for x in lines[i + 1:] if x.strip()), "")
            if re.match(r"^\[\d", nxt) and out and out[-1] != "":
                out.append("")
            continue
        if l.strip() in CLOSINGS and out and out[-1] != "":
            out.append("")
        l = re.sub(r"^\[(\d+[a-z]?)\]\s*", r"**\1** ", l)
        if kind == "salmo":
            l = re.sub(r"\sR\.$", " **R.**", l)
            l = re.sub(r"^R\. (.+)$", r"**R. \1**", l)
        out.append(l)
    # verse paragraphs: a blank line before each new verse
    res = []
    for l in out:
        if l.startswith("**") and re.match(r"^\*\*\d", l) and res and res[-1] != "":
            res.append("")
        res.append(l)
    return "\n".join(res).strip()


def build(d, notes):
    titles, ctx = notes.get("titles", {}), notes.get("context", {})
    color = d.get("color", "")
    head = [f"📖 **Liturgia de {d.get('weekday_line', d.get('date', ''))}**"]
    sub = " · ".join(x for x in [color.capitalize(), d.get("celebration", ""), d.get("season_week", "")] if x)
    head.append(f"{COLOR.get(color.lower(), '')} {sub}".strip())
    parts = ["\n".join(head)]
    for r in d["readings"]:
        k = r["kind"]
        intro, short = split_reference(r.get("reference", ""))
        sec = [f"**{LABEL.get(k, k)} — {titles.get(k) or short or r.get('reference', '')}**"]
        if ctx.get(k):
            sec.append(f"_{ctx[k].strip()}_")
        if intro:
            sec.append(("✠ " if k == "evangelho" else "") + intro)
        sec.append(body(r["text"], k))
        parts.append("\n\n".join(sec))
    tail = []
    bullets = notes.get("em_poucas_palavras", [])
    if bullets:
        tail.append("**Em poucas palavras**\n" + "\n".join(f"- {b.strip()}" for b in bullets))
    pl = notes.get("para_levar") or {}
    if pl.get("frase"):
        ref = f" ({pl['ref']})" if pl.get("ref") else ""
        tail.append(f"**Para levar no dia**\n✨ _\"{pl['frase'].strip()}\"_{ref}")
    tail.append(f"Fonte: Liturgia Diária – Edições CNBB\n{d.get('source_url', '')}")
    parts.append("\n\n".join(tail))
    return "\n\n---\n\n".join(parts) + "\n"


def words(s):
    """The words of a text, without Markdown, verse markers or punctuation spacing."""
    s = re.sub(r"\[\d+[a-z]?\]|\*\*\d+[a-z]?\*\*", " ", s)
    s = s.replace("*", " ").replace("_", " ")
    return re.findall(r"\w+|[^\w\s]", s)


def contains_in_order(hay, needle):
    n, h = len(needle), len(hay)
    return any(hay[i:i + n] == needle for i in range(h - n + 1))


def check(d, notes, msg):
    errors = []
    mw = words(msg)
    for r in d["readings"]:
        if not contains_in_order(mw, words(r["text"])):
            errors.append(f"{r['kind']}: the CNBB text is not in the message unchanged")
    frase = (notes.get("para_levar") or {}).get("frase", "")
    if frase:
        allw = [w for r in d["readings"] for w in words(r["text"])]
        fw = [w for w in words(frase) if re.match(r"\w", w)]
        aw = [w for w in allw if re.match(r"\w", w)]
        if not contains_in_order([w.lower() for w in aw], [w.lower() for w in fw]):
            errors.append("para_levar.frase is not a phrase from the readings")
    return errors


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    notes = json.load(open(sys.argv[2], encoding="utf-8"))
    if not d.get("readings"):
        raise SystemExit("no readings in " + sys.argv[1])
    msg = build(d, notes)
    errors = check(d, notes, msg)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    sys.stdout.write(msg)


if __name__ == "__main__":
    main()
