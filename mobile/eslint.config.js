const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintConfigPrettier = require("eslint-config-prettier");
const i18next = require("eslint-plugin-i18next");
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
  // Soft guard for new screens: warn on raw JSX text. Catalog copy lives in locales/en.json;
  // German leftovers are also blocked by __tests__/i18n/noGermanUiLiterals.test.ts.
  {
    files: ["app/**/*.{tsx,jsx}", "features/**/*.{tsx,jsx}", "components/**/*.{tsx,jsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          markupOnly: true,
          ignoreAttribute: [
            "testID",
            "accessibilityRole",
            "accessibilityState",
            "hitSlop",
            "pointerEvents",
            "resizeMode",
            "collapsable",
            "importantForAccessibility",
          ],
        },
      ],
    },
  },
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
