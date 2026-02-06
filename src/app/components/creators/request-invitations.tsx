import React from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, Mail, Loader2, Calendar, Check, X } from "lucide-react";
import { useMyInvitations } from "../../../hooks/useCreatorRequestInvitations";
import {
  useAcceptInvitation,
  useDeclineInvitation,
} from "../../../hooks/useCreatorRequestInvitations";
import { format } from "date-fns";
import type { CreatorRequestInvitationWithActivation } from "../../../lib/api/creator-request-invitations";

interface RequestInvitationsProps {
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

export function RequestInvitations({ onNavigate }: RequestInvitationsProps) {
  const { data: invitations = [], isLoading, error } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  const pendingInvitations = invitations.filter(
    (inv: CreatorRequestInvitationWithActivation) => inv.status === "pending"
  );
  const otherInvitations = invitations.filter(
    (inv: CreatorRequestInvitationWithActivation) => inv.status !== "pending"
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate("/creators")}
          className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">
            Creator invitations
          </h1>
          <p className="text-sm text-slate-400">
            Invitations from brands to collaborate at a quoted rate
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading invitations...</span>
        </div>
      ) : error ? (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-sm text-red-400">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-white/[0.08]"
              onClick={() => onNavigate("/creators")}
            >
              Back to Creators
            </Button>
          </CardContent>
        </Card>
      ) : invitations.length === 0 ? (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-1">No invitations yet</p>
            <p className="text-sm text-slate-500">
              When brands invite you to a creator request, they’ll show up here.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-white/[0.08]"
              onClick={() => onNavigate("/creators")}
            >
              Back to Creators
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingInvitations.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-slate-400">
                Pending ({pendingInvitations.length})
              </h2>
              {pendingInvitations.map(
                (inv: CreatorRequestInvitationWithActivation) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onAccept={() => acceptInvitation.mutate(inv.id)}
                    onDecline={() => declineInvitation.mutate(inv.id)}
                    isAccepting={acceptInvitation.isPending}
                    isDeclining={declineInvitation.isPending}
                    onNavigate={onNavigate}
                  />
                )
              )}
            </>
          )}

          {otherInvitations.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-slate-400 mt-6">
                Past invitations
              </h2>
              {otherInvitations.map(
                (inv: CreatorRequestInvitationWithActivation) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onNavigate={onNavigate}
                    readOnly
                  />
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface InvitationCardProps {
  invitation: CreatorRequestInvitationWithActivation;
  onAccept?: () => void;
  onDecline?: () => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
  onNavigate: (path: string) => void;
  readOnly?: boolean;
}

function InvitationCard({
  invitation,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
  onNavigate,
  readOnly,
}: InvitationCardProps) {
  const activation = invitation.activations;
  const title = activation?.title ?? "Activation";
  const brief = activation?.brief ?? null;
  const deadline = activation?.deadline ?? null;
  const activationId = activation?.id ?? invitation.activation_id;
  const status = invitation.status;

  return (
    <Card className="bg-[#0D0D0D] border-white/[0.08]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium text-white">{title}</h3>
            {deadline && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />
                Deadline: {format(new Date(deadline), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-semibold text-white">
              {formatAmount(Number(invitation.quoted_rate))}
            </p>
            <p className="text-xs text-slate-500 capitalize">{status}</p>
          </div>
        </div>

        {brief && (
          <p className="text-sm text-slate-400 line-clamp-3">{brief}</p>
        )}

        {invitation.deliverable_description && (
          <p className="text-xs text-slate-500">
            <span className="text-slate-400">Deliverable:</span>{" "}
            {invitation.deliverable_description}
          </p>
        )}

        {!readOnly && status === "pending" && onAccept && onDecline && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="bg-primary text-black hover:bg-primary/90"
              onClick={onAccept}
              disabled={isAccepting || isDeclining}
            >
              {isAccepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/[0.08]"
              onClick={onDecline}
              disabled={isAccepting || isDeclining}
            >
              {isDeclining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Decline
                </>
              )}
            </Button>
          </div>
        )}

        {status === "accepted" && activationId && (
          <p className="text-xs text-slate-400 pt-2">
            Submit your deliverable from the{" "}
            <button
              type="button"
              onClick={() => onNavigate(`/activations/${activationId}`)}
              className="text-primary hover:underline"
            >
              activation page
            </button>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
