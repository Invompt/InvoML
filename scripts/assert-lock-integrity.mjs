import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function assertLockIntegrity({ lockfile, packageJson }) {
  assert.equal(lockfile.lockfileVersion, 3, 'package-lock.json must use lockfileVersion 3');
  assert.ok(lockfile.packages, 'package-lock.json must contain a packages map');

  const rootPackage = lockfile.packages[''];
  assert.ok(rootPackage, 'package-lock.json must contain the root package entry');
  assert.equal(lockfile.name, packageJson.name, 'package-lock.json name must match package.json');
  assert.equal(lockfile.version, packageJson.version, 'package-lock.json version must match package.json');
  assert.equal(rootPackage.name, packageJson.name, 'package-lock.json root package name must match package.json');
  assert.equal(rootPackage.version, packageJson.version, 'package-lock.json root package version must match package.json');

  let checked = 0;

  for (const [path, dependency] of Object.entries(lockfile.packages)) {
    if (!path || dependency.link) {
      continue;
    }

    assert.ok(dependency.version, `${path} is missing a pinned version`);
    assert.ok(dependency.resolved, `${path} is missing a resolved registry URL`);
    assert.ok(dependency.integrity, `${path} is missing an integrity hash`);

    const resolved = new URL(dependency.resolved);
    assert.equal(resolved.protocol, 'https:', `${path} must use HTTPS`);
    assert.equal(
      resolved.hostname,
      'registry.npmjs.org',
      `${path} must resolve from registry.npmjs.org`,
    );
    assert.match(
      dependency.integrity,
      /^sha512-[A-Za-z0-9+/]+={0,2}$/,
      `${path} must use a sha512 SRI hash`,
    );

    checked += 1;
  }

  assert.ok(checked > 0, 'package-lock.json must contain registry dependencies');
  return checked;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const lockfile = JSON.parse(
    readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
  );
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const checked = assertLockIntegrity({ lockfile, packageJson });
  console.log(`Verified root package metadata and ${checked} registry dependencies with HTTPS URLs and sha512 SRI hashes.`);
}
