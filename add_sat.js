const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Get the inline script
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Find where to insert SAT (before SLS)
const slsIdx = inline.indexOf('var SLS =');
const satCode = `var SAT = [
  { h:34, w:23, c:'#e6ebf1' }, { h:5, w:24, c:'#2c333d' },
  { h:26, w:21, c:'#e6ebf1' }, { h:4, w:22, c:'#2c333d' },
  { h:16, w:16, c:'#e6ebf1' }, { h:9, w:12, c:'#c8d2dc' },
  { h:7, w:7,  c:'#9aa6b4' },  { h:6, w:4.4, c:'#e6ebf1', cono:1 },
  { h:9, w:1.6, c:'#8fc9ff' }
];

`;

// Find the position in the full HTML
const fullHtmlIdx = html.indexOf(inline);
const insertPos = fullHtmlIdx + slsIdx;

html = html.slice(0, insertPos) + satCode + html.slice(insertPos);

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Added SAT array back');