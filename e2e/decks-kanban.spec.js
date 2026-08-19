import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O board de decks, pelo caminho que o perito e o analista realmente fazem:
 * tarefa solta → arquivo → deck → envio → análise.
 *
 * O board vive inteiro no metadata do processo e o front aplica cada mutação
 * otimisticamente antes de reconciliar com a resposta. Por isso toda asserção
 * aqui tem duas metades: o que a tela mostra e o que o servidor guardou. Quando
 * as duas divergem é exatamente o bug que este arquivo existe para pegar.
 */

const pdf = (name, body) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(body) });

test('uma tarefa solta vira deck com o arquivo enviado', async ({ page }) => {
    const state = await openBoard(page);

    const pendente = page.getByTestId('column-pendente');
    await pendente.getByTestId(`task-${TASK.bo}`).click();

    const modal = page.getByTestId('upload-modal');
    await expect(modal).toContainText('Boletim de ocorrência');
    await modal.locator('input[type=file]').setInputFiles(pdf('bo.pdf', 'boletim de ocorrencia'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    const deck = pendente.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('1 tarefa · 1 arquivo');
    await expect(deck).toContainText('bo.pdf');
    // A tarefa saiu das soltas: ela está num deck agora, e não pode estar nos dois lugares.
    await expect(pendente.getByTestId(`task-${TASK.bo}`)).toHaveCount(0);

    expect(state.board.decks).toHaveLength(1);
    expect(state.board.decks[0].tarefaIds).toEqual([TASK.bo]);
    expect(state.board.decks[0].arquivos.map((f) => f.nome)).toEqual(['bo.pdf']);
});

test('duas tarefas selecionadas viram um único deck', async ({ page }) => {
    const state = await openBoard(page);
    const pendente = page.getByTestId('column-pendente');

    for (const key of [TASK.bo, TASK.laudo]) {
        await pendente.getByTestId(`task-${key}`).getByRole('button', { name: 'Selecionar tarefa' }).click();
    }
    await expect(pendente.getByText('2 tarefas selecionadas')).toBeVisible();

    await pendente.getByRole('button', { name: 'Juntar num deck' }).click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(pdf('processo.pdf', 'os dois documentos'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    const deck = pendente.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('2 tarefas · 1 arquivo');
    await expect(deck).toContainText('Boletim de ocorrência');
    await expect(deck).toContainText('Laudo pericial');

    expect(state.board.decks).toHaveLength(1);
    expect(state.board.decks[0].tarefaIds.sort()).toEqual([TASK.bo, TASK.laudo].sort());
});

test('desanexar a última tarefa descarta o deck e devolve a tarefa para pendente', async ({ page }) => {
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    const pendente = page.getByTestId('column-pendente');
    await pendente.getByTestId('deck-DECK-01').getByRole('button', { name: 'Desanexar tarefa' }).click();

    await expect(pendente.getByTestId('deck-DECK-01')).toHaveCount(0);
    await expect(pendente.getByTestId(`task-${TASK.bo}`)).toBeVisible();
    expect(state.board.decks).toHaveLength(0);
});

test('deck enviado sai de pendente e o perito só espera', async ({ page }) => {
    // Sem deck.analisar: é o outro lado da mesma tela, e quem envia não é quem
    // decide se o documento serve.
    const state = await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'deck.analisar');
            seedDeck(s, { tarefaIds: [TASK.bo] });
        },
    });

    await page.getByTestId('column-pendente').getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();

    const enviado = page.getByTestId('column-enviado');
    await expect(enviado.getByTestId('deck-DECK-01')).toContainText('Aguardando análise');
    await expect(enviado.getByRole('button', { name: 'Analisar documentos' })).toHaveCount(0);
    await expect(page.getByTestId('column-pendente').getByTestId('deck-DECK-01')).toHaveCount(0);

    expect(state.board.decks[0].status).toBe('enviado');
    expect(state.board.taskStatus[TASK.bo]).toBe('enviado');
});

