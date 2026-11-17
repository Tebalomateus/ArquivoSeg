import { test, expect } from '@playwright/test';
import { abrirEtapa, expectEtapas } from './fixtures/etapas.js';
import { signIn } from './fixtures/session.js';

/**
 * Tipo de sinistro → etapas, na abertura.
 *
 * O tipo escolhido traz as etapas e os itens de cada uma; o que se edita aqui
 * (nome, item novo, item removido, obrigatório) vale só para este sinistro. Ao
 * criar, cada etapa vira uma pasta, e o sinistro mostra as etapas em ordem
 * num seletor, com o disclaimer no topo de todas.
 *
 * Modo mock: os tipos são o Padrão e o Incêndio de src/constants/claimTypes.js.
 */

const abrir = async (page) => {
    await signIn(page, 'contributor');
    await page.goto('/app/sinistros/novo');
    await expect(page.getByRole('heading', { name: 'Abrir Novo Sinistro' })).toBeVisible();
};

const preencherObrigatorios = async (page, numero) => {
    await page.locator('#campo-claimNumber').fill(numero);
    await page.locator('#campo-insurer').selectOption('__other__');
    await page.getByPlaceholder('Digite o nome da seguradora').fill('Seguradora E2E');
    await page.locator('#campo-insuredName').fill('Fulano de Tal');
};

const etapas = (page) => page.getByTestId('claim-steps').locator('ol > li');
const etapa = (page, titulo) => page.getByTestId('claim-steps').getByRole('listitem', { name: new RegExp(`^Etapa \\d+: ${titulo}$`) });

test('o modelo padrão já vem escolhido, com Causa, Prejuízo e Liquidação', async ({ page }) => {
    await abrir(page);

    await expect(page.locator('#campo-claimType')).toHaveValue('padrao');
    await expect(page.locator('#campo-claimType option')).toHaveText(['Selecione o tipo...', 'Padrão', 'Incêndio']);
    await expect(etapas(page).locator('h4')).toHaveText(['Causa', 'Prejuízo', 'Liquidação']);

    const causa = etapa(page, 'Causa');
    await expect(causa.getByRole('textbox')).toHaveCount(7);
    await expect(causa.getByRole('textbox').first()).toHaveValue('Apólice de Seguro');
    // Procuração vem como não obrigatória no modelo.
    const procuracao = causa.getByRole('listitem').filter({ has: page.locator('input[value="Procuração / Carta de Preposto"]') });
    await expect(procuracao.getByRole('checkbox', { name: 'Obrigatório' })).not.toBeChecked();
});

test('seguradora e modalidade não mexem nos itens', async ({ page }) => {
    await abrir(page);
    await expect(etapa(page, 'Prejuízo').getByRole('textbox')).toHaveCount(3);

    await page.locator('#campo-insurer').selectOption('Allianz');
    await page.locator('#campo-modality').selectOption({ index: 1 });

    await expect(etapas(page).locator('h4')).toHaveText(['Causa', 'Prejuízo', 'Liquidação']);
    await expect(etapa(page, 'Prejuízo').getByRole('textbox')).toHaveCount(3);
});

test('trocar o tipo recarrega as etapas, e pede confirmação se houve edição', async ({ page }) => {
    await abrir(page);

    await page.locator('#campo-claimType').selectOption('incendio');
    await expect(etapas(page).locator('h4')).toHaveText(['Aviso', 'Causa', 'Prejuízo', 'Liquidação']);
    await expect(etapa(page, 'Liquidação')).toContainText('Nenhum item nesta etapa.');

    await etapa(page, 'Aviso').getByRole('button', { name: 'Remover Apólice de Seguro' }).click();
    await page.locator('#campo-claimType').selectOption('padrao');
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('Trocar o tipo de sinistro?');
    await dialog.getByRole('button', { name: 'Manter' }).click();
    await expect(etapas(page).locator('h4')).toHaveText(['Aviso', 'Causa', 'Prejuízo', 'Liquidação']);
    await expect(etapa(page, 'Aviso').getByRole('textbox')).toHaveCount(1);
});

