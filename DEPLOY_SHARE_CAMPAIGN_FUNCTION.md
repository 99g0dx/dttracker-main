# Deploy Share Campaign Edge Function

There are two ways to deploy the Edge Function:

## Option 1: Deploy via Supabase Dashboard (Recommended - No Docker Required)

1. **Open your Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to Edge Functions**
   - Click on **"Edge Functions"** in the left sidebar
   - Click **"Create a new function"** or **"New Function"**

3. **Create the Function**
   - Function name: `share-campaign`
   - Click **"Create function"**

4. **Copy the Code**
   - Delete the default code in the editor
   - Copy the entire contents of `supabase/functions/share-campaign/index.ts`
   - Paste it into the editor

5. **Set Environment Variables**
   - In the function settings, add these environment variables:
     - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
     - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from Settings → API → service_role key)
   
   **Important**: Never expose the service role key publicly. It's only used server-side.

6. **Deploy**
   - Click **"Deploy"** button

## Option 2: Deploy via Supabase CLI (Requires Docker)

If you prefer using the CLI, you need to:

1. **Install Docker Desktop**
   - Download from https://www.docker.com/products/docker-desktop
   - Make sure Docker is running

2. **Link Your Project** (if not already linked)
   ```bash
   cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
   supabase link --project-ref <your-project-ref>
   ```
   You can find your project ref in the Supabase dashboard URL or Settings → General.

3. **Set Environment Variables**
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
   Get your service role key from Settings → API in the Supabase dashboard.

4. **Deploy**
   ```bash
   supabase functions deploy share-campaign
   ```

## Verify Deployment

After deploying, test the function:

1. **Get a share token** from your database (if you have one enabled)
   ```sql
   SELECT share_token FROM campaigns WHERE share_enabled = true LIMIT 1;
   ```

2. **Test the endpoint**:
   ```bash
   curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/share-campaign?token=YOUR_TOKEN"
   ```

   Or test in your browser:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/share-campaign?token=YOUR_TOKEN
   ```

   Replace `YOUR_PROJECT_REF` with your actual Supabase project reference ID.

## Troubleshooting

### "Docker is not running"
- Use Option 1 (Dashboard) instead, or start Docker Desktop

### "Entrypoint path does not exist"
- Make sure you're in the project root directory
- Verify the file exists: `ls -la supabase/functions/share-campaign/index.ts`

### "Function not found" after deployment
- Check the function name matches exactly: `share-campaign`
- Verify it's deployed in the Supabase dashboard under Edge Functions

### "Server configuration error" when calling the function
- Verify environment variables are set in the Supabase dashboard
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly (starts with `eyJ...`)

## Next Steps

After deploying:
1. Run the database migration (`database/add_campaign_share_fields.sql`)
2. Test enabling sharing on a campaign
3. Test accessing the shared dashboard via the generated link



