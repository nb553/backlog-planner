/*
 * app.js: connects the data (storage.js) to the page (index.html).
 *
 * Step 2: add items with a form, save them, and draw them as cartridges.
 * Step 3: each cartridge has a "Log" form that lowers its health bar.
 * Step 4: "Decide for me" spins a cartridge wheel and lands on a pick
 * (rules in decide.js, motion math in wheel.js).
 * Also: Decide locks after a pick until you log time; items can be deleted;
 * completed items move to an Achievements section (see achievements.js);
 * the list can be downloaded as a backup file and restored from one;
 * items can be edited, keeping the time already logged.
 *
 * Flow:
 *   page opens -> load saved items -> draw them
 *   add form submitted -> validate -> create -> save -> redraw
 *   log form submitted -> applyDamage -> save -> redraw
 */

// IIFE: keeps our variables private to this file (see storage.js notes).
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // STATE: the one list of items the whole page works from.
  // Loaded once at startup; changed only when the form adds to it.
  // ---------------------------------------------------------------
  var items = BacklogStore.loadItems();

  // "Decide for me" state.
  var search = null;      // the current search object from decide.js, or null
  var spinning = false;   // true during the animation, so spins can't overlap
  var runId = 0;          // bumped to cancel an animation in progress
  var locked = false;     // true after a pick, until you log time
  var editingItem = null; // the item being edited in the form, or null when adding
  var completionWarned = false;   // true once an edit that finishes an item has been warned about
  // What the wheel is showing. rotation counts in slots; pop is 0..1 for
  // the landing pop-up.
  var wheel = { slotCount: 1, slotItems: [], slotEls: [], rotation: 0, pop: 0 };

  // ---------------------------------------------------------------
  // FIND PAGE ELEMENTS (once, up front)
  // Looking elements up is slowish, so we do it once and reuse them.
  // Each id matches an id="..." in index.html.
  // ---------------------------------------------------------------
  var form = document.getElementById("add-form");
  var nameInput = document.getElementById("name");
  var typeSelect = document.getElementById("type");
  var totalInput = document.getElementById("total");
  var blockInput = document.getElementById("block");
  var errorList = document.getElementById("form-errors");
  var status = document.getElementById("status");
  var shelf = document.getElementById("shelf");

  // The Decide for me section.
  var decideForm = document.getElementById("decide-form");
  var minutesInput = document.getElementById("minutes");
  var decideButton = document.getElementById("decide-button");
  var decideMessage = document.getElementById("decide-message");
  var closestPrompt = document.getElementById("closest-prompt");
  var closestText = document.getElementById("closest-text");
  var anywayButton = document.getElementById("anyway-button");
  var wheelEl = document.getElementById("wheel");
  var slotsEl = document.getElementById("wheel-slots");
  var resultEl = document.getElementById("result");
  var resultLabel = document.getElementById("result-label");
  var resultName = document.getElementById("result-name");
  var resultDetail = document.getElementById("result-detail");
  var rerollButton = document.getElementById("reroll-button");
  var logPickButton = document.getElementById("log-pick-button");
  var lockNote = document.getElementById("lock-note");

  // Achievements, plus the two headings that receive focus after a delete.
  var achievements = document.getElementById("achievements");
  var achievementsStatus = document.getElementById("achievements-status");
  var shelfHeading = document.getElementById("shelf-heading");
  var achievementsHeading = document.getElementById("achievements-heading");

  // Backup and restore.
  var exportButton = document.getElementById("export-button");
  var importButton = document.getElementById("import-button");
  var importFile = document.getElementById("import-file");
  var backupMessage = document.getElementById("backup-message");

  // Editing (the add form's heading, note, and buttons).
  var addHeading = document.getElementById("add-heading");
  var editNote = document.getElementById("edit-note");
  var saveButton = document.getElementById("save-button");
  var cancelEditButton = document.getElementById("cancel-edit-button");

  // ---------------------------------------------------------------
  // SMALL HELPERS
  // ---------------------------------------------------------------

  // Turns minutes into friendly text: 450 -> "7h 30m", 45 -> "45m".
  // Math.floor drops the decimals; % (remainder) gives the leftover minutes.
  function formatMinutes(total) {
    var hours = Math.floor(total / 60);
    var minutes = total % 60;
    if (hours === 0) return minutes + "m";
    if (minutes === 0) return hours + "h";
    return hours + "h " + minutes + "m";
  }

  // Shortcut for building an element: el("p", "hint", "Some text").
  // We build the page with createElement and textContent instead of
  // pasting strings into innerHTML. That matters for safety: if someone
  // names an item "<script>...", textContent shows it as plain text
  // instead of running it as code.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Picks the bar color: more than half left is "high", and so on.
  // The CSS decides what color each level actually is.
  function barLevel(percent) {
    if (percent > 50) return "high";
    if (percent > 25) return "mid";
    return "low";
  }

  // ---------------------------------------------------------------
  // DRAWING
  // ---------------------------------------------------------------

  // Fills the Type dropdown from BacklogStore.TYPES, so the list of
  // types lives in one place. Add a type there and it appears here.
  function fillTypeOptions() {
    var placeholder = el("option", "", "Choose a type");
    placeholder.value = "";   // empty value fails validation on purpose
    typeSelect.appendChild(placeholder);

    BacklogStore.TYPES.forEach(function (type) {
      // Capitalize the label for display, but keep the value lowercase
      // so saved items continue to use the type key.
      var label = type.charAt(0).toUpperCase() + type.slice(1);
      var option = el("option", "", label);
      option.value = type;
      typeSelect.appendChild(option);
    });
  }

  // Writes the sentence shown after a successful log, based on the
  // result object that BacklogStore.applyDamage returned.
  function describeHit(item, result) {
    if (result.defeated) {
      return result.clamped
        ? "You defeated " + item.name + "! Only " + formatMinutes(result.dealt) +
          " was left, so that's what counted. It's in your achievements now."
        : "You defeated " + item.name + "! It's in your achievements now.";
    }
    return "Logged " + formatMinutes(result.dealt) + " on " + item.name + ". " +
      formatMinutes(item.remainingMinutes) + " left.";
  }

  // After a redraw, every element is brand new, so keyboard focus is lost.
  // This puts the cursor back in the same cartridge's log box, so someone
  // can log again without hunting for it. querySelector finds the first
  // element matching a CSS-style selector, or null if there isn't one.
  function focusLogInput(id) {
    var input = shelf.querySelector('[data-id="' + id + '"] .log-input');
    if (input) input.focus();
  }

  // Applies a log from either the minutes form or the one-tap button, then
  // follows the same save, redraw, and focus behavior for both.
  function applyLog(item, minutes, message) {
    var result = BacklogStore.applyDamage(item, minutes);

    if (!result.ok) {
      // Show the problem on THIS cartridge. No redraw, so typed minutes stay.
      message.textContent = result.error;
      message.hidden = false;
      return;
    }

    // "item" is the same object that lives in the items array, so
    // applyDamage already changed it there. Just save and redraw.
    var saved = BacklogStore.saveItems(items);
    // Logging time completes the decide -> do -> log loop, so it clears
    // the wheel and unlocks Decide. (Also clear if the picked item was
    // just defeated, even when Decide wasn't locked.)
    if (locked || (search && search.pick === item && result.defeated)) resetPicker();
    render(
      describeHit(item, result) +
        (saved ? "" : " (This browser wouldn't save it, so it will be lost when you close the tab.)")
    );
    // A defeated item leaves the shelf, so there's no log box to return to.
    if (result.defeated) {
      achievementsHeading.focus();
    } else {
      focusLogInput(item.id);
    }
  }

  // Builds the small "minutes + Log" form that goes inside a cartridge.
  // Each cartridge gets its OWN form, and the function it listens with
  // "remembers" which item it belongs to (this is called a closure).
  function buildLogForm(item) {
    var logForm = el("form", "log-form");
    logForm.setAttribute("novalidate", "");   // we show our own messages

    var input = el("input", "log-input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.placeholder = "min";
    input.setAttribute("inputmode", "numeric");
    // No visible label (space is tight), so screen readers get this one.
    input.setAttribute("aria-label", "Minutes to log for " + item.name);

    var button = el("button", "log-button", "Log");
    button.type = "submit";

    var quickButton = el("button", "log-button", "Quick log");
    quickButton.type = "button";

    // Hidden until something goes wrong. role="alert" announces it.
    var message = el("p", "log-error");
    message.setAttribute("role", "alert");
    message.hidden = true;

    logForm.appendChild(input);
    logForm.appendChild(button);
    logForm.appendChild(quickButton);
    logForm.appendChild(message);

    quickButton.addEventListener("click", function () {
      applyLog(item, item.minBlockMinutes, message);
    });

    logForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Number() turns the typed text into a number (empty becomes 0,
      // which applyDamage rejects with a clear message).
      applyLog(item, Number(input.value), message);
    });

    return logForm;
  }

  // ---------------------------------------------------------------
  // EDITING
  // The add form doubles as the edit form. "Edit" fills it with the item's
  // values and changes its wording; saving then updates that item instead
  // of adding a new one. The rules (like "logged time stays logged") live
  // in storage.js.
  // ---------------------------------------------------------------

  // Switches the form between "add" (item = null) and "edit" (an item).
  function setFormMode(item) {
    editingItem = item;
    completionWarned = false;
    addHeading.textContent = item ? "Edit item" : "Add to your shelf";
    saveButton.textContent = item ? "Save changes" : "Add to shelf";
    cancelEditButton.hidden = !item;
    editNote.hidden = !item;
    if (!item) return;

    var logged = item.totalMinutes - item.remainingMinutes;
    if (item.remainingMinutes === 0) {
      editNote.textContent = "Editing " + item.name + " (finished). A bigger size puts it back on your shelf.";
    } else if (logged > 0) {
      editNote.textContent = "Editing " + item.name + ". The " + formatMinutes(logged) +
        " you've logged stays logged when you change the size.";
    } else {
      editNote.textContent = "Editing " + item.name + ".";
    }
  }

  function startEdit(item) {
    showErrors([]);
    nameInput.value = item.name;
    typeSelect.value = item.type;
    totalInput.value = String(item.totalMinutes);
    blockInput.value = String(item.minBlockMinutes);
    setFormMode(item);
    nameInput.focus();   // also scrolls the form into view
  }

  function cancelEdit() {
    form.reset();
    showErrors([]);
    setFormMode(null);
  }

  // The wheel holds the same item objects, so an edit changes them in
  // place. This redraws the small cartridges and the result text to match.
  // It does NOT clear the wheel, so editing can't be used to unlock Decide
  // or refresh the reroll.
  function refreshPicker() {
    wheel.slotEls.forEach(function (slotEl, i) {
      slotEl.textContent = "";
      slotEl.appendChild(buildMiniCartridge(wheel.slotItems[i]));
    });
    if (!resultEl.hidden) showResult();
  }

  // Called by the form when it's in edit mode and the input is valid.
  function finishEdit(input) {
    var item = editingItem;
    var plan = BacklogStore.planUpdate(item, input);
    if (!plan.ok) {
      showErrors(plan.errors);
      return;
    }

    // An edit that finishes the item needs a second press to confirm, so a
    // slip like 45 instead of 450 can't finish something by accident.
    if (plan.completes && !completionWarned) {
      completionWarned = true;
      showErrors([
        "That's no more than the " + formatMinutes(plan.logged) + " you've already logged, so saving will " +
        "mark " + item.name + " as defeated. Press Save changes again to confirm."
      ]);
      return;
    }

    BacklogStore.updateItem(item, input);
    var saved = BacklogStore.saveItems(items);

    if (search) {
      if (plan.completes && search.pick === item) {
        resetPicker();          // the picked item is finished, like defeating it by logging
      } else if (!closestPrompt.hidden) {
        resetPicker();          // an offer on screen may be out of date, and nothing is locked yet
      } else {
        refreshPicker();
      }
    }

    var note = "Updated " + item.name + ".";
    if (plan.completes) note += " It's defeated now, so it moved to your achievements.";
    if (plan.reopens) note += " It's back on your shelf with " + formatMinutes(item.remainingMinutes) + " left.";
    if (!saved) note += " (This browser wouldn't save the change.)";

    cancelEdit();
    render(note);
    (item.remainingMinutes === 0 ? achievementsHeading : shelfHeading).focus();
  }

  // Changing the total means the "are you sure?" question is a new one.
  totalInput.addEventListener("input", function () {
    completionWarned = false;
  });

  cancelEditButton.addEventListener("click", function () {
    cancelEdit();
    shelfHeading.focus();
  });

  // ---------------------------------------------------------------
  // DELETING AND ACHIEVEMENTS
  // ---------------------------------------------------------------

  // Removes an item for good. If the wheel had it as a candidate, the wheel
  // is cleared too, so it can never land on something that's gone.
  function deleteItem(item) {
    if (editingItem === item) cancelEdit();   // don't leave the form editing something that's gone
    var wasDone = item.remainingMinutes === 0;
    items = BacklogStore.removeItem(items, item.id);   // a new list without it
    var saved = BacklogStore.saveItems(items);
    if (search && search.candidates.indexOf(item) !== -1) resetPicker();
    render(
      "Deleted " + item.name + "." +
        (saved ? "" : " (This browser wouldn't save the change, so it may come back.)")
    );
    // The card is gone, so put keyboard focus on its section's heading.
    (wasDone ? achievementsHeading : shelfHeading).focus();
  }

  // The Edit and Delete buttons for a card. Delete asks "Delete this?" before doing anything.
  // The confirm step is just two hidden/shown elements inside this one
  // control, so nothing needs to be stored. Focus lands on "Keep" (the
  // safe choice) when the question appears.
  function buildItemControls(item) {
    var box = el("div", "delete-control");

    var editButton = el("button", "edit-button", "Edit");
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Edit " + item.name);
    editButton.addEventListener("click", function () {
      startEdit(item);
    });

    var deleteButton = el("button", "delete-button", "Delete");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete " + item.name);

    var confirmBox = el("div", "delete-control");
    confirmBox.hidden = true;
    var yes = el("button", "delete-yes", "Yes, delete");
    yes.type = "button";
    var keep = el("button", "delete-keep", "Keep");
    keep.type = "button";
    confirmBox.appendChild(el("span", "delete-question", "Delete this?"));
    confirmBox.appendChild(yes);
    confirmBox.appendChild(keep);

    deleteButton.addEventListener("click", function () {
      editButton.hidden = true;
      deleteButton.hidden = true;
      confirmBox.hidden = false;
      keep.focus();
    });
    keep.addEventListener("click", function () {
      confirmBox.hidden = true;
      editButton.hidden = false;
      deleteButton.hidden = false;
      deleteButton.focus();
    });
    yes.addEventListener("click", function () {
      deleteItem(item);
    });

    box.appendChild(editButton);
    box.appendChild(deleteButton);
    box.appendChild(confirmBox);
    return box;
  }

  // Draws a pixel icon from the text map in achievements.js. Each "X"
  // becomes a 1x1 square in an 8x8 grid. The SVG namespace URL is required
  // when creating SVG elements from JavaScript.
  function buildIcon(type) {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 8 8");
    svg.setAttribute("class", "achievement-icon");
    svg.setAttribute("aria-hidden", "true");   // decorative
    BacklogAchievements.ICONS[type].forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        if (row.charAt(x) !== "X") continue;
        var square = document.createElementNS(svgNS, "rect");
        square.setAttribute("x", String(x));
        square.setAttribute("y", String(y));
        square.setAttribute("width", "1");
        square.setAttribute("height", "1");
        square.setAttribute("fill", "currentColor");
        svg.appendChild(square);
      }
    });
    return svg;
  }

  // "Nov 13, 2026", or "" if the date is missing or unreadable (items
  // finished before completion dates existed).
  function formatDate(isoText) {
    var date = new Date(isoText);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // One achievement card. style.css gives each type its own shape through
  // the data-type attribute: ticket stub, trophy plaque, parchment, blueprint.
  function buildAchievement(item) {
    var li = el("li", "achievement");
    li.setAttribute("data-type", item.type);

    li.appendChild(buildIcon(item.type));
    li.appendChild(el("p", "achievement-title", BacklogAchievements.TITLES[item.type]));
    li.appendChild(el("h3", "achievement-name", item.name));
    li.appendChild(el("p", "achievement-stats", formatMinutes(item.totalMinutes) + " cleared"));

    var when = formatDate(item.completedAt);
    if (when) li.appendChild(el("p", "achievement-date", "Completed " + when));

    li.appendChild(buildItemControls(item));
    return li;
  }

  // Builds the HTML for one cartridge from one item. Returns an <li>.
  function buildCartridge(item) {
    // How full the bar is, as a whole-number percent.
    var percent = Math.round((item.remainingMinutes / item.totalMinutes) * 100);

    var li = el("li", "cartridge");
    // style.css reads this attribute to choose the cartridge color.
    li.setAttribute("data-type", item.type);
    // Lets focusLogInput find this exact cartridge after a redraw.
    li.setAttribute("data-id", item.id);

    var body = el("article", "cartridge-body");
    body.appendChild(el("div", "cartridge-grip"));
    body.appendChild(el("p", "cartridge-type", item.type));

    // The cream label sticker with the name and minimum block.
    var label = el("div", "cartridge-label");
    label.appendChild(el("h3", "cartridge-name", item.name));
    label.appendChild(
      el("p", "cartridge-block", "Starts at " + formatMinutes(item.minBlockMinutes))
    );
    body.appendChild(label);

    // The health bar. role="progressbar" plus the aria-value attributes
    // let screen readers announce "Severance health, 450 of 450".
    var track = el("div", "health-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", item.name + " health");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(item.totalMinutes));
    track.setAttribute("aria-valuenow", String(item.remainingMinutes));

    var fill = el("div", "health-fill");
    fill.setAttribute("data-level", barLevel(percent));
    // Hand the width to CSS as a custom property (--pct in style.css).
    fill.style.setProperty("--pct", percent + "%");
    track.appendChild(fill);
    body.appendChild(track);

    body.appendChild(
      el("p", "health-text",
        formatMinutes(item.remainingMinutes) + " left of " + formatMinutes(item.totalMinutes))
    );

    // A defeated item (bar at zero) has nothing left to log, so it gets
    // a badge instead of the form. Everything else gets the log form.
    // The shelf only holds unfinished items (completed ones become
    // achievements), so every cartridge gets a log form and a delete control.
    body.appendChild(buildLogForm(item));
    body.appendChild(buildItemControls(item));

    li.appendChild(body);
    return li;
  }

  // Redraws the whole shelf from the items list. The simplest approach:
  // wipe it and rebuild. With a personal backlog (dozens of items) this
  // is instant, and it can never drift out of sync with the data.
  // "notice" is optional. When given (like "Logged 20m on MGRR."), it
  // replaces the usual count in the status line. Calling render() with no
  // argument gives the normal message. In JavaScript a missing argument is
  // undefined, which counts as false in the "||" below.
  function render(notice) {
    // Unfinished items go on the shelf; completed ones become achievements.
    var parts = BacklogAchievements.splitItems(items);

    shelf.textContent = "";   // clears everything inside
    parts.active.forEach(function (item) {
      shelf.appendChild(buildCartridge(item));
    });

    achievements.textContent = "";
    parts.done.forEach(function (item) {
      achievements.appendChild(buildAchievement(item));
    });

    status.textContent =
      notice ||
      (items.length === 0
        ? "Your shelf is empty. Add something above to get started."
        : parts.active.length === 0
          ? "Your shelf is clear. Add something new to keep going."
          : parts.active.length + (parts.active.length === 1 ? " item" : " items") + " on your shelf.");

    achievementsStatus.textContent =
      parts.done.length === 0
        ? "Nothing yet. Defeat something on your shelf and it lands here."
        : parts.done.length + " cleared.";
  }

  // Shows a list of messages in the error box, or hides it if there are none.
  function showErrors(messages) {
    errorList.textContent = "";
    messages.forEach(function (message) {
      errorList.appendChild(el("li", "", message));
    });
    // The "hidden" attribute is what hides/shows the box (see style.css).
    errorList.hidden = messages.length === 0;
  }

  // ---------------------------------------------------------------
  // THE FORM
  // ---------------------------------------------------------------

  // An "event listener": run this function whenever the form is submitted
  // (button click or pressing Enter in a field).
  form.addEventListener("submit", function (event) {
    // Stop the browser's default behavior, which would reload the page.
    event.preventDefault();

    // Read the fields. Inputs always give back TEXT, even number inputs,
    // so Number() converts the minutes. An empty box becomes 0, which
    // validation then rejects with a clear message.
    var input = {
      name: nameInput.value,
      type: typeSelect.value,
      totalMinutes: Number(totalInput.value),
      minBlockMinutes: Number(blockInput.value)
    };

    // Ask storage.js whether the input is acceptable.
    var result = BacklogStore.validateItem(input);
    if (!result.ok) {
      showErrors(result.errors);
      return;   // stop here; keep what the user typed so they can fix it
    }

    // In edit mode the same form updates the item instead of adding one.
    if (editingItem) {
      finishEdit(input);
      return;
    }

    // Valid: build the item, add it, and save the whole list.
    items.push(BacklogStore.createItem(input));
    var saved = BacklogStore.saveItems(items);

    render();
    // If the browser refused to save, say so, because the item would
    // disappear when the tab closes. Otherwise clear any old errors.
    showErrors(
      saved ? [] : ["Added, but this browser wouldn't save it. It will be gone when you close the tab."]
    );

    form.reset();        // empty the fields
    nameInput.focus();   // ready for the next one
  });

  // ---------------------------------------------------------------
  // DECIDE FOR ME: the cartridge wheel
  // The picking rules live in decide.js and the motion math in wheel.js.
  // This section connects them to the page and runs the animation.
  // ---------------------------------------------------------------

  // Someone who asked their system for less motion gets the answer
  // without the spin.
  function prefersReducedMotion() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Calls onFrame(t) on every screen refresh, with t running 0 -> 1 over
  // "duration" ms, then onDone(). requestAnimationFrame asks the browser to
  // call us just before its next repaint (about 60 times a second).
  // If resetPicker() runs mid-animation, runId changes and this stops.
  function animate(duration, onFrame, onDone) {
    var mine = runId;
    var startTime = null;
    function step(now) {
      if (mine !== runId) return;
      if (startTime === null) startTime = now;
      var t = Math.min(1, (now - startTime) / duration);
      onFrame(t);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        onDone();
      }
    }
    requestAnimationFrame(step);
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function showDecideMessage(text) {
    decideMessage.textContent = text;
    decideMessage.hidden = text === "";
  }

  // The lock: once the wheel has picked, Decide stays locked until you log
  // time on something. Otherwise you could press it again and again to get
  // a fresh reroll every time. (Reloading the page also clears it. It's an
  // honor system, and it keeps the loop honest: decide, do, log.)
  function lockDecide() {
    locked = true;
    decideButton.disabled = true;
    decideButton.textContent = "Locked";
    minutesInput.disabled = true;
    lockNote.hidden = false;
  }

  function unlockDecide() {
    locked = false;
    decideButton.disabled = false;
    decideButton.textContent = "Decide for me";
    minutesInput.disabled = false;
    lockNote.hidden = true;
  }

  // Back to a blank slate: no wheel, no result, no message.
  function resetPicker() {
    runId++;                      // cancels any animation in progress
    search = null;
    spinning = false;
    unlockDecide();
    wheelEl.hidden = true;
    resultEl.hidden = true;
    closestPrompt.hidden = true;
    showDecideMessage("");
  }

  // A small cartridge for the wheel.
  function buildMiniCartridge(item) {
    var cart = el("div", "mini-cart");
    cart.setAttribute("data-type", item.type);
    cart.appendChild(el("div", "mini-grip"));
    cart.appendChild(el("p", "mini-type", item.type));
    cart.appendChild(el("p", "mini-name", item.name));
    return cart;
  }

  // Puts every slot where the current rotation says it belongs.
  // Called on every animation frame. "left" is a percentage of the wheel's
  // width, so no pixel measuring is needed.
  function layoutWheel() {
    wheel.slotEls.forEach(function (slotEl, i) {
      var offset = BacklogWheel.slotOffset(i, wheel.rotation, wheel.slotCount);
      var pose = BacklogWheel.slotPose(offset, wheel.slotCount, wheel.pop);
      slotEl.style.left = 50 + pose.x * BacklogWheel.RADIUS_PERCENT + "%";
      slotEl.style.transform =
        "translateX(-50%) translateY(" + -pose.lift + "px) scale(" + pose.scale + ")";
      slotEl.style.opacity = String(pose.opacity);
      slotEl.style.zIndex = String(pose.z);
    });
  }

  // Fills the wheel with every candidate at least once. Smaller pools repeat
  // around the rim to fill the six slots.
  function setupWheel(candidates) {
    wheel.slotCount = BacklogWheel.slotCountFor(candidates.length);
    wheel.slotItems = [];
    wheel.slotEls = [];
    wheel.rotation = 0;
    wheel.pop = 0;
    slotsEl.textContent = "";

    for (var i = 0; i < wheel.slotCount; i++) {
      var item = candidates[i % candidates.length];
      var slotEl = el("div", "wheel-slot");
      slotEl.appendChild(buildMiniCartridge(item));
      slotsEl.appendChild(slotEl);
      wheel.slotItems.push(item);
      wheel.slotEls.push(slotEl);
    }
    wheelEl.hidden = false;
    layoutWheel();
  }

  // Gives the slot at the front a glow (or removes it from all slots).
  function markWinner(on) {
    wheel.slotEls.forEach(function (slotEl, i) {
      var atFront = BacklogWheel.slotOffset(i, wheel.rotation, wheel.slotCount) === 0;
      slotEl.className = on && atFront ? "wheel-slot is-winner" : "wheel-slot";
    });
  }

  // Fills in and reveals the result block under the wheel.
  function showResult() {
    var pick = search.pick;
    var isClosest = search.status === "closest";

    resultLabel.textContent = isClosest ? "Closest match" : "Your pick";
    resultName.textContent = pick.name;
    resultDetail.textContent = isClosest
      ? "Needs " + formatMinutes(pick.minBlockMinutes) + ", but it's your closest match."
      : capitalize(pick.type) + ". Starts at " + formatMinutes(pick.minBlockMinutes) +
        ", and you have " + formatMinutes(search.minutes) + ".";

    // Reroll button: hidden if a reroll was never possible, disabled
    // ("used") once spent, otherwise ready.
    var canReroll = BacklogDecide.canReroll(search);
    rerollButton.hidden = !(canReroll || search.rerollUsed);
    rerollButton.disabled = !canReroll;
    rerollButton.textContent = canReroll ? "Reroll (1 left)" : "Reroll used";

    resultEl.hidden = false;
  }

  // The whole show, in order:
  //   1. (reroll only) lower the old winner
  //   2. spin the wheel, easing to a stop on the pick
  //   3. pop the winner up with a little bounce
  //   4. reveal the result
  // minSlots = the least it must turn; duration = how long the spin lasts (ms).
  function landOn(pick, minSlots, duration) {
    spinning = true;
    lockDecide();
    rerollButton.disabled = true;
    resultEl.hidden = true;
    markWinner(false);

    var reduced = prefersReducedMotion();
    var slot = wheel.slotItems.indexOf(pick);

    function finish() {
      wheel.rotation = wheel.rotation % wheel.slotCount;   // keep the number small
      layoutWheel();
      markWinner(true);
      spinning = false;
      showResult();
    }

    function popUp() {
      if (reduced) {
        wheel.pop = 1;
        layoutWheel();
        finish();
        return;
      }
      animate(450, function (t) {
        wheel.pop = BacklogWheel.easeOutBack(t);
        layoutWheel();
      }, finish);
    }

    function spin() {
      if (wheel.slotCount === 1) {   // a lone candidate has nothing to spin past
        popUp();
        return;
      }
      var start = wheel.rotation;
      var end = BacklogWheel.landingRotation(start, slot, wheel.slotCount, minSlots);
      if (reduced) {
        wheel.rotation = end;
        layoutWheel();
        popUp();
        return;
      }
      animate(duration, function (t) {
        wheel.rotation = start + (end - start) * BacklogWheel.easeOutQuart(t);
        layoutWheel();
      }, popUp);
    }

    var from = wheel.pop;
    if (from > 0 && !reduced) {
      animate(250, function (t) {
        wheel.pop = from * (1 - t);
        layoutWheel();
      }, function () { wheel.pop = 0; spin(); });
    } else {
      wheel.pop = 0;
      layoutWheel();
      spin();
    }
  }

  decideForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (spinning || locked) return;

    var minutes = Number(minutesInput.value);
    var check = BacklogDecide.validateMinutes(minutes);
    resetPicker();
    if (!check.ok) {
      showDecideMessage(check.error);
      return;
    }

    search = BacklogDecide.startSearch(items, minutes);

    if (search.status === "empty") {
      search = null;
      showDecideMessage("Nothing left to pick from. Add something to your shelf first.");
    } else if (search.status === "closest") {
      // Opt-in: describe the closest match and let the person choose.
      closestText.textContent =
        "Nothing on your shelf fits " + formatMinutes(minutes) + ". Closest match: " +
        search.pick.name + ", which needs " + formatMinutes(search.pick.minBlockMinutes) + ".";
      closestPrompt.hidden = false;
    } else {
      setupWheel(search.candidates);
      landOn(search.pick, 15, 3400);
    }
  });

  rerollButton.addEventListener("click", function () {
    if (spinning || !search) return;
    var next = BacklogDecide.reroll(search);
    if (!next) return;
    search = next;
    landOn(search.pick, 9, 2600);
  });

  anywayButton.addEventListener("click", function () {
    if (!search) return;
    closestPrompt.hidden = true;
    setupWheel([search.pick]);
    landOn(search.pick, 0, 0);
  });

  // Jump to the pick's log box on the shelf (focusing scrolls it into view).
  logPickButton.addEventListener("click", function () {
    if (search && search.pick) focusLogInput(search.pick.id);
  });

  // ---------------------------------------------------------------
  // BACKUP AND RESTORE
  // The rules (file format, safety checks, merging) live in storage.js.
  // This section handles the buttons and the file itself.
  // ---------------------------------------------------------------

  function showBackupMessage(text, isError) {
    backupMessage.textContent = text;
    backupMessage.className = isError ? "backup-message is-error" : "backup-message";
    backupMessage.hidden = text === "";
  }

  function countText(n) {
    return n + (n === 1 ? " item" : " items");
  }

  // Saves a text file for the person. The usual way: make a temporary link
  // to the text and click it. Some hosting environments sandbox downloads
  // and offer their own way to save a file; if one provided
  // window.BacklogHostSave, use that instead. Either way this returns a
  // Promise, which rejects if the save was declined or failed.
  function downloadTextFile(fileName, text) {
    if (typeof window.BacklogHostSave === "function") {
      return window.BacklogHostSave(fileName, text);
    }
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;   // tells the browser to save instead of open
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Free the temporary URL a moment later, once the download has started.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Promise.resolve();
  }

  // Reads a restored file's text, merges it in, saves, and reports.
  function restoreFromText(text) {
    var parsed = BacklogStore.parseBackup(text);
    if (!parsed.ok) {
      showBackupMessage(parsed.error, true);
      return;
    }
    if (parsed.items.length === 0) {
      showBackupMessage("That backup has no items in it.", true);
      return;
    }

    var merged = BacklogStore.mergeItems(items, parsed.items);
    items = merged.items;
    var saved = BacklogStore.saveItems(items);

    // A restore can finish the item the wheel picked. Treat that like
    // defeating it: clear the wheel.
    if (search && search.pick && search.pick.remainingMinutes === 0) resetPicker();
    render();

    var message;
    if (merged.added + merged.updated === 0) {
      message = "Nothing new in that backup. Everything was already on your shelf.";
    } else {
      message = "Restored: " + merged.added + " added, " + merged.updated + " updated, " +
        merged.kept + " already up to date.";
    }
    if (parsed.skipped > 0) {
      message += " " + countText(parsed.skipped) + " in the file couldn't be used.";
    }
    if (!saved) message += " This browser wouldn't save the result, so it may be lost.";
    showBackupMessage(message, !saved);
  }

  exportButton.addEventListener("click", function () {
    if (items.length === 0) {
      showBackupMessage("Nothing to back up yet. Add something to your shelf first.", true);
      return;
    }
    var count = items.length;
    var text = JSON.stringify(BacklogStore.makeBackup(items), null, 2);   // 2 = indent, for readability

    downloadTextFile(BacklogStore.backupFileName(new Date()), text).then(
      function () {
        showBackupMessage("Backup downloaded: " + countText(count) + ".", false);
      },
      function (error) {
        showBackupMessage(
          error && error.code === "declined" ? "Backup canceled." : "Couldn't save the backup file here.",
          true
        );
      }
    );
  });

  // The visible button opens the hidden file picker.
  importButton.addEventListener("click", function () {
    importFile.click();
  });

  importFile.addEventListener("change", function () {
    var file = importFile.files && importFile.files[0];
    if (!file) return;
    if (file.size > 2000000) {   // a real backup is a few KB; this is just a sanity limit
      showBackupMessage("That file is too big to be a backup.", true);
      importFile.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      restoreFromText(String(reader.result));
      importFile.value = "";   // so choosing the same file again still fires "change"
    };
    reader.onerror = function () {
      showBackupMessage("Couldn't read that file.", true);
      importFile.value = "";
    };
    reader.readAsText(file);
  });

  // ---------------------------------------------------------------
  // STARTUP
  // ---------------------------------------------------------------
  fillTypeOptions();
  render();
})();
