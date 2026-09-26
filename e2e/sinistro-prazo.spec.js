import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * O prazo regulatório no cartão do sinistro, no modo mock (quem está logado
 * faz as vezes de criador e pode ajustar).
 *
 * A suspensão manual saiu: o prazo começa sozinho quando o último obrigatório
 * chega, e a única intervenção humana é o ajuste justificado, que fica no
 * histórico.
 */

const CLAIM = '/app/sinistros/1';

// "AAAA-MM-DD" de hoje deslocado em dias, no fuso local — o que o <input type="date"> espera.
const dayInput = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('sem início o prazo aguarda os obrigatórios, e a suspensão manual não existe mais', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const prazo = page.getByTestId('claim-deadline');
    await expect(prazo.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    await expect(page.getByRole('button', { name: /Suspender prazo|Retomar prazo/ })).toHaveCount(0);
    await expect(page.getByTitle(/Suspender prazo|Retomar prazo/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Gerenciamento' }).click();
    await expect(page.getByText('Workflow do Sinistro')).toBeVisible();
    await expect(page.getByText('Trilha de Prazos (SLA)')).toHaveCount(0);
});

test('ajustar o início exige justificativa e entra no histórico', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    await page.getByTestId('claim-deadline').getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    const salvar = modal.getByRole('button', { name: 'Salvar ajuste' });
    await expect(salvar).toBeDisabled();

    await modal.getByLabel('Novo início').fill(dayInput(-27));
    await expect(salvar).toBeDisabled();
    await modal.getByLabel('Justificativa *').fill('abc');
    await expect(salvar).toBeDisabled();
    await modal.getByLabel('Justificativa *').fill('Documentos entregues por e-mail');
    await expect(salvar).toBeEnabled();
    await salvar.click();
    await expect(modal).toHaveCount(0);

    // 30 dias a partir de 27 dias atrás: faltam 3, e com 5 ou menos fica vermelho.
    const status = page.getByTestId('deadline-status');
    await expect(status).toHaveText('3 dias restantes');
    await expect(status).toHaveAttribute('data-state', 'urgent');
    await expect(status).toHaveClass(/text-red-600/);
    await expect(page.getByTestId('deadline-start')).toContainText('ajustado');

    const hist = page.getByTestId('deadline-history');
    await expect(hist).toContainText('Ricardo Silva');
    await expect(hist).toContainText('Início: — →');
    await expect(hist).toContainText('Documentos entregues por e-mail');
});

test('vencimento no passado mostra o prazo vencido; data invertida mostra o erro', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    const abrir = () => page.getByTestId('claim-deadline').getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });

    await abrir();
    await modal.getByLabel('Novo início').fill(dayInput(-40));
    await modal.getByLabel('Novo vencimento').fill(dayInput(-2));
    await modal.getByLabel('Justificativa *').fill('Prazo contratual menor');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(page.getByTestId('deadline-status')).toHaveText('Vencido há 2 dias');
    await expect(page.getByTestId('deadline-status')).toHaveAttribute('data-state', 'overdue');

    await abrir();
    await modal.getByLabel('Novo vencimento').fill(dayInput(-60));
    await modal.getByLabel('Justificativa *').fill('Teste de data invertida');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(modal.getByRole('alert')).toHaveText('O vencimento não pode ser anterior ao início.');
});

test('no celular o modal de ajuste fica por cima da página inteira', async ({ page }) => {
    // O cartão tem backdrop-filter: um modal "fixed" dentro dele ficava preso
    // ao cartão, atrás das abas, e o Salvar não recebia o clique.
    await page.setViewportSize({ width: 360, height: 780 });
    await signIn(page, 'manager');
    await page.goto(CLAIM);

    await page.getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    await modal.getByLabel('Novo início').fill(dayInput(-1));
    await modal.getByLabel('Justificativa *').fill('Obrigatórios entregues');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click({ timeout: 5000 });
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId('deadline-status')).toHaveText(/^(29|30) dias restantes$/);
});

test('o prazo ajustado no sinistro já aparece no álbum', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await page.getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    await modal.getByLabel('Novo início').fill(dayInput(-26));
    await modal.getByLabel('Justificativa *').fill('Obrigatórios entregues');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(page.getByTestId('deadline-status')).toHaveText('4 dias restantes');

    await page.getByRole('link', { name: 'Lista de Sinistros' }).click();
    const prazo = page.getByTestId('album-card').filter({ hasText: 'SD - 2024-001' }).getByTestId('album-prazo');
    await expect(prazo).toHaveText('4 dias');
    await expect(prazo).toHaveClass(/text-red-600/);
});

// No mock não há servidor para iniciar o prazo: o cartão aplica a mesma regra
// sobre o board guardado no navegador — todo obrigatório com arquivo no deck
// (ou marcado) inicia os 30 dias.
test('no mock o prazo começa quando o último obrigatório recebe arquivo', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    const status = page.getByTestId('deadline-status');
    await expect(status).toHaveText('Aguardando documentos obrigatórios');

    const enviar = async (key, nome) => {
        await page.getByTestId('column-pendente').getByTestId(`task-${key}`).click();
        const modal = page.getByTestId('upload-modal');
        await modal.locator('input[type=file]').setInputFiles({ name: nome, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 ${nome}`) });
        await modal.getByRole('button', { name: 'Confirmar' }).click();
        await expect(modal).toHaveCount(0);
    };

    await page.getByRole('tab', { name: /^Causa/ }).click();
    await enviar('f1-1.bo', 'bo.pdf');
    await enviar('f1-1.laudo', 'laudo.pdf');
    // Ainda falta o orçamento, na pasta Prejuízo.
    await expect(status).toHaveText('Aguardando documentos obrigatórios');

    await page.getByRole('tab', { name: /^Prejuízo/ }).click();
    await enviar('f2-1.orcamento', 'orcamento.pdf');
    await expect(status).toHaveText('30 dias restantes');
    await expect(page.getByTestId('deadline-start')).toContainText('automático');

    // O início automático volta para o sinistro e aparece no álbum.
    await page.getByRole('link', { name: 'Lista de Sinistros' }).click();
    await expect(page.getByTestId('album-card').filter({ hasText: 'SD - 2024-001' }).getByTestId('album-prazo')).toHaveText('30 dias');
});

// Antes do início o cartão continua aguardando, mas um vencimento ajustado já
// vale — e as listas contam por ele —, então aparece no cartão.
test('vencimento ajustado sem início aparece no cartão enquanto aguarda', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto(CLAIM);
    await expect(page.getByTestId('deadline-due')).toHaveCount(0);

    await page.getByRole('button', { name: 'Ajustar prazo' }).click();
    const modal = page.getByRole('dialog', { name: 'Ajustar prazo' });
    await modal.getByLabel('Novo vencimento').fill(dayInput(12));
    await modal.getByLabel('Justificativa *').fill('Seguradora fixou a data de entrega');
    await modal.getByRole('button', { name: 'Salvar ajuste' }).click();
    await expect(modal).toHaveCount(0);

    const [y, m, d] = dayInput(12).split('-');
    await expect(page.getByTestId('deadline-status')).toHaveText('Aguardando documentos obrigatórios');
    await expect(page.getByTestId('deadline-due')).toHaveText(`Vence ${d}/${m}/${y} · ajustado`);
});