test('analista aprova o deck e as tarefas ficam atendidas', async ({ page }) => {
    const state = await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], status: 'enviado' }),
    });

    await page.getByTestId('column-enviado').getByRole('button', { name: 'Analisar documentos' }).click();
    const modal = page.getByTestId('analysis-modal');
    await expect(modal).toContainText('Todas as tarefas serão marcadas como atendidas.');
    await modal.getByRole('button', { name: 'Aprovar deck' }).click();

    await expect(page.getByTestId('column-atendido').getByTestId('deck-DECK-01')).toContainText('Aprovado');
    expect(state.board.decks[0].status).toBe('atendido');
    expect(state.board.taskStatus).toMatchObject({ [TASK.bo]: 'atendido', [TASK.laudo]: 'atendido' });

    // Duas de duas atendidas na pasta Causa.
    await expect(page.getByText('2 de 2')).toBeVisible();
});

test('tarefa devolvida volta para pendente com o motivo à vista', async ({ page }) => {
    const state = await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], status: 'enviado' }),
    });

    await page.getByTestId('column-enviado').getByRole('button', { name: 'Analisar documentos' }).click();
    const modal = page.getByTestId('analysis-modal');

    const linhaLaudo = modal.locator('div').filter({ hasText: /^Laudo pericial/ }).last();
    await linhaLaudo.getByRole('button', { name: 'Devolver' }).click();
    await modal.getByPlaceholder('Ex.: fotos ilegíveis').fill('Laudo sem assinatura do perito.');
    await modal.getByRole('button', { name: 'Concluir análise' }).click();

    // O deck sobrevive com o que foi aprovado; o que voltou vira tarefa solta de novo.
    const pendente = page.getByTestId('column-pendente');
    await expect(pendente.getByTestId(`task-${TASK.laudo}`)).toContainText('Laudo sem assinatura do perito.');
    await expect(pendente.getByTestId(`task-${TASK.laudo}`)).toContainText('Devolvido');
    await expect(page.getByTestId('column-atendido').getByTestId('deck-DECK-01')).toContainText('Boletim de ocorrência');

    expect(state.board.taskStatus[TASK.laudo]).toBe('pendente');
    expect(state.board.taskReturns[TASK.laudo].motivo).toBe('Laudo sem assinatura do perito.');
    expect(state.board.decks[0].tarefaIds).toEqual([TASK.bo]);
});

test('o analista analisa mesmo quando as permissões chegam depois do board', async ({ page }) => {
    // O board monta antes de /me/permissions responder — é o caso normal, as duas
    // requisições saem juntas. O interruptor de papel da demo (VITE_DEMO_ROLE_SWITCH)
    // já foi semeado uma vez a partir de canAnalyse nessa primeira renderização, e
    // ficava preso em "perito": quem podia analisar via só "Aguardando análise".
    const state = await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => {
            s.slowPermissions = 400;
            seedDeck(s, { tarefaIds: [TASK.bo], status: 'enviado' });
        },
    });

    const enviado = page.getByTestId('column-enviado');
    await enviado.getByRole('button', { name: 'Analisar documentos' }).click();
    await page.getByTestId('analysis-modal').getByRole('button', { name: 'Aprovar deck' }).click();

    await expect(page.getByTestId('column-atendido').getByTestId('deck-DECK-01')).toContainText('Aprovado');
    expect(state.board.decks[0].status).toBe('atendido');
});

test('o board é por pasta: um deck da Causa não aparece no Prejuízo', async ({ page }) => {
    await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    await expect(page.getByTestId('column-pendente').getByTestId('deck-DECK-01')).toBeVisible();

    await page.getByRole('button', { name: /Prejuízo/ }).click();
    await expect(page.getByTestId('column-pendente').getByTestId('deck-DECK-01')).toHaveCount(0);
    await expect(page.getByTestId(`task-${TASK.orcamento}`)).toBeVisible();
});