test('item sem nome impede criar e o erro aponta a linha', async ({ page }) => {
    await abrir(page);
    await preencherObrigatorios(page, '2026-880');

    await etapa(page, 'Liquidação').getByRole('button', { name: 'Adicionar item' }).click();
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();

    await expect(page).toHaveURL(/\/app\/sinistros\/novo$/);
    await expect(page.getByRole('alert')).toContainText('Há item sem nome nas etapas.');
    await expect(page.locator('#campo-checklist')).toBeFocused();
});

test('o sinistro nasce com as etapas editadas e o disclaimer no topo', async ({ page }) => {
    await abrir(page);
    await preencherObrigatorios(page, '2026-881');

    await page.locator('#campo-claimType').selectOption('incendio');
    const aviso = etapa(page, 'Aviso');
    await aviso.getByRole('textbox').first().fill('Aviso de Sinistro assinado');
    await aviso.getByRole('button', { name: 'Adicionar item' }).click();
    await aviso.getByRole('textbox').last().fill('Carta da corretora');
    await aviso.getByRole('checkbox', { name: 'Obrigatório' }).last().uncheck();
    await etapa(page, 'Prejuízo').getByRole('button', { name: 'Remover Orçamentos de Reparo (3x)' }).click();

    await page.locator('#campo-disclaimer').fill('Segurado só atende pela manhã.');
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros\/[^/]+$/);

    // As etapas, em ordem, no menu da aba de etapas; a pasta privada não é etapa.
    // A aba abre na primeira.
    await expect(page.getByTestId('step-select-trigger')).toHaveText(/^Aviso \(0%\)$/);
    await expect(page.getByTestId('step-select-trigger')).toHaveAttribute('aria-selected', 'true');
    await expectEtapas(page, [/^Aviso \(0%\)$/, /^Causa \(0%\)$/, /^Prejuízo \(0%\)$/, /^Liquidação \(0%\)$/]);

    const banner = page.getByRole('note', { name: 'Disclaimer' });
    await expect(banner).toHaveText('Segurado só atende pela manhã.');
    await abrirEtapa(page, /^Prejuízo/);
    await expect(banner).toBeVisible();

    // Os itens que ficaram viram as tarefas da etapa.
    await abrirEtapa(page, /^Aviso/);
    await expect(page.getByRole('paragraph').filter({ hasText: 'Aviso de Sinistro assinado' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Carta da corretora' })).toBeVisible();
    await abrirEtapa(page, /^Prejuízo/);
    await expect(page.getByRole('paragraph').filter({ hasText: 'Planilha de Bens Danificados' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Orçamentos de Reparo' })).toHaveCount(0);

    // Quem edita o sinistro edita o disclaimer ali mesmo.
    await banner.getByRole('button', { name: 'Editar disclaimer' }).click();
    await page.locator('#disclaimer-edit').fill('Ligar só depois das 14h.');
    await page.getByRole('button', { name: 'Salvar disclaimer' }).click();
    await expect(page.getByRole('note', { name: 'Disclaimer' })).toHaveText('Ligar só depois das 14h.');
});

test('sem disclaimer não há faixa, só o botão de adicionar', async ({ page }) => {
    await abrir(page);
    await preencherObrigatorios(page, '2026-882');
    await page.getByRole('button', { name: 'Criar Sinistro' }).click();
    await expect(page).toHaveURL(/\/app\/sinistros\/[^/]+$/);

    await expectEtapas(page, [/^Causa/, /^Prejuízo/, /^Liquidação/]);
    await expect(page.getByRole('note', { name: 'Disclaimer' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Adicionar disclaimer' }).click();
    await page.locator('#disclaimer-edit').fill('Prioridade alta.');
    await page.getByRole('button', { name: 'Salvar disclaimer' }).click();
    await expect(page.getByRole('note', { name: 'Disclaimer' })).toHaveText('Prioridade alta.');
});
