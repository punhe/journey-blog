import { describe, expect, it } from 'vitest';
import { groupPortableText, toPlainText, truncate } from '../src/lib/portableText';
import type { PortableTextNode } from '../src/lib/types';

function block(text: string, extra: Record<string, unknown> = {}): PortableTextNode {
  return {
    _type: 'block',
    _key: text,
    style: 'normal',
    children: [{ _type: 'span', _key: `${text}-0`, text }],
    ...extra,
  } as PortableTextNode;
}

describe('groupPortableText', () => {
  it('returns an empty list for missing content', () => {
    expect(groupPortableText(undefined)).toEqual([]);
    expect(groupPortableText([])).toEqual([]);
  });

  it('merges a run of list blocks into one list', () => {
    const items = groupPortableText([
      block('intro'),
      block('one', { listItem: 'bullet' }),
      block('two', { listItem: 'bullet' }),
      block('outro'),
    ]);

    expect(items.map((item) => item.kind)).toEqual(['block', 'list', 'block']);
    const list = items[1]!;
    expect(list.kind === 'list' && list.items).toHaveLength(2);
  });

  it('starts a new list when the list type changes', () => {
    const items = groupPortableText([
      block('one', { listItem: 'bullet' }),
      block('two', { listItem: 'number' }),
    ]);

    expect(items.map((item) => item.kind)).toEqual(['list', 'list']);
  });

  it('keeps images and code blocks as their own items', () => {
    const items = groupPortableText([
      { _type: 'image', _key: 'i', asset: { _ref: 'image-a-100x100-png', _type: 'reference' } },
      { _type: 'code', _key: 'c', language: 'ts', code: 'const a = 1;' },
    ] as PortableTextNode[]);

    expect(items.map((item) => item.kind)).toEqual(['image', 'code']);
  });
});

describe('toPlainText', () => {
  it('joins block text and drops non-text members', () => {
    const text = toPlainText([
      block('Sương  mù'),
      { _type: 'code', _key: 'c', code: 'ignored' },
      block('và cà phê'),
    ] as PortableTextNode[]);

    expect(text).toBe('Sương mù và cà phê');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short', 20)).toBe('short');
  });

  it('cuts on a word boundary and adds an ellipsis', () => {
    const result = truncate(`${'word '.repeat(40)}end`, 60);

    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(61);
    expect(result).not.toContain(' …');
  });
});
