/*
 * storage.test.js: automated checks for js/storage.js.
 *
 * Run with:   node tests/storage.test.js
 *
 * No libraries needed. Each test runs a piece of storage.js through one
 * situation and uses "assert" to confirm the result. If an assertion is
 * wrong, Node stops and prints the failure. If everything passes, you
 * see the "tests passed" line at the bottom.
 *
 * Why tests are worth writing: change the code later, re-run this file,
 * and you instantly know whether you broke something that used to work.
 */
"use strict";

// "require" is how Node loads other files and built-in tools.
// assert is built into Node. Store is our own storage.js, which exports
// BacklogStore at the bottom of that file.
var assert = require("assert");
var Store = require("../js/storage.js");

// ---------------------------------------------------------------
// TEST TOOLS
// ---------------------------------------------------------------

// Node has no browser localStorage, and we wouldn't want tests to touch
// real saved data anyway. So we build a FAKE one that keeps its data in a
// plain object. It only needs the two methods storage.js calls:
// getItem and setItem.
function fakeStorage(initial) {
  // Object.assign copies "initial" into a fresh object, so a test can
  // start the fake storage with pre-filled data.
  var data = Object.assign({}, initial);
  return {
    // "k in data" asks whether the key exists. Real localStorage returns
    // null for a missing key, so the fake does too.
    getItem: function (k) { return k in data ? data[k] : null; },
    // Real localStorage turns every value into text, so String() does too.
    setItem: function (k, v) { data[k] = String(v); }
  };
}

// A tiny test runner: run the function, count it, print "ok".
// If the function's assertions fail, they throw an error and the script
// stops, so "ok" only prints for tests that passed.
var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

// A known-good item that many tests reuse. Each test then changes ONE
// field to break it, which proves that one field is being checked.
var good = { name: "Severance", type: "watch", totalMinutes: 450, minBlockMinutes: 45 };

// ---------------------------------------------------------------
// TESTS FOR validateItem
// ---------------------------------------------------------------
console.log("validateItem");

test("accepts a valid item", function () {
  assert.strictEqual(Store.validateItem(good).ok, true);
});

test("accepts move and keeps the type lowercase", function () {
  var input = { name: "Walk", type: "move", totalMinutes: 60, minBlockMinutes: 10 };
  assert.strictEqual(Store.validateItem(input).ok, true);
  assert.strictEqual(Store.createItem(input).type, "move");
});

test("rejects a blank name", function () {
  // Object.assign({}, good, { name: "   " }) means "a copy of good,
  // with name replaced by three spaces."
  var r = Store.validateItem(Object.assign({}, good, { name: "   " }));
  assert.strictEqual(r.ok, false);
});

test("rejects an unknown type", function () {
  assert.strictEqual(Store.validateItem(Object.assign({}, good, { type: "walk" })).ok, false);
});

test("rejects zero, negative, and fractional minutes", function () {
  // forEach runs the inner function once per value in the list, so one
  // test covers three bad inputs for both minute fields.
  [0, -5, 12.5].forEach(function (n) {
    assert.strictEqual(Store.validateItem(Object.assign({}, good, { totalMinutes: n })).ok, false);
    assert.strictEqual(Store.validateItem(Object.assign({}, good, { minBlockMinutes: n })).ok, false);
  });
});

test("rejects minutes given as text", function () {
  // "450" in quotes is text, not a number. Form inputs arrive as text,
  // so this reminds us to convert them in step 2.
  assert.strictEqual(Store.validateItem(Object.assign({}, good, { totalMinutes: "450" })).ok, false);
});

test("rejects a minimum block bigger than the total", function () {
  var r = Store.validateItem(Object.assign({}, good, { totalMinutes: 30, minBlockMinutes: 60 }));
  assert.strictEqual(r.ok, false);
});

test("handles missing input without crashing", function () {
  assert.strictEqual(Store.validateItem(undefined).ok, false);
});

