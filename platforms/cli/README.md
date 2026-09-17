# EnigmAgent administrator v3

This standalone package uses the same tested administrator as the gateway package. Run `enigmagent --help`. Secrets are read from hidden terminal prompts or the explicit `--value-stdin` option; secret values are never command-line arguments. The legacy `run` command, implicit overwrite, unbounded import and plaintext argument logging have been removed.

The `reveal` and `resolve` commands require `--allow-raw-output`. These are trusted human/backend operations, never model-facing tools. Use the fixed-operation broker for agents. Existing v1 vaults must be explicitly migrated before mutation. Node.js 22+ is required.
