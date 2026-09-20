# David Jansa — web portfolio

A static portfolio and browser-only REST/SOAP API documentation tool.

## Run locally

```sh
npm ci
npm run dev
```

The development server uses `/web-portfolio/` as its base path. Run `npm test` for the data and privacy checks, and `npm run build` to produce the static site in `dist/`.

## Publish

The GitHub Actions workflow builds and publishes `dist/` to GitHub Pages when `main` changes. In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source. The public paths are `/web-portfolio/`, `/web-portfolio/art/`, and `/web-portfolio/dev/`.

The editor, secret review, draft storage and downloads run locally in the visitor's browser. Drafts are saved with detected secrets replaced by placeholders. Secret detection is best effort; review files before sharing them.
