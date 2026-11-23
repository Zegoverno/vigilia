#!/usr/bin/env python3
"""Fetch the day's Mass readings from the CNBB Liturgia Diária (Edições CNBB).

Usage: python3 fetch_cnbb.py [YYYY-MM-DD]   (default: today in America/Sao_Paulo)
Prints JSON: {date, celebration, color, season_week, source_url,
              readings: [{kind, reference, refrain?, text}]}
Stdlib only; writes nothing to disk.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime
from html import unescape
from html.parser import HTMLParser

try:
    from zoneinfo import ZoneInfo
    TODAY = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d")
except Exception:  # pragma: no cover
    TODAY = datetime.now().strftime("%Y-%m-%d")

SITE = "https://liturgiadiaria.edicoescnbb.com.br"
API = "https://api-liturgia.edicoescnbb.com.br/contents/in/date/{}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    # The API answers 403 without the site's own Origin/Referer (normal browser headers).
    "Origin": SITE,
    "Referer": SITE + "/",
}


class ToText(HTMLParser):
    """HTML -> text: <br>/<div>/<p> become newlines; verse-number cells become '⟨n⟩ '."""

    def __init__(self):
        super().__init__()
        self.out = []
        self.verse_cell = 0  # depth counter while inside a verse-number div
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        style = (a.get("style") or "").replace(" ", "")
        if tag in ("div", "p", "center", "h3"):
            if "display:none" in style:
                self.skip += 1
                self._skip_tag = tag
                return
            if self.skip:
                self.skip += 1
                return
            self.out.append("\n")
            if tag == "div" and "min-width:30px" in style:
                self.verse_cell = 1
                self.out.append("⟨")
        elif tag == "br" and not self.skip:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("div", "p", "center", "h3"):
            if self.skip:
                self.skip -= 1
                return
            if self.verse_cell:
                self.verse_cell = 0
                self.out.append("⟩ ")
                return
            self.out.append("\n")

    def handle_data(self, data):
        if self.skip:
            return
        if self.verse_cell:
            self.out.append(data.strip())
        else:
            self.out.append(data)

    def text(self):
        t = "".join(self.out).replace("\xa0", " ")
        t = re.sub(r"⟨\s*⟩\s*", "", t)          # empty verse cells
        t = re.sub(r"⟨(\d+[a-z]?)⟩\s*\n+\s*", r"[\1] ", t)  # verse number + its text
        t = re.sub(r"⟨([^⟩]*)⟩\s*", lambda m: f"[{m.group(1)}] " if m.group(1) else "", t)
        lines = [re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n")]
        out, blank = [], False
        for l in lines:
            if not l:
                blank = True
                continue
            if blank and out:
                out.append("")
            out.append(l)
            blank = False
        return "\n".join(out).strip()


def html_text(h):
    p = ToText()
    p.feed(h or "")
    return p.text()


HEAD = re.compile(
    r"^(?:(PRIMEIRA LEITURA|SEGUNDA LEITURA|Salmo responsorial|Aclamação ao Evangelho|"
    r"Sequência|EVANGELHO|Leitura\s*\d*)[ \t]*(?:\((?:mais\s+\w+|forma\s+\w+)\)[ \t]*)?$"
    # e.g. "SEGUNDA LEITURA (mais longa)": the note is dropped with the heading.
    # Some days the CNBB puts the psalm/acclamation reference on the heading's own line
    # ("Salmo responsorial  Sl 1,1-2…"): split there too, keeping the reference in the chunk.
    r"|(Salmo responsorial|Aclamação ao Evangelho|Sequência)[ \t]+(?=\S[^\n]*\d\)?,\s*\d))",
    re.I | re.M)


def kind_of(h):
    h = h.lower()
    if h.startswith("primeira"):
        return "primeira_leitura"
    if h.startswith("segunda"):
        return "segunda_leitura"
    if h.startswith("salmo"):
        return "salmo"
    if h.startswith("aclama"):
        return "aclamacao"
    if h.startswith("sequ"):
        return "sequencia"
    if h.startswith("evangelho"):
        return "evangelho"
    return "leitura"


def parse_body(body):
    text = html_text(body)
    # Two capture groups (own-line heading | inline heading): keep whichever matched.
    raw = HEAD.split(text)
    parts = [raw[0]]
    for k in range(1, len(raw), 3):
        parts += [raw[k] or raw[k + 1] or "", raw[k + 2]]
    readings = []
    # parts = [pre, head1, chunk1, head2, chunk2, ...]
    for i in range(1, len(parts) - 1, 2):
        kind = kind_of(parts[i].strip())
        chunk = parts[i + 1].strip()
        lines = chunk.split("\n")
        r = {"kind": kind, "reference": "", "text": ""}
        # reference: first line containing a chapter,verse pattern
        for j, l in enumerate(lines[:8]):
            m = re.search(r"(\d+(?:\s?\(\d+\))?,\s*\d[\d\-.,a-zR ()]*?)\s*$", l)
            if m and not l.startswith("["):
                book = l[: m.start()].strip()
                r["reference"] = (book + " " + m.group(1)).strip()
                if kind in ("salmo", "aclamacao") and j + 1 < len(lines) and re.match(r"^[\d.() R]+\)?$", lines[j + 1].strip()):
                    r["reference"] += lines[j + 1].strip()
                    j += 1
                # anything before the reference is the summary (antífona)
                summary = " ".join(x for x in lines[:j] if x and not re.search(r"\d+,\d", x))
                if summary and kind not in ("salmo",):
                    r["summary"] = summary
                lines = lines[j + 1:]
                break
        if kind == "salmo":
            for l in lines:
                m = re.match(r"^R\.\s*(.+)$", l)
                if m:
                    r["refrain"] = m.group(1).strip()
                    break
        r["text"] = "\n".join(lines).strip()
        readings.append(r)
    return readings


def main():
    date = sys.argv[1] if len(sys.argv) > 1 else TODAY
    req = urllib.request.Request(API.format(date), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    if "content" not in data:
        raise SystemExit(json.dumps({"error": data}, ensure_ascii=False))
    c = data["content"]
    details = html_text(c.get("details", ""))
    dlines = [l for l in details.split("\n") if l.strip()]
    celebration = ""
    season_week = ""
    m = re.search(r"<b>(.*?)</b>(.*?)</div>", c.get("details", ""), re.S)
    if m:
        celebration = re.sub(r"\s+", " ", unescape(re.sub("<[^>]+>", "", m.group(1)))).strip()
        extra = re.sub(r"\s+", " ", unescape(re.sub("<[^>]+>", "", m.group(2)))).strip(" ,")
        if extra:
            season_week = extra
    out = {
        "date": c.get("date", date),
        "weekday_line": dlines[0] if dlines else "",
        "celebration": celebration or c.get("title", ""),
        "season": c.get("title", ""),
        "season_week": season_week,
        "color": c.get("color", ""),
        "source_url": SITE + "/",
        "readings": parse_body(c.get("body", "")),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
