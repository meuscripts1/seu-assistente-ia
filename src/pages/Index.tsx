import { useEffect, useRef, useState, FormEvent } from "react";
import { Send, Plus, Sparkles, Moon, Sun, MessageSquare, Trash2, X, Image as ImageIcon, Video as VideoIcon, FileIcon, Mic, MicOff, Zap, BookOpen, Infinity as InfinityIcon, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthButton } from "@/components/AuthButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChatMessage, type Message, type Attachment } from "@/components/ChatMessage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const SUGGESTIONS = [
  { title: "Explique um conceito", subtitle: "como se eu tivesse 10 anos" },
  { title: "Escreva um e-mail", subtitle: "profissional e cordial" },
  { title: "Ideias criativas", subtitle: "para um projeto novo" },
  { title: "Ajude-me a programar", subtitle: "em React e TypeScript" },
];

type Conversation = { id: string; title: string; messages: Message[] };

const newId = () => Math.random().toString(36).slice(2, 10);

const UPLOAD_LIMIT = 3;
const UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;
const UPLOAD_KEY = "ia-br-uploads";

type UploadRecord = { count: number; firstAt: number };

const readUploads = (): UploadRecord => {
  try {
    const raw = localStorage.getItem(UPLOAD_KEY);
    if (!raw) return { count: 0, firstAt: 0 };
    const r = JSON.parse(raw) as UploadRecord;
    if (Date.now() - r.firstAt > UPLOAD_WINDOW_MS) return { count: 0, firstAt: 0 };
    return r;
  } catch {
    return { count: 0, firstAt: 0 };
  }
};

const writeUploads = (r: UploadRecord) => {
  localStorage.setItem(UPLOAD_KEY, JSON.stringify(r));
};

