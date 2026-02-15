import Tesseract from 'tesseract.js';

/**
 * Extracts text from an image using Tesseract.js (Client-side OCR).
 * No API Key required.
 */
export async function parseAddressesFromImage(imageFile: File): Promise<string[]> {
    try {
        const result = await Tesseract.recognize(
            imageFile,
            'por', // Portuguese
            {
                logger: m => console.log(m) // Log progress
            }
        );

        const text = result.data.text;
        console.log("OCR Text:", text);

        // Simple parsing logic: Look for lines that look like addresses
        // This is much simpler than LLM, so we rely on heuristics
        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 5)
            // Filter typically address-like patterns (contains numbers, or "Rua", "Av", etc)
            .filter(l => /\d+/.test(l) || /(Rua|Av|Avenida|Travessa|Alameda|Estrada|Rodovia)/i.test(l));

        return lines;

    } catch (error) {
        console.error("Tesseract Error:", error);
        throw new Error("Falha ao ler imagem com Tesseract. Tente uma foto mais clara.");
    }
}

