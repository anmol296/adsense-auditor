/*
 * Audit helper for AdSense policy compliance
 *
 * This module encapsulates the logic required to analyse an HTML
 * document for common AdSense policy issues. It exposes two
 * functions:
 *   - analyseHtml(html, baseUrl): inspect a raw HTML string and
 *     return an object describing the page title, length and a
 *     series of boolean checks. The baseUrl is used to derive
 *     domain-specific URLs (for example for ads.txt) and may be
 *     omitted when not needed.
 *   - auditSite(url): fetch the supplied URL and run analyseHtml
 *     on its contents. If network access fails, the promise
 *     resolves with an error description.
 *
 * Keeping the pure analysis separated from network concerns makes
 * testing easier. The analyseHtml function can be unit tested
 * without performing any HTTP requests.
 */
import { readFile } from 'fs/promises';
import { basename } from 'path';

// Regular expressions used for simple string checks. These are
// intentionally broad to catch obvious violations but do not
// guarantee full policy compliance. Extend as needed.
const bannedPattern = /(porn|xxx|sex\s?cam|escort|casino|betting|gambl)/i;
const adsenseScriptPattern = /(adsbygoogle|adsense|pagead\/js)/i;
const privacyPattern = /privacy\s+policy/i;
const contactPattern = /contact(\s+us)?/i;

/**
 * Analyse a HTML document for AdSense policy readiness.
 *
 * @param {string} html Raw HTML string
 * @param {string} [baseUrl] Base URL of the page (e.g. "https://example.com")
 * @returns {Object} Result structure with page info and checks
 */
export function analyseHtml(html, baseUrl = '') {
  const result = {
    ok: true,
    page: {
      title: '',
      length: html.length,
    },
    checks: {
      banned_content: false,
      adsense_script_present: false,
      privacy_policy_present: false,
      contact_info_present: false,
      too_many_ads: false,
      ads_txt_referenced: false,
    },
    notes: [],
  };
  // Title extraction
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) result.page.title = titleMatch[1].trim();
  const lower = html.toLowerCase();
  // banned content
  result.checks.banned_content = bannedPattern.test(lower);
  // adsense script presence
  result.checks.adsense_script_present = adsenseScriptPattern.test(lower);
  // privacy policy text
  result.checks.privacy_policy_present = privacyPattern.test(lower);
  // contact page or contact info text
  result.checks.contact_info_present = contactPattern.test(lower);
  // too many ad units: approximate by counting occurrences of adsbygoogle
  const adMatches = lower.match(/adsbygoogle/g);
  if (adMatches && adMatches.length > 3) {
    result.checks.too_many_ads = true;
  }
  // ads.txt reference in HTML (not necessarily existence of file)
  result.checks.ads_txt_referenced = lower.includes('ads.txt');
  return result;
}

/**
 * Fetch a URL and perform an AdSense audit. In addition to the
 * HTML-based checks, this function attempts to verify the
 * existence of an ads.txt file by making a secondary request to
 * `https://domain/ads.txt`. If the ads.txt file is reachable and
 * returns a 200 status code, the ads_txt_exists flag is set.
 *
 * If network fetch fails, the returned object has ok: false and
 * contains an error message.
 *
 * @param {string} url Fully qualified URL (e.g. "https://example.com")
 * @returns {Promise<Object>}
 */
export async function auditSite(url) {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Invalid URL' };
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AdsenseAuditor/2.0' },
    });
    const html = await response.text();
    const result = analyseHtml(html, url);
    // Attempt to fetch ads.txt for existence check
    try {
      const { origin } = new URL(url);
      const adsTxtUrl = `${origin}/ads.txt`;
      const resTxt = await fetch(adsTxtUrl, {
        headers: { 'User-Agent': 'AdsenseAuditor/2.0' },
      });
      if (resTxt.ok) {
        result.checks.ads_txt_exists = true;
      } else {
        result.checks.ads_txt_exists = false;
      }
    } catch (e) {
      result.checks.ads_txt_exists = false;
    }
    return result;
  } catch (err) {
    return { ok: false, error: 'Fetch failed', detail: err?.message || String(err) };
  }
}
