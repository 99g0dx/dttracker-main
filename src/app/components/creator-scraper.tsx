import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  Upload,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as creatorExtractionApi from "../../lib/api/creator-extraction";
import * as creatorsApi from "../../lib/api/creators";
import { creatorsKeys } from "../../hooks/useCreators";
import type { Platform } from "../../lib/types/database";
import { toast } from "sonner";

interface CreatorScraperProps {
  onNavigate: (path: string) => void;
}

interface ExtractedData {
  handle: string;
  followers: string;
  contact: string;
  location: string;
  niche: string;
  category: string;
}

interface BulkImageItem {
  id: string;
  file: File;
  dataUrl: string;
  status: "pending" | "processing" | "success" | "failed" | "skipped";
  extractedData?: ExtractedData;
  error?: string;
  platform?: string;
  confidence?: any;
}

export function CreatorScraper({ onNavigate }: CreatorScraperProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const isPausedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const uploadedImagesRef = useRef<BulkImageItem[]>([]);

  // Upload mode
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");

  // Single upload state (existing)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null
  );
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<any>(null);
  const [formData, setFormData] = useState<ExtractedData>({
    handle: "",
    followers: "",
    contact: "",
    location: "",
    niche: "",
    category: "",
  });

  // Bulk upload state
  const [uploadedImages, setUploadedImages] = useState<BulkImageItem[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [processingStats, setProcessingStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const successfulExtractions = React.useMemo(
    () =>
      uploadedImages.filter(
        (img) => img.status === "success" && img.extractedData && img.platform
      ),
    [uploadedImages]
  );

  const platforms = ["TikTok", "Instagram", "YouTube", "Twitter", "Facebook"];
  const categories = [
    "Nano (1K-10K)",
    "Micro (10K-100K)",
    "Mid (100K-500K)",
    "Macro (500K+)",
  ];

  // Sync ref with state
  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  // Reset bulk state when switching modes
  useEffect(() => {
    if (uploadMode === "single") {
      setUploadedImages([]);
      uploadedImagesRef.current = [];
      setIsProcessingBulk(false);
      setCurrentProcessingIndex(-1);
      setShowSummary(false);
    } else {
      setUploadedImage(null);
      setExtractedData(null);
      setFormData({
        handle: "",
        followers: "",
        contact: "",
        location: "",
        niche: "",
        category: "",
      });
    }
  }, [uploadMode]);

  const compressImage = async (
    dataUrl: string,
    maxSizeMB: number = 0.5
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        const maxDimension = 1920; // Max width or height
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Start with high quality and reduce if needed
        let quality = 0.9;
        let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

        // Calculate size in MB
        let sizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);

        // Reduce quality until size is under target
        while (sizeInMB > maxSizeMB && quality > 0.3) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          sizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);
        }

        resolve(compressedDataUrl);
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    // Validate file size (max 10MB for vision API)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const originalDataUrl = reader.result as string;

        // Compress image to reduce API costs
        toast.info("Optimizing image...");
        const compressedDataUrl = await compressImage(originalDataUrl, 0.5); // 500KB target

        setUploadedImage(compressedDataUrl);
        setExtractedData(null);
        setExtractionError(null);
        setConfidence(null);
      } catch (error) {
        toast.error("Failed to process image");
        console.error("Compression error:", error);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleBulkImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        invalidFiles.push(file.name);
      } else if (file.size > 10 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (exceeds 10MB)`);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(
        `Skipped ${invalidFiles.length} invalid file(s): ${invalidFiles
          .slice(0, 3)
          .join(", ")}${invalidFiles.length > 3 ? "..." : ""}`
      );
    }

    if (validFiles.length === 0) return;

    // Process files to create data URLs
    const processedImages: BulkImageItem[] = [];
    let processedCount = 0;

    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const originalDataUrl = reader.result as string;
            const compressedDataUrl = await compressImage(originalDataUrl, 0.5);

            processedImages.push({
              id: `${Date.now()}-${Math.random()}`,
              file,
              dataUrl: compressedDataUrl,
              status: "pending",
            });

            processedCount++;
            if (processedCount === validFiles.length) {
              setUploadedImages((prev) => [...prev, ...processedImages]);
              toast.success(`Added ${validFiles.length} image(s) to queue`);
            }
            resolve();
          } catch (error) {
            console.error("Error processing file:", error);
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    };

    // Process files sequentially to avoid memory issues
    for (const file of validFiles) {
      await processFile(file);
    }

    // Reset file input
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  };

  const removeBulkImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const skipBulkImage = (id: string) => {
    setUploadedImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, status: "skipped" as const } : img
      )
    );
    setProcessingStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
  };

  const retryBulkImage = (id: string) => {
    setUploadedImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, status: "pending" as const, error: undefined }
          : img
      )
    );
  };

  const processBulkImages = async () => {
    if (uploadedImages.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    const pendingImages = uploadedImages.filter(
      (img) => img.status === "pending"
    );
    if (pendingImages.length === 0) {
      toast.info("No pending images to process");
      return;
    }

    isProcessingRef.current = true;
    isPausedRef.current = false;
    setIsProcessingBulk(true);
    setIsPaused(false);
    setShowSummary(false);

    // Get current stats
    setProcessingStats({
      total: uploadedImages.length,
      success: uploadedImages.filter((img) => img.status === "success").length,
      failed: uploadedImages.filter((img) => img.status === "failed").length,
      skipped: uploadedImages.filter((img) => img.status === "skipped").length,
    });

    // Process images sequentially - use snapshot for data, ref for current status
    const imagesSnapshot = [...uploadedImages];

    for (let i = 0; i < imagesSnapshot.length; i++) {
      // Wait if paused
      while (isPausedRef.current && isProcessingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!isProcessingRef.current) break; // Canceled

      // Check if this image is still pending using ref
      if (i >= uploadedImagesRef.current.length) continue;
      if (uploadedImagesRef.current[i].status !== "pending") continue;

      const imageToProcess = imagesSnapshot[i];

      setCurrentProcessingIndex(i);
      setUploadedImages((prev) =>
        prev.map((img, idx) =>
          idx === i ? { ...img, status: "processing" as const } : img
        )
      );

      setCurrentProcessingIndex(i);
      setUploadedImages((prev) =>
        prev.map((img, idx) =>
          idx === i ? { ...img, status: "processing" as const } : img
        )
      );

      try {
        // Extract creator info
        const result = await creatorExtractionApi.extractCreatorFromImage(
          imageToProcess.dataUrl
        );

        if (!result.success || !result.data) {
          throw new Error(result.error || "Extraction failed");
        }

        if (!creatorExtractionApi.validateExtraction(result.data)) {
          throw new Error(
            "Could not extract required fields (handle and followers)"
          );
        }

        // Determine platform
        let platform = selectedPlatform;
        if (result.data.platform && !platform) {
          const platformMap: Record<string, string> = {
            tiktok: "TikTok",
            instagram: "Instagram",
            youtube: "YouTube",
            twitter: "Twitter",
            facebook: "Facebook",
          };
          platform = platformMap[result.data.platform] || "";
        }

        if (!platform) {
          throw new Error(
            "Platform is required but not detected. Please select a platform."
          );
        }

        // Calculate category
        const category = creatorExtractionApi.categorizeFollowers(
          result.data.followers
        );

        // Prepare extracted data
        const extractedInfo: ExtractedData = {
          handle: result.data.handle,
          followers: result.data.followers,
          contact: result.data.contact || "",
          location: result.data.location || "",
          niche: result.data.niche || "",
          category: category,
        };

        // Update image item with success (extracted, not saved yet)
        setUploadedImages((prev) =>
          prev.map((img, idx) =>
            idx === i
              ? {
                  ...img,
                  status: "success" as const,
                  extractedData: extractedInfo,
                  platform: platform,
                  confidence: result.data?.confidence,
                }
              : img
          )
        );

        setProcessingStats((prev) => ({ ...prev, success: prev.success + 1 }));
      } catch (error: any) {
        console.error("Processing error:", error);
        setUploadedImages((prev) =>
          prev.map((img, idx) =>
            idx === i
              ? {
                  ...img,
                  status: "failed" as const,
                  error: error.message || "Processing failed",
                }
              : img
          )
        );
        setProcessingStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }

      // Small delay between processing to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    isProcessingRef.current = false;
    setIsProcessingBulk(false);
    setCurrentProcessingIndex(-1);
    setShowSummary(true);

    // Get final stats
    setUploadedImages((prev) => {
      const finalStats = {
        total: prev.length,
        success: prev.filter((img) => img.status === "success").length,
        failed: prev.filter((img) => img.status === "failed").length,
        skipped: prev.filter((img) => img.status === "skipped").length,
      };

      toast.success(
        `Extraction complete: ${finalStats.success} extracted, ${finalStats.failed} failed, ${finalStats.skipped} skipped. Review and confirm to add to library.`
      );
      return prev;
    });
  };

  const cancelBulkProcessing = () => {
    isProcessingRef.current = false;
    isPausedRef.current = false;
    setIsProcessingBulk(false);
    setIsPaused(false);
    setCurrentProcessingIndex(-1);
  };

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  };

  const updateExtractedData = (
    id: string,
    field: keyof ExtractedData,
    value: string
  ) => {
    setUploadedImages((prev) =>
      prev.map((img) =>
        img.id === id && img.extractedData
          ? {
              ...img,
              extractedData: {
                ...img.extractedData,
                [field]: value,
              },
            }
          : img
      )
    );
  };

  const confirmAndSaveAll = async () => {
    const successfulExtractions = uploadedImages.filter(
      (img) => img.status === "success" && img.extractedData && img.platform
    );

    if (successfulExtractions.length === 0) {
      toast.error("No creators to save");
      return;
    }

    const platformMap: Record<string, Platform> = {
      TikTok: "tiktok",
      Instagram: "instagram",
      YouTube: "youtube",
      Twitter: "twitter",
      Facebook: "facebook",
    };

    let savedCount = 0;
    let failedCount = 0;

    toast.info(`Saving ${successfulExtractions.length} creator(s)...`);

    for (const imageItem of successfulExtractions) {
      try {
        const followerCount = parseFollowerCount(
          imageItem.extractedData!.followers
        );
        const platformValue = platformMap[imageItem.platform!];

        if (!platformValue) {
          throw new Error("Invalid platform");
        }

        const { data: creator, error: saveError } =
          await creatorsApi.getOrCreate(
            imageItem.extractedData!.handle,
            imageItem.extractedData!.handle,
            platformValue,
            followerCount,
            imageItem.extractedData!.contact || null,
            null,
            imageItem.extractedData!.niche || null,
            imageItem.extractedData!.location || null,
            "scraper_extraction"
          );

        if (saveError || !creator) {
          throw new Error(saveError?.message || "Failed to save creator");
        }

        savedCount++;
      } catch (error: any) {
        console.error("Failed to save creator:", error);
        failedCount++;
      }
    }

    // Invalidate queries to refresh creator list
    await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });

    if (savedCount > 0) {
      toast.success(`${savedCount} creator(s) added to library!`);
      // Clear the uploaded images after successful save
      setUploadedImages([]);
      setShowSummary(false);
      setProcessingStats({
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
      });
    }

    if (failedCount > 0) {
      toast.error(`Failed to save ${failedCount} creator(s)`);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    setExtractedData(null);
    setFormData({
      handle: "",
      followers: "",
      contact: "",
      location: "",
      niche: "",
      category: "",
    });
  };

  const handleExtract = async () => {
    if (!uploadedImage) {
      toast.error("Please upload an image first");
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      // Call real AI extraction API
      const result =
        await creatorExtractionApi.extractCreatorFromImage(uploadedImage);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Extraction failed");
      }

      // Validate required fields
      if (!creatorExtractionApi.validateExtraction(result.data)) {
        throw new Error(
          "Could not extract required fields (handle and followers)"
        );
      }

      // If platform was detected by AI and user hasn't selected one, use AI's detection
      if (result.data.platform && !selectedPlatform) {
        const platformMap: Record<string, string> = {
          tiktok: "TikTok",
          instagram: "Instagram",
          youtube: "YouTube",
          twitter: "Twitter",
          facebook: "Facebook",
        };
        setSelectedPlatform(platformMap[result.data.platform] || "");
      }

      // Calculate category from follower count
      const category = creatorExtractionApi.categorizeFollowers(
        result.data.followers
      );

      // Prepare extracted data
      const extractedInfo: ExtractedData = {
        handle: result.data.handle,
        followers: result.data.followers,
        contact: result.data.contact || "",
        location: result.data.location || "",
        niche: result.data.niche || "",
        category: category,
      };

      setExtractedData(extractedInfo);
      setFormData(extractedInfo);
      setConfidence(result.data.confidence);

      // Show success with confidence warning if low
      const avgConfidence = creatorExtractionApi.getAverageConfidence(
        result.data.confidence
      );
      if (avgConfidence < 0.7) {
        toast.warning(
          "Extraction completed with low confidence. Please review the fields."
        );
      } else {
        toast.success("Creator info extracted successfully!");
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      setExtractionError(error.message);
      toast.error(error.message || "Failed to extract creator info");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.handle || !formData.followers || !selectedPlatform) {
      toast.error("Please fill in handle, followers, and select a platform");
      return;
    }

    try {
      // Parse follower count string to number
      const followerCount = parseFollowerCount(formData.followers);

      // Map platform string to Platform type
      const platformMap: Record<string, Platform> = {
        TikTok: "tiktok",
        Instagram: "instagram",
        YouTube: "youtube",
        Twitter: "twitter",
        Facebook: "facebook",
      };

      const platform = platformMap[selectedPlatform];
      if (!platform) {
        toast.error("Invalid platform selected");
        return;
      }

      // Save creator to database using getOrCreate
      // Map contact field to email
      const email = formData.contact || null;
      const phone = null; // Phone not captured in scraper form currently
      const niche = formData.niche || null;
      const location = formData.location || null;

      const { data: creator, error } = await creatorsApi.getOrCreate(
        formData.handle, // Use handle as name (getOrCreate will use handle if name is null)
        formData.handle,
        platform,
        followerCount,
        email,
        phone,
        niche,
        location,
        "scraper_extraction"
      );

      if (error) {
        console.error("Failed to save creator:", error);
        toast.error(error.message || "Failed to save creator");
        return;
      }

      if (creator) {
        // Invalidate and refetch all creators queries (including network-filtered ones)
        await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
        await queryClient.refetchQueries({ queryKey: creatorsKeys.all });

        toast.success(`Creator ${formData.handle} saved successfully!`);
        onNavigate("/creators");
      } else {
        toast.error("Failed to save creator");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save creator");
    }
  };

  // Helper function to parse follower count string to number
  const parseFollowerCount = (str: string): number => {
    if (!str) return 0;

    // Remove commas and spaces (some locales use space as thousand separator)
    const normalized = str.toLowerCase().replace(/[, ]/g, "").trim();

    if (normalized.includes("b")) {
      return parseFloat(normalized) * 1000000000;
    }
    if (normalized.includes("m")) {
      return parseFloat(normalized) * 1000000;
    }
    if (normalized.includes("k")) {
      return parseFloat(normalized) * 1000;
    }

    return parseInt(normalized) || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate("/creators")}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Creator Scraper
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Extract creator information from screenshots using AI
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/[0.08] rounded-lg w-fit">
        <button
          onClick={() => setUploadMode("single")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            uploadMode === "single"
              ? "bg-primary text-black"
              : "text-slate-400 hover:text-white"
          }`}
          style={
            uploadMode === "single"
              ? { backgroundClip: "unset", WebkitBackgroundClip: "unset" }
              : undefined
          }
        >
          Single Upload
        </button>
        <button
          onClick={() => setUploadMode("bulk")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            uploadMode === "bulk"
              ? "bg-primary text-black"
              : "text-slate-400 hover:text-white"
          }`}
          style={
            uploadMode === "bulk"
              ? { backgroundClip: "unset", WebkitBackgroundClip: "unset" }
              : undefined
          }
        >
          Bulk Upload
        </button>
      </div>

      {uploadMode === "single" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Upload Section */}
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6 space-y-5">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Platform (Optional)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[rgba(0,0,0,0)]">
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setSelectedPlatform(platform)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedPlatform === platform
                          ? "bg-primary text-black"
                          : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border border-white/[0.08]"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              {!uploadedImage ? (
                <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label htmlFor="screenshot-upload" className="cursor-pointer">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/[0.03] rounded-lg flex items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-300 mb-2">
                      Upload screenshot or paste image
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG, JPG up to 10MB
                    </p>
                  </label>
                </div>
              ) : (
                <div>
                  <div className="relative group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded screenshot"
                      className="w-full rounded-lg border border-white/[0.08]"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/80 hover:bg-red-500 rounded-md transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {!extractedData && (
                    <>
                      <Button
                        onClick={handleExtract}
                        disabled={isExtracting}
                        className="w-full mt-4 h-10 bg-primary hover:bg-primary/90"
                        style={{
                          color: "rgba(3, 2, 19, 1)",
                          backgroundClip: "unset",
                          WebkitBackgroundClip: "unset",
                        }}
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Extract Creator Info
                          </>
                        )}
                      </Button>

                      {/* Error State */}
                      {extractionError && (
                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-semibold text-red-400 mb-1">
                                Extraction Failed
                              </h4>
                              <p className="text-xs text-slate-400 mb-3">
                                {extractionError}
                              </p>
                              <p className="text-xs text-slate-500">
                                You can manually enter the creator information
                                using the form on the right.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Extracted Data Form */}
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {extractedData ? "Review & Edit" : "Creator Information"}
              </h3>

              {!extractedData && !extractionError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">
                    Upload a screenshot and extract creator info to get started
                  </p>
                </div>
              )}

              {(extractedData || extractionError) && (
                <div className="space-y-4">
                  {/* Confidence Scores */}
                  {extractedData && confidence && (
                    <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] mb-4">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Extraction Confidence
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {Object.entries(confidence).map(
                          ([field, score]: [string, any]) => {
                            const confidenceLevel =
                              creatorExtractionApi.getConfidenceLevel(score);
                            return (
                              <div key={field} className="flex justify-between">
                                <span className="text-slate-500 capitalize">
                                  {field}:
                                </span>
                                <span className={confidenceLevel.color}>
                                  {(score * 100).toFixed(0)}%
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Review and edit fields with low confidence scores
                      </p>
                    </div>
                  )}

                  {/* Form Fields */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Handle/Username *
                    </label>
                    <Input
                      value={formData.handle}
                      onChange={(e) =>
                        setFormData({ ...formData, handle: e.target.value })
                      }
                      placeholder="@username"
                      className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={isExtracting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Followers/Subscribers *
                    </label>
                    <Input
                      value={formData.followers}
                      onChange={(e) =>
                        setFormData({ ...formData, followers: e.target.value })
                      }
                      placeholder="125K or 1.2M"
                      className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={isExtracting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full h-10 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white"
                      disabled={isExtracting}
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Contact Info
                    </label>
                    <Input
                      value={formData.contact}
                      onChange={(e) =>
                        setFormData({ ...formData, contact: e.target.value })
                      }
                      placeholder="Email or website"
                      className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={isExtracting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Location
                    </label>
                    <Input
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="City, State/Country"
                      className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={isExtracting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Niche/Category
                    </label>
                    <Input
                      value={formData.niche}
                      onChange={(e) =>
                        setFormData({ ...formData, niche: e.target.value })
                      }
                      placeholder="Fashion, Tech, Gaming, etc."
                      className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={isExtracting}
                    />
                  </div>

                  {/* Save Button */}
                  <div className="pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={
                        !formData.handle ||
                        !formData.followers ||
                        !selectedPlatform
                      }
                      className="w-full h-10 bg-primary hover:bg-primary/90"
                      style={{
                        color: "rgba(3, 2, 19, 1)",
                        backgroundClip: "unset",
                        WebkitBackgroundClip: "unset",
                      }}
                    >
                      Save Creator
                    </Button>
                    {(!formData.handle ||
                      !formData.followers ||
                      !selectedPlatform) && (
                      <p className="text-xs text-slate-500 mt-2 text-center">
                        Please fill in handle, followers, and select a platform
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Bulk Upload Mode */
        <div className="space-y-6">
          {/* Platform Selection for Bulk */}
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Platform (Optional - applies to all images)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setSelectedPlatform(platform)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedPlatform === platform
                          ? "bg-primary text-black"
                          : "bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border border-white/[0.08]"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6">
              {uploadedImages.length === 0 ? (
                <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBulkImageUpload}
                    className="hidden"
                    id="bulk-screenshot-upload"
                  />
                  <label
                    htmlFor="bulk-screenshot-upload"
                    className="cursor-pointer block"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/[0.03] rounded-lg flex items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-300 mb-2">
                      Upload multiple screenshots
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG, JPG up to 10MB each. Select multiple files.
                    </p>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        {uploadedImages.length} image(s) uploaded
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {processingStats.success} saved,{" "}
                        {processingStats.failed} failed,{" "}
                        {processingStats.skipped} skipped
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={bulkFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleBulkImageUpload}
                        className="hidden"
                        id="bulk-add-more"
                      />
                      <label htmlFor="bulk-add-more">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Add More
                        </Button>
                      </label>
                      {!isProcessingBulk && !showSummary && (
                        <Button
                          onClick={processBulkImages}
                          disabled={
                            uploadedImages.filter(
                              (img) => img.status === "pending"
                            ).length === 0
                          }
                          className="h-9 bg-primary hover:bg-primary/90 text-black"
                          style={{
                            backgroundClip: "unset",
                            WebkitBackgroundClip: "unset",
                          }}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Processing
                        </Button>
                      )}
                      {!isProcessingBulk && showSummary && (
                        <Button
                          onClick={confirmAndSaveAll}
                          disabled={
                            uploadedImages.filter(
                              (img) =>
                                img.status === "success" && img.extractedData
                            ).length === 0
                          }
                          className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm & Add All
                        </Button>
                      )}
                      {isProcessingBulk && (
                        <>
                          <Button
                            onClick={togglePause}
                            variant="outline"
                            className="h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                          >
                            {isPaused ? (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Resume
                              </>
                            ) : (
                              <>
                                <Pause className="w-4 h-4 mr-2" />
                                Pause
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={cancelBulkProcessing}
                            variant="outline"
                            className="h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-red-400"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Processing Queue */}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {uploadedImages.map((imageItem, index) => {
                      const isProcessing =
                        index === currentProcessingIndex && isProcessingBulk;
                      const getStatusIcon = () => {
                        switch (imageItem.status) {
                          case "success":
                            return (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            );
                          case "failed":
                            return (
                              <AlertCircle className="w-5 h-5 text-red-400" />
                            );
                          case "processing":
                            return (
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            );
                          case "skipped":
                            return (
                              <SkipForward className="w-5 h-5 text-slate-500" />
                            );
                          default:
                            return (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                            );
                        }
                      };

                      const getStatusColor = () => {
                        switch (imageItem.status) {
                          case "success":
                            return "border-emerald-500/30 bg-emerald-500/5";
                          case "failed":
                            return "border-red-500/30 bg-red-500/5";
                          case "processing":
                            return "border-primary/50 bg-primary/10";
                          case "skipped":
                            return "border-slate-500/30 bg-slate-500/5";
                          default:
                            return "border-white/[0.08] bg-white/[0.02]";
                        }
                      };

                      return (
                        <div
                          key={imageItem.id}
                          className={`p-4 rounded-lg border ${getStatusColor()} transition-colors`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/[0.08]">
                              <img
                                src={imageItem.dataUrl}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon()}
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      Image {index + 1}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {imageItem.file.name}
                                    </p>
                                  </div>
                                </div>
                                {!isProcessingBulk &&
                                  imageItem.status !== "processing" && (
                                    <div className="flex gap-2">
                                      {imageItem.status === "failed" && (
                                        <Button
                                          onClick={() =>
                                            retryBulkImage(imageItem.id)
                                          }
                                          variant="outline"
                                          size="sm"
                                          className="h-8 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                          Retry
                                        </Button>
                                      )}
                                      {(imageItem.status === "pending" ||
                                        imageItem.status === "failed") && (
                                        <Button
                                          onClick={() =>
                                            skipBulkImage(imageItem.id)
                                          }
                                          variant="outline"
                                          size="sm"
                                          className="h-8 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                                        >
                                          Skip
                                        </Button>
                                      )}
                                      <Button
                                        onClick={() =>
                                          removeBulkImage(imageItem.id)
                                        }
                                        variant="outline"
                                        size="sm"
                                        className="h-8 bg-white/[0.03] hover:bg-red-500/10 border-white/[0.08] text-red-400"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  )}
                              </div>

                              {/* Status Message */}
                              {imageItem.status === "success" &&
                                imageItem.extractedData && (
                                  <div className="mt-2 p-3 bg-white/[0.03] rounded border border-white/[0.08] space-y-2">
                                    <p className="text-xs text-slate-400 mb-2">
                                      Extracted data (editable):
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                          Handle
                                        </label>
                                        <Input
                                          value={imageItem.extractedData.handle}
                                          onChange={(e) =>
                                            updateExtractedData(
                                              imageItem.id,
                                              "handle",
                                              e.target.value
                                            )
                                          }
                                          className="h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white"
                                          placeholder="@username"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                          Followers
                                        </label>
                                        <Input
                                          value={
                                            imageItem.extractedData.followers
                                          }
                                          onChange={(e) =>
                                            updateExtractedData(
                                              imageItem.id,
                                              "followers",
                                              e.target.value
                                            )
                                          }
                                          className="h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white"
                                          placeholder="125K"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                          Contact
                                        </label>
                                        <Input
                                          value={
                                            imageItem.extractedData.contact
                                          }
                                          onChange={(e) =>
                                            updateExtractedData(
                                              imageItem.id,
                                              "contact",
                                              e.target.value
                                            )
                                          }
                                          className="h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white"
                                          placeholder="Email"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                          Niche
                                        </label>
                                        <Input
                                          value={imageItem.extractedData.niche}
                                          onChange={(e) =>
                                            updateExtractedData(
                                              imageItem.id,
                                              "niche",
                                              e.target.value
                                            )
                                          }
                                          className="h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white"
                                          placeholder="Fashion, Tech"
                                        />
                                      </div>
                                    </div>
                                    {imageItem.platform && (
                                      <p className="text-xs text-slate-500 mt-2">
                                        Platform: {imageItem.platform}
                                      </p>
                                    )}
                                  </div>
                                )}

                              {imageItem.status === "failed" &&
                                imageItem.error && (
                                  <div className="mt-2 p-3 bg-red-500/10 rounded border border-red-500/20">
                                    <p className="text-xs text-red-400">
                                      {imageItem.error}
                                    </p>
                                  </div>
                                )}

                              {imageItem.status === "pending" &&
                                !isProcessingBulk && (
                                  <p className="text-xs text-slate-500 mt-2">
                                    Waiting to process...
                                  </p>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Summary */}
          {showSummary && (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Processing Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-400">
                      {processingStats.success}
                    </div>
                    <div className="text-sm text-slate-400">Saved</div>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="text-2xl font-bold text-red-400">
                      {processingStats.failed}
                    </div>
                    <div className="text-sm text-slate-400">Failed</div>
                  </div>
                  <div className="p-4 bg-slate-500/10 rounded-lg border border-slate-500/20">
                    <div className="text-2xl font-bold text-slate-400">
                      {processingStats.skipped}
                    </div>
                    <div className="text-sm text-slate-400">Skipped</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setUploadedImages([]);
                      setShowSummary(false);
                      setProcessingStats({
                        total: 0,
                        success: 0,
                        failed: 0,
                        skipped: 0,
                      });
                    }}
                    className="flex-1 h-10 bg-primary hover:bg-primary/90 text-black"
                    style={{
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    Upload More
                  </Button>
                  <Button
                    onClick={() => onNavigate("/creators")}
                    variant="outline"
                    className="flex-1 h-10 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                  >
                    Back to Library
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
