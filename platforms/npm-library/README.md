# EnigmAgent Node vault library v3

```javascript
import { VaultManager, FileStorage } from "@enigmagent/vault";
const vault = new VaultManager(new FileStorage("./vault.json"));
```

Use `create`, `unlock`, `migrate`, `addSecret`, `updateSecret`, `deleteSecret`, `list`, `exportTo` and `recoverBackup` as documented in the bundled TypeScript definitions. Do not place real passwords or values in source code. `create` and `exportTo` never overwrite; writes use optimistic revision checks. Metadata and the complete entry set are authenticated together in format v2. A failed unlock locks any old session.

`resolve` and `revealSecret` return raw values to trusted application code; they are not model-isolating tools. The integrated gateway supplies a separate fixed-operation broker. Node.js 22+ is tested. Browser v1, Deno and Bun compatibility are not claimed.
