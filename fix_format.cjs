const fs = require('fs');

const files = [
  'src/components/Portal/ClientPortalScreen.tsx',
  'src/components/Portal/PublicCatalogScreen.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace: Bs. ${(cartTotalUsd * tasaBcv).toFixed(2)} -> {formatCurrency(cartTotalUsd, 'Bs', tasaBcv)}
  content = content.replace(/Bs\.\s*\$\{\(([^)]+)\s*\*\s*([^)]+)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `\${formatCurrency(${val1}, 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });

  // Replace: Bs. {(clientData.saldo_usd * tasaBcv).toFixed(2)} -> {formatCurrency(clientData.saldo_usd, 'Bs', tasaBcv)}
  content = content.replace(/Bs\.\s*\{\(([^)]+)\s*\*\s*([^)]+)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `{formatCurrency(${val1}, 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });

  // Replace: Bs. {(parseFloat(montoReportarUSD) * tasaBcv).toFixed(2)}
  content = content.replace(/Bs\.\s*\{\(parseFloat\(([^)]+)\)\s*\*\s*([^)]+)\)\.toFixed\(2\)\}/g, (match, val1, val2) => {
    return `{formatCurrency(parseFloat(${val1}), 'Bs', ${val2}).replace('VES', 'Bs.')}`;
  });

  // Replace: {tasaBcv.toFixed(2)} Bs/USD -> {tasaBcv.toFixed(2).replace('.', ',')} Bs/USD
  content = content.replace(/\{tasaBcv\.toFixed\(2\)\}\s*Bs\/USD/g, "{tasaBcv.toFixed(2).replace('.', ',')} Bs/USD");
  content = content.replace(/\{sale\.tasa_momento\.toFixed\(2\)\}\s*Bs\/USD/g, "{sale.tasa_momento.toFixed(2).replace('.', ',')} Bs/USD");

  fs.writeFileSync(file, content, 'utf8');
}
console.log('Format fixes applied.');
