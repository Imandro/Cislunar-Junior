import sys, io, os
p = os.path.join(os.environ.get('TEMP', '.'), 'enc.txt')
t = io.open(p, encoding='utf-16', errors='replace').read()
for l in t.splitlines():
    if '=>' in l or 'ERRORES' in l or '✗' in l or 'Error' in l:
        print(l.replace('Â', '').replace('"', '').strip())
