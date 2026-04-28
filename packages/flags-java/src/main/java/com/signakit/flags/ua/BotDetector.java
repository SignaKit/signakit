package com.signakit.flags.ua;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Bot detection. When a bot UA is supplied via {@code $userAgent}, the SDK
 * returns disabled decisions and skips event tracking entirely.
 *
 * <p>Patterns mirror the more common entries from
 * {@code packages/flags-node/src/ua/bot-patterns.ts}. The Node version carries
 * a longer list — the patterns here cover the major search engines, social
 * crawlers, AI/LLM crawlers, monitoring, and the broad "bot/crawler/spider"
 * keyword catch-alls. Additional patterns can be added without changing
 * behavior shape.
 */
public final class BotDetector {
    private BotDetector() {}

    private static final List<String> BOT_PATTERNS = List.of(
            // Search engines
            "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider", "yandexbot",
            "sogou", "exabot", "facebot", "ia_archiver",
            // Social
            "facebookexternalhit", "twitterbot", "linkedinbot", "slackbot", "discordbot",
            "telegrambot", "whatsapp", "applebot", "pinterest",
            // SEO / monitoring
            "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "rogerbot", "screaming frog",
            "uptimerobot", "pingdom", "newrelic",
            // AI / LLM
            "gptbot", "chatgpt-user", "claudebot", "anthropic-ai", "perplexitybot",
            "ccbot", "google-extended", "bytespider",
            // Generic
            "bot", "crawler", "spider", "scraper", "fetcher", "headless", "phantomjs",
            "selenium", "puppeteer", "playwright", "lighthouse", "preview", "indexer",
            "validator", "checker", "monitor", "archiver", "scanner");

    private static final Pattern BOT_REGEX = Pattern.compile(
            BOT_PATTERNS.stream()
                    .map(BotDetector::escape)
                    .collect(Collectors.joining("|")),
            Pattern.CASE_INSENSITIVE);

    private static String escape(String s) {
        return Pattern.quote(s);
    }

    public static boolean isBot(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) return false;
        return BOT_REGEX.matcher(userAgent).find();
    }
}
