import { GoogleGenAI, Type } from "@google/genai";

const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : (import.meta as any).env.VITE_GEMINI_API_KEY;
let ai: any = null;

if (apiKey && apiKey !== "COPIA_TU_API_KEY_AQUI") {
  ai = new GoogleGenAI(apiKey);
}


export async function askKaluAI(query: string, context?: any) {
  if (!apiKey || apiKey === "COPIA_TU_API_KEY_AQUI") {
    return "Hola! Soy Kalu-IA. Actualmente estoy en modo de demostración porque no se ha configurado una clave de API de Gemini real. Una vez configurada, podré analizar tu inventario y ventas en tiempo real para darte consejos estratégicos.";
  }

  const modelName = "gemini-1.5-flash";
  
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



export async function scanInvoiceIA(base64Image: string) {
  const modelName = "gemini-1.5-flash";
  
  const systemInstruction = `
    Eres un experto en digitalización de facturas de proveedores.
    Extrae la lista de productos de la imagen proporcionada.
    Formato de salida requerido: JSON ARRAY con objetos { nombre, cantidad, costo }.
    Asegúrate de que los nombres estén en MAYÚSCULAS y los números sean válidos.
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
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [imagePart, { text: "Extrae los productos de esta factura." }] },
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

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error scanning invoice:", error);
    return [];
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

  const modelName = "gemini-1.5-flash";
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
      contents = { parts: [imagePart, { text: "Analiza esta imagen de producto." }] };
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

