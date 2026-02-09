import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CreatorRequestQuote {
  id: string;
  campaign_type: string;
  campaign_brief: string;
  quoted_amount: number;
  creator_response_message: string | null;
  quote_received_at: string;
  quote_status: 'pending' | 'accepted' | 'declined' | 'countered';
  posts_per_creator: number;
  deadline: string;
  urgency: string;
  creator_request_items: Array<{
    id: string;
    quoted_amount_cents: number;
    quoted_currency: string;
    quote_notes: string | null;
    quoted_at: string;
    status: string;
    creators: {
      id: string;
      name: string;
      handle: string;
      platform: string;
    };
  }>;
}

export function CreatorRequestQuotes() {
  const [quotes, setQuotes] = useState<CreatorRequestQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingQuote, setProcessingQuote] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingQuotes();
  }, []);

  async function fetchPendingQuotes() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('creator_requests')
        .select(`
          id,
          campaign_type,
          campaign_brief,
          quoted_amount,
          creator_response_message,
          quote_received_at,
          quote_status,
          posts_per_creator,
          deadline,
          urgency,
          creator_request_items (
            id,
            quoted_amount_cents,
            quoted_currency,
            quote_notes,
            quoted_at,
            status,
            creators (
              id,
              name,
              handle,
              platform
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('quote_received', true)
        .eq('quote_status', 'pending')
        .order('quote_received_at', { ascending: false });

      if (error) throw error;

      setQuotes(data || []);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      toast.error('Failed to load creator quotes');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptQuote(quoteId: string, quotedAmount: number, creatorId: string) {
    try {
      console.log('=== ACCEPT QUOTE START ===', { quoteId, quotedAmount, creatorId });
      setProcessingQuote(quoteId);

      // Get current user for review tracking
      const { data: { user } } = await supabase.auth.getUser();
      console.log('User authenticated:', user?.id);
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Update quote status in creator_requests table
      console.log('Updating creator_requests table...');
      const { data: updatedRequest, error: requestError, count } = await supabase
        .from('creator_requests')
        .update({
          quote_status: 'accepted',
          quote_reviewed_at: new Date().toISOString(),
          quote_reviewed_by: user.id,
        })
        .eq('id', quoteId)
        .select();

      console.log('creator_requests update result:', {
        updatedRequest,
        requestError,
        count,
        rowsAffected: updatedRequest?.length || 0
      });

      if (requestError) throw requestError;

      if (!updatedRequest || updatedRequest.length === 0) {
        console.error('WARNING: creator_requests update affected 0 rows! RLS might be blocking.');
        toast.error('Failed to update quote - permission denied');
        return;
      }

      // Update creator_request_items table for this specific creator
      console.log('Updating creator_request_items table...');
      const { data: updatedItem, error: itemError } = await supabase
        .from('creator_request_items')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', quoteId)
        .eq('creator_id', creatorId)
        .select();

      console.log('creator_request_items update result:', {
        updatedItem,
        itemError,
        rowsAffected: updatedItem?.length || 0
      });

      if (itemError) {
        console.error('Failed to update creator_request_items:', itemError);
        // Don't fail - the main table was updated
      }

      if (!updatedItem || updatedItem.length === 0) {
        console.warn('WARNING: creator_request_items update affected 0 rows!');
      }

      // Notify Dobbletap of the decision
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-dobbletap-quote-decision', {
          body: {
            request_id: quoteId,
            creator_id: creatorId,
            decision: 'accepted',
            quoted_amount: quotedAmount,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          }
        });

        if (notifyError) {
          console.error('Failed to notify Dobbletap:', notifyError);
          // Don't fail - database was updated successfully
        }
      } catch (notifyErr) {
        console.error('Error notifying Dobbletap:', notifyErr);
        // Continue - notification failure shouldn't block the UI
      }

      toast.success('Quote accepted! Creator will be notified.');

      // Refresh the list
      await fetchPendingQuotes();

    } catch (err) {
      console.error('Error accepting quote:', err);
      toast.error('Failed to accept quote');
    } finally {
      setProcessingQuote(null);
    }
  }

  async function handleDeclineQuote(quoteId: string, creatorId: string) {
    try {
      setProcessingQuote(quoteId);

      // Get current user for review tracking
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Update quote status in creator_requests table
      const { error: requestError } = await supabase
        .from('creator_requests')
        .update({
          quote_status: 'declined',
          quote_reviewed_at: new Date().toISOString(),
          quote_reviewed_by: user.id,
        })
        .eq('id', quoteId);

      if (requestError) throw requestError;

      // Update creator_request_items table for this specific creator
      const { error: itemError } = await supabase
        .from('creator_request_items')
        .update({
          status: 'declined',
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', quoteId)
        .eq('creator_id', creatorId);

      if (itemError) {
        console.error('Failed to update creator_request_items:', itemError);
        // Don't fail - the main table was updated
      }

      // Notify Dobbletap of the decision
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-dobbletap-quote-decision', {
          body: {
            request_id: quoteId,
            creator_id: creatorId,
            decision: 'declined',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          }
        });

        if (notifyError) {
          console.error('Failed to notify Dobbletap:', notifyError);
          // Don't fail - database was updated successfully
        }
      } catch (notifyErr) {
        console.error('Error notifying Dobbletap:', notifyErr);
        // Continue - notification failure shouldn't block the UI
      }

      toast.success('Quote declined. Creator will be notified.');
      await fetchPendingQuotes();

    } catch (err) {
      console.error('Error declining quote:', err);
      toast.error('Failed to decline quote');
    } finally {
      setProcessingQuote(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading pending quotes...</div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-gray-400 mb-2">No pending creator quotes</div>
        <div className="text-sm text-gray-500">
          Creator quotes will appear here when they respond to your requests
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">
          Pending Creator Quotes ({quotes.length})
        </h2>
        <button
          onClick={fetchPendingQuotes}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Refresh
        </button>
      </div>

      {quotes.map((quote) => {
        const creatorItem = quote.creator_request_items?.[0];
        const creator = creatorItem?.creators;
        const isProcessing = processingQuote === quote.id;

        // Use the per-creator quoted amount (stored in Naira, despite field name)
        const quotedAmountNaira = creatorItem?.quoted_amount_cents || quote.quoted_amount;

        return (
          <div
            key={quote.id}
            className="bg-gray-800 rounded-lg p-6 border border-gray-700"
          >
            {/* Creator Info */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {creator?.name || 'Unknown Creator'}
                </h3>
                <p className="text-sm text-gray-400">
                  @{creator?.handle || 'N/A'} • {creator?.platform || 'N/A'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-400">
                  ₦{quotedAmountNaira?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(quote.quote_received_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Campaign Details */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-900 rounded">
              <div>
                <div className="text-xs text-gray-500">Campaign Type</div>
                <div className="text-sm text-white">{quote.campaign_type}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Posts Required</div>
                <div className="text-sm text-white">{quote.posts_per_creator}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Deadline</div>
                <div className="text-sm text-white">
                  {new Date(quote.deadline).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Urgency</div>
                <div className="text-sm text-white capitalize">{quote.urgency}</div>
              </div>
            </div>

            {/* Creator Message */}
            {quote.creator_response_message && (
              <div className="mb-4 p-4 bg-blue-900/20 border border-blue-800 rounded">
                <div className="text-xs text-blue-400 mb-1">Message from Creator</div>
                <div className="text-sm text-white whitespace-pre-wrap">
                  {quote.creator_response_message}
                </div>
              </div>
            )}

            {/* Campaign Brief */}
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Campaign Brief</div>
              <div className="text-sm text-gray-300 line-clamp-2">
                {quote.campaign_brief}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleAcceptQuote(quote.id, quote.quoted_amount, creator?.id)}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-4 rounded font-medium transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Accept Quote'}
              </button>
              <button
                onClick={() => handleDeclineQuote(quote.id, creator?.id)}
                disabled={isProcessing}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded font-medium transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Decline'}
              </button>
              <button
                onClick={() => {
                  // TODO: Implement counter-offer modal
                  toast.info('Counter-offer feature coming soon');
                }}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-600 hover:border-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed text-gray-300 rounded font-medium transition-colors"
              >
                Counter-Offer
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
