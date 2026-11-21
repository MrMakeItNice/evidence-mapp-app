import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyFeedResponse } from '../scripts/classify-feed-response.mjs';

test('403 HTML access challenge is not classified as RSS parse failure', () => {
  const out = classifyFeedResponse({status:403,contentType:'text/html',body:'<html><title>Just a moment...</title><p>Verify you are human</p></html>'});
  assert.equal(out.kind,'access_challenge');
  assert.equal(out.parse_candidate,false);
  assert.equal(out.retryable,false);
});

test('HTTP 200 bot challenge is still blocked from XML parser', () => {
  const out=classifyFeedResponse({status:200,contentType:'text/html',body:'<!DOCTYPE html><html>CAPTCHA challenge</html>'});
  assert.equal(out.kind,'access_challenge');
});

test('non-challenge 403 and 500 remain HTTP errors', () => {
  assert.equal(classifyFeedResponse({status:403,body:'Forbidden'}).kind,'http_error');
  assert.equal(classifyFeedResponse({status:500,body:'Oops'}).retryable,true);
});

test('429 is rate-limited with provider-respecting retry guidance', () => {
  const out=classifyFeedResponse({status:429,body:'Too many requests'});
  assert.equal(out.kind,'rate_limited');
  assert.equal(out.retryable,true);
});

test('RSS 2 and Atom are only XML candidates, not declared valid', () => {
  for (const body of ['<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>', '<feed xmlns="http://www.w3.org/2005/Atom"></feed>']) {
    const out=classifyFeedResponse({status:200,contentType:'application/xml',body});
    assert.equal(out.kind,'feed_xml_candidate');
    assert.equal(out.parse_candidate,true);
  }
});

test('mislabelled HTML and JSON are not feed candidates', () => {
  assert.equal(classifyFeedResponse({status:200,contentType:'application/rss+xml',body:'<html>Hello</html>'}).kind,'unexpected_html');
  assert.equal(classifyFeedResponse({status:200,contentType:'application/json',body:'{"ok":true}'}).kind,'unrecognized_content');
});

test('unsafe response body is never emitted and invalid response does not throw', () => {
  const secret='private-secret-marker';
  const out=classifyFeedResponse({status:403,body:`<html>Access Denied ${secret}</html>`});
  assert.ok(!JSON.stringify(out).includes(secret));
  assert.equal(classifyFeedResponse({status:'403',body:'test'}).kind,'invalid_response');
  assert.equal(classifyFeedResponse().kind,'invalid_response');
});
