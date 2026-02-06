import React, { useState } from "react";
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
import {
  useCreateActivation,
  usePublishActivation,
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

interface ActivationCreateProps {
  onNavigate: (path: string) => void;
}

type Step = "type" | "form" | "confirm";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
];

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ActivationCreate({ onNavigate }: ActivationCreateProps) {
  const { activeWorkspaceId } = useWorkspace();
  const createActivation = useCreateActivation();
  const publishActivation = usePublishActivation();
  const { data: wallet } = useWalletBalance(activeWorkspaceId);

  const [step, setStep] = useState<Step>("type");
  const [activationType, setActivationType] = useState<ActivationType | null>(
    null
  );
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [form, setForm] = useState({
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
  });

  const availableBalance = wallet?.balance ?? 0;
  const canPublish =
    availableBalance >= form.total_budget && form.total_budget > 0;

  const handleCreate = async (asDraft: boolean) => {
    if (!activeWorkspaceId) return;

    if (
      activationType === "contest" &&
      form.total_budget < CONTEST_MIN_PRIZE_POOL
    ) {
      toast.error(
        `Minimum prize pool is ₦${CONTEST_MIN_PRIZE_POOL.toLocaleString()}`
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
      platforms: form.platforms.length ? form.platforms : null,
      requirements: form.requirements.length ? form.requirements : null,
      instructions: form.instructions || null,
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

  if (step === "type") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/activations")}
            className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Create Activation
            </h1>
            <p className="text-sm text-slate-400">
              Choose the type of activation
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="bg-[#0D0D0D] border-white/[0.08] hover:border-primary/50 cursor-pointer transition-colors"
            onClick={() => {
              setActivationType("contest");
              setStep("form");
            }}
          >
            <CardContent className="p-6">
              <Trophy className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Contest</h3>
              <p className="text-sm text-slate-400">
                Performance-based prizes for top performing creators. Set a
                prize pool and number of winners.
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Select
              </Button>
            </CardContent>
          </Card>

          <Card
            className="bg-[#0D0D0D] border-white/[0.08] hover:border-primary/50 cursor-pointer transition-colors"
            onClick={() => {
              setActivationType("sm_panel");
              setStep("form");
            }}
          >
            <CardContent className="p-6">
              <ThumbsUp className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                SM Panel
              </h3>
              <p className="text-sm text-slate-400">
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
            onClick={() =>
              step === "form" ? setStep("type") : setStep("form")
            }
            className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Create {isContest ? "Contest" : "SM Panel"}
            </h1>
            <p className="text-sm text-slate-400">Fill in the details</p>
          </div>
        </div>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Available balance</p>
              <p className="text-lg font-semibold text-white">
                {formatAmount(availableBalance)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("/wallet")}
              className="border-white/[0.08]"
            >
              Fund Wallet
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Lipstick Video Challenge"
                className="bg-white/[0.04] border-white/[0.08]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">
                Brief / Description *
              </label>
              <textarea
                value={form.brief}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brief: e.target.value }))
                }
                placeholder="Describe the activation..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">
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
                      platform={p.id as "tiktok" | "instagram" | "youtube"}
                      size="sm"
                    />
                    <span className="text-sm text-slate-300">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">
                Deadline *
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-11 w-full rounded-md bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-between px-3 transition-colors text-left"
                  >
                    <span
                      className={
                        form.deadline ? "text-white" : "text-slate-500"
                      }
                    >
                      {form.deadline
                        ? format(parseISO(form.deadline), "MMM d, yyyy")
                        : "Select date"}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
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
                  <label className="text-sm font-medium text-slate-300 block mb-2">
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
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum: ₦{formatNumber(CONTEST_MIN_PRIZE_POOL)}
                  </p>
                  {form.total_budget > availableBalance && (
                    <div className="flex items-center gap-2 mt-2 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Insufficient balance. Need{" "}
                        {formatAmount(form.total_budget - availableBalance)}{" "}
                        more.
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  Number of Winners: {CONTEST_WINNER_COUNT} (fixed)
                </p>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
                  <p className="text-sm font-medium text-slate-300 mb-2">
                    Prize Distribution (automatic)
                  </p>
                  {form.total_budget >= CONTEST_MIN_PRIZE_POOL && (
                    <div className="text-sm text-slate-400 space-y-1">
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
                      <p className="pt-1 text-slate-500">Total: 100%</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Prize breakdown updates automatically based on pool
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
                  <p className="text-sm font-medium text-slate-300 mb-2">
                    Multiple Entries
                  </p>
                  <p className="text-sm text-slate-400">
                    Max 5 posts per creator • Cumulative scoring • Views 1x,
                    Likes 2x, Comments 3x
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Creators can submit multiple posts. Their ranking will be
                    based on combined performance.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
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
                    className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white w-full"
                  >
                    <option value="like">Like</option>
                    <option value="comment">Comment</option>
                    <option value="repost">Repost</option>
                    <option value="story">Story</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    Target URL *
                  </label>
                  <Input
                    value={form.target_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_url: e.target.value }))
                    }
                    placeholder="https://instagram.com/p/abc123"
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
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
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                  {form.total_budget > availableBalance && (
                    <div className="flex items-center gap-2 mt-2 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Insufficient balance. Need{" "}
                        {formatAmount(form.total_budget - availableBalance)}{" "}
                        more.
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
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
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Nano tier base. Larger creators earn more (tiered
                    multipliers).
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">
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
                      <label className="text-sm font-medium text-slate-300 block mb-2">
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
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        If specified, all creators must comment this exact text
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-300 block mb-2">
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
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-500"
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
                    <span className="text-sm text-slate-300">
                      Auto-approve submissions
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("type")}
                className="border-white/[0.08]"
              >
                Back
              </Button>
              <Button
                onClick={() => handleCreate(true)}
                disabled={
                  !form.title ||
                  !form.deadline ||
                  form.total_budget <= 0 ||
                  (isContest && form.total_budget < CONTEST_MIN_PRIZE_POOL) ||
                  (!isContest &&
                    (form.base_rate <= 0 ||
                      form.total_budget < form.base_rate)) ||
                  createActivation.isPending
                }
                variant="outline"
              >
                {createActivation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Draft
              </Button>
              <Button
                onClick={() => handleCreate(false)}
                disabled={
                  !form.title ||
                  !form.deadline ||
                  form.total_budget <= 0 ||
                  (isContest && form.total_budget < CONTEST_MIN_PRIZE_POOL) ||
                  (!isContest &&
                    (form.base_rate <= 0 ||
                      form.total_budget < form.base_rate)) ||
                  createActivation.isPending
                }
                className="bg-primary text-black hover:bg-primary/90"
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
            onClick={() => setStep("form")}
            className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Review & Publish
            </h1>
            <p className="text-sm text-slate-400">
              Confirm to publish activation
            </p>
          </div>
        </div>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm text-slate-400">Title</p>
              <p className="font-medium text-white">{form.title}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Type</p>
              <p className="font-medium text-white capitalize">
                {activationType === "sm_panel" ? "SM Panel" : activationType}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Budget</p>
              <p className="font-medium text-white">
                {formatAmount(form.total_budget)}
              </p>
            </div>
            {form.deadline && (
              <div>
                <p className="text-sm text-slate-400">Deadline</p>
                <p className="font-medium text-white">
                  {format(new Date(form.deadline), "PPpp")}
                </p>
              </div>
            )}

            <div className="border-t border-white/[0.08] pt-4 mt-4">
              <p className="text-sm text-slate-400 mb-2">
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
                className="border-white/[0.08]"
              >
                Save as Draft
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!canPublish || publishActivation.isPending}
                className="bg-primary text-black hover:bg-primary/90"
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
