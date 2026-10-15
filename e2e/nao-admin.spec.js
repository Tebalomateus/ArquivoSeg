import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * A gestão do tenant (/app/acessos e vizinhas) é gateada no isAdmin do Zitadel, e não numa permissão do
 * próprio IAM: é a tela que conserta uma configuração quebrada, então depender
 * do dado que ela edita é como um tenant se tranca fora de si mesmo.
 *
 * O teste, então, é dos dois lados: quem não é admin não vê o caminho, e forçar
 * a URL não é caminho.
 */

for (const persona of ['viewer', 'contributor', 'manager']) {
    test(`${persona} não alcança a área administrativa`, async ({ page }) => {
        await signIn(page, persona);

        await page.goto('/app/acessos/papeis');
        await expect(page).toHaveURL(/\/app$/);

        // O caminho antigo do backoffice também não é caminho.
        await page.goto('/admin/acessos/papeis');
        await expect(page).toHaveURL(/\/app$/);

        await expect(page.getByRole('button', { name: 'Gestão' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Acessos' })).toHaveCount(0);
    });
}

test('o admin fica no mesmo portal de todo mundo, com a gestão no cabeçalho', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/');
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole('button', { name: 'Gestão' }).click();
    await page.getByRole('menuitem', { name: 'Usuários e Acessos' }).click();
    await expect(page).toHaveURL(/\/app\/acessos\/usuarios$/);
});

test('os links antigos do backoffice levam à mesma tela no portal', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/audit?actor_user_id=u-1');
    await expect(page).toHaveURL(/\/app\/audit\?actor_user_id=u-1$/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/app$/);
});
