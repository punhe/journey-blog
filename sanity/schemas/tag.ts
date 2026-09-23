import { defineField, defineType } from 'sanity';

export const TAG_COLORS = ['blue', 'green', 'brown', 'purple', 'red', 'gray'] as const;

export const tag = defineType({
  name: 'tag',
  title: 'Tag',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'color',
      title: 'Color',
      type: 'string',
      initialValue: 'gray',
      options: {
        list: TAG_COLORS.map((value) => ({ title: value, value })),
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'color' },
    prepare({ title, subtitle }) {
      return { title: title as string, subtitle: subtitle as string };
    },
  },
});
