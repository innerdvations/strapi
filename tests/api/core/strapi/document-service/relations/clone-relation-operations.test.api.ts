/**
 * Clone must treat user-submitted relation operation payloads as replacements for the
 * original entry's populated relation data.
 */
import type { Core, UID } from '@strapi/types';

import { testInTransaction } from '../../../../utils';

const { createTestBuilder } = require('api-tests/builder');
const { createStrapiInstance } = require('api-tests/strapi');

let strapi: Core.Strapi;
const builder = createTestBuilder();

const PRODUCT_UID = 'api::product.product' as UID.ContentType;
const TAG_UID = 'api::tag.tag' as UID.ContentType;
const RELATION_PANEL_UID = 'default.relation-panel' as UID.Component;

/** Default relation field value after CM prepareRelations on duplicate form load. */
const DUPLICATE_FORM_UNTOUCHED_RELATION_OPS = {
  connect: [],
  disconnect: [],
} as const;

type ProductWithTags = {
  tag?: {
    documentId?: string;
  } | null;
  tags?: Array<{ documentId?: string }>;
  legacyTag?: {
    documentId?: string;
  } | null;
  relationPanel?: {
    tag?: {
      documentId?: string;
    } | null;
  } | null;
};

const productModel = {
  attributes: {
    name: {
      type: 'string',
    },
    tag: {
      type: 'relation',
      relation: 'oneToOne',
      target: TAG_UID,
      targetAttribute: 'product',
    },
    legacyTag: {
      type: 'relation',
      relation: 'oneToOne',
      target: TAG_UID,
      useJoinTable: false,
    },
    tags: {
      type: 'relation',
      relation: 'manyToMany',
      target: TAG_UID,
    },
    relationPanel: {
      type: 'component',
      component: RELATION_PANEL_UID,
      repeatable: false,
    },
  },
  pluginOptions: {
    i18n: {
      localized: true,
    },
  },
  draftAndPublish: true,
  displayName: 'Product',
  singularName: 'product',
  pluralName: 'products',
  description: '',
  collectionName: '',
};

const tagModel = {
  attributes: {
    name: { type: 'string' },
  },
  draftAndPublish: true,
  displayName: 'Tag',
  singularName: 'tag',
  pluralName: 'tags',
  description: '',
  collectionName: '',
};

const relationPanelComponentModel = {
  collectionName: 'components_relation_panels',
  attributes: {
    tag: {
      type: 'relation',
      relation: 'oneToOne',
      target: TAG_UID,
    },
  },
  displayName: 'relation-panel',
};

const createTag = (name: string) => strapi.documents(TAG_UID).create({ data: { name } });

const relationDocumentId = (product: ProductWithTags | undefined, attribute: 'tag' | 'legacyTag') =>
  product?.[attribute]?.documentId ?? null;

const componentRelationDocumentId = (component: ProductWithTags['relationPanel']) =>
  component?.tag?.documentId ?? null;

const createTaggedProduct = async (productName: string, tagName: string) => {
  const tag = await createTag(tagName);

  const product = await strapi.documents(PRODUCT_UID).create({
    locale: 'en',
    data: {
      name: productName,
      tag: { documentId: tag.documentId },
    },
    populate: { tag: true },
  });

  expect((product as ProductWithTags).tag).toMatchObject({ documentId: tag.documentId });

  return { product, tag };
};

const createLegacyTaggedProduct = async (productName: string, tagName: string) => {
  const tag = await createTag(tagName);

  const product = await strapi.documents(PRODUCT_UID).create({
    locale: 'en',
    data: {
      name: productName,
      legacyTag: tag.id,
    },
    populate: { legacyTag: true },
  });

  expect((product as ProductWithTags).legacyTag).toMatchObject({ documentId: tag.documentId });

  return { product, tag };
};

const findProductWithTags = (documentId: string) =>
  strapi.documents(PRODUCT_UID).findOne({
    documentId,
    locale: 'en',
    populate: {
      tag: true,
      legacyTag: true,
      tags: true,
      relationPanel: { populate: { tag: true } },
    },
  });

