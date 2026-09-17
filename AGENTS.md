# Agent and contributor guidance

EnigmAgent 3.0.0 provides an authenticated local vault, administrator and
fixed-operation broker. Start with `docs/INTEGRATED_RELEASE_V3.md` and the actual
versioned release manifest, not historical marketing pages or directory names.

Use the ten native factories in `enigmagent.adapters` for agent-facing workflows.
They select an operator-approved operation by name and return status only. Never
expose `resolve()`/`revealSecret()` as a model-visible tool or echo real credentials.
Raw resolution is deliberately disabled by default and incompatible with broker
mode. Read `docs/THREAT_MODEL.md`; do not claim complete context isolation, external
security certification, post-quantum security or protection from a compromised OS.

Preserve previous source versions and licences. Test against exact dependency
versions, real synthetic transports and the package that will be distributed. Do
not label import-only smoke tests as native execution, candidate lists as completed
integrations, or third-party adapters as upstream endorsements. Do not silently
change a user's real vault or publish private repositories/data.

External contributions must match maintainers' documented scope and contribution
rules. Avoid mass comments, artificial stars, repeated promotional requests and
contact after a maintainer has declined. Private operational no-contact records
must not be copied into a public repository.
