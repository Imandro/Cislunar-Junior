/* Imprime el resumen de un test (admite salida UTF-16 de PowerShell). */
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  let t;
  if (b[0] === 0xff && b[1] === 0xfe) t = b.toString('utf16le');
  else t = b.toString('utf8');
  t = t.replace(/^\uFEFF/, '');
  console.log('== ' + f);
  t.split(/\r?\n/).forEach(l => {
    if (l.includes('comprobaciones') || l.includes('CORRECTO') || l.includes('FALLO')) console.log(l.trim());
  });
}
