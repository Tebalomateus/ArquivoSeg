import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('admin cria um grupo, empresta um papel e escolhe os membros', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/grupos');

    await page.getByRole('button', { name: 'Novo grupo' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Nome').fill('E2E Peritos');
    await expect(editor.getByLabel('Chave')).toHaveValue('e2e_peritos');
    await editor.getByText('Leitor', { exact: true }).click();
    await editor.getByRole('button', { name: 'Salvar' }).click();

    const row = page.getByTestId('group-row-e2e_peritos');
    await expect(row).toContainText('Leitor');
    await expect(row).toContainText('0 membros');

    // A associação é enviada como estado final, não como delta: dois admins
    // editando o mesmo grupo não aplicam metade do trabalho um do outro.
    await row.getByRole('button', { name: '0 membros' }).click();
    const members = page.getByRole('dialog');
    await members.getByText('ana.souza@allianz.com').click();
    await members.getByText('analista@arquivoseg.com.br').click();
    await expect(members.getByText('2 selecionados')).toBeVisible();
    await members.getByRole('button', { name: 'Salvar membros' }).click();

    await expect(page.getByTestId('group-row-e2e_peritos')).toContainText('2 membros');
    const saved = state.groups.find((g) => g.key === 'e2e_peritos');
    expect(saved.member_ids.sort()).toEqual(['u-ana', 'u-maria']);

    const put = state.requests.filter((r) => r.method === 'PUT' && r.path.endsWith('/members'));
    expect(put).toHaveLength(1);
    expect(put[0].body.user_ids.sort()).toEqual(['u-ana', 'u-maria']);
});

test('grupo sem papel avisa que não concede nada', async ({ page }) => {
    await installIamApi(page, (s) => {
        s.groups.push({
            id: 'g-vazio',
            key: 'e2e_vazio',
            name: 'E2E Vazio',
            description: '',
            role_ids: [],
            member_ids: ['u-ana'],
        });
    });
    await page.goto('/admin/acessos/grupos');

    await expect(page.getByTestId('group-row-e2e_vazio')).toContainText('sem papéis — não concede nada');
});

test('remover o membro de um grupo tira o acesso que vinha por ele', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/grupos');

    const row = page.getByTestId('group-row-equipe_regulacao');
    await row.getByRole('button', { name: '1 membros' }).click();
    const members = page.getByRole('dialog');
    await members.getByText('analista@arquivoseg.com.br').click();
    await expect(members.getByText('0 selecionados')).toBeVisible();
    await members.getByRole('button', { name: 'Salvar membros' }).click();

    await expect(page.getByTestId('group-row-equipe_regulacao')).toContainText('0 membros');
    expect(state.groups.find((g) => g.key === 'equipe_regulacao').member_ids).toEqual([]);
});
