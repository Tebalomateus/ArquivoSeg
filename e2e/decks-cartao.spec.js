import { test, expect } from '@playwright/test';
import { openBoard, seedDeck, TASK } from './fixtures/deck-api.js';

/**
 * O cartão lateral do sinistro lendo do servidor: criador vindo do próprio
 * processo (created_by_name/created_by_email), armazenamento de
 * /processes/:id/storage e a última atividade de /processes/:id/audit.
 */

test('criador, armazenamento e última atividade vêm do servidor', async ({ page }) => {
    await openBoard(page, {
        persona: 'manager',
        mutate: (s) => {
            s.process.created_by = 'u-criador';
            s.process.created_by_name = 'Corretor ArquivoSeg';
            s.process.created_by_email = 'corretor@arquivoseg.com.br';
            s.permissions.push('processo.verAuditoria');
            seedDeck(s, { tarefaIds: [TASK.bo], arquivos: [{ nome: 'laudo.pdf', conteudo: 'x'.repeat(2048) }] });
            s.audit = [{
                id: 'a1', timestamp: '2026-09-20T14:32:00Z', action: 'file.uploaded',
                resource_type: 'file', resource_id: 'fv-1', actor_user_id: 'u-perito',
                actor_name: 'Ana Perita', actor_email: 'ana@perito.com', metadata: {},
            }];
        },
    });

    const creator = page.getByTestId('claim-creator');
    await expect(creator).toContainText('Criado por Corretor ArquivoSeg');
    await expect(creator).toContainText('corretor@arquivoseg.com.br');
    await expect(page.getByTestId('claim-storage')).toContainText('2.0 KB');
    await expect(page.getByTestId('claim-storage')).toContainText('1 arquivo');
    await expect(page.getByTestId('claim-last-activity')).toContainText('Ana Perita documento enviado');
});

test('sem processo.verAuditoria a trilha nem é pedida', async ({ page }) => {
    const state = await openBoard(page, { persona: 'manager' });

    await expect(page.getByTestId('claim-storage')).toContainText('0 B');
    await expect(page.getByTestId('claim-last-activity')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Auditoria' })).toHaveCount(0);
    expect(state.requests.some((r) => r.path.includes('/audit'))).toBe(false);
});

// A última atividade usa o mesmo vocabulário da aba de auditoria: códigos que
// só a trilha nova conhece (prazo, decks) não podem aparecer crus no cartão.
test('a última atividade traduz os códigos da trilha nova', async ({ page }) => {
    await openBoard(page, {
        persona: 'manager',
        mutate: (s) => {
            s.permissions.push('processo.verAuditoria');
            s.audit = [{
                id: 'a1', timestamp: '2026-09-20T14:32:00Z', action: 'process.deadline_started',
                resource_type: 'process', resource_id: s.process.id, actor_user_id: null,
                actor_name: null, actor_email: null, metadata: { source: 'auto' },
            }];
        },
    });

    await expect(page.getByTestId('claim-last-activity')).toContainText('Sistema prazo regulatório iniciado');
});
