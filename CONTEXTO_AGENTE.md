# 🤖 CONTEXTO PARA AGENTE AI — PROYECTO KALU
> Última actualización: 21 de junio 2026
> Este archivo es para el agente AI (Antigravity). Léelo completo antes de hacer cualquier cosa.

---

## 📌 ¿QUÉ ES ESTE PROYECTO?

**Portal Kalu** es un sistema de gestión completo para una empresa de venta y reparto de productos (quesos, lácteos, etc.) en Venezuela/Latinoamérica.

El sistema incluye:
- **Portal web** (React + Vite + Firebase) — panel de administración, ventas, clientes, inventario, reportes
- **Bot de WhatsApp** (`cajero.js`) — automatiza ventas, pedidos y pagos por WhatsApp usando `whatsapp-web.js`
- **Cajero automático** — sistema de pedidos por WhatsApp con tasa de cambio dinámica
- **CRM de clientes** — gestión de clientes, historial de compras
- **Sistema de repartidores** — portal para que los repartidores vean y gestionen pedidos
- **Firebase Functions** — funciones en la nube para lógica de negocio

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Principal
| Tecnología | Uso |
|---|---|
| React 19 + TypeScript | Frontend del portal web |
| Vite 6 | Bundler del frontend |
| Tailwind CSS v4 | Estilos |
| Firebase (Firestore, Auth, Storage, Hosting) | Backend, base de datos, autenticación |
| Firebase Functions | Lógica serverless en la nube |
| whatsapp-web.js | Bot de WhatsApp (cajero) |
| Express.js | Servidor local (server.ts) |
| Gemini AI (@google/genai) | IA integrada en el portal |

### Estructura de carpetas clave
```
kalu_folden_2024/
├── src/
│   ├── components/
│   │   ├── AI/          → Chat con IA
│   │   ├── Dashboard/   → Panel principal
│   │   ├── POS/         → Punto de venta
│   │   ├── Clients/     → Gestión de clientes
│   │   ├── Inventory/   → Inventario
│   │   ├── Dispatch/    → Despacho/repartidores
│   │   ├── Reports/     → Reportes
│   │   ├── Ledger/      → Libro contable
│   │   ├── Market/      → Mercado/productos
│   │   ├── History/     → Historial
│   │   ├── Account/     → Cuenta de usuario
│   │   ├── Portal/      → Portal del repartidor
│   │   ├── Auth/        → Login/autenticación
│   │   ├── common/      → Componentes reutilizables
│   │   └── layout/      → Layout principal
│   ├── contexts/        → Contextos React (auth, datos)
│   ├── lib/             → Firebase config, utilidades
│   ├── services/        → Servicios (Gemini AI)
│   ├── types.ts         → Tipos TypeScript globales
│   └── App.tsx          → Router principal
├── cajero.js            → Bot de WhatsApp (¡ARCHIVO CRÍTICO!)
├── functions/
│   ├── index.js         → Firebase Functions (producción)
│   └── server_local.js  → Servidor local de functions
├── firebase.json        → Configuración Firebase hosting + functions
├── firestore.rules      → Reglas de seguridad Firestore
├── vite.config.ts       → Config de Vite
└── server.ts            → Servidor Express local
```

---

## 🔥 FIREBASE — INFORMACIÓN CLAVE

### App IDs
- **App Kalu (portal web)**: configurada en `src/lib/` (firebase config)
- **Firebase Project**: ver `.firebaserc`
- **Hosting**: desplegado en Firebase Hosting
- **Functions**: desplegadas en Firebase Functions

### Reglas de Firestore
- Archivo: `firestore.rules`
- Hay usuarios con roles: `admin`, `repartidor`, `cajero`
- Las reglas controlan acceso por rol

---

## 📱 WHATSAPP BUSINESS API — META (¡PENDIENTE RESOLVER!)

### Estado actual al 21/06/2026:
**🚨 PROBLEMA PRINCIPAL: La app de WhatsApp Business en Meta NO está publicada todavía.**

### App en Meta:
- **Nombre**: Robox Kalu
- **App ID**: `1368872795143172`
- **Business ID**: `168877...` (ver URL de developers.facebook.com)
- **URL del panel**: https://developers.facebook.com/apps/1368872795143172/dashboard/

### Progreso de publicación:
| Paso | Estado |
|---|---|
| ✅ Personalizar caso de uso "WhatsApp" | COMPLETADO |
| ✅ Probar casos de uso | COMPLETADO |
| ⏳ Publicar la app (Go Live) | **PENDIENTE** |

### 🚨 Problema con el método de pago:
- El usuario intentó agregar tarjeta de su esposa → la rechazó Meta
- Luego agregó tarjeta Zinli (suya) → también la rechazó Meta  
- Meta se puso "obstuso" — posiblemente bloqueó la cuenta de facturación temporalmente por intentos múltiples
- **Cuenta de facturación con problema**: "Prueba de cuenta de WhatsApp Business" (ver billing hub)
- **Cuenta que SÍ funciona**: "Kalu queso san juan" (anuncios) con Visa terminada en 8506

