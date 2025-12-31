# Auto-Scraping Database Setup Files

This directory contains SQL scripts to set up automatic daily scraping.

## Setup Order

Run these scripts in order:

### 1. `setup_auto_scraping.sql`
   - Enables pg_cron and http extensions
   - Creates the trigger function
   - Schedules the cron job
   - Creates performance indexes
   - **Run this first**

### 2. `configure_auto_scraping.sql`
   - Sets your Supabase URL and service role key
   - **Edit this file first** - replace placeholder values with your actual values
   - Then run it in Supabase SQL Editor

### 3. `verify_auto_scraping.sql`
   - Verifies all components are configured correctly
   - Shows status of extensions, functions, cron jobs, and settings
   - **Run this to confirm everything is working**

## Quick Start

1. **Get your credentials:**
   - Supabase URL: Dashboard → Settings → API → Project URL
   - Service Role Key: Dashboard → Settings → API → Service Role key

2. **Edit `configure_auto_scraping.sql`:**
   - Replace `https://ucbueapoexnxhttynfzy.supabase.co` with your URL
   - Replace the service role key with your actual key

3. **Run in Supabase SQL Editor:**
   ```sql
   -- Step 1: Run setup
   -- Copy/paste contents of setup_auto_scraping.sql and run
   
   -- Step 2: Configure
   -- Copy/paste contents of configure_auto_scraping.sql and run
   
   -- Step 3: Verify
   -- Copy/paste contents of verify_auto_scraping.sql and run
   ```

## Files Overview

- **setup_auto_scraping.sql** - Main setup script (run first)
- **configure_auto_scraping.sql** - Configuration script (edit values, then run)
- **verify_auto_scraping.sql** - Verification script (run to check setup)

## Troubleshooting

If verification fails:
- Check that pg_cron extension is enabled
- Verify database settings are configured
- Check cron job is active
- Review error messages in verification output

For detailed troubleshooting, see `../AUTO_SCRAPING_SETUP.md`






