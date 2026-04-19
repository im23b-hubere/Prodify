const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintConfigPrettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores(["**/node_modules/**", "**/.expo/**", "dist/**", "coverage/**"]),
  expoConfig,
  eslintConfigPrettier,
  {
    files: ["babel.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
