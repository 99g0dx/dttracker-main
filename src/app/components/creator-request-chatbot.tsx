"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useCart } from "../../contexts/CartContext";
import { useCreateCreatorRequest } from "../../hooks/useCreatorRequests";
import type {
  CampaignType,
  Deliverable,
  UsageRights,
  Urgency,
  CreatorRequestInsert,
} from "../../lib/types/database";

interface CreatorRequestChatbotProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  initialCreatorIds?: string[]; // Optional: pre-fill creator IDs (for single creator requests)
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function CreatorRequestChatbot({
  open,
  onOpenChange,
  onComplete,
  initialCreatorIds,
}: CreatorRequestChatbotProps) {
  const { cart, clearCart } = useCart();
  const createRequestMutation = useCreateCreatorRequest();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<Partial<CreatorRequestInsert>>({
    campaign_type: null,
    campaign_brief: "",
    song_asset_links: [],
    deliverables: [],
    posts_per_creator: 1,
    usage_rights: null,
    deadline: "",
    urgency: "normal",
    contact_person_name: "",
    contact_person_email: "",
    contact_person_phone: "",
  });

  const [assetLinkInput, setAssetLinkInput] = useState("");
  const [selectedDeliverables, setSelectedDeliverables] = useState<
    Deliverable[]
  >([]);
  const [customPostsPerCreator, setCustomPostsPerCreator] = useState("");

  const totalSteps = 7;

  const handleNext = () =>
    currentStep < totalSteps && setCurrentStep((prev) => (prev + 1) as Step);
  const handleBack = () =>
    currentStep > 1 && setCurrentStep((prev) => (prev - 1) as Step);

  const handleSubmit = async () => {
    if (!formData.campaign_type || !formData.campaign_brief) return;

    const requestData: CreatorRequestInsert = {
      user_id: "", // Will be set by API
      campaign_type: formData.campaign_type,
      campaign_brief: formData.campaign_brief,
      song_asset_links: formData.song_asset_links?.filter(Boolean) || [],
      deliverables: selectedDeliverables,
      posts_per_creator:
        formData.posts_per_creator || parseInt(customPostsPerCreator) || 1,
      usage_rights: formData.usage_rights || null,
      deadline: formData.deadline || null,
      urgency: formData.urgency || "normal",
      contact_person_name: formData.contact_person_name || null,
      contact_person_email: formData.contact_person_email || null,
      contact_person_phone: formData.contact_person_phone || null,
      creator_ids: initialCreatorIds || cart.map((c) => c.id),
    };

    try {
      await createRequestMutation.mutateAsync(requestData);
      if (!initialCreatorIds) {
        clearCart(); // Only clear cart if not using initialCreatorIds
      }
      onComplete();
      onOpenChange(false);
      // Reset form
      setCurrentStep(1);
      setFormData({
        campaign_type: null,
        campaign_brief: "",
        song_asset_links: [],
        deliverables: [],
        posts_per_creator: 1,
        usage_rights: null,
        deadline: "",
        urgency: "normal",
        contact_person_name: "",
        contact_person_email: "",
        contact_person_phone: "",
      });
      setSelectedDeliverables([]);
      setCustomPostsPerCreator("");
      setAssetLinkInput("");
    } catch (error) {
      console.error("Failed to submit request:", error);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!formData.campaign_type;
      case 2:
        return !!formData.campaign_brief?.trim().length;
      case 3:
        return true;
      case 4:
        return selectedDeliverables.length > 0;
      case 5:
        return !!formData.usage_rights;
      case 6:
        return !!formData.deadline;
      case 7:
        return true;
      default:
        return false;
    }
  };

  const addAssetLink = () => {
    if (assetLinkInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        song_asset_links: [
          ...(prev.song_asset_links || []),
          assetLinkInput.trim(),
        ],
      }));
      setAssetLinkInput("");
    }
  };

  const removeAssetLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      song_asset_links:
        prev.song_asset_links?.filter((_, i) => i !== index) || [],
    }));
  };

  const toggleDeliverable = (deliverable: Deliverable) => {
    setSelectedDeliverables((prev) =>
      prev.includes(deliverable)
        ? prev.filter((d) => d !== deliverable)
        : [...prev, deliverable]
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label className="text-white text-base font-semibold">
              Campaign Type
            </Label>
            <p className="text-sm text-slate-400">
              Select the type of campaign you want to run.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {[
                { value: "music_promotion", label: "Music Promotion" },
                { value: "brand_promotion", label: "Brand Promotion" },
                { value: "product_launch", label: "Product Launch" },
                { value: "event_activation", label: "Event / Activation" },
                { value: "other", label: "Other" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition"
                >
                  <input
                    type="radio"
                    name="campaign_type"
                    value={option.value}
                    checked={formData.campaign_type === option.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        campaign_type: e.target.value as CampaignType,
                      }))
                    }
                    className="w-4 h-4 text-primary border-white/[0.2] bg-white/[0.03] focus:ring-primary"
                  />
                  <span className="text-white text-sm font-medium">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label className="text-white text-base font-semibold">
              Campaign Brief
            </Label>
            <p className="text-sm text-slate-400">
              Describe your campaign, goals, target audience, and key messages.
            </p>
            <Textarea
              value={formData.campaign_brief || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  campaign_brief: e.target.value,
                }))
              }
              placeholder="Describe your campaign..."
              className="w-full min-h-[180px] bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">
              {(formData.campaign_brief || "").length} characters
            </p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label className="text-white text-base font-semibold">
              Asset Links (Optional)
            </Label>
            <p className="text-sm text-slate-400">
              Add links to songs, TikTok sounds, Spotify, YouTube, or files.
            </p>
            <div className="flex gap-2 mt-2">
              <Input
                value={assetLinkInput}
                onChange={(e) => setAssetLinkInput(e.target.value)}
                placeholder="https://..."
                className="bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-slate-500 flex-1"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAssetLink();
                  }
                }}
              />
              <Button
                onClick={addAssetLink}
                variant="outline"
                className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
              >
                Add
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
              >
                Skip
              </Button>
            </div>
            {(formData.song_asset_links || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {(formData.song_asset_links || []).map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]"
                  >
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-primary text-sm hover:underline flex-1"
                    >
                      {link}
                    </a>
                    <button
                      onClick={() => removeAssetLink(index)}
                      className="ml-2 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-white text-sm font-medium">
                Deliverables
              </Label>
              <p className="text-xs text-slate-400 mt-1">
                Select the types of content you need from creators.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { value: "tiktok_post", label: "TikTok post" },
                { value: "instagram_reel", label: "Instagram reel" },
                { value: "instagram_story", label: "Instagram story" },
                { value: "youtube_short", label: "YouTube short" },
                { value: "other", label: "Other" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDeliverables.includes(
                      option.value as Deliverable
                    )}
                    onChange={() =>
                      toggleDeliverable(option.value as Deliverable)
                    }
                    className="w-4 h-4 text-primary border-white/[0.2] bg-white/[0.03] rounded focus:ring-primary"
                  />
                  <span className="text-white text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              <Label className="text-white text-sm font-medium">
                Posts per creator
              </Label>
              <div className="space-y-2">
                {[1, 2, 3].map((num) => (
                  <label
                    key={num}
                    className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="posts_per_creator"
                      value={num}
                      checked={
                        formData.posts_per_creator === num &&
                        !customPostsPerCreator
                      }
                      onChange={() => {
                        setFormData((prev) => ({
                          ...prev,
                          posts_per_creator: num,
                        }));
                        setCustomPostsPerCreator("");
                      }}
                      className="w-4 h-4 text-primary border-white/[0.2] bg-white/[0.03] focus:ring-primary"
                    />
                    <span className="text-white text-sm">{num}</span>
                  </label>
                ))}
                <label className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="posts_per_creator"
                    checked={!!customPostsPerCreator}
                    onChange={() => {
                      setCustomPostsPerCreator("1");
                      setFormData((prev) => ({
                        ...prev,
                        posts_per_creator: 1,
                      }));
                    }}
                    className="w-4 h-4 text-primary border-white/[0.2] bg-white/[0.03] focus:ring-primary"
                  />
                  <Input
                    type="number"
                    value={customPostsPerCreator}
                    onChange={(e) => {
                      setCustomPostsPerCreator(e.target.value);
                      const num = parseInt(e.target.value);
                      if (!isNaN(num) && num > 0) {
                        setFormData((prev) => ({
                          ...prev,
                          posts_per_creator: num,
                        }));
                      }
                    }}
                    placeholder="Custom number"
                    className="w-24 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
                    min="1"
                  />
                </label>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Label className="text-white text-sm font-medium">
              Usage Rights
            </Label>
            <p className="text-xs text-slate-400 mt-1">
              How would you like to use the content created by these creators?
            </p>
            <div className="space-y-3">
              {[
                {
                  value: "creator_page_only",
                  label: "Only on creator's page",
                  description:
                    "Content stays on the creator's social media pages only",
                },
                {
                  value: "repost_brand_pages",
                  label: "Repost on brand pages",
                  description:
                    "You can repost content on your brand's social media pages",
                },
                {
                  value: "run_ads",
                  label: "Run ads",
                  description:
                    "You can use content to run paid advertising campaigns",
                },
                {
                  value: "all_above",
                  label: "All of the above",
                  description:
                    "Full usage rights including all of the above options",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="usage_rights"
                    value={option.value}
                    checked={formData.usage_rights === option.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        usage_rights: e.target.value as UsageRights,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 text-primary border-white/[0.2] bg-white/[0.03] focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="text-white text-sm font-medium block">
                      {option.label}
                    </span>
                    <span className="text-slate-400 text-xs block mt-1">
                      {option.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label
                htmlFor="deadline"
                className="text-white text-sm font-medium"
              >
                Deadline
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, deadline: e.target.value }))
                }
                className="bg-white/[0.03] border-white/[0.08] text-white"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-4">
              <Label className="text-white text-sm font-medium">Urgency</Label>
              <div className="space-y-3">
                {[
                  {
                    value: "normal",
                    label: "Normal",
                    description: "Standard timeline",
                  },
                  {
                    value: "fast_turnaround",
                    label: "Fast turnaround",
                    description: "Need it done quickly",
                  },
                  {
                    value: "asap",
                    label: "ASAP",
                    description: "Urgent - highest priority",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="urgency"
                      value={option.value}
                      checked={formData.urgency === option.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          urgency: e.target.value as Urgency,
                        }))
                      }
                      className="w-4 h-4 mt-0.5 text-primary border-white/[0.2] bg-white/[0.03] focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium block">
                        {option.label}
                      </span>
                      <span className="text-slate-400 text-xs block mt-1">
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Label
                htmlFor="contact_name"
                className="text-white text-sm font-medium"
              >
                Contact Person (Optional)
              </Label>
              <Input
                id="contact_name"
                value={formData.contact_person_name || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contact_person_name: e.target.value,
                  }))
                }
                placeholder="Name"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
              />
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_person_email || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contact_person_email: e.target.value,
                  }))
                }
                placeholder="Email"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
              />
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_person_phone || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contact_person_phone: e.target.value,
                  }))
                }
                placeholder="Phone"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-medium mb-4">
                Review Your Request
              </h3>
              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <p className="text-slate-400 mb-1">Selected Creators</p>
                  <p className="text-white font-medium">
                    {cart.length} creators
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <p className="text-slate-400 mb-1">Campaign Type</p>
                  <p className="text-white font-medium capitalize">
                    {formData.campaign_type?.replace("_", " ")}
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <p className="text-slate-400 mb-1">Deliverables</p>
                  <p className="text-white font-medium">
                    {selectedDeliverables
                      .map((d) => d.replace("_", " "))
                      .join(", ")}
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <p className="text-slate-400 mb-1">Posts per Creator</p>
                  <p className="text-white font-medium">
                    {formData.posts_per_creator || customPostsPerCreator || 1}
                  </p>
                </div>
                {formData.deadline && (
                  <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    <p className="text-slate-400 mb-1">Deadline</p>
                    <p className="text-white font-medium">
                      {new Date(formData.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-[#111111] border border-white/[0.08] shadow-xl">
        <DialogHeader className="p-6 border-b border-white/[0.08]">
          <DialogTitle className="text-2xl font-semibold text-white">
            Create Creator Request
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-1">
            Step {currentStep} of {totalSteps}
          </DialogDescription>
          <div className="w-full h-2 bg-white/[0.03] rounded-full mt-4">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">{renderStepContent()}</div>

        <DialogFooter className="flex-shrink-0 flex justify-end gap-3 border-t border-white/[0.08] p-6">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-primary hover:bg-primary/90 text-black font-medium flex items-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || createRequestMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-black font-medium flex items-center gap-2"
            >
              {createRequestMutation.isPending
                ? "Submitting..."
                : "Submit Request"}{" "}
              <Check className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
