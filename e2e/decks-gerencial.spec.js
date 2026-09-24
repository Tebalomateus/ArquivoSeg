import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, PROCESS_ID, TASK } from './fixtures/deck-api.js';

/**
 * A pasta "Gerencial" como visão consolidada, só de leitura: uma árvore com as
 * outras pastas, dentro de cada uma as tarefas do checklist com o estado que o
 * board dá a elas, e sob cada tarefa os documentos do deck que a comprova, com
 * as mesmas ações de arquivo do cartão. Vem pronta do servidor
 * (GET /processes/{id}/gerencial) e é guardada por processo.verGerencial: sem a
 * permissão a pasta não está na lateral.
 */

// O front semeia a pasta Gerencial quando cria o sinistro; o fixture não a tem
// por padrão porque o kanban nunca precisou dela.
const comGerencial = (s) => {
    s.process.metadata.folders.push({ id: 'gerencial', name: 'Gerencial', category: 'gerencial', completion: 0, private: true, checklist: [] });
};

async function abrirGerencial(page) {
    await page.getByRole('button', { name: 'Gerencial' }).click();
    const tree = page.getByTestId('gerencial-tree');
    await expect(tree).toBeVisible();
    await expect(tree.getByRole('heading', { name: 'Visão gerencial' })).toBeVisible();
    return tree;
}

test('a árvore mostra pasta, tarefa com estado e deck, e os arquivos do deck', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], status: 'enviado', arquivos: [
                { nome: 'laudo.pdf', conteudo: 'conteúdo do laudo' },
                { nome: 'foto da frente.jpg', conteudo: 'bytes da foto' },
            ] });
            seedDeck(s, { tarefaIds: [TASK.orcamento], status: 'atendido', arquivos: [{ nome: 'orcamento.pdf', conteudo: 'orçamento' }] });
        },
    });

    const tree = await abrirGerencial(page);

    // O kanban ficou para trás: nem colunas, nem o cartão de progresso, nem os avulsos da lateral.
    await expect(page.getByTestId('column-pendente')).toHaveCount(0);
    await expect(page.getByText(/Atendidas em/)).toHaveCount(0);
    await expect(page.getByTestId('folder-avulsos')).toHaveCount(0);
    // E não se sobe nada para cá: a visão é só leitura.
    await expect(page.getByRole('button', { name: 'Upload Seguro' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Causa \d+%$/ }).click();
    await expect(page.getByRole('button', { name: 'Upload Seguro' })).toBeVisible();
    await abrirGerencial(page);

    const causa = tree.getByTestId('gerencial-folder-causa');
    await expect(causa).toContainText('Causa');
    await expect(causa).toContainText('2 tarefas · 2 arquivos');

    // Os dois arquivos do deck aparecem sob cada tarefa que o deck carrega.
    const bo = causa.getByTestId(`gerencial-task-${TASK.bo}`);
    await expect(bo).toContainText('Boletim de ocorrência');
    await expect(bo).toContainText('DECK-01');
    await expect(bo).toContainText('Enviado');
    await expect(bo).toContainText('laudo.pdf');
    await expect(bo).toContainText('foto da frente.jpg');
    await expect(causa.getByTestId(`gerencial-task-${TASK.laudo}`)).toContainText('laudo.pdf');

    const prejuizo = tree.getByTestId('gerencial-folder-prejuizo');
    const orcamento = prejuizo.getByTestId(`gerencial-task-${TASK.orcamento}`);
    await expect(orcamento).toContainText('DECK-02');
    await expect(orcamento).toContainText('Atendido');
    await expect(orcamento).toContainText('orcamento.pdf');

    // Nada avulso: todo arquivo está em algum deck.
    const avulsos = tree.getByTestId('gerencial-folder-avulsos');
    await expect(avulsos).toContainText('Documentos avulsos');
    await expect(avulsos).toContainText('Nenhum documento nesta pasta ainda.');

    // A árvore veio do servidor, não do board.
    expect(state.requests.some((r) => r.method === 'GET' && r.path === `/api/v1/processes/${PROCESS_ID}/gerencial`)).toBe(true);
});

