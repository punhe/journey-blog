import { defineArrayMember, defineField, defineType } from 'sanity';

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Site title',
      type: 'string',
      initialValue: 'My Journal Blog',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bannerImage',
      title: 'Banner image',
      type: 'image',
      options: { hotspot: true },
      description: 'Wide illustration across the top of the home page.',
      fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
    }),
    defineField({
      name: 'introCallout',
      title: 'Intro callout',
      type: 'text',
      rows: 3,
      description: 'The highlighted paragraph under the title.',
    }),
    defineField({
      name: 'aboutImage',
      title: 'About portrait',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
    }),
    defineField({
      name: 'aboutBody',
      title: 'About text',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'Heading', value: 'h2' },
          ],
          lists: [],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
            ],
            annotations: [
              defineArrayMember({
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  defineField({
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (rule) =>
                      rule.uri({ scheme: ['http', 'https', 'mailto'] }).required(),
                  }),
                ],
              }),
            ],
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site settings' };
    },
  },
});
