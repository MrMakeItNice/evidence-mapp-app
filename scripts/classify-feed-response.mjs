/**
 * Advisory-only feed response triage for Evidence Atlas collectors.
 * No network requests, access-control bypass, database writes, or publishing.
 * This classifier does NOT validate or parse XML and must not be treated as ingestion success.
 */

const CHALLENGE_MARKERS = /(?:access denied|captcha|verify (?:that )?you are human|checking your browser|attention required|cloudflare|just a moment|bot detection|challenge-platform|unusual traffic)/i;
const HTML_MARKERS = /(?:<!doctype\s+html\b|<html(?:\s|>))/i;
const FEED_MARKERS = /^\s*(?:<\?xml\b[^>]*\?>\s*)?(?:<!--[^]*?-->\s*)?<(?:rss\b|feed\b|rdf:RDF\b)/i;

export function classifyFeedResponse({ status, contentType = '', body = '' } = {}) {
  if (!Number.isInteger(status) || status < 100 || status > 599 || typeof body !== 'string') {
    return { kind: 'invalid_response', parse_candidate: false, retryable: false, action: 'Inspect response metadata safely.' };
  }

  // Only examine bounded text, never echo it: responses may contain tokens or private details.
  const sample = body.slice(0, 8192);
  const html = HTML_MARKERS.test(sample) || String(contentType).toLowerCase().includes('text/html');
  const challenge = CHALLENGE_MARKERS.test(sample) && (html || [401, 403, 429, 503].includes(status));
  if (challenge) {
    return { kind: 'access_challenge', parse_candidate: false, retryable: false,
      action: 'Stop parsing; record sanitized HTTP diagnostics and seek an official permitted feed or provider support. Do not bypass access controls.' };
  }
  if (status === 429) {
    return { kind: 'rate_limited', parse_candidate: false, retryable: true,
      action: 'Honor Retry-After and provider terms; do not retry immediately.' };
  }
  if (status < 200 || status >= 300) {
    return { kind: 'http_error', parse_candidate: false, retryable: status >= 500,
      action: 'Record HTTP status and investigate provider availability or configuration.' };
  }
  if (html) {
    return { kind: 'unexpected_html', parse_candidate: false, retryable: false,
      action: 'Do not parse HTML as RSS; inspect authorized feed endpoint and content type.' };
  }
  if (FEED_MARKERS.test(sample)) {
    return { kind: 'feed_xml_candidate', parse_candidate: true, retryable: false,
      action: 'Validate XML, publication dates, article identity and provenance before any review-only staging.' };
  }
  return { kind: 'unrecognized_content', parse_candidate: false, retryable: false,
    action: 'Inspect format safely; no ingestion or publication.' };
}
