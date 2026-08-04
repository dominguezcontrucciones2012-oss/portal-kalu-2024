const fs = require('fs');
const file = 'src/components/Portal/PublicCatalogScreen.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/\{\/\* --- MODAL DE AUTENTICACIÓN \/ REGISTRO INTEGRADO --- \*\/\}[\s\S]*?\}\)\s*:\s*null\}\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\};\s*export default PublicCatalogScreen;/g, '    </div>\n  );\n};\n\nexport default PublicCatalogScreen;');

fs.writeFileSync(file, c);
console.log('Cleaned');
