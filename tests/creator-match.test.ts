import test from "node:test";
import assert from "node:assert/strict";
import { handlesMatch } from "../supabase/functions/_shared/handle-utils.ts";

test("handlesMatch ignores @ and casing", () => {
  assert.equal(handlesMatch("@Automobil_Poacher", "automobil_poacher"), true);
  assert.equal(handlesMatch("AUTOMOBIL_POACHER", "@automobil_poacher"), true);
});

test("handlesMatch returns false for missing handles", () => {
  assert.equal(handlesMatch(null, "someone"), false);
  assert.equal(handlesMatch("someone", null), false);
});

test("handlesMatch handles whitespace", () => {
  assert.equal(handlesMatch("  @handle  ", "handle"), true);
  assert.equal(handlesMatch("handle", "  handle  "), true);
});

test("handlesMatch handles multiple @ symbols", () => {
  assert.equal(handlesMatch("@@handle", "@handle"), true);
  assert.equal(handlesMatch("@@@user", "user"), true);
});

test("handlesMatch returns false for empty strings", () => {
  assert.equal(handlesMatch("", "handle"), false);
  assert.equal(handlesMatch("handle", ""), false);
  assert.equal(handlesMatch("", ""), false);
});

test("handlesMatch returns false for whitespace-only strings", () => {
  assert.equal(handlesMatch("   ", "handle"), false);
  assert.equal(handlesMatch("handle", "   "), false);
});

test("handlesMatch handles undefined", () => {
  assert.equal(handlesMatch(undefined, "someone"), false);
  assert.equal(handlesMatch("someone", undefined), false);
});

test("handlesMatch handles mixed case with special chars", () => {
  assert.equal(handlesMatch("@User_Name123", "user_name123"), true);
  assert.equal(handlesMatch("USER.NAME", "@user.name"), true);
});
