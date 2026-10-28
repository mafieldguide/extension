# MA Field Guide exporter

A browser extension that saves your own [Math Academy](https://mathacademy.com) activity, and Math Academy's memory
level for each topic you have practised and the topic list of each course you have studied, as one small file (`ma-activity.json`) for the MA Field Guide knowledge graph.

MA Field Guide is an independent community project. It is not affiliated with, endorsed by, or speaking for Math
Academy.

- Free, no account, no server, no tracking. Nothing is sent anywhere: see [PRIVACY.md](PRIVACY.md).
- Runs only on `mathacademy.com`, in your signed-in tab, when you press the button.
- Plain JavaScript with no build step and no dependencies. The code is in [`src/`](src); `popup.js`, `sync.js`,
  `api.js` and `minimise.js` are all of it.

## Install

Store listings are on the way. Until they are approved, download the zip for your browser from the
[latest release](../../releases/latest), unzip it, and:

- **Chrome or Edge:** open `chrome://extensions` (or `edge://extensions`), switch on Developer mode, choose
  **Load unpacked**, and pick the unzipped folder.
- **Firefox:** open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on**, and pick the
  `manifest.json` inside the unzipped folder. Firefox forgets a temporary add-on when it closes, so add it again next
  time. You may need to grant it access to Math Academy under Permissions in `about:addons`.

Then open your Math Academy page while signed in, click the extension's icon (pin it from the puzzle-piece menu if you
cannot see it) and press the orange button. `ma-activity.json` lands in your Downloads.

## Develop

Needs Node 22.19 or newer, and `zip` on your PATH (macOS and Linux have it).

```
npm install
npm test            # the sync and minimise tests
npm run build       # dist/ma-field-guide-exporter-chrome.zip and ...-firefox.zip
npm run format:check
```

To try the unpacked source: Chrome, load `src/` (Load unpacked); Firefox, load `src/manifest.firefox.json`.

The Chrome and Edge zip uses `src/manifest.json`. The Firefox zip uses `src/manifest.firefox.json`, renamed to
`manifest.json` inside the zip. Keep `version` the same in both manifests; the build refuses to run if they differ.

## Release

1. Bump `version` in both manifests and add a line to [CHANGELOG.md](CHANGELOG.md).
2. `npm test && npm run build`, and try the zips.
3. Commit, then tag and push: `git tag v1.2.0 && git push --tags`. The release workflow checks the tag matches the
   manifests, builds both zips and attaches them to a GitHub release.
4. Upload the same zips to the Chrome Web Store and Firefox Add-ons.

## The file it makes

A list of completed tasks, or `{ "tasks": [...], "topics": [...] }` when memory levels were available. The MA Field
Guide site reads this format, so change it only together with the site. Never commit a raw activity log: it is personal
data.

## Reporting a problem

Open an issue. Say which browser and version, what you pressed, and what the popup said. Do not attach your
`ma-activity.json`.

## Licence

The source code is [MIT](LICENSE). The licence covers the code only: it does not grant any right to the "MA Field
Guide" name, its logo, the icons in `src/icons/`, or the images in `store-assets/`.
