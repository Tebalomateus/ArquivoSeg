import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * O gating visto de fora: com um conjunto de permissões restrito, os controles
 * somem — e a rota também, porque esconder o botão sem fechar a URL é decoração.
 *
 * Roda no modo mock, onde o conjunto vem das personas de demonstração
 * (src/context/mockPermissions.js) porque não há backend a quem perguntar. A
 * asserção não depende disso: o que se afirma é "quem pode processo.criar vê
 * Novo Sinistro", não de onde a permissão veio.
 */

test('viewer não vê "Novo Sinistro" — e nem chega na rota pela URL', async ({ page }) => {
    await signIn(page, 'viewer');
    await page.goto('/app/sinistros');

    await expect(page.getByRole('link', { name: 'Novo Sinistro' })).toHaveCount(0);

    await page.goto('/app/sinistros/novo');
    await expect(page).toHaveURL(/\/app\/sinistros$/);
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toHaveCount(0);
});

test('contributor tem processo.criar e abre o formulário', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros');

    await expect(page.getByRole('link', { name: 'Novo Sinistro' })).toBeVisible();

    await page.getByRole('link', { name: 'Novo Sinistro' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toBeVisible();
});

test('a aba de gerenciamento de documentos exige arquivo.subir', async ({ page }) => {
    await signIn(page, 'viewer');
    await page.goto('/app/sinistros/1');
    await expect(page.getByRole('button', { name: 'Gerenciamento' })).toHaveCount(0);
});

test('sem arquivo.excluir não há botão de excluir documento', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros/1');
    await page.getByRole('button', { name: 'Gerenciamento' }).click();
    await expect(page.getByTitle('Excluir documento')).toHaveCount(0);
});

test('gerenciar links públicos exige compartilhamento.listar', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros/1');
    await page.getByRole('button', { name: 'Gerenciamento' }).click();
    await expect(page.getByText('Apenas perfis manager+ podem gerenciar links.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar Link' })).toHaveCount(0);
});

test('manager gerencia links públicos', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto('/app/sinistros/1');
    await page.getByRole('button', { name: 'Gerenciamento' }).click();
    await expect(page.getByText('Apenas perfis manager+ podem gerenciar links.')).toHaveCount(0);
    await expect(page.getByRole('combobox').filter({ hasText: 'Selecione um arquivo' })).toBeVisible();
});

// A pasta "Gerencial" do repositório segue processo.verGerencial. No demo só o
// corretor (manager) a tem; o perito e o analista não a veem na lateral.
test('viewer e contributor não veem a pasta "Gerencial"', async ({ page }) => {
    for (const persona of ['viewer', 'contributor']) {
        await signIn(page, persona);
        await page.goto('/app/sinistros/1');
        await expect(page.getByRole('tab', { name: /^Causa \(\d+%\)$/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Gerencial' })).toHaveCount(0);
    }
});

test('manager vê a pasta "Gerencial" e ela abre a visão consolidada, sem kanban', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto('/app/sinistros/1');
    await page.getByRole('tab', { name: 'Gerencial' }).click();
    const tree = page.getByTestId('gerencial-tree');
    await expect(tree.getByRole('heading', { name: 'Visão gerencial' })).toBeVisible();
    await expect(tree.getByTestId('gerencial-folder-avulsos')).toBeVisible();
    await expect(page.getByTestId('column-pendente')).toHaveCount(0);
    // Na aba Gerencial a árvore substitui os três modos: nem o seletor aparece.
    await expect(page.getByRole('group', { name: 'Modo de visualização' })).toHaveCount(0);
});
