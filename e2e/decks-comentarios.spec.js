import { test, expect } from '@playwright/test';
import { confirmar, openBoard, seedDeck, seedComment, TASK } from './fixtures/deck-api.js';

/**
 * A fila de comentários do deck. Um comentário preso ao deck vale como
 * comprovação, como um arquivo: o deck pode ir para análise só com comentário.
 * Duas regras deixam o comentário sem valor de prova, e as duas aparecem na
 * fila em vez de sumir dela:
 *   - o que veio antes da última devolução (marcado "anterior à devolução");
 *   - o que era de um deck desfeito (fica no histórico como "DECK-0N desfeito").
 */

const HOUR = 3_600_000;
const ago = (h) => new Date(Date.now() - h * HOUR).toISOString();

async function openComments(page, codigo = 'DECK-01') {
    await page.getByTestId(`deck-comments-open-${codigo}`).click();
    const panel = page.getByTestId('deck-comments');
    await expect(panel).toBeVisible();
    return panel;
}

test('deck sem arquivo vai para análise com um comentário', async ({ page }) => {
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo], arquivos: [] }) });
    const deck = page.getByTestId('deck-DECK-01');

    // Sem arquivo e sem comentário, o board recusa sem perguntar nada.
    const recusa = page.waitForEvent('dialog').then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    expect(await recusa).toContain('escreva um comentário');
    expect(state.board.decks[0].status).toBe('pendente');

    const panel = await openComments(page);
    await expect(panel).toContainText('Nenhum comentário neste deck ainda.');
    await panel.getByTestId('deck-comment-input').fill('Vistoria feita por vídeo; não há boletim.');
    await panel.getByTestId('deck-comment-send').click();
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);
    await expect(panel.getByTestId('deck-comment-item')).toContainText('Ana Souza');

    // O corpo da requisição prende o comentário ao deck.
    const post = state.requests.find((r) => r.method === 'POST' && r.path.endsWith('/comments'));
    expect(post.body).toEqual({ body: 'Vistoria feita por vídeo; não há boletim.', deck_id: state.board.decks[0].id });

    await panel.getByRole('button', { name: 'Fechar' }).click();
    await expect(deck.getByTestId('deck-comment-count')).toHaveText('1');

    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('1 comentário');
    await confirmar(page, 'Enviar deck');
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toBeVisible();
    expect(state.board.decks[0].status).toBe('enviado');
});

test('a fila é cronológica e a busca ignora acento e caixa', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            const d = seedDeck(s, { tarefaIds: [TASK.bo] });
            seedComment(s, { deck: d, body: 'Segundo: aguardando a perícia', createdAt: ago(1) });
            seedComment(s, { deck: d, body: 'Primeiro: contato com o segurado', createdAt: ago(3) });
        },
    });

    const panel = await openComments(page);
    const items = panel.getByTestId('deck-comment-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Primeiro');
    await expect(items.nth(1)).toContainText('Segundo');
    await expect(items.nth(0)).toContainText('Bruno Lima');

    await panel.getByTestId('deck-comments-search').fill('PERICIA');
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('aguardando a perícia');
    const search = state.requests.filter((r) => r.path.includes('/comments?')).pop();
    expect(search.path).toContain(`deck_id=${state.board.decks[0].id}`);
    expect(search.path).toContain('q=PERICIA');

    await panel.getByTestId('deck-comments-search').fill('nada disso');
    await expect(panel).toContainText('Nenhum comentário com esse texto.');
});

test('deck desfeito: o comentário fica no histórico do sinistro, marcado', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            const velho = seedDeck(s, { tarefaIds: [TASK.orcamento] });
            seedComment(s, { deck: velho, body: 'Orçamento recusado pela seguradora', createdAt: ago(5) });
            // O primeiro deck saiu do quadro; o comentário continua lá.
            s.board.decks = s.board.decks.filter((d) => d.id !== velho.id);
            const atual = seedDeck(s, { tarefaIds: [TASK.bo] });
            seedComment(s, { deck: atual, body: 'Boletim chegou por e-mail', createdAt: ago(1) });
        },
    });

    const panel = await openComments(page, 'DECK-02');
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);

    await panel.getByTestId('deck-comments-scope-all').click();
    const items = panel.getByTestId('deck-comment-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Orçamento recusado');
    await expect(items.nth(0).getByTestId('deck-comment-desfeito')).toHaveText('DECK-01 desfeito');
    await expect(items.nth(1)).toContainText('DECK-02');
    await expect(items.nth(1).getByTestId('deck-comment-desfeito')).toHaveCount(0);
});

