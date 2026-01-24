import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramOwnerUsername } from "../supabase/functions/_shared/apify-instagram.ts";

test("extractInstagramOwnerUsername prefers ownerUsername", () => {
  const item = { ownerUsername: "owner_primary" };
  assert.equal(extractInstagramOwnerUsername(item), "owner_primary");
});

test("extractInstagramOwnerUsername falls back to owner.username", () => {
  const item = { owner: { username: "owner_nested" } };
  assert.equal(extractInstagramOwnerUsername(item), "owner_nested");
});

test("extractInstagramOwnerUsername falls back to user.username", () => {
  const item = { user: { username: "owner_user" } };
  assert.equal(extractInstagramOwnerUsername(item), "owner_user");
});

test("extractInstagramOwnerUsername handles authorUsername", () => {
  const item = { authorUsername: "author_handle" };
  assert.equal(extractInstagramOwnerUsername(item), "author_handle");
});

test("extractInstagramOwnerUsername handles ownerInfo.username", () => {
  const item = { ownerInfo: { username: "owner_info_user" } };
  assert.equal(extractInstagramOwnerUsername(item), "owner_info_user");
});

test("extractInstagramOwnerUsername handles owner_username (snake_case)", () => {
  const item = { owner_username: "snake_case_user" };
  assert.equal(extractInstagramOwnerUsername(item), "snake_case_user");
});

test("extractInstagramOwnerUsername returns null for empty object", () => {
  assert.equal(extractInstagramOwnerUsername({}), null);
});

test("extractInstagramOwnerUsername returns null for null input", () => {
  assert.equal(extractInstagramOwnerUsername(null), null);
});

test("extractInstagramOwnerUsername returns null for undefined input", () => {
  assert.equal(extractInstagramOwnerUsername(undefined), null);
});

test("extractInstagramOwnerUsername trims whitespace", () => {
  const item = { ownerUsername: "  trimmed_user  " };
  assert.equal(extractInstagramOwnerUsername(item), "trimmed_user");
});

test("extractInstagramOwnerUsername returns null for empty string", () => {
  const item = { ownerUsername: "" };
  assert.equal(extractInstagramOwnerUsername(item), null);
});

test("extractInstagramOwnerUsername returns null for whitespace-only string", () => {
  const item = { ownerUsername: "   " };
  assert.equal(extractInstagramOwnerUsername(item), null);
});
