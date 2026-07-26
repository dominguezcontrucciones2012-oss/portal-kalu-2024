import { GoogleGenAI, Type } from "@google/genai";

const apiKey = (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY;
let ai: any = null;

if (apiKey && apiKey !== "COPIA_TU_API_KEY_AQUI") {
  ai = new GoogleGenAI({ apiKey });
}



export async function askKaluAI(query: string, context?: any) {
  if (!apiKey || apiKey === "COPIA_TU_API_KEY_AQUI") {
    return "Hola! Soy Kalu-IA. Actualmente estoy en modo de demostración porque no se ha configurado una clave de API de Gemini real. Una vez configurada, podré analizar tu inventario y ventas en tiempo real para darte consejos estratégicos.";
  }

  const modelName = "gemini-2.5-flash";
  
  const systemInstruction = `
    Eres Kalu-IA, el asistente de inteligencia de mercado del sistema administrativo KALUNEVA2024.
    Tu objetivo es ayudar a los administradores de un negocio en San Lorenzo Tiznados, Venezuela.
    Tienes acceso a información de inventario, ventas y clientes.
    Debes hablar en un tono profesional, amable y directo.
    Si te preguntan sobre qué comprar, analiza los niveles de stock (stock < stock_minimo).
    Si te preguntan sobre deudas, menciona a los clientes con saldo pendiente.
    Utiliza el contexto proporcionado para dar respuestas precisas.
  `;

  try {
    const finalPrompt = context ? `Contexto del negocio:\n${JSON.stringify(context)}\n\nPregunta del usuario: ${query}` : query;
    const response = await ai.models.generateContent({
      model: modelName,
      contents: finalPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429')) {
      return "Lo siento, pariente. He recibido demasiadas consultas en poco tiempo y mi cerebro de IA necesita un breve descanso. Por favor, intenta preguntarme de nuevo en un minuto.";
    }
    console.error("Gemini AI Error:", error);
    return "Ups, algo salió mal con mi conexión. Por favor, intenta de nuevo.";
  }
}



export async function scanInvoiceIA(base64Image: string, tasaBcv: number = 1, inventoryContext: string = "") {
  const modelName = "gemini-2.5-flash";
  
  const systemInstruction = `
    Eres un experto en digitalización de facturas de proveedores.
    TASA DE CAMBIO ACTUAL: 1 USD = ${tasaBcv} VES (Bolívares).
    
    REGLA DE MONEDA:
    Si los precios de la factura están en Bolívares (o son montos muy altos típicos de VES), DEBES convertirlos a Dólares (USD) dividiéndolos entre la tasa de cambio (${tasaBcv}). Si ya están en dólares, déjalos igual. El JSON de salida SIEMPRE debe tener el "costo" en dólares.

    REGLA DE INVENTARIO:
    A continuación tienes los nombres de los productos que ya existen en nuestra base de datos:
    [ ${inventoryContext} ]
    
    Tu tarea es asociar los productos de la factura con nuestro inventario. Si el producto de la factura es el mismo que uno del inventario aunque tenga ligeras variaciones de nombre (ej. "Galleta Puig 5" -> "Galleta Puig"), DEBES usar EXACTAMENTE el nombre de nuestro inventario. Si es un producto totalmente nuevo que no se parece a ninguno, usa el nombre limpio y claro de la factura.

    Devuelve un JSON estricto con un arreglo de objetos. Cada objeto debe tener:
    - nombre: string (el nombre emparejado del inventario, o el nombre limpio si es nuevo, SIEMPRE EN MAYÚSCULAS)
    - cantidad: number
    - costo: number (el costo unitario final en DÓLARES)
    No devuelvas ningún otro texto, solo el JSON puro.
  `;

  let mimeType = "image/jpeg";
  let base64Data = base64Image;

  if (base64Image.startsWith('data:image')) {
    mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));
    base64Data = base64Image.split(',')[1];
  }

  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Data,
    },
  };

  try {
    if (!ai) {
      console.error("Gemini AI no está inicializado. Falta la API Key.");
      return { error: "Gemini AI no está inicializado. Revisa la configuración de API Key." };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        imagePart, 
        { text: "Extrae los productos de esta factura." }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              cantidad: { type: Type.NUMBER },
              costo: { type: Type.NUMBER }
            },
            required: ["nombre", "cantidad", "costo"]
          }
        }
      },
    });

    try {
      const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
      return JSON.parse(text);
    } catch (parseError: any) {
      console.error("Error al parsear el JSON de la factura:", parseError, "Respuesta cruda:", response.text);
      return { error: "Respuesta de la IA no fue un JSON válido." };
    }
  } catch (error: any) {
    console.error("Error scanning invoice:", error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('exceeded your current quota')) {
      return { error: "Límite de consultas alcanzado. Por favor espera 30 segundos antes de volver a intentarlo." };
    }
    return { error: "Fallo al llamar a Gemini: " + (error.message || String(error)) };
  }
}

