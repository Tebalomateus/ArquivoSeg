import { test, expect } from '@playwright/test';
import { openBoard } from './fixtures/deck-api.js';

/**
 * O prazo lido de GET /processes/:id/deadline e ajustado por PUT na mesma
 * rota. O servidor decide quem pode ajustar (can_adjust) e recusa o resto com
 * DEADLINE_FORBIDDEN — o cartão mostra essa recusa em vez de fingir sucesso.
 */

const DAY = 86_400_000;
const dayInput = (offset) => {
    const d = new Date(Date.now() + offset * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('prazo iniciado pelo servidor mostra dias restantes e início automático', async ({ page }) => {
    const start = new Date(Date.now() - 10 * DAY).toISOString();
    await openBoard(page, {
        mutate: (s) => {
            s.canAdjustDeadline = false;
            s.deadline = {
                start_at: start, start_source: 'auto', total_days: 30,
                due_at: new Date(Date.parse(start) + 30 * DAY).toISOString(), due_source: 'auto',
                history: [{ at: start, by: null, by_name: null, by_email: null, field: 'start_at', from: null, to: start, justification: '', source: 'auto' }],
            };
        },
    });

    await expect(page.getByTestId('deadline-status')).toHaveText('20 dias restantes');
    await expect(page.getByTestId('deadline-status')).toHaveAttribute('data-state', 'running');
    await expect(page.getByTestId('deadline-start')).toContainText('automático');
    await expect(page.getByTestId('deadline-history')).toContainText('Sistema');
    // Quem não é criador nem admin não vê o ajuste.
    await expect(page.getByRole('button', { name: 'Ajustar prazo' })).toHaveCount(0);
});

test('o ajuste vai para o servidor com a justificativa', async ({ page }) => {
    const state = await openBoard(page);

    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    await page.getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    await modal.getByLabel('Novo início').fill(dayInput(-1));
    await modal.getByLabel('Justificativa *').fill('Obrigatórios entregues fora do sistema');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(modal).toHaveCount(0);

    await expect(page.getByTestId('deadline-status')).toHaveText(/^(29|30) dias restantes$/);
    await expect(page.getByTestId('deadline-history')).toContainText('Obrigatórios entregues fora do sistema');
    expect(state.deadline.start_source).toBe('manual');
    expect(state.deadline.history[0].justification).toBe('Obrigatórios entregues fora do sistema');
});

test('a recusa do servidor aparece no modal', async ({ page }) => {
    const state = await openBoard(page);
    await page.getByRole('button', { name: 'Ajustar prazo' }).click();
    // O papel mudou entre abrir a página e salvar.
    state.canAdjustDeadline = false;

    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    await modal.getByLabel('Novo vencimento').fill(dayInput(15));
    await modal.getByLabel('Justificativa *').fill('Prorrogação acordada');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(modal.getByRole('alert')).toHaveText('Só quem criou o sinistro ou um administrador pode ajustar o prazo.');
    expect(state.deadline.due_at).toBeNull();
});
