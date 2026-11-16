import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * No modo demonstração a conclusão também anda com o board (guardado no
 * sessionStorage).
 */

const CLAIM = '/app/sinistros/1';

test('enviar arquivo por uma tarefa conta como pendente; a conclusão só anda com o envio do deck', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await page.getByRole('tab', { name: /^Causa/ }).click();

    const label = page.getByTestId('claim-progress-label');
    await expect(label).toHaveText('0% atendido · 0% enviado');

    await page.getByTestId('column-pendente').getByTestId('task-f1-1.bo').click();
    const modal = page.getByTestId('upload-modal');
    await modal.locator('input[type=file]').setInputFiles({ name: 'bo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 bo') });
    await modal.getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal).toHaveCount(0);
    await expect(label).toHaveText('0% atendido · 0% enviado');

    await page.getByTestId('column-pendente').getByTestId('deck-DECK-01').getByRole('button', { name: 'Enviar deck' }).click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Enviar deck' }).click();
    await expect(label).toHaveText('0% atendido · 33% enviado');
    await expect(page.getByTestId('board-progress')).toHaveText('0% atendido · 50% enviado');

    // O álbum lê o mesmo board.
    await page.getByRole('link', { name: 'Lista de Sinistros' }).click();
    await expect(page.getByTestId('album-card').filter({ hasText: 'SD - 2024-001' }).getByTestId('album-progress'))
        .toHaveText('0% atendido · 33% enviado');
});
