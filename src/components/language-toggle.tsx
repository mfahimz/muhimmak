"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();

  const handleToggle = (nextLocale: "en" | "ar") => {
    if (nextLocale === locale) return;
    
    // Persist choice in standard NEXT_LOCALE cookie
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    
    // Refresh to immediately reload RSC components under new locale
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
      <span>Language / اللغة</span>
      <div className="relative flex p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-md">
        <button
          type="button"
          onClick={() => handleToggle("en")}
          className={`px-2.5 py-1 rounded-sm text-[10px] tracking-wider transition-all duration-200 cursor-pointer ${
            locale === "en"
              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => handleToggle("ar")}
          className={`px-2.5 py-1 rounded-sm text-[10px] tracking-wider transition-all duration-200 cursor-pointer ${
            locale === "ar"
              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          AR
        </button>
      </div>
    </div>
  );
}
