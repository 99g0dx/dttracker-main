import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Calendar as CalendarIcon,
  Wallet,
  Search,
  ChevronDown,
} from "lucide-react";
import { format, parseISO, endOfDay, startOfDay } from "date-fns";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { useMyNetworkCreators } from "../../../hooks/useCreators";
import { useWalletBalance } from "../../../hooks/useWallet";
import { useCreateActivation } from "../../../hooks/useActivations";
import { useCreateInvitations } from "../../../hooks/useCreatorRequestInvitations";
import * as activationsApi from "../../../lib/api/activations";
import type { ActivationInsert } from "../../../lib/types/database";
import type { CreatorWithSocialAndStats } from "../../../lib/types/database";
import { formatNumber } from "../../../lib/utils/format";
import { toast } from "sonner";

export interface CreatorRequestFormSummary {
  totalAmount: number;
  invitationCount: number;
  title?: string;
  deadline?: string;
}

interface CreatorRequestFormProps {
  workspaceId: string | null;
  onSuccess: (
    activationId: string,
    summary?: CreatorRequestFormSummary
  ) => void;
  onNavigate: (path: string) => void;
  onBack?: () => void;
  activationId?: string;
  /** When provided (e.g. from Creators page "Request" on a creator), pre-fill invitations with these creator ids and default rate. */
  initialCreatorIds?: string[];
}

interface InvitationRow {
  creator_id: string;
  quoted_rate: number;
  brand_notes?: string;
  deliverable_description?: string;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Form for creating a creator_request activation: title, brief, deadline,
 * creator selection with quoted rates, total budget, balance check.
 * Submit: create activation (type creator_request) then create invitations.
 */
export function CreatorRequestForm({
  workspaceId,
  onSuccess,
  onNavigate,
  onBack,
  initialCreatorIds,
}: CreatorRequestFormProps) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [addCreatorId, setAddCreatorId] = useState("");
  const [creatorSearchOpen, setCreatorSearchOpen] = useState(false);
  const creatorListRef = useRef<HTMLDivElement>(null);
  const [deliverableDescription, setDeliverableDescription] = useState("");
  const [initialCreatorIdsApplied, setInitialCreatorIdsApplied] =
    useState(false);

  const { data: networkCreators = [], isLoading: loadingCreators } =
    useMyNetworkCreators(workspaceId);
  const { data: wallet } = useWalletBalance(workspaceId);
  const createActivation = useCreateActivation();
  const createInvitationsMutation = useCreateInvitations();

  const availableBalance = wallet?.balance ?? 0;

  // Only creators with real id (not manual-*) can be invited; creator_request_invitations.creator_id references creators(id)
  const inviteableCreators = useMemo(
    () =>
      networkCreators.filter(
        (c: CreatorWithSocialAndStats) =>
          typeof c.id === "string" && !c.id.startsWith("manual-")
      ) as CreatorWithSocialAndStats[],
    [networkCreators]
  );

  // Pre-fill invitations when initialCreatorIds is provided and network creators are loaded
  useEffect(() => {
    if (
      !initialCreatorIds?.length ||
      inviteableCreators.length === 0 ||
      initialCreatorIdsApplied
    )
      return;
    const toAdd: InvitationRow[] = [];
    for (const id of initialCreatorIds) {
      const creator = inviteableCreators.find((c) => c.id === id);
      if (!creator) continue;
      const defaultRate =
        (creator as CreatorWithSocialAndStats & { manual_base_rate?: number })
          .manual_base_rate ?? 200;
      toAdd.push({
        creator_id: creator.id,
        quoted_rate: defaultRate,
        brand_notes: "",
        deliverable_description: undefined,
      });
    }
    if (toAdd.length > 0) {
      setInvitations((prev) => {
        const existingIds = new Set(prev.map((i) => i.creator_id));
        const newRows = toAdd.filter((r) => !existingIds.has(r.creator_id));
        return newRows.length ? [...prev, ...newRows] : prev;
      });
      setInitialCreatorIdsApplied(true);
    }
  }, [initialCreatorIds, inviteableCreators, initialCreatorIdsApplied]);

  const alreadyAddedIds = useMemo(
    () => new Set(invitations.map((i) => i.creator_id)),
    [invitations]
  );