test('tarefa sem deck fica listada, sem arquivo; arquivo sem deck vai para os avulsos', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            s.files.push({
                id: 'fv-solto', file_name: 'causa__foto-solta.jpg', mime_type: 'image/jpeg', size_bytes: 12,
                version: 1, created_at: '2026-08-02T12:00:00Z', uploaded_by: 'u-perito', content: Buffer.from('foto solta!!'),
            });
        },
    });

    const tree = await abrirGerencial(page);

    const bo = tree.getByTestId(`gerencial-task-${TASK.bo}`);
    await expect(bo).toContainText('Boletim de ocorrência');
    await expect(bo).toContainText('Sem deck');
    await expect(bo).toContainText('0 arquivos');
    await expect(bo.getByTestId(/^gerencial-file-/)).toHaveCount(0);

    // O prefixo de pasta do nome fica de fora, como no repositório.
    const avulsos = tree.getByTestId('gerencial-folder-avulsos');
    await expect(avulsos).toContainText('foto-solta.jpg');
    await expect(avulsos).not.toContainText('causa__');
    await expect(avulsos).toContainText('1 arquivo');
    expect(state.board.decks).toHaveLength(0);
});

test('as ações de arquivo são as do cartão: ver, baixar e compartilhar', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            seedDeck(s, { tarefaIds: [TASK.bo], status: 'atendido' });
        },
    });
    const laudo = state.files.find((f) => f.file_name === 'laudo.pdf');

    const tree = await abrirGerencial(page);
    const actions = tree.getByTestId(`file-actions-${laudo.id}`);
    await expect(actions.getByRole('button', { name: 'Visualizar laudo.pdf' })).toBeVisible();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        actions.getByRole('button', { name: 'Baixar laudo.pdf' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('laudo.pdf');
    expect(readFileSync(await download.path()).equals(laudo.content)).toBe(true);

    await actions.getByRole('button', { name: 'Compartilhar laudo.pdf' }).click();
    const modal = page.getByTestId('share-modal');
    await expect(modal).toContainText('laudo.pdf');
    await modal.getByRole('button', { name: 'Gerar link' }).click();
    await expect(modal.getByLabel('Link público')).toHaveValue(new RegExp(`/portal/${state.shares[0].token}$`));
});

test('sem arquivo.baixar e compartilhamento.criar só resta ver', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            s.permissions = s.permissions.filter((p) => p !== 'arquivo.baixar' && p !== 'compartilhamento.criar');
            seedDeck(s, { tarefaIds: [TASK.bo] });
        },
    });
    const laudo = state.files[0];

    const tree = await abrirGerencial(page);
    const actions = tree.getByTestId(`file-actions-${laudo.id}`);
    await expect(actions.getByRole('button', { name: 'Visualizar laudo.pdf' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Baixar laudo.pdf' })).toHaveCount(0);
    await expect(actions.getByRole('button', { name: 'Compartilhar laudo.pdf' })).toHaveCount(0);
});

test('sem processo.verGerencial a pasta não existe na lateral — e a rota nem é pedida', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            s.permissions = s.permissions.filter((p) => p !== 'processo.verGerencial');
        },
    });

    await expect(page.getByRole('button', { name: /^Causa \d+%$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerencial' })).toHaveCount(0);
    await expect(page.getByTestId('gerencial-tree')).toHaveCount(0);
    expect(state.requests.some((r) => r.path.endsWith('/gerencial'))).toBe(false);
});

test('a pasta gerencial abre a árvore em qualquer modo, e recolher esconde as tarefas', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            comGerencial(s);
            seedDeck(s, { tarefaIds: [TASK.bo] });
        },
    });

    await page.getByRole('button', { name: 'Checklist' }).click();
    const tree = await abrirGerencial(page);

    const bo = tree.getByTestId(`gerencial-task-${TASK.bo}`);
    await expect(bo).toBeVisible();
    await tree.getByRole('button', { name: 'Recolher tudo' }).click();
    await expect(bo).toHaveCount(0);
    await tree.getByRole('button', { name: 'Expandir tudo' }).click();
    await expect(bo).toBeVisible();
    await expect(bo).toContainText('laudo.pdf');
});
