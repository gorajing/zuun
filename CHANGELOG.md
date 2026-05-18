# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] — 2026-05-18

### Added

- **Audit-derived lints**, surfaced by the 2026-05-14 corpus audit:
  - `zuun doctor` now reports audit cadence and exits nonzero when the corpus has 50+ entries since the last audit-tagged entry.
  - `capture` / `remember` route ENT-shaped tokens out of `tags` into `related` — entry IDs belong in `related`, not `tags`.
  - `capture` / `remember` flag short, untagged `decision` entries as likely accidental captures (soft warning; the entry is still saved).

### Changed

- `zuun doctor` now exits nonzero when an audit is overdue. Previously only disk/db drift failed the health check; an overdue audit is an enforced commitment, not an optional warning.

## [0.1.1]

- Published to npm; plugin installable from GitHub via the marketplace flow.

## [0.1.0]

- Initial marketplace launch.
