"use client";

import * as React from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** The answer stopped at the length limit. */
  truncated?: boolean;
}

interface UseAiChatOptions {
  endpoint: string;
  /** Fields merged into every request (filters, locale, focus question). Read at send time. */
  getBody: () => Record<string, unknown>;
  genericError: string;
  rateLimitError: string;
}

const MAX_INPUT_CHARS = 1000;

/**
 * Chat state plus a streaming client for the NDJSON chat endpoint.
 * Each line is {t:"d",v:text} (delta), {t:"x"} (done) or {t:"e"} (error).
 * The endpoint answers with plain JSON ({reply} or {error}) when it cannot stream.
 */
export function useAiChat({ endpoint, getBody, genericError, rateLimitError }: UseAiChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const bodyRef = React.useRef(getBody);
  const errorRef = React.useRef(genericError);
  const rateLimitRef = React.useRef(rateLimitError);
  const messagesRef = React.useRef<ChatMessage[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    bodyRef.current = getBody;
    errorRef.current = genericError;
    rateLimitRef.current = rateLimitError;
  });

  const commit = React.useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const reset = React.useCallback(() => {
    requestRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setBusy(false);
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const send = React.useCallback(
    async (text: string) => {
      const content = text.trim().slice(0, MAX_INPUT_CHARS);
      if (!content || abortRef.current) return;

      const history = [...messagesRef.current, { role: "user" as const, content }];
      commit(history);
      setError(null);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      const live = () => requestRef.current === requestId;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...bodyRef.current(), messages: history }),
          signal: controller.signal,
        });

        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || type.includes("application/json")) {
          const json = await res.json().catch(() => ({}));
          if (!live()) return;
          if (res.ok && typeof json.reply === "string") {
            commit([...history, { role: "assistant", content: json.reply }]);
            return;
          }
          // Server messages are English only, so the viewer gets a localized one instead.
          throw new Error(res.status === 429 ? rateLimitRef.current : errorRef.current);
        }
        if (!res.body) throw new Error(errorRef.current);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        let failed = false;
        let truncated = false;

        const handle = (line: string) => {
          if (!line.trim()) return;
          try {
            const evt = JSON.parse(line) as { t?: string; v?: string };
            if (evt.t === "d" && typeof evt.v === "string") {
              answer += evt.v;
              if (live()) commit([...history, { role: "assistant", content: answer }]);
            } else if (evt.t === "l") {
              truncated = true;
            } else if (evt.t === "e") {
              failed = true;
            }
          } catch {
            // ignore a malformed line
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        handle(buffer);

        if (!live()) return;
        if (failed || !answer) {
          if (!answer) commit(history);
          throw new Error(errorRef.current);
        }
        if (truncated) commit([...history, { role: "assistant", content: answer, truncated: true }]);
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError" || !live()) return;
        setError((err as Error).message || errorRef.current);
      } finally {
        if (live()) {
          abortRef.current = null;
          setBusy(false);
        }
      }
    },
    [commit, endpoint]
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, busy, error, send, stop, reset, maxInputChars: MAX_INPUT_CHARS };
}

export type AiChat = ReturnType<typeof useAiChat>;
