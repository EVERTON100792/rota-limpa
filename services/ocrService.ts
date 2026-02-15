import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Check if API key is present
if (!API_KEY) {
    console.warn("VITE_GEMINI_API_KEY is missing via .env. OCR features will not work.");
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

/**
 * Converts a File object to a GoogleGenerativeAI Part object (base64).
 */
async function fileToGenerativePart(file: File) {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
                inlineData: {
                    data: base64String,
                    mimeType: file.type
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Sends an image to Google Gemini Flash to extract addresses.
 * Returns an array of address strings.
 */
export async function parseAddressesFromImage(imageFile: File): Promise<string[]> {
    if (!API_KEY) {
        throw new Error("Chave da API do Google Gemini não configurada.");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imagePart = await fileToGenerativePart(imageFile);

        const prompt = `
      Você é um assistente de logística especializado. 
      Analise esta imagem e extraia TODOS os endereços completos que encontrar.
      
      Regras:
      1. Ignore textos que não sejam endereços.
      2. Se houver numeração, inclua.
      3. Se houver cidade/estado, inclua.
      4. Retorne APENAS um array JSON de strings, sem markdown, sem explicações.
      
      Exemplo de saída:
      ["Rua das Flores 123, São Paulo", "Av. Paulista 900, São Paulo"]
    `;

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean up the response to ensure it's valid JSON
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const addresses = JSON.parse(cleanText);
            if (Array.isArray(addresses)) {
                return addresses.map(addr => String(addr).trim()).filter(addr => addr.length > 5);
            }
            return [];
        } catch (e) {
            console.error("Failed to parse JSON from Gemini response:", text);
            // Fallback: splitting by newlines if JSON fails
            return text.split('\n').filter(line => line.length > 10).map(l => l.trim());
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Falha ao processar a imagem. Tente novamente.");
    }
}
