import React, { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X } from "lucide-react";
import { useCreateSubcampaign } from "../../hooks/useSubcampaigns";

interface CreateSubcampaignDialogProps {
  open: boolean;
  parentCampaignId: string;
  parentCampaignName: string;
  parentBrandName: string | null;
  onClose: () => void;
}

export function CreateSubcampaignDialog({
  open,
  parentCampaignId,
  parentCampaignName,
  parentBrandName,
  onClose,
}: CreateSubcampaignDialogProps) {
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState(parentBrandName || "");
  const [error, setError] = useState<string | null>(null);

  const createSubcampaignMutation = useCreateSubcampaign(parentCampaignId);

  useEffect(() => {
    if (!open) {
      setName("");
      setBrandName(parentBrandName || "");
      setError(null);
    }
  }, [open, parentBrandName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Subcampaign name is required");
      return;
    }

    setError(null);

    try {
      await createSubcampaignMutation.mutateAsync({
        name: name.trim(),
        brand_name: brandName.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to create subcampaign:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Create Subcampaign
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Parent: {parentCampaignName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Subcampaign Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g., TikTok Launch"
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                disabled={createSubcampaignMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Brand Name (optional)
              </label>
              <Input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder={parentBrandName || "Brand name"}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                disabled={createSubcampaignMutation.isPending}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={onClose}
                disabled={createSubcampaignMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-black"
                disabled={createSubcampaignMutation.isPending}
              >
                {createSubcampaignMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}