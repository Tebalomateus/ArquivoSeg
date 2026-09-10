import { test, expect } from '@playwright/test';
import { confirmar, openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O diálogo de confirmação, pelo que ele promete.
 *
 * As outras suítes já passam por ele — é caminho obrigatório para desanexar,
 * remover e enviar. O que se testa aqui é o contrário disso: que cancelar
 * realmente não faz nada, que o texto muda quando a consequência muda, e que
 * duas perguntas seguidas são duas perguntas, e não a mesma caixa reaproveitada
 * com o estado da anterior.
 */

test('cancelar não executa a ação', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, {
            tarefaIds: [TASK.bo],
            arquivos: [{ nome: 'laudo.pdf' }, { nome: 'foto.pdf' }],
        }),
    });

    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Remover arquivo' }).first().click();

    const dialog = page.getByTestId('confirm-dialog');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(deck).toContainText('1 tarefa · 2 arquivos');
    expect(state.board.decks[0].arquivos).toHaveLength(2);
});

test('o Esc fecha o diálogo sem confirmar', async ({ page }) => {
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);

    expect(state.board.decks[0].status).toBe('pendente');
});

test('desanexar avisa do deck só quando o deck acaba junto', async ({ page }) => {
    // Duas tarefas: tirar uma é reversível e o deck continua de pé.
    await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo] }) });

    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Desanexar tarefa' }).first().click();

    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('A tarefa volta para Pendente');
    await expect(dialog).not.toContainText('deixa de existir');
    await confirmar(page, 'Tirar do deck');

    await expect(deck).toContainText('1 tarefa');

    // Agora é a última, e o aviso muda: o deck inteiro se desfaz.
    await deck.getByRole('button', { name: 'Desanexar tarefa' }).click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('Sem tarefa o deck deixa de existir');
    await confirmar(page, 'Desfazer deck');

    await expect(page.getByTestId('deck-DECK-01')).toHaveCount(0);
});

test('uma pergunta não herda o estado da anterior', async ({ page }) => {
    // Dois diálogos em sequência na mesma tela. Se as duas caíssem na mesma
    // instância, a segunda abriria com o botão travado em "Aguarde…".
    const state = await openBoard(page, {
        mutate: (s) => seedDeck(s, {
            tarefaIds: [TASK.bo],
            arquivos: [{ nome: 'laudo.pdf' }, { nome: 'foto.pdf' }],
        }),
    });

    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Remover arquivo' }).first().click();
    await confirmar(page, 'Remover do deck');

    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    const segundo = page.getByTestId('confirm-dialog');
    await expect(segundo.getByRole('button', { name: 'Enviar deck' })).toBeEnabled();
    await confirmar(page, 'Enviar deck');

    expect(state.board.decks[0].status).toBe('enviado');
});
