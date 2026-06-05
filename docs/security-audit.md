# EnigmAgent Security Audit Guide

This guide gives security reviewers a practical checklist for reviewing EnigmAgent. It is intended for issue https://github.com/Agnuxo1/EnigmAgent/issues/1 and should be read together with `docs/THREAT_MODEL.md`, `SECURITY.md`, and `PRIVACY.md`.

## Scope

EnigmAgent protects secrets from being exposed to LLM prompts, chat logs, provider logs, terminal scrollback, browser forms, and accidental copy/paste. It does not claim to protect against a fully compromised local machine or a malicious process with memory access to the unlocked session.

Primary assets:

- vault password,
- derived encryption key,
- encrypted vault file,
- decrypted secret values during resolution,
- domain binding metadata,
- MCP tool inputs/outputs,
- browser-extension form injection path.

## Threat Model Checklist

| Area | Review question | Expected property |
|---|---|---|
| Vault encryption | Are secrets encrypted at rest with authenticated encryption? | AES-256-GCM or equivalent authenticated mode. |
| KDF | Is password derivation memory-hard and salted? | Argon2id with documented parameters. |
| Nonce handling | Are encryption nonces unique per encrypted record? | No nonce reuse with the same key. |
| Domain binding | Can a secret bound to one domain be resolved on another? | Resolver refuses mismatched origins. |
| Logging | Can plaintext secrets appear in logs or errors? | Plaintext must never be logged. |
| Clipboard | Does injection use clipboard APIs? | Clipboard should not be used for secret delivery. |
| MCP boundary | Can an LLM enumerate or resolve secrets without user intent? | Tool access should be explicit and least-privilege. |
| Browser boundary | Can arbitrary pages trigger injection silently? | Origin and user-action checks should be clear. |
| Persistence | Are decrypted values written to disk? | Decrypted values must not be persisted. |
| Failure modes | Are errors safe and actionable? | No secret material in thrown errors. |

## Penetration Testing Checklist

### Vault file attacks

- Try opening a vault with the wrong password.
- Tamper with ciphertext bytes and verify decryption fails closed.
- Tamper with authentication tags and verify decryption fails closed.
- Duplicate a nonce intentionally in a test fixture and verify the test suite detects it if nonce metadata is exposed.
- Attempt to load malformed JSON, missing fields, oversized fields, and unexpected field types.

### Placeholder resolution attacks

- Resolve `{{GITHUB_TOKEN}}` from an allowed origin.
- Resolve the same placeholder from a disallowed origin and verify denial.
- Test case-insensitive placeholder names if documented.
- Test malformed placeholders such as `{{`, `{{TOKEN`, `{TOKEN}}`, nested braces, and very long names.
- Test document placeholders such as `{{DOC:file.md}}` with path traversal strings.
- Verify unresolved placeholders fail without exposing candidate secret names beyond what the UI intentionally displays.

### Browser injection attacks

- Verify secrets are injected through native value setters and input/change events.
- Verify the clipboard remains unchanged.
- Verify no plaintext appears in the browser console.
- Verify secret resolution does not run on iframes or origins outside the binding policy unless explicitly allowed.
- Verify injection requires a clear user/agent action and cannot be triggered by passive page load alone.

### MCP attacks

- Call `enigmagent_list` and confirm it does not return plaintext.
- Call `enigmagent_resolve` with a missing placeholder.
- Call `enigmagent_resolve` with a mismatched domain.
- Call tools with oversized payloads and confirm bounded memory/time behavior.
- Confirm errors do not include decrypted values.

## Fuzzing Plan

Targets worth fuzzing first:

1. placeholder parser,
2. vault JSON loader,
3. domain matching function,
4. document placeholder resolver,
5. import/export routines.

Suggested test cases:

```text
{{GITHUB_TOKEN}}
{{github_token}}
{{LOGIN:github.com}}
{{DOC:system-prompt.md}}
{{DOC:../secret.txt}}
{{}}
{{TOKEN
TOKEN}}
{{A{{B}}}}
{{` + `A`.repeat(10000) + `}}
```

Recommended assertions:

- parser never throws uncaught exceptions,
- invalid inputs return typed errors,
- no error contains secret values,
- path traversal is rejected,
- all accepted names match the documented grammar,
- resolution requires an explicit origin/domain context.

## Side-Channel Review

Current out-of-scope items should still be documented:

- compromised OS or browser process,
- debugger attached to the extension or MCP process,
- swap, hibernation, core dumps,
- malicious local browser extension with broad host permissions,
- timing attacks against local password checks.

Hardening recommendations:

- keep plaintext lifetime as short as possible,
- overwrite mutable buffers where runtime APIs make that practical,
- avoid including secret values in thrown exceptions,
- avoid telemetry for all secret-path code,
- prefer constant-shape error messages for authentication failures,
- document when memory zeroization is best-effort due to JavaScript runtime limits.

## Minimal Security Test Skeleton

A future `tests/test_security.py` or JS equivalent should cover these invariants:

```python
def test_wrong_password_fails_closed():
    assert decrypt_vault(vault, "wrong-password").is_error()


def test_tampered_ciphertext_fails_closed():
    tampered = mutate_one_byte(vault)
    assert decrypt_vault(tampered, password).is_error()


def test_domain_mismatch_refuses_resolution():
    assert resolve("{{GITHUB_TOKEN}}", origin="https://example.com").is_denied()


def test_errors_do_not_contain_secret_value():
    err = resolve_with_forced_failure("{{GITHUB_TOKEN}}")
    assert "ghp_" not in str(err)
```

Adapt this skeleton to the repository's actual runtime and test framework before committing executable tests.

## Audit Report Template

Use this format when filing audit findings:

```markdown
### Finding
Short title.

### Severity
Low / Medium / High / Critical.

### Affected component
MCP server, browser extension, vault loader, parser, docs, build, release.

### Reproduction
Step-by-step reproduction without including real secrets.

### Expected behavior
What should happen.

### Actual behavior
What happened.

### Suggested fix
Smallest practical remediation.
```

## Release Gate

Before a public security-focused release, confirm:

- threat model is current,
- security audit guide is linked from README or SECURITY,
- no test fixtures contain real credentials,
- release artifacts are reproducible or checksummed,
- browser extension permissions are minimal,
- MCP tool descriptions clearly warn that plaintext is returned only to the local tool boundary.
