/*
 * decide.test.js: checks for js/decide.js.   Run: node tests/decide.test.js
 * Same style as storage.test.js: no libraries, assert + a tiny runner.
 */
"use strict";
var assert = require("assert");
var Store = require("../js/storage.js");
var Decide = require("../js/decide.js");

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }

// Quick item maker. "remaining" lets a test make a defeated item (0).
function make(name, block, remaining) {
  var item = Store.createItem({ name: name, type: "watch", totalMinutes: 500, minBlockMinutes: block });
  if (remaining !== undefined) item.remainingMinutes = remaining;
  return item;
}
// A fake "random" that always returns the same number (0 up to just under 1).
function fixed(value) { return function () { return value; }; }
function names(list) { return list.map(function (i) { return i.name; }); }

console.log("validateMinutes");
test("accepts whole numbers above 0", function () {
  assert.strictEqual(Decide.validateMinutes(20).ok, true);
});
test("rejects 0, negatives, decimals, text, and NaN", function () {
  [0, -5, 12.5, "20", NaN].forEach(function (bad) {
    assert.strictEqual(Decide.validateMinutes(bad).ok, false);
  });
});

console.log("rankFits");
test("keeps qualifying items, closest minimum block first", function () {
  var items = [make("a", 10), make("b", 45), make("c", 30), make("tooBig", 90)];
  assert.deepStrictEqual(names(Decide.rankFits(items, 60)), ["b", "c", "a"]);
});
test("an item whose minimum block equals your minutes qualifies", function () {
  assert.deepStrictEqual(names(Decide.rankFits([make("a", 60)], 60)), ["a"]);
});
test("skips defeated items", function () {
  assert.deepStrictEqual(names(Decide.rankFits([make("done", 20, 0), make("a", 10)], 60)), ["a"]);
});
test("ties keep shelf order", function () {
  assert.deepStrictEqual(names(Decide.rankFits([make("first", 30), make("second", 30)], 60)), ["first", "second"]);
});

console.log("closestMiss");
test("finds the smallest minimum block above your minutes", function () {
  var items = [make("a", 30), make("b", 20), make("c", 90)];
  assert.strictEqual(Decide.closestMiss(items, 5).name, "b");
});
test("ignores defeated items, and returns null if none are left", function () {
  assert.strictEqual(Decide.closestMiss([make("done", 20, 0)], 5), null);
  assert.strictEqual(Decide.closestMiss([], 5), null);
});

console.log("startSearch");
test("candidates are the closest three, never more", function () {
  var items = [make("a", 10), make("b", 20), make("c", 30), make("d", 40)];
  var s = Decide.startSearch(items, 60);
  assert.strictEqual(s.status, "fit");
  assert.deepStrictEqual(names(s.candidates), ["d", "c", "b"]);
  assert.ok(s.candidates.indexOf(s.pick) !== -1);
  assert.strictEqual(s.rerollUsed, false);
});
test("the pick follows the random number", function () {
  var items = [make("a", 10), make("b", 20), make("c", 30)];
  assert.strictEqual(Decide.startSearch(items, 60, fixed(0)).pick.name, "c");      // first candidate
  assert.strictEqual(Decide.startSearch(items, 60, fixed(0.99)).pick.name, "a");   // last candidate
});
test("offers the closest miss when nothing fits", function () {
  var s = Decide.startSearch([make("a", 30), make("b", 20)], 10);
  assert.strictEqual(s.status, "closest");
  assert.strictEqual(s.pick.name, "b");
});
test("reports empty when nothing is left to pick", function () {
  assert.strictEqual(Decide.startSearch([], 10).status, "empty");
  assert.strictEqual(Decide.startSearch([make("done", 5, 0)], 60).status, "empty");
});

console.log("reroll");
test("picks a different candidate and marks the reroll used", function () {
  var items = [make("a", 10), make("b", 20), make("c", 30)];
  var first = Decide.startSearch(items, 60, fixed(0));       // picks c
  var second = Decide.reroll(first, fixed(0));
  assert.notStrictEqual(second.pick, first.pick);
  assert.strictEqual(second.rerollUsed, true);
  assert.strictEqual(first.rerollUsed, false);                // original untouched
});
test("only one reroll per search", function () {
  var items = [make("a", 10), make("b", 20), make("c", 30)];
  var second = Decide.reroll(Decide.startSearch(items, 60), fixed(0));
  assert.strictEqual(Decide.canReroll(second), false);
  assert.strictEqual(Decide.reroll(second), null);
});
test("a reroll can only land on the remaining candidates", function () {
  var items = [make("a", 10), make("b", 20), make("c", 30)];
  var first = Decide.startSearch(items, 60, fixed(0));        // c
  [0, 0.4, 0.99].forEach(function (r) {
    assert.notStrictEqual(Decide.reroll(first, fixed(r)).pick, first.pick);
  });
});
test("no reroll with one candidate, or for a closest match", function () {
  assert.strictEqual(Decide.canReroll(Decide.startSearch([make("a", 10)], 60)), false);
  assert.strictEqual(Decide.canReroll(Decide.startSearch([make("a", 30)], 10)), false);
});
test("a candidate defeated since the search is skipped", function () {
  var a = make("a", 10), b = make("b", 20);
  var s = Decide.startSearch([a, b], 60, fixed(0));           // picks b
  a.remainingMinutes = 0;
  assert.strictEqual(Decide.canReroll(s), false);
});

console.log("\n" + passed + " tests passed.");
