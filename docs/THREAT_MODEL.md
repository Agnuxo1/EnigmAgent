# Threat Model

## What EnigmAgent defends against

| Threat | Defense |
|---|---|
| LLM provider logs your secrets | Agent only ever sees placeholder names, never values. |
| Chat history leaks | Same. Even if the chat is replayed, only placeholder names appear. |
| Training data contamination | Same. |
| Local file theft (laptop stolen, drive imaged) | Vault file is AES-256-GCM with an Argon2id-derived key. No password → no data. |
| Rogue site asking the agent to paste a token | Domain-bound secrets refuse to swap on the wrong origin. |
| Accidental paste into the wrong chat | Agent types a placeholder, not the value; nothing sensitive to paste. |
| Clipboard sniffers | Decrypted value is written to the DOM input directly, never to the system clipboard. |

## What EnigmAgent does NOT defend against

| Threat | Why |
|---|---|
| Compromised OS / root malware | A kernel-level attacker can read process memory. No userland tool can stop this. |
| Browser keylogger extension with `<all_urls>` | Another extension can read keystrokes and DOM values. Users must audit what they install. |
| Phishing the vault password | If an attacker can convince you to type your vault password into their page, game over. Domain-binding of the vault-app itself helps, but user discipline matters. |
| A malicious version of EnigmAgent itself | Install only from signed releases; verify hashes. Reproducible builds are on the roadmap. |
| XSS in the vault-app | The vault runs as a static HTML file with a strict CSP and no external dependencies. Still, any vuln here is fatal — hence the crypto-review milestone. |
| Screen recording | If the value is ever shown on screen (e.g. "reveal" button), a screen recorder captures it. The default UX hides values. |
| Weak passwords | Argon2id makes brute force expensive, but a 4-character password is still guessable. The UI will enforce a minimum entropy. |

## Assumptions

- The user runs a reasonably up-to-date browser (Chromium ≥ 115 or Firefox ≥ 115).
- The OS has at least standard disk permissions (the vault file is not readable by other users on a multi-user machine without OS-level privilege escalation).
- The user does not share their vault password with the agent (even a placeholder for the vault password would be self-defeating).

## Residual risks we accept

- **Brief plaintext exposure in DOM**: during the submit-time swap, the real value is present in the `<input>` for ~1 event loop tick before the form submits. A sufficiently fast content script on the same page (from another extension) could read it. This is the fundamental cost of automating form fill; the alternative is manual entry.
- **Vault-app origin is `file://`**: this origin has relaxed rules in some browsers. We mitigate with CSP and by bundling the vault into the extension itself in v2.

## Not a password manager replacement

EnigmAgent is not trying to replace 1Password or Bitwarden for *your* daily use. It is specifically designed for the **LLM-in-the-loop** case — when an agent needs to act on your behalf but must not see your secrets. For everything else, keep using the password manager you already trust.
