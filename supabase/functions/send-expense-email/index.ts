import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  to: string;
  expense: ExpenseData;
  imageBase64: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { to, expense, imageBase64 }: SendEmailRequest = await req.json();

    if (!to || !expense) {
      throw new Error("Missing required fields");
    }

    // Extract base64 data
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    // Format date
    const formattedDate = expense.date
      ? new Date(expense.date).toLocaleDateString("it-IT", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Data non disponibile";

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
        <div class="value">${expense.merchant || "Non specificato"}</div>
      </div>
      <div class="field">
        <div class="label">Data</div>
        <div class="value">${formattedDate}</div>
      </div>
      <div class="field">
        <div class="label">Categoria</div>
        <div class="value">${expense.category || "Non categorizzato"}</div>
      </div>
      <div class="field">
        <div class="label">Totale</div>
        <div class="total">${expense.currency} ${expense.total.toFixed(2)}</div>
      </div>
      ${expense.items.length > 0 ? `
      <div class="items">
        <div class="label" style="margin-bottom: 8px;">Articoli</div>
        ${expense.items.map((item) => `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
            <span>${item.name} (x${item.quantity})</span>
            <span>${expense.currency} ${item.price.toFixed(2)}</span>
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

    // Send email via Resend API directly
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nota Spese <notifiche@insightnode.it>",
        to: [to],
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
      console.error("Resend API error:", response.status, errorText);
      throw new Error(`Email send failed: ${response.status}`);
    }

    const emailResponse = await response.json();
    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-expense-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
