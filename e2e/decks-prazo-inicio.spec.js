import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O servidor inicia o prazo sozinho quando o último obrigatório é cumprido —
 * com arquivo no deck da tarefa. O cartão do prazo precisa reler depois dessas
 * escritas; antes, só relia quando o progresso do sinistro mudava, e os decks
 * não mexem nele. Item marcado como não obrigatório no tipo de sinistro não
 * segura o prazo.
 */

const pdf = (name, text) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n${text}\n`) });

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

test('tarefa não obrigatória não segura o prazo', async ({ page }) => {
    await openBoard(page, {
        mutate: (s) => {
            const causa = s.process.metadata.folders.find((f) => f.id === 'causa');
            causa.checklist = causa.checklist.map((i) => (i.id === 'laudo' ? { ...i, required: false } : i));
            seedDeck(s, { tarefaIds: [TASK.orcamento] });
        },
    });

    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    await page.getByTestId('column-pendente').getByTestId(`task-${TASK.bo}`).click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles(pdf('bo.pdf', 'boletim'));
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    // O laudo continua pendente, e o prazo começa mesmo assim.
    await expect(page.getByTestId('deadline-status')).toHaveText('30 dias restantes');
    await expect(page.getByTestId('column-pendente').getByTestId(`task-${TASK.laudo}`)).toBeVisible();
});
