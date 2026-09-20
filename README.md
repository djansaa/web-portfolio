# David Jansa — web portfolio

A static portfolio and browser-only REST/SOAP API documentation tool.

## Run locally

```sh
npm ci
npm run dev
```

The development server uses `/web-portfolio/` as its base path. Run `npm test` for the data and privacy checks, and `npm run build` to produce the static site in `dist/`. After changing TypeScript while the development server is already running, run `npm run build:assets` to refresh the browser bundles.

## Publish

The committed `assets/*.js` bundles and relative CSS paths also let GitHub Pages publish the repository root directly from `main`; run `npm run build:assets` and commit the updated bundles whenever TypeScript changes. The GitHub Actions workflow separately builds and publishes `dist/` when `main` changes. Choose either **Deploy from a branch** (`main`, `/`) or **GitHub Actions** as the publishing source in **Settings → Pages**. The public paths are `/web-portfolio/`, `/web-portfolio/art/`, and `/web-portfolio/dev/`.

The editor, secret review, draft storage and downloads run locally in the visitor's browser. Drafts are saved with detected secrets replaced by placeholders. Secret detection is best effort; review files before sharing them.