test('desanexar a tarefa não apaga os comentários do deck', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            const d = seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], arquivos: [] });
            seedComment(s, { deck: d, body: 'Boletim e laudo no mesmo documento', createdAt: ago(1) });
        },
    });
    const deck = page.getByTestId('deck-DECK-01');
    await deck.getByRole('button', { name: 'Desanexar tarefa' }).first().click();
    await confirmar(page, 'Tirar do deck');
    await expect(deck).toContainText('1 tarefa');

    await expect(deck.getByTestId('deck-comment-count')).toHaveText('1');
    expect(state.comments).toHaveLength(1);
});

test('depois da devolução, só um comentário novo comprova o deck', async ({ page }) => {
    const devolvidoAt = ago(2);
    const state = await openBoard(page, {
        mutate: (s) => {
            const d = seedDeck(s, { tarefaIds: [TASK.bo], arquivos: [], devolvidoAt });
            seedComment(s, { deck: d, body: 'Sem boletim: registro só online', createdAt: ago(4) });
        },
    });
    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck.getByTestId('deck-comment-count')).toHaveText('1');

    // O comentário existe, mas é da tentativa recusada: enviar é recusado.
    const recusa = page.waitForEvent('dialog').then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    expect(await recusa).toContain('Depois da devolução');
    expect(state.board.decks[0].status).toBe('pendente');

    const panel = await openComments(page);
    await expect(panel.getByTestId('deck-comment-before-return')).toHaveCount(1);
    await expect(panel.getByTestId('deck-comments-needs-new')).toBeVisible();

    await panel.getByTestId('deck-comment-input').fill('Protocolo online anexado ao processo SEI 123.');
    await panel.getByTestId('deck-comment-send').click();
    const items = panel.getByTestId('deck-comment-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(1).getByTestId('deck-comment-before-return')).toHaveCount(0);
    await expect(panel.getByTestId('deck-comments-needs-new')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Fechar' }).click();

    await deck.getByRole('button', { name: 'Enviar deck' }).click();
    await confirmar(page, 'Enviar deck');
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toBeVisible();
    expect(state.board.decks[0].status).toBe('enviado');
});

test('tarefa devolvida que volta a um deck traz a data da devolução', async ({ page }) => {
    const devolvidaAt = ago(1);
    const state = await openBoard(page, {
        mutate: (s) => {
            s.board.taskReturns[TASK.bo] = { motivo: 'Boletim ilegível.', devolvidaBy: 'e2e', devolvidaAt };
            const d = seedDeck(s, { tarefaIds: [TASK.laudo], arquivos: [] });
            seedComment(s, { deck: d, body: 'Laudo vem pelo perito na semana que vem', createdAt: ago(3) });
        },
    });

    // Juntar a tarefa devolvida ao deck que tem só comentário antigo.
    const pendente = page.getByTestId('column-pendente');
    await pendente.getByTestId(`task-${TASK.bo}`).getByRole('button', { name: 'Selecionar tarefa' }).click();
    await page.getByTestId('deck-DECK-01').getByRole('button', { name: /Juntar 1 selecionada/ }).click();
    await expect(page.getByTestId('deck-DECK-01')).toContainText('2 tarefas');

    expect(state.board.decks[0].devolvidoAt).toBe(devolvidaAt);
    const panel = await openComments(page);
    await expect(panel.getByTestId('deck-comment-before-return')).toHaveCount(1);
});

test('comentário em deck pode iniciar o prazo', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            seedDeck(s, { tarefaIds: [TASK.laudo, TASK.orcamento] });
            seedDeck(s, { tarefaIds: [TASK.bo], arquivos: [] });
        },
    });
    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');

    const panel = await openComments(page, 'DECK-02');
    await panel.getByTestId('deck-comment-input').fill('Boletim dispensado pela seguradora.');
    await panel.getByTestId('deck-comment-send').click();
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);

    await expect(page.getByTestId('deadline-status')).toHaveText('30 dias restantes');
});

