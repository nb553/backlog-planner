/*
 * achievements.js: what a COMPLETED item looks like (data and rules only).
 *
 * When an item's health bar hits zero it leaves the shelf and becomes an
 * achievement card. Each type earns its own title and its own pixel icon,
 * and style.css gives each type its own card shape.
 *
 * Adding a new type later? Add its title and icon here too. The tests
 * fail if a type in storage.js has no title or icon.
 */
(function (root) {
  "use strict";

  var TITLES = {
    watch: "Binge Complete",
    play: "Game Cleared",
    read: "Last Page Turned",
    build: "Shipped It",
    move: "Touched Grass"
  };

  // 8x8 pixel pictures. "X" is a filled square, "." is empty. app.js turns
  // each map into an SVG, so the icons stay crisp at any size.
  var ICONS = {
    watch: [          // a screen with a play button
      "XXXXXXXX",
      "X......X",
      "X.X....X",
      "X.XXX..X",
      "X.XXX..X",
      "X.X....X",
      "X......X",
      "XXXXXXXX"
    ],
    play: [           // a trophy
      "XXXXXXXX",
      "X.XXXX.X",
      "X.XXXX.X",
      ".XXXXXX.",
      "..XXXX..",
      "...XX...",
      "..XXXX..",
      ".XXXXXX."
    ],
    read: [           // an open book
      "XXX..XXX",
      "X.X..X.X",
      "X.X..X.X",
      "X.X..X.X",
      "X.X..X.X",
      "XXX..XXX",
      ".XXXXXX.",
      "........"
    ],
    build: [          // a gear
      "...XX...",
      ".X.XX.X.",
      "..XXXX..",
      "XXX..XXX",
      "XXX..XXX",
      "..XXXX..",
      ".X.XX.X.",
      "...XX..."
    ],
    move: [           // a mountain below a sun
      "......X.",
      ".....XXX",
      "......X.",
      "....X...",
      "...XXX..",
      "..XXXXX.",
      ".XXXXXXX",
      "XXXXXXXX"
    ]
  };

  // The "defeated" test, in one place: nothing left on the bar.
  function isDone(item) {
    return item.remainingMinutes === 0;
  }

  // When it was completed, as a number we can sort by. Items finished
  // before completion dates existed have none, so they count as 0 (oldest).
  function completedTime(item) {
    var time = Date.parse(item.completedAt);   // NaN if missing or invalid
    return isNaN(time) ? 0 : time;
  }

  /*
   * splitItems(items) -> { active, done }
   *   active: items still on the shelf, in their original order
   *   done:   completed items, most recently completed first
   */
  function splitItems(items) {
    return {
      active: items.filter(function (item) { return !isDone(item); }),
      done: items.filter(isDone).sort(function (a, b) {
        return completedTime(b) - completedTime(a);
      })
    };
  }

  var BacklogAchievements = {
    TITLES: TITLES,
    ICONS: ICONS,
    splitItems: splitItems
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = BacklogAchievements;
  } else {
    root.BacklogAchievements = BacklogAchievements;
  }
})(typeof window !== "undefined" ? window : globalThis);
