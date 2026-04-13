# Auralis AI - Complete Vercel Deployment Guide

**Last Updated:** February 20, 2026  
**Project:** Auralis AI  
**Target Platform:** Vercel (Recommended for Next.js)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Prepare Your Project Locally](#step-1-prepare-your-project-locally)
3. [Step 2: Set Up GitHub Repository](#step-2-set-up-github-repository)
4. [Step 3: Create Vercel Account](#step-3-create-vercel-account)
5. [Step 4: Import Project to Vercel](#step-4-import-project-to-vercel)
6. [Step 5: Configure Environment Variables](#step-5-configure-environment-variables)
7. [Step 6: Deploy Application](#step-6-deploy-application)
8. [Step 7: Verify Deployment](#step-7-verify-deployment)
9. [Step 8: Post-Deployment Configuration](#step-8-post-deployment-configuration)
10. [Troubleshooting](#troubleshooting)
11. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

### Required:

- ✅ GitHub account (free)
- ✅ Vercel account (free tier available)
- ✅ Node.js 18+ installed locally
- ✅ npm or pnpm package manager
- ✅ Google OAuth credentials (Client ID & Secret)
- ✅ Murf AI API Key (optional, for voice features)
- ✅ Google Gemini API Key

### Recommended:

- VS Code or terminal access
- Git installed locally
- ~15-20 minutes to complete deployment

---

## Step 1: Prepare Your Project Locally

### 1.1: Run Pre-Deployment Checklist

Before deploying, ensure everything works locally:

```bash
# Navigate to project directory
cd /path/to/Auralis-AI

# Install dependencies
npm install

# Run environment validation
npm run predeploy:check
```

**Expected Output:**

```
✓ All environment variables present
✓ No missing required keys
```

### 1.2: Run Full Test Suite

```bash
# This runs: lint + typecheck + tests + production build
npm run ci
```

**Expected Output:**

```
✓ Lint check passed
✓ TypeScript check passed
✓ Unit tests passed (3/3)
✓ Production build successful
```

### 1.3: Verify Local Dev Server Works

```bash
# Start development server
npm run dev
```

**Expected Output:**

```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

✅ **Verification:** Visit `http://localhost:3000/api/health` → Should see `{"status":"healthy"}`

### 1.4: Clean Build Artifacts

```bash
# Clear Next.js cache before deployment
rm -r .next
```

---

## Step 2: Set Up GitHub Repository

### 2.1: Create/Update GitHub Repository

**If you don't have a GitHub repo yet:**

1. Go to [github.com/new](https://github.com/new)
2. Enter repository name: `Auralis-AI` (or preferred name)
3. Choose **Private** (recommended for credentials)
4. Click **Create repository**

**If you already have a repo:**

Verify it's connected:

```bash
git remote -v
```

Should show:

```
origin  https://github.com/YOUR_USERNAME/Auralis-AI.git (fetch)
origin  https://github.com/YOUR_USERNAME/Auralis-AI.git (push)
```

### 2.2: Push Code to GitHub

```bash
# Stage all files
git add .

# Commit with message
git commit -m "Prepare for Vercel deployment"

# Push to main branch
git push origin main
```

**Expected Output:**

```
Enumerating objects: X, done.
Writing objects: 100% (X/X), done.
Total X (delta X), reused 0 (delta 0)
```

✅ **Verification:** Visit `https://github.com/YOUR_USERNAME/Auralis-AI` → Should see your code

---

## Step 3: Create Vercel Account

### 3.1: Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Choose **GitHub** as provider (recommended for best integration)
4. Authorize Vercel to access your GitHub account
5. Choose a username (e.g., your GitHub username)
6. Complete email verification

### 3.2: Verify Account

- Receive welcome email
- Click verification link
- Dashboard should show: **"Welcome to Vercel"**

---

## Step 4: Import Project to Vercel

### 4.1: Import Your Repository

1. **In Vercel Dashboard**, click **Add New...** → **Project**
2. Under "Import Git Repository," paste your repo URL:
   ```
   https://github.com/YOUR_USERNAME/Auralis-AI
   ```
3. Click **Continue**

### 4.2: Configure Project Settings

You'll see a form with these options:

| Field                | Value                       |
| -------------------- | --------------------------- |
| **Project Name**     | `Auralis-AI` (auto-filled)  |
| **Framework Preset** | `Next.js` (auto-detected)   |
| **Root Directory**   | `./` (leave default)        |
| **Build Command**    | `next build` (auto-filled)  |
| **Output Directory** | `.next` (auto-filled)       |
| **Install Command**  | `npm install` (auto-filled) |

✅ **Keep defaults** - Vercel auto-detects Next.js projects correctly

### 4.3: Review Import Settings

- ✅ Verify branch is set to `main`
- ✅ Verify `Build and development settings` looks correct
- ✅ Click **Deploy** (will fail - we need env vars first)

**Note:** Deployment will fail until we add environment variables. This is expected.

---

## Step 5: Configure Environment Variables

### 5.1: Gather Required API Keys

You'll need these credentials (see instructions in your project root):

| Variable                 | Where to Get                                             | Example                            |
| ------------------------ | -------------------------------------------------------- | ---------------------------------- |
| **GOOGLE_AI_API_KEY**    | [Google AI Studio](https://aistudio.google.com/apikey)   | `AIza...`                          |
| **GOOGLE_CLIENT_ID**     | [Google Cloud Console](https://console.cloud.google.com) | `xxx...apps.googleusercontent.com` |
| **GOOGLE_CLIENT_SECRET** | [Google Cloud Console](https://console.cloud.google.com) | `GOCSP...`                         |
| **MURF_API_KEY**         | [Murf.ai Dashboard](https://app.murf.ai/settings/api)    | `xxx...`                           |
| **NEXTAUTH_SECRET**      | Generate new: `openssl rand -base64 32`                  | `aB3...cD9`                        |
| **NEXTAUTH_URL**         | Will be provided by Vercel                               | `https://auralis-ai.vercel.app`    |
| **NEXT_PUBLIC_APP_URL**  | Will be provided by Vercel                               | `https://auralis-ai.vercel.app`    |

### 5.2: Get Your Vercel Deployment URL

1. **In Vercel Dashboard**, go to your project
2. Look for **Deployments** tab → Recent deployment
3. Copy the deployment URL (format: `https://yourproject-xxx.vercel.app`)

### 5.3: Add Environment Variables in Vercel

1. **In Vercel Project Dashboard**, click **Settings**
2. Go to **Environment Variables** (left sidebar)
3. Click **Add New**

**Add these variables (one by one):**

```env
GOOGLE_AI_API_KEY=AIza...YOUR_KEY...
GOOGLE_CLIENT_ID=xxx...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSP...YOUR_SECRET...
MURF_API_KEY=xxx...YOUR_KEY...
NEXTAUTH_SECRET=aB3...cD9...
NEXTAUTH_URL=https://auralis-ai-xxx.vercel.app
NEXT_PUBLIC_APP_URL=https://auralis-ai-xxx.vercel.app
```

### 5.4: Verify Environment Variables Added

| Variable             | Status   | Scope                            |
| -------------------- | -------- | -------------------------------- |
| GOOGLE_AI_API_KEY    | ✅ Added | Production, Preview, Development |
| GOOGLE_CLIENT_ID     | ✅ Added | Production, Preview, Development |
| GOOGLE_CLIENT_SECRET | ✅ Added | Production, Preview, Development |
| MURF_API_KEY         | ✅ Added | Production, Preview              |
| NEXTAUTH_SECRET      | ✅ Added | Production, Preview, Development |
| NEXTAUTH_URL         | ✅ Added | Production                       |
| NEXT_PUBLIC_APP_URL  | ✅ Added | Production, Preview, Development |

💡 **Tip:** For each variable, select:

- ✅ Production
- ✅ Preview
- ✅ Development (optional)

---

## Step 6: Deploy Application

### 6.1: Trigger Initial Deployment

**Option A: From Vercel Dashboard**

1. Go to **Deployments** tab
2. Click **Redeploy** on the most recent deployment
3. Click **Redeploy** again to confirm

**Option B: From GitHub (Auto-Deploy)**

1. Push a new commit to main branch:
   ```bash
   git commit --allow-empty -m "Trigger Vercel deployment"
   git push origin main
   ```
2. Vercel automatically detects and deploys

### 6.2: Monitor Deployment Progress

1. **In Vercel Dashboard**, watch **Deployments** tab
2. Status will change: `Queued` → `Building` → `Analyzing` → `Ready`
3. Deployment usually takes 3-5 minutes

**Deployment Logs:**

```
✓ Collecting build outputs
✓ Finalizing deployment
✓ Lambda cold start optimized to X ms
✓ Deployment completed successfully
```

### 6.3: What to Do If Deployment Fails

**Common Error: "Missing environment variable"**

```
Error: Environment variable GOOGLE_AI_API_KEY is not set
```

**Solution:**

- Go to Settings → Environment Variables
- Verify all variables are added
- Redeploy

**Common Error: "Build failed"**

```
npm ERR! 404 not found
```

**Solution:**

- Check package.json is valid
- Verify all dependencies are in package.json
- Run `npm install` locally to confirm

---

## Step 7: Verify Deployment

### 7.1: Check Deployment Status

1. **In Vercel Dashboard**, go to **Deployments**
2. Look for green checkmark ✅ next to latest deployment
3. Click deployment to see detailed logs

### 7.2: Test Health Check Endpoint

1. Get your Vercel URL from dashboard (e.g., `https://auralis-ai-xxx.vercel.app`)
2. Visit this endpoint in browser:
   ```
   https://auralis-ai-xxx.vercel.app/api/health
   ```

**Expected Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T10:30:45Z"
}
```

### 7.3: Test Core Features

**Test 1: Login Page**

- Visit: `https://auralis-ai-xxx.vercel.app/login`
- ✅ Should load without errors
- ✅ Google Sign-In button should be visible

**Test 2: Google OAuth**

- Click "Sign in with Google"
- ✅ Should redirect to Google login
- ✅ After authentication, redirect back to dashboard
- ✅ Session should persist

**Test 3: Dashboard**

- Visit: `https://auralis-ai-xxx.vercel.app/dashboard`
- ✅ Agent list should load
- ✅ Should display available agents

**Test 4: Chat Page**

- Click any agent from dashboard
- ✅ Should navigate to `/chat/[id]`
- ✅ Chat interface should load
- ✅ Message input should be active

**Test 5: API Response**

- Send a message in chat
- ✅ "Thinking..." state should appear
- ✅ AI response should appear within 10-15 seconds
- ✅ No error messages should appear

**Test 6: Text-to-Speech (Optional)**

- After AI responds, click "Play" button
- ✅ Audio should play (if Murf API working)
- ✅ Click "Stop" should pause audio

---

## Step 8: Post-Deployment Configuration

### 8.1: Update Google OAuth Redirect URI

In [Google Cloud Console](https://console.cloud.google.com):

1. Go to **APIs & Services** → **Credentials**
2. Click your OAuth 2.0 Client ID
3. Update **Authorized redirect URIs**:
   ```
   https://auralis-ai-xxx.vercel.app/api/auth/callback/google
   ```
4. Click **Save**

### 8.2: Set Up Custom Domain (Optional)

**If you want a custom domain:**

1. In Vercel, go **Settings** → **Domains**
2. Click **Add**
3. Enter your domain (e.g., `auralis-ai.com`)
4. Follow DNS configuration instructions
5. Vercel will auto-provision SSL certificate

### 8.3: Enable Analytics (Optional)

1. In Vercel, go **Settings** → **Analytics**
2. Click **Enable**
3. Vercel will start tracking performance metrics

### 8.4: Configure Production Branch

1. In Vercel, go **Settings** → **Git**
2. Set **Production Branch** to `main`
3. Enable **Automatic Deployments** (recommended)

---

## Troubleshooting

### Issue 1: "Connection Refused" on `/api/health`

**Symptoms:**

```
Error: Failed to fetch from https://auralis-ai-xxx.vercel.app/api/health
```

**Solutions:**

1. Wait 5 minutes after deployment completes
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try in private/incognito window
4. Check Vercel deployment logs for errors

### Issue 2: "Google OAuth Error"

**Symptoms:**

```
Error redirect_uri_mismatch
```

**Solutions:**

1. Verify `NEXTAUTH_URL` in Vercel env vars matches exact domain
2. Update Google OAuth redirect URI (see Step 8.1)
3. Clear cookies and retry login
4. Check Google Client ID and Secret are correct

### Issue 3: "Environment Variable Not Found"

**Symptoms:**

```
Error: Environment variable MURF_API_KEY is missing
```

**Solutions:**

1. Go to Vercel **Settings** → **Environment Variables**
2. Verify variable is added with correct value
3. Click **Redeploy** on latest deployment
4. Wait for new deployment to complete

### Issue 4: "Build Failed - Out of Memory"

**Symptoms:**

```
JavaScript heap out of memory
```

**Solutions:**

1. Go to **Settings** → **Build & Development Settings**
2. Increase **Node.js Version** to 20 LTS
3. Redeploy and retry

### Issue 5: "Murf API 400 Error"

**Symptoms:**

```
Error: Text-to-speech failed with status 400
```

**Solutions:**

1. Verify `MURF_API_KEY` is valid in Vercel
2. Check Murf account quota at https://app.murf.ai
3. Temporarily disable text-to-speech to test chat functionality
4. Contact Murf support if issue persists

---

## Deployment Checklist

### Pre-Deployment (Local)

- [ ] Run `npm install` successfully
- [ ] Run `npm run predeploy:check` - passes
- [ ] Run `npm run ci` - all checks pass
- [ ] Run `npm run dev` - server starts
- [ ] Visit `http://localhost:3000/api/health` - returns 200
- [ ] Git repo is clean (no uncommitted changes)
- [ ] `.env.local` NOT committed to Git
- [ ] Code pushed to GitHub `main` branch

### Vercel Setup

- [ ] Vercel account created
- [ ] GitHub connected to Vercel
- [ ] Project imported to Vercel
- [ ] Root directory set to `./`
- [ ] Framework preset set to Next.js

### Environment Variables

- [ ] `GOOGLE_AI_API_KEY` added
- [ ] `GOOGLE_CLIENT_ID` added
- [ ] `GOOGLE_CLIENT_SECRET` added
- [ ] `MURF_API_KEY` added (if using voice)
- [ ] `NEXTAUTH_SECRET` added (generated)
- [ ] `NEXTAUTH_URL` added (Vercel URL)
- [ ] `NEXT_PUBLIC_APP_URL` added (Vercel URL)
- [ ] All variables set for Production scope

### First Deployment

- [ ] Initial deployment triggered
- [ ] Deployment status shows "Ready" (green checkmark)
- [ ] No errors in deployment logs
- [ ] Build time < 5 minutes

### Post-Deployment Testing

- [ ] `/api/health` returns `200 OK`
- [ ] `/login` page loads
- [ ] Google OAuth sign-in works
- [ ] `/dashboard` loads with agents
- [ ] `/chat/[id]` loads chat interface
- [ ] AI responds to messages
- [ ] Audio playback works (if Murf enabled)
- [ ] Stop button cancels requests
- [ ] No console errors in browser DevTools

### Security

- [ ] No API keys in `.env.local` (committed)
- [ ] No credentials in code comments
- [ ] GOOGLE_CLIENT_SECRET not visible in public
- [ ] OAuth redirect URI updated in Google Console
- [ ] NEXTAUTH_SECRET is strong (32+ chars)

### Monitoring

- [ ] Vercel Analytics enabled (optional)
- [ ] Email notifications enabled for deployments
- [ ] Slack webhook connected (optional)

---

## Auto-Deployment Configuration

### Enable Auto-Deploy from GitHub

1. In Vercel **Settings** → **Git**
2. Under "Deploy on push", select:
   - ✅ Include production environment
   - ✅ Automatic deployments
3. Set **Production Branch** to `main`

**Result:** Every push to `main` automatically deploys!

```bash
# This will trigger automatic deployment
git push origin main
```

---

## Rollback to Previous Deployment

If something goes wrong:

1. **In Vercel Dashboard**, go to **Deployments**
2. Find the last known-good deployment
3. Click **...** (three dots) → **Promote to Production**
4. Confirm

Your site will revert to that version immediately.

---

## Next.js Specific Features on Vercel

| Feature                   | Included | Details                         |
| ------------------------- | -------- | ------------------------------- |
| **Automatic Caching**     | ✅ Yes   | Static assets cached globally   |
| **Image Optimization**    | ✅ Yes   | Auto-optimized images           |
| **ISR**                   | ✅ Yes   | Incremental Static Regeneration |
| **Edge Functions**        | ✅ Yes   | (Premium feature)               |
| **Analytics**             | ✅ Yes   | Web Vitals tracking             |
| **Environment Variables** | ✅ Yes   | Supported in UI                 |
| **Serverless Functions**  | ✅ Yes   | API routes become serverless    |

---

## Cost & Limitations

### Vercel Free Tier Includes:

- ✅ Up to 100 deployments/month
- ✅ 6 GB serverless function execution/month
- ✅ 100 GB bandwidth/month
- ✅ Custom domains
- ✅ SSL certificates (free)

### When to Upgrade:

- More than 100 deployments/month
- More than 6 GB function execution
- More than 100 GB bandwidth
- Pro team features needed

---

## Final Checklist Before Going Live

```bash
# Day before deployment
npm run predeploy:check   # ✅ All pass
npm run ci               # ✅ All pass
git push origin main     # ✅ Synced with Vercel

# Day of deployment
# 1. Verify Vercel deployment complete
# 2. Test all core features
# 3. Check `/api/health` endpoint
# 4. Monitor for errors in browser console
# 5. Share deployment URL with stakeholders
```

---

## Support & Documentation

| Resource          | Link                     |
| ----------------- | ------------------------ |
| Vercel Docs       | https://vercel.com/docs  |
| Next.js Docs      | https://nextjs.org/docs  |
| NextAuth.js Docs  | https://next-auth.js.org |
| Google Gemini API | https://ai.google.dev    |
| Murf AI Docs      | https://www.murf.ai/docs |

---

## Quick Reference Commands

```bash
# Local testing before deployment
npm install
npm run predeploy:check
npm run dev

# Verify API health locally
curl http://localhost:3000/api/health

# Create new deployment from GitHub
git commit --allow-empty -m "Trigger deployment"
git push origin main

# Rollback to previous deployment
# Use Vercel Dashboard → Deployments → Promote
```

---

**Deployment Guide Created:** February 20, 2026  
**For Project:** Auralis AI  
**Estimated Time:** 20-30 minutes  
**Difficulty:** Beginner-friendly

✅ **You're ready to deploy!**