// ---------------------------------------------------------------
// TESTS FOR createItem
// ---------------------------------------------------------------
console.log("createItem");

test("builds a full item with remaining equal to total", function () {
  var item = Store.createItem(good);
  assert.strictEqual(item.remainingMinutes, 450);
  assert.strictEqual(item.totalMinutes, 450);
  // assert.ok checks that the value is "truthy" (exists and isn't empty).
  assert.ok(item.id && item.createdAt);
});

test("trims the name", function () {
  assert.strictEqual(Store.createItem(Object.assign({}, good, { name: "  Dune  " })).name, "Dune");
});

test("gives each item a different id", function () {
  assert.notStrictEqual(Store.createItem(good).id, Store.createItem(good).id);
});

test("throws on invalid input", function () {
  // assert.throws passes only if the function inside throws an error.
  assert.throws(function () { Store.createItem({}); });
});

// ---------------------------------------------------------------
// TESTS FOR saveItems AND loadItems
// ---------------------------------------------------------------
console.log("saveItems / loadItems");

test("round-trips a list", function () {
  // "Round trip" means: save it, load it, and get back exactly what
  // went in. This is the most important behavior of the whole file.
  var store = fakeStorage();
  var items = [
    Store.createItem(good),
    Store.createItem({ name: "Portfolio site", type: "build", totalMinutes: 600, minBlockMinutes: 30 }),
    Store.createItem({ name: "Walk", type: "move", totalMinutes: 60, minBlockMinutes: 10 })
  ];
  assert.strictEqual(Store.saveItems(items, store), true);
  // deepStrictEqual compares contents, not just whether it's the same object.
  assert.deepStrictEqual(Store.loadItems(store), items);
});

test("empty storage loads as an empty list", function () {
  assert.deepStrictEqual(Store.loadItems(fakeStorage()), []);
});

test("corrupt JSON loads as an empty list", function () {
  // Pre-fill the fake storage with broken text. Square brackets let us
  // use the constant's value as the key name.
  var s = {}; s[Store.STORAGE_KEY] = "{not json";
  assert.deepStrictEqual(Store.loadItems(fakeStorage(s)), []);
});

test("non-array data loads as an empty list", function () {
  var s = {}; s[Store.STORAGE_KEY] = JSON.stringify({ hello: "world" });
  assert.deepStrictEqual(Store.loadItems(fakeStorage(s)), []);
});

test("damaged items are dropped, valid ones kept", function () {
  // One good item mixed with three kinds of junk. Only the good one
  // should survive.
  var valid = Store.createItem(good);
  var s = {}; s[Store.STORAGE_KEY] = JSON.stringify([valid, { id: "x" }, null, "junk"]);
  assert.deepStrictEqual(Store.loadItems(fakeStorage(s)), [valid]);
});

test("an item with remaining above total is dropped", function () {
  // Copy a real item but set remaining to an impossible number.
  var bad = Object.assign({}, Store.createItem(good), { remainingMinutes: 9999 });
  var s = {}; s[Store.STORAGE_KEY] = JSON.stringify([bad]);
  assert.deepStrictEqual(Store.loadItems(fakeStorage(s)), []);
});

test("saveItems returns false when the browser refuses", function () {
  // A fake storage whose setItem always fails, like a full browser.
  var broken = {
    getItem: function () { return null; },
    setItem: function () { throw new Error("full"); }
  };
  assert.strictEqual(Store.saveItems([], broken), false);
});

// ---------------------------------------------------------------
// TESTS FOR applyDamage
// ---------------------------------------------------------------
console.log("applyDamage");

test("lowers remaining minutes by the amount logged", function () {
  var item = Store.createItem(good);          // 450 remaining
  var r = Store.applyDamage(item, 45);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dealt, 45);
  assert.strictEqual(r.clamped, false);
  assert.strictEqual(r.defeated, false);
  assert.strictEqual(item.remainingMinutes, 405);
  // The total never changes; it's the full size of the health bar.
  assert.strictEqual(item.totalMinutes, 450);
});

