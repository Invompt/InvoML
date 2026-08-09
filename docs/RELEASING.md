# Releasing InvoML

InvoML is a public prerelease package. The current repository version is
`invoml@1.0.0-alpha.23`, prepared for the `next` dist-tag. Registry state is an
external fact and must be verified with `npm view invoml dist-tags versions --json`;
this source document never proves publication. The `latest` dist-tag intentionally
remains on the older `1.0.0-alpha.5` prerelease, so user documentation must install
`invoml@next` unless a release owner explicitly changes the channel strategy.

Publication is an owner-authorized external action. Passing local tests, editing
documentation, or preparing a tag does not authorize a publish, a dist-tag change,
or reuse of an existing version.

## Current trusted-publishing binding

`.github/workflows/trusted-publish.yml` is intentionally bound to the single
`v1.0.0-alpha.23` tag and matching package version. That binding is a release
candidate contract, not evidence that the tag or npm version already exists and
not a reusable "publish latest changes" command. npm versions and Git tags are
immutable once published.

For a release triggered by that exact tag, the unprivileged `validate-build` job
checks the package name and version, lock integrity, tests, build output, package
contents, and privacy.
It also runs `scripts/release-gate.mjs` to verify the triggering actor has `write` or
`admin` permission and is directly on/ancestor of the `main` default branch via
GitHub compare API.
It uploads one tarball with a SHA-256 checksum and release metadata. The isolated
`publish` job receives the workflow's only OIDC permission, downloads the named
artifact, verifies its digest and metadata, and runs:

```bash
npm publish <verified-tarball> --access public --tag next --ignore-scripts
```

The workflow deliberately uses npm trusted publishing instead of an npm token.
npm generates provenance automatically for eligible GitHub Actions trusted
publishers.

## Preparing a future prerelease

A future release requires a deliberate, owner-approved version and tag. In one
audited change, maintainers must:

1. Choose a new, unpublished prerelease version and update `package.json` plus
   the lockfile.
2. Update every version- and tag-specific workflow assertion so it binds to the
   new immutable release only.
3. Run the lock, privacy, build, test, and packed-artifact gates with the
   repository's declared Node.js and npm versions.
4. Inspect the tarball contents, hidden package manifest, checksum, and provenance
   inputs before any tag is created.
5. Obtain explicit release-owner authorization before creating or pushing the
   tag. Never retry an immutable version that npm reports as previously published.

## External configuration

An organization administrator must independently verify all of the following for
the intended release:

1. The canonical public repository, ownership, default branch, and exact release SHA.
2. npm trusted publishing for package `invoml`, GitHub organization `Invompt`,
   repository `InvoML`, workflow `.github/workflows/trusted-publish.yml`, and
   GitHub Environment `npm`.
3. Public package access and the explicitly approved dist-tag. Do not move
   `latest` implicitly.
4. A custom deployment tag policy on the GitHub `npm` Environment that permits
   only the exact approved tag and no broad branch or tag pattern. If reviewers
   or other protection rules are configured, confirm that they are satisfied.
5. The exact tag, GitHub artifact digest, tarball SHA-256, npm registry record,
   provenance statement, and resulting dist-tag after publication.

No repository variable, local green check, manual stage approval, or secret may
substitute for the trusted-publisher binding, exact-tag environment policy, or
registry verification. A missing external prerequisite is a stop condition.

See npm's official [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
and [provenance](https://docs.npmjs.com/generating-provenance-statements/)
guidance.
