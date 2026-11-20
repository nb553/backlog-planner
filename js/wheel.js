/*
 * wheel.js: the MOTION MATH for the cartridge wheel (no page code).
 *
 * Picture a drum with cartridges standing around its rim, viewed from the
 * front. As the drum turns, a cartridge swings in from the side, rises as
 * it passes the front, then settles back. We fake the 3D with plain
 * numbers: for each slot we work out an angle, then derive its sideways
 * position, height, size, and fade from that angle.
 *
 * "rotation" counts in SLOTS: rotation 1 means the drum turned one slot.
 */
(function (root) {
  "use strict";

  var SPIN_LIFT = 14;       // px a cartridge rises as it passes the front
  var POP_LIFT = 26;        // extra px for the landing pop-up
  var RADIUS_PERCENT = 34;  // sideways swing, as a % of the wheel's width

  // One candidate needs no wheel. Two through six candidates fill six slots;
  // larger pools get one slot per candidate so none are left off the drum.
  function slotCountFor(candidateCount) {
    return candidateCount >= 2 ? Math.max(6, candidateCount) : 1;
  }

  // How far slot "index" is from the front, in slots: 0 = front,
  // positive = to the right, negative = to the left. The % math wraps
  // around the drum so the answer is always in [-count/2, count/2).
  function slotOffset(index, rotation, count) {
    var d = (((index - rotation) % count) + count) % count;
    if (d >= count / 2) d -= count;
    return d;
  }

  // Where and how to draw a slot, given its offset from the front.
  // "pop" is 0..1 (a bit over 1 while bouncing) for the landing pop-up.
  //   x       -1..1 as a fraction of the radius (UI turns it into a %)
  //   lift    px upward
  //   scale   size multiplier (smaller toward the back)
  //   opacity 0 once the slot swings behind the drum
  //   z       stacking order, front on top
  function slotPose(offset, count, pop) {
    var angle = (offset / count) * 2 * Math.PI;
    var depth = Math.cos(angle);                       // 1 front, 0 side, -1 back
    var front = depth > 0 ? Math.pow(depth, 8) : 0;    // ~1 only right at the front
    return {
      x: Math.sin(angle),
      lift: front * (SPIN_LIFT + POP_LIFT * pop),
      scale: 0.6 + 0.4 * Math.max(0, depth) + 0.08 * front * pop,
      opacity: Math.max(0, Math.min(1, depth * 2.5)),
      z: Math.round((depth + 1) * 100)
    };
  }

  // The rotation that parks slot "slotIndex" at the front after turning
  // AT LEAST minSlots from "current". It's the smallest such value.
  function landingRotation(current, slotIndex, count, minSlots) {
    var laps = Math.ceil((current + minSlots - slotIndex) / count);
    return slotIndex + laps * count;
  }

  // Easing: t goes 0 -> 1 steadily; these bend it into a feel.
  // easeOutQuart starts fast and slows to a stop (the spin).
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  // easeOutBack overshoots past 1 then settles back (the pop-up bounce).
  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  var BacklogWheel = {
    SPIN_LIFT: SPIN_LIFT,
    POP_LIFT: POP_LIFT,
    RADIUS_PERCENT: RADIUS_PERCENT,
    slotCountFor: slotCountFor,
    slotOffset: slotOffset,
    slotPose: slotPose,
    landingRotation: landingRotation,
    easeOutQuart: easeOutQuart,
    easeOutBack: easeOutBack
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = BacklogWheel;
  } else {
    root.BacklogWheel = BacklogWheel;
  }
})(typeof window !== "undefined" ? window : globalThis);
