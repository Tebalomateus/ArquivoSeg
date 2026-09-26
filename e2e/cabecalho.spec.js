import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * O cabeçalho do portal, sem a barra lateral: as duas abas à esquerda, a marca
 * no centro levando ao dashboard, sino e perfil à direita — e um "Sair" só,
 * dentro do menu do perfil.
 */

test('as abas marcam onde a pessoa está e a marca volta ao dashboard', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros');

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Meus Sinistros' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: /ArquivoSeg/ }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
});

test('o único "Sair" está no menu do perfil', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto('/app');

    await expect(page.getByText('Sair do Sistema')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0);

    await page.getByTestId('profile-menu-trigger').click();
    await page.getByTestId('profile-menu').getByRole('menuitem', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);
});

test('a 360px o cabeçalho cabe sem rolagem lateral e os painéis ficam na tela', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, 'manager');
    await page.goto('/app');

    await expect(page.getByRole('link', { name: 'Meus Sinistros' })).toBeVisible();
    // O cabeçalho em si não pode passar da largura: é ele que a pessoa vê primeiro.
    const header = await page.locator('header').first().evaluate((el) => el.firstElementChild.scrollWidth - el.firstElementChild.clientWidth);
    expect(header).toBeLessThanOrEqual(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByTestId('profile-menu-trigger').click();
    const box = await page.getByTestId('profile-menu').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Notificações' }).click();
    const panel = page.getByText('Ver todas as notificações').locator('..');
    const pbox = await panel.boundingBox();
    expect(pbox.x).toBeGreaterThanOrEqual(0);
    expect(pbox.x + pbox.width).toBeLessThanOrEqual(360);
});
