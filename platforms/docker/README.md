# EnigmAgent v3 container

Build from the repository root with `docker build -t enigmagent:3.0.0 .`.
The Dockerfile pins the public Node base image by digest and copies this exact
reviewed gateway source. It does not install a previously published package.
The process runs as the unprivileged `node` user. The default is MCP over stdio;
REST requires an explicit command and an API token.

The included Compose file publishes REST to **127.0.0.1:3737 only**, mounts an
existing vault read-only and rejects missing environment configuration. Operators
must grant the container user read access to the vault. Never put actual passwords
or tokens into a committed Compose file. Container environment/configuration may
be visible to administrators with Docker access; they are inside the trust boundary.

For an operation broker, mount an operator-owned operations configuration read-only
and add `--operations /path/to/operations.json`. Never enable raw resolution on a
broker transport. HTTPS public IPv4 destinations are allowed; other egress is
denied except fixed 127.0.0.1 HTTP requests deliberately enabled by the operator.
The old PWA/static-file/unprotected REST service is no longer a container entrypoint.
The browser and desktop products have separate release and validation status.

The versioned GitHub release includes the tested image archive and its source
revision. See `scripts/test-container.py` and the integrated-release CI job for
real container startup, authentication, metadata and raw-denial tests.
