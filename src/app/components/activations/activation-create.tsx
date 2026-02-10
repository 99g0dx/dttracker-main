import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ArrowLeft,
  Trophy,
  ThumbsUp,
  Loader2,
  Calendar as CalendarIcon,
  AlertTriangle,
} from "lucide-react";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useCanWrite } from "../../../hooks/useBilling";
import {
  useCreateActivation,
  usePublishActivation,
  useActivation,
  useUpdateActivation,
} from "../../../hooks/useActivations";
import { useWalletBalance } from "../../../hooks/useWallet";
import type {
  ActivationInsert,
  ActivationType,
} from "../../lib/types/database";
import {
  buildPrizeStructure,
  CONTEST_MIN_PRIZE_POOL,
  CONTEST_WINNER_COUNT,
} from "../../../lib/utils/contest-prizes";
import { format, parseISO, endOfDay, startOfDay } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { PlatformIcon } from "../ui/PlatformIcon";
import { formatNumber } from "../../../lib/utils/format";
import type { TaskType } from "../../../lib/sm-panel/constants";
import { PricingTable } from "./sm-panel/PricingTable";
import { ParticipationEstimate } from "./sm-panel/ParticipationEstimate";
import { ServiceFeeDisplay } from "../ui/service-fee-display";
import { useCommunityFans } from "../../../hooks/useCommunityFans";

interface ActivationCreateProps {
  onNavigate: (path: string) => void;
}

type Step = "type" | "form" | "confirm";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
];

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const INITIAL_FORM_STATE = {
  title: "",
  brief: "",
  deadline: "",
  total_budget: 0,
  task_type: "like" as TaskType,
  target_url: "",
  base_rate: 200,
  max_participants: 500,
  auto_approve: true,
  platforms: [] as string[],
  requirements: [] as string[],
  instructions: "",
  required_comment_text: "",
  comment_guidelines: "",
  visibility: "public" as "public" | "community",
  community_fan_ids: [] as string[],
};

