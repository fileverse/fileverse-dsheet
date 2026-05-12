declare module '@fileverse-dev/dsheets-templates/template-metadata-list' {
  export interface TemplateListEntry {
    title: string;
    description: string;
    thumbnail: string;
    slug: string;
    fullImage: string;
    category?: string;
  }

  export const TEMPLATES: TemplateListEntry[];
}

declare module '@fileverse-dev/dsheets-templates/template-data-list' {
  export const TEMPLATES_DATA: {
    [templateId: string]: object[];
  };
}
