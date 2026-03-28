# NeuralStream: Fast 5-Minute Automation System

## ⚡ System Overview

This is a **Google News-style** automated system that:
1. **Picks** news links from RSS feeds (or manual paste)
2. **Generates** professional articles using the AI module
3. **Posts** to NeuralStream + Blogger every 5 minutes

---

## 🔧 Current Architecture

### 1. **News Link Picker** (The Aggregator)
- **RSS Feeds** → Continuously monitors configured sources
- **Sources**: AI News, Bloomberg, TechCrunch, Reuters, Economic Times India
- **Manual Input** → Admin panel URL paste
- **Queue System** → Prevents duplicates via SHA-256 hashing

### 2. **Article Generator** (The AI Module)
- **Endpoint**: `/articles/generate`
- **Input**: News URL or manual content
- **Output**: Headline, Subheading, Summary, Key Points, Full Article (HTML)
- **Processing**: LLM-based content rewriting & SEO optimization

### 3. **Publisher** (The Module)
- **Targets**: 
  - NeuralStream API (`/articles/publish`)
  - Blogger API (with OAuth2)
- **Logging**: Real-time execution logs stored in `automation-logs.json`

---

## 📋 Implementation Steps

### Step 1: Ensure GitHub Actions is Enabled
The workflow runs **every 5 minutes** via:
```yaml
schedule:
  - cron: '*/5 * * * *'
```

### Step 2: Configure Environment Secrets
Set these in GitHub Settings → Secrets:
- `NEURALSTREAM_API` → API endpoint
- `NEURALSTREAM_TOKEN` → API token
- `BLOG_ID` → Blogger blog ID
- `BLOGGER_CLIENT_ID` → OAuth2 ID
- `BLOGGER_CLIENT_SECRET` → OAuth2 secret
- `BLOGGER_REFRESH_TOKEN` → OAuth2 refresh token

### Step 3: Run Manual Test
```bash
# In admin panel, paste a news link and click "Generate"
# Click "Save Article" to trigger publication
```

---

## 🚀 How It Works (5-Minute Cycle)

```
[Minute 0:00] → Fetch Latest from RSS
       ↓
[Minute 0:30] → Get next pending link from queue
       ↓
[Minute 1:00] → Call /articles/generate API
       ↓
[Minute 2:00] → Format for publication
       ↓
[Minute 3:00] → Post to NeuralStream + Blogger
       ↓
[Minute 4:30] → Log execution, mark as published
       ↓
[Minute 5:00] → Repeat cycle
```

---

## 📊 Monitoring Dashboard

Check real-time status via:
- **Admin Panel** → `/admin/dashboard`
- **Execution Logs** → GitHub Actions tab
- **Published Articles** → `/admin/articles`

---

## 🔑 Key Files

| File | Purpose |
|------|----------|
| `automation.js` | Main execution script |
| `.github/workflows/automation.yml` | GitHub Actions config |
| `automation-logs.json` | Execution history |

---

## ⚠️ Troubleshooting

### Articles not publishing?
- Check GitHub Actions logs
- Verify API secrets are correct
- Ensure Blogger token is fresh (expires every 6 months)

### Duplicate articles?
- The system uses SHA-256 hashing to prevent duplicates
- Check `published-headlines.json` for existing articles

### Rate limits?
- Adjust RSS feeds to avoid overloading
- Space out manual submissions

---

## 📝 Quick Commands

### Manually Trigger Automation
```bash
node automation.js
```

### Check Logs
```bash
cat automation-logs.json | tail -50
```

### View Queue
```bash
cat news-queue.json
```

---

## 🎯 Next Steps

1. ✅ Configure all GitHub Secrets
2. ✅ Test with manual URL in admin panel
3. ✅ Monitor first 24 hours of automation
4. ✅ Adjust RSS feeds as needed
5. ✅ Add more news sources

**Status**: Ready to deploy! 🚀
