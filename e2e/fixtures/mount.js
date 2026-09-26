import { expect } from '@playwright/test';

/**
 * Monta um componente sozinho (ver e2e/harness/mount.jsx). Abre antes uma
 * página do app para que o dev server já tenha preparado o React e o
 * preâmbulo do react-refresh, sem os quais o módulo não carrega.
 */
export async function mountComponent(page, name, props, { from = '/app' } = {}) {
    await page.goto(from);
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.evaluate(async ({ name, props }) => {
        const mod = await import('/e2e/harness/mount.jsx');
        mod.mount(name, props);
    }, { name, props });
}
