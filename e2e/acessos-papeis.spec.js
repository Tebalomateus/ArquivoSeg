import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('admin cria um papel, marca permissões e ele aparece na lista', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/papeis');

    await page.getByRole('button', { name: 'Novo papel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill('E2E Regulador');

    // A chave se deriva do nome enquanto ninguém a tocou — é o que poupa o admin
    // de digitar as duas coisas.
    await expect(dialog.getByLabel('Chave')).toHaveValue('e2e_regulador');

    await dialog.getByTestId('action-processo.listar').locator('input').check();
    await dialog.getByTestId('action-processo.ver').locator('input').check();
    await expect(dialog.getByText('2 selecionadas')).toBeVisible();

    await dialog.getByRole('button', { name: 'Salvar' }).click();

    const row = page.getByTestId('role-e2e_regulador');
    await expect(row).toBeVisible();
    await expect(row).toContainText('2 permissões');

    // O que o servidor guardou é a asserção que importa: a tela pode desenhar
    // qualquer coisa, o papel vale pelo que foi persistido.
    const saved = state.roles.find((r) => r.key === 'e2e_regulador');
    expect(saved.permissions.sort()).toEqual(['processo.listar', 'processo.ver']);
});

test('papel de sistema não pode ser editado nem excluído', async ({ page }) => {
    await installIamApi(page);
    await page.goto('/admin/acessos/papeis');

    const row = page.getByTestId('role-admin');
    await expect(row).toContainText('sistema');
    await expect(row.getByRole('button', { name: 'Papéis de sistema não podem ser excluídos' })).toBeDisabled();

    await row.getByRole('button', { name: 'Ver permissões' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Salvar' })).toBeDisabled();
});

test('excluir um papel em uso mostra quantas atribuições vão junto', async ({ page }) => {
    const state = await installIamApi(page, (s) => {
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/papeis');

    // r-leitor está com a Ana e com o grupo (que tem um membro): duas atribuições.
    await page.getByTestId('role-leitor').getByRole('button', { name: 'Excluir' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click();

    await expect(dialog.getByText('a 2 atribuição(ões)')).toBeVisible();

    await dialog.getByRole('button', { name: 'Excluir mesmo assim' }).click();
    await expect(page.getByTestId('role-leitor')).toHaveCount(0);
    expect(state.roles.some((r) => r.key === 'leitor')).toBe(false);
});
