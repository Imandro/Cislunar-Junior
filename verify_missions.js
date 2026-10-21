const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Check missions
const mIdx = inline.indexOf('var M = [');
let braceCount = 0;
let inArray = false;
let missionStarts = [];

for (let i = mIdx; i < inline.length; i++) {
  if (inline[i] === '[') { braceCount++; inArray = true; }
  else if (inline[i] === ']') { 
    braceCount--; 
    if (inArray && braceCount === 0) break; 
  }
  
  if (inline[i] === '{' && braceCount === 2) {
    missionStarts.push(i);
  }
}

console.log('Mission count:', missionStarts.length);
missionStarts.forEach((start, idx) => {
  const snippet = inline.slice(start, start + 100);
  const nameMatch = snippet.match(/n:\s*'([^']+)'/);
  console.log('Mission', idx, ':', nameMatch ? nameMatch[1] : 'unknown');
});

// Check event counts
missionStarts.forEach((start, idx) => {
  let bc = 0;
  let inObj = false;
  let end = -1;
  for (let i = start; i < inline.length; i++) {
    if (inline[i] === '{') { bc++; inObj = true; }
    else if (inline[i] === '}') { bc--; if (inObj && bc === 0) { end = i; break; } }
  }
  const mission = inline.slice(start, end + 1);
  const events = (mission.match(/\{ p:/g) || []).length;
  console.log('Mission', idx, 'events:', events);
});