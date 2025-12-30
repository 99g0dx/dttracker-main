# Phase 1 Setup Instructions

## ✅ Phase 1 Complete: "It runs"

All foundation work is complete. Follow these steps to get the app running.

## Prerequisites

1. **Node.js** installed (v18+ recommended)
2. **Supabase account** (sign up at https://supabase.com)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `@tanstack/react-query` - State management
- `react-router-dom` - Routing

### 2. Set Up Supabase

1. **Create a Supabase project** at https://app.supabase.com
2. **Run the database schema**:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `database/schema.sql`
   - Click "Run"
3. **Get your API keys**:
   - Go to Settings → API
   - Copy your Project URL and anon/public key

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Start the Development Server

```bash
npm run dev
```

The app should now be running at `http://localhost:5173` (or the port Vite assigns).

## What's Been Implemented

### ✅ Supabase Setup
- Client configuration in `src/lib/supabase.ts`
- Environment variable validation
- Auto-refresh tokens and session persistence

### ✅ React Query Setup
- Query client configured in `src/lib/query-client.ts`
- Provider wired in `src/main.tsx`
- Default query options (5min stale time, no refetch on focus)

### ✅ Authentication
- `AuthContext` in `src/contexts/AuthContext.tsx`
- Session management with Supabase
- Auto-sync with auth state changes

### ✅ Routing
- React Router configured
- Public routes: `/home`, `/login`, `/signup`, `/verification`
- Protected routes: All `/app/*` routes require authentication
- `ProtectedRoute` component with loading states and redirects

### ✅ Auth Pages
- **Login**: Full Supabase integration with error handling
- **Signup**: Creates user + profile, handles email confirmation
- **Verification**: Supports both OTP codes and email confirmation links

### ✅ App Shell
- Consistent spacing: `lg:ml-64 p-4 sm:p-6 lg:p-8`
- Max-width container: `max-w-7xl mx-auto`
- Sidebar + topbar layout maintained

## Testing Checklist

### Sign Up Flow
- [ ] Go to `/home`
- [ ] Click "Get Started" or navigate to `/signup`
- [ ] Fill out signup form
- [ ] Submit and verify account creation
- [ ] If email confirmation enabled: Check email and verify
- [ ] If email confirmation disabled: Should redirect to `/` (dashboard)

### Login Flow
- [ ] Navigate to `/login`
- [ ] Enter credentials
- [ ] Submit and verify successful login
- [ ] Should redirect to `/` (dashboard)

### Protected Routes
- [ ] While logged out, try accessing `/` or `/campaigns`
- [ ] Should redirect to `/login`
- [ ] After login, should access protected routes

### Session Persistence
- [ ] Log in
- [ ] Refresh the page
- [ ] Should stay logged in (no redirect to login)

### Logout
- [ ] Click "Sign out" in sidebar
- [ ] Should redirect to `/login`
- [ ] Try accessing protected route → should redirect to login

## Known Limitations (Will be addressed in later phases)

- Profile creation is automatic but basic (only full_name from metadata)
- No campaign/creator/post tables yet (Phase 3+)
- Permissions system still uses localStorage (will migrate to Supabase in later phases)

## Next Steps

Once Phase 1 is verified working, you're ready for:
- **Phase 2**: Marketing/Home + Auth pages polish
- **Phase 3**: Campaigns MVP

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env` file exists in project root
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the dev server after creating `.env`

### "Profile not created on signup"
- Check Supabase SQL Editor for errors
- Verify the trigger `on_auth_user_created` exists
- Check `profiles` table in Supabase dashboard

### "Can't access protected routes"
- Check browser console for errors
- Verify Supabase auth is working (check Network tab)
- Ensure session is being stored (check Application → Local Storage)

### "Redirect loop"
- Clear browser localStorage
- Check that AuthContext is properly wrapping the app
- Verify ProtectedRoute logic




