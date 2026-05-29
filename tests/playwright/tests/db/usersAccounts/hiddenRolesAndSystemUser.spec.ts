import { expect, test } from '@playwright/test';
import { Api } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { AccountPage } from '../../../pages/Account';
import { AccountUsersPage } from '../../../pages/Account/Users';
import setup, { unsetup } from '../../../setup';
import { isEE } from '../../../setup/db';

// FanJam: Owner/Creator must not appear in any role picker, and the system
// Owner must not appear in the Members list. The base setup user is the OWNER
// of the test base, so it stands in for the "system user" here.
test.describe('Hidden roles and system user', () => {
  let dashboard: DashboardPage;
  let accountPage: AccountPage;
  let accountUsersPage: AccountUsersPage;
  let context: any;
  let api: Api<any>;
  let editorEmail = '';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    accountPage = new AccountPage(page);
    accountUsersPage = new AccountUsersPage(accountPage);

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    editorEmail = accountUsersPage.prefixEmail('hidden-roles-editor@nocodb.com');

    // Add a fresh editor member so we have a non-owner row to interact with.
    try {
      const existing = await api.auth.baseUserList(context.base.id);
      const dupe = existing.users.list.find((u: any) => u.email === editorEmail);
      if (dupe) {
        await api.auth.baseUserRemove(context.base.id, dupe.id);
      }
    } catch (_) {
      // ignore
    }

    try {
      await api.auth.signup({ email: editorEmail, password: '12345678' });
    } catch (_) {
      // already exists
    }

    await api.auth.baseUserAdd(context.base.id, {
      roles: 'editor',
      email: editorEmail,
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  const openAccessSettings = async () => {
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.openOverview();
    await dashboard.baseView.tab_accessSettings.click();
    await dashboard.rootPage.locator('.nc-access-settings-view').waitFor({ state: 'visible' });
    // wait for the row list to render
    await dashboard.rootPage.locator('.nc-access-settings-view .user-row').first().waitFor({ state: 'visible' });
  };

  test('System Owner is hidden from the Members list', async () => {
    if (isEE()) test.skip();
    await openAccessSettings();

    const list = dashboard.rootPage.locator('.nc-access-settings-view');

    // The invited editor is visible.
    await expect(list.locator('.user-row').filter({ hasText: editorEmail })).toHaveCount(1);

    // The OWNER (test setup root user) is NOT visible.
    await expect(list.locator('.user-row').filter({ hasText: context.rootUser.email })).toHaveCount(0);
  });

  test('Per-row role dropdown hides Creator and Owner', async () => {
    if (isEE()) test.skip();
    await openAccessSettings();

    const row = dashboard.rootPage
      .locator('.nc-access-settings-view .user-row')
      .filter({ hasText: editorEmail });
    await row.waitFor({ state: 'visible' });

    await row.locator('.nc-roles-selector').click();
    const menu = dashboard.rootPage.locator('.nc-role-select-dropdown:visible').last();
    await menu.waitFor({ state: 'visible' });

    await expect(menu.locator('.nc-role-select-editor')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-commenter')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-viewer')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-creator')).toHaveCount(0);
    await expect(menu.locator('.nc-role-select-owner')).toHaveCount(0);
  });

  test('Add Members invite dialog hides Creator and Owner', async () => {
    if (isEE()) test.skip();
    await openAccessSettings();

    await dashboard.rootPage
      .locator('.nc-access-settings-view')
      .getByRole('button', { name: 'Add Members' })
      .click();

    const inviteDlg = dashboard.rootPage.locator('.nc-invite-dlg');
    await inviteDlg.waitFor({ state: 'visible' });

    await inviteDlg.locator('.nc-invite-role-selector').click();
    const menu = dashboard.rootPage.locator('.nc-role-select-dropdown:visible').last();
    await menu.waitFor({ state: 'visible' });

    await expect(menu.locator('.nc-role-select-editor')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-commenter')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-viewer')).toHaveCount(1);
    await expect(menu.locator('.nc-role-select-creator')).toHaveCount(0);
    await expect(menu.locator('.nc-role-select-owner')).toHaveCount(0);
  });
});
