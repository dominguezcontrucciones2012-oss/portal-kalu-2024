const fs = require('fs');

const files = [
  'src/components/Portal/ClientPortalScreen.tsx',
  'src/components/Portal/PublicCatalogScreen.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace: Bs. {(sale.total_usd * sale.tasa_momento).toFixed(2)}
  content = content.replace(/Bs\.\s*\{\((sale\.total_usd)\s*\*\s*(sale\.tasa_momento)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `{formatCurrency(${val1}, 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });

  // Replace: Bs. {(cartTotalUsd * tasaBcv).toFixed(2)}
  content = content.replace(/Bs\.\s*\{\((cartTotalUsd)\s*\*\s*(tasaBcv)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `{formatCurrency(${val1}, 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });
  
  // Also fix: Bs. ${(cartTotalUsd * tasaBcv).toFixed(2)} (if it reverted somehow)
  content = content.replace(/Bs\.\s*\$\{\((cartTotalUsd)\s*\*\s*(tasaBcv)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `\${formatCurrency(${val1}, 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });

  fs.writeFileSync(file, content, 'utf8');
}
console.log('Second pass format fixes applied.');
