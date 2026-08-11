import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

/**
 * O ciclo de vida da conta mora dentro de Acessos desde que Gestão de Usuários
 * foi absorvida. O que se testa aqui é justamente a costura: convidar entra na
 * mesma lista que decide papéis, e desativar acontece na tela da pessoa.
 */
test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

test('convidar alguém já com papel, sem sair da tela de acessos', async ({ page }) => {
    const state = await installIamApi(page);
    await page.goto('/admin/acessos/usuarios');

    await page.getByRole('button', { name: 'Convidar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Convidar usuário' });
    await dialog.getByLabel('E-mail').fill('novo.perito@arquivoseg.com.br');
    await dialog.getByRole('checkbox', { name: /Leitor/ }).check();
    await dialog.getByRole('button', { name: 'Enviar convite' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Convite enviado para novo.perito@arquivoseg.com.br')).toBeVisible();

    const criado = state.users.find((u) => u.email === 'novo.perito@arquivoseg.com.br');
    expect(criado.status).toBe('invited');
    expect(state.userRoles[criado.id]).toEqual(['r-leitor']);

    // E aparece na lista, com o convite pendente à vista.
    await expect(page.getByRole('link', { name: /novo\.perito@arquivoseg\.com\.br/ })).toContainText('invited');
});

test('quem foi convidado recebe reenvio; quem já entrou, recuperação de acesso', async ({ page }) => {
    await installIamApi(page);

    await page.goto('/admin/acessos/usuarios/u-maria'); // status: invited
    await expect(page.getByRole('button', { name: 'Reenviar convite' })).toBeVisible();

    await page.goto('/admin/acessos/usuarios/u-ana'); // status: active
    await expect(page.getByRole('button', { name: 'Recuperar acesso' })).toBeVisible();
});

test('desativar a conta confirma antes e não some com o acesso configurado', async ({ page }) => {
    const state = await installIamApi(page, (s) => {
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/usuarios/u-ana');

    await page.getByRole('button', { name: 'Desativar conta' }).click();
    const confirmar = page.getByRole('dialog', { name: 'Desativar esta conta' });
    await expect(confirmar).toBeVisible();
    await confirmar.getByRole('button', { name: 'Desativar', exact: true }).click();

    await expect(page.getByText('Conta desativada.')).toBeVisible();
    expect(state.users.find((u) => u.id === 'u-ana').status).toBe('inactive');
    // Desativar é sobre entrar, não sobre poder: reativar devolve o mesmo acesso.
    expect(state.userRoles['u-ana']).toEqual(['r-leitor']);
});

test('a própria conta não oferece o botão de desativar', async ({ page }) => {
    await installIamApi(page);
    await page.goto('/admin/acessos/usuarios/u-admin');

    await expect(page.getByRole('button', { name: 'Recuperar acesso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desativar conta' })).toHaveCount(0);
});

test('a rota antiga de gestão de usuários leva para a aba de usuários', async ({ page }) => {
    await installIamApi(page);
    await page.goto('/admin/usuarios');

    await expect(page).toHaveURL(/\/admin\/acessos\/usuarios$/);
});
