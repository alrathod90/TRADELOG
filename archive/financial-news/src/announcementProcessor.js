/**
 * Smart Announcement Summarization & Processing
 * Uses Claude API for abstractive summaries, sentiment analysis, impact scoring
 */

const ANNOUNCEMENT_CATEGORIES = {
  EARNINGS: 'earnings',
  CORPORATE_ACTION: 'corporate_action',
  REGULATORY: 'regulatory',
  MANAGEMENT: 'management',
  EXPANSION: 'expansion',
  ACQUISITION: 'acquisition',
  MARKET: 'market',
  UNKNOWN: 'unknown',
};

const CATEGORY_KEYWORDS = {
  [ANNOUNCEMENT_CATEGORIES.EARNINGS]: [
    'results', 'earnings', 'profit', 'revenue', 'loss', 'ebitda', 'quarterly', 'annual', 'financial',
  ],
  [ANNOUNCEMENT_CATEGORIES.CORPORATE_ACTION]: [
    'bonus', 'dividend', 'split', 'buyback', 'rights', 'issue', 'share split', 'bonus shares',
  ],
  [ANNOUNCEMENT_CATEGORIES.REGULATORY]: [
    'sebi', 'compliance', 'regulation', 'filing', 'disclosure', 'notice', 'order', 'directive',
  ],
  [ANNOUNCEMENT_CATEGORIES.MANAGEMENT]: [
    'appointment', 'director', 'ceo', 'chairman', 'board', 'resignation', 'retirement', 'management change',
  ],
  [ANNOUNCEMENT_CATEGORIES.EXPANSION]: [
    'expansion', 'capex', 'investment', 'facility', 'plant', 'new', 'commissioning', 'capacity',
  ],
  [ANNOUNCEMENT_CATEGORIES.ACQUISITION]: [
    'acquisition', 'merger', 'takeover', 'combination', 'acquired', 'stake', 'consolidation',
  ],
  [ANNOUNCEMENT_CATEGORIES.MARKET]: [
    'listing', 'ipo', 'delisting', 'market', 'exchange', 'trading', 'quotation',
  ],
};

/**
 * Categorize announcement based on keywords
 */
export function categorizeAnnouncement(text) {
  if (!text) return ANNOUNCEMENT_CATEGORIES.UNKNOWN;

  const lower = text.toLowerCase();
  let scores = {};

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    scores[category] = keywords.filter(kw => lower.includes(kw)).length;
  });

  const maxCategory = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return maxCategory && maxCategory[1] > 0 ? maxCategory[0] : ANNOUNCEMENT_CATEGORIES.UNKNOWN;
}

/**
 * Determine impact level (HIGH/MEDIUM/LOW)
 */
export function scoreImpact(category, summary) {
  const summary_lower = (summary || '').toLowerCase();

  // HIGH IMPACT: Major trading catalysts
  if ([ANNOUNCEMENT_CATEGORIES.EARNINGS, ANNOUNCEMENT_CATEGORIES.CORPORATE_ACTION].includes(category)) {
    // Earnings with significant miss/beat, bonus, split
    if (
      summary_lower.includes('miss') ||
      summary_lower.includes('beat') ||
      summary_lower.includes('bonus') ||
      summary_lower.includes('split') ||
      summary_lower.includes('loss') ||
      summary_lower.includes('merger') ||
      summary_lower.includes('acquisition')
    ) {
      return { level: 'HIGH', score: 9 };
    }
    return { level: 'MEDIUM', score: 6 };
  }

  // MEDIUM IMPACT: Notable announcements
  if ([ANNOUNCEMENT_CATEGORIES.MANAGEMENT, ANNOUNCEMENT_CATEGORIES.EXPANSION, ANNOUNCEMENT_CATEGORIES.REGULATORY].includes(category)) {
    return { level: 'MEDIUM', score: 5 };
  }

  // LOW IMPACT: Administrative
  return { level: 'LOW', score: 2 };
}

/**
 * Analyze sentiment of announcement
 */
export function analyzeSentiment(text) {
  if (!text) return { sentiment: 'NEUTRAL', score: 0 };

  const lower = text.toLowerCase();

  // Positive indicators
  const positive = [
    'increase', 'growth', 'profit', 'strong', 'expansion', 'bonus', 'dividend', 'beat',
    'success', 'positive', 'approval', 'achieved', 'record', 'upside', 'outperform',
    'bullish', 'gain', 'improvement', 'recovery', 'surge',
  ];

  // Negative indicators
  const negative = [
    'loss', 'decline', 'decrease', 'miss', 'weak', 'risk', 'warning', 'suspension',
    'failure', 'downside', 'bearish', 'crash', 'fall', 'delay', 'restructure',
    'closure', 'resign', 'default', 'downgrade',
  ];

  const posCount = positive.filter(p => lower.includes(p)).length;
  const negCount = negative.filter(n => lower.includes(n)).length;

  if (posCount > negCount) {
    return { sentiment: 'POSITIVE', score: Math.min(10, posCount * 2) };
  } else if (negCount > posCount) {
    return { sentiment: 'NEGATIVE', score: Math.min(10, -negCount * 2) };
  }

  return { sentiment: 'NEUTRAL', score: 0 };
}

