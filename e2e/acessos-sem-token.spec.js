import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * Fora do modo mock, a persona de demonstração nunca vale.
 *
 * Ao recarregar a página o token da API só é restaurado depois do primeiro
 * render. Já houve um estado em que, sem token, o front aplicava o conjunto da
 * persona guardada no localStorage — quem tinha entrado como "perito" numa
 * versão antiga ganhava upload e perdia a análise, sem nunca perguntar à API.
 * Sem token não há resposta: nada é concedido até ela chegar.
 */
test('sem token da API, a persona guardada não concede nada', async ({ page }) => {
    // Perito na demo tem processo.criar; sem token isso não pode contar.
    await signIn(page, 'contributor');
    const asked = [];
    await page.route('**/api/v1/**', (route) => { asked.push(new URL(route.request().url()).pathname); route.abort(); });

    await page.goto('/app/sinistros/novo');

    // Sem resposta o portão espera; não decide com a persona nem expulsa.
    await expect(page.getByTestId('rota-aguardando')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toHaveCount(0);
    // E não perguntou sem ter como se identificar.
    expect(asked.filter((p) => p.endsWith('/me/permissions'))).toEqual([]);
});
