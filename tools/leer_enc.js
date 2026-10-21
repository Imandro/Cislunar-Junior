/* Lee la salida UTF-16 de PowerShell y muestra los resultados verbose. */
const fs = require('fs');
const os = require('os');
const p = process.argv[2] || (os.tmpdir() + '\\enc.txt');
let t;
try { t = fs.readFileSync(p, 'utf16le'); } catch (e) { t = fs.readFileSync(p, 'utf8'); }
t = t.replace(/^\uFEFF/, '');
t.split(/\r?\n/).forEach(l => {
  if (l.includes('Y[') || l.includes('ERRORES') || l.includes('listo')) {
    console.log(l.replace(/"/g, '').trim());
  }
});
