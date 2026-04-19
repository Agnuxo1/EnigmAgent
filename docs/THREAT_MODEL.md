# Threat Model

## What EnigmAgent defends against

| Threat | Defense |
|---|---|
| LLM provider logs or trains on your secret | The agent only ever sees a placeholder name. The real value is substituted inside the DOM by the extension at the exact moment of submit. |
| Chat history leaks your secret | Same — there is no real value in the chat. |
| Stolen vault file | AES-256-GCM with a key derived by Argon2id (64 MiB, 3 passes). Brute-forcing an 8-character password over a stolen vault costs ~10⁸ × 800 ms ≈ 2 500 CPU-years. Stronger passwords make it worse. |
| Rogue site tricking the agent into pasting a token | Every secret is pinned to a domain. The bridge refuses to resolve on mismatched origins; a phishing site at `g1thub.com` gets `domain_mismatch` back. |
| Clipboard sniffers / paste loggers | The plaintext is written directly to the input's `value` property via the native setter — never to `navigator.clipboard`. |
| A second tab reading the plaintext | The decrypt happens inside the vault tab (extension origin). Only the content script in the target page receives the value, through a direct message channel. Other tabs never see it. |
| Agent trying to exfiltrate the value by pasting it into the chat | The agent receives a *success* signal, not the value. It never sees the plaintext, so it cannot repeat it. |

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

During the submit-time swap, the real value is present in `<input>.value` for about one event-loop tick before the form submits. A sufficiently fast content script from *another* extension running on the same page could read it. This is the fundamental cost of automating form fill; the alternative is manual typing. Mitigations:

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
