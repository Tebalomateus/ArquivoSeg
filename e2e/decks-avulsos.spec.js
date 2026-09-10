import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O que entra no sinistro sem tarefa: o documento avulso e a tarefa avulsa.
 *
 * Os dois existem pelo mesmo motivo. O checklist do tipo de sinistro é escrito
 * antes do sinistro acontecer, e a realidade chega fora de ordem — a foto vem
 * pelo WhatsApp antes de alguém decidir o que ela comprova, e o analista pede um
 * documento que o modelo não previu. Sem estes dois caminhos, a saída era chutar
 * uma tarefa no upload, e desfazer um chute dentro de um deck custa mais do que
 * deixar o arquivo esperando.
 */

const pdf = (name, body) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(body) });

// Os avulsos têm aba própria na lateral do repositório, sem kanban: é uma lista
// do que está no sinistro sem comprovar nada, com o vincular ao lado.
async function abrirAvulsos(page) {
    await page.getByTestId('folder-avulsos').click();
    await expect(page.getByTestId('loose-panel')).toBeVisible();
    await expect(page.getByTestId('column-pendente')).toHaveCount(0);
}

async function enviarAvulso(page, file) {
    await abrirAvulsos(page);
    await page.getByTestId('loose-upload').click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(file);
    await modal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal).toHaveCount(0);
}

test('o documento sem tarefa fica esperando no painel de avulsos', async ({ page }) => {
    const state = await openBoard(page);

    await enviarAvulso(page, pdf('foto-do-veiculo.pdf', 'foto'));

    // O arquivo está no processo — só não comprova nada ainda. A lateral conta.
    await expect(page.getByTestId('loose-panel')).toContainText('foto-do-veiculo.pdf');
    await expect(page.getByTestId('folder-avulsos')).toContainText('1');
    await page.getByRole('button', { name: /^Causa \d+%$/ }).click();
    await expect(page.getByTestId('deck-DECK-01')).toHaveCount(0);
    expect(state.files.map((f) => f.file_name)).toEqual(['foto-do-veiculo.pdf']);
    expect(state.board.decks).toHaveLength(0);
});

test('vincular o avulso a uma tarefa abre o deck com ele dentro', async ({ page }) => {
    const state = await openBoard(page);
    await enviarAvulso(page, pdf('foto-do-veiculo.pdf', 'foto'));

    const fileId = state.files[0].id;
    await page.getByTestId(`loose-file-${fileId}`).getByRole('button', { name: 'Vincular' }).click();
    // Fora de uma pasta, a tarefa diz de qual pasta ela é.
    await page.getByTestId('link-modal').getByRole('button', { name: 'Causa · Boletim de ocorrência' }).click();

    // E ele sai da fila de espera, porque agora tem dono.
    await expect(page.getByTestId(`loose-file-${fileId}`)).toHaveCount(0);
    await expect(page.getByTestId('folder-avulsos')).toContainText('0');

    await page.getByRole('button', { name: /^Causa \d+%$/ }).click();
    const deck = page.getByTestId('deck-DECK-01');
    await expect(deck).toContainText('foto-do-veiculo.pdf');
    // Vincular reaproveita o arquivo que já subiu: um segundo upload aqui criaria
    // uma cópia do mesmo documento com outro id.
    expect(state.files).toHaveLength(1);
    expect(state.board.decks[0].arquivos[0].fileVerId).toBe(fileId);
    expect(state.board.decks[0].tarefaIds).toEqual([TASK.bo]);
});

test('vincular a um deck pendente não cria um segundo deck', async ({ page }) => {
    const state = await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });
    await enviarAvulso(page, pdf('complemento.pdf', 'complemento'));

    const fileId = state.files[state.files.length - 1].id;
    await page.getByTestId(`loose-file-${fileId}`).getByRole('button', { name: 'Vincular' }).click();
    await page.getByTestId('link-modal').getByRole('button', { name: 'DECK-01' }).click();

    await page.getByRole('button', { name: /^Causa \d+%$/ }).click();
    await expect(page.getByTestId('deck-DECK-01')).toContainText('1 tarefa · 2 arquivos');
    expect(state.board.decks).toHaveLength(1);
    expect(state.board.decks[0].arquivos.map((f) => f.nome)).toEqual(['laudo.pdf', 'complemento.pdf']);
});

test('a tarefa que o checklist não previu nasce solta em Pendente', async ({ page }) => {
    // Criar tarefa mexe no checklist do sinistro, não no board: é processo.editar.
    const state = await openBoard(page, { mutate: (s) => s.permissions.push('processo.editar') });

    const pendente = page.getByTestId('column-pendente');
    await pendente.getByLabel('Nova tarefa').fill('Nota fiscal do guincho');
    await pendente.getByRole('button', { name: 'Criar' }).click();

    await expect(pendente.locator('p', { hasText: 'Nota fiscal do guincho' })).toBeVisible();

    // E ela é uma tarefa como as outras: dá para subir arquivo por ela.
    await pendente.locator('p', { hasText: 'Nota fiscal do guincho' }).click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(pdf('guincho.pdf', 'guincho'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByTestId('deck-DECK-01')).toContainText('guincho.pdf');

    // O item novo tem de sobreviver ao recarregar, e o que o front persiste é o
    // checklist da pasta dentro do metadata do processo.
    await expect.poll(() => state.process.metadata.folders
        .find((f) => f.id === 'causa').checklist
        .map((i) => i.name))
        .toContain('Nota fiscal do guincho');
});

test('sem permissão de subir arquivo não há aba de avulsos', async ({ page }) => {
    await openBoard(page, { mutate: (s) => { s.permissions = s.permissions.filter((p) => p !== 'arquivo.subir'); } });

    await expect(page.getByTestId('folder-avulsos')).toHaveCount(0);
    await expect(page.getByTestId('loose-panel')).toHaveCount(0);
});
