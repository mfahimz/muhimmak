"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AiChatView } from "@/components/dashboard/ai-chat/AiChatView";
import type { AiChat } from "@/components/dashboard/ai-chat/useAiChat";
import { useFmt } from "./format";

interface AnalysisChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: AiChat;
  focusLabel: string | null;
  onClearFocus: () => void;
  disabled: boolean;
}

export function AnalysisChatSheet({ open, onOpenChange, chat, focusLabel, onClearFocus, disabled }: AnalysisChatSheetProps) {
  const { t, isAr } = useFmt();
  const suggestions = focusLabel
    ? [t("chat.focusS1"), t("chat.focusS2"), t("chat.focusS3")]
    : [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isAr ? "left" : "right"} className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("chat.title")}</SheetTitle>
          <SheetDescription>{t("chat.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <AiChatView
            chat={chat}
            suggestions={suggestions}
            disabled={disabled}
            className="min-h-0 flex-1"
            messagesClassName="min-h-0 flex-1 max-h-none"
            contextNote={
              focusLabel ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
                  <span className="truncate">{t("chat.focus", { question: focusLabel })}</span>
                  <button type="button" onClick={onClearFocus} aria-label={t("chat.clearFocus")} className="shrink-0 rounded-full hover:bg-primary/10">
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : undefined
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
