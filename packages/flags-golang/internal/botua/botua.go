// Package botua detects bot user-agents.
//
// Patterns mirror packages/flags-node/src/ua/bot-patterns.ts. Match is
// case-insensitive substring (compiled into one alternation regexp).
package botua

import (
	"regexp"
	"strings"
)

// patterns is the canonical bot-substring list. Keep in sync with the TS SDK.
var patterns = []string{
	// Search engines
	"googlebot", "googlebot-image", "googlebot-news", "googlebot-video",
	"google-inspectiontool", "googleother", "google-extended", "google-read-aloud",
	"google favicon", "storebot-google", "googleproducer", "google-site-verification",
	"adsbot-google", "mediapartners-google", "apis-google", "feedfetcher-google",
	"googleagent-mariner", "bingbot", "bingpreview", "bingsapphire", "adidxbot",
	"microsoftpreview", "yandex", "baiduspider", "sogou", "duckduckbot", "duckduckgo",
	"duckassistbot", "slurp", "qwantify", "yeti/", "applebot", "naverbot", "daumoa",
	"goo.ne.jp", "shenma", "haosou", "yahoo! slurp",
	// AI / LLM
	"gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "anthropic-ai",
	"claude-web", "perplexitybot", "perplexity-user", "bytespider", "ccbot",
	"amazonbot", "meta-externalagent", "meta-externalfetcher", "cohere-ai",
	"ai2bot", "diffbot", "timpibot", "youbot", "omgili", "mistralai-user",
	"grokbot", "xai-grok", "grok-deepsearch", "bard-ai", "gemini-ai",
	"iaskspider", "kangaroo bot", "webzio", "isdb_bot", "deepseek", "deepseekbot",
	"searchgpt", "openai", "phi-3", "copilot", "sydney", "neeva", "brave-search", "kagibot",
	// Social
	"facebookexternalhit", "facebot", "facebookbot", "twitterbot", "linkedinbot",
	"pinterest", "slackbot", "slack-imgproxy", "discordbot", "telegrambot",
	"whatsapp", "snapchat", "mastodon", "redditbot", "embedly",
	"quora link preview", "viber", "iframely", "skypeuripreview",
	"microsoft-teams", "msteams", "zoombot", "linebot", "kakaotalk", "wechat",
	"bytedance", "tiktok",
	// SEO / marketing
	"ahrefsbot", "ahrefssiteaudit", "semrushbot", "mj12bot", "dotbot", "rogerbot",
	"screaming frog", "blexbot", "dataforseobot", "serpstatbot", "seokicks", "xenu",
	"botify", "jetoctopus", "netpeakspider", "contentking", "oncrawl", "zoominfobot",
	"hubspot", "petalbot", "majestic", "mozseobot", "deepcrawl", "lumar", "conductor",
	"brightedge", "seoclarity", "rytebot", "spyfu", "sistrix", "searchmetrics",
	// Ad verification
	"doubleverify", "ias-va", "ias_crawler", "moatbot", "oracle data cloud",
	"adbeat", "whatrunswhere",
	// Monitoring
	"uptimerobot", "statuscake", "pingdom", "site24x7", "datadog", "newrelicpinger",
	"newrelicsynthetics", "nr-synthetics", "gtmetrix", "lighthouse", "pagespeed",
	"checkly", "better uptime", "montastic", "freshping", "pulsetic",
	"vercel-screenshot", "vercel-screenshot/1.0", "dynatrace", "appdynamics",
	"speedcurve", "webpagetest", "calibreapp", "debugbear", "treo", "catchpoint",
	"thousandeyes", "synthetic",
	// Archive
	"ia_archiver", "archive.org_bot", "heritrix", "nutch", "grapeshot", "icc-crawler",
	// Feeds
	"feedly", "feedbin", "newsblur", "tiny tiny rss", "flipboard", "pocketparser", "bloglovin",
	// HTTP libs
	"python-requests", "python-urllib", "aiohttp", "scrapy", "curl/", "wget/",
	"go-http-client", "java/", "apache-httpclient", "jakarta commons", "okhttp",
	"node-fetch", "axios", "undici", "httpx", "libwww-perl", "lwp::simple", "php/",
	"guzzlehttp", "faraday", "dart/", "reqwest",
	// Headless
	"headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright",
	"casperjs", "slimerjs", "nightmare", "httrack",
	// Security
	"nmap", "nikto", "sqlmap", "qualys", "nessus", "detectify", "sucuri",
	"wappalyzer", "builtwith", "acunetix", "burpsuite", "owasp", "zaproxy",
	"tenable", "rapid7", "immuniweb", "probely", "intruder", "pentest",
	// Infra
	"vercel", "cloudflare", "netlify", "w3c_validator", "w3c-checklink",
	// Privacy
	"onetrust", "cookiebot", "cookiepro", "trustedform", "activeprospect", "leadid",
	// Misc
	"tsmbot", "pageburst", "pandalytics", "seznambot", "coccocbot", "exabot",
	"proximic", "coc_coc_browser", "360spider", "megaindex", "mail.ru_bot", "bubing",
	// Generic (last)
	"spider", "crawl", "bot/", "scraper", "archiver", "indexer", "preview",
	"scanner", "validator", "checker", "monitor",
}

var botRegex = compileBotRegex()

func compileBotRegex() *regexp.Regexp {
	escaped := make([]string, len(patterns))
	for i, p := range patterns {
		escaped[i] = regexp.QuoteMeta(p)
	}
	return regexp.MustCompile("(?i)" + strings.Join(escaped, "|"))
}

// IsBot reports whether ua matches any known bot substring (case-insensitive).
// Empty input returns false.
func IsBot(ua string) bool {
	if ua == "" {
		return false
	}
	return botRegex.MatchString(ua)
}
