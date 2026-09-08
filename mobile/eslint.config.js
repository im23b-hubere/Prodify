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
      // React Compiler rules. All but the two below hold repo-wide.
      "react-hooks/static-components": "error",
      "react-hooks/purity": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/set-state-in-effect": "error",

      // Reanimated shared values and RN `Animated.Value` refs are mutated by design, and the
      // rules cannot tell them apart from real ref misuse — they flag every animation in the app.
      // Render-phase ref writes, the one violation class these would have caught, are instead
      // prevented by `useLatestRef`.
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    files: ["babel.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
