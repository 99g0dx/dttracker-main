# Localhost URL for Share Campaign Feature

## Development Server URL

When you run `npm run dev`, the app typically runs on:

**http://localhost:5173**

(Or whatever port Vite assigns - check your terminal output)

## Share Link Format

When you enable sharing for a campaign, the share link will be:

```
http://localhost:5173/share/campaign/{TOKEN}
```

Example:
```
http://localhost:5173/share/campaign/abc123def456...
```

## How to Test

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Note the URL** shown in the terminal (usually `http://localhost:5173`)

3. **Enable sharing** on a campaign:
   - Go to a campaign detail page
   - Click "Share Link" button
   - Toggle "Enable view-only link" to ON
   - Copy the share link

4. **Test the share link**:
   - Open the share link in a new browser tab (or incognito window)
   - It should load the shared dashboard without requiring login

## Troubleshooting

### "Share link not found or expired"
- Make sure the campaign has sharing enabled
- Check that the token in the URL matches the `share_token` in your database
- Verify the Edge Function is deployed (see `QUICK_DEPLOY_SHARE_FUNCTION.md`)

### "Failed to fetch shared campaign"
- Check browser console for errors
- Verify `VITE_SUPABASE_URL` is set correctly in your `.env` file
- Make sure the Edge Function is deployed and accessible
- Check Edge Function logs in Supabase dashboard

### Edge Function returns 404
- Verify the function name is exactly `share-campaign` (case-sensitive)
- Check that environment variables are set in the Edge Function settings
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured

