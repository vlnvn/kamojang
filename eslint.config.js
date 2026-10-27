import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".private/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        self: "readonly",
        crypto: "readonly",
        File: "readonly",
        Blob: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        Worker: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
  {
    files: ["scripts/*.mjs", "*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        document: "readonly",
        performance: "readonly",
        getComputedStyle: "readonly",
        requestAnimationFrame: "readonly",
      },
    },
  },
);
