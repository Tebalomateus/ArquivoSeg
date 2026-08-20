import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * Para onde o app manda a pessoa.
 *
 * Duas famílias de erro, e as duas terminam do mesmo jeito: alguém aparece no
 * dashboard sem ter pedido.
 *
 * A primeira é o ".." relativo. Ele sobe um nível de *rota*, não de URL, e
 * "sinistros/:id" é um segmento de rota só — então o voltar do detalhe, que diz
 * "Lista de Sinistros", ia parar no dashboard.
 *
 * A segunda é o portão que decide antes da resposta. can() responde "não" até a
 * API responder qualquer coisa, e um portão que lê esse "não" expulsa da página
 * quem podia vê-la. Aparece a cada F5 e em todo link colado.
 *
 * Roda no modo mock, onde as permissões vêm das personas — o que se afirma aqui
 * é o destino, não quem pode o quê.
 */

test('quem pode criar abre o formulário pelo link direto, sem passar pela lista', async ({ page }) => {
    // O deep-link é o caso: o portão resolvia antes das permissões e devolvia
    // para a lista, então recarregar a página do formulário perdia o formulário.
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros/novo');

    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
});

test('quem não pode criar volta para a lista, e não para o dashboard', async ({ page }) => {
    await signIn(page, 'viewer');
    await page.goto('/app/sinistros/novo');

    await expect(page).toHaveURL(/\/app\/sinistros$/);
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toHaveCount(0);
});

test('o voltar do sinistro leva à lista, que é o que ele promete', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros');

    await page.getByRole('link', { name: 'Novo Sinistro' }).click();
    await page.locator('#campo-claimNumber').fill('2026-ROTA');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();

    // Criar já leva ao sinistro recém-criado, e não à página inicial. E o id na
    // URL precisa ser o id: sem o await no addClaim ele virava "[object
    // Promise]", que casa com a URL e abre "Sinistro não encontrado".
    await expect(page).toHaveURL(/\/app\/sinistros\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'SD - 2026-ROTA' })).toBeVisible();

    await page.getByRole('link', { name: 'Lista de Sinistros' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros$/);
});

test('o voltar de configurações dá no dashboard do portal', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/configuracoes');

    await page.getByRole('link', { name: 'Voltar ao Dashboard' }).click();
    await expect(page).toHaveURL(/\/app$/);
});

test('o login devolve a pessoa ao link que ela abriu', async ({ page }) => {
    // Sem sessão: o portão manda para o login e guarda para onde ela ia.
    await page.goto('/app/sinistros');
    await expect(page).toHaveURL(/\/login$/);

    await page.locator('#email').fill('ana.souza@allianz.com');
    await page.locator('#password').fill('qualquer-coisa');
    await page.getByRole('button', { name: 'Acessar Painel' }).click();

    await expect(page).toHaveURL(/\/app\/sinistros$/);
});

test('o login sem destino guardado cai no portal certo', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('ana.souza@allianz.com');
    await page.locator('#password').fill('qualquer-coisa');
    await page.getByRole('button', { name: 'Acessar Painel' }).click();

    await expect(page).toHaveURL(/\/app$/);
});
