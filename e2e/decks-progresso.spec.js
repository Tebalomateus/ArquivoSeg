import { test, expect } from '@playwright/test';
import { confirmar, openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * A conclusão do sinistro vem do board: tarefa obrigatória atendida conta
 * inteira, enviada (em análise) conta como parcial. Antes o percentual era um
 * número guardado no metadata que nada mais atualizava — ficava em 0% para
 * sempre. Aqui ele tem de andar quando o deck anda, no cartão lateral, na aba
 * da pasta e no cabeçalho do board, sem recarregar a página.
 *
 * O sinistro do fixture tem três obrigatórias: Causa (bo, laudo) e Prejuízo
 * (orcamento).
 */

test('enviar um deck faz a conclusão andar como enviada', async ({ page }) => {
    await openBoard(page, { mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo] }) });

    await expect(page.getByTestId('claim-progress-label')).toHaveText('0% atendido · 0% enviado');

    await page.getByTestId('column-pendente').getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();
    await confirmar(page, 'Enviar deck');
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01')).toBeVisible();

    // 1 de 3 obrigatórias enviada; na pasta Causa, 1 de 2.
    await expect(page.getByTestId('claim-progress-label')).toHaveText('0% atendido · 33% enviado');
    await expect(page.getByTestId('claim-progress')).toHaveText('0%');
    await expect(page.getByTestId('board-progress')).toHaveText('0% atendido · 50% enviado');
});

test('aprovar o deck passa a conclusão de enviada para atendida', async ({ page }) => {
    await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], status: 'enviado' }),
    });

    // Duas de três obrigatórias em análise.
    await expect(page.getByTestId('claim-progress-label')).toHaveText('0% atendido · 67% enviado');
    await expect(page.getByTestId('folder-progress-causa')).toHaveText('(0%)');

    await page.getByTestId('column-enviado').getByRole('button', { name: 'Analisar documentos' }).click();
    await page.getByTestId('analysis-modal').getByRole('button', { name: 'Aprovar deck' }).click();
    await expect(page.getByTestId('column-atendido').getByTestId('deck-DECK-01')).toContainText('Aprovado');

    await expect(page.getByTestId('claim-progress-label')).toHaveText('67% atendido · 0% enviado');
    await expect(page.getByTestId('claim-progress')).toHaveText('67%');
    await expect(page.getByTestId('folder-progress-causa')).toHaveText('(100%)');
    await expect(page.getByTestId('folder-progress-prejuizo')).toHaveText('(0%)');
    await expect(page.getByTestId('board-progress')).toHaveText('100% atendido · 0% enviado');
    await expect(page.getByText('2 de 2')).toBeVisible();
});

test('tarefa opcional não entra na conta', async ({ page }) => {
    await openBoard(page, {
        persona: 'viewer',
        mutate: (s) => {
            s.process.metadata.folders[0].checklist.push({ id: 'fotos', name: 'Fotos extras', required: false, received: false });
            seedDeck(s, { tarefaIds: [TASK.bo, TASK.laudo], status: 'atendido' });
        },
    });
    await expect(page.getByTestId('claim-progress-label')).toHaveText('67% atendido · 0% enviado');
    await expect(page.getByTestId('board-progress')).toHaveText('100% atendido · 0% enviado');
});
