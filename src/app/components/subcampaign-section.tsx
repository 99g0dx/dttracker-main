import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { StatusBadge } from "./status-badge";
import { Plus } from "lucide-react";
import { useSubcampaigns } from "../../hooks/useSubcampaigns";
import { CreateSubcampaignDialog } from "./create-subcampaign-dialog";

interface SubcampaignSectionProps {
  parentCampaignId: string;
  parentCampaignName: string;
  parentBrandName: string | null;
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function SubcampaignSection({
  parentCampaignId,
  parentCampaignName,
  parentBrandName,
}: SubcampaignSectionProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: subcampaigns = [], isLoading } = useSubcampaigns(parentCampaignId);

  return (
    <Card className="bg-[#0D0D0D] border-white/[0.08]">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Subcampaigns</h3>
            <p className="text-sm text-slate-400 mt-1">
              Organize workstreams under the parent campaign
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-9 px-3 bg-primary hover:bg-primary/90 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Subcampaign
          </Button>
        </div>

        {isLoading ? (
          <div className="py-6 text-sm text-slate-400">Loading subcampaigns...</div>
        ) : subcampaigns.length === 0 ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-slate-300 mb-2">
              No subcampaigns yet
            </p>
            <p className="text-xs text-slate-500">
              Add subcampaigns to split workstreams without losing the parent view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subcampaigns.map((subcampaign) => (
              <button
                key={subcampaign.id}
                onClick={() => navigate(`/campaigns/${subcampaign.id}`)}
                className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {subcampaign.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(subcampaign.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={subcampaign.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {subcampaign.posts_count}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Posts</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {formatCompactNumber(subcampaign.total_views)}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Views</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-400">
                      {subcampaign.avg_engagement_rate.toFixed(1)}%
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Engagement</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <CreateSubcampaignDialog
        open={dialogOpen}
        parentCampaignId={parentCampaignId}
        parentCampaignName={parentCampaignName}
        parentBrandName={parentBrandName}
        onClose={() => setDialogOpen(false)}
      />
    </Card>
  );
}
