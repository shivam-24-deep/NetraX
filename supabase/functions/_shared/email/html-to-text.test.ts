import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText } from "./html-to-text.ts";

test("strips tags and decodes entities", () => {
  const out = htmlToText("<p>Hello &amp; welcome, <b>friend</b>!</p>");
  assert.equal(out, "Hello & welcome, friend!");
});

test("removes script and style blocks entirely", () => {
  const out = htmlToText("<style>.x{color:red}</style><p>Visible</p><script>alert(1)</script>");
  assert.equal(out, "Visible");
});

test("converts block-level closing tags and <br> to newlines", () => {
  const out = htmlToText("<div>Line one</div><div>Line two<br/>Line three</div>");
  assert.equal(out, "Line one\nLine two\nLine three");
});

test("preserves link targets inline as evidence", () => {
  const out = htmlToText('<a href="http://evil.example/login">Click here</a>');
  assert.equal(out, "Click here (http://evil.example/login)");
});

test("decodes numeric and hex character references", () => {
  assert.equal(htmlToText("&#65;&#x42;"), "AB");
});
