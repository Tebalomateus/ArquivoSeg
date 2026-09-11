import { test, expect } from '@playwright/test';
import { installIamApi } from './fixtures/iam-api.js';
import { signIn } from './fixtures/session.js';

/**
 * A lista de usuários é a primeira tela de Acessos, e num tenant maduro é uma
 * lista longa de gente com dezenas de papéis. O que se testa aqui é o que a
 * mantém utilizável nesse tamanho: a busca alcança papel e grupo, não só
 * e-mail, e a linha não cresce sem limite.
 */
test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
});

const linha = (page, email) => page.getByRole('link', { name: new RegExp(email.replace(/\./g, '\\.')) });

test('buscar pelo nome do papel encontra quem o tem direto', async ({ page }) => {
    await installIamApi(page, (s) => {
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/usuarios');

    await expect(linha(page, 'ana.souza@allianz.com')).toContainText('Leitor');

    await page.getByPlaceholder('Buscar por e-mail, papel, grupo ou status').fill('leitor');
    await expect(linha(page, 'ana.souza@allianz.com')).toBeVisible();
    // O admin não tem o papel Leitor — some da busca.
    await expect(linha(page, 'sato@arquivoseg.com.br')).toHaveCount(0);
});

test('buscar pelo grupo encontra quem é membro, mesmo sem papel direto', async ({ page }) => {
    await installIamApi(page);
    await page.goto('/admin/acessos/usuarios');

    await page.getByPlaceholder('Buscar por e-mail, papel, grupo ou status').fill('regulação');
    // u-maria está no grupo Equipe de Regulação e não tem papel direto nenhum.
    await expect(linha(page, 'analista@arquivoseg.com.br')).toBeVisible();
    await expect(linha(page, 'ana.souza@allianz.com')).toHaveCount(0);
});

test('o prefixo papel: não deixa o termo vazar para o e-mail', async ({ page }) => {
    await installIamApi(page, (s) => {
        // Alguém cujo e-mail contém "leitor" mas que não tem o papel.
        s.users.push({ id: 'u-leitor', email: 'leitor.externo@parceiro.com', role: 'user', status: 'active' });
        s.userRoles['u-leitor'] = [];
        s.individual['u-leitor'] = [];
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/usuarios');

    const busca = page.getByPlaceholder('Buscar por e-mail, papel, grupo ou status');
    await busca.fill('leitor');
    await expect(linha(page, 'leitor.externo@parceiro.com')).toBeVisible();

    await busca.fill('papel: leitor');
    await expect(linha(page, 'ana.souza@allianz.com')).toBeVisible();
    await expect(linha(page, 'leitor.externo@parceiro.com')).toHaveCount(0);
});

test('a linha colapsa o excesso de papéis em vez de crescer', async ({ page }) => {
    await installIamApi(page, (s) => {
        const ids = [];
        for (let i = 1; i <= 6; i++) {
            const id = `r-extra-${i}`;
            s.roles.push({
                id,
                key: `extra-${i}`,
                name: `Papel Extra ${i}`,
                description: '',
                is_system: false,
                permissions: ['processo.ver'],
            });
            ids.push(id);
        }
        s.userRoles['u-ana'] = ids;
    });
    await page.goto('/admin/acessos/usuarios');

    const ana = linha(page, 'ana.souza@allianz.com');
    await expect(ana).toContainText('Papel Extra 1');
    await expect(ana).toContainText('+3');
    await expect(ana).not.toContainText('Papel Extra 6');
});

test('com muitos papéis o seletor da pessoa ganha filtro', async ({ page }) => {
    await installIamApi(page, (s) => {
        for (let i = 1; i <= 10; i++) {
            s.roles.push({
                id: `r-extra-${i}`,
                key: `extra-${i}`,
                name: `Papel Extra ${i}`,
                description: '',
                is_system: false,
                permissions: ['processo.ver'],
            });
        }
    });
    await page.goto('/admin/acessos/usuarios/u-ana');

    const filtro = page.getByPlaceholder(/Filtrar 12 papéis/);
    await expect(filtro).toBeVisible();
    await filtro.fill('Extra 7');
    await expect(page.getByRole('checkbox', { name: /Papel Extra 7/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Leitor/ })).toHaveCount(0);
});

test('o que já está marcado continua visível durante o filtro', async ({ page }) => {
    await installIamApi(page, (s) => {
        for (let i = 1; i <= 10; i++) {
            s.roles.push({
                id: `r-extra-${i}`,
                key: `extra-${i}`,
                name: `Papel Extra ${i}`,
                description: '',
                is_system: false,
                permissions: ['processo.ver'],
            });
        }
        s.userRoles['u-ana'] = ['r-leitor'];
    });
    await page.goto('/admin/acessos/usuarios/u-ana');

    await page.getByPlaceholder(/Filtrar 12 papéis/).fill('Extra 7');
    // Esconder o que está marcado é como um papel some sem ninguém querer.
    await expect(page.getByRole('checkbox', { name: /Leitor/ })).toBeChecked();
});
