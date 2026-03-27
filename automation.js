/**
 * NeuralStream News Automation System
 * Fetches news from RSS feeds, generates articles via AI, and publishes to Blogger
 * Runs every 5 minutes via GitHub Actions
 */

const axios = require('axios');
const Parser = require('rss-parser');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  NEURALS TREAM_API: process.env.NEURALSTREAM_API || 'https://frontlinenews.base44.app/api',
  NEURALS TREAM_TOKEN: process.env.NEURALSTREAM_TOKEN,
  BLOG_ID: process.env.BLOG_ID || '6570627005015735206',
  BLOGGER_CLIENT_ID: process.env.BLOGGER_CLIENT_ID,
  BLOGGER_CLIENT_SECRET: process.env.BLOGGER_CLIENT_SECRET,
  BLOGGER_REFRESH_TOKEN: process.env.BLOGGER_REFRESH_TOKEN,
  LOG_FILE: 'automation-logs.json'
};

// RSS Feed Sources (from NeuralStream)
const RSS_FEEDS = [
  {
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/',
    category: 'AI'
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://www.bloomberg.com/feed/podcast/decrypted',
    category: 'Finance'
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'Technology'
  },
  {
    name: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/topNews',
    category: 'World'
  },
  {
    name: 'Economic Times India',
    url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
    category: 'India'
  }
];

// Logger utility
class Logger {
  static log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    console.log(`[${level}] ${timestamp} - ${message}`, data);
    this.saveToFile(logEntry);
  }

  static saveToFile(entry) {
    try {
      let logs = [];
      if (fs.existsSync(CONFIG.LOG_FILE)) {
        const data = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
        logs = JSON.parse(data);
      }
      logs.push(entry);
      // Keep only last 1000 entries
      if (logs.length > 1000) logs = logs.slice(-1000);
      fs.writeFileSync(CONFIG.LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (err) {
      console.error('Failed to save log:', err.message);
    }
  }
}

// Blogger API Setup
class BloggerManager {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      CONFIG.BLOGGER_CLIENT_ID,
      CONFIG.BLOGGER_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );
    this.oauth2Client.setCredentials({
      refresh_token: CONFIG.BLOGGER_REFRESH_TOKEN
    });
    this.blogger = google.blogger({
      version: 'v3',
      auth: this.oauth2Client
    });
  }

  async publishPost(article) {
    try {
      const post = {
        title: article.headline,
        content: `<h2>${article.subheading}</h2>
<p>${article.summary}</p>
<h3>Key Points:</h3>
<ul>
${article.keyPoints.map(point => `<li>${point}</li>`).join('\n')}
</ul>
<p>${article.content}</p>
<p><small>Source: ${article.source} | Generated: ${new Date().toLocaleString()}</small></p>`,
        labels: [article.category, 'Automated', 'NeuralStream'],
        published: new Date().toISOString()
      };

      const response = await this.blogger.posts.insert({
        blogId: CONFIG.BLOG_ID,
        requestBody: post
      });

      Logger.log('INFO', `Article published to Blogger: ${article.headline}`, {
        postId: response.data.id,
        url: response.data.url,
        source: article.source
      });

      return response.data;
    } catch (error) {
      Logger.log('ERROR', `Failed to publish to Blogger: ${article.headline}`, {
        error: error.message,
        source: article.source
      });
      throw error;
    }
  }
}

// RSS Feed Fetcher
class RSSFetcher {
  constructor() {
    this.parser = new Parser();
    this.feedCache = {};
  }

  async fetchAllFeeds() {
    Logger.log('INFO', 'Starting RSS feed fetch cycle');
    const newsItems = [];

    for (const feed of RSS_FEEDS) {
      try {
        const feedData = await this.parser.parseURL(feed.url);
        
        if (feedData.items && feedData.items.length > 0) {
          // Get latest 3 articles from each feed
          const latestItems = feedData.items.slice(0, 3).map(item => ({
            title: item.title,
            link: item.link,
            description: item.description || item.summary || '',
            pubDate: item.pubDate,
            source: feed.name,
            category: feed.category,
            feedUrl: feed.url
          }));

          newsItems.push(...latestItems);
          Logger.log('INFO', `Fetched ${latestItems.length} items from ${feed.name}`);
        }
      } catch (error) {
        Logger.log('ERROR', `Failed to fetch from ${feed.name}`, {
          error: error.message,
          feedUrl: feed.url
        });
      }
    }

    Logger.log('INFO', `Total news items fetched: ${newsItems.length}`);
    return newsItems;
  }
}