  const totalBudget = useMemo(
    () => invitations.reduce((sum, i) => sum + i.quoted_rate, 0),
    [invitations]
  );

  const insufficientBalance = totalBudget > availableBalance;
  const canSubmit =
    !!workspaceId &&
    !!title.trim() &&
    !!deadline &&
    invitations.length > 0 &&
    invitations.every((i) => i.quoted_rate > 0) &&
    !insufficientBalance;

  const addCreator = (creatorId?: string) => {
    const id = creatorId ?? addCreatorId;
    if (!id) return;
    const creator = inviteableCreators.find((c) => c.id === id);
    if (!creator || alreadyAddedIds.has(creator.id)) return;
    const defaultRate =
      (creator as CreatorWithSocialAndStats & { manual_base_rate?: number })
        .manual_base_rate ?? 200;
    setInvitations((prev) => [
      ...prev,
      {
        creator_id: creator.id,
        quoted_rate: defaultRate,
        brand_notes: "",
        deliverable_description: deliverableDescription || undefined,
      },
    ]);
    setAddCreatorId("");
    setCreatorSearchOpen(false);
  };

  const removeCreator = (creatorId: string) => {
    setInvitations((prev) => prev.filter((i) => i.creator_id !== creatorId));
  };

  const updateRate = (creatorId: string, quoted_rate: number) => {
    setInvitations((prev) =>
      prev.map((i) => (i.creator_id === creatorId ? { ...i, quoted_rate } : i))
    );
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!workspaceId || (!canSubmit && !asDraft)) return;

