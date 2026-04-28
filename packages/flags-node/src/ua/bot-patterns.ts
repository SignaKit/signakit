/**
 * Bot detection utility for Arc Feature Flags SDK
 *
 * Pre-compiled regex for O(1) matching against known bot user-agents.
 * When a bot is detected:
 * - All flags return { variationKey: 'off', enabled: false }
 * - Events are silently skipped
 */

const BOT_PATTERNS = [
  // Search engines
  'googlebot',
  'googlebot-image',
  'googlebot-news',
  'googlebot-video',
  'google-inspectiontool',
  'googleother',
  'google-extended',
  'google-read-aloud',
  'google favicon',
  'storebot-google',
  'googleproducer',
  'google-site-verification',
  'adsbot-google',
  'mediapartners-google',
  'apis-google',
  'feedfetcher-google',
  'googleagent-mariner',
  'bingbot',
  'bingpreview',
  'bingsapphire',
  'adidxbot',
  'microsoftpreview',
  'yandex',
  'baiduspider',
  'sogou',
  'duckduckbot',
  'duckduckgo',
  'duckassistbot',
  'slurp',
  'qwantify',
  'yeti/',
  'applebot',
  'naverbot',
  'daumoa',
  'goo.ne.jp',
  'shenma',
  'haosou',
  'yahoo! slurp',

  // AI and LLM
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'anthropic-ai',
  'claude-web',
  'perplexitybot',
  'perplexity-user',
  'bytespider',
  'ccbot',
  'amazonbot',
  'meta-externalagent',
  'meta-externalfetcher',
  'cohere-ai',
  'ai2bot',
  'diffbot',
  'timpibot',
  'youbot',
  'omgili',
  'mistralai-user',
  'grokbot',
  'xai-grok',
  'grok-deepsearch',
  'bard-ai',
  'gemini-ai',
  'iaskspider',
  'kangaroo bot',
  'webzio',
  'isdb_bot',
  'deepseek',
  'deepseekbot',
  'searchgpt',
  'openai',
  'phi-3',
  'copilot',
  'sydney',
  'neeva',
  'brave-search',
  'kagibot',

  // Social media and messaging
  'facebookexternalhit',
  'facebot',
  'facebookbot',
  'twitterbot',
  'linkedinbot',
  'pinterest',
  'slackbot',
  'slack-imgproxy',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'snapchat',
  'mastodon',
  'redditbot',
  'embedly',
  'quora link preview',
  'viber',
  'iframely',
  'skypeuripreview',
  'microsoft-teams',
  'msteams',
  'zoombot',
  'linebot',
  'kakaotalk',
  'wechat',
  'bytedance',
  'tiktok',

  // SEO and marketing
  'ahrefsbot',
  'ahrefssiteaudit',
  'semrushbot',
  'mj12bot',
  'dotbot',
  'rogerbot',
  'screaming frog',
  'blexbot',
  'dataforseobot',
  'serpstatbot',
  'seokicks',
  'xenu',
  'botify',
  'jetoctopus',
  'netpeakspider',
  'contentking',
  'oncrawl',
  'zoominfobot',
  'hubspot',
  'petalbot',
  'majestic',
  'mozseobot',
  'deepcrawl',
  'lumar',
  'conductor',
  'brightedge',
  'seoclarity',
  'rytebot',
  'spyfu',
  'sistrix',
  'searchmetrics',

  // Ad verification
  'doubleverify',
  'ias-va',
  'ias_crawler',
  'moatbot',
  'oracle data cloud',
  'adbeat',
  'whatrunswhere',

  // Monitoring and performance
  'uptimerobot',
  'statuscake',
  'pingdom',
  'site24x7',
  'datadog',
  'newrelicpinger',
  'newrelicsynthetics',
  'nr-synthetics',
  'gtmetrix',
  'lighthouse',
  'pagespeed',
  'checkly',
  'better uptime',
  'montastic',
  'freshping',
  'pulsetic',
  'vercel-screenshot',
  'vercel-screenshot/1.0',
  'dynatrace',
  'appdynamics',
  'speedcurve',
  'webpagetest',
  'calibreapp',
  'debugbear',
  'treo',
  'catchpoint',
  'thousandeyes',
  'synthetic',

  // Archive and research
  'ia_archiver',
  'archive.org_bot',
  'heritrix',
  'nutch',
  'grapeshot',
  'icc-crawler',

  // Feed and content
  'feedly',
  'feedbin',
  'newsblur',
  'tiny tiny rss',
  'flipboard',
  'pocketparser',
  'bloglovin',

  // HTTP libraries and frameworks
  'python-requests',
  'python-urllib',
  'aiohttp',
  'scrapy',
  'curl/',
  'wget/',
  'go-http-client',
  'java/',
  'apache-httpclient',
  'jakarta commons',
  'okhttp',
  'node-fetch',
  'axios',
  'undici',
  'httpx',
  'libwww-perl',
  'lwp::simple',
  'php/',
  'guzzlehttp',
  'faraday',
  'dart/',
  'reqwest',

  // Headless browsers and automation
  'headlesschrome',
  'phantomjs',
  'selenium',
  'puppeteer',
  'playwright',
  'casperjs',
  'slimerjs',
  'nightmare',
  'httrack',

  // Security and vulnerability scanners
  'nmap',
  'nikto',
  'sqlmap',
  'qualys',
  'nessus',
  'detectify',
  'sucuri',
  'wappalyzer',
  'builtwith',
  'acunetix',
  'burpsuite',
  'owasp',
  'zaproxy',
  'tenable',
  'rapid7',
  'immuniweb',
  'probely',
  'intruder',
  'pentest',

  // Infrastructure
  'vercel',
  'cloudflare',
  'netlify',
  'w3c_validator',
  'w3c-checklink',

  // Privacy and compliance
  'onetrust',
  'cookiebot',
  'cookiepro',
  'trustedform',
  'activeprospect',
  'leadid',

  // Miscellaneous
  'tsmbot',
  'pageburst',
  'pandalytics',
  'seznambot',
  'coccocbot',
  'exabot',
  'proximic',
  'coc_coc_browser',
  '360spider',
  'megaindex',
  'mail.ru_bot',
  'bubing',

  // Generic patterns (keep last)
  'spider',
  'crawl',
  'bot/',
  'scraper',
  'archiver',
  'indexer',
  'preview',
  'scanner',
  'validator',
  'checker',
  'monitor',
]

// Escape special regex characters in patterns
const escapedPatterns = BOT_PATTERNS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

// Pre-compiled regex for O(1) matching
const BOT_REGEX = new RegExp(escapedPatterns.join('|'), 'i')

/**
 * Detect if a user-agent string belongs to a bot.
 *
 * @param userAgent - The user-agent string to check
 * @returns true if the user-agent matches a known bot pattern
 *
 * @example
 * ```typescript
 * isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
 * // => true
 *
 * isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
 * // => false
 *
 * isBot(undefined)
 * // => false
 * ```
 */
export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  return BOT_REGEX.test(userAgent)
}
