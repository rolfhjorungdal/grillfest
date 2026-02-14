# Grillfest

A static GitHub Pages app for planning overlap in work rotations (e.g. 3-on/3-off, 4-on/4-off).

## Features

- Hash-only persistence (`location.hash`) for shareable URLs.
- No server processing, no cookies, no backend.
- Rotation model per person:
  - `weeksOn`
  - `weeksOff`
  - `anchorDate`
  - `anchorState` (`work` or `off` on anchor date)
- Highlights days where at least `minOff` people are off.

## Run locally

Open `index.html` directly, or use a static server:

```powershell
npx serve .
```

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In GitHub: `Settings -> Pages`.
3. Under `Build and deployment`, set:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (or your default branch), `/ (root)`
4. Save. GitHub Pages will serve `index.html`.

## Notes

- The URL hash is not sent to the server in HTTP requests.
- This app intentionally stores all state client-side only.
