/*
 * wheel.test.js: checks for js/wheel.js.   Run: node tests/wheel.test.js
 */
"use strict";
var assert = require("assert");
var Wheel = require("../js/wheel.js");

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }
function near(a, b) { return Math.abs(a - b) < 1e-9; }

console.log("slotCountFor");
test("one candidate needs no wheel; two or three get six slots", function () {
  assert.strictEqual(Wheel.slotCountFor(1), 1);
  assert.strictEqual(Wheel.slotCountFor(2), 6);
  assert.strictEqual(Wheel.slotCountFor(3), 6);
});

console.log("slotOffset");
test("measures distance from the front, wrapping around the drum", function () {
  assert.strictEqual(Wheel.slotOffset(0, 0, 6), 0);
  assert.strictEqual(Wheel.slotOffset(1, 0, 6), 1);
  assert.strictEqual(Wheel.slotOffset(5, 0, 6), -1);   // wraps to the left
  assert.strictEqual(Wheel.slotOffset(3, 0, 6), -3);   // straight behind
  assert.strictEqual(Wheel.slotOffset(1, 1, 6), 0);    // after turning one slot
  assert.strictEqual(Wheel.slotOffset(0, 7, 6), -1);   // rotation can exceed one lap
  assert.ok(near(Wheel.slotOffset(0, 0.5, 6), -0.5));  // mid-turn
});

console.log("slotPose");
test("the front slot is centered, full size, opaque, and on top", function () {
  var p = Wheel.slotPose(0, 6, 0);
  assert.strictEqual(p.x, 0);
  assert.strictEqual(p.scale, 1);
  assert.strictEqual(p.opacity, 1);
  assert.strictEqual(p.z, 200);
  assert.strictEqual(p.lift, Wheel.SPIN_LIFT);
});
test("the landing pop lifts and enlarges the front slot", function () {
  var p = Wheel.slotPose(0, 6, 1);
  assert.strictEqual(p.lift, Wheel.SPIN_LIFT + Wheel.POP_LIFT);
  assert.ok(near(p.scale, 1.08));
});
test("neighbors swing to opposite sides, smaller, and barely lifted", function () {
  var right = Wheel.slotPose(1, 6, 0), left = Wheel.slotPose(-1, 6, 0);
  assert.ok(near(right.x, Math.sin(Math.PI / 3)));
  assert.ok(near(right.x, -left.x));
  assert.ok(near(right.scale, 0.8));
  assert.ok(right.lift < 0.1);
  assert.ok(right.z < Wheel.slotPose(0, 6, 0).z);
});
test("slots at or behind the sides are invisible", function () {
  assert.strictEqual(Wheel.slotPose(3, 6, 0).opacity, 0);
  assert.ok(Wheel.slotPose(1.5, 6, 0).opacity < 1e-9);
});

console.log("landingRotation");
test("lands the chosen slot at the front after enough turning", function () {
  var r = Wheel.landingRotation(4, 2, 6, 15);
  assert.strictEqual(r % 6, 2);          // slot 2 is at the front
  assert.ok(r >= 4 + 15);                // turned at least 15 slots
  assert.ok(r < 4 + 15 + 6);             // ...but not a needless extra lap
  assert.strictEqual(Wheel.landingRotation(0, 0, 6, 12), 12);
});

console.log("easing");
test("both easings run from 0 to 1; easeOutBack overshoots", function () {
  [Wheel.easeOutQuart, Wheel.easeOutBack].forEach(function (f) {
    assert.ok(near(f(0), 0));
    assert.ok(near(f(1), 1));
  });
  assert.ok(Wheel.easeOutQuart(0.5) > 0.5);   // fast start
  var peak = 0;
  for (var t = 0; t <= 1; t += 0.01) peak = Math.max(peak, Wheel.easeOutBack(t));
  assert.ok(peak > 1);
});

console.log("\n" + passed + " tests passed.");
