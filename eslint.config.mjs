import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
	globalIgnores([
		"node_modules",
		"dist",
		"main.js",
		"versions.json",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
		"esbuild.config.mjs",
		"version-bump.mjs",
	]),
	{
		languageOptions: {
			globals: { ...globals.browser },
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mjs", "manifest.json", "tests/*.ts"],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Unit tests run in Node and are never bundled into the plugin.
		files: ["tests/**/*.ts"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	},
);
