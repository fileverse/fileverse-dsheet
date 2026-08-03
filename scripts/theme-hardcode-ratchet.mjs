import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const targets = [
  'src/editor/components/smart-contract',
  'src/editor/components/smart-contract.tsx',
  'src/sheet-engine/react/components/SheetOverlay/FormulaHint',
];
const sourceExtensions = new Set(['.css', '.scss', '.ts', '.tsx']);

const fixedColorPatterns = [
  {
    name: 'fixed neutral Tailwind color',
    pattern:
      /\b(?:bg|border|text)-(?:black|white|gray-(?:50|100|200|300|400|500|600|700|800|900|950))\b/i,
  },
  {
    name: 'fixed inline light background',
    pattern: /\bbackground(?:Color)?\s*:\s*['"`](?:white|#fff(?:fff)?)\b/i,
  },
  {
    name: 'fixed light-theme neutral',
    pattern: /#(?:363b3f|77818a|e8ebec|f8f9fa|fff(?:fff)?)\b/i,
  },
];

const sourceFiles = targets.flatMap((target) => collectSourceFiles(target));
const violations = [];

for (const relativeFile of sourceFiles) {
  const lines = readFileSync(path.join(repoRoot, relativeFile), 'utf8').split(
    '\n',
  );

  lines.forEach((line, index) => {
    for (const { name, pattern } of fixedColorPatterns) {
      if (pattern.test(line)) {
        violations.push({
          relativeFile,
          line: index + 1,
          name,
          source: line.trim(),
        });
      }
    }

    if (
      relativeFile.includes('/FormulaHint/') &&
      /\bfn\??\.BRAND_COLOR\b/.test(line)
    ) {
      violations.push({
        relativeFile,
        line: index + 1,
        name: 'formula brand color used as a surface',
        source: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error('Theme hardcode check failed:');
  for (const violation of violations) {
    console.error(
      `${violation.relativeFile}:${violation.line} ${violation.name}\n  ${violation.source}`,
    );
  }
  process.exit(1);
}

console.log(
  `Theme hardcode check passed (${sourceFiles.length} files checked).`,
);

function collectSourceFiles(relativeTarget) {
  const absoluteTarget = path.join(repoRoot, relativeTarget);
  const stats = statSync(absoluteTarget);

  if (stats.isFile()) {
    return sourceExtensions.has(path.extname(relativeTarget))
      ? [relativeTarget]
      : [];
  }

  return readdirSync(absoluteTarget, { withFileTypes: true }).flatMap(
    (entry) => {
      const child = path.join(relativeTarget, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(child);
      return sourceExtensions.has(path.extname(entry.name)) ? [child] : [];
    },
  );
}
