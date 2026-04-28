/// Bot detection. Port of `packages/flags-node/src/ua/bot-patterns.ts`.
///
/// When a bot is detected:
/// - All flags return `{ variationKey: 'off', enabled: false }`.
/// - Events are silently skipped.
library;

const List<String> _botPatterns = <String>[
  // Search engines
  'googlebot', 'googlebot-image', 'googlebot-news', 'googlebot-video',
  'google-inspectiontool', 'googleother', 'google-extended', 'google-read-aloud',
  'google favicon', 'storebot-google', 'googleproducer', 'google-site-verification',
  'adsbot-google', 'mediapartners-google', 'apis-google', 'feedfetcher-google',
  'googleagent-mariner', 'bingbot', 'bingpreview', 'bingsapphire', 'adidxbot',
  'microsoftpreview', 'yandex', 'baiduspider', 'sogou', 'duckduckbot',
  'duckduckgo', 'duckassistbot', 'slurp', 'qwantify', 'yeti/', 'applebot',
  'naverbot', 'daumoa', 'goo.ne.jp', 'shenma', 'haosou', 'yahoo! slurp',

  // AI and LLM
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'anthropic-ai',
  'claude-web', 'perplexitybot', 'perplexity-user', 'bytespider', 'ccbot',
  'amazonbot', 'meta-externalagent', 'meta-externalfetcher', 'cohere-ai',
  'ai2bot', 'diffbot', 'timpibot', 'youbot', 'omgili', 'mistralai-user',
  'grokbot', 'xai-grok', 'grok-deepsearch', 'bard-ai', 'gemini-ai',
  'iaskspider', 'kangaroo bot', 'webzio', 'isdb_bot', 'deepseek',
  'deepseekbot', 'searchgpt', 'openai', 'phi-3', 'copilot', 'sydney',
  'neeva', 'brave-search', 'kagibot',

  // Social media
  'facebookexternalhit', 'facebot', 'facebookbot', 'twitterbot', 'linkedinbot',
  'pinterest', 'slackbot', 'slack-imgproxy', 'discordbot', 'telegrambot',
  'whatsapp', 'snapchat', 'mastodon', 'redditbot', 'embedly',
  'quora link preview', 'viber', 'iframely', 'skypeuripreview',
  'microsoft-teams', 'msteams', 'zoombot', 'linebot', 'kakaotalk', 'wechat',
  'bytedance', 'tiktok',

  // SEO and marketing
  'ahrefsbot', 'ahrefssiteaudit', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot',
  'screaming frog', 'blexbot', 'dataforseobot', 'serpstatbot', 'seokicks',
  'xenu', 'botify', 'jetoctopus', 'netpeakspider', 'contentking', 'oncrawl',
  'zoominfobot', 'hubspot', 'petalbot', 'majestic', 'mozseobot', 'deepcrawl',
  'lumar', 'conductor', 'brightedge', 'seoclarity', 'rytebot', 'spyfu',
  'sistrix', 'searchmetrics',

  // Ad verification
  'doubleverify', 'ias-va', 'ias_crawler', 'moatbot', 'oracle data cloud',
  'adbeat', 'whatrunswhere',

  // Monitoring
  'uptimerobot', 'statuscake', 'pingdom', 'site24x7', 'datadog',
  'newrelicpinger', 'newrelicsynthetics', 'nr-synthetics', 'gtmetrix',
  'lighthouse', 'pagespeed', 'checkly', 'better uptime', 'montastic',
  'freshping', 'pulsetic', 'vercel-screenshot', 'vercel-screenshot/1.0',
  'dynatrace', 'appdynamics', 'speedcurve', 'webpagetest', 'calibreapp',
  'debugbear', 'treo', 'catchpoint', 'thousandeyes', 'synthetic',

  // Archive and research
  'ia_archiver', 'archive.org_bot', 'heritrix', 'nutch', 'grapeshot',
  'icc-crawler',

  // Feed
  'feedly', 'feedbin', 'newsblur', 'tiny tiny rss', 'flipboard',
  'pocketparser', 'bloglovin',

  // HTTP libraries and frameworks
  'python-requests', 'python-urllib', 'aiohttp', 'scrapy', 'curl/', 'wget/',
  'go-http-client', 'java/', 'apache-httpclient', 'jakarta commons', 'okhttp',
  'node-fetch', 'axios', 'undici', 'httpx', 'libwww-perl', 'lwp::simple',
  'php/', 'guzzlehttp', 'faraday', 'dart/', 'reqwest',

  // Headless browsers
  'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright',
  'casperjs', 'slimerjs', 'nightmare', 'httrack',

  // Security
  'nmap', 'nikto', 'sqlmap', 'qualys', 'nessus', 'detectify', 'sucuri',
  'wappalyzer', 'builtwith', 'acunetix', 'burpsuite', 'owasp', 'zaproxy',
  'tenable', 'rapid7', 'immuniweb', 'probely', 'intruder', 'pentest',

  // Infrastructure
  'vercel', 'cloudflare', 'netlify', 'w3c_validator', 'w3c-checklink',

  // Privacy and compliance
  'onetrust', 'cookiebot', 'cookiepro', 'trustedform', 'activeprospect',
  'leadid',

  // Misc
  'tsmbot', 'pageburst', 'pandalytics', 'seznambot', 'coccocbot', 'exabot',
  'proximic', 'coc_coc_browser', '360spider', 'megaindex', 'mail.ru_bot',
  'bubing',

  // Generic patterns (keep last)
  'spider', 'crawl', 'bot/', 'scraper', 'archiver', 'indexer', 'preview',
  'scanner', 'validator', 'checker', 'monitor',
];

String _escapeRegex(String input) {
  // Mirror JS: replace special chars with \\$&
  return input.replaceAllMapped(
    RegExp(r'[.*+?^${}()|\[\]\\]'),
    (m) => '\\${m[0]}',
  );
}

final RegExp _botRegex = RegExp(
  _botPatterns.map(_escapeRegex).join('|'),
  caseSensitive: false,
);

/// Returns `true` if [userAgent] matches a known bot pattern.
bool isBot(String? userAgent) {
  if (userAgent == null || userAgent.isEmpty) return false;
  return _botRegex.hasMatch(userAgent);
}
