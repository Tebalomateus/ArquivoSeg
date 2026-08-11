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
