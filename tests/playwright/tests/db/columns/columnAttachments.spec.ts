import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { SharedFormPage } from '../../../pages/SharedForm';
import setup, { unsetup } from '../../../setup';

test.describe('Attachment column', () => {
  let dashboard: DashboardPage, context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create and verify attachment column, verify it in shared form,', async ({ context: _context }) => {
    // run tests slowly
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });

    for (let i = 12; i >= 8; i -= 2) {
      const filepath = [`${__dirname}/../../../fixtures/sampleFiles/${i / 2}.json`];
      await dashboard.grid.cell.attachment.addFile({
        index: i,
        columnHeader: 'testAttach',
        filePath: filepath,
      });

      await dashboard.rootPage.waitForTimeout(500);

      await dashboard.grid.cell.attachment.verifyFile({
        index: i,
        columnHeader: 'testAttach',
      });
    }
    await dashboard.grid.cell.attachment.addFile({
      index: 4,
      columnHeader: 'testAttach',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/sampleImage.jpeg`],
    });

    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.grid.cell.attachment.verifyFile({
      index: 4,
      columnHeader: 'testAttach',
    });

    // Kludge: tooltip somehow persists. fix me!
    await dashboard.rootPage.reload();

    await dashboard.viewSidebar.createFormView({
      title: 'Form 1',
    });
    await dashboard.rootPage.waitForTimeout(500);
    const sharedFormUrl = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });

    // Verify attachment in shared form
    const newPage = await _context.newPage();
    await newPage.goto(sharedFormUrl);
    const sharedForm = new SharedFormPage(newPage);

    await sharedForm.rootPage.waitForTimeout(500);
    await sharedForm.cell.fillText({
      index: 0,
      columnHeader: 'Country',
      text: 'test',
    });

    await sharedForm.rootPage.waitForTimeout(500);
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'testAttach',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/1.json`],
      skipElemClick: true,
    });

    await sharedForm.rootPage.waitForTimeout(1000);
    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
    await newPage.close();
  });
});
