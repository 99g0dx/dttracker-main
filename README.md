# DTTracker - Social Media Campaign Tracker

A comprehensive social media campaign tracking tool built with React, TypeScript, and Supabase. Track campaign performance across TikTok, Instagram, YouTube, Twitter, and Facebook.

## Features

- 🎯 **Campaign Management** - Create and manage multiple campaigns
- 📊 **Performance Tracking** - Track views, likes, comments, shares, and engagement rates
- 🤖 **AI-Powered Scraping** - Automated scraping of social media metrics
- 📈 **Analytics Dashboard** - Visual charts and insights
- 👥 **Creator Library** - Manage and organize creators
- 📥 **CSV Import/Export** - Bulk import/export posts and metrics
- 🔄 **Auto-Scraping** - Scheduled daily scraping of posts

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Radix UI components
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **Scraping APIs**: Apify (TikTok, Instagram, YouTube via streamers/youtube-scraper), RapidAPI (Twitter)

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Apify account (for TikTok, Instagram, and YouTube scraping)
- RapidAPI account (for Twitter scraping)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at https://supabase.com
2. Run the database schema from `database/schema.sql` in Supabase SQL Editor
3. Create storage buckets (each **public**):
   - `campaign-covers` – campaign cover images
   - `activation-covers` – contest/activation cover images
     In Supabase: **Storage → New bucket** → name the bucket → set to **Public**

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set APIFY_TOKEN=your_apify_token
supabase secrets set RAPIDAPI_KEY=your_rapidapi_key
# Optional: YouTube-only Apify token (else APIFY_TOKEN is used for YouTube)
# supabase secrets set APIFY_YOUTUBE_TOKEN=your_apify_youtube_token

# Deploy functions
supabase functions deploy scrape-post
supabase functions deploy scrape-all-posts
supabase functions deploy extract-creator-info
supabase functions deploy share-campaign   # Required for campaign share links to work
supabase functions deploy share_activation  # Required for activation/contest share links
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
├── src/
│   ├── app/              # Main application components
│   ├── components/       # Shared components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utilities and API clients
├── database/             # SQL schema and migrations
├── supabase/
│   └── functions/        # Edge Functions for scraping
└── public/               # Static assets
```

## Key Features

### Campaign Management

- Create campaigns with cover images
- Track campaign start/end dates
- View campaign metrics and analytics
- Export campaign data to CSV

### Post Scraping

- Manual scraping of individual posts
- Bulk scraping of all posts in a campaign
- Support for TikTok, Instagram, YouTube, Twitter
- Automatic metric extraction and calculation

### Creator Library

- Manage creator profiles
- Track follower counts and engagement
- AI-powered creator info extraction from images
- Bulk import via CSV

### Analytics

- Real-time performance metrics
- Time-series charts for trend analysis
- Top performing content identification
- Platform-wise breakdown

## Documentation

- [Database Setup](database/README.md)
- [Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Scraping Setup](SCRAPING_SETUP.md)
- [API Documentation](API_ENDPOINTS_UPDATED.md)

## Deployment

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Environment Variables

Required environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

Edge Function secrets (set via Supabase CLI):

- `RAPIDAPI_KEY` - RapidAPI key for TikTok/Instagram scraping
- `YOUTUBE_API_KEY` - Google Cloud API key for YouTube
- `APIFY_API_TOKEN` - Apify token for TikTok sound scraping
- `SB_URL` or `SUPABASE_URL` - Supabase project URL
- `SB_ANON_KEY` or `SUPABASE_ANON_KEY` - Supabase anon key
- `SB_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## License

Private project - All rights reserved

## Support

For issues and questions, please refer to the troubleshooting guides in the `database/` directory.
