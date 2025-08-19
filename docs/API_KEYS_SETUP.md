# API Keys Setup Guide

This guide explains how to obtain API keys for each data source used in the SaaS Ideas scraping system.

## 1. YouTube Data API v3

### Steps to get YouTube API Key:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Click on the project dropdown at the top
   - Either select an existing project or create a new one

3. **Enable YouTube Data API v3**
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "Enable"

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

5. **Set Environment Variable**
   ```bash
   export YOUTUBE_API_KEY="your_api_key_here"
   ```

### Usage Limits:
- **Free Quota**: 10,000 units/day
- **Cost per unit**: Video search = 100 units, Comments = 1 unit
- **Estimated daily capacity**: ~50 videos with comments

---

## 2. Twitch API

### Steps to get Twitch API Keys:

1. **Create Twitch Developer Account**
   - Visit: https://dev.twitch.tv/console
   - Log in with your Twitch account

2. **Register Your Application**
   - Click "Register Your Application"
   - Name: "SaaS Ideas Scraper"
   - OAuth Redirect URLs: `http://localhost` (for testing)
   - Category: "Application Integration"

3. **Get Client ID and Secret**
   - After registration, click "Manage" on your app
   - Copy the "Client ID"
   - Click "New Secret" to generate Client Secret
   - Copy the Client Secret immediately (you can't view it again)

4. **Set Environment Variables**
   ```bash
   export TWITCH_CLIENT_ID="your_client_id_here"
   export TWITCH_CLIENT_SECRET="your_client_secret_here"
   ```

### Usage Limits:
- **Rate Limit**: 800 requests/minute
- **No cost** for basic API usage
- **OAuth**: Uses Client Credentials flow (no user login required)

---

## 3. Podcast RSS Feeds

### Steps to set up Podcast scraping:

**No API key required!** 

The podcast scraper uses publicly available RSS feeds. However, you may want to:

1. **Verify RSS Feed URLs**
   - The Edge Function includes 7 pre-configured tech podcast feeds
   - Test feeds manually to ensure they're still active
   - URLs are in `supabase/functions/ingest-podcast/index.ts`

2. **Add Custom Feeds (Optional)**
   To add custom podcast feeds, you need to edit the Edge Function:
   ```bash
   # Edit the ingest-podcast function
   vim supabase/functions/ingest-podcast/index.ts
   
   # Add to the techPodcasts array around line 65:
   {
     name: 'Your Podcast Name',
     url: 'https://example.com/feed.rss',
   },
   
   # Then redeploy the function
   supabase functions deploy ingest-podcast
   ```
   
   **Pre-configured tech podcasts included:**
   - Syntax - Tasty Web Development Treats
   - The Changelog  
   - Software Engineering Daily
   - Indie Hackers Podcast
   - The SaaS Podcast
   - Developer Tea
   - Full Stack Radio

3. **No External Dependencies**
   - Uses built-in `DOMParser` API (Edge Function compatible)
   - No npm packages required

### Usage Notes:
- **No rate limits** from podcast providers
- **Scraper self-limits**: 500ms between episodes, 2s between podcasts
- **Content**: Extracts complaints from episode descriptions and titles

---

## 4. Notion API

### Steps to get Notion API Key:

1. **Create Notion Integration**
   - Visit: https://www.notion.so/my-integrations
   - Click "New integration"
   - Name: "SaaS Ideas Scraper"
   - Select your workspace
   - Click "Submit"

2. **Get Integration Token**
   - Copy the "Internal Integration Token"
   - This is your API key

3. **Grant Access to Pages/Databases**
   - Go to the Notion page or database you want to scrape
   - Click the "Share" button
   - Click "Invite" and select your integration
   - Grant "Read" permissions

4. **Set Environment Variable**
   ```bash
   export NOTION_API_KEY="secret_your_token_here"
   ```

### Usage Configuration:

To monitor specific databases or pages, add them to your scraper:

```typescript
// In your scraping code
const scraper = new NotionScraper(apiKey, supabaseUrl, supabaseKey);

// Add specific resources to monitor
scraper.addMonitoredResource(
  'database_id_here',  // Get from Notion URL
  'database', 
  'Team Feedback Database',
  'User complaints and feature requests'
);

scraper.addMonitoredResource(
  'page_id_here',     // Get from Notion URL  
  'page',
  'Product Issues Page',
  'Known product problems'
);
```

### Usage Limits:
- **Rate Limit**: 3 requests/second
- **No cost** for basic usage
- **Content Access**: Only pages/databases you explicitly share with the integration

---

## Environment Variables Summary

Add all these to your `.env` file or environment:

```bash
# YouTube
YOUTUBE_API_KEY="your_youtube_api_key"

# Twitch  
TWITCH_CLIENT_ID="your_twitch_client_id"
TWITCH_CLIENT_SECRET="your_twitch_client_secret"

# Notion
NOTION_API_KEY="secret_your_notion_integration_token"

# Existing Supabase vars (required for all scrapers)
SUPABASE_URL="your_supabase_project_url"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
```

---

## Testing Your Setup

### 1. Test YouTube API
```typescript
import { runYouTubeScraping } from './src/lib/scrapers/youtube-scraper';
const result = await runYouTubeScraping();
console.log(`YouTube: ${result.videos} videos, ${result.comments} complaints`);
```

### 2. Test Twitch API
```typescript
import { runTwitchScraping } from './src/lib/scrapers/twitch-scraper';
const result = await runTwitchScraping();
console.log(`Twitch: ${result.streams} streams, ${result.clips} clips`);
```

### 3. Test Podcast RSS
```typescript
import { runPodcastScraping } from './src/lib/scrapers/podcast-scraper';
const result = await runPodcastScraping();
console.log(`Podcasts: ${result.feeds} feeds, ${result.complaints} complaints`);
```

### 4. Test Notion API
```typescript
import { runNotionScraping } from './src/lib/scrapers/notion-scraper';
const result = await runNotionScraping();
console.log(`Notion: ${result.pages} pages, ${result.complaints} complaints`);
```

---

## Troubleshooting

### Common Issues:

1. **YouTube API "Daily Limit Exceeded"**
   - You've hit the 10,000 unit/day limit
   - Wait until the next day or reduce scraping frequency

2. **Twitch "Invalid Client"**
   - Check your Client ID and Secret are correct
   - Ensure your app is properly registered on dev.twitch.tv

3. **Podcast "Feed Not Found"**
   - RSS feed URL may have changed
   - Check if podcast is still active
   - Try accessing the feed URL in a browser

4. **Notion "Unauthorized"**
   - Integration token might be wrong
   - Check that you've shared the page/database with your integration
   - Verify the integration has proper permissions

5. **Supabase Connection Issues**
   - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
   - Check that your `posts` table exists with the correct schema

---

## Cost Estimates

| Service | Free Tier | Paid Tiers | Daily Scraping Cost |
|---------|-----------|------------|-------------------|
| YouTube | 10K units/day | $0.05/1K units | Free (within limits) |
| Twitch | Unlimited | Free | Free |
| Podcasts | Unlimited | Free | Free |
| Notion | Unlimited | Free | Free |

**Total estimated monthly cost: $0-5** (only if you exceed YouTube free tier)

---

## Security Best Practices

1. **Never commit API keys to git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use environment variables**
   - Store keys in `.env` for local development
   - Use your hosting platform's environment variables for production

3. **Rotate keys regularly**
   - YouTube: Regenerate API keys monthly
   - Twitch: Regenerate client secrets quarterly  
   - Notion: Regenerate integration tokens quarterly

4. **Limit API key permissions**
   - YouTube: Restrict to YouTube Data API v3 only
   - Twitch: Use minimum required scopes
   - Notion: Only share necessary pages/databases

---

Need help? Check the individual service documentation:
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Twitch API](https://dev.twitch.tv/docs/api/)
- [Notion API](https://developers.notion.com/)