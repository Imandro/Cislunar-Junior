const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Find all missions in M array
const mIdx = inline.indexOf('var M = [');
let braceCount = 0;
let inArray = false;
let missionCount = 0;
let missionStarts = [];
let missionEnds = [];

for (let i = mIdx; i < inline.length; i++) {
  if (inline[i] === '[') { braceCount++; inArray = true; }
  else if (inline[i] === ']') { 
    braceCount--; 
    if (inArray && braceCount === 0) { 
      console.log('M array ends at:', i);
      break;
    } 
  }
  
  // Detect mission objects (top-level objects in M array)
  if (inline[i] === '{' && braceCount === 2) { // Inside M array (braceCount=1) and mission object (braceCount=2)
    missionStarts.push(i);
  }
  if (inline[i] === '}' && braceCount === 1) { // Closing mission object
    missionEnds.push(i);
    missionCount++;
  }
}

console.log('Mission count:', missionCount);
console.log('Mission starts:', missionStarts);
console.log('Mission ends:', missionEnds);

// Check each mission name
missionStarts.forEach((start, idx) => {
  const snippet = inline.slice(start, start + 100);
  const nameMatch = snippet.match(/n:\s*'([^']+)'/);
  console.log('Mission', idx, ':', nameMatch ? nameMatch[1] : 'unknown');
});