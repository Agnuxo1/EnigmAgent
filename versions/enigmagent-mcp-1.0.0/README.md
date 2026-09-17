# Preserved source: bundled gateway 1.0.0

`source-21e2699.tar.gz` contains all 325 tracked files of the complete EnigmAgent
repository at commit `21e26997219ecb2f3d27a492b4802d1b97a4f13d`, before gateway v2
changes. It is not merely a copy of the edited entry point.

The archive was created with automatic line-ending conversion disabled and every
archived file was compared byte-for-byte with its original Git blob.
`MANIFEST.json` records its SHA-256, source commit, scope and verification.
No untracked local files, personal vaults, dependency directories or private
workspace files were added to this snapshot.

**Historical reference, not a recommended deployment.** The archived gateway has
no REST client authentication, enables raw MCP resolution by default, and exits
on JSON `null`. Do not expose it to real credentials while reproducing the audit.
The archive is inert and excluded from the gateway's npm package.

To restore the historical source for inspection, verify the checksum first and
extract into a new empty directory, never over a running application. Obtain the
expected digest from `MANIFEST.json`. On PowerShell:

```powershell
Get-FileHash ./source-21e2699.tar.gz -Algorithm SHA256
New-Item -ItemType Directory ./historical-source
 tar -xzf ./source-21e2699.tar.gz -C ./historical-source
```

The ordinary Git history is also retained. No history was rewritten or force-pushed.
