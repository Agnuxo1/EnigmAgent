# Chrome-Stats — Submission Guide

## What is Chrome-Stats?
[chrome-stats.com](https://chrome-stats.com) is a Chrome extension analytics and discovery platform.
Extensions are **indexed automatically** from the Chrome Web Store once published.
There is no manual submission — it crawls the CWS.

## Steps

1. **Publish to Chrome Web Store first** (required):
   - Use `platforms/store-listings/chrome/enigmagent-chrome-1.0.0.zip`
   - Listing metadata: `platforms/store-listings/chrome/listing.json`
   - Dashboard: https://chrome.google.com/webstore/developer/dashboard

2. **Chrome-Stats auto-indexes** within 24-48 hours of CWS approval.

3. **Verify indexing**:
   - Search: https://chrome-stats.com/search?q=enigmagent
   - Direct URL will be: `https://chrome-stats.com/d/<extension-id>`

4. **Optional — claim your listing**:
   - Create account at chrome-stats.com
   - Claim ownership for analytics access (install trends, ratings, etc.)

## Expected listing fields (auto-populated from CWS)

| Field | Value |
|-------|-------|
| Name | EnigmAgent — Local AI Secret Vault |
| Category | Productivity |
| Version | 1.0.0 |
| Users | (starts at 0, grows organically) |
| Rating | (starts at 0, from user reviews) |
| Manifest version | 3 |
| Permissions | storage, tabs |

## SEO keywords for CWS listing
Ensure these appear in the CWS description for chrome-stats discoverability:
`ai agents`, `vault`, `secrets`, `api keys`, `placeholder`, `langchain`, `crewai`, `n8n`,
`aes-256`, `local`, `privacy`, `credentials`
