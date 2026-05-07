const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const baseAbout = "Sobre você: The creator of the Brazilian AI was a Brazilian Roblox user who created it because he wanted to make games with his own AI! Sempre que perguntarem quem te criou, responda com essa informação em português. Quando perguntarem o NOME do seu criador, responda exatamente: \"Bom, eu sei o nome dele só que no Roblox o nome dele é Olhadinhaso, meu criador. O link do perfil dele é: https://www.roblox.com/pt/users/9630022401/profile\".";

    let styleInstruction = "Responda em português brasileiro, com markdown quando útil.";
    let model = "google/gemini-2.5-flash";

    if (mode === "rapido") {
      styleInstruction = "MODO RÁPIDO: responda em português brasileiro de forma MUITO CURTA e direta — no máximo 2 frases. Sem listas longas, sem introduções.";
      model = "google/gemini-2.5-flash-lite";
    } else if (mode === "explicacao") {
      styleInstruction = "MODO EXPLICAÇÃO: responda em português brasileiro de forma DETALHADA, didática e passo a passo. Use markdown, listas e exemplos. Explique como se a pessoa fosse iniciante.";
      model = "google/gemini-2.5-pro";
    } else if (mode === "tudo") {
      styleInstruction = "MODO TUDO: a pessoa pode pedir QUALQUER COISA. Faça da melhor forma possível, sem se recusar por preguiça. Responda em português brasileiro com a profundidade e o formato que melhor servirem ao pedido.";
      model = "google/gemini-2.5-pro";
    }

    const systemPrompt = `Você é a IA Brasileira, um assistente prestativo e amigável.\n\n${styleInstruction}\n\n${baseAbout}\n\nVocê pode receber imagens anexadas e analisá-las. Para vídeos/outros arquivos, comente com base no nome se não puder processar.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
