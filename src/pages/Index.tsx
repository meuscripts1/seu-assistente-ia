import { useEffect, useRef, useState, FormEvent } from "react";
import { Send, Plus, Sparkles, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChatMessage, type Message } from "@/components/ChatMessage";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const SUGGESTIONS = [
  { title: "Explique um conceito", subtitle: "como se eu tivesse 10 anos" },
  { title: "Escreva um e-mail", subtitle: "profissional e cordial" },
  { title: "Ideias criativas", subtitle: "para um projeto novo" },
  { title: "Ajude-me a programar", subtitle: "em React e TypeScript" },
];

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Muitas requisições. Tente novamente em instantes.");
        else if (resp.status === 402) toast.error("Créditos esgotados. Adicione créditos ao seu workspace.");
        else toast.error("Erro ao gerar resposta.");
        setMessages(next);
        setIsLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha de conexão.");
      setMessages(next);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar-bg border-r border-border p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setMessages([])}
        >
          <Plus className="w-4 h-4" /> Nova conversa
        </Button>
        <div className="flex-1 mt-4 text-sm text-muted-foreground px-2">
          Suas conversas aparecerão aqui.
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? "Modo claro" : "Modo escuro"}
        </Button>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border px-4 py-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">IA Brasileira</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Como posso ajudar você hoje?</h2>
              <p className="text-muted-foreground mb-8">Pergunte qualquer coisa, em português.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => send(`${s.title} ${s.subtitle}`)}
                    className="text-left p-4 rounded-xl border border-border hover:bg-accent transition"
                  >
                    <div className="font-medium">{s.title}</div>
                    <div className="text-sm text-muted-foreground">{s.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((m, i) => (
                <ChatMessage key={i} message={m} />
              ))}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Envie uma mensagem..."
              rows={1}
              className="resize-none pr-12 min-h-[52px] max-h-40 rounded-2xl"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            A IA pode cometer erros. Verifique informações importantes.
          </p>
        </form>
      </main>
    </div>
  );
};

export default Index;
