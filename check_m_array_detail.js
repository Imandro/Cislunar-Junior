const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find the last script tag (inline script)
const lastScriptTagStart = html.lastIndexOf('<script>');
const lastScriptTagEnd = html.lastIndexOf('</script>');

const inlineScriptContent = html.slice(lastScriptTagStart, lastScriptTagEnd + 9);

// Find M array in this inline script
const mIdx = inlineScriptContent.indexOf('var M = [');
let braceCount = 0;
let inArray = false;
let endIdx = -1;
for (let i = mIdx; i < inlineScriptContent.length; i++) {
  if (inlineScriptContent[i] === '[') { braceCount++; inArray = true; }
  else if (inlineScriptContent[i] === ']') { 
    braceCount--; 
    if (inArray && braceCount === 0) { 
      endIdx = i + 1; 
      break;
    } 
  }
}

const mArray = inlineScriptContent.slice(mIdx, endIdx);
console.log('M array length:', mArray.length);

// Count top-level objects in M array (missions)
let bc = 0;
let inM = false;
let missionCount = 0;
for (let i = 0; i < mArray.length; i++) {
  if (mArray[i] === '[') { bc++; inM = true; }
  else if (mArray[i] === ']') { bc--; }
  else if (mArray[i] === '{' && bc === 1) { // top-level object in M array
    missionCount++;
    // Get mission name
    const snippet = mArray.slice(i, i + 200);
    const nameMatch = snippet.match(/n:\s*'([^']+)'/);
    console.log('Mission', missionCount, ':', nameMatch ? nameMatch[1] : 'unknown');
  }
}
console.log('Total missions:', missionCount);