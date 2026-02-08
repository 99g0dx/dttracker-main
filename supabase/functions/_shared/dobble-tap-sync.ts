// Shared utility for syncing data to Dobble Tap
// Handles retry logic, queue management, and error handling

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export type SyncType = 
  | 'activation' 
  | 'activation_update' 
  | 'activation_submission' 
  | 'activation_submission_review'
  | 'creator_request' 
  | 'creator_request_update'
  | 'creator_request_invitation';

export interface SyncPayload {
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  synced: boolean;
  error?: string;
  retryQueued?: boolean;
  dobbleTapId?: string;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Queue a sync operation for retry
 */
async function queueSync(
  supabase: SupabaseClient,
  syncType: SyncType,
  entityId: string,
  payload: SyncPayload,
  error: string,
  retryAfter?: Date
): Promise<void> {
  try {
    await supabase.from('dobble_tap_sync_queue').insert({
      sync_type: syncType,
      entity_id: entityId,
      payload: payload,
      error_message: error,
      retry_count: 0,
      retry_after: retryAfter || new Date(),
      status: 'pending',
    });
  } catch (err) {
    console.error('Failed to queue sync:', err);
  }
}

/**
 * Map internal sync types to Dobbletap webhook event types
 * These are consumed by /webhooks/dttracker in Dobbletap
 */
function getEventTypeForSyncType(syncType: SyncType): string | null {
  const events: Record<SyncType, string> = {
    activation: 'campaign_created',
    activation_update: 'activation_updated',
    activation_submission: 'submission_created',
    activation_submission_review: 'review_decision',
    creator_request: 'creator_request_created',
    creator_request_update: 'creator_request_updated',
    creator_request_invitation: 'offer_sent',
  };
  return events[syncType] || null;
}

/**
 * Sync data to Dobble Tap with automatic retry and queue fallback
 */
export async function syncToDobbleTap(
  supabase: SupabaseClient,
  syncType: SyncType,
  endpoint: string,
  payload: SyncPayload,
  entityId: string,
  options: {
    retryOnFailure?: boolean;
    queueOnFailure?: boolean;
    maxRetries?: number;
  } = {}
): Promise<SyncResult> {
  const dobbleTapApi = Deno.env.get('DOBBLE_TAP_API') ?? '';
  const syncApiKey = Deno.env.get('SYNC_API_KEY') ?? '';

  if (!dobbleTapApi || !syncApiKey) {
    return {
      success: false,
      synced: false,
      error: 'DOBBLE_TAP_API or SYNC_API_KEY not configured',
    };
  }

  const retryOnFailure = options.retryOnFailure ?? true;
  const queueOnFailure = options.queueOnFailure ?? true;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  const eventType = getEventTypeForSyncType(syncType);
  if (!eventType) {
    return {
      success: false,
      synced: false,
      error: `No Dobbletap event mapping for sync type: ${syncType}`,
    };
  }

  const requestBody = {
    eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  };

  let lastError: string | undefined;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(`${dobbleTapApi}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${syncApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          synced: true,
          dobbleTapId:
            data.id ||
            data.dobble_tap_id ||
            data.dobble_tap_request_id ||
            undefined,
        };
      }

      const errorText = await response.text();
      lastError = `HTTP ${response.status}: ${errorText}`;

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        break;
      }

      // Retry on 5xx errors or network failures
      if (attempt < maxRetries && retryOnFailure) {
        const delay = getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      
      if (attempt < maxRetries && retryOnFailure) {
        const delay = getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      break;
    }
  }

  // Queue for manual retry if enabled
  if (queueOnFailure && lastError) {
    const retryAfter = new Date(Date.now() + getRetryDelay(attempt));
    await queueSync(supabase, syncType, entityId, payload, lastError, retryAfter);
    
    return {
      success: false,
      synced: false,
      error: lastError,
      retryQueued: true,
    };
  }

  return {
    success: false,
    synced: false,
    error: lastError,
  };
}

/**
 * Process queued sync operations (for retry worker)
 */
export async function processSyncQueue(
  supabase: SupabaseClient,
  batchSize: number = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const dobbleTapApi = Deno.env.get('DOBBLE_TAP_API') ?? '';
  const syncApiKey = Deno.env.get('SYNC_API_KEY') ?? '';

  if (!dobbleTapApi || !syncApiKey) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Get pending items ready for retry
  const { data: queueItems, error } = await supabase
    .from('dobble_tap_sync_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('retry_after', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error || !queueItems || queueItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of queueItems) {
    const endpoint = getEndpointForSyncType(item.sync_type);
    if (!endpoint) {
      await supabase
        .from('dobble_tap_sync_queue')
        .update({ status: 'failed', error_message: 'Invalid sync type' })
        .eq('id', item.id);
      failed++;
      continue;
    }

    const result = await syncToDobbleTap(
      supabase,
      item.sync_type as SyncType,
      endpoint,
      item.payload,
      item.entity_id,
      { retryOnFailure: false, queueOnFailure: false }
    );

    if (result.success) {
      await supabase
        .from('dobble_tap_sync_queue')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      succeeded++;
    } else {
      const newRetryCount = (item.retry_count || 0) + 1;
      const maxRetries = 5;
      
      if (newRetryCount >= maxRetries) {
        await supabase
          .from('dobble_tap_sync_queue')
          .update({ status: 'failed', error_message: result.error })
          .eq('id', item.id);
        failed++;
      } else {
        const retryAfter = new Date(Date.now() + getRetryDelay(newRetryCount));
        await supabase
          .from('dobble_tap_sync_queue')
          .update({
            retry_count: newRetryCount,
            retry_after: retryAfter.toISOString(),
            error_message: result.error,
          })
          .eq('id', item.id);
        failed++;
      }
    }
  }

  return { processed: queueItems.length, succeeded, failed };
}

/**
 * Get API endpoint for sync type
 */
function getEndpointForSyncType(syncType: SyncType): string | null {
  const endpoints: Record<SyncType, string> = {
    activation: '/webhooks/dttracker',
    activation_update: '/webhooks/dttracker',
    activation_submission: '/webhooks/dttracker',
    activation_submission_review: '/webhooks/dttracker',
    creator_request: '/webhooks/dttracker',
    creator_request_update: '/webhooks/dttracker',
    creator_request_invitation: '/webhooks/dttracker',
  };
  return endpoints[syncType] || null;
}
