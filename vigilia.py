#!/usr/bin/env python3
"""Generate a Catholic routine in Markdown; Python 3.10+, no dependencies."""
import argparse
import datetime as dt
import json
import os
import random
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
CATALOG = {item["id"]: item for item in json.loads((ROOT / "catalog.json").read_text())}
DATA = json.loads((ROOT / "content.json").read_text())
ZONE = ZoneInfo("America/Sao_Paulo")


def legacy(path, *args):
    return subprocess.check_output([sys.executable, "-I", str(ROOT / "routines" / path),
                                    *map(str, args)], encoding="utf-8")


def publish(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     delete=False) as stream:
        tmp = Path(stream.name)
        try:
            stream.write(body)
            stream.close()
            tmp.replace(path)
        finally:
            tmp.unlink(missing_ok=True)


def publish_note(root, name, body):
    # Pin the directory; never follow a symlink named Vigilia, even during a rename.
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open(root, flags)
    try:
        try:
            os.mkdir("Vigilia", dir_fd=fd)
        except FileExistsError:
            pass
        folder = os.open("Vigilia", flags, dir_fd=fd)
        try:
            publish(Path(f"/proc/self/fd/{folder}") / name, body)
        finally:
            os.close(folder)
    finally:
        os.close(fd)


def generate(args):
    kind, day = args.routine, args.date
    entry = CATALOG[kind]
    source = entry.get("source")
    if kind in ("sao-jose", "angelus", "exame"):
        return legacy("devotion_legacy.py", kind, day)
    if kind == "leituras":
        if not args.readings or not args.notes:
            raise ValueError("leituras exige --readings e --notes; veja fetch-readings e a skill.")
        readings = json.loads(args.readings.read_text())
        if str(readings.get("date", ""))[:10] != day.isoformat():
            raise ValueError("O arquivo de leituras não corresponde à data solicitada.")
        return legacy("readings/render.py", args.readings, args.notes)
    title = entry["title"]
    if kind == "santos":
        body = DATA[kind].get(day.strftime("%m-%d"), "Não há uma entrada nesta seleção para hoje.")
    elif kind in ("biblia", "salmo"):
        ref, chapter = random.Random(f"vigilia:{kind}:{day}").choice(DATA[kind])
        source = f"https://bible.usccb.org/bible/{chapter}"
        body = f"**{ref}**\n\nLeia a passagem, fique um instante em silêncio e leve uma frase para a oração. A fonte abre o capítulo em inglês (USCCB); use a sua Bíblia em português, se preferir."
    elif kind == "novena":
        if args.start is None:
            raise ValueError("novena exige --start AAAA-MM-DD.")
        n = (day - args.start).days
        if not 0 <= n < 9:
            raise ValueError("Data fora dos nove dias da novena.")
        title += f" · dia {n + 1}/9"
        body = f"Apresente a sua intenção a Deus.\n\n{DATA[kind][n]}\n\nSão José, rogai por nós.\n\nReze um Pai-Nosso.\n\nRoteiro original inspirado na carta apostólica Patris corde."
    else:
        body = DATA[kind]
    return f"# {title}\n\n{day:%d/%m/%Y}\n\n{body}\n\n[Consultar a fonte]({source})\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("routine", choices=[*CATALOG, "catalog", "fetch-readings"])
    parser.add_argument("--date", type=dt.date.fromisoformat, default=dt.datetime.now(ZONE).date())
    parser.add_argument("--start", type=dt.date.fromisoformat)
    parser.add_argument("--readings", type=Path)
    parser.add_argument("--notes", type=Path)
    parser.add_argument("--report", type=Path, help="Write the job report here as well as stdout.")
    args = parser.parse_args()
    try:
        if args.routine == "catalog":
            body = (ROOT / "catalog.json").read_text()
        elif args.routine == "fetch-readings":
            body = legacy("readings/fetch_cnbb.py", args.date)
        else:
            body = generate(args)
            vault = os.getenv("VIGILIA_VAULT")
            base = os.getenv("VIGILIA_WEB_URL")
            if base and not vault:
                raise ValueError("VIGILIA_WEB_URL requer VIGILIA_VAULT.")
            if vault:
                root = Path(vault)
                if not root.is_absolute() or not root.is_dir():
                    raise ValueError("VIGILIA_VAULT deve ser um diretório absoluto existente.")
                note = root.resolve() / "Vigilia" / f"{args.date}-{args.routine}.vigilia.md"
                if base:
                    url = urlsplit(base)
                    if (url.scheme not in ("https", "http") or not url.hostname or
                            url.username is not None or any(c in base for c in "?#()<>\\") or
                            any(c.isspace() or ord(c) < 32 for c in base)):
                        raise ValueError("VIGILIA_WEB_URL deve ser uma URL web sem credenciais, query ou fragmento.")
                publish_note(note.parent.parent, note.name, body)
                if base:
                    query = urlencode({"view": "files", "file": str(note)})
                    body += f"\n[Abrir no Vigília]({base}?{query})\n"
        if args.report:
            publish(args.report, body)
        sys.stdout.write(body)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"vigilia: {exc}\n")


if __name__ == "__main__":
    main()
