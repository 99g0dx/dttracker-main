# Database Setup Guide

This guide will help you set up the Supabase database for DTTracker.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A new Supabase project created

## Setup Steps

### 1. Create the Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `schema.sql`
5. Click **Run** to execute the SQL

This will create:
- `profiles` table with RLS policies
- Automatic profile creation on user signup
- Timestamp management functions

### 1.5. Create Storage Bucket (Required for Campaign Images)

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Name it: `campaign-covers`
4. Set it to **Public** (toggle the public access switch)
5. Click **Create bucket**
6. After creating the bucket, go back to **SQL Editor** and run the storage policies section from `schema.sql` (lines 680-753) to set up the proper access policies

### 2. Configure Authentication

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Configure email settings:
   - **Enable Email Confirmations**: Toggle based on your preference
     - If enabled: Users must verify email before accessing the app
     - If disabled: Users can access immediately after signup
3. Set up email templates (optional but recommended)

### 3. Get Your API Keys

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (this is your `VITE_SUPABASE_URL`)
   - **anon/public key** (this is your `VITE_SUPABASE_ANON_KEY`)

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env` in the project root
2. Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Test the Setup

1. Run `npm install` to install dependencies
2. Run `npm run dev` to start the development server
3. Try signing up a new user
4. Check the `profiles` table in Supabase to verify the profile was created

## Row Level Security (RLS)

All tables have RLS enabled. The current policies allow:
- Users can only view/update their own profile
- Users can insert their own profile

As you add more tables (campaigns, creators, posts, etc.), you'll need to add appropriate RLS policies.

## Next Steps

After Phase 1 is complete, you'll add:
- `campaigns` table
- `creators` table
- `posts` table
- `post_metrics` table
- And more...

Each will have appropriate RLS policies to ensure data security.

## Migrations

### Fix: Add 'scraping' status to posts table

If you're experiencing issues with post scraping failing, you may need to run the migration to add the 'scraping' status:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `fix_scraping_status.sql`
5. Click **Run** to execute the SQL

This migration adds 'scraping' as a valid status value for posts, which is required when posts are being scraped.

