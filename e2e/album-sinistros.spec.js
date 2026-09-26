import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';
import { installSinistroApi, PROCESS_ID } from './fixtures/sinistro-api.js';

/**
 * O álbum de sinistros: um cartão por sinistro, com o que o dono quer ver de
 * relance — número, seguradora, completude, status, prazo e abertura — e o
 * cartão inteiro leva ao sinistro. O prazo vem da própria lista: nenhum
 * cartão pode buscar nada sozinho.
 */

const deadline = (remainingDays, extra = {}) => ({ totalDays: 30, remainingDays, isSuspended: false, suspensionCount: 0, history: [], ...extra });

async function openAlbum(page, mutate) {
    await signIn(page, 'manager', { token: 'e2e-token' });
    const state = await installSinistroApi(page, (s) => {
        s.processes[0].metadata.deadline = deadline(3);
        s.processes[1].metadata.deadline = deadline(8);
        s.processes[2].metadata.deadline = deadline(20, { isSuspended: true });
        if (mutate) mutate(s);
    });
    await page.goto('/app/sinistros');
    await expect(page.getByTestId('album-card')).toHaveCount(3);
    return state;
}

test('cada cartão mostra número, título, seguradora, completude, status, prazo e abertura', async ({ page }) => {
    const state = await openAlbum(page);
    const card = page.getByTestId('album-card').filter({ hasText: 'SD - 2026-0101' });

    await expect(card).toContainText('Incêndio galpão');
    await expect(card).toContainText('Allianz');
    await expect(card.getByTestId('album-progress')).toHaveText('40%');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    await expect(card).toContainText('Aberto em');
    await expect(card).toContainText('01/09/2026');

    // Prazo curto em vermelho, médio em âmbar, suspenso dito.
    await expect(card.getByTestId('album-prazo')).toHaveText('3 dias');
    await expect(card.getByTestId('album-prazo')).toHaveClass(/text-red-600/);
    const roubo = page.getByTestId('album-card').filter({ hasText: 'SD - 2026-0102' });
    await expect(roubo.getByTestId('album-prazo')).toHaveClass(/text-amber-600/);
    await expect(page.getByTestId('album-card').filter({ hasText: 'SD - 2026-0103' }).getByTestId('album-prazo')).toHaveText('Suspenso');

    // Nenhuma busca por cartão.
    expect(state.requests.filter((r) => /\/processes\/[^/?]+/.test(r.path))).toEqual([]);
});

test('o cartão inteiro leva ao sinistro', async ({ page }) => {
    await openAlbum(page);
    await page.getByTestId('album-card').filter({ hasText: 'SD - 2026-0101' }).click();
    await expect(page).toHaveURL(new RegExp(`/app/sinistros/${PROCESS_ID}$`));
});

test('busca, abas e atualizar continuam; o filtro de responsável sumiu', async ({ page }) => {
    const state = await openAlbum(page);
    await expect(page.getByRole('button', { name: /Atribuídos a mim/ })).toHaveCount(0);
    expect(state.requests.some((r) => r.path.includes('assigned_to'))).toBe(false);

    await page.getByPlaceholder(/Buscar por número/).fill('Roubo');
    await expect(page.getByTestId('album-card')).toHaveCount(1);
    await page.getByPlaceholder(/Buscar por número/).fill('nada disso');
    await expect(page.getByText('Nenhum resultado encontrado')).toBeVisible();
    await page.getByRole('button', { name: 'Redefinir Filtros' }).click();
    await expect(page.getByTestId('album-card')).toHaveCount(3);

    const before = state.requests.filter((r) => r.path.startsWith('/api/v1/processes?')).length;
    state.processes.push({ ...state.processes[0], id: '55555555-5555-4555-8555-555555555555', title: 'Queda de marquise', metadata: { number: '2026-0104', insurer: 'Mapfre', progress: 0 } });
    await page.getByRole('button', { name: 'Atualizar lista de sinistros' }).click();
    await expect(page.getByTestId('album-card')).toHaveCount(4);
    expect(state.requests.filter((r) => r.path.startsWith('/api/v1/processes?')).length).toBeGreaterThan(before);

    await page.getByRole('button', { name: /Concluídos/ }).click();
    await expect.poll(() => state.requests.some((r) => r.path.startsWith('/api/v1/processes?') && r.path.includes('status=done'))).toBe(true);
});

test('em 360px os cartões ficam em uma coluna, sem vazar para o lado', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openAlbum(page);
    const xs = await page.getByTestId('album-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
