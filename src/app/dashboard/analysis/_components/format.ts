"use client";

import { useLocale, useTranslations } from "next-intl";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import type { QuestionAnalysis, StageKey } from "@/lib/analytics/types";

type Labelled = { labelEn: string; labelAr: string | null };

/** Locale aware formatting shared by every part of the analysis page. */
export function useFmt() {
  const locale = useLocale();
  const translate = useTranslations("Analysis");
  const isAr = locale === "ar";

  // Arabic mode uses Eastern Arabic numerals everywhere, including digits written inside a message.
  const t = (key: string, values?: Record<string, string | number>): string =>
    toArabicNumerals(translate(key, values), locale);
  /** For text written by the AI or typed by customers' staff names etc. that may contain digits. */
  const digits = (s: string): string => toArabicNumerals(s, locale);

  const num = (v: number | string | null | undefined): string =>
    v === null || v === undefined ? t("na") : toArabicNumerals(v, locale);
  const pct = (v: number | null | undefined): string => (v === null || v === undefined ? t("na") : `${toArabicNumerals(v, locale)}%`);
  const label = (x: Labelled): string => (isAr && x.labelAr ? x.labelAr : x.labelEn);
  const stage = (s: StageKey): string => t(`stage.${s}`);

  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-AE-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const dateTimeFmt = new Intl.DateTimeFormat(isAr ? "ar-AE-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });
  const monthFmt = new Intl.DateTimeFormat(isAr ? "ar-AE-u-nu-latn" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  /** A YYYY-MM-DD key (no time zone shift). */
  const shortDate = (key: string): string => toArabicNumerals(dateFmt.format(new Date(`${key}T00:00:00Z`)), locale);
  const month = (key: string): string => toArabicNumerals(monthFmt.format(new Date(`${key}-01T00:00:00Z`)), locale);
  /** An ISO instant, shown in UAE time. */
  const dateTime = (iso: string): string => toArabicNumerals(dateTimeFmt.format(new Date(iso)), locale);

  return { locale, isAr, t, digits, num, pct, label, stage, shortDate, month, dateTime };
}

export function findQuestion(questions: QuestionAnalysis[], id: string | undefined): QuestionAnalysis | undefined {
  return id ? questions.find((q) => q.id === id) : undefined;
}

/** Display text of a stored answer (the Arabic option when the viewer reads Arabic). */
export function answerText(q: QuestionAnalysis | undefined, key: string | undefined, isAr: boolean): string {
  if (!key) return "";
  const opt = q?.options.find((o) => o.key === key);
  return isAr && opt?.labelAr ? opt.labelAr : opt?.labelEn ?? key;
}
