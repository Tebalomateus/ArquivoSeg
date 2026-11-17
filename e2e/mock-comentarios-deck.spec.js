import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * Comentários de deck no modo demonstração: a fila fica no sessionStorage do
 * sinistro (deckcomments_<id>) e segue as mesmas regras do servidor — comentário
 * comprova o deck, e depois de uma devolução só conta o que veio depois dela.
 * Nada sai para /comments.
 */

const CLAIM_ID = '1';
const TASK = 'f1-1.bo';
const HOUR = 3_600_000;

// Planta o quadro uma vez só: um reload não pode desfazer o que o teste fez.
async function seed(page, { devolvidoAt = null, comments = [] } = {}) {
    const at = new Date(Date.now() - 6 * HOUR).toISOString();
    const deck = {
        id: 'mock-deck-1', codigo: 'DECK-01', status: 'pendente', grupo: 'f1-1',
        arquivos: [], tarefaIds: [TASK], createdBy: 'demo', createdAt: at, updatedAt: at,
        ...(devolvidoAt ? { devolvidoAt } : {}),
    };
    await page.addInitScript(({ id, deck, comments, task }) => {
        if (sessionStorage.getItem('e2e_seeded')) return;
        sessionStorage.setItem('e2e_seeded', '1');
        sessionStorage.setItem(`deckboard_${id}`, JSON.stringify({ decks: [deck], seq: 1, taskStatus: { [task]: 'pendente' }, taskReturns: {} }));
        sessionStorage.setItem(`deckcomments_${id}`, JSON.stringify(comments.map((c, i) => ({
            id: `mc-${i}`, deckId: deck.id, deckCodigo: deck.codigo, authorName: 'Bruno Lima', authorEmail: 'bruno@demo', ...c,
        }))));
    }, { id: CLAIM_ID, deck, comments, task: TASK });
}

test('no mock, um comentário basta para enviar o deck e sobrevive ao reload', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/\/api\/v1\/.*comments/.test(r.url())) calls.push(r.url()); });
    await signIn(page, 'contributor');
    await seed(page);
    await page.goto(`/app/sinistros/${CLAIM_ID}`);

    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toBeVisible();
    await deck.getByTestId('deck-comments-open-DECK-01').click();
    const panel = page.getByTestId('deck-comments');
    await panel.getByTestId('deck-comment-input').fill('Ocorrência registrada só por telefone.');
    await panel.getByTestId('deck-comment-send').click();
    await expect(panel.getByTestId('deck-comment-item')).toContainText('Ana Souza');
    await panel.getByRole('button', { name: 'Fechar' }).click();
    await expect(deck.getByTestId('deck-comment-count')).toHaveText('1');

    await page.reload();
    await expect(page.getByTestId('deck-DECK-01').getByTestId('deck-comment-count')).toHaveText('1');

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('1 comentário');
    await dialog.getByRole('button', { name: 'Enviar deck' }).click();
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toBeVisible();
    expect(calls).toEqual([]);
});

test('no mock, comentário de antes da devolução não comprova', async ({ page }) => {
    await signIn(page, 'contributor');
    await seed(page, {
        devolvidoAt: new Date(Date.now() - 2 * HOUR).toISOString(),
        comments: [{ body: 'Comentário da primeira tentativa', createdAt: new Date(Date.now() - 4 * HOUR).toISOString() }],
    });
    await page.goto(`/app/sinistros/${CLAIM_ID}`);

    const deck = page.getByTestId('deck-DECK-01');
    const recusa = page.waitForEvent('dialog').then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    expect(await recusa).toContain('Depois da devolução');

    await deck.getByTestId('deck-comments-open-DECK-01').click();
    const panel = page.getByTestId('deck-comments');
    await expect(panel.getByTestId('deck-comment-before-return')).toHaveCount(1);
    await panel.getByTestId('deck-comments-search').fill('PRIMEIRA tentativa');
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);
    await panel.getByTestId('deck-comments-search').fill('');
    await panel.getByTestId('deck-comment-input').fill('Agora com o protocolo novo.');
    await panel.getByTestId('deck-comment-send').click();
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(2);
    await panel.getByRole('button', { name: 'Fechar' }).click();

    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Enviar deck' }).click();
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toBeVisible();
});
