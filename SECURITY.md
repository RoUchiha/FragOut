# Security

Report vulnerabilities privately through [GitHub security advisories](https://github.com/RoUchiha/FragOut/security/advisories/new). Do not include real user photos, provider keys, passwords, database URLs or session tokens in public issues, pull requests or screenshots. Synthetic reproductions are preferred.

The current `main` branch is the maintained source. Security fixes should include a regression test, pass the root/mobile checks and production artifact audit, and enter through the protected release process. Dependency updates are reviewed with their compatibility checks; major versions are not merged automatically.

Production credentials belong only in the production runtime. Test and backup jobs have separate scopes. The backup worker uses SELECT-only access and a public encryption key; the private recovery key stays outside app hosting and CI. Default selfies and temporary image records are not backed up. Archived-image backups are encrypted and subject to seven-day snapshot retention.

See [the security assessment](docs/SECURITY_REPORT.md) for tested boundaries and [operations](docs/OPERATIONS.md) for backup, environment and release procedures. These checks are evidence of specific controls, not a guarantee against every attack or a certification.
