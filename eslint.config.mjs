import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  eslintConfigPrettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
