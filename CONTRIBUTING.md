# Contributing to InvoML

Thank you for your interest in contributing to the Invoice Markup Language.

## Development Setup

**Requirements:** Node.js 22.22.0 and npm 11.11.0 for canonical repository checks. The published
package retains Node.js 18 as its minimum consumer runtime.

```bash
git clone https://github.com/Invompt/InvoML.git
cd invoml
npm ci
```

## Running Tests

```bash
# Run all tests once
npm test

# Run only the functional regression suite
npm run test:functional

# Watch mode during development
npm run test:watch
```

Tests use [Vitest](https://vitest.dev/). Test files live in `tests/` and follow the same directory structure as `src/`.

## Building

```bash
npm run build
```

Output goes to `dist/`. The build runs `tsc` with strict mode — all type errors must be fixed before a PR can merge.

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`.
2. Make your changes. Keep commits focused — one logical change per commit.
3. Ensure `npm run build` and `npm test` both pass with no errors or warnings.
4. Open a PR against `main` with a clear title and description of what changed and why.
5. Link any related issues in the PR description.
6. Never include credentials, private invoice data, or customer data in commits,
   issues, test fixtures, or pull requests.

## Code Style

- **TypeScript strict mode** — no `any`, explicit return types on public functions.
- ES modules only (`import`/`export`) — no CommonJS.
- `const` over `let`; never `var`.
- `async`/`await` over raw Promises.
- Named exports; avoid default exports.
- Files stay small: utilities < 100 lines, modules < 200 lines (CSS data files are an exception).
- One interface or class per file where practical.
- Single responsibility per module — rendering logic, CSS, and text processing are separate files.
- Comments explain *why*, not *what*.

## Adding Conformance Test Vectors

Test vectors live in `test-vectors/` and follow a strict naming convention:

```
NN-name.json           — input InvoML document
NN-name.expected.json  — expected output (a subset of the Totals object)
```

Where `NN` is a two-digit zero-padded number (e.g., `19`, `20`) and `name` is a short kebab-case description of what the vector tests.

**Normal vectors** — the expected file contains a partial `Totals` object. The test runner checks that every field present in the expected file matches the computed output exactly. Omit fields you do not intend to assert on.

```json
// test-vectors/19-jpy-zero-decimal.expected.json
{
  "subtotal": 10000,
  "taxTotal": 1000,
  "total": 11000
}
```

**Error vectors** — when the input MUST cause a calculation error (e.g., unknown tax category), the expected file is:

```json
{ "error": true }
```

The test runner asserts that the calculator throws an error rather than returning a value.

**Before opening a PR with new vectors:** confirm that `npm test` passes, the new vector is referenced in the SPEC.md § 10.2 table with a short description, and the vector name is unique within the directory.

## Reporting Issues

Use [GitHub Issues](https://github.com/invompt/InvoML/issues). Include a minimal reproduction case when reporting bugs.
