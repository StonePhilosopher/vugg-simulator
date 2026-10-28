"""Independent high-precision global-volume/density witness; no gameplay imports."""
import json
import argparse
from decimal import Decimal as D, localcontext
from pathlib import Path

BASE = Path(__file__).resolve().parent

def reference():
    sources = json.loads((BASE / 'source-evidence.json').read_text())
    control = json.loads((BASE / 'control.json').read_text())
    w = sources['water']
    with localcontext() as context:
        context.prec = 60
        temperature = D(str(control['temperature']['value'])) + D('273.15')
        alpha = D(w['TR']) / (D(w['TaK']) - temperature)
        beta = D(w['TR']) / (temperature - D(w['TbK']))
        bracket = D(w['a5']) + sum(D(v)*alpha**n for n,v in w['a']) + sum(D(v)*beta**n for n,v in w['b'])
        rho = D(w['p0Pa']) / (D(w['R'])*D(w['TR'])*bracket)
        pi = D('3.14159265358979323846264338327950288419716939937510582097494459')
        radius = D(str(control['cavityRadius']['value']))
        thickness = D(str(control['wallThickness']['value']))
        water_volume = D(4)*pi*radius**3/D(3)
        # Global outer-minus-inner spheres; JS uses local angular integrals.
        shell_volume = D(4)*pi*((radius+thickness)**3-radius**3)/D(3)
        return {'schema':'vugg-physical-reservoir-decimal-reference-v1',
            'method':'Python Decimal precision 60; global sphere difference; source equation 2',
            'densityKgM3':str(+rho), 'waterVolumeMm3':str(+water_volume),
            'wallVolumeMm3':str(+shell_volume), 'waterKg':str(+(water_volume*rho/D('1e9'))),
            'calciteMol':str(+(shell_volume/(D(1000)*D(sources['calcite']['molarVolumeCm3Mol']))))}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = json.dumps(reference(), indent=2) + '\n'
    output = BASE / 'reference.json'
    if args.write:
        output.write_text(text, encoding='utf-8', newline='\n')
    if args.check and output.read_text(encoding='utf-8') != text:
        raise ValueError('High-precision reference is stale')
    print(text, end='')