### URLs importantes de Meta:
- Panel principal: https://developers.facebook.com/apps/1368872795143172/dashboard/
- Casos de uso: https://developers.facebook.com/apps/1368872795143172/use_cases/customize/
- Go Live (publicar): https://developers.facebook.com/apps/1368872795143172/go_live/
- Facturación: https://business.facebook.com/billing_hub/accounts/
- Soporte Meta: https://business.facebook.com/help/

### Plan de acción para Meta:
1. Entrar a https://business.facebook.com/billing_hub/accounts/
2. Revisar el estado de la cuenta de pago "Prueba de cuenta de WhatsApp Business"
3. Si sigue rechazando la tarjeta → **APELAR** a Meta Support
4. URL de apelación/soporte: https://business.facebook.com/business/help/support
5. Si aprueban → volver a https://developers.facebook.com/apps/1368872795143172/go_live/ y publicar

---

## 🤖 BOT DE WHATSAPP (cajero.js)

### Descripción:
- El cajero es un bot que corre localmente en la PC del usuario
- Usa `whatsapp-web.js` para conectarse a WhatsApp Web
- Archivo de sesión guardada en: `.wwebjs_auth_cajero/`
- Arrancar con: `node cajero.js` o `npm run cajero`
- Archivo batch para arrancar: `Arrancar_Cajero.bat`

### Funciones del cajero:
- Recibe pedidos por WhatsApp
- Calcula precios con tasa de cambio dinámica (USD/VES/COP)
- Registra pedidos en Firestore
- Notifica a repartidores
- Cierre automático de caja a las 10 PM

---

## 💻 CÓMO ARRANCAR EL PROYECTO

### Requisitos en la nueva PC:
1. Node.js instalado
2. Git configurado
3. Clonar: `git clone https://github.com/dominguezcontrucciones2012-oss/portal-kalu-2024.git`
4. `cd portal-kalu-2024`
5. `npm install`
6. Crear archivo `.env` con las variables necesarias (ver `.env.example`)
7. Necesitas el archivo `.env` real con las keys de Firebase y Gemini — **NO está en git (seguridad)**

### Variables de entorno necesarias (.env):
```
GEMINI_API_KEY=<tu key de Gemini AI Studio>
APP_URL=<URL de la app>
# + las variables de Firebase (apiKey, authDomain, projectId, etc.)
```

### Para el cajero de WhatsApp:
- La sesión de WhatsApp está en `.wwebjs_auth_cajero/` — **NO está en git**
- Necesitas escanear el QR de nuevo en la nueva PC si no tienes la carpeta de sesión

### Comandos:
```bash
npm run dev          # Arranca el portal web en localhost:3000
npm run cajero       # Arranca el bot de WhatsApp
npm run dev:server   # Arranca el servidor Express (server.ts)
```

---

## 📝 HISTORIAL DE CAMBIOS RECIENTES (últimos commits)

```
4d21b55 feat: optimizaciones de db, horario automatico, carga de videos multer y flujo conversacional del cajero
266a852 feat: cierre automatico de caja a las 10 PM y herramienta de reparacion en CRM
fa47e19 feat: cierre de jornada del repartidor con aprobacion de admin por whatsapp
8203d05 fix: el portal del repartidor ahora reconoce cuando un pedido ya fue pagado y aprobado
28ed9a8 fix: omitir historial de whatsapp y aplicar tasa dinamica
```

---

## 🎯 PRÓXIMOS PASOS (al arrancar en la otra PC)

1. **Lo más urgente**: Resolver el método de pago en Meta para publicar la app de WhatsApp Business
   - Entrar a https://business.facebook.com/billing_hub/accounts/
   - Ayudar al usuario a agregar una tarjeta válida
   - Si sigue sin funcionar → ir a soporte/apelación de Meta

2. **Después**: Confirmar que el cajero.js funciona en la nueva PC (escanear QR de WhatsApp)

3. **Pendiente de código**: Hay archivos sin commitear que se subirán con este commit:
   - `firebase.json` (modificado)
   - `package.json` y `package-lock.json` (actualizados)
   - `.firebase/hosting.ZGlzdA.cache` (cache de hosting)
   - `functions/` (carpeta nueva con Firebase Functions)

---

## 👤 SOBRE EL USUARIO

- Habla español
- Prefiere instrucciones simples y directas
- Es el dueño/operador del negocio Kalu (venta de quesos y lácteos)
- Su WhatsApp del negocio está conectado al cajero.js
- Tiene cuentas en Zinli (tarjeta virtual) para pagos digitales
- Usa Windows

---

*Generado automáticamente por el agente AI el 21/06/2026*
