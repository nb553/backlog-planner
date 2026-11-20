# Backlog Planner: Roadmap

A small browser app built with plain HTML, CSS, and JavaScript.

## The goal

End indecision by turning big backlogs (shows, games, books, projects) into small, doable blocks. You tell the app how many minutes you have, and it picks something that fits. The point is to show that you don't need to sit down for hours to watch or work on something.

**Core idea:** every item is a "boss" with a health bar. Each session is an attack that chips the bar down.

**Opening moments the app serves:**
- "I have an hour to kill. What's in my backlog?"
- "I've been studying for hours and need a quick break. What can I touch up?"

---

## v1: Three must-haves

### 1. Add items
Each item has:

| Field | Notes |
|---|---|
| Name | Free text |
| Type | watch, play, read, build, move (walks, workouts, and outdoor activities) |
| Total size | Minutes. Required. Every item must have a real end. |
| Minimum useful block | Minutes. The least time that makes starting worthwhile (e.g. 20 for an episode). |

### 2. Time filter and "Decide for me"
The user enters how many minutes they have.

**Matching rules**
- Every item is splittable. A 450-minute show is a valid pick for a 20-minute session.
- An item qualifies if the user's minutes are **at least its minimum useful block**.
- Finished items (nothing remaining) are excluded.

**Picking rules ("all qualifying items, then random")**
1. Rank qualifying items by how close their minimum block is to the minutes available.
2. Keep every qualifying item as a candidate in ranked order.
3. Pick one candidate at random.

**Reroll**
- The user gets **one reroll** per search.
- The reroll picks from the remaining candidates and never repeats the rejected item.
- After one reroll, the button locks until the user runs a new search.

**When nothing fits**
- Show the **closest fit** as an opt-in, labeled honestly, e.g. "Needs 20 minutes, but it's your closest match."

### 3. Health bars and "log minutes"
- Each item shows a bar for how much is left.
- A **"log minutes"** button lets the user type how long they worked on it. The bar drops by that amount.
- Logging is manual. There is no timer in v1.

### Saving
- The list **saves in the browser** (local storage) so it is still there next time.

---

## Later (dress-up), roughly in order

1. **Mark as done at zero.** ✅ Done as the Achievements section: a defeated item leaves the shelf and becomes a card styled by type (ticket stub, trophy plaque, bookmarked page, blueprint), with a pixel icon, a type title, total time, and completion date.
2. **Countdown timer and alarm.** Starts when an item is picked, rings when the time is up. Holds the user accountable.
3. **Automatic damage with an "adjust" link.** When the timer ends, apply time-based damage automatically and offer a small correction link. This reuses the same "apply damage" action as manual logging.
4. **Weekly session counter.** "Fun sessions this week," a record of attacks that encourages protecting free time.
5. **Mood filter.** Cut from v1 to keep the app simple. If it returns, start with a small fixed set of moods rather than custom tags.
6. **Habit-style items with no end.** Walking, daily scripture, and similar. These have no total size, so they need their own design (no health bar, just a running total).
7. **Smarter picking.** Options considered: weighted random, or preferring items closest to done.
8. **Delete button.** ✅ Done. Every shelf cartridge and achievement card has a Delete button with a two-step "Delete this?" confirm (focus starts on Keep). Undo was considered and skipped for now.

---

## Next: the ideas, smallest to biggest

Decided order for the optional ideas. This order replaces the numbered "Later" list above where the two overlap.

**Small**
1. **Backup.** ✅ Done. "Download backup" saves a JSON file; "Restore from backup" merges one in (see the decision log). Every restored item is checked and rebuilt, so a damaged or hand-edited file can't break the app.
2. **Edit an item.** ✅ Done. An Edit button on every card and achievement refills the add form; saving updates the item and keeps logged time logged.
3. **One-tap quick log.** A button that logs the item's minimum block, or finishes it, with no typing.
4. **"Free until 9:30."** Enter a clock time instead of minutes.
5. **Shelf filter and sort** by type.
6. **Hit effects.** Floating damage numbers, a bar flash, and a burst when something is defeated.
7. **8-bit sound** (wheel ticks, landing pop, victory jingle) with a mute toggle.
8. **Undo** for logs and deletes.

**Medium**
9. **Session history and the weekly counter.** Record each log with a date. This is the foundation for 11 and 15.
10. **Console themes.** `css/theme-arcade.css` is a draft arcade look (an original design, no characters or logos). The first preview was judged too harsh (neon), and the original cartridge look is the preferred base. Looks will be workshopped later; the theme picker itself (remembering a choice) is still to build.
11. **Player level.** Minutes logged become XP, with a rank in the header.
12. **Countdown timer and alarm**, with automatic damage and an "adjust" link when time is up.
13. **Mood filter.** Start with a small fixed set of moods.
14. **Units.** Log "1 episode" or "10 pages" instead of minutes.
15. **Weekly activity chart.**
16. **Install as a phone app.** Home-screen icon, works offline, and bundles the pixel font so it never depends on Google.

**Big**
17. **Habit-style items with no end** (walking, daily scripture).
18. **Accounts and syncing across devices**, only if wanted (see below).

## Saving and accounts

- **Today:** the list is saved in the browser's local storage. That means it is private to one browser on one device. Everyone who opens the link gets their own separate list, and the app owner can't see anyone's data. The same person on a phone and a laptop has two lists, and clearing browser data erases the list.
- **Accounts** need a server and a database, plus login security, privacy handling, and hosting. That ends the "plain HTML, CSS, and JavaScript only" rule. It is possible (services like Firebase or Supabase handle most of it), but it's the biggest change on this list.
- **Smaller paths first:** backup files (item 1) cover moving between devices by hand. A "sync by link or QR code" could come later without any server.

