import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import i18next from 'eslint-plugin-i18next';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'packages/web/public/gtfs/**',
    ],
  },

  // Type-checked TypeScript rules. The "strictTypeChecked" preset
  // catches real classes of bugs the basic preset misses
  // (no-floating-promises, no-misused-promises, no-base-to-string).
  // Adds CI cost — type info is built per file — but the catches are
  // worth it on a codebase with this much async/promise plumbing.
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        // Auto-discover the right tsconfig per file. `allowDefaultProject`
        // covers config files that live outside any tsconfig include so
        // they don't crash the parser.
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            'packages/*/vite.config.ts',
            'packages/*/vitest.config.ts',
            'packages/*/tailwind.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in template literals are routine and safe. The lint
      // catches more genuine issues with `restrict-template-expressions`
      // disabled for numbers than with it on by default.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // We have several legitimately-sync async methods (the
      // GtfsRepository interface requires async for future-flex; the
      // InMemory impl resolves immediately). Turn the rule off rather
      // than litter the file with eslint-disables.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Plain JS files, sample scripts, and config files have no
  // strict-mode TS project to type-check against. Disable the rules
  // that require type information so they don't crash on these files.
  {
    files: [
      '**/*.{js,mjs,cjs}',
      'sample-data/**/*.ts',
      '**/vite.config.ts',
      '**/vitest.config.ts',
      '**/tailwind.config.ts',
      '**/postcss.config.{js,ts}',
    ],
    ...tseslint.configs.disableTypeChecked,
  },

  // GTFS decoders deliberately bridge the `any` shape produced by
  // protobuf-js into our strict Zod-validated types at the seam.
  // The unsafe-* rules flag every line of that intentional bridge,
  // drowning out signal elsewhere. Turn them off only inside the
  // decoder module — consumers of the decoded result still get full
  // strict checking.
  {
    files: ['packages/gtfs/src/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Package-boundary rules.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'utils', pattern: 'packages/utils/**' },
        { type: 'gtfs', pattern: 'packages/gtfs/**' },
        { type: 'components', pattern: 'packages/components/**' },
        { type: 'web', pattern: 'packages/web/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'utils', allow: [] },
            { from: 'gtfs', allow: ['utils'] },
            { from: 'components', allow: ['utils'] },
            { from: 'web', allow: ['utils', 'gtfs', 'components'] },
          ],
        },
      ],
    },
  },

  // React rules. Hooks-first since we lean heavily on hooks.
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.configs.recommended.rules,
      // Vite HMR: flag files that mix component and non-component
      // exports — Fast Refresh can't update them in place. Constants
      // alongside components are common and benign here, so allow.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // i18n: catch hardcoded user-facing strings in JSX so future code
  // can't drift back to inline English. Surgical — only flags JSX
  // text content (not attributes, not template strings, not
  // identifiers). Test files relax this.
  {
    files: ['packages/web/src/**/*.{tsx,jsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-text-only',
          'should-validate-template': false,
          message:
            'Hard-coded user-facing strings must use t() — see packages/web/src/i18n/en.json',
        },
      ],
    },
  },

  // Test files: relax rules that fight test ergonomics. Tests
  // legitimately use `as unknown as T` for fakes, hand-construct
  // partial mocks, assert on raw fetch.mock.calls shapes, and
  // use `!` for fixture-built values they know are populated.
  {
    files: ['**/*.test.{ts,tsx}', '**/test-setup.ts'],
    rules: {
      'i18next/no-literal-string': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Vite plugin code, config files, scripts — Node-environment build
  // tooling where the strict promise rules aren't appropriate.
  {
    files: [
      '**/vite.config.ts',
      '**/vitest.config.ts',
      '**/tailwind.config.ts',
      '**/scripts/**/*.ts',
      'eslint.config.js',
    ],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
);
