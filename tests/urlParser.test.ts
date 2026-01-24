import test from "node:test";
import assert from "node:assert/strict";
import { parseInstagramUrl } from "../src/lib/utils/urlParser.ts";

test("parseInstagramUrl extracts post shortcode", () => {
  const result = parseInstagramUrl(
    "https://www.instagram.com/p/ABC123/?utm_source=ig_web_copy_link"
  );
  assert.equal(result.shortcode, "ABC123");
  assert.equal(result.type, "p");
  assert.equal(result.isProfileUrl, false);
});

test("parseInstagramUrl extracts reel shortcode", () => {
  const result = parseInstagramUrl("https://instagram.com/reel/XYZ789/");
  assert.equal(result.shortcode, "XYZ789");
  assert.equal(result.type, "reel");
  assert.equal(result.isProfileUrl, false);
});

test("parseInstagramUrl detects profile URLs", () => {
  const result = parseInstagramUrl("https://www.instagram.com/creator.handle/");
  assert.equal(result.shortcode, null);
  assert.equal(result.isProfileUrl, true);
  assert.equal(result.username, "creator.handle");
});

test("parseInstagramUrl handles igsh tracking parameter", () => {
  const result = parseInstagramUrl(
    "https://www.instagram.com/reel/DEFghi/?igsh=abc123xyz"
  );
  assert.equal(result.shortcode, "DEFghi");
  assert.equal(result.type, "reel");
  assert.equal(result.isProfileUrl, false);
});

test("parseInstagramUrl handles URL without trailing slash", () => {
  const result = parseInstagramUrl("https://instagram.com/p/ABC123");
  assert.equal(result.shortcode, "ABC123");
  assert.equal(result.type, "p");
});

test("parseInstagramUrl handles tv type", () => {
  const result = parseInstagramUrl("https://www.instagram.com/tv/IGTV_VIDEO/");
  assert.equal(result.shortcode, "IGTV_VIDEO");
  assert.equal(result.type, "tv");
  assert.equal(result.isProfileUrl, false);
});

test("parseInstagramUrl handles shortcode with hyphens and underscores", () => {
  const result = parseInstagramUrl(
    "https://www.instagram.com/p/ABC_123-xyz/"
  );
  assert.equal(result.shortcode, "ABC_123-xyz");
});

test("parseInstagramUrl handles multiple query parameters", () => {
  const result = parseInstagramUrl(
    "https://www.instagram.com/reel/TEST123/?igsh=abc&utm_source=share&utm_medium=copy"
  );
  assert.equal(result.shortcode, "TEST123");
  assert.equal(result.type, "reel");
});
