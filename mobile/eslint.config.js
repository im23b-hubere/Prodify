const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintConfigPrettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.expo/**",
    "dist/**",
    "coverage/**",
    "test/reanimatedStub.js",
  ]),
  expoConfig,
  eslintConfigPrettier,
  {
    files: ["__tests__/**/*.{ts,tsx}", "jest.setup.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: ["babel.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