    try {
      const insert: ActivationInsert = {
        workspace_id: workspaceId,
        type: "creator_request",
        title: title.trim(),
        brief: brief.trim() || null,
        deadline: deadline
          ? endOfDay(parseISO(deadline)).toISOString()
          : new Date().toISOString(),
        total_budget: totalBudget,
      };

      const createResult = await activationsApi.createActivation(insert);
      if (createResult.error || !createResult.data) {
        toast.error(
          createResult.error?.message ?? "Failed to create activation"
        );
        return;
      }

      const activationId = createResult.data.id;

      const invInputs = invitations.map((i) => ({
        creator_id: i.creator_id,
        quoted_rate: i.quoted_rate,
        currency: "NGN",
        brand_notes: i.brand_notes || null,
        deliverable_description:
          i.deliverable_description ?? (deliverableDescription || null),
      }));

      try {
        await createInvitationsMutation.mutateAsync({
          activationId,
          invitations: invInputs,
        });
      } catch (invErr) {
        toast.error(
          "Activation created but invitations failed. You can add them from the activation."
        );
        onNavigate(`/activations/${activationId}`);
        return;
      }

      const summary: CreatorRequestFormSummary = {
        totalAmount: totalBudget,
        invitationCount: invitations.length,
        title: title.trim(),
        deadline: deadline
          ? format(parseISO(deadline), "yyyy-MM-dd")
          : undefined,
      };
      onSuccess(activationId, summary);
      if (asDraft) {
        onNavigate(`/activations/${activationId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      {!onBack && (
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onNavigate("/activations")}
            className="w-11 h-11 min-h-[44px] flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Back to activations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-white">
              Create Creator Request
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Select creators and set quoted rates
            </p>
          </div>
        </div>
      )}

      <Card
        className="bg-[#0D0D0D] border-white/[0.08] rounded-xl overflow-hidden"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Launch Collab"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Brief / Description
            </label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what you want from creators..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Deadline *
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-11 w-full rounded-lg bg-white/[0.02] hover:bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] text-sm text-slate-300 flex items-center justify-between px-3.5 py-2.5 transition-all outline-none focus:border-white/[0.15] focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.08] text-left"
                  style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                >
                  <span className={deadline ? "text-white" : "text-slate-500"}>
                    {deadline
                      ? format(parseISO(deadline), "MMM d, yyyy")
                      : "Select date"}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline ? parseISO(deadline) : undefined}
                  onSelect={(date) =>
                    setDeadline(date ? format(date, "yyyy-MM-dd") : "")
                  }
                  disabled={{ before: startOfDay(new Date()) }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Deliverable description (optional)
            </label>
            <Textarea
              value={deliverableDescription}
              onChange={(e) => setDeliverableDescription(e.target.value)}
              placeholder="What should creators deliver? e.g. 1 Reel, 1 Story"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Creators & rates
            </label>
            {loadingCreators ? (
              <p className="text-sm text-slate-500">Loading your network...</p>
            ) : inviteableCreators.length === 0 ? (
              <p className="text-sm text-slate-500">
                No linked creators in your network. Add creators from Discover
                first.
              </p>
            ) : (
              <>
                <div className="flex gap-2 sm:gap-3">
                  <Popover
                    open={creatorSearchOpen}
                    onOpenChange={setCreatorSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 h-11 px-3.5 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-white text-sm transition-all outline-none hover:border-white/[0.1] hover:bg-white/[0.03] focus:border-white/[0.15] focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.08] flex items-center justify-between gap-2 text-left"
                        style={{
                          boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span className="text-slate-500 truncate">
                            Search creators to add...
                          </span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 border-0 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                      align="start"
                      sideOffset={6}
                    >
                      <Command
                        className="flex flex-col"
                        filter={(value, search) => {
                          if (!search) return 1;
                          const s = search.toLowerCase();
                          const name = (
                            value.split("__")[0] ?? ""
                          ).toLowerCase();
                          const handle = (
                            value.split("__")[1] ?? ""
                          ).toLowerCase();
                          return name.includes(s) || handle.includes(s) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Search by name or handle..." />
                        <div
                          ref={creatorListRef}
                          className="min-h-0 max-h-[240px] overflow-y-auto overscroll-contain"
                          onWheel={(e) => {
                            const el = creatorListRef.current;
                            if (el && e.deltaY !== 0) {
                              el.scrollTop += e.deltaY;
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        >
                          <CommandList className="!max-h-none !overflow-visible">
                            <CommandEmpty>No creators found.</CommandEmpty>
                            <CommandGroup>
                              {inviteableCreators
                                .filter((c) => !alreadyAddedIds.has(c.id))
                                .map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={`${c.name || ""}__${c.handle || ""}`}
                                    onSelect={() => addCreator(c.id)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-medium text-slate-400 flex-shrink-0">
                                        {(c.name ||
                                          c.handle ||
                                          "?")[0].toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white truncate">
                                          {c.name || c.handle}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                          @{c.handle}
                                        </p>
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {invitations.length > 0 && (
                  <div
                    className="space-y-2 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 sm:p-4"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                  >
                    {invitations.map((inv) => {
                      const creator = inviteableCreators.find(
                        (c) => c.id === inv.creator_id
                      );
                      return (
                        <div
                          key={inv.creator_id}
                          className="flex items-center gap-2 sm:gap-3 text-sm"
                        >
                          <span className="flex-1 text-slate-300 truncate min-w-0">
                            {creator?.name ?? creator?.handle ?? inv.creator_id}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-slate-500 text-xs">NGN</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={
                                inv.quoted_rate
                                  ? formatNumber(inv.quoted_rate)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, "");
                                const num = parseFloat(raw) || 0;
                                updateRate(inv.creator_id, num);
                              }}
                              className="w-24 sm:w-28 h-9 text-right text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCreator(inv.creator_id)}
                            className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                            aria-label="Remove creator"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-3 border-t border-white/[0.06] text-white font-medium text-sm">
                      <span>Total Budget</span>
                      <span>{formatAmount(totalBudget)}</span>
                    </div>
                  </div>
                )}

                {insufficientBalance && invitations.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                    <Wallet className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Insufficient balance</p>
                      <p className="text-xs text-amber-300 mt-0.5">
                        Need {formatAmount(totalBudget - availableBalance)} more
                        to send this request.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4 border-t border-white/[0.06]">
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                className="h-11 min-h-[44px] border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 order-1"
              >
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={
                !workspaceId ||
                !title.trim() ||
                !deadline ||
                invitations.length === 0 ||
                createActivation.isPending ||
                createInvitationsMutation.isPending
              }
              className="h-11 min-h-[44px] border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 flex-1 sm:flex-initial order-3 sm:order-2"
            >
              {(createActivation.isPending ||
                createInvitationsMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={
                !canSubmit ||
                createActivation.isPending ||
                createInvitationsMutation.isPending
              }
              className="h-11 min-h-[44px] bg-white text-black hover:bg-white/90 flex-1 sm:flex-initial order-2 sm:order-3"
            >
              {(createActivation.isPending ||
                createInvitationsMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Save & Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
