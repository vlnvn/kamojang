# Repository settings

The public remote was rechecked as empty before bootstrapping. A minimal `main` baseline establishes confidentiality rules; implementation belongs on `feat/initial-platform` and a draft PR. Git's existing credential manager successfully published the baseline even though `gh auth status` reported no CLI login. No tokens were inspected or printed.

Actions use `contents: read`, bounded timeouts, deterministic npm installation and verified action commit pins. Source data is absent from all CI inputs. No auto-merge, forced push, release tag or invented reviewer is configured.

Repository protection/security settings have not been mutated through an unauthenticated CLI or an unsupported connector operation. After the actual CI checks exist, the owner can apply:

1. Protect `main` against force pushes and deletion; require pull requests and up-to-date checks **Quality and production build** and **Browser flows and accessibility**.
2. Do not require an unavailable second-person approval for a solo-maintained project. Keep unresolved scientific, asset and visual gates visible in the PR description.
3. Enable Dependabot dependency graph/security alerts and private vulnerability reporting where available. Review the weekly npm, pip and Actions update PRs manually.
4. Keep public deployment disabled until asset and data rights, 3D behavior and acceptance criteria have been verified.

These are unapplied settings, not claims of active branch protection or security alerts.