## Decision log

| Question | Decision |
|---|---|
| Is the timer core? | No. Manual logging for v1, timer later. |
| How does the bar drop? | A mix: time-based damage plus user adjustment (later). v1 uses manual minutes only. |
| Adjust every time, or automatic with optional fix? | Automatic with optional fix (later). |
| Match on total remaining, or splittable? | Splittable. Any item can fill any slot that meets its minimum block. |
| Minimum useful block? | Yes, per item. |
| Nothing fits? | Show the closest fit, labeled honestly. |
| Items with no end (habits)? | Left out of v1. |
| Mood tags? | Removed from v1. |
| How to choose among several fits? | All qualifying items, ranked by closeness, then random. |
| Reroll? | One per search, excludes the rejected item. |
| Press Decide again right away? | No. Decide locks after a pick until you log time on something (or delete a candidate), so the reroll can't be refreshed by re-pressing the button. In memory only, so a page reload clears it. |
| Persistence? | Save in the browser. |
| Editing the total size of an item with progress? | Time already logged stays logged: new remaining = new total minus logged. If the new total is no more than what's logged, the item is marked defeated, but only after a second "Save changes" press to confirm. A finished item given a bigger total goes back on the shelf. Editing never unlocks Decide or refreshes the reroll; the wheel updates in place. |
| Restoring a backup? | Merge, never replace. New items are added. An item already on the shelf takes the backup's progress only if the backup is further along. Nothing is deleted, though an item you deleted can come back if the backup still has it. |

---

## Build plan

1. **Data and saving:** item structure plus load/save to local storage. ✅ Done (18 tests passing).
2. **Add-item form and list:** fields above, with basic validation (size and minimum block must be positive numbers; minimum block cannot exceed total size). ✅ Done.
3. **Health bars and log minutes:** show remaining, clamp at zero. ✅ Done (25 tests passing).
4. **Time input and Decide for me:** matching, ranking all qualifying items, random pick. ✅ Done, as a spinning cartridge wheel.
5. **Reroll and closest-fit fallback:** one-time reroll, honest labeling. ✅ Done (built together with step 4).
   - Follow-up round after testing: Decide locks after a pick, delete with confirm, and the Achievements section. ✅ Done.
6. **Polish and GitHub prep:** ✅ Done. Dark native controls, notch-safe padding, tab icon and theme color, README, `npm test`, and a page-wiring test. (Empty states, 44px tap targets, and the mobile layout were built in along the way.)

## Publishing on GitHub

The plan is to put this project on GitHub, so it is built to be shared:

- **No build tools or dependencies.** Plain HTML, CSS, and JavaScript, so anyone can clone it and open `index.html`.
- **Classic scripts, not ES modules,** so the app works from a double-click without a local server.
- **Readable code.** Each file has one job and a header comment explaining it.
- **Comments written for learning.** Every file explains what each part does and why, including the JavaScript concepts used, so the project doubles as a review reference for other apps. New files in later steps follow the same style.
- **Tests for the logic,** runnable with `node tests/<file>.test.js` and no libraries.
- **Before publishing:** README is written. Still to do by hand: take a screenshot into `docs/screenshot.png` and swap it into the README, and choose a license (MIT is a common choice for a project like this). Optionally host it free with GitHub Pages (steps are in the README).

### Project structure

```
backlog-planner/
  index.html          page structure: decide, add form, shelf, achievements
  README.md           how to run, how it works, how to publish
  package.json        "npm test" runs every test file
  .gitignore          files Git should skip
  roadmap.md          this file
  css/
    style.css         the retro arcade cartridge look
    theme-arcade.css  DRAFT beat-'em-up arcade theme (not linked yet)
  js/
    storage.js        item model, validation, save/load, applyDamage
    decide.js         Decide for me rules: matching, ranking, reroll
    wheel.js          wheel motion math: positions, landing, easing
    achievements.js   per-type titles and pixel icons, shelf/achievements split
    app.js            add form, log forms, wheel animation, and drawing
  tests/
    storage.test.js   tests for storage.js
    decide.test.js    tests for decide.js
    wheel.test.js     tests for wheel.js
    achievements.test.js  tests for achievements.js
    page.test.js      checks the HTML, CSS, and JS are wired together
```

## Visual direction

**Retro arcade cartridge shelf**, inspired by the playful console-style look of Hursty's RetroPie/EmulationStation themes (general spirit only, nothing copied).

- **Palette:** deep indigo background, cream label stickers, teal for the main action. Cartridge colors by type: watch coral, play purple, read yellow, build blue, move green. Type badges are capitalized, and the "Starts at" and "left of" lines are italic.
- **Type:** Press Start 2P (pixel) for title, headings, buttons, and type badges. Plain system font for names and body text so long titles stay readable.
- **Signature element:** each item is a cartridge with a chamfered corner, grip ridges, a cream label, and a segmented health bar (green, then yellow, then red as it drains).
- **Decide for me wheel:** inspired by spinning game-cartridge carousels. Every qualifying candidate appears at least once around the drum; two through six candidates use six slots, and larger pools get one slot per candidate. It spins and eases to a stop, then the winner pops up with a bounce and a glow. One candidate means no spin, just the pop. Reduced-motion users get the pick without the spin.
- **Achievements:** each type gets its own card shape and pixel icon: watch is a ticket stub, play a trophy plaque, read a bookmarked page, build a blueprint, move a trail map.
- **Note:** the pixel font loads from Google Fonts. Offline, it falls back to a monospace font and everything still works.

## Done when
A user can add a few items, enter "20 minutes," tap **Decide for me**, get a sensible pick (or an honest closest match), log minutes on it, and see the bar drop, with everything still there after closing and reopening the tab.
