import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Users, Mail, RefreshCw, UserCheck, UserPlus, AlertCircle, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import type { Activation } from "../../../lib/types/database";
import { toast } from "sonner";

interface CommunityDeliveryCardProps {
  activation: Activation;
}

export function CommunityDeliveryCard({ activation }: CommunityDeliveryCardProps) {
  const queryClient = useQueryClient();
  const [resending, setResending] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Only show for community activations
  if (activation.visibility !== "community") return null;

  const workspaceId = activation.workspace_id;
  const communityFanIds = activation.community_fan_ids;

  // Fetch community fan stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["community_delivery", activation.id],
    queryFn: async () => {
      // Get targeted fans
      let fansQuery = supabase
        .from("community_fans")
        .select("id, email, dobble_tap_user_id, creator_id", { count: "exact" })
        .eq("workspace_id", workspaceId);

      if (Array.isArray(communityFanIds) && communityFanIds.length > 0) {
        fansQuery = fansQuery.in("id", communityFanIds);
      }

      const { data: fans, count: totalFans } = await fansQuery;

      // Get fans with DT accounts (direct dobble_tap_user_id or linked creator)
      const fansWithCreator = (fans || []).filter((f) => f.dobble_tap_user_id || f.creator_id);
      const fansWithEmail = (fans || []).filter(
        (f) => f.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)
      );

      // Get notification stats
      const { data: notifications } = await supabase
        .from("community_fan_notifications")
        .select("status", { count: "exact" })
        .eq("activation_id", activation.id);

      const sentCount = (notifications || []).filter((n) => n.status === "sent").length;
      const failedCount = (notifications || []).filter((n) => n.status === "failed").length;

      return {
        totalFans: totalFans || 0,
        withDtAccount: fansWithCreator.length,
        pendingSignup: (totalFans || 0) - fansWithCreator.length,
        withEmail: fansWithEmail.length,
        emailsSent: sentCount,
        emailsFailed: failedCount,
      };
    },
    staleTime: 30_000,
  });

  const handleResyncToDobbleTap = useCallback(async () => {
    setResyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "activation-sync-to-dobbletap",
        { body: { activationId: activation.id } }
      );

      if (error) {
        toast.error(`Resync failed: ${error.message || "Edge Function error"}`);
      } else if (data?.error) {
        toast.error(`Resync failed: ${data.error}`);
      } else if (data?.synced) {
        toast.success("Activation resynced to Dobble Tap");
        queryClient.invalidateQueries({
          queryKey: ["community_delivery", activation.id],
        });
      } else {
        toast.warning(`Sync attempted but DT did not confirm: ${data?.error ?? "no response"}`);
      }
    } catch (err: any) {
      toast.error(`Resync failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setResyncing(false);
    }
  }, [activation.id, queryClient]);

  // Auto-sync when activation transitions to "live"
  const prevStatusRef = useRef(activation.status);
  const autoSyncTriggeredRef = useRef(false);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = activation.status;
    if (prev !== "live" && activation.status === "live" && !autoSyncTriggeredRef.current) {
      autoSyncTriggeredRef.current = true;
      handleResyncToDobbleTap();
    }
  }, [activation.status, handleResyncToDobbleTap]);

  const handleResendNotifications = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "notify-community-activation",
        {
          body: {
            activationId: activation.id,
            workspaceId: workspaceId,
          },
        }
      );

      if (error) {
        toast.error("Failed to send notifications");
      } else {
        const sent = data?.sent || 0;
        const alreadyNotified = data?.already_notified || 0;
        if (sent > 0) {
          toast.success(`Sent ${sent} notification${sent > 1 ? "s" : ""}`);
        } else if (alreadyNotified > 0) {
          toast.info("All fans have already been notified");
        } else {
          toast.info("No notifications to send");
        }
        queryClient.invalidateQueries({
          queryKey: ["community_delivery", activation.id],
        });
      }
    } catch {
      toast.error("Failed to send notifications");
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">
              Community Delivery
            </h3>
          </div>
          {activation.status === "live" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResyncToDobbleTap}
                disabled={resyncing}
                className="border-border"
                title="Re-send this activation to Dobble Tap with the latest fan targeting"
              >
                {resyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                )}
                {resyncing ? "Syncing..." : "Resync to DT"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendNotifications}
                disabled={resending}
                className="border-border"
              >
                {resending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                )}
                {resending ? "Sending..." : "Resend Emails"}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">Loading delivery stats...</p>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Targeted</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stats.totalFans}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-muted-foreground">With DT Account</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stats.withDtAccount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="flex items-center gap-1.5 mb-1">
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-muted-foreground">Pending Signup</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stats.pendingSignup}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Emails Sent</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stats.emailsSent}
                {stats.emailsFailed > 0 && (
                  <span className="text-xs text-red-400 ml-1">
                    ({stats.emailsFailed} failed)
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Could not load delivery stats</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
