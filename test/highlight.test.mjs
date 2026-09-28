import test from "node:test";
import assert from "node:assert/strict";

import { highlight } from "../frontend/api/search.ts";

// Expected values were produced by running the Python this replaces
// (qdrant_demo/text_searcher.py, TextSearcher.highlight) on the same inputs.
// The `?.?` stem match makes it swallow a trailing character, which is why
// "online" comes back as "<b>online </b>" with the space inside the tag. That
// is the old behaviour, and the point of this test is that it stays that way.
const CASES = [
  {
    text: "Wetpaint offers an online social publishing platform.",
    q: "online platform",
    want: "Wetpaint offers an <b>online </b>social publishing <b>platform</b>.",
  },
  {
    text: "A platform for platforms, and the platform of platform.",
    q: "platform",
    want: "A <b>platform </b>for <b>platforms</b>, and the <b>platform </b>of <b>platform</b>.",
  },
  {
    text: "Machine learning for medical imaging and diagnostics.",
    q: "Machine Learning",
    want: "<b>Machine </b><b>learning </b>for medical imaging and diagnostics.",
  },
  {
    // Regex metacharacters in the query must not blow up the pattern.
    text: "AI-powered C++ tooling (fast).",
    q: "c++",
    want: "AI-powered C++ tooling (fast).",
  },
  {
    text: "The cat sat on the mat",
    q: "cat mat the",
    want: "<b>The</b> <b>cat</b> sat on <b>the</b> <b>mat</b>",
  },
  {
    text: "Delivery drones deliver delivered deliveries",
    q: "delivery",
    want: "<b>Delivery </b>drones <b>deliver </b>delivered deliveries",
  },
  { text: "no match here", q: "zzz", want: "no match here" },
  { text: "Dot.com bubble and dot matrix", q: "dot", want: "<b>Dot</b>.com bubble and <b>dot</b> matrix" },
];

for (const { text, q, want } of CASES) {
  test(`highlight ${JSON.stringify(q)}`, () => {
    assert.equal(highlight(text, q), want);
  });
}
