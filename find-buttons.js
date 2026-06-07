const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const missingButtons = [];

walkDir('src/components', (filePath) => {
  if (filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<button')) {
        // check current line and next 5 lines for onClick or type="submit"
        let foundHandler = false;
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].includes('onClick') || lines[j].includes('type="submit"')) {
            foundHandler = true;
            break;
          }
        }
        if (!foundHandler) {
          missingButtons.push({ file: filePath, line: i + 1, text: lines[i].trim() });
        }
      }
    }
  }
});

console.log(JSON.stringify(missingButtons, null, 2));
