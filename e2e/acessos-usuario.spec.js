import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

/**
 * A tela de detalhe é o objetivo 4 do projeto: por que fulano consegue (ou não)
 * fazer X. O que se testa aqui não é só o botão, é a resposta — a origem de cada
 * veredito, que é o que evita a pergunta virar chamado.
 */
test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('atribuir um papel e ver de onde a permissão passa a vir', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/usuarios');

    await page.getByText('ana.souza@allianz.com').click();
    await expect(page).toHaveURL(/\/admin\/acessos\/usuarios\/u-ana$/);

    // Sem papéis, sem grupos: nada no painel de acessos efetivos.
    await expect(page.getByText('Não pertence a nenhum grupo')).toBeVisible();
    await expect(page.getByText('Nenhuma. Todo o acesso vem de papéis e grupos.')).toBeVisible();

    // click, e não check: a marcação só volta depois que o servidor responde e a
    // tela recarrega o acesso — check() exige a mudança no mesmo instante.
    const leitor = page.getByRole('checkbox', { name: /Leitor/ });
    await leitor.click();
    await expect(leitor).toBeChecked();

    const linha = page.locator('li', { has: page.getByText('processo.listar', { exact: true }) });
    await expect(linha).toContainText('Leitor');
    expect(state.userRoles['u-ana']).toEqual(['r-leitor']);
});

test('o papel emprestado por um grupo aparece nomeando o grupo', async ({ page }) => {
    await installIamApi(page);
    await page.goto('/admin/acessos/usuarios/u-maria');

    // O grupo aparece como grupo (só leitura, editável do lado do grupo)…
    await expect(page.getByRole('link', { name: /Equipe de Regulação/ })).toBeVisible();
    // …e a permissão que ele empresta diz por onde veio.
    const linha = page.locator('li', { has: page.getByText('processo.ver', { exact: true }) });
    await expect(linha).toContainText('Equipe de Regulação › Leitor');
});

test('negar individualmente vence a permissão que o papel dava', async ({ page }) => {
    const state = await installIamApi(page, (s) => {
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/usuarios/u-ana');

    await page.getByRole('button', { name: 'Adicionar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ação').selectOption('processo.ver');
    await dialog.getByRole('button', { name: 'Negar' }).click();
    await dialog.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page.getByText('processo.ver', { exact: true }).first()).toBeVisible();
    expect(state.individual['u-ana']).toEqual([{ action: 'processo.ver', effect: 'deny' }]);

    // Negado deixa de ser um acesso: some do filtro "só o que pode".
    const concedidas = page.locator('li', { has: page.getByText('processo.ver', { exact: true }) });
    await expect(concedidas).toHaveCount(0);
});

test('o curinga aparece como curinga, não como a ação que ele expandiu', async ({ page }) => {
    await installIamApi(page, (s) => {
        s.roles.push({
            id: 'r-curinga',
            key: 'e2e-curinga',
            name: 'Curinga de processos',
            description: '',
            is_system: false,
            permissions: ['processo.*'],
        });
        s.userRoles['u-ana'] = ['r-curinga'];
    });
    await page.goto('/admin/acessos/usuarios/u-ana');

    const linha = page.locator('li', { has: page.getByText('processo.criar', { exact: true }) });
    await expect(linha).toContainText('(processo.*)');
});

test('tirar o próprio acesso pede confirmação antes de valer', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/usuarios/u-admin');

    // Uma negação individual em si mesmo — fora do IAM, senão é LAST_ADMIN.
    await page.getByRole('button', { name: 'Adicionar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ação').selectOption('arquivo.excluir');
    await dialog.getByRole('button', { name: 'Negar' }).click();
    await dialog.getByRole('button', { name: 'Aplicar' }).click();

    const confirmar = page.getByRole('dialog', { name: 'Isto tira o seu próprio acesso' });
    await expect(confirmar).toBeVisible();
    expect(state.individual['u-admin']).toEqual([]);

    await confirmar.getByRole('button', { name: 'Entendi, prosseguir' }).click();
    await expect(confirmar).toHaveCount(0);
    expect(state.individual['u-admin']).toEqual([{ action: 'arquivo.excluir', effect: 'deny' }]);
});
