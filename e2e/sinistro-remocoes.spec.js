import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * O que saiu da página do sinistro, e que não pode voltar por engano.
 *
 * Upload avulso fora do board, responsável, "sinistro complexo" e as
 * transições manuais de status eram caminhos paralelos ao fluxo de decks —
 * cada um mudava o estado do sinistro sem passar por ele. Do painel de status
 * só sobra arquivar.
 *
 * O sino também deixou de consultar /audit em loop: para quem não pode ler a
 * auditoria era um 403 por minuto, em cada aba aberta.
 */

const CLAIM = '/app/sinistros/1';

test('a página do sinistro não oferece mais os caminhos paralelos ao board', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await expect(page.getByRole('heading', { name: 'SD - 2024-001' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Upload Seguro' })).toHaveCount(0);
    await expect(page.getByText('Alta Complexidade')).toHaveCount(0);
    await expect(page.getByText('Audit Trail Recente')).toHaveCount(0);

    await page.getByRole('button', { name: 'Gerenciamento' }).click();
    await expect(page.getByText('Workflow do Sinistro')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Avançar para/ })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Sinistro complexo/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Responsável' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adicionar Colaborador' })).toHaveCount(0);
    // O corretor não arquiva: o painel diz isso em vez de mostrar um botão morto.
    await expect(page.getByRole('button', { name: 'Arquivar' })).toHaveCount(0);
    await expect(page.getByText('Seu perfil não pode arquivar sinistros.')).toBeVisible();
});

test('quem pode arquivar vê só o Arquivar no painel de status', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/sinistros/1');
    await page.getByRole('button', { name: 'Gerenciamento' }).click();

    await expect(page.getByRole('button', { name: 'Arquivar' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Avançar para/ })).toHaveCount(0);
});

test('o sino não consulta a auditoria de quem não pode lê-la', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (r.url().includes('/api/v1/audit')) calls.push(r.url()); });
    await signIn(page, 'contributor');
    await page.goto(CLAIM);
    await expect(page.getByRole('heading', { name: 'SD - 2024-001' })).toBeVisible();
    await page.getByRole('button', { name: 'Notificações' }).click();
    await expect(page.getByText('Ver todas as notificações')).toBeVisible();

    expect(calls).toEqual([]);
});

test('o sino não fica consultando a auditoria em intervalo', async ({ page }) => {
    await page.clock.install();
    const calls = [];
    // Responde vazio: no modo mock não há API, e o que importa é a contagem.
    await page.route('**/api/v1/audit**', (r) => {
        calls.push(r.request().url());
        return r.fulfill({ json: { data: [], total: 0 } });
    });
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await expect(page.getByRole('heading', { name: 'SD - 2024-001' })).toBeVisible();
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    const depoisDeAbrir = calls.length;

    await page.clock.fastForward('05:00');
    await page.waitForTimeout(300);
    expect(calls.length).toBe(depoisDeAbrir);
});
