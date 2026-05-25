/**
 * Parity check between `en.json` and `es.json`.
 *
 * Catches the failure mode where a new English string lands without
 * its Spanish translation (or vice versa). The CI test failure is the
 * forcing function — a missing key would otherwise silently fall back
 * to English on Spanish locale, with no test failure today and no
 * lint failure.
 *
 * What it asserts:
 *  - Same set of leaf keys (dot-paths) in both files
 *  - Same interpolation placeholders ({{name}}, {{count}}, …) per key
 *  - Same plural pair completeness: every `_one` has its `_other`
 *
 * What it does NOT assert:
 *  - Translation quality (that's a human review)
 *  - That both strings have similar length / style
 */
import { describe, it, expect } from 'vitest';

import en from './en.json';
import es from './es.json';

/** Recursively flatten a nested object into dot-path → leaf-string entries. */
function flatten(obj: unknown, prefix = '', acc: Record<string, string> = {}): Record<string, string> {
  if (typeof obj === 'string') {
    acc[prefix] = obj;
    return acc;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix === '' ? k : `${prefix}.${k}`, acc);
    }
  }
  return acc;
}

/** Extract `{{var}}` placeholders from a string, sorted for stable comparison. */
function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g))
    .map((m) => m[1] ?? '')
    .sort();
}

const enFlat = flatten(en);
const esFlat = flatten(es);
const enKeys = new Set(Object.keys(enFlat));
const esKeys = new Set(Object.keys(esFlat));

describe('en.json ↔ es.json parity', () => {
  it('has the same number of leaf keys in both files', () => {
    expect(Object.keys(enFlat).length).toBe(Object.keys(esFlat).length);
  });

  it('has no keys in en.json that are missing from es.json', () => {
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    expect(missingInEs, `Missing in es.json: ${missingInEs.join(', ')}`).toEqual([]);
  });

  it('has no keys in es.json that are missing from en.json', () => {
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect(missingInEn, `Missing in en.json: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('has matching interpolation placeholders per key', () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enPh = placeholders(enFlat[key] ?? '');
      const esPh = placeholders(esFlat[key] ?? '');
      if (JSON.stringify(enPh) !== JSON.stringify(esPh)) {
        mismatches.push(
          `${key}: en=[${enPh.join(',')}] vs es=[${esPh.join(',')}]`,
        );
      }
    }
    expect(mismatches, `Placeholder mismatch:\n${mismatches.join('\n')}`).toEqual([]);
  });

  it('has both _one and _other for every pluralized key (no half plurals)', () => {
    // react-i18next plural keys come in pairs. A `foo_one` without
    // `foo_other` (or vice versa) will silently fall back at runtime;
    // surface it here instead.
    const checkPlurals = (flat: Record<string, string>, lang: string): string[] => {
      const orphans: string[] = [];
      const keys = Object.keys(flat);
      for (const k of keys) {
        if (k.endsWith('_one') && !keys.includes(`${k.slice(0, -4)}_other`)) {
          orphans.push(`${lang}: ${k} has no _other counterpart`);
        }
        if (k.endsWith('_other') && !keys.includes(`${k.slice(0, -6)}_one`)) {
          orphans.push(`${lang}: ${k} has no _one counterpart`);
        }
      }
      return orphans;
    };
    const orphans = [...checkPlurals(enFlat, 'en'), ...checkPlurals(esFlat, 'es')];
    expect(orphans, orphans.join('\n')).toEqual([]);
  });
});