export function ActivationCreate({ onNavigate }: ActivationCreateProps) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { canWrite, isLoading } = useCanWrite();
  const createActivation = useCreateActivation();
  const publishActivation = usePublishActivation();
  const updateActivation = useUpdateActivation();
  const { data: wallet } = useWalletBalance(activeWorkspaceId);
  const { data: communityFans = [], error: communityFansError } = useCommunityFans();
  const { data: existingActivation, isLoading: isLoadingActivation } = useActivation(id ?? null);
  
  const isEditMode = !!id;

  // Log errors but don't crash - tables might not exist yet
  if (communityFansError && import.meta.env.DEV) {
    console.warn('Community fans query error (table may not exist yet):', communityFansError);
  }

  const [step, setStep] = useState<Step>("type");
  const [activationType, setActivationType] = useState<ActivationType | null>(
    null
  );
  const [createdId, setCreatedId] = useState<string | null>(id || null);

  const [form, setForm] = useState(INITIAL_FORM_STATE);

  // Load existing activation data when in edit mode
  useEffect(() => {
    if (isEditMode && existingActivation) {
      if (existingActivation.status !== 'draft') {
        toast.error('Only draft activations can be edited');
        onNavigate('/activations');
        return;
      }
      
      setActivationType(existingActivation.type);
      setStep('form');
      
      // Parse deadline date
      const deadlineDate = existingActivation.deadline ? format(parseISO(existingActivation.deadline), 'yyyy-MM-dd') : '';
      
      setForm({
        title: existingActivation.title || '',
        brief: existingActivation.brief || '',
        deadline: deadlineDate,
        total_budget: Number(existingActivation.total_budget) || 0,
        task_type: (existingActivation.task_type as TaskType) || 'like',
        target_url: existingActivation.target_url || '',
        base_rate: Number(existingActivation.base_rate) || 200,
        max_participants: existingActivation.max_participants || 500,
        auto_approve: existingActivation.auto_approve ?? true,
        platforms: existingActivation.platforms || [],
        requirements: existingActivation.requirements || [],
        instructions: existingActivation.instructions || '',
        required_comment_text: existingActivation.required_comment_text || '',
        comment_guidelines: existingActivation.comment_guidelines || '',
        visibility: existingActivation.visibility || 'public',
        community_fan_ids: Array.isArray(existingActivation.community_fan_ids) ? existingActivation.community_fan_ids : [],
      });
    }
  }, [isEditMode, existingActivation, onNavigate]);

  // Reset form when activation type changes (only in create mode)
  useEffect(() => {
    if (activationType && !isEditMode) {
      setForm(INITIAL_FORM_STATE);
    }
  }, [activationType, isEditMode]);

  const availableBalance = wallet?.balance ?? 0;
  const serviceFeeRate = 0.10;
  const serviceFee = Math.round(form.total_budget * serviceFeeRate * 100) / 100;
  const totalCost = form.total_budget + serviceFee;
  // Allow zero budget for testing (test_mode activations)
  const canPublish =
    (availableBalance >= totalCost && form.total_budget > 0) || form.total_budget === 0;

  const handleCreate = async (asDraft: boolean) => {
    if (!activeWorkspaceId) return;

    // Allow zero budget for testing, but enforce minimum for non-zero budgets
    if (
      activationType === "contest" &&
      form.total_budget > 0 &&
      form.total_budget < CONTEST_MIN_PRIZE_POOL
    ) {
      toast.error(
        `Minimum prize pool is ₦${CONTEST_MIN_PRIZE_POOL.toLocaleString()} (or 0 for testing)`
      );
      return;
    }

    if (
      activationType === "sm_panel" &&
      (form.base_rate <= 0 || form.total_budget < form.base_rate)
    ) {
      toast.error("Total budget must be at least the base rate");
      return;
    }

    // If editing, use update instead of create
    if (isEditMode && id) {
      const updates = {
        title: form.title,
        brief: form.brief || null,
        deadline: form.deadline
          ? endOfDay(parseISO(form.deadline)).toISOString()
          : new Date().toISOString(),
        total_budget: form.total_budget,
        prize_structure:
          activationType === "contest"
            ? buildPrizeStructure(form.total_budget)
            : null,
        winner_count: activationType === "contest" ? CONTEST_WINNER_COUNT : null,
        max_posts_per_creator: activationType === "contest" ? 5 : null,
        judging_criteria: activationType === "contest" ? "performance" : null,
        task_type: activationType === "sm_panel" ? form.task_type : null,
        target_url:
          activationType === "sm_panel" ? form.target_url || null : null,
        ...(activationType === "sm_panel" && { base_rate: form.base_rate }),
        ...(activationType === "sm_panel" &&
          form.task_type === "comment" && {
            required_comment_text: form.required_comment_text || null,
            comment_guidelines: form.comment_guidelines || null,
          }),
        max_participants:
          activationType === "sm_panel" ? form.max_participants : null,
        auto_approve: activationType === "sm_panel" ? form.auto_approve : false,
        platforms: form.platforms.length ? form.platforms : null,
        requirements: form.requirements.length ? form.requirements : null,
        instructions: form.instructions || null,
        ...(form.visibility !== "public" && { visibility: form.visibility }),
        ...(form.visibility === "community" && form.community_fan_ids.length > 0 && {
          community_fan_ids: form.community_fan_ids,
        }),
      };

      try {
        const data = await updateActivation.mutateAsync({ id, updates });
        if (data) {
          onNavigate(`/activations/${id}`);
        }
      } catch {
        // Toast handled by mutation
      }
      return;
    }

    // Create new activation
    const insert: ActivationInsert = {
      workspace_id: activeWorkspaceId,
      type: activationType!,
      title: form.title,
      brief: form.brief || null,
      deadline: form.deadline
        ? endOfDay(parseISO(form.deadline)).toISOString()
        : new Date().toISOString(),
      total_budget: form.total_budget,
      prize_structure:
        activationType === "contest"
          ? buildPrizeStructure(form.total_budget)
          : null,
      winner_count: activationType === "contest" ? CONTEST_WINNER_COUNT : null,
      max_posts_per_creator: activationType === "contest" ? 5 : null,
      judging_criteria: activationType === "contest" ? "performance" : null,
      task_type: activationType === "sm_panel" ? form.task_type : null,
      target_url:
        activationType === "sm_panel" ? form.target_url || null : null,
      ...(activationType === "sm_panel" && { base_rate: form.base_rate }),
      ...(activationType === "sm_panel" &&
        form.task_type === "comment" && {
          required_comment_text: form.required_comment_text || null,
          comment_guidelines: form.comment_guidelines || null,
        }),
      max_participants:
        activationType === "sm_panel" ? form.max_participants : null,
      auto_approve: activationType === "sm_panel" ? form.auto_approve : false,
      test_mode: form.total_budget === 0, // Mark zero-budget activations as test mode
      platforms: form.platforms.length ? form.platforms : null,
      requirements: form.requirements.length ? form.requirements : null,
      instructions: form.instructions || null,
      // Only include visibility fields if they differ from defaults (for backward compatibility)
      ...(form.visibility !== "public" && { visibility: form.visibility }),
      ...(form.visibility === "community" && form.community_fan_ids.length > 0 && {
        community_fan_ids: form.community_fan_ids,
      }),
    };

    try {
      const data = await createActivation.mutateAsync(insert);
      if (data) {
        setCreatedId(data.id);
        if (asDraft) {
          onNavigate(`/activations/${data.id}`);
        } else {
          setStep("confirm");
        }
      }
    } catch {
      // Toast handled by mutation
    }
  };

  const handlePublish = async () => {
    if (!createdId) return;
    try {
      await publishActivation.mutateAsync(createdId);
      onNavigate(`/activations/${createdId}`);
    } catch {
      // Toast handled
    }
  };

  const handleBackToTypeSelection = () => {
    if (isEditMode) {
      onNavigate(`/activations/${id}`);
    } else {
      setStep("type");
      setActivationType(null);
      setForm(INITIAL_FORM_STATE);
      setCreatedId(null);
    }
  };

  // Show loading state when editing and activation is loading
  if (isEditMode && isLoadingActivation) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Read-only: redirect to subscribe when subscription inactive
  if (!isLoading && !canWrite) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/activations')}
            className="w-11 h-11 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to activations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Subscribe to create activations
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground mb-4">
              Your trial or subscription has ended. Subscribe to continue creating activations.
            </p>
            <Button onClick={() => navigate('/subscription')}>
              Subscribe to continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect if activation not found or not draft
  if (isEditMode && existingActivation && existingActivation.status !== 'draft') {
    return null; // useEffect will handle navigation
  }

  if (step === "type") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              handleBackToTypeSelection();
              onNavigate("/activations");
            }}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-foreground flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditMode ? 'Edit Activation' : 'Create Activation'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? 'Update activation details' : 'Choose the type of activation'}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="bg-card border-border hover:border-primary/50 cursor-pointer transition-colors"
            onClick={() => {
              setActivationType("contest");
              setStep("form");
            }}
          >
            <CardContent className="p-6">
              <Trophy className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Contest</h3>
              <p className="text-sm text-muted-foreground">
                Performance-based prizes for top performing creators. Set a
                prize pool and number of winners.
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Select
              </Button>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border hover:border-primary/50 cursor-pointer transition-colors"
            onClick={() => {
              setActivationType("sm_panel");
              setStep("form");
            }}
          >
            <CardContent className="p-6">
              <ThumbsUp className="w-12 h-12 text-red-600 dark:text-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                SM Panel
              </h3>
              <p className="text-sm text-muted-foreground">
                Micro-task campaigns for likes, shares, comments. Pay per action
                with a total budget.
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Select
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "form") {
    const isContest = activationType === "contest";

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToTypeSelection}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-foreground flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Create {isContest ? "Contest" : "SM Panel"}
            </h1>
            <p className="text-sm text-muted-foreground">Fill in the details</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available balance</p>
              <p className="text-lg font-semibold text-foreground">
                {formatAmount(availableBalance)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("/wallet")}
              className="border-border"
            >
              Fund Wallet
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Lipstick Video Challenge"
                className="bg-input-background border-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Brief / Description *
              </label>
              <textarea
                value={form.brief}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brief: e.target.value }))
                }
                placeholder="Describe the activation..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-input-background border border-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.platforms.includes(p.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          platforms: e.target.checked
                            ? [...f.platforms, p.id]
                            : f.platforms.filter((x) => x !== p.id),
                        }));
                      }}
                      className="rounded"
                    />
                    <PlatformIcon
                      platform={p.id as "tiktok" | "instagram" | "youtube" | "x"}
                      size="sm"
                    />
                    <span className="text-sm text-muted-foreground">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Deadline *
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-11 w-full rounded-md bg-input-background hover:bg-muted/60 border border-input text-sm text-foreground flex items-center justify-between px-3 transition-colors text-left"
                  >
                    <span
                      className={
                        form.deadline ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {form.deadline
                        ? format(parseISO(form.deadline), "MMM d, yyyy")
                        : "Select date"}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.deadline ? parseISO(form.deadline) : undefined
                    }
                    onSelect={(date) =>
                      setForm((f) => ({
                        ...f,
                        deadline: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    disabled={{ before: startOfDay(new Date()) }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isContest ? (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Total Prize Pool (NGN) *
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={
                      form.total_budget ? formatNumber(form.total_budget) : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const num = parseFloat(raw) || 0;
                      setForm((f) => ({ ...f, total_budget: num }));
                    }}
                    placeholder="500,000"
                    className="bg-input-background border-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum: ₦{formatNumber(CONTEST_MIN_PRIZE_POOL)} (or 0 for test mode)
                  </p>
                  {form.total_budget > 0 && totalCost > availableBalance && (
                    <div className="flex items-center gap-2 mt-2 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Insufficient balance. Need{" "}
                        {formatAmount(totalCost - availableBalance)}{" "}
                        more (including service fee).
                      </span>
                    </div>
                  )}
                  {form.total_budget === 0 && (
                    <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-blue-400 text-sm">
                      <span>
                        🧪 Test mode: Zero budget activation (no funds required)
                      </span>
                    </div>
                  )}
                  {form.total_budget > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border">
                      <ServiceFeeDisplay
                        baseAmount={form.total_budget}
                        serviceFeeRate={serviceFeeRate}
                        showBreakdown={true}
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Number of Winners: {CONTEST_WINNER_COUNT} (fixed)
                </p>
                <div className="rounded-lg bg-muted/40 border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Prize Distribution (automatic)
                  </p>
                  {form.total_budget >= CONTEST_MIN_PRIZE_POOL && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        1st place: 25% = ₦
                        {formatNumber(form.total_budget * 0.25)}
                      </p>
                      <p>
                        2nd place: 15% = ₦
                        {formatNumber(form.total_budget * 0.15)}
                      </p>
                      <p>
                        3rd place: 10% = ₦
                        {formatNumber(form.total_budget * 0.1)}
                      </p>
                      <p>
                        4th–20th: 50% total (₦
                        {formatNumber((form.total_budget * 0.5) / 17)} each)
                      </p>
                      <p className="pt-1 text-muted-foreground">Total: 100%</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Prize breakdown updates automatically based on pool
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Multiple Entries
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Max 5 posts per creator • Cumulative scoring • Views 1x,
                    Likes 2x, Comments 3x
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Creators can submit multiple posts. Their ranking will be
                    based on combined performance.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Task Type
                  </label>
                  <select
                    value={form.task_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        task_type: e.target.value as TaskType,
                      }))
                    }
                    className="h-9 px-3 rounded-lg bg-input-background border border-input text-foreground w-full"
                  >
                    <option value="like">Like</option>
                    <option value="comment">Comment</option>
                    <option value="repost">Repost</option>
                    <option value="story">Story</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Target URL *
                  </label>
                  <Input
                    value={form.target_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_url: e.target.value }))
                    }
                    placeholder="https://instagram.com/p/abc123"
                    className="bg-input-background border-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Total Budget (NGN) *
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={
                      form.total_budget ? formatNumber(form.total_budget) : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const num = parseFloat(raw) || 0;
                      setForm((f) => ({ ...f, total_budget: num }));
                    }}
                    placeholder="100,000"
                    className="bg-input-background border-input"
                  />
                  {totalCost > availableBalance && (
                    <div className="flex items-center gap-2 mt-2 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Insufficient balance. Need{" "}
                        {formatAmount(totalCost - availableBalance)}{" "}
                        more (including service fee).
                      </span>
                    </div>
                  )}
                  {form.total_budget > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border">
                      <ServiceFeeDisplay
                        baseAmount={form.total_budget}
                        serviceFeeRate={serviceFeeRate}
                        showBreakdown={true}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Base Rate (Nano tier) (NGN) *
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={form.base_rate ? formatNumber(form.base_rate) : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const num = parseFloat(raw) || 0;
                      setForm((f) => ({ ...f, base_rate: num }));
                    }}
                    placeholder="200"
                    className="bg-input-background border-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nano tier base. Larger creators earn more (tiered
                    multipliers).
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Pricing Structure (task: {form.task_type})
                  </h3>
                  <PricingTable
                    baseRate={form.base_rate}
                    taskType={form.task_type}
                  />
                </div>
                <ParticipationEstimate
                  totalBudget={form.total_budget}
                  baseRate={form.base_rate}
                  taskType={form.task_type}
                />
                {form.task_type === "comment" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Required Comment (optional)
                      </label>
                      <textarea
                        value={form.required_comment_text}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            required_comment_text: e.target.value,
                          }))
                        }
                        placeholder="Leave blank to let creators write their own..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-input-background border border-input text-foreground placeholder:text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If specified, all creators must comment this exact text
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Comment Guidelines (optional)
                      </label>
                      <textarea
                        value={form.comment_guidelines}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            comment_guidelines: e.target.value,
                          }))
                        }
                        placeholder="E.g., Comment must be positive and mention the product name..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-input-background border border-input text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.auto_approve}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                        auto_approve: e.target.checked,
                      }))
                    }
                      className="rounded"
                    />
                    <span className="text-sm text-muted-foreground">
                      Auto-approve submissions
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* Visibility Selector */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Visibility
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, visibility: "public", community_fan_ids: [] }))}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                    form.visibility === "public"
                      ? "bg-muted/60 border-border text-foreground"
                      : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border"
                  }`}
                >
                  <div className="text-sm font-medium mb-1">Public</div>
                  <div className="text-xs text-muted-foreground">Visible to all creators</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, visibility: "community" }))}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                    form.visibility === "community"
                      ? "bg-muted/60 border-border text-foreground"
                      : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border"
                  }`}
                >
                  <div className="text-sm font-medium mb-1">Community</div>
                  <div className="text-xs text-muted-foreground">Only imported fans</div>
                </button>
              </div>
              {form.visibility === "community" && communityFans.length > 0 && (
                <div className="mt-3">
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Select Fans (optional - leave empty for all imported fans)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-2">
                    {communityFans.map((fan) => (
                      <label
                        key={fan.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.community_fan_ids.includes(fan.id)}
                          onChange={(e) => {
                            setForm((f) => {
                              const ids = new Set(f.community_fan_ids);
                              if (e.target.checked) {
                                ids.add(fan.id);
                              } else {
                                ids.delete(fan.id);
                              }
                              return { ...f, community_fan_ids: Array.from(ids) };
                            });
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground">
                            {fan.name || fan.handle}
                          </div>
                          <div className="text-xs text-muted-foreground">@{fan.handle} • {fan.platform}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {form.community_fan_ids.length === 0
                      ? "All imported fans will see this activation"
                      : `${form.community_fan_ids.length} fan${form.community_fan_ids.length !== 1 ? "s" : ""} selected`}
                  </p>
                </div>
              )}
              {form.visibility === "community" && communityFans.length === 0 && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-400">
                    No fans imported yet. Import fans from the Creator Library to create community-only activations.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleBackToTypeSelection}
                className="border-border"
              >
                Back
              </Button>
              {!isEditMode && (
                <Button
                  onClick={() => handleCreate(true)}
                  disabled={
                    !form.title ||
                    !form.deadline ||
                    form.total_budget < 0 ||
                    (isContest && form.total_budget > 0 && form.total_budget < CONTEST_MIN_PRIZE_POOL) ||
                    (!isContest &&
                      (form.base_rate <= 0 ||
                        (form.total_budget > 0 && form.total_budget < form.base_rate))) ||
                    (form.total_budget > 0 && totalCost > availableBalance) ||
                    createActivation.isPending
                  }
                  variant="outline"
                >
                  {createActivation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Draft
                </Button>
              )}
              <Button
                onClick={() => handleCreate(isEditMode)}
                disabled={
                  !form.title ||
                  !form.deadline ||
                  form.total_budget < 0 ||
                  (isContest && form.total_budget > 0 && form.total_budget < CONTEST_MIN_PRIZE_POOL) ||
                  (!isContest &&
                    (form.base_rate <= 0 ||
                      (form.total_budget > 0 && form.total_budget < form.base_rate))) ||
                  (form.total_budget > 0 && totalCost > availableBalance) ||
                  createActivation.isPending
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createActivation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save & Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "confirm" && createdId) {
    return (
      <div className="space-y-6 max-w-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setStep("form");
              // Don't reset form here as user might want to review before publishing
            }}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-foreground flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Review & Publish
            </h1>
            <p className="text-sm text-muted-foreground">
              Confirm to publish activation
            </p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium text-foreground">{form.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium text-foreground capitalize">
                {activationType === "sm_panel" ? "SM Panel" : activationType}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <div className="mt-2">
                <ServiceFeeDisplay
                  baseAmount={form.total_budget}
                  serviceFeeRate={serviceFeeRate}
                  showBreakdown={true}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visibility</p>
              <p className="font-medium text-foreground capitalize">
                {form.visibility === "community" ? "Community Only" : "Public"}
              </p>
              {form.visibility === "community" && (
                <p className="text-xs text-muted-foreground mt-1">
                  {form.community_fan_ids.length === 0
                    ? "All imported fans"
                    : `${form.community_fan_ids.length} selected fan${form.community_fan_ids.length !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
            {form.deadline && (
              <div>
                <p className="text-sm text-muted-foreground">Deadline</p>
                <p className="font-medium text-foreground">
                  {format(new Date(form.deadline), "PPpp")}
                </p>
              </div>
            )}

            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Wallet balance: {formatAmount(availableBalance)}
              </p>
              {!canPublish && (
                <p className="text-sm text-amber-400 mb-2">
                  Insufficient balance. Fund your wallet to publish.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onNavigate(`/activations/${createdId}`)}
                className="border-border"
              >
                Save as Draft
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!canPublish || publishActivation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {publishActivation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Confirm & Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
