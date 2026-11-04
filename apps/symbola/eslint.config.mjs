import { baseConfig } from "@symbola/config/eslint";

export default [{ ignores: [".next/**", "node_modules/**", "public/maplibre/**"] }, ...baseConfig];
