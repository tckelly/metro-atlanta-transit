import type { Config } from 'tailwindcss';
import { preset } from '@atl-transit/components/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../components/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
