import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 data URL
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { image }: AnalyzeRequest = await req.json();

    if (!image) {
      throw new Error("No image provided");
    }

    // Extract base64 data from data URL
    const base64Data = image.split(",")[1] || image;

    const prompt = `Analizza questo scontrino fiscale. Estrai in formato JSON: {merchant, date (YYYY-MM-DD), total (numero), currency, category, items (array di {name, quantity, price})}. 
    
    Regole:
    - Se non riesci a leggere un campo, usa una stringa vuota o null
    - Il totale deve essere un numero, non una stringa
    - La data deve essere nel formato YYYY-MM-DD
    - La valuta predefinita è "EUR"
    - Rispondi ESCLUSIVAMENTE con il JSON, senza markdown o testo aggiuntivo`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (remove markdown code blocks if present)
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", cleanedText);
      // Return default structure
      data = {
        merchant: "",
        date: new Date().toISOString().split("T")[0],
        total: 0,
        currency: "EUR",
        category: "",
        items: [],
      };
    }

    // Ensure required fields
    data.merchant = data.merchant || "";
    data.date = data.date || new Date().toISOString().split("T")[0];
    data.total = typeof data.total === "number" ? data.total : parseFloat(data.total) || 0;
    data.currency = data.currency || "EUR";
    data.category = data.category || "";
    data.items = Array.isArray(data.items) ? data.items : [];

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in analyze-receipt:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
