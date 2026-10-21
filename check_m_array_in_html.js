const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find the last script tag (inline script)
const lastScriptTagStart = html.lastIndexOf('<script>');
const lastScriptTagEnd = html.lastIndexOf('</script>');

console.log('Last script tag:', lastScriptTagStart, 'to', lastScriptTagEnd);

const inlineScriptContent = html.slice(lastScriptTagStart, lastScriptTagEnd + 9);
console.log('Inline script length:', inlineScriptContent.length);

// Find M array in this inline script
const mIdx = inlineScriptContent.indexOf('var M = [');
console.log('M in inline script at:', mIdx);

if (mIdx >= 0) {
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
  console.log('M array ends at:', endIdx);
  console.log('M array length:', endIdx - mIdx);
  console.log('End context:', inlineScriptContent.slice(endIdx - 50, endIdx + 100));
}