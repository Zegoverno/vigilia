#!/usr/bin/env python3
"""Build a devotion message for a zenbot job. No LLM, no network; stdlib only.

Usage: python3 -I devotion.py {sao-jose|angelus|exame} [YYYY-MM-DD] > out/NAME.md

- sao-jose: the prayer to St Joseph to sanctify work, verbatim from texts/.
- angelus: the Angelus; the Regina Caeli instead in Easter time (Easter Sunday to Pentecost).
- exame: two examination-of-conscience questions from texts/exame.json, from two different
  areas, picked at random (seeded by the date, so a re-run the same day gives the same pair).
The date defaults to today in America/Sao_Paulo.
"""
import datetime as dt
import json
import random
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
TEXTS = HERE / "data" / "texts"
WEEKDAY = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def easter(y):
    """Gregorian Easter Sunday (anonymous Gregorian algorithm)."""
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(y, month, day)


def angelus(day):
    e = easter(day.year)
    paschal = e <= day <= e + dt.timedelta(days=49)
    return (TEXTS / ("regina-caeli.md" if paschal else "angelus.md")).read_text(encoding="utf-8")


def exame(day):
    groups = json.loads((TEXTS / "exame.json").read_text(encoding="utf-8"))
    groups = {k: v for k, v in groups.items() if not k.startswith("_")}
    rng = random.Random(day.toordinal())
    picked = [rng.choice(groups[g]) for g in rng.sample(sorted(groups), 2)]
    return "\n".join([
        f"🌙 **Exame de consciência** · {WEEKDAY[day.weekday()]}, {day:%d/%m}",
        "",
        "_Faça um instante de silêncio e peça luz ao Espírito Santo._",
        "",
        *[f"{i}. {p['q']}\n   _— {p['fonte']}_" for i, p in enumerate(picked, 1)],
        "",
        "_O que fiz de bom hoje? O que fiz de ruim? O que posso fazer amanhã para melhorar?_",
        "_— Pe. Paulo Ramalho_",
        "",
    ])


def main():
    if len(sys.argv) not in (2, 3) or sys.argv[1] not in ("sao-jose", "angelus", "exame"):
        raise SystemExit(__doc__)
    day = (dt.date.fromisoformat(sys.argv[2]) if len(sys.argv) == 3
           else dt.datetime.now(ZoneInfo("America/Sao_Paulo")).date())
    kind = sys.argv[1]
    if kind == "sao-jose":
        msg = (TEXTS / "sao-jose-trabalho.md").read_text(encoding="utf-8")
    elif kind == "angelus":
        msg = angelus(day)
    else:
        msg = exame(day)
    sys.stdout.write(msg)


if __name__ == "__main__":
    main()