export async function analyzeProductImage(imageUrl: string) {
  if (!apiKey || apiKey === "COPIA_TU_API_KEY_AQUI") {
    // Modo Demo
    return {
      nombre: "Producto Autodetectado (Demo)",
      categoria: "General",
      precioSugerido: 5.00,
      descripcion: "Esta es una descripción generada automáticamente en modo demo, ya que no hay una API Key real configurada."
    };
  }

  const modelName = "gemini-2.5-flash";
  const systemInstruction = `
    Eres un experto comercial. Analiza la imagen del producto.
    Devuelve un JSON estricto con:
    {
      "nombre": "Nombre comercial atractivo (ej. Queso Llanero Premium)",
      "categoria": "Una de estas: Lácteos, Víveres, Carnicería, Hortalizas, General",
      "precioSugerido": número (precio razonable en USD),
      "descripcion": "Descripción corta y muy atractiva para vender el producto (máx 3 líneas)"
    }
    NO incluyas markdown como \`\`\`json, solo el JSON puro.
  `;

  try {
    let contents: any;
    
    if (imageUrl.startsWith('data:image')) {
      const mimeType = imageUrl.substring(imageUrl.indexOf(':') + 1, imageUrl.indexOf(';'));
      const base64Data = imageUrl.split(',')[1];
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };
      contents = [
        imagePart, 
        { text: "Analiza esta imagen de producto." }
      ];
    } else {
      contents = `Analiza esta imagen de producto que se encuentra en la siguiente URL: ${imageUrl}`;
    }
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.4
      },
    });

    try {
      const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
      return JSON.parse(text);
    } catch (e) {
      console.error("Error parsing Gemini JSON:", e);
      return null;
    }
  } catch (error) {
    console.error("Gemini AI Product Analysis Error:", error);
    return null;
  }
}

export async function interactWithInvoiceIA(currentItems: any[], userCommand: string) {
  const modelName = "gemini-2.5-flash";
  
  const systemInstruction = `
    Eres un asistente inteligente para un sistema de inventario (POS).
    El usuario está viendo una tabla con los siguientes ítems escaneados:
    ${JSON.stringify(currentItems)}

    El usuario te ha dado la siguiente orden para ajustar la tabla:
    "${userCommand}"

    Tu tarea es:
    1. Entender la orden del usuario.
    2. Encontrar el ítem o los ítems que deben ser modificados en el JSON actual.
    3. Aplicar las modificaciones solicitadas (pueden ser cambios en 'nombre', 'cantidad', 'costo', 'margen', o 'precio_venta').
    4. Devolver ÚNICAMENTE el JSON completo (Array de objetos) con los datos ya actualizados. 
    NO agregues ítems nuevos a menos que el usuario lo pida expresamente. NO elimines ítems a menos que se pida expresamente. Mantén los ítems que no fueron mencionados intactos.
    
    Devuelve estrictamente un JSON Array válido. Sin texto markdown ni explicaciones.
  `;

  try {
    if (!ai) {
      console.error("Gemini AI no está inicializado. Falta la API Key.");
      return { error: "Gemini AI no está inicializado." };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: "Por favor procesa la orden y devuelve el JSON actualizado.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              cantidad: { type: Type.NUMBER },
              costo: { type: Type.NUMBER },
              margen: { type: Type.NUMBER },
              precio_venta: { type: Type.NUMBER }
            },
            required: ["nombre", "cantidad", "costo", "margen", "precio_venta"]
          }
        },
        temperature: 0.1
      },
    });

    try {
      const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
      return JSON.parse(text);
    } catch (parseError: any) {
      return { error: "Respuesta de la IA no fue un JSON válido." };
    }
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('exceeded your current quota')) {
      return { error: "Límite de consultas alcanzado. Por favor espera 30 segundos antes de volver a intentarlo." };
    }
    return { error: "Fallo al llamar a Gemini: " + (error.message || String(error)) };
  }
}

export async function fillPiecesWithIA(currentPieces: any[], spokenText: string) {
  const modelName = "gemini-2.5-flash";
  
  const systemInstruction = `
    Eres un asistente inteligente. El usuario está dictando los pesos para una lista de piezas de queso.
    La lista actual de piezas (vacías o llenas) es:
    ${JSON.stringify(currentPieces)}

    El usuario ha dictado lo siguiente:
    "${spokenText}"

    Tu tarea:
    1. Interpreta lo que el usuario dictó. Por ejemplo, "en la uno 460, en la dos 650, en la 3 658".
    2. Identifica el número de la pieza (es decir, "uno" es la pieza con numero "1", "dos" es la pieza con numero "2").
    3. Identifica el peso. SI EL USUARIO DICE NÚMEROS COMO "460" O MENCIONA GRAMOS, ASUME QUE SON GRAMOS y divídelo entre 1000 para obtener kilos (ej. 0.460). El campo "peso" SIEMPRE debe estar en Kilos. Si dice explícitamente kilos (ej. "uno punto cinco"), pon 1.5.
    4. Actualiza los objetos correspondientes en el arreglo 'currentPieces' reemplazando su 'peso'.
    5. Devuelve ÚNICAMENTE el JSON array completo de las piezas actualizado.
    
    Devuelve estrictamente un JSON Array válido. Sin markdown, sin explicaciones.
  `;

  try {
    if (!ai) {
      return { error: "Gemini AI no está inicializado." };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: "Por favor procesa el dictado y devuelve el JSON actualizado.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              numero: { type: Type.STRING },
              peso: { type: Type.NUMBER },
              vendida: { type: Type.BOOLEAN }
            },
            required: ["id", "numero", "peso", "vendida"]
          }
        },
        temperature: 0.1
      },
    });

    try {
      const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
      return JSON.parse(text);
    } catch (parseError: any) {
      return { error: "Respuesta de la IA no fue un JSON válido." };
    }
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('exceeded your current quota')) {
      return { error: "Límite de consultas alcanzado. Por favor espera 30 segundos antes de volver a intentarlo." };
    }
    return { error: "Fallo al llamar a Gemini: " + (error.message || String(error)) };
  }
}


