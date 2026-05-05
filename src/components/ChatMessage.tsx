import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";

const AnimatedAssistant = ({ content }: { content: string }) => {
  const [displayed, setDisplayed] = useState("");
  const targetRef = useRef(content);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = content;
    if (rafRef.current != null) return;

    const step = () => {
      setDisplayed((prev) => {
        const target = targetRef.current;
        if (prev.length >= target.length) {
          rafRef.current = null;
          return prev;
        }
        const remaining = target.length - prev.length;
        const chunk = Math.max(1, Math.min(remaining, Math.ceil(remaining / 12)));
        rafRef.current = requestAnimationFrame(step);
        return target.slice(0, prev.length + chunk);
      });
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [content]);

  return <ReactMarkdown>{displayed}</ReactMarkdown>;
};

export type Message = { role: "user" | "assistant"; content: string };

export const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";
  return (
    <div className={`w-full ${isUser ? "bg-chat-user" : "bg-chat-assistant"}`}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex gap-4">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-muted-foreground/20" : "bg-primary"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 text-foreground" />
          ) : (
            <Bot className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 prose-chat">
          {message.content ? (
            isUser ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              <AnimatedAssistant content={message.content} />
            )
          ) : (
            <div className="flex gap-1 items-center h-6">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
