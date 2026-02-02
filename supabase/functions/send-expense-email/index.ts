import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpenseData {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}

interface SendEmailRequest {
  to: string[];
  expense: ExpenseData;
  imageBase64: string;
}

// Simple HTML escaping function
const escapeHtml = (unsafe: string | number): string => {
  return String(unsafe)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[send-expense-email] Unauthorized access attempt", authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[send-expense-email] Missing RESEND_API_KEY");
      throw new Error("Configurazione server mancante (API Key).");
    }

    const { to, expense, imageBase64 }: SendEmailRequest = await req.json();

    if (!to || to.length === 0 || !expense) {
      throw new Error("Dati mancanti per l'invio dell'email.");
    }

    // Extract base64 data safely
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    const formattedDate = expense.date
      ? new Date(expense.date).toLocaleDateString("it-IT", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Data non disponibile";

    // Sanitize inputs
    const safeMerchant = escapeHtml(expense.merchant || "Non specificato");
    const safeDate = escapeHtml(formattedDate);
    const safeCategory = escapeHtml(expense.category || "Non categorizzato");
    const safeCurrency = escapeHtml(expense.currency);
    const safeTotal = expense.total.toFixed(2); // Numbers fixed to 2 decimals don't need escaping but toFixed returns string safe for HTML in this context

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #020617 0%, #0f172a 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
    .field { margin-bottom: 16px; }
    .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 16px; font-weight: 500; color: #0f172a; }
    .total { font-size: 24px; font-weight: 700; color: #0891b2; }
    .items { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
    .footer { text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">📝 Nota Spese</h1>
      <p style="margin: 8px 0 0; opacity: 0.8;">Nuova spesa registrata</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Esercente</div>
        <div class="value">${safeMerchant}</div>
      </div>
      <div class="field">
        <div class="label">Data</div>
        <div class="value">${safeDate}</div>
      </div>
      <div class="field">
        <div class="label">Categoria</div>
        <div class="value">${safeCategory}</div>
      </div>
      <div class="field">
        <div class="label">Totale</div>
        <div class="total">${safeCurrency} ${safeTotal}</div>
      </div>
      ${expense.items && expense.items.length > 0 ? `
      <div class="items">
        <div class="label" style="margin-bottom: 8px;">Articoli</div>
        ${expense.items.map((item) => `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
            <span>${escapeHtml(item.name)} (x${escapeHtml(item.quantity)})</span>
            <span>${safeCurrency} ${item.price.toFixed(2)}</span>
          </div>
        `).join("")}
      </div>
      ` : ""}
    </div>
    <div class="footer">
      Inviato tramite Nota Spese App
    </div>
  </div>
</body>
</html>
    `;

    console.log(`[send-expense-email] Sending email to ${to.length} recipients...`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nota Spese <notifiche@insightnode.it>",
        to: to,
        // Subject typically plain text, but good to be careful. JSON.stringify handles basic escaping for JSON payload.
        subject: `Nota Spese: ${expense.merchant || "Nuova spesa"} - ${expense.currency} ${expense.total.toFixed(2)}`,
        html: emailHtml,
        attachments: [
          {
            filename: "scontrino.jpg",
            content: base64Data,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[send-expense-email] Resend API error:", response.status, errorText);
      throw new Error(`Errore invio email (Resend API): ${response.status}`);
    }

    const emailResponse = await response.json();
    console.log("[send-expense-email] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-expense-email] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});