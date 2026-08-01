"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUpIcon,
  BarChart3Icon,
  FileTextIcon,
  UsersIcon,
  GlobeIcon,
  SmileIcon,
  StarIcon,
  CheckCircle2Icon,
  Loader2Icon,
  InboxIcon,
} from "lucide-react";

import { DateRangeFilter, type PresetType } from "@/components/dashboard/DateRangeFilter";
import type { ReportsData } from "@/server/services/reports.service";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";

interface ReportsClientProps {
  initialData: ReportsData;
  initialStartDate: string;
  initialEndDate: string;
}

const BAND_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"]; // Red, Amber, Blue, Emerald
const LANG_COLORS = ["#6366f1", "#06b6d4"]; // Indigo, Cyan

export function ReportsClient({
  initialData,
  initialStartDate,
  initialEndDate,
}: ReportsClientProps) {
  const t = useTranslations("Reports");
  const locale = useLocale();

  const [data, setData] = React.useState<ReportsData>(initialData);
  const [startDate, setStartDate] = React.useState<string>(initialStartDate);
  const [endDate, setEndDate] = React.useState<string>(initialEndDate);
  const [loading, setLoading] = React.useState<boolean>(false);

  const fetchReports = async (sDate: string, eDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/reports?startDate=${encodeURIComponent(sDate)}&endDate=${encodeURIComponent(eDate)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (range: { startDate: string; endDate: string; preset: PresetType }) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchReports(range.startDate, range.endDate);
  };

  const hasSessions = data.completionRate.total > 0;

  // Pie chart data for language breakdown
  const languageData = [
    { name: t("langEn"), value: data.sessionsByLanguage.en, color: LANG_COLORS[0] },
    { name: t("langAr"), value: data.sessionsByLanguage.ar, color: LANG_COLORS[1] },
  ];

  // Satisfaction distribution bar data
  const satisfactionData = [
    { band: toArabicNumerals("0–49%", locale), count: data.satisfactionDistribution.band0to49, label: t("bandLow"), fill: BAND_COLORS[0] },
    { band: toArabicNumerals("50–69%", locale), count: data.satisfactionDistribution.band50to69, label: t("bandModerate"), fill: BAND_COLORS[1] },
    { band: toArabicNumerals("70–89%", locale), count: data.satisfactionDistribution.band70to89, label: t("bandGood"), fill: BAND_COLORS[2] },
    { band: toArabicNumerals("90–100%", locale), count: data.satisfactionDistribution.band90to100, label: t("bandExcellent"), fill: BAND_COLORS[3] },
  ];

  const formatDateTick = (tickItem: string) => {
    if (!tickItem) return "";
    const parts = tickItem.split("-");
    if (parts.length < 3) return tickItem;
    return toArabicNumerals(`${parts[1]}/${parts[2]}`, locale);
  };

  const formatAxisTick = (tick: any) => toArabicNumerals(tick, locale);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Date Range Filter Controls */}
      <DateRangeFilter
        initialPreset="30d"
        initialStartDate={initialStartDate}
        initialEndDate={initialEndDate}
        onChange={handleDateChange}
      />

      {/* Main Content Area */}
      <div className="relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-xs z-20 flex items-center justify-center rounded-2xl">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border shadow-md">
              <Loader2Icon className="size-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-semibold text-foreground">{t("loadingData")}</span>
            </div>
          </div>
        )}

        {!hasSessions ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-card py-20 px-4 text-center">
            <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4">
              <InboxIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("noDataTitle")}</h3>
            <p className="text-sm text-slate-500 max-w-md mt-1">{t("noDataDesc")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Row: Prominent Summary Stat Cards (Google Review Conversion & Completion Rate) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report 7: Google Review Conversion */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-100 dark:border-emerald-950/40 bg-linear-to-br from-emerald-50/50 via-card to-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between border-b border-emerald-100/60 dark:border-emerald-950/40 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <StarIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{t("googleReviewTitle")}</h3>
                      <p className="text-xs text-muted-foreground">{t("googleReviewSubtitle")}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-4xl font-extrabold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                      {toArabicNumerals(data.googleReviewConversion.conversionRate, locale)}%
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">
                      {t("conversionRateLabel")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-background/60 rounded-xl p-3 border border-emerald-100/40 dark:border-emerald-900/20 text-xs">
                    <div>
                      <span className="text-muted-foreground block">{t("thresholdMet")}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {toArabicNumerals(data.googleReviewConversion.thresholdMet, locale)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">{t("totalCompleted")}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {toArabicNumerals(data.googleReviewConversion.totalCompleted, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report 8: Completion Rate */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-950/40 bg-linear-to-br from-indigo-50/50 via-card to-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between border-b border-indigo-100/60 dark:border-indigo-950/40 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                      <CheckCircle2Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{t("completionRateTitle")}</h3>
                      <p className="text-xs text-muted-foreground">{t("completionRateSubtitle")}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-4xl font-extrabold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">
                      {toArabicNumerals(data.completionRate.completionRatePercent, locale)}%
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">
                      {t("completionRateLabel")}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-background/60 rounded-xl p-3 border border-indigo-100/40 dark:border-indigo-900/20 text-xs">
                    <div>
                      <span className="text-emerald-600 font-medium block">{t("statusCompleted")}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {toArabicNumerals(data.completionRate.completed, locale)}
                      </span>
                    </div>
                    <div>
                      <span className="text-rose-500 font-medium block">{t("statusRefused")}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {toArabicNumerals(data.completionRate.refused, locale)}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-500 font-medium block">{t("statusAbandoned")}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {toArabicNumerals(data.completionRate.abandoned, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 2: Charts Row 1 (Score Trend & Session Volume) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report 1: Score Trend Line Chart */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4">
                  <TrendingUpIcon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("scoreTrendTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("scoreTrendSubtitle")}</p>
                  </div>
                </div>
                <div className="h-[260px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.scoreTrend} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                      <XAxis dataKey="date" tickFormatter={formatDateTick} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={formatAxisTick} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any) => [val !== null ? `${toArabicNumerals(val, locale)}%` : t("noData"), t("avgScore")]}
                        labelFormatter={(label) => `${t("dateLabel")}: ${toArabicNumerals(label, locale)}`}
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid rgba(0,0,0,0.1)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgScore"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#6366f1" }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Report 2: Session Volume Stacked/Grouped Bar Chart */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4">
                  <BarChart3Icon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("sessionVolumeTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("sessionVolumeSubtitle")}</p>
                  </div>
                </div>
                <div className="h-[260px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.sessionVolume} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                      <XAxis dataKey="date" tickFormatter={formatDateTick} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tickFormatter={formatAxisTick} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any) => [toArabicNumerals(val, locale), t("sessionsCount")]}
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid rgba(0,0,0,0.1)" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                      <Bar dataKey="completed" name={t("statusCompleted")} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="started" name={t("statusStarted")} fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="refused" name={t("statusRefused")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Grid 3: Breakdown Tables (Sessions by Form & Sessions by Receptionist) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report 3: Sessions by Form */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                  <FileTextIcon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("sessionsByFormTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("sessionsByFormSubtitle")}</p>
                  </div>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="px-4 py-3 text-start">{t("colFormName")}</th>
                        <th className="px-4 py-3 text-center">{t("colSessionsCount")}</th>
                        <th className="px-4 py-3 text-end">{t("colAvgScore")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {data.sessionsByForm.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
                            {t("noData")}
                          </td>
                        </tr>
                      ) : (
                        data.sessionsByForm.map((item) => (
                          <tr key={item.formId} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3.5 font-semibold text-foreground text-start">
                              {item.formName}
                            </td>
                            <td className="px-4 py-3.5 text-center tabular-nums text-muted-foreground">
                              {toArabicNumerals(item.sessionCount, locale)}
                            </td>
                            <td className="px-4 py-3.5 text-end tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                              {item.avgScore !== null ? `${toArabicNumerals(item.avgScore, locale)}%` : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Report 4: Sessions by Receptionist */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                  <UsersIcon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("sessionsByStaffTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("sessionsByStaffSubtitle")}</p>
                  </div>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="px-4 py-3 text-start">{t("colStaffName")}</th>
                        <th className="px-4 py-3 text-center">{t("colSessionsCount")}</th>
                        <th className="px-4 py-3 text-end">{t("colAvgScore")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {data.sessionsByReceptionist.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
                            {t("noData")}
                          </td>
                        </tr>
                      ) : (
                        data.sessionsByReceptionist.map((item) => (
                          <tr key={item.staffId} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3.5 font-semibold text-foreground text-start">
                              {item.staffName}
                            </td>
                            <td className="px-4 py-3.5 text-center tabular-nums text-muted-foreground">
                              {toArabicNumerals(item.sessionCount, locale)}
                            </td>
                            <td className="px-4 py-3.5 text-end tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                              {item.avgScore !== null ? `${toArabicNumerals(item.avgScore, locale)}%` : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Grid 4: Charts Row 2 (Sessions by Language & Satisfaction Distribution) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report 5: Sessions by Language */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4">
                  <GlobeIcon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("languageTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("languageSubtitle")}</p>
                  </div>
                </div>
                <div className="h-[240px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={languageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {languageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Report 6: Satisfaction Distribution Bar Chart */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4">
                  <SmileIcon className="size-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">{t("satisfactionTitle")}</h3>
                    <p className="text-xs text-muted-foreground">{t("satisfactionSubtitle")}</p>
                  </div>
                </div>
                <div className="h-[240px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={satisfactionData} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                      <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tickFormatter={formatAxisTick} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any) => [toArabicNumerals(val, locale), t("sessionsCount")]}
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {satisfactionData.map((entry, index) => (
                          <Cell key={`sat-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
