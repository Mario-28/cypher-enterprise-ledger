"""Offline merger: creates a complete ZIP from your own v2.3.1 module folder."""
from pathlib import Path
import argparse, json, tempfile, shutil, zipfile

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('base',type=Path,help='Existing cypher-enterprise-ledger v2.3.1 directory')
    p.add_argument('--output',type=Path,default=Path('cypher-enterprise-ledger-v2.4.0-complete.zip'))
    args=p.parse_args();base=args.base.resolve();update=Path(__file__).resolve().parent
    source=json.loads((base/'module.json').read_text(encoding='utf8'))
    if source.get('id')!='cypher-enterprise-ledger' or source.get('version')!='2.3.1':
        raise SystemExit('Expected a complete Cypher Enterprise Ledger v2.3.1 source directory.')
    if not (base/'styles/themes.css').is_file() or not (base/'assets/themes').is_dir() or not (base/'fonts').is_dir():
        raise SystemExit('The base folder is missing theme files/assets/fonts; use a complete v2.3.1 installation.')
    with tempfile.TemporaryDirectory() as tmp:
        dest=Path(tmp)/'cypher-enterprise-ledger';shutil.copytree(base,dest)
        for rel in ['module.json','scripts/monthly-engine.mjs','scripts/task-planner.mjs','styles/task-planner.css','README-MONTHLY-PLANNER.md','VALIDATION-MONTHLY.md','tests/monthly-engine.test.mjs']:
            f=update/rel
            if f.is_file():
                (dest/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest/rel)
        m=json.loads((dest/'module.json').read_text())
        for rel in [*m['esmodules'],*m['styles'],*[l['path'] for l in m['languages']]]:
            if not (dest/rel).is_file():raise SystemExit('Missing runtime file: '+rel)
        with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED) as z:
            for f in sorted(dest.rglob('*')):
                if f.is_file():z.write(f,str(Path(dest.name)/f.relative_to(dest)))
        with zipfile.ZipFile(args.output) as z:
            if z.testzip() is not None:raise SystemExit('ZIP verification failed.')
    print(f'Created {args.output} ({args.output.stat().st_size:,} bytes). Source installation was not changed.')
if __name__=='__main__':main()
