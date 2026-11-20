# Backlog Planner

Turn a big backlog into small, doable blocks. Tell it how many minutes you have, and a cartridge wheel spins and picks something that fits. You don't need to sit down for hours to watch a show or work on a project.

Built with plain HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies.

<!-- Add a screenshot at docs/screenshot.png, then replace this line with: ![Backlog Planner](docs/screenshot.png) -->

## What it does

- **Add things to your shelf.** Shows to watch, games to play, books to read, projects to build, and activities to move (walks, workouts, and going outside). Each one has a total size in minutes and a *minimum block*: the least time that's worth starting.
- **Decide for me.** Enter your minutes and the wheel lands on a pick. You get one reroll per pick.
- **Log minutes.** Every item is a cartridge with a health bar. Log time on it and the bar drops.
- **Achievements.** When a bar hits zero, the item leaves the shelf and becomes a card styled by type: a ticket stub, a trophy plaque, a bookmarked page, a blueprint, or a trail map.
- **Edit** an item's name, type, or sizes. Time you've already logged stays logged.
- **Delete** anything from the shelf or the achievements, with a confirm step.
- **Back up and restore.** Download your list as a file and restore it later or on another device. Restoring only adds and updates; it never deletes.
- **Saved in your browser.** Everything stays in local storage. Nothing is sent anywhere.

## How the pick works

1. An item qualifies if it has time left and your minutes are at least its minimum block.
2. Qualifying items are ranked by how close their minimum block is to your minutes. With 60 minutes, a 45-minute episode beats a 10-minute chapter.
3. The closest three become the wheel's candidates, and one is picked at random.
4. One reroll per pick, chosen from the other candidates.
5. If nothing fits, it offers the closest match, labeled honestly ("Needs 30m, but it's your closest match"), and only shows it if you ask.
6. After a pick, Decide stays locked until you log time on something. That keeps the reroll from being refreshed by pressing the button again.

## Run it

Open `index.html` in a browser. It works from a double-click.

Or serve the folder, which is closer to how it behaves when hosted:

```
python3 -m http.server 8000
```

then visit http://localhost:8000.

The pixel font (Press Start 2P) loads from Google Fonts. Offline, the app falls back to a monospace font and works the same.

## Tests

You need [Node.js](https://nodejs.org). There are no packages to install.

```
npm test
```

Or run one file at a time, for example `node tests/decide.test.js`.

## Project structure

```
index.html            page structure
css/style.css         the retro arcade cartridge look
css/theme-arcade.css  draft arcade theme (not used yet)
js/storage.js         items, validation, saving, logging minutes, deleting
js/decide.js          the "Decide for me" rules
js/wheel.js           motion math for the cartridge wheel
js/achievements.js    titles and pixel icons for completed items
js/app.js             connects everything to the page
tests/                tests for the logic, plus a check that the page is wired up
roadmap.md            decisions made and ideas for later
```

The logic files (`storage`, `decide`, `wheel`, `achievements`) know nothing about the page, which is why they can be tested without a browser. Only `app.js` touches the page.

## Publish on GitHub Pages

1. Put this folder at the root of a GitHub repository and push it.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick your main branch and the `/ (root)` folder, and save.
4. After a minute, the app is live at `https://<your-username>.github.io/<repository-name>/`.

## Roadmap

See [roadmap.md](roadmap.md) for the decisions behind the app and the ideas still to come: a countdown timer with an alarm, automatic progress after a session, a weekly session counter, a mood filter, and habit-style items with no end.
