import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * A página do sinistro na variante C: cartão lateral com identidade e números,
 * e abas à direita. Roda no modo mock — o sinistro 2024-001 dos fixtures.
 */

const CLAIM = '/app/sinistros/1';

test('o cartão lateral mostra identidade, criador e os números do sinistro', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const card = page.getByTestId('claim-card');
    await expect(card.getByRole('heading', { name: 'SD - 2024-001' })).toBeVisible();
    await expect(card).toContainText('Em Análise');
    await expect(card).toContainText('Porto Seguro');
    await expect(page.getByTestId('claim-creator')).toContainText('Criado por Ricardo Silva');
    await expect(page.getByTestId('claim-creator')).toContainText('ricardo@corretora.com');
    await expect(card).toContainText('Conclusão');
    await expect(card).toContainText('72%');
    await expect(card).toContainText('Data de abertura');
    await expect(page.getByTestId('claim-storage')).toContainText(/\d+(\.\d)? (B|KB|MB|GB)/);
});

test('a última atividade leva à aba de auditoria', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const last = page.getByTestId('claim-last-activity');
    await expect(last).toContainText('Ana Souza');
    await last.getByRole('button', { name: 'ver auditoria' }).click();
    await expect(page.getByRole('tab', { name: 'Auditoria' })).toHaveAttribute('aria-selected', 'true');
});

test('sem processo.verAuditoria não há aba de auditoria nem última atividade', async ({ page }) => {
    await signIn(page, 'contributor');
    await page.goto(CLAIM);

    await expect(page.getByRole('tab', { name: /^Causa \(\d+%\)$/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Auditoria' })).toHaveCount(0);
    await expect(page.getByTestId('claim-last-activity')).toHaveCount(0);
});

test('uma aba por pasta, com o seletor de modo só dentro das pastas', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const tabs = page.getByRole('tablist', { name: 'Seções do sinistro' }).getByRole('tab');
    await expect(tabs).toHaveText([
        /^Causa \(80%\)$/, /^Prejuízo \(60%\)$/, /^Liquidação \(0%\)$/,
        /Documentos avulsos/, /Gerencial/, /Auditoria/,
    ]);
    await expect(page.getByRole('tab', { name: /^Causa/ })).toHaveAttribute('aria-selected', 'true');

    const modes = page.getByRole('group', { name: 'Modo de visualização' });
    await expect(modes.getByRole('button')).toHaveText(['Checklist', 'Decks', 'Gerenciamento']);

    await page.getByRole('tab', { name: /^Prejuízo/ }).click();
    await expect(page.getByRole('tab', { name: /^Prejuízo/ })).toHaveAttribute('aria-selected', 'true');
    await expect(modes).toBeVisible();

    await page.getByRole('tab', { name: 'Gerencial' }).click();
    await expect(page.getByTestId('gerencial-tree')).toBeVisible();
    await expect(modes).toHaveCount(0);
});

test('abaixo de 1024px as colunas empilham, sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const card = await page.getByTestId('claim-card').boundingBox();
    const tabs = await page.getByRole('tablist', { name: 'Seções do sinistro' }).boundingBox();
    expect(tabs.y).toBeGreaterThan(card.y + card.height);
    expect(card.x + card.width).toBeLessThanOrEqual(360);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
