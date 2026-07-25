const tests = [
  { type: 'cedula', value: '8787092' },
  { type: 'email', value: '8787092@kalu.app' },
  { type: 'cedula', value: 'V8787092' },
  { type: 'cedula', value: 'v8787092' },
  { type: 'cedula', value: 'V-8787092' },
  { type: 'cedula', value: 'v-8787092' }
];

async function testBuscar() {
  for (const t of tests) {
    const url = `https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=${t.type}&value=${encodeURIComponent(t.value)}`;
    console.log("Fetching", url);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("Result for", t.value, ":", data.exists);
      if (data.exists) {
        console.log("Found client ID:", data.client.id, "Cedula:", data.client.cedula);
      }
    } catch(e) {
      console.error("Error:", e);
    }
  }
}

testBuscar();
