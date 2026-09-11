import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * As conferências do formulário de abertura.
 *
 * O que se abre aqui vira a verdade do processo inteiro: a vigência que este
 * formulário grava é a que decide, mais tarde, se a ocorrência é coberta. Um
 * dígito trocado numa data não aparece hoje — aparece na análise, com o
 * processo já montado e os documentos já cobrados.
 *
 * A divisão que estes testes fixam é entre o dado errado, que impede criar, e o
 * dado que falta, que não impede: no primeiro aviso de sinistro é normal ainda
 * não se ter o número da apólice.
 *
 * Roda no modo mock, onde o formulário grava no estado local — o que se afirma
 * é a conferência, não a persistência.
 */

const abrir = async (page) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros/novo');
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toBeVisible();
};

const criar = (page) => page.getByRole('button', { name: 'Criar Sinistro' }).click();

test('o formulário abre sem reclamar de campo vazio', async ({ page }) => {
    await abrir(page);
    // Campo em branco só vira erro depois de alguém tentar criar: reclamar de
    // um campo cuja vez ainda não chegou é ruído.
    await expect(page.getByRole('alert')).toHaveCount(0);
});

test('sem os obrigatórios, criar não cria e o formulário diz o que falta', async ({ page }) => {
    await abrir(page);
    await criar(page);

    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
    const resumo = page.getByRole('alert');
    await expect(resumo).toContainText('Informe o número do sinistro.');
    await expect(resumo).toContainText('Selecione ou digite a seguradora.');
    await expect(resumo).toContainText('Informe o nome do segurado.');
});

test('a ocorrência fora da vigência não passa, e o erro diz qual data mandou', async ({ page }) => {
    await abrir(page);

    await page.locator('#campo-claimNumber').fill('2026-777');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
    await page.locator('#campo-policyStartDate').fill('2026-01-01');
    await page.locator('#campo-policyEndDate').fill('2026-06-30');

    // Depois do fim da vigência.
    await page.locator('#campo-occurrenceDate').fill('2026-07-15');
    await expect(page.getByText('posterior ao fim da vigência (30/06/2026)')).toBeVisible();

    // Antes do início, e sem retroativa que a alcance.
    await page.locator('#campo-occurrenceDate').fill('2025-12-01');
    await expect(page.getByText('anterior ao início da vigência (01/01/2026)')).toBeVisible();

    await criar(page);
    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
});

test('a retroativa cobre a ocorrência anterior à vigência, e isso é aviso e não erro', async ({ page }) => {
    await abrir(page);

    await page.locator('#campo-claimNumber').fill('2026-778');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
    await page.locator('#campo-policyStartDate').fill('2026-01-01');
    await page.locator('#campo-policyEndDate').fill('2026-12-31');
    await page.locator('#campo-occurrenceDate').fill('2025-03-10');

    await expect(page.getByText('anterior ao início da vigência')).toBeVisible();

    // É exatamente para isto que a retroativa existe.
    await page.locator('#campo-retroactiveDate').fill('2025-01-01');
    await expect(page.getByText('anterior ao início da vigência')).toHaveCount(0);
    await expect(page.getByText('coberta pela retroativa de 01/01/2025')).toBeVisible();

    await criar(page);
    await expect(page).toHaveURL(/\/app\/sinistros\/[^/]+$/);
});

test('a retroativa posterior ao início da vigência é data trocada de campo', async ({ page }) => {
    await abrir(page);

    await page.locator('#campo-policyStartDate').fill('2026-01-01');
    await page.locator('#campo-retroactiveDate').fill('2026-05-01');

    await expect(page.getByText('A retroativa é anterior ao início da vigência, não posterior.')).toBeVisible();
});

test('fim de vigência antes do início não passa', async ({ page }) => {
    await abrir(page);

    await page.locator('#campo-policyStartDate').fill('2026-06-01');
    await page.locator('#campo-policyEndDate').fill('2026-01-01');

    await expect(page.getByText('O fim da vigência é anterior ao início.')).toBeVisible();
});

test('o que apenas falta é aviso: o sinistro é criado assim mesmo', async ({ page }) => {
    await abrir(page);

    // Sem apólice, sem vigência, sem data da ocorrência — o primeiro aviso de
    // sinistro costuma chegar assim.
    await expect(page.getByText('Sem a vigência não dá para conferir se a ocorrência está coberta.')).toBeVisible();

    await page.locator('#campo-claimNumber').fill('2026-779');
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');

    await criar(page);
    await expect(page).toHaveURL(/\/app\/sinistros\/[^/]+$/);
});

test('sair com o formulário preenchido pede confirmação', async ({ page }) => {
    await abrir(page);
    await page.locator('#campo-insuredName').fill('Fulano de Tal');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('não é salvo em rascunho');

    await dialog.getByRole('button', { name: 'Continuar preenchendo' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
    await expect(page.locator('#campo-insuredName')).toHaveValue('Fulano de Tal');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Sair e descartar' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros$/);
});