test("logs add up across several sessions", function () {
  var item = Store.createItem(good);
  Store.applyDamage(item, 100);
  Store.applyDamage(item, 50);
  assert.strictEqual(item.remainingMinutes, 300);
});

test("logging exactly what is left defeats it", function () {
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  var r = Store.applyDamage(item, 60);
  assert.strictEqual(r.defeated, true);
  assert.strictEqual(r.clamped, false);
  assert.strictEqual(item.remainingMinutes, 0);
});

test("logging more than is left stops at zero and says so", function () {
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  Store.applyDamage(item, 50);                 // 10 left
  var r = Store.applyDamage(item, 30);
  assert.strictEqual(r.dealt, 10);             // only 10 counted
  assert.strictEqual(r.clamped, true);
  assert.strictEqual(r.defeated, true);
  assert.strictEqual(item.remainingMinutes, 0); // never negative
});

test("rejects zero, negative, fractional, and text minutes", function () {
  [0, -5, 12.5, "20", NaN].forEach(function (bad) {
    var item = Store.createItem(good);
    var r = Store.applyDamage(item, bad);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error);
    // A rejected log must leave the item untouched.
    assert.strictEqual(item.remainingMinutes, 450);
  });
});

test("rejects logging on something already defeated", function () {
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  Store.applyDamage(item, 60);
  var r = Store.applyDamage(item, 5);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(item.remainingMinutes, 0);
});

test("a defeated item survives a save and load", function () {
  // Zero remaining is allowed by loadItems, so progress isn't lost.
  var store = fakeStorage();
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  Store.applyDamage(item, 60);
  Store.saveItems([item], store);
  assert.deepStrictEqual(Store.loadItems(store), [item]);
});

console.log("completion and deleting");

test("defeating an item stamps a completedAt date", function () {
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  Store.applyDamage(item, 30);
  assert.strictEqual(item.completedAt, undefined);      // not done yet
  Store.applyDamage(item, 30);
  assert.ok(!isNaN(Date.parse(item.completedAt)));      // a real date
});

test("removeItem drops only the matching id and keeps the order", function () {
  var a = Store.createItem(good), b = Store.createItem(good), c = Store.createItem(good);
  var list = [a, b, c];
  assert.deepStrictEqual(Store.removeItem(list, b.id), [a, c]);
  assert.strictEqual(list.length, 3);                   // original untouched
});

test("removeItem with an unknown id changes nothing; removing the last gives []", function () {
  var a = Store.createItem(good);
  assert.deepStrictEqual(Store.removeItem([a], "nope"), [a]);
  assert.deepStrictEqual(Store.removeItem([a], a.id), []);
});

console.log("backup and restore");

// A finished item, for tests that need a completedAt date.
function finished() {
  var item = Store.createItem(Object.assign({}, good, { totalMinutes: 60 }));
  Store.applyDamage(item, 60);
  return item;
}

test("makeBackup wraps the items with an app name, version, and date", function () {
  var b = Store.makeBackup([], new Date("2026-11-14T10:00:00.000Z"));
  assert.strictEqual(b.app, "backlog-planner");
  assert.strictEqual(b.version, 1);
  assert.strictEqual(b.exportedAt, "2026-11-14T10:00:00.000Z");
  assert.deepStrictEqual(b.items, []);
});

test("backupFileName uses the local date, zero-padded", function () {
  assert.strictEqual(Store.backupFileName(new Date(2026, 10, 14)), "backlog-planner-backup-2026-11-14.json");
  assert.strictEqual(Store.backupFileName(new Date(2026, 0, 5)), "backlog-planner-backup-2026-01-05.json");
});

