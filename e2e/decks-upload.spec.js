import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, PROCESS_ID, TASK } from './fixtures/deck-api.js';

/**
 * O upload de arquivos do board.
 *
 * O que se está verificando não é o <input type=file>: é que os bytes chegam ao
 * servidor num multipart e que o deck passa a referenciar o id que o servidor
 * devolveu. O deck nunca guarda arquivo, só referência a file_versions — um deck
 * que aponte para um id inventado pelo front parece certo na tela e não abre
 * mais nada depois.
 */

const pdf = (name, body) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(body) });

async function uploadNaTarefa(page, key, files) {
    await page.getByTestId('column-pendente').getByTestId(`task-${key}`).click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(files);
    await modal.getByRole('button', { name: 'Confirmar' }).click();
    return modal;
}

test('o arquivo sobe por multipart e o deck referencia o id devolvido', async ({ page }) => {
    const state = await openBoard(page);

    await uploadNaTarefa(page, TASK.bo, pdf('bo.pdf', 'boletim de ocorrencia'));
    await expect(page.getByTestId('deck-DECK-01')).toContainText('bo.pdf');

    const upload = state.requests.find((r) => r.method === 'POST' && r.path === `/api/v1/processes/${PROCESS_ID}/files`);
    expect(upload).toBeTruthy();
    expect(upload.body.fileName).toBe('bo.pdf');
    expect(upload.body.content.toString()).toBe('boletim de ocorrencia');

    // A ponte que importa: o deck guarda o id do servidor, não um id local.
    expect(state.files).toHaveLength(1);
    expect(state.board.decks[0].arquivos[0].fileVerId).toBe(state.files[0].id);
});

test('vários arquivos numa tacada só entram no mesmo deck', async ({ page }) => {
    const state = await openBoard(page);

    await uploadNaTarefa(page, TASK.bo, [pdf('frente.pdf', 'frente'), pdf('verso.pdf', 'verso')]);

    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('1 tarefa · 2 arquivos');
    await expect(deck).toContainText('frente.pdf');
    await expect(deck).toContainText('verso.pdf');
    expect(state.board.decks[0].arquivos).toHaveLength(2);
});

test('"+ Arquivo" anexa a um deck que já existe, sem criar outro', async ({ page }) => {
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: '+ Arquivo' }).click();
    const modal = page.getByTestId('upload-modal');
    await expect(modal).toContainText('Adicionar arquivo ao DECK-01');
    await modal.locator('input[type=file]').setInputFiles(pdf('complemento.pdf', 'complemento'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByTestId('deck-DECK-01')).toContainText('1 tarefa · 2 arquivos');
    expect(state.board.decks).toHaveLength(1);
    expect(state.board.decks[0].arquivos.map((f) => f.nome)).toEqual(['laudo.pdf', 'complemento.pdf']);
});

test('remover um arquivo do deck tira a referência no servidor', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, {
            tarefaIds: [TASK.bo],
            arquivos: [{ nome: 'laudo.pdf' }, { nome: 'foto.pdf' }],
        }),
    });

    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Remover arquivo' }).first().click();

    await expect(deck).toContainText('1 tarefa · 1 arquivo');
    await expect(deck).not.toContainText('laudo.pdf');
    expect(state.board.decks[0].arquivos.map((f) => f.nome)).toEqual(['foto.pdf']);
});

test('upload que o servidor recusa não deixa deck fantasma no board', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => { s.failUpload = { status: 500, code: 'INTERNAL_ERROR', message: 'storage indisponível' }; },
    });

    await uploadNaTarefa(page, TASK.bo, pdf('bo.pdf', 'boletim'));

    // O deck só nasce depois que o arquivo existe: falhou o upload, não há deck —
    // nem na tela nem no servidor. (A tela também não diz nada ao usuário neste
    // caminho; o modal fica aberto e o botão volta ao normal.)
    await expect(page.getByTestId('deck-DECK-01')).toHaveCount(0);
    await expect(page.getByTestId('upload-modal')).toBeVisible();
    expect(state.board.decks).toHaveLength(0);
    expect(state.requests.some((r) => r.method === 'POST' && r.path.endsWith('/decks'))).toBe(false);
});

test('um deck sem arquivo nenhum não vai para análise', async ({ page }) => {
    // Só dá para chegar aqui removendo o último arquivo de um deck pendente.
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Remover arquivo' }).click();

    const recusa = page.waitForEvent('dialog').then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    expect(await recusa).toContain('Anexe ao menos um arquivo');

    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toHaveCount(0);
    expect(state.board.decks[0].status).toBe('pendente');
});
