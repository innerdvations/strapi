/**
 * Regression test for #9: MCP list tool accepts empty string sort and silently ignores it
 *
 * The buildSortSchema function must reject:
 *  - empty strings
 *  - malformed patterns (missing colon, wrong direction)
 *  - fields not in the scalar attribute set
 *
 * Valid patterns:
 *  - "field:asc" | "field:desc" for known scalar fields
 *  - Arrays of the above
 *  - Object forms { field: "asc" | "desc" }
 *  - Arrays of object forms
 */

import type { Struct } from '@strapi/types';
import { buildSortSchema } from '../sort-schema';

const testAttributes: Struct.SchemaAttributes = {
  title: { type: 'string' },
  createdAt: { type: 'datetime' },
  count: { type: 'integer' },
} as unknown as Struct.SchemaAttributes;

describe('buildSortSchema', () => {
  describe('rejects malformed string sort values', () => {
    const schema = buildSortSchema(testAttributes);

    it('rejects empty string', () => {
      const result = schema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects string with no colon', () => {
      const result = schema.safeParse('title');
      expect(result.success).toBe(false);
    });

    it('rejects string with invalid direction', () => {
      const result = schema.safeParse('title:random');
      expect(result.success).toBe(false);
    });

    it('rejects string with unknown field', () => {
      const result = schema.safeParse('unknownField:asc');
      expect(result.success).toBe(false);
    });

    it('accepts valid string sort', () => {
      const result = schema.safeParse('title:asc');
      expect(result.success).toBe(true);
    });

    it('accepts valid string sort with desc', () => {
      const result = schema.safeParse('createdAt:desc');
      expect(result.success).toBe(true);
    });
  });

  describe('rejects malformed array string sort values', () => {
    const schema = buildSortSchema(testAttributes);

    it('rejects array with empty string', () => {
      const result = schema.safeParse(['title:asc', '']);
      expect(result.success).toBe(false);
    });

    it('rejects array with malformed string', () => {
      const result = schema.safeParse(['title:asc', 'count:random']);
      expect(result.success).toBe(false);
    });

    it('accepts valid array of string sorts', () => {
      const result = schema.safeParse(['title:asc', 'createdAt:desc']);
      expect(result.success).toBe(true);
    });
  });

  describe('validates object sort forms', () => {
    const schema = buildSortSchema(testAttributes);

    it('accepts valid object sort', () => {
      const result = schema.safeParse({ title: 'asc' });
      expect(result.success).toBe(true);
    });

    it('rejects object with invalid direction', () => {
      const result = schema.safeParse({ title: 'random' });
      expect(result.success).toBe(false);
    });

    it('rejects object with unknown field', () => {
      const result = schema.safeParse({ unknownField: 'asc' });
      expect(result.success).toBe(false);
    });

    it('accepts array of valid object sorts', () => {
      const result = schema.safeParse([{ title: 'asc' }, { createdAt: 'desc' }]);
      expect(result.success).toBe(true);
    });
  });

  describe('accepts undefined/optional', () => {
    const schema = buildSortSchema(testAttributes);

    it('accepts undefined', () => {
      const result = schema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });
});
