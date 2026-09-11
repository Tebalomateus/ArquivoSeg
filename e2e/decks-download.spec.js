import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, archiveFor, PROCESS_ID, TASK } from './fixtures/deck-api.js';

/**
 * "Baixar todos os arquivos": o deck inteiro num zip.
 *
 * O servidor monta o zip enquanto responde (handler/deck_archive.go) — não há
 * nada empacotado guardado, então não existe passo de "preparando". O que cabe
 * ao front é: pedir com o Bearer (um <a href> sai sem cabeçalho e volta 401),
 * entregar os bytes ao navegador sem mexer neles, e sumir com o botão quando a
 * permissão não está lá.
 */

const dockArchive = (state) => archiveFor(state, state.board.decks[0].id);

const doisArquivos = [
    { nome: 'laudo.pdf', conteudo: 'conteúdo do laudo' },
    { nome: 'foto da frente.jpg', conteudo: 'bytes da foto' },
];

test('baixa o deck inteiro com o nome que o servidor deu', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos }),
    });

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Baixar todos' }).click(),
    ]);

    // O nome vem do Content-Disposition, não de um palpite do front: várias
    // baixas seguidas não podem virar "download.zip" repetido.
    expect(download.suggestedFilename()).toBe('DECK-01.zip');

    const salvo = readFileSync(await download.path());
    expect(salvo.equals(dockArchive(state))).toBe(true);
    expect(salvo.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');

    const pedido = state.requests.find((r) => r.path === `/api/v1/processes/${PROCESS_ID}/decks/${state.board.decks[0].id}/arquivos.zip`);
    expect(pedido.authorization).toBe('Bearer e2e-token');
});

test('sem deck.baixarArquivos o botão não existe', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'deck.baixarArquivos');
            seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos });
        },
    });

    const deck = page.getByTestId('deck-DECK-01');
    // O deck está lá, com os arquivos listados um a um: o que sumiu é só levar
    // tudo de uma vez.
    await expect(deck).toContainText('laudo.pdf');
    await expect(deck.getByRole('button', { name: 'Baixar todos' })).toHaveCount(0);
});

test('o analista baixa tudo de dentro da própria análise', async ({ page }) => {
    const state = await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos, status: 'enviado' }),
    });

    await page.getByTestId('column-enviado').getByRole('button', { name: 'Analisar documentos' }).click();
    const modal = page.getByTestId('analysis-modal');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        modal.getByRole('button', { name: 'Baixar todos os arquivos' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('DECK-01.zip');
    expect(readFileSync(await download.path()).equals(dockArchive(state))).toBe(true);
    // Baixar é conferir, não decidir: a análise continua aberta.
    await expect(modal).toBeVisible();
});

test('recusa do servidor aparece como erro, e nada é baixado', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            seedDeck(s, { tarefaIds: [TASK.bo], arquivos: doisArquivos });
            // Um documento que já foi para o GLACIER, por exemplo: o servidor
            // prefere recusar antes do primeiro byte a entregar um zip furado.
            s.failArchive = {
                status: 422,
                code: 'FILE_UNAVAILABLE',
                message: 'a file attached to this deck is not available in storage',
            };
        },
    });

    let baixou = false;
    page.on('download', () => { baixou = true; });

    const aviso = page.waitForEvent('dialog').then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Baixar todos' }).click();

    expect(await aviso).toContain('Falha ao baixar os arquivos do deck');
    expect(await aviso).toContain('not available in storage');
    expect(baixou).toBe(false);
    // E o botão volta ao normal — a falha não deixa o deck preso em "Baixando".
    await expect(page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Baixar todos' })).toBeEnabled();
});

test('deck sem arquivo nenhum não oferece o download', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            const deck = seedDeck(s, { tarefaIds: [TASK.bo] });
            deck.arquivos = [];
        },
    });

    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('1 tarefa · 0 arquivos');
    await expect(deck.getByRole('button', { name: 'Baixar todos' })).toHaveCount(0);
});
