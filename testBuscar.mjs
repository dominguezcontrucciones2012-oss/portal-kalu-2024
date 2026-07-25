const tests = [
  { type: 'cedula', value: 'V878787092' },
  { type: 'cedula', value: 'v878787092' },
  { type: 'cedula', value: 'V-878787092' },
  { type: 'cedula', value: 'v-878787092' },
  { type: 'cedula', value: '878787092' },
  { type: 'email', value: 'v878787092@kalu.app' },
  { type: 'email', value: '878787092@kalu.app' }
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
        console.log("Found client:", data.client);
      }
    } catch(e) {
      console.error("Error:", e);
    }
  }
}

testBuscar();
