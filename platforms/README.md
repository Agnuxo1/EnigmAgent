# Platform status for the integrated 3.0.0 release

| Component | Release status |
|---|---|
| `mcp-server` | Current authenticated vault, MCP/REST broker, administrator and Node client |
| `cli` | Current standalone administrator; shared runtime verified against gateway source |
| `shared` | Current shared vault core; exact-copy checks in the Node suite |
| `npm-library` | Current Node library and TypeScript definitions |
| `python-sdk` | Current authenticated client and ten execution-tested native factories |
| `docker` | Current source-pinned non-root image; obsolete separate unprotected REST server removed |
| Browser extension, Firefox/Safari, PWA/web | Historical v1/browser code, not format-v2 Node storage or a v3 browser-store release |
| Electron/Tauri, mobile, VS Code/JetBrains/Eclipse | Historical GUI/IDE/native wrappers requiring separate build, IPC and compatibility review |
| Other integrations and store listings | Historical prototypes/listings; not proof of published or tested v3 support |

Current distribution files are the archives, wheel and image in the matching tagged
GitHub release. Do not infer functionality, security or upstream acceptance from a
folder name. The complete prior source trees remain in `versions/`. No legacy
source has been silently described as a newly completed supported product.
