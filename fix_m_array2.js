const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find the end of Marte mission in M array
const marteIdx = html.indexOf('Marte', 21165);

let braceCount = 0;
let inObj = false;
let endIdx = -1;
for (let i = marteIdx; i < html.length; i++) {
  if (html[i] === '{') { braceCount++; inObj = true; }
  else if (html[i] === '}') { 
    braceCount--; 
    if (inObj && braceCount === 0) { 
      endIdx = i + 1; 
      break;
    } 
  }
}

// The structure after Marte mission is: "  ]\n},   ]\n}];\n\n{ h:5..."
// We need to replace from the comma after the mission object to before SAT with just "  ]\n}];\n\n"

// Find the comma after the mission object
let pos = endIdx;
while (pos < html.length && html[pos] !== ',') pos++;
console.log('Comma at:', pos);

// Find the start of SAT array
const satStart = html.indexOf('{ h:5, w:24', pos);
console.log('SAT at:', satStart);

// Replace from comma to SAT with proper closing
const before = html.slice(0, pos);
const after = html.slice(satStart);
html = before + '\n  ]\n};\n\n' + after;

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Fixed M array closing properly');