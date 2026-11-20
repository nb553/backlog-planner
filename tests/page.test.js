/*
 * page.test.js: checks that the HTML, CSS, and JavaScript are WIRED
 * TOGETHER. The other test files check logic; this one catches the kind of
 * mistake logic tests can't see, like a typo in an id or a forgotten script.
 *
 * Run: node tests/page.test.js
 */
"use strict";
var fs = require("fs");
var path = require("path");
var assert = require("assert");
var Store = require("../js/storage.js");

var root = path.join(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

// Comments in the HTML mention ids and tags as examples. Strip them first
// so they can't fool the checks.
var html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
var app = read("js/app.js");
var css = read("css/style.css");

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }

// Every match of "regex" in "text", returning just capture group 1.
function allMatches(regex, text) {
  var found = [], m;
  while ((m = regex.exec(text)) !== null) found.push(m[1]);
  return found;
}

console.log("files");
test("every script and stylesheet the page loads exists", function () {
  var local = allMatches(/<script src="([^"]+)"/g, html)
    .concat(allMatches(/<link[^>]*href="(css\/[^"]+)"/g, html));
  assert.ok(local.length >= 6, "expected several local files");
  local.forEach(function (file) {
    assert.ok(fs.existsSync(path.join(root, file)), file + " is missing");
  });
});
test("storage.js loads first and app.js loads last", function () {
  var scripts = allMatches(/<script src="([^"]+)"/g, html);
  assert.strictEqual(scripts[0], "js/storage.js");
  assert.strictEqual(scripts[scripts.length - 1], "js/app.js");
});

console.log("ids");
test("every id app.js looks up exists exactly once in the HTML", function () {
  var wanted = allMatches(/getElementById\("([^"]+)"\)/g, app);
  assert.ok(wanted.length > 10);
  wanted.forEach(function (id) {
    var count = html.split('id="' + id + '"').length - 1;
    assert.strictEqual(count, 1, "#" + id + " appears " + count + " times");
  });
});
test("every label points at a real field", function () {
  allMatches(/<label for="([^"]+)"/g, html).forEach(function (id) {
    assert.ok(html.indexOf('id="' + id + '"') !== -1, "label for #" + id);
  });
});

console.log("styles");
test("every item type has a color and a look for each card kind", function () {
  Store.TYPES.forEach(function (type) {
    assert.ok(css.indexOf("--" + type + ":") !== -1, type + " color variable");
    [".cartridge", ".mini-cart", ".achievement"].forEach(function (kind) {
      assert.ok(css.indexOf(kind + '[data-type="' + type + '"]') !== -1, kind + " style for " + type);
    });
  });
});
test("move achievement has a dashed trail-map route", function () {
  assert.ok(/--move:\s*#51cf66/i.test(css));
  assert.ok(/\.achievement\[data-type="move"\]::before/.test(css));
  assert.ok(/border-top:\s*3px dashed/.test(css));
});

console.log("type display");
test("type options capitalize labels while keeping lowercase values", function () {
  assert.ok(/var label = type\.charAt\(0\)\.toUpperCase\(\) \+ type\.slice\(1\)/.test(app));
  assert.ok(/option\.value = type/.test(app));
});

console.log("quick log");
test("each cartridge can log its minimum block through the shared result flow", function () {
  assert.ok(/var quickButton = el\("button", "log-button", "Quick log"\)/.test(app));
  assert.ok(/quickButton\.type = "button"/.test(app));
  assert.ok(/quickButton\.addEventListener\("click", function \(\) \{\s*applyLog\(item, item\.minBlockMinutes, message\);/.test(app));

  var helper = app.match(/function applyLog\(item, minutes, message\) \{([\s\S]*?)\n  \}/);
  assert.ok(helper, "shared log handler exists");
  assert.ok(/BacklogStore\.applyDamage\(item, minutes\)/.test(helper[1]));
  assert.ok(/BacklogStore\.saveItems\(items\)/.test(helper[1]));
  assert.ok(/describeHit\(item, result\)/.test(helper[1]));
  assert.ok(/render\(/.test(helper[1]));
});

console.log("\n" + passed + " tests passed.");
