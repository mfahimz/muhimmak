"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Car,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Search,
  Loader2,
  Trash2,
  Edit2,
  FileCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";

export interface PendingClosureItem {
  id: string;
  sessionId: string;
  plateNumber: string;
  status: "pending" | "delivered" | "still_in_shop";
  invoiceNumber: string | null;
  resolvedBy: string | null;
  resolverName: string | null;
  resolvedAt: string | null;
  flaggedAt: string;
  dropOffCreatedAt: string;
  daysElapsed: number;
}

interface PendingClosuresClientProps {
  closures: PendingClosureItem[];
  role: string;
  currentUserId: string;
}

export function PendingClosuresClient({
  closures,
  role,
}: PendingClosuresClientProps) {
  const router = useRouter();
  const t = useTranslations("PendingClosures");
  const locale = useLocale();

  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Action states
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Mark Delivered Modal State
  const [deliveredModalItem, setDeliveredModalItem] = React.useState<PendingClosureItem | null>(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = React.useState<string>("");

  // Full Edit Modal State (Managers/Admins only)
  const [editModalItem, setEditModalItem] = React.useState<PendingClosureItem | null>(null);
  const [editStatus, setEditStatus] = React.useState<string>("pending");
  const [editInvoice, setEditInvoice] = React.useState<string>("");

  // Delete Modal State (Managers/Admins only)
  const [deleteModalItem, setDeleteModalItem] = React.useState<PendingClosureItem | null>(null);

  const canFullEdit = ["super_admin", "ceo", "agm", "manager"].includes(role);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const formatted = new Date(dateStr).toLocaleString(locale === "ar" ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return toArabicNumerals(formatted, locale);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
            <Clock className="size-3.5" />
            {t("statusPending")}
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
            <CheckCircle2 className="size-3.5" />
            {t("statusDelivered")}
          </span>
        );
      case "still_in_shop":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
            <Wrench className="size-3.5" />
            {t("statusStillInShop")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  // Filter items
  const filteredClosures = React.useMemo(() => {
    return closures.filter((item) => {
      // Status filter
      if (statusFilter && statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toUpperCase();
        if (!item.plateNumber.toUpperCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [closures, statusFilter, searchQuery]);

  // Action Handlers
  const handleMarkStillInShop = async (closureId: string) => {
    setErrorMsg(null);
    setLoadingId(closureId);
    try {
      const res = await fetch(`/api/v1/pending-closures/${closureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_still_in_shop" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("errorAction"));
      }

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t("errorAction"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmMarkDelivered = async () => {
    if (!deliveredModalItem) return;
    setErrorMsg(null);
    setLoadingId(deliveredModalItem.id);
    try {
      const res = await fetch(`/api/v1/pending-closures/${deliveredModalItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_delivered",
          invoiceNumber: invoiceNumberInput.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("errorAction"));
      }

      setDeliveredModalItem(null);
      setInvoiceNumberInput("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t("errorAction"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmFullEdit = async () => {
    if (!editModalItem) return;
    setErrorMsg(null);
    setLoadingId(editModalItem.id);
    try {
      const res = await fetch(`/api/v1/pending-closures/${editModalItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          invoiceNumber: editInvoice.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("errorAction"));
      }

      setEditModalItem(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t("errorAction"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalItem) return;
    setErrorMsg(null);
    setLoadingId(deleteModalItem.id);
    try {
      const res = await fetch(`/api/v1/pending-closures/${deleteModalItem.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("errorAction"));
      }

      setDeleteModalItem(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t("errorAction"));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold underline text-rose-800">Dismiss</button>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <Card className="border border-border p-4 bg-card rounded-2xl shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex bg-muted p-1 rounded-xl border border-border/60 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === "pending" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterPending")}
            </button>
            <button
              onClick={() => setStatusFilter("still_in_shop")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === "still_in_shop" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterStillInShop")}
            </button>
            <button
              onClick={() => setStatusFilter("delivered")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === "delivered" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterDelivered")}
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterAll")}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9 bg-background border-border text-xs rounded-xl h-9"
            />
          </div>
        </div>
      </Card>

      {/* TABLE DATA */}
      <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                <th className="p-3.5 pl-4">{t("colPlate")}</th>
                <th className="p-3.5">{t("colDropOffDate")}</th>
                <th className="p-3.5">{t("colDaysElapsed")}</th>
                <th className="p-3.5">{t("colStatus")}</th>
                <th className="p-3.5">{t("colInvoice")}</th>
                <th className="p-3.5 pr-4 text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredClosures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                    {t("noClosuresFound")}
                  </td>
                </tr>
              ) : (
                filteredClosures.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition">
                    <td className="p-3.5 pl-4 font-mono font-bold text-foreground flex items-center gap-2">
                      <Car className="size-4 text-indigo-500 shrink-0" />
                      <span>{item.plateNumber}</span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        <span>{formatDateTime(item.dropOffCreatedAt)}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          item.daysElapsed >= 7
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.daysElapsed >= 7 && <AlertTriangle className="size-3 shrink-0" />}
                        <span>{toArabicNumerals(item.daysElapsed, locale)} {t("daysUnit")}</span>
                      </span>
                    </td>
                    <td className="p-3.5">{getStatusBadge(item.status)}</td>
                    <td className="p-3.5 font-mono text-muted-foreground">
                      {item.invoiceNumber ? (
                        <span className="font-semibold text-foreground">{item.invoiceNumber}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              disabled={loadingId === item.id}
                              onClick={() => {
                                setDeliveredModalItem(item);
                                setInvoiceNumberInput("");
                              }}
                              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1 shadow-xs"
                            >
                              <FileCheck className="size-3.5" />
                              <span>{t("btnMarkDelivered")}</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loadingId === item.id}
                              onClick={() => handleMarkStillInShop(item.id)}
                              className="h-8 text-xs font-semibold border-border text-foreground hover:bg-muted rounded-lg gap-1"
                            >
                              {loadingId === item.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Wrench className="size-3.5" />
                              )}
                              <span>{t("btnStillInShop")}</span>
                            </Button>
                          </>
                        )}

                        {canFullEdit && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditModalItem(item);
                                setEditStatus(item.status);
                                setEditInvoice(item.invoiceNumber || "");
                              }}
                              className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                              title={t("btnEdit")}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteModalItem(item)}
                              className="size-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              title={t("btnDelete")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL 1: MARK DELIVERED */}
      {deliveredModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-border shadow-2xl bg-card rounded-2xl p-6 space-y-5 animate-scale-in">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <span>{t("modalDeliveredTitle")}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("modalDeliveredSubtitle", { plate: deliveredModalItem.plateNumber })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceInput" className="text-xs font-semibold text-foreground">
                {t("invoiceLabel")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
              </Label>
              <Input
                id="invoiceInput"
                type="text"
                value={invoiceNumberInput}
                onChange={(e) => setInvoiceNumberInput(e.target.value)}
                placeholder="e.g. INV-98765"
                className="bg-background border-border text-sm rounded-xl h-10"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeliveredModalItem(null)}
                className="h-10 text-xs font-semibold rounded-xl"
              >
                {t("btnCancel")}
              </Button>
              <Button
                onClick={handleConfirmMarkDelivered}
                disabled={loadingId === deliveredModalItem.id}
                className="h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md gap-2"
              >
                {loadingId === deliveredModalItem.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span>{t("btnConfirmDelivered")}</span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: FULL EDIT (MANAGERS/ADMINS) */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-border shadow-2xl bg-card rounded-2xl p-6 space-y-5 animate-scale-in">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Edit2 className="size-5 text-indigo-600" />
                <span>{t("modalEditTitle")}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("modalEditSubtitle", { plate: editModalItem.plateNumber })}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">{t("colStatus")}</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pending">{t("statusPending")}</option>
                  <option value="still_in_shop">{t("statusStillInShop")}</option>
                  <option value="delivered">{t("statusDelivered")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">{t("invoiceLabel")}</Label>
                <Input
                  type="text"
                  value={editInvoice}
                  onChange={(e) => setEditInvoice(e.target.value)}
                  placeholder="e.g. INV-98765"
                  className="bg-background border-border text-sm rounded-xl h-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditModalItem(null)}
                className="h-10 text-xs font-semibold rounded-xl"
              >
                {t("btnCancel")}
              </Button>
              <Button
                onClick={handleConfirmFullEdit}
                disabled={loadingId === editModalItem.id}
                className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md gap-2"
              >
                {loadingId === editModalItem.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span>{t("btnSave")}</span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION (MANAGERS/ADMINS) */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border border-rose-200 dark:border-rose-900 shadow-2xl bg-card rounded-2xl p-6 space-y-5 animate-scale-in">
            <div className="size-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-foreground">
                {t("modalDeleteTitle")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("modalDeleteSubtitle", { plate: deleteModalItem.plateNumber })}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteModalItem(null)}
                className="flex-1 h-10 text-xs font-semibold rounded-xl"
              >
                {t("btnCancel")}
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={loadingId === deleteModalItem.id}
                className="flex-1 h-10 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md gap-2"
              >
                {loadingId === deleteModalItem.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span>{t("btnDelete")}</span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
