"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import {
  PlusIcon,
  PencilIcon,
  ShieldAlertIcon,
  KeyRoundIcon,
  CheckIcon,
  CopyIcon,
  UserCheckIcon,
  UserXIcon,
  AlertTriangleIcon,
  Loader2Icon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  notification_email?: string | null;
}

interface UsersClientProps {
  initialUsers: UserProfile[];
  currentUserId: string;
}

const ROLES_LIST = ["super_admin", "ceo", "agm", "manager", "receptionist"] as const;

export function UsersClient({ initialUsers, currentUserId }: UsersClientProps) {
  const t = useTranslations("Users");
  const locale = useLocale();

  const [users, setUsers] = React.useState<UserProfile[]>(initialUsers);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserProfile | null>(null);
  const [confirmStatusUser, setConfirmStatusUser] = React.useState<{
    user: UserProfile;
    nextState: boolean;
  } | null>(null);
  const [confirmResetPinUser, setConfirmResetPinUser] = React.useState<UserProfile | null>(null);

  // Plaintext PIN Modal (only dismissable via explicit acknowledgment)
  const [pinModalData, setPinModalData] = React.useState<{
    userName: string;
    pin: string;
    isReset: boolean;
  } | null>(null);
  const [hasCopiedPin, setHasCopiedPin] = React.useState(false);

  // Form states
  const [createName, setCreateName] = React.useState("");
  const [createRole, setCreateRole] = React.useState<string>("receptionist");
  const [createNotificationEmail, setCreateNotificationEmail] = React.useState("");

  const [editName, setEditName] = React.useState("");
  const [editRole, setEditRole] = React.useState<string>("receptionist");
  const [editNotificationEmail, setEditNotificationEmail] = React.useState("");

  const [customPin, setCustomPin] = React.useState("");

  // Loading flags
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionUserId, setActionUserId] = React.useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    try {
      const formatted = new Date(dateStr).toLocaleDateString(
        locale === "ar" ? "ar-AE" : "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
      return toArabicNumerals(formatted, locale);
    } catch {
      return toArabicNumerals(dateStr, locale);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
      case "ceo":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
      case "agm":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      case "manager":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  // ---------------------------------------------------------------------------
  // Create User
  // ---------------------------------------------------------------------------
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error(t("errorNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: createName.trim(),
          role: createRole,
          notificationEmail: createNotificationEmail.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("errorCreate"));
      }

      setUsers((prev) => [data.user, ...prev]);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateRole("receptionist");
      setCreateNotificationEmail("");

      toast.success(t("userCreatedSuccess"));

      // Display PIN modal
      setHasCopiedPin(false);
      setPinModalData({
        userName: data.user.full_name,
        pin: data.pin,
        isReset: false,
      });
    } catch (err: any) {
      toast.error(err.message || t("errorCreate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Edit User
  // ---------------------------------------------------------------------------
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditRole(user.role);
    setEditNotificationEmail(user.notification_email || "");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      toast.error(t("errorNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editName.trim(),
          role: editRole,
          notificationEmail: editNotificationEmail.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("errorUpdate"));
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? data.user : u))
      );
      setEditingUser(null);
      toast.success(t("userUpdatedSuccess"));
    } catch (err: any) {
      toast.error(err.message || t("errorUpdate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle Active/Inactive Status
  // ---------------------------------------------------------------------------
  const handleToggleStatus = async () => {
    if (!confirmStatusUser) return;
    const { user, nextState } = confirmStatusUser;

    if (user.id === currentUserId && !nextState) {
      toast.error(t("cannotDeactivateSelf"));
      setConfirmStatusUser(null);
      return;
    }

    setActionUserId(user.id);
    try {
      const res = await fetch(`/api/v1/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("errorStatus"));
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? data.user : u))
      );
      toast.success(
        nextState ? t("userReactivatedSuccess") : t("userDeactivatedSuccess")
      );
    } catch (err: any) {
      toast.error(err.message || t("errorStatus"));
    } finally {
      setActionUserId(null);
      setConfirmStatusUser(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset PIN
  // ---------------------------------------------------------------------------
  const handleResetPin = async () => {
    if (!confirmResetPinUser) return;
    const targetUser = confirmResetPinUser;

    setActionUserId(targetUser.id);
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: customPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("errorResetPin"));
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? data.user : u))
      );
      toast.success(t("pinResetSuccess"));

      // Display PIN modal
      setHasCopiedPin(false);
      setPinModalData({
        userName: data.user.full_name,
        pin: data.pin,
        isReset: true,
      });
      setCustomPin("");
    } catch (err: any) {
      toast.error(err.message || t("errorResetPin"));
    } finally {
      setActionUserId(null);
      setConfirmResetPinUser(null);
    }
  };

  const copyPinToClipboard = () => {
    if (!pinModalData) return;
    navigator.clipboard.writeText(pinModalData.pin);
    setHasCopiedPin(true);
    toast.success(t("copied"));
    setTimeout(() => setHasCopiedPin(false), 3000);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-xs h-10 px-5 rounded-xl self-start sm:self-auto"
        >
          <PlusIcon className="size-4" />
          <span>{t("createUser")}</span>
        </Button>
      </div>

      {/* Staff Table */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-card py-20 px-4 text-center">
          <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4">
            <UsersIcon className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t("noUsers")}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
            {t("noUsersSubtitle")}
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          >
            <PlusIcon className="size-4 mr-1.5" />
            {t("createUser")}
          </Button>
        </div>
      ) : (
        <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="px-6 py-4 text-start font-semibold">
                      {t("name")}
                    </th>
                    <th className="px-6 py-4 text-center font-semibold">
                      {t("role")}
                    </th>
                    <th className="px-6 py-4 text-center font-semibold">
                      {t("status")}
                    </th>
                    <th className="px-6 py-4 text-center font-semibold">
                      {t("createdAt")}
                    </th>
                    <th className="px-6 py-4 text-end font-semibold">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isLoading = actionUserId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase shrink-0">
                              {user.full_name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                {user.full_name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                                  {t("youBadge")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <Badge
                            className={`rounded-md font-semibold px-2.5 py-0.5 text-xs ${getRoleBadgeVariant(
                              user.role
                            )}`}
                          >
                            {t(`roles.${user.role}`)}
                          </Badge>
                        </td>

                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {user.is_active ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-md font-medium px-2.5 py-0.5">
                              {t("statusActive")}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 rounded-md font-medium px-2.5 py-0.5">
                              {t("statusInactive")}
                            </Badge>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="px-6 py-4 text-end whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              disabled={isLoading}
                              className="h-8 px-2.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-indigo-400 dark:hover:bg-slate-800"
                            >
                              <PencilIcon className="size-3.5 mr-1" />
                              {t("edit")}
                            </Button>

                            {/* Reset PIN Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmResetPinUser(user)}
                              disabled={isLoading}
                              className="h-8 px-2.5 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                            >
                              <KeyRoundIcon className="size-3.5 mr-1" />
                              {t("resetPin")}
                            </Button>

                            {/* Deactivate/Reactivate Toggle */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmStatusUser({
                                  user,
                                  nextState: !user.is_active,
                                })
                              }
                              disabled={isLoading || (isSelf && user.is_active)}
                              title={
                                isSelf && user.is_active
                                  ? t("cannotDeactivateSelf")
                                  : undefined
                              }
                              className={`h-8 px-2.5 text-xs font-semibold ${
                                user.is_active
                                  ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              }`}
                            >
                              {user.is_active ? (
                                <>
                                  <UserXIcon className="size-3.5 mr-1" />
                                  {t("deactivate")}
                                </>
                              ) : (
                                <>
                                  <UserCheckIcon className="size-3.5 mr-1" />
                                  {t("reactivate")}
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Create User Modal */}
      {/* ------------------------------------------------------------------- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold text-foreground">
                {t("createUser")}
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-fullname" className="text-xs font-bold text-foreground">
                  {t("name")}
                </Label>
                <Input
                  id="create-fullname"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  required
                  autoFocus
                  className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-role" className="text-xs font-bold text-foreground">
                  {t("role")}
                </Label>
                <Select value={createRole} onValueChange={(val) => val && setCreateRole(val)}>
                  <SelectTrigger id="create-role" className="h-10 text-sm border-slate-200 focus:ring-indigo-500 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_LIST.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-notification-email" className="text-xs font-bold text-foreground">
                  {t("notificationEmail")}
                </Label>
                <Input
                  id="create-notification-email"
                  type="email"
                  value={createNotificationEmail}
                  onChange={(e) => setCreateNotificationEmail(e.target.value)}
                  placeholder="e.g. staff@example.com"
                  className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="h-9 text-xs font-semibold"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 text-xs font-semibold shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                      {t("saving")}
                    </>
                  ) : (
                    t("create")
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Edit User Modal */}
      {/* ------------------------------------------------------------------- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold text-foreground">
                {t("editUser")}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-fullname" className="text-xs font-bold text-foreground">
                  {t("name")}
                </Label>
                <Input
                  id="edit-fullname"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-role" className="text-xs font-bold text-foreground">
                  {t("role")}
                </Label>
                <Select
                  value={editRole}
                  onValueChange={(val) => val && setEditRole(val)}
                  disabled={editingUser.id === currentUserId}
                >
                  <SelectTrigger id="edit-role" className="h-10 text-sm border-slate-200 focus:ring-indigo-500 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_LIST.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingUser.id === currentUserId && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    {t("cannotDemoteSelf")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notification-email" className="text-xs font-bold text-foreground">
                  {t("notificationEmail")}
                </Label>
                <Input
                  id="edit-notification-email"
                  type="email"
                  value={editNotificationEmail}
                  onChange={(e) => setEditNotificationEmail(e.target.value)}
                  placeholder="e.g. staff@example.com"
                  className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={isSubmitting}
                  className="h-9 text-xs font-semibold"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 text-xs font-semibold shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                      {t("saving")}
                    </>
                  ) : (
                    t("save")
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Status Confirm Modal */}
      {/* ------------------------------------------------------------------- */}
      {confirmStatusUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <ShieldAlertIcon className="size-6 shrink-0" />
              <h3 className="text-base font-bold text-foreground">
                {confirmStatusUser.nextState ? t("reactivate") : t("deactivate")}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {confirmStatusUser.nextState
                ? t("confirmReactivate", { name: confirmStatusUser.user.full_name })
                : t("confirmDeactivate", { name: confirmStatusUser.user.full_name })}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setConfirmStatusUser(null)}
                className="h-8 text-xs font-semibold"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleToggleStatus}
                className={
                  confirmStatusUser.nextState
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs font-semibold"
                    : "bg-rose-600 hover:bg-rose-500 text-white h-8 text-xs font-semibold"
                }
              >
                {confirmStatusUser.nextState ? t("reactivate") : t("deactivate")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Reset PIN Confirm Modal */}
      {/* ------------------------------------------------------------------- */}
      {confirmResetPinUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold text-foreground">
                {t("resetPinTitle", { name: confirmResetPinUser.full_name })}
              </h3>
              <button
                onClick={() => {
                  setConfirmResetPinUser(null);
                  setCustomPin("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custom-pin-input" className="text-xs font-bold text-foreground">
                {t("enterNewPin")}
              </Label>
              <Input
                id="custom-pin-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={customPin}
                onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
                className="h-10 text-sm border-slate-200 focus-visible:ring-indigo-500 font-mono tracking-widest text-center text-lg"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmResetPinUser(null);
                  setCustomPin("");
                }}
                className="h-9 text-xs font-semibold"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleResetPin}
                disabled={customPin.length !== 4}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 text-xs font-semibold disabled:opacity-50"
              >
                {t("resetPinConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Plaintext PIN Display Modal (Non-dismissable via outside click / X) */}
      {/* ------------------------------------------------------------------- */}
      {pinModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            {/* Modal Title */}
            <div className="space-y-2">
              <div className="size-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-inner">
                <KeyRoundIcon className="size-7" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {pinModalData.isReset
                  ? t("pinResetModalTitle")
                  : t("pinModalTitle")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {pinModalData.userName}
              </p>
            </div>

            {/* Plaintext PIN Display */}
            <div className="bg-slate-50 dark:bg-slate-900/90 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-6 relative group">
              <div className="text-4xl font-mono font-extrabold tracking-[0.4em] text-indigo-600 dark:text-indigo-400 select-all pl-4">
                {pinModalData.pin}
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyPinToClipboard}
                  className="h-8 px-4 text-xs font-semibold gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60"
                >
                  {hasCopiedPin ? (
                    <>
                      <CheckIcon className="size-3.5 text-emerald-600" />
                      <span>{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" />
                      <span>{t("copyPin")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Strict Warning Banner */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3.5 flex items-start gap-2.5 text-start">
              <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-snug">
                {t("pinModalWarning")}
              </p>
            </div>

            {/* Explicit Acknowledgment Button */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setPinModalData(null)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 text-sm rounded-xl shadow-md transition-all active:scale-98"
              >
                {t("acknowledgePin")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
