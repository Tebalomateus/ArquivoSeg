import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';
import { installDeckApi } from './fixtures/deck-api.js';

/**
 * Abertura com a API: o tipo de sinistro vem de GET /checklists (com o título
 * em `items`) e de GET /checklists/{tipo}; ao criar, as etapas editadas vão
 * em metadata.folders, uma pasta por etapa mais a Gerencial privada, com o
 * claim_type e o disclaimer.
 */

const RCG = {
    type: 'rcg_obras',
    title: 'RCG Obras',
    version: '1',
    stages: [
        { id: 'documentacao', title: 'Documentação', items: [
            { id: 'contrato', label: 'Contrato da obra', required: true },
            { id: 'art', label: 'ART do responsável', required: false },
        ] },
        { id: 'danos', title: 'Danos', items: [
            { id: 'fotos', label: 'Fotos dos danos', required: true },
        ] },
    ],
};

const abrir = async (page, mutate) => {
    await signIn(page, 'contributor', { token: 'e2e-token' });
    const state = await installDeckApi(page, (s) => {
        s.permissions = [...s.permissions, 'processo.criar', 'processo.editar'];
        mutate?.(s);
    });
    await page.goto('/app/sinistros/novo');
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toBeVisible();
    return state;
};

test('o tipo do servidor vira as pastas do sinistro criado', async ({ page }) => {
    const state = await abrir(page, (s) => {
        s.claimTypes = [{ type: 'rcg_obras', title: 'RCG Obras' }, { type: 'auto', title: 'Automóvel' }];
        s.checklistDef = RCG;
    });

    await expect(page.locator('#campo-claimType option')).toHaveText(['Selecione o tipo...', 'RCG Obras', 'Automóvel']);
    // Sem o padrão na lista e com mais de um tipo, ninguém escolhe pela pessoa.
    await expect(page.locator('#campo-claimType')).toHaveValue('');
    await page.locator('#campo-claimType').selectOption('rcg_obras');
    await expect(page.getByTestId('claim-steps').locator('ol > li h4')).toHaveText(['Documentação', 'Danos']);

    await page.locator('#campo-claimNumber').fill('2026-990');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
    await page.locator('#campo-disclaimer').fill('Obra embargada.');
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();

    await expect(page).toHaveURL(/\/app\/sinistros\/22222222-/);
    const post = state.requests.find((r) => r.method === 'POST' && r.path === '/api/v1/processes');
    expect(post.body.claim_type).toBe('rcg_obras');
    expect(post.body.metadata.disclaimer).toBe('Obra embargada.');
    const folders = post.body.metadata.folders.map(({ checklist, ...f }) => ({
        ...f, checklist: checklist.map(({ createdAt, ...i }) => ({ ...i, createdAt: typeof createdAt })),
    }));
    expect(folders).toEqual([
        { id: 'documentacao', name: 'Documentação', category: 'documentacao', completion: 0, checklist: [
            { id: 'contrato', name: 'Contrato da obra', required: true, received: false, createdAt: 'string' },
            { id: 'art', name: 'ART do responsável', required: false, received: false, createdAt: 'string' },
        ] },
        { id: 'danos', name: 'Danos', category: 'danos', completion: 0, checklist: [
            { id: 'fotos', name: 'Fotos dos danos', required: true, received: false, createdAt: 'string' },
        ] },
        { id: 'gerencial', name: 'Gerencial', category: 'gerencial', completion: 0, private: true, checklist: [] },
    ]);

    await expect(page.getByTestId('step-selector').getByRole('tab')).toHaveText([/^Documentação/, /^Danos/]);
    await expect(page.getByRole('note', { name: 'Disclaimer' })).toHaveText('Obra embargada.');
});

test('sem tipo cadastrado, o padrão embutido abre o sinistro', async ({ page }) => {
    const state = await abrir(page);

    await expect(page.locator('#campo-claimType option')).toHaveText(['Selecione o tipo...', 'Padrão']);
    await expect(page.locator('#campo-claimType')).toHaveValue('padrao');
    await expect(page.getByTestId('claim-steps').locator('ol > li h4')).toHaveText(['Causa', 'Prejuízo', 'Liquidação']);

    await page.locator('#campo-claimNumber').fill('2026-991');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();

    await expect(page).toHaveURL(/\/app\/sinistros\/22222222-/);
    const post = state.requests.find((r) => r.method === 'POST' && r.path === '/api/v1/processes');
    expect(post.body.metadata.folders.map((f) => f.id)).toEqual(['causa', 'prejuizo', 'liquidacao', 'gerencial']);
    expect(post.body.metadata.folders[0].checklist.map((i) => i.id)).toContain('procuracao');
});
