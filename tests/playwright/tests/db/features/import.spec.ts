import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

test.describe('Import', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: NcContext;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('CSV', async () => {
    await dashboard.treeView.quickImport({ title: 'CSV file', baseTitle: context.base.title, context });
  });

  test('Excel', async () => {
    // Everything will be mapped with `SingleLineText` as we disabled auto column mapping
    const col = [
      { type: 'SingleLineText', name: 'number' },
      { type: 'SingleLineText', name: 'float' },
      { type: 'SingleLineText', name: 'text' },
    ];
    const expected = [
      { name: 'Sheet2', columns: col },
      { name: 'Sheet3', columns: col },
      { name: 'Sheet4', columns: col },
    ];

    await dashboard.treeView.quickImport({ title: 'Microsoft Excel', baseTitle: context.base.title, context });
    await dashboard.importTemplate.import({
      file: `${__dirname}/../../../fixtures/sampleFiles/simple.xlsx`,
      result: expected,
    });

    await dashboard.treeView.openTable({ title: 'Sheet2', baseTitle: context.base.title });

    const recordCells = { number: '1', float: '1.1', text: 'abc' };

    for (const [key, value] of Object.entries(recordCells)) {
      await dashboard.grid.cell.verify({
        index: 0,
        columnHeader: key,
        value,
      });
    }
  });

  test('JSON', async () => {
    await dashboard.treeView.quickImport({ title: 'JSON file', baseTitle: context.base.title, context });
  });
});
