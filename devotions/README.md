# devotions

`devotion.py {sao-jose|angelus|exame} [YYYY-MM-DD]` prints a fixed devotion message for the zenbot
jobs `sao-jose-trabalho` (09:00), `angelus` (12:00) and `exame-consciencia` (21:00), all
America/Sao_Paulo. No LLM and no network: the prayers are in `texts/`, and each job posts
`out/<name>.md` as is (`report_file`).

- `angelus` sends the Regina Caeli from Easter Sunday to Pentecost (Easter by the Gregorian
  computus; checked for 2026 and 2027).
- `exame` picks two questions from two different areas of `texts/exame.json`, seeded by the date.
  Edit that file to change the list.

## Exame sources

`sources/*.json` hold the questions word for word with their URLs (Opus Dei, Pe. Francisco Faus,
Pe. Paulo Ricardo, Pe. Paulo Ramalho / Fé com Virtudes, CNBB). `build_exame.py` merges them into
`texts/exame.json`, dropping duplicates and long items (see EXCLUDE), and capitalising only the first letter.
