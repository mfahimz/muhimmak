"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { UserCheck2Icon, Loader2Icon, UserIcon } from "lucide-react";
import ReceptionistImpactCard from "./ReceptionistImpactCard";
import { ReceptionistImpactData } from "@/server/services/sessions.service";

interface ReceptionistOption {
  id: string;
  full_name: string;
}

interface ReceptionistImpactSelectorProps {
  receptionists: ReceptionistOption[];
}

export default function ReceptionistImpactSelector({
  receptionists,
}: ReceptionistImpactSelectorProps) {
  const t = useTranslations("Impact");
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    receptionists[0]?.id || ""
  );
  const [impactData, setImpactData] = useState<ReceptionistImpactData | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReceptionist = receptionists.find(
    (r) => r.id === selectedStaffId
  );
  const selectedName = selectedReceptionist?.full_name || t("unknownStaff");

  useEffect(() => {
    if (!selectedStaffId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/dashboard/receptionist-impact?staffId=${selectedStaffId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch impact stats");
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setImpactData(json.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Impact fetch error:", err);
          setError(t("selectorError"));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStaffId, t]);

  if (receptionists.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        {t("noReceptionistsFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dropdown Selector Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
            <UserCheck2Icon className="size-5" />
          </div>
          <div className="text-start">
            <h3 className="text-sm font-bold text-foreground">
              {t("selectorTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("selectorSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px]">
            <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-8 py-2 text-sm font-semibold text-foreground shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {receptionists.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2Icon className="size-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">
            {t("loadingImpactData")}
          </p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-6 text-center text-rose-600 text-sm font-semibold">
          {error}
        </div>
      ) : impactData ? (
        <ReceptionistImpactCard data={impactData} staffName={selectedName} />
      ) : null}
    </div>
  );
}
