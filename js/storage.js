/*
 * storage.js: the DATA LAYER for Backlog Planner.
 *
 * Responsibilities:
 *   1. Define what an "item" is.
 *   2. Validate input before an item is created.
 *   3. Save and load the list from the browser's local storage.
 *
 * This file knows nothing about the page (no buttons, no HTML).
 * Keeping data logic separate from page logic is a good habit: the data
 * code is easy to test (see tests/storage.test.js) and easy to reuse
 * in another project.
 */

// The same IIFE pattern as app.js: everything inside stays private,
// and we choose what to share at the very bottom of the file.
// "root" is whatever global object we're given: window in a browser,
// globalThis in Node (see the very last line of the file).
(function (root) {
  "use strict";

  // ---------------------------------------------------------------
  // CONSTANTS
  // ---------------------------------------------------------------

  // The "key" our list is saved under. localStorage works like a
  // dictionary: you store a value under a name and read it back later.
  // The "v1" is a version tag. If the item shape changes someday, bump
  // it to "v2" so old saved data isn't mistaken for the new format.
  var STORAGE_KEY = "backlogPlanner.items.v1";

  // The allowed item types. Kept in one array so the validator, the
  // form's dropdown (step 2), and the loader all agree on the list.
  var TYPES = ["watch", "play", "read", "build", "move"];

  // ---------------------------------------------------------------
  // SMALL HELPERS
  // ---------------------------------------------------------------

  // Makes a unique id so each item can be found later (to log minutes
  // on it, for example). crypto.randomUUID is the best tool, but the
  // browser only allows it in secure contexts, so we check it exists
  // before using it and fall back to a timestamp plus random digits.
  function makeId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    return "item-" + Date.now() + "-" + Math.floor(Math.random() * 1e9);
  }

  // True only for whole numbers above zero: 1, 20, 450.
  // False for 0, -5, 12.5, and text like "450".
  // typeof value === "number"  -> it's actually a number, not text
  // Number.isInteger(value)    -> no decimals
  // value > 0                  -> positive
  // Form inputs arrive as text, so step 2 must convert them to numbers
  // before calling this.
  function isPositiveWholeNumber(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
  }

  // ---------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------

  /*
   * validateItem(input) -> { ok: boolean, errors: string[] }
   *
   * Checks the four fields a user fills in. It collects ALL the problems
   * instead of stopping at the first, so the form can show everything
   * that needs fixing at once. The messages are written for the person
   * using the form, so the UI can display them as-is.
   */
  function validateItem(input) {
    var errors = [];

    // "input || {}" means: use input if it exists, otherwise an empty
    // object. That way a missing input can't crash the checks below.
    var data = input || {};

    // Only call .trim() (remove outer spaces) if name really is text.
    // Otherwise treat it as an empty string, which fails the check.
    var name = typeof data.name === "string" ? data.name.trim() : "";
    if (name === "") {
      errors.push("Give it a name.");
    }

    // indexOf returns -1 when the value isn't in the array.
    if (TYPES.indexOf(data.type) === -1) {
      errors.push("Pick a type: " + TYPES.join(", ") + ".");
    }

    // Store the results in variables because we use them twice: once to
    // add messages, and once more for the "block bigger than total" check.
    var totalOk = isPositiveWholeNumber(data.totalMinutes);
    var blockOk = isPositiveWholeNumber(data.minBlockMinutes);

    if (!totalOk) {
      errors.push("Total size must be a whole number of minutes above 0.");
    }
    if (!blockOk) {
      errors.push("Minimum block must be a whole number of minutes above 0.");
    }

    // Only compare the two numbers if both are valid. Otherwise this
    // would add a confusing message on top of the ones above.
    if (totalOk && blockOk && data.minBlockMinutes > data.totalMinutes) {
      errors.push("Minimum block can't be bigger than the total size.");
    }

    // An empty errors array means everything passed.
    return { ok: errors.length === 0, errors: errors };
  }

  // ---------------------------------------------------------------
  // CREATING ITEMS
  // ---------------------------------------------------------------

  /*
   * createItem(input) -> item
   *
   * Builds a complete item from form input. It throws an error if the
   * input is invalid, so call validateItem first when you want friendly
   * messages to show the user.
   *
   * The item shape:
   *   id               unique string
   *   name             string
   *   type             "watch" | "play" | "read" | "build" | "move"
   *   totalMinutes     whole number, the full "health bar"
   *   remainingMinutes whole number, starts equal to totalMinutes
   *   minBlockMinutes  whole number, the least time worth starting
   *   createdAt        date as text, e.g. "2026-11-13T18:20:00.000Z"
   */
  function createItem(input) {
    var result = validateItem(input);
    if (!result.ok) {
      // "throw" stops the function and signals a problem to whoever
      // called it. join(" ") merges the message list into one string.
      throw new Error(result.errors.join(" "));
    }
    return {
      id: makeId(),
      name: input.name.trim(),
      type: input.type,
      totalMinutes: input.totalMinutes,
      // A brand-new item hasn't been worked on, so the bar starts full.
      remainingMinutes: input.totalMinutes,
      minBlockMinutes: input.minBlockMinutes,
      // toISOString makes a standard, sortable date string.
      createdAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------
  // LOADING AND SAVING
  // ---------------------------------------------------------------

  // Checks that something read back from storage still looks like a real
  // item. Saved data can be edited by hand, damaged, or left over from an
  // older version, so we never trust it blindly.
  // The "&&" chain means ALL of these must be true.
  function looksLikeItem(item) {
    return (
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      TYPES.indexOf(item.type) !== -1 &&
      isPositiveWholeNumber(item.totalMinutes) &&
      isPositiveWholeNumber(item.minBlockMinutes) &&
      // Remaining may be 0 (defeated), but never negative, and never
      // more than the total.
      Number.isInteger(item.remainingMinutes) &&
      item.remainingMinutes >= 0 &&
      item.remainingMinutes <= item.totalMinutes
    );
  }

  // Picks which storage to use. Tests pass in a fake one; the real app
  // passes nothing and gets the browser's localStorage.
  // Reading root.localStorage can itself throw in some privacy settings,
  // so it's wrapped in try/catch and falls back to null.
  function getStorage(storage) {
    if (storage) return storage;
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  /*
   * loadItems([storage]) -> item[]
   *
   * ALWAYS returns an array. Missing, unreadable, or damaged data gives
   * an empty list (or just the valid items) and never crashes the app.
   */
  function loadItems(storage) {
    var store = getStorage(storage);
    if (!store) return [];

    // try/catch: run the risky code in "try". If anything inside throws
    // an error, jump to "catch" instead of crashing the whole page.
    // JSON.parse is the risky part: it throws on malformed text.
    try {
      // localStorage can only hold TEXT. getItem returns null if nothing
      // has been saved under this key yet.
      var raw = store.getItem(STORAGE_KEY);
      if (raw === null) return [];

      // JSON.parse turns saved text back into real JavaScript data.
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // filter keeps only the entries where looksLikeItem returns true,
      // quietly dropping any damaged ones.
      return parsed.filter(looksLikeItem);
    } catch (e) {
      return [];
    }
  }

  /*
   * saveItems(items, [storage]) -> boolean
   *
   * Returns true if saved, false if the browser refused (storage full
   * or blocked). The page can use the false case to warn the user.
   */
  function saveItems(items, storage) {
    var store = getStorage(storage);
    if (!store) return false;
    try {
      // JSON.stringify turns our array of items into text, because
      // localStorage can only store text.
      store.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------
  // LOGGING PROGRESS ("damage")
  // ---------------------------------------------------------------

  /*
   * applyDamage(item, minutes) -> result object
   *
   * The one rule for lowering a health bar. The "Log" button uses it now,
   * and the countdown timer can call the same function later.
   *
   * Unlike the functions above, this one CHANGES the item you pass in
   * (item.remainingMinutes goes down). The caller is responsible for
   * saving the list afterward.
   *
   * It returns a result instead of throwing, because bad input here is
   * ordinary (someone typed 0 or left the box empty), not a program bug:
   *   failure: { ok: false, error: "message for the person" }
   *   success: { ok: true,
   *              dealt: minutes actually subtracted,
   *              clamped: true if they logged more than was left,
   *              defeated: true if the bar just hit zero,
   *              and the item is stamped with a completedAt date }
   */
  function applyDamage(item, minutes) {
    if (!isPositiveWholeNumber(minutes)) {
      return { ok: false, error: "Enter a whole number of minutes above 0." };
    }
    if (item.remainingMinutes === 0) {
      return { ok: false, error: "This one is already defeated." };
    }

    // Math.min picks the smaller number, so the bar can never go below 0.
    // Logging 50 minutes on something with 30 left deals 30.
    var dealt = Math.min(minutes, item.remainingMinutes);
    item.remainingMinutes -= dealt;

    // Hitting zero is the moment of completion, so record when. The
    // Achievements section shows this date and sorts by it.
    var defeated = item.remainingMinutes === 0;
    if (defeated) item.completedAt = new Date().toISOString();

    return { ok: true, dealt: dealt, clamped: dealt < minutes, defeated: defeated };
  }

  // ---------------------------------------------------------------
  // EDITING
  // ---------------------------------------------------------------

  /*
   * planUpdate(item, input) -> what an edit WOULD do, changing nothing.
   *   failure: { ok: false, errors: [...] }
   *   success: { ok: true, logged, remainingMinutes, completes, reopens }
   *
   * The rule: time you've already logged stays logged. When the total
   * changes, remaining = new total - logged (never below 0).
   *   completes: the edit takes an unfinished item down to zero
   *   reopens:   the edit gives a finished item time left again
   * The page calls this first so it can warn before a "completes" edit.
   */
  function planUpdate(item, input) {
    var check = validateItem(input);
    if (!check.ok) return { ok: false, errors: check.errors };

    var logged = item.totalMinutes - item.remainingMinutes;
    var remaining = Math.max(0, input.totalMinutes - logged);
    return {
      ok: true,
      logged: logged,
      remainingMinutes: remaining,
      completes: remaining === 0 && item.remainingMinutes > 0,
      reopens: remaining > 0 && item.remainingMinutes === 0
    };
  }

  /*
   * updateItem(item, input) -> the same result as planUpdate.
   * Applies the edit to the item IN PLACE (like applyDamage), so anything
   * else holding the item, such as the wheel, sees the change. The caller
   * saves the list afterward. Invalid input changes nothing.
   */
  function updateItem(item, input) {
    var plan = planUpdate(item, input);
    if (!plan.ok) return plan;

    item.name = input.name.trim();
    item.type = input.type;
    item.totalMinutes = input.totalMinutes;
    item.minBlockMinutes = input.minBlockMinutes;
    item.remainingMinutes = plan.remainingMinutes;

    // Keep the completion date in step with the item's state.
    if (plan.remainingMinutes > 0) {
      delete item.completedAt;                        // back on the shelf
    } else if (!item.completedAt) {
      item.completedAt = new Date().toISOString();    // just finished
    }
    return plan;
  }

  // ---------------------------------------------------------------
  // DELETING
  // ---------------------------------------------------------------

  /*
   * removeItem(items, id) -> new array without the item with that id.
   * filter builds a NEW list and leaves the original alone, so the caller
   * decides when to swap it in (and then calls saveItems). An id that
   * isn't in the list just gives back an equal copy.
   */
  function removeItem(items, id) {
    return items.filter(function (item) { return item.id !== id; });
  }

  // ---------------------------------------------------------------
  // BACKUP AND RESTORE
  // A backup is a JSON file: { app, version, exportedAt, items }.
  // Restoring reads a file someone hands us, and a file is outside input
  // like any other, so every item is checked and rebuilt field by field.
  // ---------------------------------------------------------------

  // Rebuilds an item from untrusted data, keeping ONLY the fields we know.
  // Returns null if it can't be trusted. Besides the usual shape checks,
  // the id is limited to simple characters, because the page later uses
  // ids inside selectors, and a name is trimmed to the form's 80 characters.
  function cleanItem(raw) {
    if (!looksLikeItem(raw)) return null;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw.id)) return null;
    if (raw.minBlockMinutes > raw.totalMinutes) return null;
    var name = raw.name.trim().slice(0, 80);
    if (name === "") return null;

    var item = {
      id: raw.id,
      name: name,
      type: raw.type,
      totalMinutes: raw.totalMinutes,
      remainingMinutes: raw.remainingMinutes,
      minBlockMinutes: raw.minBlockMinutes,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString()
    };
    // A completion date only makes sense on a finished item.
    if (raw.remainingMinutes === 0 && typeof raw.completedAt === "string") {
      item.completedAt = raw.completedAt;
    }
    return item;
  }

  // The object that gets written to the backup file. "now" is optional so
  // tests can pass a fixed date.
  function makeBackup(items, now) {
    return {
      app: "backlog-planner",
      version: 1,
      exportedAt: (now || new Date()).toISOString(),
      items: items
    };
  }

  // "backlog-planner-backup-2026-11-14.json" (the date is local time).
  function backupFileName(date) {
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return "backlog-planner-backup-" + date.getFullYear() + "-" +
      two(date.getMonth() + 1) + "-" + two(date.getDate()) + ".json";
  }

  /*
   * parseBackup(text) -> { ok: true, items, skipped } or { ok: false, error }
   * Never throws. "skipped" counts items in the file that were unusable.
   * A bare list of items (no wrapper object) is accepted too.
   */
  function parseBackup(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: "That file isn't a readable backup (it isn't valid JSON)." };
    }

    var list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
    if (list === null) {
      return { ok: false, error: "That doesn't look like a Backlog Planner backup." };
    }

    var items = [];
    list.forEach(function (raw) {
      var item = cleanItem(raw);
      if (item) items.push(item);
    });
    if (items.length === 0 && list.length > 0) {
      return { ok: false, error: "None of the items in that file were usable." };
    }
    return { ok: true, items: items, skipped: list.length - items.length };
  }

  /*
   * mergeItems(current, incoming) -> { items, added, updated, kept }
   *
   * Restoring never deletes anything. For each incoming item:
   *   - new id            -> added
   *   - same id, and the incoming copy has MORE progress (less remaining)
   *                       -> the existing item takes that progress (updated)
   *   - same id otherwise -> the current copy stays (kept)
   * Progress only moves forward, so "more progress wins" is a safe rule
   * when two devices have both been used.
   *
   * Updating changes the existing object IN PLACE (rather than swapping in
   * the new one), so anything else holding that object, like the wheel's
   * candidates, stays valid. The returned list is a new array.
   * Note: an item you deleted can come back if the backup still has it.
   */
  function mergeItems(current, incoming) {
    var items = current.slice();
    var added = 0, updated = 0, kept = 0;

    incoming.forEach(function (item) {
      var existing = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === item.id) { existing = items[i]; break; }
      }
      if (existing === null) {
        items.push(item);
        added++;
      } else if (item.remainingMinutes < existing.remainingMinutes) {
        existing.remainingMinutes = item.remainingMinutes;
        if (item.completedAt) existing.completedAt = item.completedAt;
        updated++;
      } else {
        kept++;
      }
    });

    return { items: items, added: added, updated: updated, kept: kept };
  }

  // ---------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------

  // Everything above is private to this file. This object is the list of
  // things we choose to share with other files.
  var BacklogStore = {
    STORAGE_KEY: STORAGE_KEY,
    TYPES: TYPES,
    validateItem: validateItem,
    createItem: createItem,
    loadItems: loadItems,
    saveItems: saveItems,
    applyDamage: applyDamage,
    removeItem: removeItem,
    planUpdate: planUpdate,
    updateItem: updateItem,
    makeBackup: makeBackup,
    backupFileName: backupFileName,
    parseBackup: parseBackup,
    mergeItems: mergeItems
  };

  // This file runs in two places and shares itself differently in each:
  //   Node (the tests): "module" exists, so we export with module.exports.
  //   Browser: "module" doesn't exist, so we attach to the window, which
  //            is how app.js can use the name BacklogStore.
  // "typeof module !== 'undefined'" is the safe way to ask "does this
  // variable exist?" without causing an error when it doesn't.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BacklogStore;
  } else {
    root.BacklogStore = BacklogStore;
  }

  // The closing line of the IIFE: it passes in "window" when running in a
  // browser, or "globalThis" otherwise. That value becomes "root" above.
})(typeof window !== "undefined" ? window : globalThis);