const createProductWithManyTags = async (productName: string, tagNames: string[]) => {
  const tags = await Promise.all(tagNames.map((name) => createTag(name)));

  const product = await strapi.documents(PRODUCT_UID).create({
    locale: 'en',
    data: {
      name: productName,
      tags: tags.map((tag) => ({ documentId: tag.documentId })),
    },
    populate: { tags: true },
  });

  expect((product as ProductWithTags).tags).toHaveLength(tags.length);

  return { product, tags };
};

const createProductWithComponentTag = async (productName: string, tagName: string) => {
  const tag = await createTag(tagName);

  const product = await strapi.documents(PRODUCT_UID).create({
    locale: 'en',
    data: {
      name: productName,
      relationPanel: {
        tag: { documentId: tag.documentId },
      },
    },
    populate: { relationPanel: { populate: { tag: true } } },
  });

  expect((product as ProductWithTags).relationPanel?.tag).toMatchObject({
    documentId: tag.documentId,
  });

  return { product, tag };
};

describe('Document Service clone relation operation payloads', () => {
  beforeAll(async () => {
    await builder
      .addContentTypes([tagModel])
      .addComponent(relationPanelComponentModel)
      .addContentTypes([productModel])
      .build();

    strapi = await createStrapiInstance();
  });

  afterAll(async () => {
    await strapi.destroy();
    await builder.cleanup();
  });

  testInTransaction(
    'clone applies duplicate-form disconnect for a top-level oneToOne relation',
    async () => {
      const { product, tag } = await createTaggedProduct(
        'CMS-557 Source Product',
        'CMS-557 Original Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'CMS-557 Clone without tag',
          tag: {
            connect: [],
            disconnect: [{ documentId: tag.documentId }],
          },
        },
        populate: { tag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneTagDocumentId: relationDocumentId(result.entries[0] as ProductWithTags, 'tag'),
        originalTagDocumentId: relationDocumentId(originalProduct as ProductWithTags, 'tag'),
      }).toEqual({
        cloneTagDocumentId: null,
        originalTagDocumentId: tag.documentId,
      });
    }
  );

  testInTransaction(
    'clone applies duplicate-form selected target for a top-level oneToOne relation',
    async () => {
      const { product, tag: originalTag } = await createTaggedProduct(
        'CMS-562 Source Product',
        'CMS-562 Original Tag'
      );
      const selectedTag = await createTag('CMS-562 Selected Tag');

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'CMS-562 Clone with selected tag',
          tag: {
            connect: [{ documentId: selectedTag.documentId }],
            disconnect: [{ documentId: originalTag.documentId }],
          },
        },
        populate: { tag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneTagDocumentId: relationDocumentId(result.entries[0] as ProductWithTags, 'tag'),
        originalTagDocumentId: relationDocumentId(originalProduct as ProductWithTags, 'tag'),
      }).toEqual({
        cloneTagDocumentId: selectedTag.documentId,
        originalTagDocumentId: originalTag.documentId,
      });
    }
  );

  testInTransaction(
    'clone preserves oneToOne relation when duplicate form sends empty connect/disconnect',
    async () => {
      const { product, tag } = await createTaggedProduct(
        'Untouched O2O Source Product',
        'Untouched O2O Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Untouched O2O Clone',
          tag: DUPLICATE_FORM_UNTOUCHED_RELATION_OPS,
        },
        populate: { tag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneTagDocumentId: relationDocumentId(result.entries[0] as ProductWithTags, 'tag'),
        originalTagDocumentId: relationDocumentId(originalProduct as ProductWithTags, 'tag'),
      }).toEqual({
        cloneTagDocumentId: tag.documentId,
        originalTagDocumentId: tag.documentId,
      });
    }
  );

  testInTransaction(
    'clone preserves oneToOne relation when submitted data omits relation fields',
    async () => {
      const { product, tag } = await createTaggedProduct(
        'Auto-clone O2O Source Product',
        'Auto-clone O2O Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Auto-clone O2O Clone',
        },
        populate: { tag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneTagDocumentId: relationDocumentId(result.entries[0] as ProductWithTags, 'tag'),
        originalTagDocumentId: relationDocumentId(originalProduct as ProductWithTags, 'tag'),
      }).toEqual({
        cloneTagDocumentId: tag.documentId,
        originalTagDocumentId: tag.documentId,
      });
    }
  );

  testInTransaction(
    'clone preserves manyToMany relations when duplicate form sends empty connect/disconnect',
    async () => {
      const { product, tags } = await createProductWithManyTags('Untouched M2M Source Product', [
        'Untouched M2M Tag A',
        'Untouched M2M Tag B',
      ]);

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Untouched M2M Clone',
          tags: DUPLICATE_FORM_UNTOUCHED_RELATION_OPS,
        },
        populate: { tags: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);
      const expectedTagDocumentIds = tags.map((tag) => tag.documentId).sort();

      expect({
        cloneTagDocumentIds: ((result.entries[0] as ProductWithTags).tags ?? [])
          .map((tag) => tag.documentId)
          .sort(),
        originalTagDocumentIds: ((originalProduct as ProductWithTags).tags ?? [])
          .map((tag) => tag.documentId)
          .sort(),
      }).toEqual({
        cloneTagDocumentIds: expectedTagDocumentIds,
        originalTagDocumentIds: expectedTagDocumentIds,
      });
    }
  );

  testInTransaction(
    'clone clears oneToOne relation when duplicate form sends explicit set null',
    async () => {
      const { product, tag } = await createTaggedProduct(
        'Explicit Set Source Product',
        'Explicit Set Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Explicit Set Clone',
          tag: { set: null },
        },
        populate: { tag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneTagDocumentId: relationDocumentId(result.entries[0] as ProductWithTags, 'tag'),
        originalTagDocumentId: relationDocumentId(originalProduct as ProductWithTags, 'tag'),
      }).toEqual({
        cloneTagDocumentId: null,
        originalTagDocumentId: tag.documentId,
      });
    }
  );

  testInTransaction(
    'clone applies duplicate-form disconnect for a component oneToOne relation',
    async () => {
      const { product, tag } = await createProductWithComponentTag(
        'Component O2O Source Product',
        'Component O2O Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Component O2O Clone without tag',
          relationPanel: {
            tag: {
              connect: [],
              disconnect: [{ documentId: tag.documentId }],
            },
          },
        },
        populate: { relationPanel: { populate: { tag: true } } },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneComponentTagDocumentId: componentRelationDocumentId(
          (result.entries[0] as ProductWithTags).relationPanel
        ),
        originalComponentTagDocumentId: componentRelationDocumentId(
          (originalProduct as ProductWithTags).relationPanel
        ),
      }).toEqual({
        cloneComponentTagDocumentId: null,
        originalComponentTagDocumentId: tag.documentId,
      });
    }
  );

  testInTransaction(
    'clone preserves useJoinTable:false relation data when submitted operations are not transformable',
    async () => {
      const { product, tag } = await createLegacyTaggedProduct(
        'Legacy Source Product',
        'Legacy Original Tag'
      );

      const result = await strapi.documents(PRODUCT_UID).clone({
        documentId: product.documentId,
        locale: 'en',
        data: {
          name: 'Legacy Clone',
          legacyTag: {
            connect: [],
            disconnect: [{ documentId: tag.documentId }],
          },
        },
        populate: { legacyTag: true },
      });

      const originalProduct = await findProductWithTags(product.documentId);

      expect({
        cloneLegacyTagDocumentId: relationDocumentId(
          result.entries[0] as ProductWithTags,
          'legacyTag'
        ),
        originalLegacyTagDocumentId: relationDocumentId(
          originalProduct as ProductWithTags,
          'legacyTag'
        ),
      }).toEqual({
        cloneLegacyTagDocumentId: tag.documentId,
        originalLegacyTagDocumentId: tag.documentId,
      });
    }
  );
});
