const fs = require('fs');
const html = fs.readFileSync('Cislunar Junior - Cañon Labs.html', 'utf8');
console.log('Has DOCTYPE (case-insensitive):', /<!doctype html>/i.test(html));
console.log('Module scripts:', (html.match(/<script src="js\//g) || []).length);
const inlineScripts = (html.match(/<script>([\s\S]*?)<\/script>/g) || []).filter(s => !s.includes('src='));
console.log('Inline scripts (no src):', inlineScripts.length);
inlineScripts.forEach((s, i) => console.log(`  [${i}] ${s.substring(0, 80)}...`));