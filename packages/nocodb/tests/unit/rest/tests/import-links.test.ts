import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { createTable } from '../../factory/table';
import { createLtarColumn } from '../../factory/column';
import {
  beforeEach as dataApiV3BeforeEach,
} from './dataApiV3/beforeEach';
import { type INcAxios, ncAxios } from './dataApiV3/ncAxios';
import type { Column } from '../../../../src/models';
import type Model from '../../../../src/models/Model';
import type { ITestContext } from '../../init';


// These tests exercise the sequence the Quick Import flow issues when a CSV
// column is mapped to a Link column: lookup-existing → create-missing → bulk
// insert the left rows → nestedLink. Each phase is hit through the public
// REST API so the test catches regressions in the import contract end-to-end
// without depending on the GUI.
function importLinksTests() {
  let testContext: ITestContext;
  let testAxios: INcAxios;
  let ncAxiosGet: INcAxios['ncAxiosGet'];
  let ncAxiosPost: INcAxios['ncAxiosPost'];

  let tblAuthor: Model;
  let tblTag: Model;
  let tblBook: Model;

  let bookAuthorLink: Column;
  let bookTagsLink: Column;

  let authorPkTitle: string;
  let bookPkTitle: string;
  let tagPkTitle: string;

  const nameOnly = [
    {
      title: 'Name',
      column_name: 'Name',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
  ];
  const titleOnly = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
  ];

  // Convenience wrappers around the records endpoints, matching what the
  // frontend import flow does in Editor.vue.
  const recordsList = (modelId: string, query: Record<string, any>) =>
    ncAxiosGet({
      url: `/api/v2/tables/${modelId}/records`,
      query,
    });

  const recordsCreate = (modelId: string, body: any) =>
    ncAxiosPost({
      url: `/api/v2/tables/${modelId}/records`,
      body,
    });

  // supertest's `.send()` mishandles bare primitives (it tries to compute the
  // byte length of e.g. `1` and throws); always wrap link bodies in an array
  // so the controller still sees the intended payload.
  const nestedLink = (modelId: string, columnId: string, rowId: string, body: any) =>
    ncAxiosPost({
      url: `/api/v2/tables/${modelId}/links/${columnId}/records/${encodeURIComponent(rowId)}`,
      body: Array.isArray(body) ? body : [body],
      status: 201,
    });

  const findPkColTitle = (cols: any[]) =>
    cols.find((c) => c.pk)?.title as string;

  beforeEach(async () => {
    testContext = await dataApiV3BeforeEach();
    testAxios = ncAxios(testContext);
    ncAxiosGet = testAxios.ncAxiosGet;
    ncAxiosPost = testAxios.ncAxiosPost;

    tblAuthor = await createTable(testContext.context, testContext.base, {
      title: 'Author',
      table_name: 'Author',
      columns: [{ title: 'Id', column_name: 'id', uidt: UITypes.ID }, ...nameOnly],
    });
    tblTag = await createTable(testContext.context, testContext.base, {
      title: 'Tag',
      table_name: 'Tag',
      columns: [{ title: 'Id', column_name: 'id', uidt: UITypes.ID }, ...nameOnly],
    });
    tblBook = await createTable(testContext.context, testContext.base, {
      title: 'Book',
      table_name: 'Book',
      columns: [{ title: 'Id', column_name: 'id', uidt: UITypes.ID }, ...titleOnly],
    });

    // Book BT-> Author: create on Author as HM, the mirror BT lives on Book.
    await createLtarColumn(testContext.context, {
      title: 'Books',
      parentTable: tblAuthor,
      childTable: tblBook,
      type: 'hm',
    });
    // Book MM-> Tag.
    await createLtarColumn(testContext.context, {
      title: 'BookTags',
      parentTable: tblBook,
      childTable: tblTag,
      type: 'mm',
    });

    const authorCols = await tblAuthor.getColumns(testContext.ctx);
    const tagCols = await tblTag.getColumns(testContext.ctx);
    const bookCols = await tblBook.getColumns(testContext.ctx);

    bookAuthorLink = bookCols.find((c) => c.title === 'Author') as Column;
    bookTagsLink = bookCols.find((c) => c.title === 'BookTags') as Column;
    expect(bookAuthorLink, 'mirror BT column on Book').to.exist;
    expect(bookTagsLink, 'MM column on Book').to.exist;

    authorPkTitle = findPkColTitle(authorCols);
    tagPkTitle = findPkColTitle(tagCols);
    bookPkTitle = findPkColTitle(bookCols);
  });

  // Simulates the Quick Import flow for one Link mapping:
  //   1. For each unique value, GET /records?where=(displayCol,eq,value)&limit=1
  //   2. POST /records with the unresolved values (display value only)
  //   3. Return a Map<value, pk> the caller can use to build nestedLink bodies.
  async function resolveLinkValues({
    relatedModelId,
    displayColTitle,
    relatedPkTitle,
    values,
  }: {
    relatedModelId: string;
    displayColTitle: string;
    relatedPkTitle: string;
    values: string[];
  }) {
    const uniqueValues = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    const valueToPk = new Map<string, any>();

    for (const v of uniqueValues) {
      const res = await recordsList(relatedModelId, {
        where: `(${displayColTitle},eq,${v})`,
        limit: 1,
      });
      const row = (res.body?.list ?? [])[0];
      if (row && row[relatedPkTitle] != null) valueToPk.set(v, row[relatedPkTitle]);
    }

    const missing = uniqueValues.filter((v) => !valueToPk.has(v));
    if (missing.length) {
      const created = await recordsCreate(
        relatedModelId,
        missing.map((v) => ({ [displayColTitle]: v })),
      );
      const createdArr: any[] = Array.isArray(created.body) ? created.body : [created.body];
      for (let i = 0; i < missing.length; i++) {
        const row = createdArr[i] || {};
        const pk = row[relatedPkTitle];
        if (pk != null) valueToPk.set(missing[i], pk);
      }
    }

    return valueToPk;
  }

  it('BT: dedups identical Author values and creates one right-table row per distinct name', async () => {
    const csv = [
      { Title: 'The Bear', Author: 'Aria' },
      { Title: 'Quiet Light', Author: 'Aria' },
      { Title: 'Cold Front', Author: 'Beck' },
      { Title: 'Edgewater', Author: 'Beck' },
      { Title: 'Snowmelt', Author: '  Aria  ' }, // whitespace dup of "Aria"
    ];

    const authorMap = await resolveLinkValues({
      relatedModelId: tblAuthor.id,
      displayColTitle: 'Name',
      relatedPkTitle: authorPkTitle,
      values: csv.map((r) => r.Author),
    });

    // Phase B: bulk-create the left (Book) rows without the link column.
    const books = await recordsCreate(
      tblBook.id,
      csv.map((r) => ({ Title: r.Title })),
    );
    const bookRows: any[] = Array.isArray(books.body) ? books.body : [books.body];
    expect(bookRows).to.have.lengthOf(csv.length);

    // Phase C: link each book to its author.
    for (let i = 0; i < csv.length; i++) {
      const leftPk = bookRows[i][bookPkTitle];
      const value = csv[i].Author.trim();
      const authorPk = authorMap.get(value);
      expect(authorPk, `author "${value}" must be resolved`).to.exist;
      await nestedLink(tblBook.id, bookAuthorLink.id, String(leftPk), authorPk);
    }

    // Author table should hold exactly the two distinct names.
    const authorsList = await recordsList(tblAuthor.id, { limit: 100 });
    const names = (authorsList.body.list as any[]).map((r) => r.Name).sort();
    expect(names).to.deep.equal(['Aria', 'Beck']);

    // Every book should resolve its Author back to the right name.
    const booksList = await recordsList(tblBook.id, { limit: 100 });
    const byTitle = new Map<string, any>();
    for (const row of booksList.body.list as any[]) byTitle.set(row.Title, row);
    expect(byTitle.get('The Bear')?.Author?.Name).to.equal('Aria');
    expect(byTitle.get('Quiet Light')?.Author?.Name).to.equal('Aria');
    expect(byTitle.get('Cold Front')?.Author?.Name).to.equal('Beck');
    expect(byTitle.get('Edgewater')?.Author?.Name).to.equal('Beck');
    expect(byTitle.get('Snowmelt')?.Author?.Name).to.equal('Aria');
  });

  it('BT: re-importing rows with the same Author values does not duplicate Author rows', async () => {
    // First import.
    const firstCsv = [
      { Title: 'The Bear', Author: 'Aria' },
      { Title: 'Cold Front', Author: 'Beck' },
    ];
    const firstMap = await resolveLinkValues({
      relatedModelId: tblAuthor.id,
      displayColTitle: 'Name',
      relatedPkTitle: authorPkTitle,
      values: firstCsv.map((r) => r.Author),
    });
    const firstBooks = await recordsCreate(
      tblBook.id,
      firstCsv.map((r) => ({ Title: r.Title })),
    );
    const firstBookRows: any[] = Array.isArray(firstBooks.body) ? firstBooks.body : [firstBooks.body];
    for (let i = 0; i < firstCsv.length; i++) {
      await nestedLink(
        tblBook.id,
        bookAuthorLink.id,
        String(firstBookRows[i][bookPkTitle]),
        firstMap.get(firstCsv[i].Author),
      );
    }

    // Second import — same authors, new books.
    const secondCsv = [
      { Title: 'Quiet Light', Author: 'Aria' },
      { Title: 'Edgewater', Author: 'Beck' },
      { Title: 'Mountain Pass', Author: 'Cyn' }, // brand new author
    ];
    const secondMap = await resolveLinkValues({
      relatedModelId: tblAuthor.id,
      displayColTitle: 'Name',
      relatedPkTitle: authorPkTitle,
      values: secondCsv.map((r) => r.Author),
    });
    // Re-used PKs must match the originals.
    expect(secondMap.get('Aria')).to.equal(firstMap.get('Aria'));
    expect(secondMap.get('Beck')).to.equal(firstMap.get('Beck'));

    const secondBooks = await recordsCreate(
      tblBook.id,
      secondCsv.map((r) => ({ Title: r.Title })),
    );
    const secondBookRows: any[] = Array.isArray(secondBooks.body) ? secondBooks.body : [secondBooks.body];
    for (let i = 0; i < secondCsv.length; i++) {
      await nestedLink(
        tblBook.id,
        bookAuthorLink.id,
        String(secondBookRows[i][bookPkTitle]),
        secondMap.get(secondCsv[i].Author),
      );
    }

    // Author table should hold exactly Aria, Beck, Cyn.
    const authorsList = await recordsList(tblAuthor.id, { limit: 100 });
    const names = (authorsList.body.list as any[]).map((r) => r.Name).sort();
    expect(names).to.deep.equal(['Aria', 'Beck', 'Cyn']);
  });

  it('MM: splits delimited tag values, dedups, and links each book to the matching tag rows', async () => {
    const csv = [
      { Title: 'The Bear', Tags: 'fiction,short' },
      { Title: 'Quiet Light', Tags: 'poetry' },
      { Title: 'Cold Front', Tags: 'fiction, poetry' }, // same `fiction` & `poetry`
      { Title: 'Edgewater', Tags: '' }, // empty cell -> no links
    ];
    const delimiter = ',';

    // Phase A: split, dedup, resolve.
    const allValues: string[] = [];
    for (const r of csv) {
      for (const piece of r.Tags.split(delimiter)) {
        const v = piece.trim();
        if (v) allValues.push(v);
      }
    }
    const tagMap = await resolveLinkValues({
      relatedModelId: tblTag.id,
      displayColTitle: 'Name',
      relatedPkTitle: tagPkTitle,
      values: allValues,
    });

    // Tag table must hold exactly the 3 distinct tags.
    const tagsList = await recordsList(tblTag.id, { limit: 100 });
    const tagNames = (tagsList.body.list as any[]).map((r) => r.Name).sort();
    expect(tagNames).to.deep.equal(['fiction', 'poetry', 'short']);

    // Phase B: insert books.
    const books = await recordsCreate(
      tblBook.id,
      csv.map((r) => ({ Title: r.Title })),
    );
    const bookRows: any[] = Array.isArray(books.body) ? books.body : [books.body];

    // Phase C: nestedLink per book with tag rows.
    for (let i = 0; i < csv.length; i++) {
      const pieces = csv[i].Tags.split(delimiter).map((s) => s.trim()).filter(Boolean);
      if (!pieces.length) continue;
      const childIds = Array.from(new Set(pieces.map((v) => tagMap.get(v)).filter((v) => v != null)));
      await nestedLink(
        tblBook.id,
        bookTagsLink.id,
        String(bookRows[i][bookPkTitle]),
        childIds.length === 1 ? childIds[0] : childIds,
      );
    }

    // Verify each book's MM list.
    const expectedByTitle: Record<string, string[]> = {
      'The Bear': ['fiction', 'short'],
      'Quiet Light': ['poetry'],
      'Cold Front': ['fiction', 'poetry'],
      Edgewater: [],
    };

    for (let i = 0; i < csv.length; i++) {
      const bookPk = bookRows[i][bookPkTitle];
      const linked = await ncAxiosGet({
        url: `/api/v2/tables/${tblBook.id}/links/${bookTagsLink.id}/records/${encodeURIComponent(String(bookPk))}`,
        query: { limit: 50 },
      });
      const got = (linked.body.list as any[]).map((r) => r.Name).sort();
      expect(got, `tags for ${csv[i].Title}`).to.deep.equal(expectedByTitle[csv[i].Title].sort());
    }
  });

  it('MM: a tag shared by multiple books still resolves to a single Tag row', async () => {
    const tagMap = await resolveLinkValues({
      relatedModelId: tblTag.id,
      displayColTitle: 'Name',
      relatedPkTitle: tagPkTitle,
      values: ['fiction', 'fiction', 'fiction'], // same tag three times
    });
    expect(tagMap.size).to.equal(1);
    const fictionPk = tagMap.get('fiction');

    const tagsList = await recordsList(tblTag.id, { limit: 100 });
    expect(tagsList.body.list).to.have.lengthOf(1);

    const books = await recordsCreate(tblBook.id, [
      { Title: 'A' },
      { Title: 'B' },
      { Title: 'C' },
    ]);
    const bookRows: any[] = Array.isArray(books.body) ? books.body : [books.body];
    for (const row of bookRows) {
      await nestedLink(tblBook.id, bookTagsLink.id, String(row[bookPkTitle]), fictionPk);
    }

    for (const row of bookRows) {
      const linked = await ncAxiosGet({
        url: `/api/v2/tables/${tblBook.id}/links/${bookTagsLink.id}/records/${encodeURIComponent(String(row[bookPkTitle]))}`,
      });
      const got = (linked.body.list as any[]).map((r) => r.Name);
      expect(got).to.deep.equal(['fiction']);
    }
  });
}

export default function () {
  describe('Import Links', importLinksTests);
}
