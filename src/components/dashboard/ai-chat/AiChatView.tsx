"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import type { AiChat } from "./useAiChat";

interface AiChatViewProps {
  chat: AiChat;
  suggestions: string[];
  disabled?: boolean;
  /** Extra context line shown above the input (for example the question in focus). */
  contextNote?: React.ReactNode;
  className?: string;
  messagesClassName?: string;
}

/** Renders "- " lines as a list and everything else as paragraphs. Plain text only, never HTML. */
function Reply({ text }: { text: string }) {
  const blocks: Array<{ list: boolean; lines: string[] }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const isItem = line.startsWith("- ");
    const last = blocks[blocks.length - 1];
    if (last && last.list === isItem) last.lines.push(isItem ? line.slice(2) : line);
    else blocks.push({ list: isItem, lines: [isItem ? line.slice(2) : line] });
  }
  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} className="list-disc ps-5 space-y-0.5">
            {b.lines.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        ) : (
          b.lines.map((l, j) => <p key={`${i}-${j}`}>{l}</p>)
        )
      )}
    </div>
  );
}

export function AiChatView({ chat, suggestions, disabled, contextNote, className, messagesClassName }: AiChatViewProps) {
  const t = useTranslations("AiChat");
  const locale = useLocale();
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { messages, busy, error, send, stop, reset, maxInputChars } = chat;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const submit = (text: string) => {
    if (!text.trim() || busy || disabled) return;
    setInput("");
    void send(text);
  };

  const waitingForFirstToken = busy && messages[messages.length - 1]?.role === "user";

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div
        ref={scrollRef}
        aria-live="polite"
        className={`flex flex-col gap-2.5 overflow-y-auto rounded-lg border border-border bg-background/60 p-3 min-h-24 ${messagesClassName ?? "max-h-96"}`}
      >
        {messages.length === 0 && !busy && (
          <p className="m-auto text-center text-xs text-muted-foreground">{t("empty")}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            dir="auto"
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed text-start ${
              m.role === "user"
                ? "self-end bg-primary text-primary-foreground whitespace-pre-wrap"
                : "self-start bg-muted text-foreground"
            }`}
          >
            {m.role === "assistant" ? <Reply text={toArabicNumerals(m.content, locale)} /> : m.content}
            {m.truncated && <p className="mt-2 text-xs italic text-muted-foreground">{t("cutOff")}</p>}
          </div>
        ))}
        {waitingForFirstToken && (
          <div className="self-start flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("thinking")}
          </div>
        )}
        {error && (
          <div role="alert" className="self-start rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>

      {messages.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || disabled}
              onClick={() => submit(s)}
              className="rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {contextNote && <div className="text-[11px] text-muted-foreground">{contextNote}</div>}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={2}
          maxLength={maxInputChars}
          dir="auto"
          disabled={disabled}
          placeholder={t("placeholder")}
          className="flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring/30 focus:border-ring disabled:opacity-50"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={stop} className="gap-1.5 text-xs font-semibold">
            <Square className="h-3.5 w-3.5" />
            {t("stop")}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submit(input)}
            disabled={disabled || !input.trim()}
            className="gap-1.5 text-xs font-semibold"
          >
            <Send className="h-4 w-4 rtl:-scale-x-100" />
            {t("send")}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t("disclaimer")}</p>
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
            {t("clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
