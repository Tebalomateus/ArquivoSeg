import { api, isMockEnabled } from './client';
import { DEFAULT_CLAIM_TYPE, MOCK_CLAIM_TYPES, prettifySlug } from '../constants/claimTypes';

export function listChecklistTypes() {
    return api.get('/api/v1/checklists');
}

export function getChecklistDef(claimType) {
    return api.get(`/api/v1/checklists/${encodeURIComponent(claimType)}`);
}

/**
 * Tipos de sinistro para o seletor da abertura, como [{ type, title }].
 * O servidor manda `items` com o título; um servidor anterior só manda os
 * slugs em `data`. Sem tipo nenhum (ou no mock), fica o modelo padrão.
 */
export async function loadClaimTypes() {
    if (isMockEnabled()) return MOCK_CLAIM_TYPES.map(({ type, title }) => ({ type, title }));
    let types = [];
    try {
        const res = await listChecklistTypes();
        types = Array.isArray(res?.items) && res.items.length > 0
            ? res.items.map(it => ({ type: it.type, title: it.title || prettifySlug(it.type) }))
            : (res?.data || []).map(slug => ({ type: slug, title: prettifySlug(slug) }));
    } catch {
        types = [];
    }
    if (types.length === 0) return [{ type: DEFAULT_CLAIM_TYPE.type, title: DEFAULT_CLAIM_TYPE.title }];
    return types;
}

// Definição de um tipo. O padrão embutido responde quando o servidor não o tem.
export async function loadClaimTypeDef(type) {
    if (isMockEnabled()) return MOCK_CLAIM_TYPES.find(t => t.type === type) || DEFAULT_CLAIM_TYPE;
    try {
        return await getChecklistDef(type);
    } catch (err) {
        if (type === DEFAULT_CLAIM_TYPE.type) return DEFAULT_CLAIM_TYPE;
        throw err;
    }
}
