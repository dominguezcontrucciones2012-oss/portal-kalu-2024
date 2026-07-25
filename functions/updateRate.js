const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

async function updateRate() {
    const today = new Date().toLocaleString('en-CA', { timeZone: 'America/Caracas' }).split(',')[0];
    
    let rate = null;
    let fuente = '';

    try {
        const resp = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', { timeout: 8000 });
        const json = resp.data;
        rate = json.promedio ?? json.venta ?? null;
        fuente = 've.dolarapi.com';
        console.log('✅ Tasa BCV obtenida de ve.dolarapi.com:', rate);
    } catch (e) {
        console.warn('❌ ve.dolarapi.com falló:', e.message);
    }

    if (!rate) {
        try {
            const resp2 = await axios.get('https://pydolarve.org/api/v1/dollar?monitor=bcv', { timeout: 8000 });
            const json2 = resp2.data;
            rate = json2.price ?? json2.valor ?? null;
            fuente = 'pydolarve.org';
            console.log('✅ Tasa BCV obtenida de pydolarve.org:', rate);
        } catch (e2) {
            console.warn('❌ pydolarve.org también falló:', e2.message);
        }
    }

    if (!rate || rate <= 0) {
        console.error('No se pudo obtener la tasa BCV.');
        process.exit(1);
    }

    const rateNum = parseFloat(parseFloat(rate).toFixed(4));

    try {
        await db.collection('tasas_bcv').doc(today).set({
            id: `tasa-${today}`,
            fecha: today,
            valor: rateNum,
            fuente: `BCV (Oficial) — ${fuente}`,
            estatus: 'Sincronizada',
            sincronizadoEn: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Guardado en Firestore: ${today} -> ${rateNum}`);
    } catch (saveErr) {
        console.warn('No se pudo guardar en Firestore:', saveErr.message);
    }
}

updateRate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
