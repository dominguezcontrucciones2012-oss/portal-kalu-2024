const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capturar errores de consola
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure().errorText));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' }).catch(e => console.log("GOTO ERROR", e));
  
  // Esperar un poco a que Firebase responda y haga el crash
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("TEST FINISHED");
  await browser.close();
})();
