import React from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, Users, Calendar, Loader2 } from "lucide-react";
import { useActivationInvitations } from "../../../hooks/useCreatorRequestInvitations";
import {
  useCancelInvitation,
  useReleasePayment,
} from "../../../hooks/useCreatorRequestInvitations";
import type { Activation } from "../../../lib/types/database";
import type { CreatorRequestInvitation } from "../../../lib/types/database";
import { format } from "date-fns";

interface ActivationDetailCreatorRequestProps {
  activation: Activation;
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type InvitationWithCreator = CreatorRequestInvitation & {
  creators?: { id: string; name: string | null; handle: string | null } | null;
};

export function ActivationDetailCreatorRequest({
  activation,
  onNavigate,
}: ActivationDetailCreatorRequestProps) {
  const { data: invitations = [], isLoading } = useActivationInvitations(
    activation.id,
    { withCreator: true }
  );
  const cancelInvitation = useCancelInvitation();
  const releasePayment = useReleasePayment();

  const typedInvitations = invitations as InvitationWithCreator[];

  const totalInvited = typedInvitations.reduce(
    (sum, i) => sum + Number(i.quoted_rate),
    0
  );
  const lockedAmount = typedInvitations
    .filter((i) => i.status === "accepted" && i.wallet_locked)
    .reduce((sum, i) => sum + Number(i.quoted_rate), 0);
  const spentAmount =
    typedInvitations
      .filter((i) => i.status === "completed")
      .reduce((sum, i) => sum + Number(i.quoted_rate), 0) ||
    Number(activation.spent_amount ?? 0);

  const statusConfig: Record<string, string> = {
    draft: "Draft",
    live: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const statusLabel = statusConfig[activation.status] ?? activation.status;

  const invStatusLabel: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate("/activations")}
          className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <span className="text-xs text-slate-500">Creator Request</span>
          </div>
          <h1 className="text-xl font-semibold text-white truncate">
            {activation.title}
          </h1>
          <p className="text-sm text-slate-400">
            {typedInvitations.length} invitation
            {typedInvitations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${
            activation.status === "live"
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : activation.status === "completed"
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-slate-500/20 text-slate-400 border-slate-500/30"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Deadline</p>
            <p className="font-medium text-white flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(activation.deadline), "MMM d")}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total invited</p>
            <p className="font-medium text-white mt-1">
              {formatAmount(totalInvited)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Locked</p>
            <p className="font-medium text-white mt-1">
              {formatAmount(lockedAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Spent</p>
            <p className="font-medium text-white mt-1">
              {formatAmount(spentAmount)} /{" "}
              {formatAmount(activation.total_budget)}
            </p>
          </CardContent>
        </Card>
      </div>

      {activation.brief && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-2">Brief</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {activation.brief}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            Invitations
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : typedInvitations.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No invitations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-white/[0.08]">
                    <th className="pb-2 pr-4">Creator</th>
                    <th className="pb-2 pr-4">Rate</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Invited</th>
                    <th className="pb-2 pr-4">Responded</th>
                    <th className="pb-2 pr-4 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typedInvitations.map((inv) => {
                    const creatorName =
                      inv.creators?.name ||
                      inv.creators?.handle ||
                      inv.creator_id.slice(0, 8);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-white/[0.06] last:border-0"
                      >
                        <td className="py-3 pr-4 text-white">{creatorName}</td>
                        <td className="py-3 pr-4 text-slate-300">
                          {formatAmount(Number(inv.quoted_rate))}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              inv.status === "accepted"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : inv.status === "pending"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : inv.status === "declined"
                                    ? "bg-slate-500/20 text-slate-400"
                                    : inv.status === "completed"
                                      ? "bg-blue-500/20 text-blue-400"
                                      : "bg-slate-500/20 text-slate-400"
                            }`}
                          >
                            {invStatusLabel[inv.status] ?? inv.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {inv.invited_at
                            ? format(new Date(inv.invited_at), "MMM d")
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {inv.responded_at
                            ? format(new Date(inv.responded_at), "MMM d")
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {inv.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/[0.08] text-xs"
                              disabled={cancelInvitation.isPending}
                              onClick={() => cancelInvitation.mutate(inv.id)}
                            >
                              {cancelInvitation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </Button>
                          )}
                          {inv.status === "accepted" && inv.wallet_locked && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/[0.08] text-xs"
                              disabled={releasePayment.isPending}
                              onClick={() => releasePayment.mutate(inv.id)}
                            >
                              {releasePayment.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Release payment"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
