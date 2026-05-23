import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

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
  ...tseslint.configs.recommended,
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
);
