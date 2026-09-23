import { visionTool } from '@sanity/vision';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID as string;
const dataset = (import.meta.env.PUBLIC_SANITY_DATASET as string) || 'production';

export default defineConfig({
  name: 'journal-blog',
  title: 'My Journal Blog',
  basePath: '/studio',
  projectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Site settings')
              .id('siteSettings')
              .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
            S.divider(),
            S.documentTypeListItem('post').title('Posts'),
            S.documentTypeListItem('tag').title('Tags'),
          ]),
    }),
    visionTool(),
  ],
  document: {
    // The singleton has one fixed id. Keep it out of the "create new" menu.
    newDocumentOptions: (prev) => prev.filter((item) => item.templateId !== 'siteSettings'),
  },
});
