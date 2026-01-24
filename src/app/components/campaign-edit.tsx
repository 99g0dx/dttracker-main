import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, Upload, X, Trash2 } from "lucide-react";
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
} from "../../hooks/useCampaigns";
import * as storageApi from "../../lib/api/storage";
import type { CampaignUpdate } from "../../lib/types/database";
import { FormSkeleton } from "./ui/skeleton";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";

interface CampaignEditProps {
  onNavigate: (path: string) => void;
}

export function CampaignEdit({ onNavigate }: CampaignEditProps) {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id || "");
  const { canEditWorkspace } = useWorkspaceAccess();

  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null
  );
  const [existingCoverImage, setExistingCoverImage] = useState<string | null>(
    null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const updateCampaignMutation = useUpdateCampaign();
  const deleteCampaignMutation = useDeleteCampaign();

  if (!canEditWorkspace) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Read-only access
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-400">
              You do not have permission to edit this campaign.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load campaign data when it arrives
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        brandName: campaign.brand_name || "",
        startDate: campaign.start_date || "",
        endDate: campaign.end_date || "",
        notes: campaign.notes || "",
      });
      setExistingCoverImage(campaign.cover_image_url);
    }
  }, [campaign]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file
      if (!file.type.startsWith("image/")) {
        setUploadError("File must be an image");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File size must be less than 5MB");
        return;
      }

      setCoverImageFile(file);
      setUploadError(null); // Clear any previous errors

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setExistingCoverImage(null);
  };

  const handleSave = async () => {
    if (!id || !campaign) return;

    setIsUploading(true);

    try {
      let coverImageUrl = existingCoverImage;

      // Upload new cover image if one was selected
      if (coverImageFile) {
        const uploadResult = await storageApi.replaceCampaignCover(
          existingCoverImage,
          coverImageFile
        );
        if (uploadResult.error) {
          setUploadError(
            uploadResult.error.message || "Failed to upload image"
          );
          setIsUploading(false);
          return;
        }
        coverImageUrl = uploadResult.data;
        setUploadError(null); // Clear any previous errors
      }

      // Update campaign data
      const campaignData: CampaignUpdate = {
        name: formData.name,
        brand_name: formData.brandName || null,
        cover_image_url: coverImageUrl,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        notes: formData.notes || null,
      };

      await updateCampaignMutation.mutateAsync({ id, updates: campaignData });
      onNavigate(`/campaigns/${id}`);
    } catch (error) {
      console.error("Failed to update campaign:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    deleteCampaignMutation.mutate(id);
    onNavigate("/campaigns");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Edit Campaign
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Update campaign details and settings
            </p>
          </div>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !campaign) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Campaign not found
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-400">
              {error?.message ||
                "The campaign you are looking for does not exist."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate(`/campaigns/${id}`)}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Edit Campaign
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Update campaign details and settings
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Campaign Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Summer Launch 2024"
              className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              required
            />
          </div>

          {/* Brand Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Brand Name / Artist <span className="text-red-400">*</span>
            </label>
            <Input
              value={formData.brandName}
              onChange={(e) =>
                setFormData({ ...formData, brandName: e.target.value })
              }
              placeholder="e.g., Nike, Drake, TechCorp"
              className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              required
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Cover Image
            </label>
            {coverImagePreview || existingCoverImage ? (
              <div className="relative">
                <img
                  src={coverImagePreview || existingCoverImage || ""}
                  alt="Campaign cover"
                  className="w-full h-48 object-cover rounded-lg border border-white/[0.08]"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 w-8 h-8 rounded-md bg-black/60 hover:bg-black/80 border border-white/[0.12] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="cover-upload"
                />
                <label htmlFor="cover-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                  <p className="text-sm text-slate-300 mb-1">
                    Upload cover image
                  </p>
                  <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                </label>
              </div>
            )}
            {uploadError && (
              <p className="text-red-400 text-xs mt-1.5">{uploadError}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Start Date
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                End Date
              </label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
          </div>

          {/* Notes/Brief */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Notes / Brief
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add campaign notes, brief, or objectives..."
              rows={4}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="h-10 px-4 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Campaign
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/campaigns/${id}`)}
            className="h-10 px-4 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleSave}
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              !formData.name ||
              !formData.brandName ||
              isUploading ||
              updateCampaignMutation.isPending
            }
          >
            {isUploading || updateCampaignMutation.isPending
              ? "Saving..."
              : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete campaign?"
        description={`"${formData.name}" will be deleted along with all posts and data. This action cannot be undone.`}
        confirmLabel={
          deleteCampaignMutation.isPending ? "Deleting..." : "Delete campaign"
        }
        confirmDisabled={deleteCampaignMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
