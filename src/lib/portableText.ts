import type {
  PortableTextBlock,
  PortableTextCode,
  PortableTextImage,
  PortableTextNode,
} from './types';

export type RenderItem =
  | { kind: 'block'; block: PortableTextBlock }
  | { kind: 'list'; listItem: 'bullet' | 'number'; items: PortableTextBlock[] }
  | { kind: 'image'; image: PortableTextImage }
  | { kind: 'code'; code: PortableTextCode };

function isBlock(node: PortableTextNode): node is PortableTextBlock {
  return node._type === 'block';
}

/**
 * Flattens a Portable Text array into items a template can loop over,
 * merging runs of list blocks into one list so they render as `ul` / `ol`.
 */
export function groupPortableText(nodes: PortableTextNode[] | undefined): RenderItem[] {
  if (!nodes?.length) return [];

  const items: RenderItem[] = [];

  for (const node of nodes) {
    if (isBlock(node)) {
      if (node.listItem === 'bullet' || node.listItem === 'number') {
        const last = items.at(-1);
        if (last?.kind === 'list' && last.listItem === node.listItem) {
          last.items.push(node);
        } else {
          items.push({ kind: 'list', listItem: node.listItem, items: [node] });
        }
        continue;
      }
      items.push({ kind: 'block', block: node });
      continue;
    }

    if (node._type === 'code') {
      items.push({ kind: 'code', code: node as PortableTextCode });
      continue;
    }

    if (node._type === 'image') {
      items.push({ kind: 'image', image: node as PortableTextImage });
    }
  }

  return items;
}

/** Plain text of a Portable Text array, for meta descriptions and excerpts. */
export function toPlainText(nodes: PortableTextNode[] | undefined): string {
  if (!nodes?.length) return '';
  return nodes
    .filter(isBlock)
    .map((block) => block.children.map((child) => child.text).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trims to `max` characters on a word boundary and adds an ellipsis. */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