// NeuralStream API Integration
class NeuralStreamClient {
  async generateArticle(newsItem) {
    try {
      Logger.log('INFO', `Generating article from: ${newsItem.source}`);

      const response = await axios.post(
        `${CONFIG.NEURALSTREAM_API}/articles/generate`,
        {
          newsUrl: newsItem.link,
          sourceUrl: newsItem.link,
          source: newsItem.source,
          category: newsItem.category,
          manualContent: newsItem.description
        },
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.NEURALSTREAM_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      Logger.log('INFO', `Article generated successfully from ${newsItem.source}`);
      return response.data;
    } catch (error) {
      Logger.log('ERROR', `Failed to generate article from ${newsItem.source}`, {
        error: error.message,
        newsUrl: newsItem.link
      });
      return null;
    }
  }
}

// Duplicate Detection
class DuplicateDetector {
  constructor() {
    this.publishedHeadlines = new Set();
    this.loadPublishedHeadlines();
  }

  loadPublishedHeadlines() {
    try {
      if (fs.existsSync('published-headlines.json')) {
        const data = fs.readFileSync('published-headlines.json', 'utf8');
        const headlines = JSON.parse(data);
        this.publishedHeadlines = new Set(headlines);
      }
    } catch (error) {
      Logger.log('WARN', 'Failed to load published headlines');
    }
  }

  isDuplicate(headline) {
    // Simple duplicate detection based on headline
    const normalized = headline.toLowerCase().trim();
    return this.publishedHeadlines.has(normalized);
  }

  markAsPublished(headline) {
    const normalized = headline.toLowerCase().trim();
    this.publishedHeadlines.add(normalized);
    fs.writeFileSync(
      'published-headlines.json',
      JSON.stringify(Array.from(this.publishedHeadlines), null, 2)
    );
  }
}

// Main Automation System
class NewsAutomation {
  constructor() {
    this.rssFetcher = new RSSFetcher();
    this.neuralStream = new NeuralStreamClient();
    this.blogger = new BloggerManager();
    this.duplicateDetector = new DuplicateDetector();
  }

  async run() {
    const startTime = Date.now();
    Logger.log('INFO', '========== AUTOMATION CYCLE STARTED =========');

    try {
      // Step 1: Fetch from RSS feeds
      const newsItems = await this.rssFetcher.fetchAllFeeds();
      
      if (newsItems.length === 0) {
        Logger.log('WARN', 'No news items found in RSS feeds');
        return;
      }

      // Step 2: Generate and publish articles
      let publishedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const newsItem of newsItems) {
        try {
          // Generate article via NeuralStream
          const generatedArticle = await this.neuralStream.generateArticle(newsItem);
          
          if (!generatedArticle) {
            failedCount++;
            continue;
          }

          // Check for duplicates
          if (this.duplicateDetector.isDuplicate(generatedArticle.headline)) {
            Logger.log('INFO', `Skipped duplicate: ${generatedArticle.headline}`);
            skippedCount++;
            continue;
          }

          // Publish to Blogger
          await this.blogger.publishPost(generatedArticle);
          this.duplicateDetector.markAsPublished(generatedArticle.headline);
          publishedCount++;

          // Rate limiting - wait 1 second between posts
          await this.sleep(1000);
        } catch (error) {
          failedCount++;
          Logger.log('ERROR', `Failed to process article from ${newsItem.source}`, {
            error: error.message
          });
        }
      }

      // Step 3: Log summary
      const duration = Date.now() - startTime;
      const summary = {
        processed: newsItems.length,
        published: publishedCount,
        skipped: skippedCount,
        failed: failedCount,
        durationMs: duration
      };

      Logger.log('INFO', '========== AUTOMATION CYCLE COMPLETED =========', summary);
      return summary;

    } catch (error) {
      Logger.log('ERROR', 'Automation cycle failed with error', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Entry point
async function main() {
  if (!CONFIG.NEURALSTREAM_TOKEN) {
    Logger.log('ERROR', 'Missing NEURALSTREAM_TOKEN environment variable');
    process.exit(1);
  }

  if (!CONFIG.BLOGGER_CLIENT_ID || !CONFIG.BLOGGER_CLIENT_SECRET || !CONFIG.BLOGGER_REFRESH_TOKEN) {
    Logger.log('ERROR', 'Missing Blogger credentials in environment variables');
    process.exit(1);
  }

  const automation = new NewsAutomation();
  
  try {
    await automation.run();
    process.exit(0);
  } catch (error) {
    Logger.log('ERROR', 'Fatal error in automation', {
      error: error.message
    });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = NewsAutomation;