test('editar e excluir o próprio comentário; o dos outros não', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            const d = seedDeck(s, { tarefaIds: [TASK.bo] });
            seedComment(s, { deck: d, body: 'De outra pessoa', createdAt: ago(2) });
            seedComment(s, { deck: d, body: 'Meu rascunho', createdAt: ago(1), author: { id: 'u-perito', name: 'Ana Souza', email: 'ana.souza@allianz.com' } });
        },
    });

    const panel = await openComments(page);
    const items = panel.getByTestId('deck-comment-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0).getByRole('button', { name: 'Editar comentário' })).toHaveCount(0);
    await expect(items.nth(0).getByRole('button', { name: 'Excluir comentário' })).toHaveCount(0);

    await items.nth(1).getByRole('button', { name: 'Editar comentário' }).click();
    await items.nth(1).getByRole('textbox', { name: 'Editar comentário' }).fill('Meu texto final');
    await items.nth(1).getByRole('button', { name: 'Salvar' }).click();
    await expect(items.nth(1)).toContainText('Meu texto final');
    expect(state.comments.find((c) => c.author_email === 'ana.souza@allianz.com').body).toBe('Meu texto final');

    await items.nth(1).getByRole('button', { name: 'Excluir comentário' }).click();
    await confirmar(page, 'Excluir');
    await expect(items).toHaveCount(1);
    expect(state.comments).toHaveLength(1);
});

test('sem comentario.criar a fila é só leitura', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'comentario.criar');
            const d = seedDeck(s, { tarefaIds: [TASK.bo] });
            seedComment(s, { deck: d, body: 'Só leitura', createdAt: ago(1) });
        },
    });
    const panel = await openComments(page);
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);
    await expect(panel.getByTestId('deck-comment-input')).toHaveCount(0);
});

test('sem comentario.listar a fila não é pedida', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            s.permissions = s.permissions.filter((p) => p !== 'comentario.listar');
            const d = seedDeck(s, { tarefaIds: [TASK.bo] });
            seedComment(s, { deck: d, body: 'Escondido', createdAt: ago(1) });
        },
    });
    const panel = await openComments(page);
    await expect(panel).toContainText('Você não tem permissão para ver os comentários');
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(0);
    expect(state.requests.some((r) => r.method === 'GET' && r.path.includes('/comments?deck_id='))).toBe(false);
});

test('o analista abre os comentários pela análise', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            const d = seedDeck(s, { tarefaIds: [TASK.bo], arquivos: [], status: 'enviado' });
            seedComment(s, { deck: d, body: 'Sem documento: vistoria por vídeo.', createdAt: ago(1) });
        },
    });
    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Analisar documentos' }).click();
    const analysis = page.getByTestId('analysis-modal');
    await analysis.getByTestId('analysis-comments').click();
    const panel = page.getByTestId('deck-comments');
    await expect(panel).toContainText('vistoria por vídeo');
});

test('a tarefa vira deck sem arquivo pelo "Comprovar com comentário"', async ({ page }) => {
    const state = await openBoard(page);
    await page.getByTestId('column-pendente').getByTestId(`task-${TASK.bo}`).click();

    const modal = page.getByTestId('upload-modal');
    await expect(modal.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    await modal.getByTestId('prove-by-comment').click();

    // O deck nasce vazio e a fila dele já abre, pronta para o comentário.
    const panel = page.getByTestId('deck-comments');
    await expect(panel).toBeVisible();
    expect(state.board.decks).toHaveLength(1);
    expect(state.board.decks[0].arquivos).toEqual([]);
    expect(state.board.decks[0].tarefaIds).toEqual([TASK.bo]);

    await panel.getByTestId('deck-comment-input').fill('Segurado informou que não registrou boletim.');
    await panel.getByTestId('deck-comment-send').click();
    await expect(panel.getByTestId('deck-comment-item')).toHaveCount(1);
    await panel.getByRole('button', { name: 'Fechar' }).click();

    await page.getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();
    await confirmar(page, 'Enviar deck');
    expect(state.board.decks[0].status).toBe('enviado');
});