test("a backup round-trips, including a finished item's date", function () {
  var items = [Store.createItem(good), finished()];
  var parsed = Store.parseBackup(JSON.stringify(Store.makeBackup(items)));
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.skipped, 0);
  assert.deepStrictEqual(parsed.items, items);
});

test("parseBackup accepts a bare list and an empty backup", function () {
  var item = Store.createItem(good);
  assert.deepStrictEqual(Store.parseBackup(JSON.stringify([item])).items, [item]);
  var empty = Store.parseBackup(JSON.stringify(Store.makeBackup([])));
  assert.strictEqual(empty.ok, true);
  assert.deepStrictEqual(empty.items, []);
});

test("parseBackup rejects text that isn't a backup, without throwing", function () {
  assert.strictEqual(Store.parseBackup("{not json").ok, false);
  assert.strictEqual(Store.parseBackup('{"hello":"world"}').ok, false);
  assert.strictEqual(Store.parseBackup("42").ok, false);
  assert.strictEqual(Store.parseBackup("null").ok, false);
  assert.strictEqual(Store.parseBackup('{"items":[{"id":"x"}]}').ok, false);   // nothing usable
});

test("parseBackup skips bad items but keeps good ones, and says how many", function () {
  var good1 = Store.createItem(good);
  var text = JSON.stringify({ items: [good1, { id: "x" }, null, "junk"] });
  var parsed = Store.parseBackup(text);
  assert.deepStrictEqual(parsed.items, [good1]);
  assert.strictEqual(parsed.skipped, 3);
});

test("parseBackup rebuilds items: drops unknown fields, trims long names", function () {
  var item = Store.createItem(good);
  var dirty = Object.assign({}, item, { evil: "<script>", name: "  " + new Array(200).join("a") + "  " });
  var clean = Store.parseBackup(JSON.stringify([dirty])).items[0];
  assert.strictEqual(clean.evil, undefined);
  assert.strictEqual(clean.name.length, 80);
});

test("parseBackup rejects ids that could break selectors, and impossible sizes", function () {
  var item = Store.createItem(good);
  [Object.assign({}, item, { id: 'x"] y' }),
   Object.assign({}, item, { id: "" }),
   Object.assign({}, item, { minBlockMinutes: 9999 }),
   Object.assign({}, item, { name: "   " })].forEach(function (bad) {
    assert.strictEqual(Store.parseBackup(JSON.stringify([bad])).ok, false);
  });
});

test("a completion date is dropped from an unfinished item", function () {
  var item = Object.assign({}, Store.createItem(good), { completedAt: "2026-01-01T00:00:00.000Z" });
  assert.strictEqual(Store.parseBackup(JSON.stringify([item])).items[0].completedAt, undefined);
});

test("mergeItems adds new items and never removes any", function () {
  var a = Store.createItem(good), b = Store.createItem(good);
  var current = [a];
  var r = Store.mergeItems(current, [b]);
  assert.deepStrictEqual(r.items, [a, b]);
  assert.strictEqual(r.added, 1);
  assert.strictEqual(current.length, 1);              // original list untouched
  assert.deepStrictEqual(Store.mergeItems([a, b], []).items, [a, b]);
});

test("mergeItems keeps the current copy unless the backup has more progress", function () {
  var a = Store.createItem(good);
  Store.applyDamage(a, 100);                          // 350 left
  var behind = Object.assign({}, a, { remainingMinutes: 400 });
  var same = Object.assign({}, a);
  var r = Store.mergeItems([a], [behind, same]);
  assert.strictEqual(r.kept, 2);
  assert.strictEqual(r.updated, 0);
  assert.strictEqual(a.remainingMinutes, 350);
});

test("mergeItems takes more progress, updating the same object in place", function () {
  var a = Store.createItem(good);
  var ahead = Object.assign({}, a, { remainingMinutes: 0, completedAt: "2026-11-01T00:00:00.000Z" });
  var current = [a];
  var r = Store.mergeItems(current, [ahead]);
  assert.strictEqual(r.updated, 1);
  assert.strictEqual(r.items[0], a);                  // same object, not a copy
  assert.strictEqual(a.remainingMinutes, 0);
  assert.strictEqual(a.completedAt, "2026-11-01T00:00:00.000Z");
});

