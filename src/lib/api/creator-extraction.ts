import { supabase } from '../supabase';

export interface CreatorExtraction {
  handle: string;
  followers: string;
  contact: string | null;
  platform: 'tiktok' | 'instagram' | 'youtube' | null;
  location: string | null;
  niche: string | null;
  confidence: {
    handle: number;
    followers: number;
    contact: number;
    platform: number;
    location: number;
    niche: number;
  };
}

export interface ExtractionResult {
  success: boolean;
  data?: CreatorExtraction;
  error?: string;
  raw?: string;
}

/**
 * Extract creator information from profile screenshot using AI
 */
export async function extractCreatorFromImage(
  imageDataUrl: string
): Promise<ExtractionResult> {
  try {
    // Validate image data URL
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      return {
        success: false,
        error: 'Invalid image data URL'
      };
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('extract-creator-info', {
      body: { image: imageDataUrl }
    });

    // Handle Supabase client errors (network errors, non-2xx responses, etc.)
    if (error) {
      console.error('Edge Function invocation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to extraction service'
      };
    }

    // Handle application-level errors from the Edge Function
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Extraction failed'
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error: any) {
    console.error('Creator extraction error:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract creator info'
    };
  }
}

/**
 * Validate extracted data has required fields
 */
export function validateExtraction(data: any): boolean {
  return !!(data?.handle && data?.followers);
}

/**
 * Calculate category from follower count
 */
export function categorizeFollowers(followersString: string): string {
  const parsed = parseFollowerCount(followersString);

  if (parsed < 10000) return 'Nano (<10K)';
  if (parsed < 100000) return 'Micro (10K-100K)';
  if (parsed < 500000) return 'Mid (100K-500K)';
  if (parsed < 1000000) return 'Macro (500K-1M)';
  return 'Mega (1M+)';
}

/**
 * Parse follower count string to number
 * Handles formats like: "125K", "1.2M", "10,000", "1000"
 */
function parseFollowerCount(str: string): number {
  if (!str) return 0;

  const normalized = str.toLowerCase().replace(/,/g, '').trim();

  if (normalized.includes('m')) {
    return parseFloat(normalized) * 1000000;
  }
  if (normalized.includes('k')) {
    return parseFloat(normalized) * 1000;
  }

  return parseInt(normalized) || 0;
}

/**
 * Format follower count for display
 * Converts numbers to K/M format
 */
export function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Calculate average confidence score
 */
export function getAverageConfidence(confidence: CreatorExtraction['confidence']): number {
  const scores = Object.values(confidence);
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): { label: string; color: string } {
  if (score >= 0.8) {
    return { label: 'High', color: 'text-emerald-400' };
  }
  if (score >= 0.6) {
    return { label: 'Medium', color: 'text-yellow-400' };
  }
  return { label: 'Low', color: 'text-red-400' };
}
