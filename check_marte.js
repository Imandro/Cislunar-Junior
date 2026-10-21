const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Find Marte - try different search
const marteIdx = inline.indexOf("n: 'Marte'");
console.log("Marte at:", marteIdx);

if (marteIdx < 0) {
  // Try without quotes
  const marteIdx2 = inline.indexOf('Marte');
  console.log('Marte (simple) at:', marteIdx2);
  if (marteIdx2 >= 0) {
    console.log('Context:', inline.slice(marteIdx2 - 50, marteIdx2 + 100));
  }
}