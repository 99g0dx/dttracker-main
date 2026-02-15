import { supabase } from '../supabase';
import type { ApiResponse } from '../types/database';

const BUCKET_NAME = 'campaign-covers';
const ACTIVATION_BUCKET = 'activation-covers';

/**
 * Upload a campaign cover image to Supabase Storage
 * Files are stored in folders by user ID: {user_id}/{filename}
 */
export async function uploadCampaignCover(file: File): Promise<ApiResponse<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return { data: null, error: new Error('File must be an image') };
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return { data: null, error: new Error('File size must be less than 5MB') };
    }

    // Create unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = `${user.id}/${filename}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      // Provide better error message for bucket not found
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Bucket not found') || 
        errorMessage.includes('not found') ||
        errorMessage.toLowerCase().includes('bucket')
      ) {
        return { 
          data: null, 
          error: new Error(
            'Storage bucket "campaign-covers" not found. ' +
            'Please create it in your Supabase dashboard: Storage → Buckets → New Bucket. ' +
            'Name it "campaign-covers" and set it to Public. ' +
            'Then run the storage policies SQL from database/schema.sql in the SQL Editor.'
          )
        };
      }
      return { data: null, error };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return { data: publicUrl, error: null };
  } catch (err) {
    // Handle unexpected errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
      return { 
        data: null, 
        error: new Error(
          'Storage bucket "campaign-covers" not found. ' +
          'Please create it in your Supabase dashboard: Storage → Buckets → New Bucket. ' +
          'Name it "campaign-covers" and set it to Public.'
        )
      };
    }
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a campaign cover image from Supabase Storage
 */
export async function deleteCampaignCover(imageUrl: string): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/campaign-covers/{user_id}/{filename}
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const userId = urlParts[urlParts.length - 2];

    // Verify user owns this file
    if (userId !== user.id) {
      return { data: null, error: new Error('Not authorized to delete this file') };
    }

    const filePath = `${userId}/${filename}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Replace a campaign cover image
 * Deletes the old image and uploads a new one
 */
export async function replaceCampaignCover(
  oldImageUrl: string | null,
  newFile: File
): Promise<ApiResponse<string>> {
  try {
    // Upload new image
    const uploadResult = await uploadCampaignCover(newFile);
    if (uploadResult.error || !uploadResult.data) {
      return uploadResult;
    }

    // Delete old image (if exists)
    if (oldImageUrl) {
      await deleteCampaignCover(oldImageUrl);
      // Don't fail if delete fails - the new upload succeeded
    }

    return { data: uploadResult.data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Upload an activation cover image to Supabase Storage
 * Files are stored in folders by user ID: {user_id}/{filename}
 */
export async function uploadActivationImage(file: File): Promise<ApiResponse<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    if (!file.type.startsWith('image/')) {
      return { data: null, error: new Error('File must be an image') };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { data: null, error: new Error('File size must be less than 5MB') };
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = `${user.id}/${filename}`;

    const { data, error } = await supabase.storage
      .from(ACTIVATION_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Bucket not found') ||
        errorMessage.includes('not found') ||
        errorMessage.toLowerCase().includes('bucket')
      ) {
        return {
          data: null,
          error: new Error(
            'Storage bucket "activation-covers" not found. ' +
            'Please create it in your Supabase dashboard: Storage → Buckets → New Bucket. ' +
            'Name it "activation-covers" and set it to Public.'
          ),
        };
      }
      return { data: null, error };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(ACTIVATION_BUCKET)
      .getPublicUrl(data.path);

    return { data: publicUrl, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
      return {
        data: null,
        error: new Error(
          'Storage bucket "activation-covers" not found. ' +
          'Please create it in your Supabase dashboard: Storage → Buckets → New Bucket. ' +
          'Name it "activation-covers" and set it to Public.'
        ),
      };
    }
    return { data: null, error: err as Error };
  }
}

/**
 * Delete an activation cover image from Supabase Storage
 */
export async function deleteActivationImage(imageUrl: string): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const userId = urlParts[urlParts.length - 2];

    if (userId !== user.id) {
      return { data: null, error: new Error('Not authorized to delete this file') };
    }

    const filePath = `${userId}/${filename}`;

    const { error } = await supabase.storage
      .from(ACTIVATION_BUCKET)
      .remove([filePath]);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Replace an activation cover image
 * Uploads the new image first, then deletes the old one
 */
export async function replaceActivationImage(
  oldImageUrl: string | null,
  newFile: File
): Promise<ApiResponse<string>> {
  try {
    const uploadResult = await uploadActivationImage(newFile);
    if (uploadResult.error || !uploadResult.data) {
      return uploadResult;
    }

    if (oldImageUrl) {
      await deleteActivationImage(oldImageUrl);
    }

    return { data: uploadResult.data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
