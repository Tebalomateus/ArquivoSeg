import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O servidor inicia o prazo sozinho quando o último obrigatório é cumprido —
 * marcado no checklist ou com arquivo no deck da tarefa. O cartão do prazo
 * precisa reler depois dessas escritas; antes, só relia quando o progresso do
 * sinistro mudava, e nem o checklist nem os decks mexem nele.
 */

const pdf = (name, text) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n${text}\n`) });

test('marcar o último item do checklist inicia o prazo no cartão sem recarregar', async ({ page }) => {
    const state = await openBoard(page, {
        mutate: (s) => {
            s.process.claim_type = 'incendio';
            s.checklistDef = {
                type: 'incendio',
                stages: [
                    { id: 'aviso', title: 'Aviso', items: [{ id: 'bo', label: 'Boletim de ocorrência' }, { id: 'fotos', label: 'Fotos do local' }] },
                ],
            };
            s.process.metadata.checklist_state = { 'aviso.bo': true };
        },
    });

    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
    await page.getByRole('button', { name: 'Marcar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar recebimento' }).click();

    await expect(page.getByTestId('deadline-status')).toHaveText('30 dias restantes');
    await expect(page.getByTestId('deadline-start')).toContainText('automático');
    expect(state.process.metadata.checklist_state).toEqual({ 'aviso.bo': true, 'aviso.fotos': true });
});

test('enviar arquivo para a última tarefa pendente inicia o prazo no cartão', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            // O board abre na pasta Causa: a tarefa que falta fica nela.
            seedDeck(s, { tarefaIds: [TASK.bo, TASK.orcamento] });
        },
    });

    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    const pendente = page.getByTestId('column-pendente');
    await pendente.getByTestId(`task-${TASK.laudo}`).click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(pdf('laudo.pdf', 'laudo pericial'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByTestId('deadline-status')).toHaveText('30 dias restantes');
});
