# build-tool

Reproducible-build and test harness for the EnigmAgent extension.

## Install once

```bash
cd build-tool
npm ci          # honors package-lock.json
```

## Commands

| Command | What it does |
|---|---|
| `npm run build:argon2` | Bundle `@noble/hashes` Argon2id into `extension/lib/argon2id.js` (single IIFE, ~13 KB). |
| `npm run build:icons`  | Regenerate `extension/icons/icon-{16,48,128}.png` (requires Pillow: `pip install pillow`). |
| `npm run build`        | Both of the above. |
| `npm test`             | Headless Node test harness — 30 assertions covering crypto round-trip, vault JSON format, domain binding, placeholder grammar, and bundle byte-equivalence. |

## Why a separate folder

The extension (`../extension/`) ships with no build step and no `node_modules`. Every JS/HTML/CSS/PNG file is static and directly auditable. The build artifacts (`argon2id.js`, the icons) are checked in so that loading the repo requires zero tooling.

This folder is only for re-generating those artifacts and verifying them. Reviewers can diff the generated files against a fresh build to confirm they were not tampered with.

## Reproducibility check

```bash
npm ci
npm run build:argon2
sha256sum ../extension/lib/argon2id.js
```

A published release will ship with the expected hash in the release notes.
