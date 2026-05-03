import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

function collectTestFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTestFiles(fullPath);
    }

    return entry.name.endsWith(".test.js") ? [fullPath] : [];
  });
}

const outDir = join(process.cwd(), ".turing-machine-tests");
let exitCode = 0;

try {
  rmSync(outDir, { force: true, recursive: true });
  mkdirSync(outDir, { recursive: true });

  const compile = spawnSync(
    process.execPath,
    [
      "./node_modules/typescript/bin/tsc",
      "-p",
      "tsconfig.tests.json",
      "--outDir",
      outDir,
    ],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    }
  );

  if (compile.status !== 0) {
    exitCode = compile.status ?? 1;
  } else {
    const compiledTestFiles = collectTestFiles(join(outDir, "tests"));

    if (compiledTestFiles.length === 0) {
      console.error("No compiled test files were found.");
      exitCode = 1;
    } else {
      const run = spawnSync(process.execPath, ["--test", ...compiledTestFiles], {
        cwd: process.cwd(),
        stdio: "inherit",
      });

      exitCode = run.status ?? 1;
    }
  }
} finally {
  rmSync(outDir, { force: true, recursive: true });
}

process.exitCode = exitCode;
