import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';
import { mountComponent } from './fixtures/mount.js';
import { installSinistroApi, PROCESS_ID, manyEvents } from './fixtures/sinistro-api.js';

/**
 * A trilha de auditoria do sinistro, contra a API falsa.
 *
 * O que ela promete ao dono: uma raia por pessoa, com uma cor que é só dela,
 * e cada ação dita em português. O resto — filtros, paginação, 403 — é o que
 * impede a tela de mentir quando a resposta não é a feliz.
 */

async function openTrail(page, mutate) {
    await signIn(page, 'manager', { token: 'e2e-token' });
    const state = await installSinistroApi(page, mutate);
    await mountComponent(page, 'ClaimAuditTrail', { processId: PROCESS_ID });
    await expect(page.getByTestId('audit-graph')).toBeVisible();
    return state;
}

test('cada pessoa ganha uma raia e uma cor, e o acesso externo fica na raia neutra', async ({ page }) => {
    await openTrail(page);

    const rows = page.getByTestId('audit-event');
    await expect(rows).toHaveCount(9);
    // Mais novo em cima.
    await expect(rows.first()).toContainText('Deck analisado');
    await expect(rows.last()).toContainText('Sinistro criado');

    // Três pessoas e o externo: quatro raias, na ordem em que aparecem de cima para baixo.
    await expect(page.getByTestId('audit-graph')).toHaveAttribute('data-lanes', '4');
    await expect(rows.nth(0)).toHaveAttribute('data-lane', '0');
    await expect(rows.nth(1)).toHaveAttribute('data-actor', 'externo');
    await expect(rows.nth(1)).toContainText('Acesso externo');

    // Mesma pessoa, mesma raia.
    const anaLanes = await page.locator('[data-testid="audit-event"][data-actor="u-ana"]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.lane))]);
    expect(anaLanes).toHaveLength(1);

    // Cores distintas na legenda.
    const legend = page.getByTestId('audit-legend');
    const colors = await legend.locator('[data-color]').evaluateAll((els) => els.map((e) => e.dataset.color));
    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
    await expect(legend).toContainText('Ana Souza');
    // Sem nome, o e-mail.
    await expect(legend).toContainText('ricardo@corretora.com');
});

test('as ações são frases, com o detalhe do metadata, e código desconhecido aparece cru', async ({ page }) => {
    await openTrail(page);
    const rows = page.getByTestId('audit-event');

    const prazo = rows.filter({ hasText: 'Prazo ajustado' });
    await expect(prazo).toContainText('Vencimento');
    await expect(prazo).toContainText('01/10/2026 → 15/10/2026');
    await expect(prazo).toContainText('Prorrogação pedida pelo segurado.');

    await expect(rows.filter({ hasText: 'Documento enviado' }).first()).toContainText('laudo.pdf');
    await expect(rows.filter({ hasText: 'Documento enviado' }).first()).not.toContainText('causa__');
    // Aprovar e devolver são o mesmo deck.analyzed; o que muda é o metadata.
    const analises = rows.filter({ hasText: 'Deck analisado' });
    await expect(analises.first()).toContainText('tudo aceito');
    await expect(analises.filter({ hasText: 'Sem assinatura.' })).toContainText('1 tarefa devolvida');
    // O IP vem da coluna do log, não do metadata.
    await expect(rows.filter({ hasText: 'Link público acessado' })).toContainText('IP 10.0.0.9');
    await expect(rows.filter({ hasText: 'process.frobnicated' })).toHaveCount(1);
});

test('filtrar por pessoa e por ação vai para o servidor; o externo é recortado aqui', async ({ page }) => {
    const state = await openTrail(page);

    await page.getByLabel('Filtrar por pessoa').selectOption({ label: 'Ana Souza' });
    await expect(page.getByTestId('audit-event')).toHaveCount(3);
    expect(state.requests.some((r) => r.path.includes('actor_user_id=u-ana'))).toBe(true);
    // A legenda não encolhe com o filtro.
    await expect(page.getByTestId('audit-legend').locator('li')).toHaveCount(4);

    await page.getByLabel('Filtrar por pessoa').selectOption({ label: 'Acesso externo' });
    await expect(page.getByTestId('audit-event')).toHaveCount(1);
    await expect(page.getByTestId('audit-event')).toHaveAttribute('data-actor', 'externo');

    await page.getByLabel('Filtrar por pessoa').selectOption('');
    await page.getByLabel('Filtrar por tipo de ação').selectOption('file.uploaded');
    await expect(page.getByTestId('audit-event')).toHaveCount(2);
    expect(state.requests.some((r) => r.path.includes('action=file.uploaded'))).toBe(true);

    // Só as ações que o servidor emite: aprovar/recusar/devolver não existem.
    const tipos = await page.getByLabel('Filtrar por tipo de ação').locator('option').evaluateAll((os) => os.map((o) => o.value));
    expect(tipos).toContain('deck.analyzed');
    expect(tipos).not.toContain('deck.approved');
    expect(tipos).not.toContain('deck.returned');
    expect(tipos).not.toContain('deck.rejected');

    await page.getByLabel('Filtrar por tipo de ação').selectOption('comment.deleted');
    await expect(page.getByTestId('audit-empty')).toContainText('Nenhum evento com esses filtros.');
});

test('carrega de 50 em 50 e só busca de novo quando pedem', async ({ page }) => {
    const state = await openTrail(page, (s) => { s.audit = manyEvents(62); });
    await expect(page.getByTestId('audit-event')).toHaveCount(50);
    expect(state.requests.filter((r) => r.path.includes('/audit')).at(-1).path).toContain('limit=50');

    await page.getByRole('button', { name: /Carregar mais \(12\)/ }).click();
    await expect(page.getByTestId('audit-event')).toHaveCount(62);
    await expect(page.getByRole('button', { name: /Carregar mais/ })).toHaveCount(0);

    // Sem polling: nada novo enquanto ninguém pede.
    const before = state.requests.filter((r) => r.path.includes('/audit')).length;
    await page.waitForTimeout(1500);
    expect(state.requests.filter((r) => r.path.includes('/audit')).length).toBe(before);

    state.audit = manyEvents(3);
    await page.getByRole('button', { name: 'Atualizar trilha de auditoria' }).click();
    await expect(page.getByTestId('audit-event')).toHaveCount(3);
});

test('sem eventos, diz que não há; com 403, diz que não pode', async ({ page }) => {
    const state = await openTrail(page);

    state.audit = [];
    await page.getByRole('button', { name: 'Atualizar trilha de auditoria' }).click();
    await expect(page.getByTestId('audit-empty')).toContainText('Nenhum evento registrado neste sinistro ainda.');

    state.failAudit = { status: 403, code: 'INSUFFICIENT_PERMISSION', message: 'insufficient permission' };
    await page.getByRole('button', { name: 'Atualizar trilha de auditoria' }).click();
    await expect(page.getByText('Você não tem permissão para ver a auditoria deste sinistro.')).toBeVisible();
    await expect(page.getByTestId('audit-graph')).toHaveCount(0);
    await expect(page.getByLabel('Filtrar por pessoa')).toHaveCount(0);
});

test('erro do servidor oferece tentar de novo', async ({ page }) => {
    await signIn(page, 'manager', { token: 'e2e-token' });
    const state = await installSinistroApi(page, (s) => { s.failAudit = { status: 500, code: 'INTERNAL_ERROR', message: 'banco fora' }; });
    await mountComponent(page, 'ClaimAuditTrail', { processId: PROCESS_ID });

    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a auditoria.');
    state.failAudit = null;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByTestId('audit-event')).toHaveCount(9);
});

test('em 360px as raias se estreitam e nada vaza para o lado', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openTrail(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const graphWidth = await page.getByTestId('audit-event').first().locator('div[aria-hidden="true"]').evaluate((el) => el.getBoundingClientRect().width);
    // 4 raias × 12px + folga.
    expect(graphWidth).toBeLessThanOrEqual(60);
});
