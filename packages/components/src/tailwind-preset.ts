import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

import { colors } from './tokens/colors';

const colorEntries = Object.entries(colors);

const lightVars: Record<string, string> = Object.fromEntries(
  colorEntries.map(([name, { light }]) => [`--${name}`, light]),
);
const darkVars: Record<string, string> = Object.fromEntries(
  colorEntries.map(([name, { dark }]) => [`--${name}`, dark]),
);

const themeColors: Record<string, string> = Object.fromEntries(
  colorEntries.map(([name]) => [name, `rgb(var(--${name}) / <alpha-value>)`]),
);

const cssVariablesPlugin = plugin((api) => {
  api.addBase({
    ':root': lightVars,
    '.dark': darkVars,
  });
});

export const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: themeColors,
    },
  },
  plugins: [cssVariablesPlugin],
};

export default preset;
