/*
 * decide.js: the "Decide for me" RULES (no page code, so it's easy to test).
 *
 * How a search works:
 *   1. An item qualifies if it has time left AND your minutes are at least
 *      its minimum block.
 *   2. Qualifying items are ranked by how close their minimum block is to
 *      your minutes (a 45m episode beats a 10m chapter when you have 60).
 *   3. Every qualifying item is a candidate, in ranked order. One is picked
 *      at random.
 *   4. One reroll per search, drawn from the other candidates.
 *   5. If nothing qualifies, the closest miss is offered instead.
 *
 * A "search" is a plain object:
 *   { status: "fit" | "closest" | "empty", minutes, candidates, pick, rerollUsed }
 */
(function (root) {
  "use strict";

  // An item with nothing left is "defeated" and never gets picked.
  function isActive(item) {
    return item.remainingMinutes > 0;
  }

  // Checks the minutes the person typed (already converted with Number()).
  function validateMinutes(minutes) {
    if (typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0) {
      return { ok: true };
    }
    return { ok: false, error: "Enter how many minutes you have, as a whole number above 0." };
  }

  // All qualifying items, best match first.
  // We remember each item's original position (index) so that ties keep
  // shelf order, which makes the ranking predictable.
  function rankFits(items, minutes) {
    return items
      .map(function (item, index) { return { item: item, index: index }; })
      .filter(function (entry) {
        return isActive(entry.item) && entry.item.minBlockMinutes <= minutes;
      })
      .sort(function (a, b) {
        var gapA = minutes - a.item.minBlockMinutes;
        var gapB = minutes - b.item.minBlockMinutes;
        return gapA - gapB || a.index - b.index;   // smaller gap first, then shelf order
      })
      .map(function (entry) { return entry.item; });
  }

  // When nothing fits: the active item whose minimum block is just above
  // your minutes (the smallest overshoot). Returns null if there isn't one.
  function closestMiss(items, minutes) {
    var best = null;
    items.forEach(function (item) {
      if (!isActive(item) || item.minBlockMinutes <= minutes) return;
      if (best === null || item.minBlockMinutes < best.minBlockMinutes) best = item;
    });
    return best;
  }

  // Random choice. "random" can be passed in so tests get predictable
  // results; the real app leaves it out and uses Math.random.
  function pickRandom(pool, random) {
    var roll = (random || Math.random)();
    return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
  }

  function startSearch(items, minutes, random) {
    var fits = rankFits(items, minutes);
    if (fits.length > 0) {
      var candidates = fits;
      return {
        status: "fit",
        minutes: minutes,
        candidates: candidates,
        pick: pickRandom(candidates, random),
        rerollUsed: false
      };
    }
    var miss = closestMiss(items, minutes);
    if (miss) {
      return { status: "closest", minutes: minutes, candidates: [miss], pick: miss, rerollUsed: false };
    }
    return { status: "empty", minutes: minutes, candidates: [], pick: null, rerollUsed: false };
  }

  // Who a reroll could land on: the other candidates that still have time
  // left. Empty once the reroll is used, or when the search isn't a "fit".
  function rerollPool(search) {
    if (search.status !== "fit" || search.rerollUsed) return [];
    return search.candidates.filter(function (item) {
      return item !== search.pick && isActive(item);
    });
  }

  function canReroll(search) {
    return rerollPool(search).length > 0;
  }

  // Returns a NEW search with a different pick and rerollUsed = true,
  // or null if a reroll isn't allowed. The old search is left unchanged.
  function reroll(search, random) {
    var pool = rerollPool(search);
    if (pool.length === 0) return null;
    return Object.assign({}, search, { pick: pickRandom(pool, random), rerollUsed: true });
  }

  var BacklogDecide = {
    validateMinutes: validateMinutes,
    rankFits: rankFits,
    closestMiss: closestMiss,
    startSearch: startSearch,
    canReroll: canReroll,
    reroll: reroll
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = BacklogDecide;
  } else {
    root.BacklogDecide = BacklogDecide;
  }
})(typeof window !== "undefined" ? window : globalThis);
