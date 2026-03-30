import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'admin/build/',
			'build/',
			'admin/words.js',
			'admin/admin.d.ts',
		],
	},
	{
		files: ['**/*.ts'],
		extends: tseslint.configs.recommended,
		languageOptions: {
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
				project: ['./tsconfig.json'],
			},
		},
		rules: {
			'indent': [
				'error',
				'tab',
				{
					'SwitchCase': 1,
				},
			],
			'quotes': [
				'error',
				'single',
				{
					'avoidEscape': true,
					'allowTemplateLiterals': true,
				},
			],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-use-before-define': [
				'error',
				{
					functions: false,
					typedefs: false,
					classes: false,
				},
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					ignoreRestSiblings: true,
					argsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/explicit-function-return-type': [
				'warn',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
				},
			],
			'@typescript-eslint/no-non-null-assertion': 'off',
			'no-var': 'error',
			'prefer-const': 'error',
			'no-trailing-spaces': 'error',
		},
	},
	{
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
		},
	},
);
