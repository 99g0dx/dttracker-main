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
- **Scraping APIs**: RapidAPI (TikTok, Instagram), YouTube Data API v3

## Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account
- RapidAPI account (for social media scraping)
- Google Cloud account (for YouTube API)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at https://supabase.com
2. Run the database schema from `database/schema.sql` in Supabase SQL Editor
3. Create a storage bucket named `campaign-covers` (public)

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
supabase secrets set RAPIDAPI_KEY=your_rapidapi_key
supabase secrets set YOUTUBE_API_KEY=your_youtube_key

# Deploy functions
supabase functions deploy scrape-post
supabase functions deploy scrape-all-posts
supabase functions deploy extract-creator-info
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

## License

Private project - All rights reserved

## Support

For issues and questions, please refer to the troubleshooting guides in the `database/` directory.
