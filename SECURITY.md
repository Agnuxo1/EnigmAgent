# Security policy

## Supported scope

EnigmAgent 3.0.0 verifies the Node authenticated vault, administrator, fixed-operation
broker, MCP/REST transports, Python client and the ten native adapters described in
`docs/INTEGRATED_RELEASE_V3.md`. Older browser, GUI, IDE, mobile and separately
published packages have independent version/support status. Their presence in the
repository is not a security certification or evidence of v3 compatibility.

## Report a vulnerability privately

Use the repository's private vulnerability reporting facility when available, or
contact the maintainer at the public project address `agnuxo1@gmail.com` with a
minimal synthetic reproduction. Do not send real vaults, live keys, passwords,
personal documents or another person's data. Do not publish a live credential or
an exploit against someone else's deployment in a public issue.

## Important boundaries

The fixed-operation broker does not return upstream bodies/headers or raw vault
values. Its connection token grants the approved operation set, not arbitrary
network destinations. Raw resolution is a separate explicit trusted-backend mode
and cannot coexist with broker mode. The broker's host, OS identity, filesystem,
configuration and process memory are trusted. Hostile generated code needs an
independent OS/container security boundary; object privacy is not a sandbox.

Encryption protects the format-v2 envelope and its entry metadata. It does not
prevent replay of an entire older valid file without trusted external state.
Legacy v1 metadata was unauthenticated and cannot be retroactively proven correct.
Migration is explicit and maintains a permanent original backup plus the rolling
recovery backup. Both require protection. Stale locks and interrupted backup
creation fail closed and require operator inspection rather than automatic lock
stealing or silent data replacement. POSIX modes do not enforce Windows ACLs.

Test results are reproducible security/compatibility regressions, not an external
penetration test, vulnerability-free guarantee, TPM-backed storage, post-quantum
certification, or proof of total information-flow isolation. The exact source and
artifact hashes in a release identify what was tested.