/**
 * Call Claude API for abstractive summary
 * Falls back to extractive if API unavailable
 */
export async function generateSmartSummary(fullText, fallbackSummary) {
  if (!fullText && !fallbackSummary) return null;

  try {
    // Use Claude if available
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Summarize this corporate announcement in 2-3 sentences. Focus on what matters to traders/investors. 
              
Be concise and specific about:
- What happened (dividend, earnings, acquisition, etc.)
- Key numbers if relevant
- Likely impact on stock price

Announcement:
${fullText || fallbackSummary}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`Claude API failed: ${response.status}`);
        return fallbackSummary || null;
      }

      const data = await response.json();
      const summary = data.content?.[0]?.text?.trim();

      return summary || fallbackSummary || null;
    }

    // Fallback to extractive summary
    return fallbackSummary || null;
  } catch (e) {
    console.warn('generateSmartSummary error:', e.message);
    return fallbackSummary || null;
  }
}

/**
 * Process announcement: categorize, score, analyze sentiment, summarize
 */
export async function processAnnouncement(announcement, extractedText) {
  const category = categorizeAnnouncement(announcement.desc || extractedText || '');
  
  // Start with extractive summary, enhance with Claude
  let smartSummary = announcement.summary || null;
  if (extractedText) {
    smartSummary = await generateSmartSummary(extractedText, smartSummary);
  }

  const sentiment = analyzeSentiment(extractedText || announcement.desc || smartSummary || '');
  const impact = scoreImpact(category, smartSummary);

  return {
    category,
    smartSummary,
    sentiment: sentiment.sentiment,
    sentimentScore: sentiment.score,
    impactLevel: impact.level,
    impactScore: impact.score,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Get emoji for category
 */
export function getCategoryEmoji(category) {
  const emojis = {
    [ANNOUNCEMENT_CATEGORIES.EARNINGS]: '💰',
    [ANNOUNCEMENT_CATEGORIES.CORPORATE_ACTION]: '🏦',
    [ANNOUNCEMENT_CATEGORIES.REGULATORY]: '⚖️',
    [ANNOUNCEMENT_CATEGORIES.MANAGEMENT]: '👔',
    [ANNOUNCEMENT_CATEGORIES.EXPANSION]: '🚀',
    [ANNOUNCEMENT_CATEGORIES.ACQUISITION]: '🤝',
    [ANNOUNCEMENT_CATEGORIES.MARKET]: '📈',
    [ANNOUNCEMENT_CATEGORIES.UNKNOWN]: 'ℹ️',
  };
  return emojis[category] || 'ℹ️';
}

/**
 * Get emoji for impact
 */
export function getImpactEmoji(level) {
  const emojis = {
    HIGH: '🚀',
    MEDIUM: '⚠️',
    LOW: 'ℹ️',
  };
  return emojis[level] || 'ℹ️';
}

/**
 * Get emoji for sentiment
 */
export function getSentimentEmoji(sentiment) {
  const emojis = {
    POSITIVE: '📈',
    NEGATIVE: '📉',
    NEUTRAL: '➡️',
  };
  return emojis[sentiment] || '➡️';
}

/**
 * Format announcement for display/alert
 */
export function formatAnnouncement(announcement) {
  const categoryEmoji = getCategoryEmoji(announcement.category);
  const impactEmoji = getImpactEmoji(announcement.impactLevel);
  const sentimentEmoji = getSentimentEmoji(announcement.sentiment);

  return {
    header: `${impactEmoji} ${categoryEmoji} ${announcement.symbol} - ${announcement.category.toUpperCase()}`,
    summary: announcement.smartSummary || announcement.summary,
    metadata: `Impact: ${announcement.impactLevel} | Sentiment: ${sentimentEmoji} ${announcement.sentiment}`,
    date: announcement.announcementDate,
  };
}

export default {
  ANNOUNCEMENT_CATEGORIES,
  categorizeAnnouncement,
  scoreImpact,
  analyzeSentiment,
  generateSmartSummary,
  processAnnouncement,
  getCategoryEmoji,
  getImpactEmoji,
  getSentimentEmoji,
  formatAnnouncement,
};
