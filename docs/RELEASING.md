# Releasing InvoML

This repository contains a pre-release publication candidate. Nothing in this
document confirms that `invoml` is publicly published, installable, or
appropriate for production use.

`trusted-publish.yml` may run only when the public canonical repository receives
the exact `v1.0.0-alpha.21` tag. Its unprivileged `validate-build` job checks
that package name and version, runs the lock, test, build, package-content, and
privacy gates, and uploads one tarball with a SHA-256 checksum and metadata.

The isolated `publish` job has the workflow's only OIDC permission. It does not
check out repository code, install project dependencies, or invoke repository
scripts. It downloads the named GitHub artifact, requires GitHub's artifact
digest check, verifies the exact tarball SHA-256 and release metadata, then runs:

```bash
npm publish <verified-tarball> --access public --tag next --ignore-scripts
```

The command deliberately has no npm token or repository secret. It also omits
`--provenance`: npm's GitHub Actions OIDC trusted-publishing flow generates
provenance automatically for eligible public repositories.

## External configuration before enabling the tag

An organization administrator must independently complete and verify all of the
following before the exact tag is pushed:

1. The canonical GitHub repository is public and the verified organization
   administrator has reviewed its ownership and branch protections.
2. npm trusted publishing is configured for package `invoml`, GitHub
   organization `Invompt`, repository `InvoML`, workflow
   `.github/workflows/trusted-publish.yml`, and GitHub Environment `npm`.
3. The npm package is configured for public access and the intended prerelease
   channel is `next`; no workflow should use `latest` for this candidate.
4. The GitHub `npm` Environment has the required reviewers and deployment
   protection rules. Those controls are maintained outside this repository.
5. The exact tag, generated artifact digest, tarball SHA-256, npm package page,
   provenance record, and resulting `next` dist-tag are independently checked
   after the workflow completes.

No repository variable, release gate, stage command, manual stage approval, or
secret may be substituted for this trusted-publisher binding. A failed or absent
external prerequisite is a stop condition, not permission to bypass it.

## Verification after an authorized publish

Only after the external checks above have succeeded may maintainers update
user-facing installation documentation with independently verified registry and
provenance evidence. Until then, use only approved local sources or immutable
source bundles for development and testing.

See npm's official [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
and [generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
guidance for the external setup and verification steps.
