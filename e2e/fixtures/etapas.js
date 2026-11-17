import { expect } from '@playwright/test';

// As etapas ficam num menu dentro de uma aba só (StepSelect): a aba mostra a
// etapa atual; as outras se escolhem no menu.
export async function abrirEtapa(page, nome) {
    await page.getByTestId('step-select-trigger').click();
    await page.getByTestId('step-menu').getByRole('menuitemradio', { name: nome }).click();
    await expect(page.getByTestId('step-menu')).toHaveCount(0);
}

// Os itens do menu, em ordem. Abre e fecha o menu.
export async function expectEtapas(page, nomes) {
    await page.getByTestId('step-select-trigger').click();
    await expect(page.getByTestId('step-menu').getByRole('menuitemradio')).toHaveText(nomes);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('step-menu')).toHaveCount(0);
}
