"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiChatView } from "@/components/dashboard/ai-chat/AiChatView";
import { useAiChat } from "@/components/dashboard/ai-chat/useAiChat";

interface QuestionAiChatProps {
  questionId: string;
  startDate: string;
  endDate: string;
  visitStage: "all" | "drop_off" | "pick_up";
  disabled: boolean;
}

type Scope = "question" | "all";

/** Chat card for one question. The conversation logic is shared with the Feedback Analysis page. */
export function QuestionAiChat({ questionId, startDate, endDate, visitStage, disabled }: QuestionAiChatProps) {
  const t = useTranslations("Responses");
  const locale = useLocale();

  const [open, setOpen] = React.useState<boolean>(true);
  const [scope, setScope] = React.useState<Scope>("question");

  const chat = useAiChat({
    endpoint: "/api/v1/analysis/chat",
    getBody: () => ({ startDate, endDate, visitStage, locale, questionId: scope === "question" ? questionId : null }),
    genericError: t("chatError"),
    rateLimitError: t("chatRateLimited"),
  });

  // A different scope is a different conversation. The parent remounts this card when the
  // question or filters change.
  const changeScope = (next: Scope) => {
    if (next === scope) return;
    chat.reset();
    setScope(next);
  };

  const suggestions =
    scope === "question"
      ? [t("chatSuggestQ1"), t("chatSuggestQ2"), t("chatSuggestQ3"), t("chatSuggestQ4")]
      : [t("chatSuggestA1"), t("chatSuggestA2"), t("chatSuggestA3")];

  return (
    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/60 via-white to-blue-50/40 dark:from-indigo-950/20 dark:via-slate-900 dark:to-blue-950/20 shadow-xs">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t("chatTitle")}</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {scope === "question" ? t("chatSubtitleQuestion") : t("chatSubtitleAll")}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="gap-1 text-xs shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? t("chatHide") : t("chatShow")}
        </Button>
      </div>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-medium self-start">
            {(["question", "all"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeScope(s)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  scope === s
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {s === "question" ? t("chatScopeQuestion") : t("chatScopeAll")}
              </button>
            ))}
          </div>
          <AiChatView chat={chat} suggestions={suggestions} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
