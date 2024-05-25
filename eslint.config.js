import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    { languageOptions: { globals: { ...globals.browser, ...globals.node }, ecmaVersion: 11, sourceType: 'module' } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReactConfig,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-empty-function': [0],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    eslintConfigPrettier,
];
