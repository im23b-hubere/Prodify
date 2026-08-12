import { ESLint } from "eslint";

const MAX_EXISTING_SIZE_VIOLATIONS = 48;
const PRODUCTION_PATHS = ["app", "features", "components", "hooks", "lib", "types"];
const SIZE_RULES = new Set(["max-lines", "max-lines-per-function"]);

const eslint = new ESLint({
  overrideConfig: {
    rules: {
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
});

const results = await eslint.lintFiles(PRODUCTION_PATHS);
const violations = results.flatMap((result) =>
  result.messages
    .filter((message) => SIZE_RULES.has(message.ruleId))
    .map((message) => ({
      filePath: result.filePath,
      line: message.line,
      message: message.message,
    })),
);

if (violations.length > MAX_EXISTING_SIZE_VIOLATIONS) {
  console.error(
    `Mobile Clean Code size violations increased: ${violations.length} > ${MAX_EXISTING_SIZE_VIOLATIONS}.`,
  );
  for (const violation of violations) {
    console.error(`${violation.filePath}:${violation.line}: ${violation.message}`);
  }
  process.exit(1);
}

console.log(
  `Mobile Clean Code size guard passed (${violations.length}/${MAX_EXISTING_SIZE_VIOLATIONS} remaining).`,
);
