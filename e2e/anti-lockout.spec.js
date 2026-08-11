import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

/**
 * A regra que não tem "prosseguir mesmo assim".
 *
 * SELF_DEMOTION é reversível — outra pessoa desfaz — e por isso a tela oferece
 * confirmar. LAST_ADMIN não é: se o último admin se tranca fora do IAM, não
 * sobra ninguém para desfazer. O teste garante que a tela não trata os dois
 * como o mesmo 409.
 */
test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('o último admin não consegue negar a si mesmo o acesso de IAM', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/usuarios/u-admin');

    await page.getByRole('button', { name: 'Adicionar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ação').selectOption('iam.atribuir');
    await dialog.getByRole('button', { name: 'Negar' }).click();
    await dialog.getByRole('button', { name: 'Aplicar' }).click();

    // Erro, não diálogo: não há confirmação que torne isto seguro.
    await expect(page.getByText('LAST_ADMIN')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Isto tira o seu próprio acesso' })).toHaveCount(0);
    expect(state.individual['u-admin']).toEqual([]);
});

test('o curinga de IAM também é barrado', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/usuarios/u-admin');

    await page.getByRole('button', { name: 'Adicionar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ação').selectOption('iam.*');
    await dialog.getByRole('button', { name: 'Negar' }).click();
    await dialog.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page.getByText('LAST_ADMIN')).toBeVisible();
    expect(state.individual['u-admin']).toEqual([]);
});

test('com outro admin no tenant a mesma negação passa pela confirmação', async ({ page }) => {
    const state = await installIamApi(page, (s) => {
        s.users.find((u) => u.id === 'u-ana').role = 'admin';
    });
    await page.goto('/admin/acessos/usuarios/u-admin');

    await page.getByRole('button', { name: 'Adicionar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ação').selectOption('iam.atribuir');
    await dialog.getByRole('button', { name: 'Negar' }).click();
    await dialog.getByRole('button', { name: 'Aplicar' }).click();

    const confirmar = page.getByRole('dialog', { name: 'Isto tira o seu próprio acesso' });
    await expect(confirmar).toBeVisible();
    await confirmar.getByRole('button', { name: 'Entendi, prosseguir' }).click();

    expect(state.individual['u-admin']).toEqual([{ action: 'iam.atribuir', effect: 'deny' }]);
});
