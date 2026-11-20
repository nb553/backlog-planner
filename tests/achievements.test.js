/*
 * achievements.test.js: checks for js/achievements.js.
 * Run: node tests/achievements.test.js
 */
"use strict";
var assert = require("assert");
var Store = require("../js/storage.js");
var Ach = require("../js/achievements.js");

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }

function make(name, remaining, completedAt) {
  var item = Store.createItem({ name: name, type: "read", totalMinutes: 100, minBlockMinutes: 10 });
  item.remainingMinutes = remaining;
  if (completedAt) item.completedAt = completedAt;
  return item;
}
function names(list) { return list.map(function (i) { return i.name; }); }

console.log("type data");
test("every item type has a title and a valid 8x8 icon", function () {
  Store.TYPES.forEach(function (type) {
    assert.ok(Ach.TITLES[type], type + " needs a title");
    var icon = Ach.ICONS[type];
    assert.ok(icon, type + " needs an icon");
    assert.strictEqual(icon.length, 8);
    icon.forEach(function (row) { assert.ok(/^[X.]{8}$/.test(row), "bad row in " + type); });
    assert.ok(icon.join("").indexOf("X") !== -1, type + " icon is blank");
  });
});
test("move achievement is titled Touched Grass", function () {
  assert.strictEqual(Ach.TITLES.move, "Touched Grass");
});

console.log("splitItems");
test("separates items still on the shelf from completed ones", function () {
  var a = make("a", 50), b = make("b", 0), c = make("c", 10);
  var parts = Ach.splitItems([a, b, c]);
  assert.deepStrictEqual(names(parts.active), ["a", "c"]);
  assert.deepStrictEqual(names(parts.done), ["b"]);
});
test("completed items are newest first; ones with no date go last", function () {
  var old = make("old", 0, "2026-01-01T00:00:00.000Z");
  var recent = make("recent", 0, "2026-11-01T00:00:00.000Z");
  var undated = make("undated", 0);
  assert.deepStrictEqual(names(Ach.splitItems([undated, old, recent]).done), ["recent", "old", "undated"]);
});
test("an empty list splits into two empty lists", function () {
  assert.deepStrictEqual(Ach.splitItems([]), { active: [], done: [] });
});

console.log("\n" + passed + " tests passed.");
