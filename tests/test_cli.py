import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / 'routines/readings/test'


def run(*args, **env):
    return subprocess.run(['python3', '-I', *map(str, args)], cwd=ROOT,
                          env={**os.environ, 'VIGILIA_VAULT':'', 'VIGILIA_WEB_URL':'', **env},
                          capture_output=True, text=True)


class Cli(unittest.TestCase):
    def test_legacy(self):
        for name, date in [('angelus','2026-04-05'),('angelus','2026-05-25'),
                           ('sao-jose','2026-11-23'),('exame','2026-11-23')]:
            old = run('routines/devotion_legacy.py',name,date)
            new = run('vigilia.py',name,'--date',date)
            self.assertEqual(new.returncode,0,new.stderr)
            self.assertEqual(old.returncode,0,old.stderr)
            self.assertEqual(old.stdout.encode(),new.stdout.encode())
        self.assertIn('Regina Caeli',run('vigilia.py','angelus','--date','2026-04-05').stdout)
        self.assertIn('Ângelus',run('vigilia.py','angelus','--date','2026-05-25').stdout)

    def test_notes_and_report(self):
        with tempfile.TemporaryDirectory(prefix='vigília teste ') as tmp:
            out = Path(tmp) / 'out' / 'exame.md'
            result = run('vigilia.py','exame','--date','2026-11-23','--report',out,
                         VIGILIA_VAULT=tmp,VIGILIA_WEB_URL='https://example.test/zen')
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(out.read_text(),result.stdout)
            href = result.stdout.split('[Abrir no Vigília](')[1].split(')')[0]
            query = parse_qs(urlsplit(href).query)
            note = Path(query['file'][0])
            self.assertEqual(query['view'],['files'])
            self.assertEqual(note,Path(tmp)/'Vigilia/2026-11-23-exame.vigilia.md')
            self.assertIn('Pe. Paulo Ramalho',note.read_text())
            self.assertNotIn('Abrir no Vigília',note.read_text())

    def test_readings(self):
        readings = FIX/'readings-2026-10-13.json'
        notes = FIX/'notes-2026-10-13.json'
        args = ('vigilia.py','leituras','--readings',readings)
        good = run(*args,'--notes',notes,'--date','2026-10-13')
        self.assertEqual(good.returncode,0,good.stderr)
        old = run('routines/readings/render.py',readings,notes)
        self.assertEqual(old.returncode,0,old.stderr)
        self.assertEqual(old.stdout.encode(),good.stdout.encode())
        self.assertIn('É para a liberdade que Cristo nos libertou',good.stdout)
        self.assertNotEqual(run(*args,'--notes',notes,'--date','2026-11-23').returncode,0)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'bad.json'
            n = json.loads(notes.read_text())
            n['para_levar']['frase'] = 'Um versículo inventado'
            path.write_text(json.dumps(n))
            self.assertNotEqual(run(*args,'--notes',path,'--date','2026-10-13').returncode,0)

    def test_reject_vault_symlink_and_invalid_url(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as outside:
            (Path(tmp) / 'Vigilia').symlink_to(outside, target_is_directory=True)
            self.assertNotEqual(run('vigilia.py','angelus',VIGILIA_VAULT=tmp).returncode,0)
            self.assertEqual(list(Path(outside).iterdir()),[])
        with tempfile.TemporaryDirectory() as tmp:
            result = run('vigilia.py','angelus',VIGILIA_VAULT=tmp,
                         VIGILIA_WEB_URL='https://example.test/)oops')
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(list(Path(tmp).iterdir()),[])

    def test_catalog_and_additions(self):
        self.assertEqual(len(json.loads(run('vigilia.py','catalog').stdout)),9)
        for name, snippet in [('santos','Clemente'),('confissao','1450–1460'),
                              ('salmo','bible.usccb.org/bible/psalms'),('biblia','bible.usccb.org/bible/')]:
            r = run('vigilia.py',name,'--date','2026-11-23')
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertIn(snippet,r.stdout)
            self.assertEqual(r.stdout,run('vigilia.py',name,'--date','2026-11-23').stdout)
        self.assertIn('dia 9/9',run('vigilia.py','novena','--start','2026-11-15','--date','2026-11-23').stdout)
        self.assertNotEqual(run('vigilia.py','novena','--start','2026-11-14','--date','2026-11-23').returncode,0)
