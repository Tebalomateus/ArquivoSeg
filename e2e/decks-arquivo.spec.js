import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, PROCESS_ID, TASK } from './fixtures/deck-api.js';

/**
 * Um arquivo de cada vez, direto do cartão do deck: ver, baixar e compartilhar.
 *
 * Antes só a análise dava acesso aos arquivos — e quem sobe o documento não
 * tem essa porta. Baixar segue `arquivo.baixar`, a mesma permissão do
 * repositório; compartilhar cria um link público e segue
 * `compartilhamento.criar`. Sem a permissão o botão não existe, o arquivo
 * continua listado.
 */

const doisArquivos = [
    { nome: 'laudo.pdf', conteudo: 'conteúdo do laudo' },
    { nome: 'foto da frente.jpg', conteudo: 'bytes da foto' },
];

test('baixa um arquivo do deck, com o Bearer e sem seguir o 302', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos }),
    });
    const foto = state.files.find((f) => f.file_name === 'foto da frente.jpg');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Baixar foto da frente.jpg' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('foto da frente.jpg');
    expect(readFileSync(await download.path()).equals(foto.content)).toBe(true);

    // A URL assinada vem em JSON: um fetch com Authorization não pode seguir
    // um redirect para outra origem.
    const pedido = state.requests.find((r) => r.path.startsWith(`/api/v1/files/${foto.id}/download`));
    expect(pedido.path).toBe(`/api/v1/files/${foto.id}/download?json=1`);
    expect(pedido.authorization).toBe('Bearer e2e-token');
});

test('sem arquivo.baixar o botão de baixar não existe, mas ver continua', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'arquivo.baixar');
            seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos });
        },
    });

    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('laudo.pdf');
    await expect(deck.getByRole('button', { name: 'Baixar laudo.pdf' })).toHaveCount(0);
    await expect(deck.getByRole('button', { name: 'Visualizar laudo.pdf' })).toBeVisible();
    await expect(deck.getByRole('button', { name: 'Compartilhar laudo.pdf' })).toBeVisible();
});

test('gera um link público para um arquivo do deck', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos }),
    });
    const laudo = state.files.find((f) => f.file_name === 'laudo.pdf');

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Compartilhar laudo.pdf' }).click();
    const modal = page.getByTestId('share-modal');
    await expect(modal).toContainText('laudo.pdf');

    await modal.getByLabel('Rótulo do link').fill('para a oficina');
    await modal.getByRole('button', { name: '7 dias' }).click();
    await modal.getByRole('button', { name: 'Gerar link' }).click();

    // O link é o mesmo da gestão do sinistro: /portal/:token, na origem do app.
    expect(state.shares).toHaveLength(1);
    const share = state.shares[0];
    expect(share.file_ver_id).toBe(laudo.id);
    expect(share.label).toBe('para a oficina');
    const expiraEm = (new Date(share.expires_at) - Date.now()) / 86400000;
    expect(expiraEm).toBeGreaterThan(6.9);
    expect(expiraEm).toBeLessThanOrEqual(7);

    await expect(modal.getByLabel('Link público')).toHaveValue(new RegExp(`/portal/${share.token}$`));
    await expect(modal.getByRole('button', { name: 'Copiar' })).toBeVisible();

    // Fechar não desfaz nada: o link ficou criado no servidor.
    await modal.getByRole('button', { name: 'Fechar' }).click();
    await expect(modal).toHaveCount(0);
    expect(state.shares).toHaveLength(1);
});

test('sem expiração o pedido vai sem expires_at', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }),
    });

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Compartilhar laudo.pdf' }).click();
    const modal = page.getByTestId('share-modal');
    await modal.getByRole('button', { name: 'Sem expiração' }).click();
    await modal.getByRole('button', { name: 'Gerar link' }).click();

    await expect(modal.getByLabel('Link público')).toBeVisible();
    const pedido = state.requests.find((r) => r.method === 'POST' && r.path.endsWith('/shares'));
    expect(pedido.body).toEqual({});
    await expect(modal).toContainText('expira sem expiração');
});

test('sem compartilhamento.criar o botão de compartilhar não existe', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'compartilhamento.criar');
            seedDeck(s, { tarefaIds: [TASK.bo] });
        },
    });

    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('laudo.pdf');
    await expect(deck.getByRole('button', { name: 'Compartilhar laudo.pdf' })).toHaveCount(0);
    await expect(deck.getByRole('button', { name: 'Baixar laudo.pdf' })).toBeVisible();
});

test('o analista baixa e compartilha um arquivo de dentro da análise', async ({ page }) => {
    const state = await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos, status: 'enviado' }),
    });
    const laudo = state.files.find((f) => f.file_name === 'laudo.pdf');

    await page.getByTestId('column-enviado').getByRole('button', { name: 'Analisar documentos' }).click();
    const modal = page.getByTestId('analysis-modal');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        modal.getByRole('button', { name: 'Baixar laudo.pdf' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('laudo.pdf');
    expect(readFileSync(await download.path()).equals(laudo.content)).toBe(true);
    // Baixar é conferir, não decidir: a análise continua aberta.
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Compartilhar laudo.pdf' }).click();
    await expect(page.getByTestId('share-modal')).toContainText('laudo.pdf');
});

test('arquivo atendido também se baixa: o deck aprovado não tranca o documento', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], status: 'atendido' }),
    });

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Baixar laudo.pdf' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('laudo.pdf');
    expect(readFileSync(await download.path()).equals(state.files[0].content)).toBe(true);
    expect(state.requests.some((r) => r.path.startsWith(`/api/v1/processes/${PROCESS_ID}/decks/`) && r.path.endsWith('arquivos.zip'))).toBe(false);
});
