# daily-readings

`fetch_cnbb.py [YYYY-MM-DD]` prints the day's Mass readings (JSON) from the CNBB's official
Liturgia Diária (https://liturgiadiaria.edicoescnbb.com.br/). Stdlib only, writes nothing.

## Endpoint

- `GET https://api-liturgia.edicoescnbb.com.br/contents/in/date/YYYY-MM-DD`
  (found in the site's Next.js chunk `/_next/static/chunks/dba5295767….js`).
- Returns 403 unless the request carries the site's normal browser headers
  `Origin: https://liturgiadiaria.edicoescnbb.com.br` and `Referer: …/`. No token or login.
- Response: `{content: {date, title (season), color, details (HTML header: weekday, celebration,
  readings list), leituras (HTML), body (HTML with all readings)}}`.
- In `body`, sections start with red headings (PRIMEIRA LEITURA, Salmo responsorial,
  Aclamação ao Evangelho, EVANGELHO…); verse numbers sit in `div`s with `min-width: 30px`.
  The script turns them into `[n]` markers.

## The message

`render.py readings.json notes.json` builds the Matrix message: the CNBB text verbatim (laid out,
verse numbers in bold) and the job's LLM notes around it (`notes.json`: titles, context lines, "Em
poucas palavras", "Para levar no dia"). It checks that every reading is in the message word for word
and that "Para levar no dia" is a phrase from the readings, and exits 1 otherwise. So the LLM writes
only the notes, never the Scripture. Test: `python3 -I render.py test/readings-2026-10-13.json
test/notes-2026-10-13.json`.

The job writes its working files to `out/` (git-ignored, overwritten each run): `readings.json`,
`notes.json` and `message.md`, which the kernel posts as the job's report (`report_file`, zenbot D-055).
No archive of the texts is kept: only the scripts, this README and `test/` are kept.