const formatRemaining = (ms: number) => {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const Index = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<string>("*/*");

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let baseText = input;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error !== "no-speech") toast.error("Erro no microfone: " + e.error);
    };
    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((baseText ? baseText + " " : "") + transcript);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateConv = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const openPicker = (accept: string) => {
    const rec = readUploads();
    if (rec.count >= UPLOAD_LIMIT) {
      const remaining = UPLOAD_WINDOW_MS - (Date.now() - rec.firstAt);
      toast.error(`Limite de ${UPLOAD_LIMIT} envios atingido. Tente novamente em ${formatRemaining(remaining)}.`);
      return;
    }
    acceptRef.current = accept;
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const rec = readUploads();
    const available = UPLOAD_LIMIT - rec.count;
    if (available <= 0) {
      const remaining = UPLOAD_WINDOW_MS - (Date.now() - rec.firstAt);
      toast.error(`Limite atingido. Tente em ${formatRemaining(remaining)}.`);
      return;
    }
    const arr = Array.from(files).slice(0, available);
    const newOnes: Attachment[] = [];
    for (const f of arr) {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} é maior que 15MB.`);
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      const kind: Attachment["kind"] = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("video/")
        ? "video"
        : "file";
      newOnes.push({ name: f.name, type: f.type, kind, dataUrl, size: f.size });
    }
    if (newOnes.length === 0) return;
    const next: UploadRecord = {
      count: rec.count + newOnes.length,
      firstAt: rec.firstAt || Date.now(),
    };
    writeUploads(next);
    setPending((p) => [...p, ...newOnes]);
    const left = UPLOAD_LIMIT - next.count;
    toast.success(`Anexado. ${left} envio(s) restante(s) nas próximas 24h.`);
  };

  const removePending = (idx: number) => {
    setPending((p) => p.filter((_, i) => i !== idx));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && pending.length === 0) || isLoading) return;

    let convId = activeId;
    let baseMessages: Message[] = messages;

    if (!convId) {
      convId = newId();
      const titleSrc = trimmed || pending[0]?.name || "Nova conversa";
      const title = titleSrc.length > 40 ? titleSrc.slice(0, 40) + "…" : titleSrc;
      const conv: Conversation = { id: convId, title, messages: [] };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(convId);
      baseMessages = [];
    }

    const userAttachments = pending;
    const userMsg: Message = {
      role: "user",
      content: trimmed,
      attachments: userAttachments.length ? userAttachments : undefined,
    };
    const next = [...baseMessages, userMsg];
    updateConv(convId, (c) => ({
      ...c,
      title:
        c.messages.length === 0
          ? ((trimmed || userAttachments[0]?.name || "Nova conversa").slice(0, 40) +
            ((trimmed || userAttachments[0]?.name || "").length > 40 ? "…" : ""))
          : c.title,
      messages: [...next, { role: "assistant", content: "" }],
    }));
    setInput("");
    setPending([]);
    setIsLoading(true);

    // Build payload for the AI: send images as multimodal content; describe other files.
    const apiMessages = next.map((m) => {
      if (m.role !== "user" || !m.attachments?.length) {
        return { role: m.role, content: m.content };
      }
      const parts: any[] = [];
      const nonImageNotes: string[] = [];
      for (const a of m.attachments) {
        if (a.kind === "image") {
          parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
        } else {
          nonImageNotes.push(`[${a.kind === "video" ? "Vídeo" : "Arquivo"} anexado: ${a.name} (${a.type || "desconhecido"})]`);
        }
      }
      const textPart = [m.content, ...nonImageNotes].filter(Boolean).join("\n");
      parts.unshift({ type: "text", text: textPart || "(sem texto)" });
      return { role: m.role, content: parts };
    });

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Muitas requisições. Tente novamente em instantes.");
        else if (resp.status === 402) toast.error("Créditos esgotados. Adicione créditos ao seu workspace.");
        else toast.error("Erro ao gerar resposta.");
        updateConv(convId, (c) => ({ ...c, messages: next }));
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
              updateConv(convId!, (cv) => {
                const copy = [...cv.messages];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return { ...cv, messages: copy };
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
      updateConv(convId, (c) => ({ ...c, messages: next }));
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

  const startNew = () => {
    setActiveId(null);
    setInput("");
    setPending([]);
  };

  const deleteConv = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar-bg border-r border-border p-3 gap-3">
        <AuthButton />
        <Button variant="outline" className="w-full justify-start gap-2" onClick={startNew}>
          <Plus className="w-4 h-4" /> Nova conversa
        </Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <div className="text-sm text-muted-foreground px-2">
              Suas conversas aparecerão aqui.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition ${
                  c.id === activeId ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                  className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
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
          <button
            onClick={startNew}
            className="flex items-center gap-2 hover:opacity-80 transition"
            aria-label="Nova conversa"
          >
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">IA Brasileira</h1>
          </button>
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
          <div className="max-w-3xl mx-auto">
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pending.map((a, i) => (
                  <div key={i} className="relative group">
                    {a.kind === "image" ? (
                      <img src={a.dataUrl} alt={a.name} className="w-16 h-16 object-cover rounded-lg border border-border" />
                    ) : a.kind === "video" ? (
                      <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                        <VideoIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePending(i)}
                      className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label="Remover anexo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Envie uma mensagem..."
                rows={1}
                className="resize-none pl-12 pr-12 min-h-[52px] max-h-40 rounded-2xl"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 bottom-2 h-8 w-8 rounded-lg"
                    aria-label="Anexar arquivo"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onClick={() => openPicker("image/*")}>
                    <ImageIcon className="w-4 h-4 mr-2" /> Foto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openPicker("video/*")}>
                    <VideoIcon className="w-4 h-4 mr-2" /> Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openPicker("*/*")}>
                    <FileIcon className="w-4 h-4 mr-2" /> Arquivo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                size="icon"
                variant={listening ? "destructive" : "ghost"}
                onClick={toggleMic}
                className="absolute right-12 bottom-2 h-8 w-8 rounded-lg"
                aria-label="Falar"
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && pending.length === 0) || isLoading}
                className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            A IA pode cometer erros. Limite de 3 envios de arquivos a cada 24h.
          </p>
        </form>
      </main>
    </div>
  );
};

export default Index;
