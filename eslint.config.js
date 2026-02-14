//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  {
    ignores: [
      ".output/**",
      "dist/**",
      "coverage/**",
      "eslint.config.js",
      "prettier.config.js",
      "src/components/ui/**",
    ],
  },
  ...tanstackConfig,
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];
