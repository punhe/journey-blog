import { post } from './post';
import { siteSettings } from './siteSettings';
import { tag } from './tag';

export const schemaTypes = [post, tag, siteSettings];
export { post, siteSettings, tag };
