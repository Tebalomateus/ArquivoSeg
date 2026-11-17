import { test, expect } from '@playwright/test';
import { abrirEtapa } from './fixtures/etapas.js';
import { signIn } from './fixtures/session.js';

/**
 * No modo demonstração a conclusão também anda com o board (guardado no
 * sessionStorage), e a tarefa pedida depois da criação mostra quando entrou.
 */

const CLAIM = '/app/sinistros/1';
const hoje = () => new Date().toLocaleDateString('pt-BR');

test('enviar arquivo por uma tarefa conta como pendente; a conclusão só anda com o envio do deck', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await abrirEtapa(page, /^Causa/);

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
    await expect(page.getByTestId('column-enviado').getByTestId('deck-DECK-01').getByTestId('deck-inserted')).toHaveText(`Inserido em ${hoje()}`);

    // O álbum lê o mesmo board.
    await page.getByRole('link', { name: 'Lista de Sinistros' }).click();
    await expect(page.getByTestId('album-card').filter({ hasText: 'SD - 2024-001' }).getByTestId('album-progress'))
        .toHaveText('0% atendido · 33% enviado');
});

test('tarefa pedida depois mostra a data de inserção; as antigas, a do sinistro', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await abrirEtapa(page, /^Causa/);

    const pendente = page.getByTestId('column-pendente');
    await pendente.getByLabel('Nova tarefa').fill('Fotos do local');
    await pendente.getByRole('button', { name: 'Criar' }).click();

    const nova = pendente.locator('[data-testid^="task-f1-1."]').filter({ hasText: 'Fotos do local' });
    await expect(nova.getByTestId('task-inserted')).toHaveText(`Inserida em ${hoje()}`);
    // A nova obrigatória entra na conta: 4 no total agora.
    await expect(page.getByTestId('board-progress')).toHaveText('0% atendido · 0% enviado');
    // Item antigo, sem data própria: a abertura do sinistro de demonstração.
    await expect(pendente.getByTestId('task-f1-1.bo').getByTestId('task-inserted')).toHaveText('Inserida em 02/01/2026');
});
