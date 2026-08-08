# Arquitectura de Integración: WhatsApp Business API Multitienda (Embedded Signup)

## 1. Esquema de Campos en Firestore por Tienda

Para soportar la funcionalidad multitienda (SaaS) donde cada inquilino (tenant/tienda) pueda conectar su propia línea de WhatsApp oficial, es necesario extender el esquema de la colección `stores` en Firestore.

Se recomienda agrupar estos campos dentro de un objeto `whatsapp_config` o directamente en `settings` de la tienda:

```typescript
interface StoreWhatsAppConfig {
  // ID numérico del teléfono asignado por Meta a la tienda
  whatsappPhoneNumberId: string; 
  
  // Identificador de la cuenta de WhatsApp Business Account
  whatsappWabaId: string; 
  
  // Token de acceso de usuario del sistema (System User Token) con permisos 
  // 'whatsapp_business_messaging' y 'whatsapp_business_management'
  whatsappAccessToken: string; 
  
  // Estado de la conexión
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  
  // Fecha de la última conexión exitosa
  lastConnectionAt?: string;
}
```

Estos campos permitirán que el backend de Kalu enrute de manera dinámica los mensajes salientes (Cloud API) usando el Token y el Phone ID correspondientes a la tienda activa desde donde se realiza la acción.

## 2. Estrategia de Fallback / Inmunidad (Kalu Queso San Juan)

Dado que la tienda matriz o principal (Kalu Queso San Juan) ya posee una conexión estable de WhatsApp, es vital implementar un mecanismo de inmunidad temporal y permanente (Fallback) para no interrumpir su servicio durante la transición hacia la arquitectura SaaS multicliente.

### Patrón de Respaldo por Defecto
En los Cloud Functions o servicios intermedios (ej. n8n) donde se despachan los mensajes:

1. **Lectura Condicional:** Antes de enviar el mensaje, el sistema leerá el `whatsappAccessToken` y `whatsappPhoneNumberId` del documento de la tienda emisora.
2. **Evaluación de Existencia:** Si los campos `whatsappPhoneNumberId` y `whatsappAccessToken` **existen** y son válidos, se utilizarán las credenciales de esa tienda.
3. **El Fallback (La Inmunidad):** Si la tienda emisora es **Kalu Queso San Juan (ID Principal)** y *carece* de estos campos en su documento (o si la integración falla temporalmente), el sistema utilizará **por defecto las variables de entorno actuales (`.env`)** que ya apuntan a la WABA matriz.
4. **Bloqueo para Terceros:** Si una tienda *que no sea* la matriz intenta enviar un mensaje y no tiene su configuración de WhatsApp registrada, la función debe arrojar un error silencioso (o notificar al frontend) y evitar que use el número de Kalu Queso San Juan para evitar confusiones de clientes y suspensiones por spam en la línea matriz.

## 3. Pasos de Activación (Meta Embedded Signup)

Una vez que la empresa (Kalu) finalice el proceso de verificación legal de su Business Manager ante Meta y sea aprobada como Tech Provider / BSP (Business Solution Provider), se podrá habilitar el flujo nativo:

### Paso 1: Configuración de la App de Meta
- Modificar la aplicación de Meta Developers para habilitar la opción de **Login con Facebook** y configurar la redirección segura (OAuth) hacia el portal de Kalu.
- Solicitar y obtener los permisos avanzados requeridos: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`.

### Paso 2: Integración del SDK en el Frontend (Brequera)
- Cargar el SDK de Facebook en el navegador (`connect.facebook.net/en_US/sdk.js`).
- En la Brequera de SuperAdmin (o en el Panel de Ajustes del Dueño), colocar un botón **"Conectar WhatsApp Oficial"**.
- Al hacer clic, se invocará `FB.login` con el scope de permisos necesario, disparando la ventana modal emergente de Meta Embedded Signup.

### Paso 3: Flujo del Cliente en el Modal de Meta
- El dueño de la tienda iniciará sesión con su Facebook personal.
- Creará o vinculará su cuenta de Meta Business Manager.
- Creará o seleccionará un perfil de WhatsApp Business.
- Registrará y verificará su número de teléfono mediante SMS/Llamada directamente dentro del modal.

### Paso 4: Captura y Almacenamiento
- Al finalizar el flujo, Meta devolverá al callback frontend un código o token de autorización.
- El frontend de Kalu enviará este código a nuestro backend.
- El backend intercambiará el código por un **System User Token** permanente.
- Finalmente, se guardarán el `whatsappPhoneNumberId`, `whatsappWabaId` y el `whatsappAccessToken` directamente en el documento de esa tienda en la colección `stores` de Firestore.

---
*Este documento establece los cimientos para que la plataforma pase de un modelo Single-Tenant en mensajería a un entorno Multi-Tenant completamente automatizado bajo el paraguas de Meta.*
