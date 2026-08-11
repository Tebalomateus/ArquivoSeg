import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

/**
 * O curinga é a única concessão que cresce sozinha: `processo.*` passa a valer
 * para ações que ainda não existem. O aviso na tela é requisito de produto
 * (doc 06), então tem teste — e o que se grava tem de ser o padrão, não a lista
 * expandida, senão a promessa vira uma foto do catálogo de hoje.
 */
test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('marcar o curinga grava processo.* e avisa sobre permissões futuras', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/papeis');

    await page.getByRole('button', { name: 'Novo papel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill('E2E Curinga');

    await dialog.getByTestId('wildcard-processo').click();

    await expect(dialog.getByTestId('group-processo')).toContainText(
        'automaticamente novas permissões de processo lançadas no futuro',
    );
    // As ações individuais somem: com o curinga não há o que marcar uma a uma.
    await expect(dialog.getByTestId('action-processo.listar')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByTestId('role-e2e_curinga')).toContainText('1 permissões');
    expect(state.roles.find((r) => r.key === 'e2e_curinga').permissions).toEqual(['processo.*']);
});

test('curinga e "marcar todas" são controles diferentes', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/papeis');

    await page.getByRole('button', { name: 'Novo papel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill('E2E Todas');

    // Marcar todas concede as ações de hoje, uma a uma — e nada do amanhã.
    await dialog.getByTestId('toggle-all-arquivo').click();
    await expect(dialog.getByTestId('group-arquivo')).not.toContainText('lançadas no futuro');

    // O curinga sobrepõe e limpa as escolhas individuais do grupo, para não
    // sobrarem duas regras dizendo a mesma coisa até divergirem.
    await dialog.getByTestId('wildcard-arquivo').click();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    expect(state.roles.find((r) => r.key === 'e2e_todas').permissions).toEqual(['arquivo.*']);
});