console.log("editing");

// Same fields the form sends, with overrides.
function edit(overrides) {
  return Object.assign({ name: "Severance", type: "watch", totalMinutes: 450, minBlockMinutes: 45 }, overrides);
}

test("a bigger total keeps logged time logged", function () {
  var item = Store.createItem(good);
  Store.applyDamage(item, 100);                         // 350 left
  var r = Store.updateItem(item, edit({ totalMinutes: 600 }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(item.remainingMinutes, 500);       // 600 - 100 logged
  assert.strictEqual(r.logged, 100);
});

test("a smaller total keeps logged time logged", function () {
  var item = Store.createItem(good);
  Store.applyDamage(item, 100);
  Store.updateItem(item, edit({ totalMinutes: 300 }));
  assert.strictEqual(item.remainingMinutes, 200);       // 300 - 100 logged
});

test("a total at or below what's logged finishes the item", function () {
  var item = Store.createItem(good);
  Store.applyDamage(item, 100);
  var plan = Store.planUpdate(item, edit({ totalMinutes: 100 }));
  assert.strictEqual(plan.completes, true);
  Store.updateItem(item, edit({ totalMinutes: 80 }));   // even less than logged
  assert.strictEqual(item.remainingMinutes, 0);         // never negative
  assert.ok(!isNaN(Date.parse(item.completedAt)));
});

test("planUpdate describes an edit without changing the item", function () {
  var item = Store.createItem(good);
  var before = JSON.stringify(item);
  var plan = Store.planUpdate(item, edit({ name: "Other", totalMinutes: 10, minBlockMinutes: 5 }));
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(JSON.stringify(item), before);
});

test("invalid edits are refused and change nothing", function () {
  var item = Store.createItem(good);
  var before = JSON.stringify(item);
  [edit({ name: "  " }), edit({ type: "walk" }), edit({ totalMinutes: 12.5 }),
   edit({ totalMinutes: 30, minBlockMinutes: 60 })].forEach(function (bad) {
    var r = Store.updateItem(item, bad);
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors.length > 0);
  });
  assert.strictEqual(JSON.stringify(item), before);
});

test("editing the name, type, and minimum block leaves progress alone", function () {
  var item = Store.createItem(good);
  Store.applyDamage(item, 100);
  var r = Store.updateItem(item, edit({ name: "  Dune  ", type: "read", minBlockMinutes: 10 }));
  assert.strictEqual(item.name, "Dune");
  assert.strictEqual(item.type, "read");
  assert.strictEqual(item.minBlockMinutes, 10);
  assert.strictEqual(item.remainingMinutes, 350);
  assert.strictEqual(r.completes, false);
  assert.strictEqual(r.reopens, false);
});

test("a bigger total on a finished item puts it back on the shelf", function () {
  var item = finished();                                // total 60, done
  var r = Store.updateItem(item, edit({ totalMinutes: 120, minBlockMinutes: 30 }));
  assert.strictEqual(r.reopens, true);
  assert.strictEqual(item.remainingMinutes, 60);        // 120 - 60 logged
  assert.strictEqual(item.completedAt, undefined);
});

test("a finished item stays finished, with its date, on a name edit", function () {
  var item = finished();
  var stamped = item.completedAt;
  var r = Store.updateItem(item, edit({ name: "Renamed", totalMinutes: 60, minBlockMinutes: 30 }));
  assert.strictEqual(r.completes, false);
  assert.strictEqual(r.reopens, false);
  assert.strictEqual(item.remainingMinutes, 0);
  assert.strictEqual(item.completedAt, stamped);
});

// Only reached if every test above passed.
console.log("\n" + passed + " tests passed.");
