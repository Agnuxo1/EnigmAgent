# Threat Model

## Scope and component boundaries

The browser substitution flow and the bundled MCP/REST resolver are not
interchangeable. In `platforms/mcp-server/index.js`, `enigmagent_resolve` returns
`content: [{ type: 'text', text: value }]`; REST `/resolve` also returns the
resolved value to its caller. Domain matching does not prevent that caller
from forwarding or logging the value. Do not connect a raw resolver to a model
when context isolation is required. This observation is based on source review,
not a test using real credentials or a complete security audit.

Separately published packages and adapters may have different behavior. Verify
their exact versions rather than transferring guarantees between components.

## What EnigmAgent defends against

| Threat | Defense |
|---|---|
| LLM provider logs or trains on your secret | Browser substitution can avoid typing a secret into a prompt, but this does not cover raw MCP resolution, page scripts, client logs or tool responses. |
| Chat history leaks your secret | Depends on the complete integration. A raw resolver result can enter history. |
| Stolen vault file | AES-256-GCM with an Argon2id-derived key raises the cost of offline guesses. The previous numerical estimate was incorrect: 100 million guesses at 800 ms each is about 2.54 serial years, not 2,500. That hypothetical rate is not a measured attack cost, and password length alone does not determine entropy. |
| Rogue site tricking the agent into pasting a token | Every secret is pinned to a domain. The bridge refuses to resolve on mismatched origins; a phishing site at `g1thub.com` gets `domain_mismatch` back. |
| Clipboard sniffers / paste loggers | The plaintext is written directly to the input's `value` property via the native setter — never to `navigator.clipboard`. |
| A second tab reading the plaintext | Extension isolation separates ordinary origins, but destination-page scripts and privileged extensions can read injected values. There is no universal protection against those observers. |
| Agent trying to exfiltrate the value by pasting it into the chat | A correctly isolated execution adapter must not return credentials. The bundled raw MCP resolver does return them and is unsuitable for this requirement. |

## What EnigmAgent does NOT defend against

| Threat | Why |
|---|---|
| Compromised OS / kernel malware | A kernel-level attacker reads process memory. No userland tool can stop this. |
| Another browser extension with `<all_urls>` | A malicious extension can read DOM values and keystrokes. Users must audit what they install. Consider a separate browser profile for EnigmAgent. |
| Phishing the vault password | If an attacker convinces you to type your master password into a lookalike page, they win. The vault UI runs only at the extension origin — verify the URL bar shows `chrome-extension://...` before typing. |
| Malicious version of EnigmAgent itself | Install only from signed releases; verify the SHA256 of `argon2id.js` matches the reproducible build. |
| Weak password | Argon2id makes brute force expensive but a 4-character password still falls in minutes. The UI enforces a minimum of 8 chars; 12+ is strongly recommended. |
| Screen recording or shoulder-surfing | If a value is ever shown on screen (the `reveal` command), a recorder captures it. The default `get` command masks. |
| User manually pasting the secret into the chat | Nothing stops the user from defeating the system. The agent-side system prompt (see [examples/agent-system-prompt.md](../examples/agent-system-prompt.md)) is the first line of defense. |

## Residual risks we accept

### Brief plaintext exposure in DOM

During the submit-time swap, the real value is present in `<input>.value`. Destination-page event handlers and other extensions with page access can read it synchronously; they do not need to win a timing race. JavaScript does not guarantee erasure after one event-loop tick. Treat the destination page as a credential recipient. Mitigations:

- Write via the native setter + dispatch `input`/`change` once — no extra observability window.
- Re-submit immediately with `form.requestSubmit()`.
- Recommend a separate browser profile with no other `<all_urls>` extensions.

### `<all_urls>` host permission

The content script must run on every page because the user cannot predict which origins their agent will touch. This is the same permission most password managers request. A future version may offer a "strict mode" that only activates on domains with a bound secret.

### Reliance on `chrome.storage.local`

The vault file lives in `chrome.storage.local`, which is accessible to the extension itself but not to other extensions. It is cleared if the user removes the extension — so users must **export** the vault before uninstalling. The export is the same encrypted JSON; it is safe to back up to untrusted storage.

## Assumptions

- Browser ≥ Chromium 115 / Firefox 115 (for `chrome.storage.session`, `requestSubmit`, MV3 semantics).
- OS has standard user-isolation; no other user on the machine has access to the browser profile.
- The user does not share their master password with the agent — even a placeholder for the master password would be self-defeating.

## Not a password manager replacement

EnigmAgent is specifically the **LLM-in-the-loop** layer. For your own daily logins keep using 1Password or Bitwarden — EnigmAgent handles only the case where a *different actor* (an agent) is acting on your behalf and must not see your secrets.

## Reporting security issues

Please **do not** open a public issue for vulnerabilities. Email the author
([agnuxo1](https://github.com/agnuxo1)'s commit email from git log) with a PoC
and a suggested fix window. Responsible disclosure credit will be in the
release notes of the fixed version.
