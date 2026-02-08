import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Upload, X, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCreateCampaign, useCampaigns } from '../../hooks/useCampaigns';
import * as storageApi from '../../lib/api/storage';
import type { CampaignInsert } from '../../lib/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { UpgradeModal } from './upgrade-modal';

interface CampaignCreateProps {
  onNavigate: (path: string) => void;
}

export function CampaignCreate({ onNavigate }: CampaignCreateProps) {
  const location = useLocation();
  const { canViewWorkspace } = useWorkspaceAccess();
  const locationState = location.state as { parentCampaignId?: string } | null;
  const parentFromState = locationState?.parentCampaignId || null;
  const searchParams = new URLSearchParams(location.search);
  const parentFromQuery = searchParams.get('parent');
  const initialParentId = parentFromState || parentFromQuery || null;

  if (!canViewWorkspace) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/campaigns')}
            className="w-11 h-11 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Read-only access
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You do not have permission to create campaigns.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    name: '',
    brandName: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [parentCampaignId, setParentCampaignId] = useState<string | null>(
    initialParentId
  );
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const showParentSelect = Boolean(initialParentId);
  const { data: campaigns = [] } = useCampaigns();

  const createCampaignMutation = useCreateCampaign();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, coverImage: 'File must be an image' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, coverImage: 'File size must be less than 5MB' });
        return;
      }

      setCoverImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Clear any previous error
      const { coverImage, ...restErrors } = errors;
      setErrors(restErrors);
    }
  };

  const removeCoverImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    }
    
    if (!formData.brandName.trim()) {
      newErrors.brandName = 'Brand name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsUploading(true);

    try {
      // Upload cover image first (if exists)
      let coverImageUrl: string | null = null;
      if (coverImageFile) {
        const uploadResult = await storageApi.uploadCampaignCover(coverImageFile);
        if (uploadResult.error) {
          setErrors({ ...errors, coverImage: uploadResult.error.message });
          setIsUploading(false);
          return;
        }
        coverImageUrl = uploadResult.data;
      }

      // Create campaign data
      const campaignData: CampaignInsert = {
        name: formData.name,
        brand_name: formData.brandName || null,
        cover_image_url: coverImageUrl,
        status: 'active',
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        notes: formData.notes || null,
        parent_campaign_id: parentCampaignId || null,
        user_id: ''
      };

      // Create campaign
      const result = await createCampaignMutation.mutateAsync(campaignData);

      if (result && result.id) {
        // Small delay to ensure query cache is updated
        setTimeout(() => {
          // Navigate to the new campaign detail page
          onNavigate(`/campaigns/${result.id}`);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      // The mutation's onError handler will show the toast, but we can also set form-level error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign';
      if (errorMessage.includes('UPGRADE_REQUIRED:campaign_limit_reached')) {
        setUpgradeMessage('Upgrade to create more active campaigns.');
        setUpgradeOpen(true);
        return;
      }
      setErrors({ ...errors, submit: errorMessage });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    onNavigate('/campaigns');
  };

  const formatDateLabel = (value: string) => {
    if (!value) return 'Select date';
    try {
      return format(parseISO(value), 'MMM d, yyyy');
    } catch {
      return 'Select date';
    }
  };

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeOpen}
        title="Upgrade Required"
        message={upgradeMessage || 'Upgrade your plan to create more campaigns.'}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => onNavigate('/subscription')}
      />
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={handleCancel}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Create Campaign</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Set up a new campaign to track your creator partnerships</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-5">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Campaign Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Summer Launch 2024"
                    className={`h-10 bg-muted/40 border-border text-foreground ${errors.name ? 'border-red-500' : ''}`}
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1.5">{errors.name}</p>
                  )}
                </div>

                {/* Brand Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Brand Name / Artist <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="e.g., Nike, Taylor Swift"
                    className={`h-10 bg-muted/40 border-border text-foreground ${errors.brandName ? 'border-red-500' : ''}`}
                  />
                  {errors.brandName && (
                    <p className="text-red-400 text-xs mt-1.5">{errors.brandName}</p>
                  )}
                </div>

                {/* Parent Campaign (optional) */}
                {showParentSelect && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Parent Campaign (optional)
                    </label>
                    <Select
                      value={parentCampaignId || 'none'}
                      onValueChange={(value) =>
                        setParentCampaignId(value === 'none' ? null : value)
                      }
                    >
                      <SelectTrigger className="h-10 bg-muted/40 border-border text-foreground">
                        <SelectValue placeholder="Select a parent campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No parent</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Parent campaigns group related subcampaigns under one view.
                    </p>
                  </div>
                )}

                {/* Date Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Start Date
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-10 w-full rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-muted-foreground flex items-center justify-between px-3 transition-colors"
                        >
                          <span className={formData.startDate ? 'text-foreground' : 'text-muted-foreground'}>
                            {formatDateLabel(formData.startDate)}
                          </span>
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            formData.startDate ? parseISO(formData.startDate) : undefined
                          }
                          onSelect={(date) => {
                            setFormData({
                              ...formData,
                              startDate: date ? format(date, 'yyyy-MM-dd') : '',
                            });
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      End Date
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-10 w-full rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-muted-foreground flex items-center justify-between px-3 transition-colors"
                        >
                          <span className={formData.endDate ? 'text-foreground' : 'text-muted-foreground'}>
                            {formatDateLabel(formData.endDate)}
                          </span>
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            formData.endDate ? parseISO(formData.endDate) : undefined
                          }
                          onSelect={(date) => {
                            setFormData({
                              ...formData,
                              endDate: date ? format(date, 'yyyy-MM-dd') : '',
                            });
                          }}
                          disabled={
                            formData.startDate
                              ? [{ before: parseISO(formData.startDate) }]
                              : undefined
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes / Brief
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Campaign objectives, target audience, key messages..."
                    rows={4}
                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Cover Image */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Cover Image (Optional)
                </label>
                {!coverImagePreview ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="cover-upload"
                    />
                    <label htmlFor="cover-upload" className="cursor-pointer">
                      <div className="w-12 h-12 mx-auto mb-3 bg-muted/40 rounded-lg flex items-center justify-center">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">Upload image</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                    </label>
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={coverImagePreview}
                      alt="Cover preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeCoverImage}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/80 hover:bg-red-500 rounded-md transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {errors.coverImage && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.coverImage}</p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              {errors.submit && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{errors.submit}</p>
                </div>
              )}
              <Button
                type="submit"
                disabled={isUploading || createCampaignMutation.isPending}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading || createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading || createCampaignMutation.isPending}
                className="w-full h-10 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
