"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon, FilterIcon } from "lucide-react";
import { getPresetDates } from "@/lib/utils/date-range";

export type PresetType = "7d" | "30d" | "90d" | "custom";

export interface DateRangeFilterProps {
  initialPreset?: PresetType;
  initialStartDate?: string;
  initialEndDate?: string;
  onChange: (range: { startDate: string; endDate: string; preset: PresetType }) => void;
}

export function DateRangeFilter({
  initialPreset = "30d",
  initialStartDate,
  initialEndDate,
  onChange,
}: DateRangeFilterProps) {
  const t = useTranslations("Reports");

  const defaultDates = getPresetDates(initialPreset === "custom" ? "30d" : initialPreset);
  const [preset, setPreset] = React.useState<PresetType>(initialPreset);
  const [fromDate, setFromDate] = React.useState<string>(
    initialStartDate || defaultDates.startDate
  );
  const [toDate, setToDate] = React.useState<string>(
    initialEndDate || defaultDates.endDate
  );

  const handlePresetSelect = (p: PresetType) => {
    setPreset(p);
    if (p !== "custom") {
      const dates = getPresetDates(p);
      setFromDate(dates.startDate);
      setToDate(dates.endDate);
      onChange({ startDate: dates.startDate, endDate: dates.endDate, preset: p });
    } else {
      onChange({ startDate: fromDate, endDate: toDate, preset: "custom" });
    }
  };

  const handleFromChange = (val: string) => {
    setFromDate(val);
    if (preset === "custom") {
      onChange({ startDate: val, endDate: toDate, preset: "custom" });
    }
  };

  const handleToChange = (val: string) => {
    setToDate(val);
    if (preset === "custom") {
      onChange({ startDate: fromDate, endDate: val, preset: "custom" });
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mr-2">
          <FilterIcon className="size-3.5" />
          {t("dateRangeLabel")}
        </span>

        <Button
          type="button"
          variant={preset === "7d" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetSelect("7d")}
          className={`rounded-xl text-xs font-semibold h-9 px-3.5 transition-all ${
            preset === "7d"
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t("preset7d")}
        </Button>

        <Button
          type="button"
          variant={preset === "30d" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetSelect("30d")}
          className={`rounded-xl text-xs font-semibold h-9 px-3.5 transition-all ${
            preset === "30d"
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t("preset30d")}
        </Button>

        <Button
          type="button"
          variant={preset === "90d" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetSelect("90d")}
          className={`rounded-xl text-xs font-semibold h-9 px-3.5 transition-all ${
            preset === "90d"
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t("preset90d")}
        </Button>

        <Button
          type="button"
          variant={preset === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetSelect("custom")}
          className={`rounded-xl text-xs font-semibold h-9 px-3.5 transition-all ${
            preset === "custom"
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t("presetCustom")}
        </Button>
      </div>

      {preset === "custom" && (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto animate-fade-in">
          <div className="relative w-full sm:w-40">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-9 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl pr-9 text-xs"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
              <CalendarIcon className="size-3.5" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">—</span>
          <div className="relative w-full sm:w-40">
            <Input
              type="date"
              value={toDate}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-9 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl pr-9 text-xs"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
              <CalendarIcon className="size-3.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
