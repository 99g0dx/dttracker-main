# Share View-Only Dashboard Implementation

This document describes the secure share view-only dashboard feature implementation.

## Overview

The feature allows campaign owners to generate public, view-only links to their campaign dashboards. Anyone with the link can view the campaign analytics, posts, and charts, but cannot edit, scrape, import, delete, or add posts.

## Architecture

### Security Model

- **Never expose service role key to browser**: All public share access goes through a Supabase Edge Function that uses the service role key server-side only.
- **Read-only access**: The shared dashboard has no write capabilities - all write endpoints are protected by authentication and ownership checks.
- **Sanitized responses**: The Edge Function returns only safe, public fields - no user IDs, internal flags, or sensitive data.
- **Token-based access**: Share links use cryptographically secure random tokens (48 characters) stored in the database.

### Database Schema

The `campaigns` table has been extended with the following fields:

```sql
share_enabled BOOLEAN NOT NULL DEFAULT false
share_token TEXT UNIQUE
share_created_at TIMESTAMPTZ
share_expires_at TIMESTAMPTZ NULLABLE
share_allow_export BOOLEAN NOT NULL DEFAULT false
```

**Migration**: Run `database/add_campaign_share_fields.sql` in your Supabase SQL Editor.

### Edge Function: `share-campaign`

**Location**: `supabase/functions/share-campaign/index.ts`

**Endpoint**: `GET /functions/v1/share-campaign?token=<token>`

**Responsibilities**:
1. Validates token exists and campaign has sharing enabled
2. Checks expiry if set
3. Fetches sanitized campaign data (no user IDs, internal fields)
4. Returns JSON with campaign, totals, time series, and posts

**Security**:
- Uses Supabase service role key (server-side only)
- Returns 404 for invalid/expired tokens (no information leakage)
- No authentication required (public endpoint)

### API Functions (Client-side)

**Location**: `src/lib/api/campaign-sharing-v2.ts`

**Functions**:
- `enableCampaignShare()` - Enable sharing with optional expiry and export settings
- `regenerateCampaignShareToken()` - Generate new token (invalidates old link)
- `disableCampaignShare()` - Disable sharing
- `getCampaignShareSettings()` - Get current share settings (owner only)
- `fetchSharedCampaignData()` - Fetch shared data via Edge Function (public)

**Security**:
- All management functions require authentication
- Ownership is verified (campaign.user_id must match authenticated user)
- Tokens are generated using `crypto.getRandomValues()` (48 hex characters)

### Frontend Components

#### Share Modal (`CampaignShareModal`)

**Location**: `src/app/components/campaign-share-modal.tsx`

**Features**:
- Toggle to enable/disable sharing
- Copy share link button
- Regenerate link button (invalidates old link)
- Expiry dropdown: Never, 24 hours, 7 days
- Allow export toggle
- Update settings button

**Usage**: Opens when user clicks "Share" button on campaign detail page.

#### Shared Dashboard (`SharedCampaignDashboard`)

**Location**: `src/app/components/shared-campaign-dashboard.tsx`

**Features**:
- Minimal header with "View Only" badge (no sidebar)
- Campaign header with name and brand
- Cover image (if available)
- KPI cards (views, likes, comments, shares)
- Performance charts (time series)
- Posts table with sorting (views, likes, comments, platform, top performer)
- "View Post" links (external)
- No edit/delete/scrape buttons
- Export CSV button (only if `share_allow_export` is true)

**Route**: `/share/campaign/:token`

**Security**:
- No authentication required
- All data fetched via Edge Function (server-side validation)
- No write operations exposed

### Routes

**Location**: `src/app/App.tsx`

The route `/share/campaign/:token` is already configured as a public route (no auth required, no sidebar).

## Setup Instructions

### 1. Database Migration

Run the SQL migration:

```sql
-- Run database/add_campaign_share_fields.sql in Supabase SQL Editor
```

This adds the share fields to the `campaigns` table.

### 2. Deploy Edge Function

Deploy the Edge Function to Supabase:

```bash
# If using Supabase CLI
supabase functions deploy share-campaign

# Make sure these environment variables are set in Supabase dashboard:
# - SUPABASE_URL (auto-set)
# - SUPABASE_SERVICE_ROLE_KEY (from Settings → API → service_role key)
```

### 3. Test the Implementation

1. **Enable sharing**:
   - Go to a campaign detail page
   - Click "Share" button
   - Toggle "Enable view-only link"
   - Copy the generated link

2. **Test shared view**:
   - Open the share link in an incognito/private window
   - Verify dashboard loads without login
   - Verify no edit/delete/scrape buttons are visible
   - Verify charts and posts display correctly

3. **Test expiry**:
   - Set expiry to "24 hours"
   - Wait 24 hours (or manually update `share_expires_at` in DB)
   - Verify link returns 404

4. **Test regenerate**:
   - Regenerate the link
   - Verify old link returns 404
   - Verify new link works

5. **Test disable**:
   - Disable sharing
   - Verify link returns 404

## Security Checklist

- ✅ Service role key never exposed to browser
- ✅ All share management endpoints require authentication
- ✅ Ownership verified for all share operations
- ✅ Public endpoint returns only sanitized data
- ✅ Expired/invalid links return 404 (no information leakage)
- ✅ Token generation uses cryptographically secure random values
- ✅ Shared view has no write capabilities
- ✅ No internal fields (user_id, etc.) in shared data

## API Response Format

The Edge Function returns:

```json
{
  "campaign": {
    "id": "uuid",
    "name": "Campaign Name",
    "brand_name": "Brand Name",
    "status": "active",
    "coverImageUrl": "https://...",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "totals": {
    "views": 10000,
    "likes": 1000,
    "comments": 100,
    "shares": 50
  },
  "series": {
    "views": [{"date": "2024-01-01", "value": 1000}, ...],
    "likes": [{"date": "2024-01-01", "value": 100}, ...],
    "comments": [{"date": "2024-01-01", "value": 10}, ...],
    "shares": [{"date": "2024-01-01", "value": 5}, ...]
  },
  "posts": [
    {
      "id": "uuid",
      "platform": "tiktok",
      "postUrl": "https://...",
      "status": "scraped",
      "views": 1000,
      "likes": 100,
      "comments": 10,
      "shares": 5,
      "engagementRate": 11.5,
      "postedDate": "2024-01-01",
      "createdAt": "2024-01-01T00:00:00Z",
      "creator": {
        "id": "uuid",
        "name": "Creator Name",
        "handle": "creator_handle"
      }
    }
  ],
  "share": {
    "allowExport": false
  }
}
```

## Future Enhancements

- Password protection for share links
- Analytics on share link usage (views, unique visitors)
- Custom branding for shared dashboards
- Email notifications when share links are accessed
- Advanced export options (PDF, Excel)



