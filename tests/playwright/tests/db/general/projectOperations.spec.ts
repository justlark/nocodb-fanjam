import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';

test.describe('Base operations', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('rename, delete', async () => {
    await dashboard.leftSidebar.createProject({ title: 'base-firstName', context });
    await dashboard.treeView.renameProject({ title: 'base-firstName', newTitle: 'base-rename', context });
    await dashboard.treeView.openProject({ title: 'base-rename', context });
    await dashboard.treeView.deleteProject({ title: 'base-rename', context });
  });

});
