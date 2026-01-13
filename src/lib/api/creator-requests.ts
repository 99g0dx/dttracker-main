import { supabase } from '../supabase';
import type {
  CreatorRequest,
  CreatorRequestInsert,
  CreatorRequestUpdate,
  CreatorRequestWithCreators,
  CreatorRequestWithItems,
  ApiResponse,
  ApiListResponse,
  Creator,
} from '../types/database';

/**
 * Create a new creator request with associated creators
 */
export async function createRequest(
  request: CreatorRequestInsert
): Promise<ApiResponse<CreatorRequestWithCreators>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Extract creator_ids before inserting the request
    const creatorIds = request.creator_ids || [];
    const { creator_ids, ...requestData } = request;

    // Insert the request
    const { data: createdRequest, error: requestError } = await supabase
      .from('creator_requests')
      .insert({
        ...requestData,
        user_id: user.id,
      })
      .select()
      .single();

    if (requestError || !createdRequest) {
      console.error('Error creating creator request:', requestError);
      console.error('Error details:', {
        message: requestError?.message,
        details: requestError?.details,
        hint: requestError?.hint,
        code: requestError?.code
      });
      
      // Provide more helpful error messages
      if (requestError?.message?.includes('does not exist') || requestError?.message?.includes('schema cache')) {
        return { 
          data: null, 
          error: new Error(
            'Creator requests table not found. Please run database/migrations/add_creator_requests.sql ' +
            'or database/fix_creator_requests_quick.sql in Supabase SQL Editor. ' +
            'See FIX_CREATOR_REQUESTS_TABLE.md for instructions.'
          ) 
        };
      }
      
      return { data: null, error: requestError || new Error('Failed to create request') };
    }

    // Insert request items (creator associations)
    if (creatorIds.length > 0) {
      const items = creatorIds.map(creatorId => ({
        request_id: createdRequest.id,
        creator_id: creatorId,
      }));

      const { error: itemsError } = await supabase
        .from('creator_request_items')
        .insert(items);

      if (itemsError) {
        console.error('Error creating request items:', itemsError);
        // If items fail, we should probably rollback the request, but for now just log
        // In production, you'd want to use a transaction
      }
    }

    // Send email notification to agency (don't fail request creation if email fails)
    // Send email notification to agency (don't fail request creation if email fails)
  try {
    const { data, error } = await supabase.functions.invoke('create-creator-request', {
      body: {
        request_id: createdRequest.id,
      },
    });
    
    if (error) {
      console.error('Email notification error:', error);
    } else {
      console.log('Email notification sent successfully:', data);
    }
  } catch (emailError) {
    console.error('Failed to send email notification to agency:', emailError);
    // Don't throw - request was created successfully, email is secondary
  }

    // Fetch the request with creators
    return await getRequestWithCreators(createdRequest.id);
  } catch (err) {
    console.error('Error in createRequest:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get all creator requests for the current user
 */
export async function getRequests(): Promise<ApiListResponse<CreatorRequest>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data: requests, error } = await supabase
      .from('creator_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator requests:', error);
      return { data: null, error };
    }

    return { data: requests || [], error: null, count: requests?.length || 0 };
  } catch (err) {
    console.error('Error in getRequests:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get a single creator request by ID
 */
export async function getRequestById(id: string): Promise<ApiResponse<CreatorRequest>> {
  try {
    const { data, error } = await supabase
      .from('creator_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching creator request:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in getRequestById:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get a creator request with associated creators
 */
export async function getRequestWithCreators(
  id: string
): Promise<ApiResponse<CreatorRequestWithCreators>> {
  try {
    // Fetch the request
    const requestResult = await getRequestById(id);
    if (requestResult.error || !requestResult.data) {
      return requestResult as ApiResponse<CreatorRequestWithCreators>;
    }

    // Fetch request items with creator details
    const { data: items, error: itemsError } = await supabase
      .from('creator_request_items')
      .select(`
        id,
        creator_id,
        created_at,
        creators:creator_id (
          id,
          name,
          handle,
          platform,
          follower_count,
          avg_engagement,
          niche,
          location
        )
      `)
      .eq('request_id', id);

    if (itemsError) {
      console.error('Error fetching request items:', itemsError);
      return { data: null, error: itemsError };
    }

    // Transform the data
    const creators: Creator[] = (items || []).map((item: any) => item.creators).filter(Boolean);

    return {
      data: {
        ...requestResult.data,
        creators,
      },
      error: null,
    };
  } catch (err) {
    console.error('Error in getRequestWithCreators:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get a creator request with full items details
 */
export async function getRequestWithItems(
  id: string
): Promise<ApiResponse<CreatorRequestWithItems>> {
  try {
    // Fetch the request
    const requestResult = await getRequestById(id);
    if (requestResult.error || !requestResult.data) {
      return requestResult as ApiResponse<CreatorRequestWithItems>;
    }

    // Fetch request items with creator details
    const { data: items, error: itemsError } = await supabase
      .from('creator_request_items')
      .select(`
        id,
        creator_id,
        created_at,
        creators:creator_id (
          id,
          name,
          handle,
          platform,
          follower_count,
          avg_engagement,
          niche,
          location,
          email,
          phone
        )
      `)
      .eq('request_id', id);

    if (itemsError) {
      console.error('Error fetching request items:', itemsError);
      return { data: null, error: itemsError };
    }

    // Transform the data
    const itemsWithCreators = (items || []).map((item: any) => ({
      id: item.id,
      creator: item.creators,
      created_at: item.created_at,
    }));

    return {
      data: {
        ...requestResult.data,
        items: itemsWithCreators,
      },
      error: null,
    };
  } catch (err) {
    console.error('Error in getRequestWithItems:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Update a creator request (users can only update their own requests and only certain fields)
 */
export async function updateRequest(
  id: string,
  updates: CreatorRequestUpdate
): Promise<ApiResponse<CreatorRequest>> {
  try {
    const { data, error } = await supabase
      .from('creator_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating creator request:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in updateRequest:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Update request status (typically called by admin/service role)
 */
export async function updateRequestStatus(
  id: string,
  status: CreatorRequest['status'],
  quoteAmount?: number,
  quoteDetails?: Record<string, any>
): Promise<ApiResponse<CreatorRequest>> {
  try {
    const updateData: any = { status };
    if (quoteAmount !== undefined) {
      updateData.quote_amount = quoteAmount;
    }
    if (quoteDetails !== undefined) {
      updateData.quote_details = quoteDetails;
    }

    const { data, error } = await supabase
      .from('creator_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating request status:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in updateRequestStatus:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a creator request (users can only delete their own requests)
 * Sends email notification to agency before deletion
 */
export async function deleteRequest(id: string): Promise<ApiResponse<void>> {
  try {
    // Send email notification to agency (don't fail deletion if email fails)
    try {
      await supabase.functions.invoke('notify-request-deletion', {
        body: {
          request_id: id,
        },
      });
    } catch (emailError) {
      console.error('Failed to send deletion notification email to agency:', emailError);
      // Don't throw - proceed with deletion even if email fails
    }

    // Items will be deleted automatically due to CASCADE
    const { data: deletedRows, error } = await supabase
      .from('creator_requests')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Error deleting creator request:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      // Provide helpful error message for missing RLS policy
      if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('policy')) {
        return { 
          data: null, 
          error: new Error(
            'Cannot delete request. Missing DELETE policy. Please run database/add_creator_requests_delete_policy.sql in Supabase SQL Editor.'
          ) 
        };
      }
      return { data: null, error };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return {
        data: null,
        error: new Error(
          'Delete failed: no rows were removed. This usually means the request is not owned by your user or the DELETE policy is missing. Run database/add_creator_requests_delete_policy.sql in Supabase.'
        ),
      };
    }

    return { data: null, error: null };
  } catch (err) {
    console.error('Error in deleteRequest:', err);
    return { data: null, error: err as Error };
  }
}
