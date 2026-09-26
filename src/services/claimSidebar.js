import { isMockEnabled, getToken } from '../api/client';
import { getProcessStorage } from '../api/storage';
import { listProcessAudit } from '../api/processAudit';
import { filesKey } from '../api/deckBoard';

// Dados do cartão lateral do sinistro que não vêm no próprio processo:
// armazenamento e última atividade. Com API, cada um é uma rota; no modo mock
// (ou sem token) são derivados do que o navegador já guarda, para a demo
// mostrar o mesmo cartão.

const online = () => !isMockEnabled() && !!getToken();

function mockFiles(claim) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(filesKey(claim.id)) || 'null'); } catch { /* ignore */ }
    const boardFiles = Array.isArray(stored) ? stored : [];
    const folderDocs = (claim.folders || []).flatMap(f => f.documents || []);
    return { boardFiles, folderDocs };
}

// → { bytes, file_count }
export async function loadStorage(claim) {
    if (online()) {
        const res = await getProcessStorage(claim.id);
        const d = res?.data || res || {};
        return { bytes: Number(d.bytes) || 0, file_count: Number(d.file_count) || 0 };
    }
    const { boardFiles, folderDocs } = mockFiles(claim);
    const bytes = boardFiles.reduce((s, f) => s + (Number(f.tamanho) || 0), 0)
        + folderDocs.reduce((s, d) => s + (Number(d.size_bytes) || 0), 0);
    return { bytes, file_count: boardFiles.length + folderDocs.length };
}

// → { actor, action, timestamp } | null. `action` é o código do servidor;
// quem mostra traduz com ACTION_LABELS.
export async function loadLastActivity(claim) {
    if (online()) {
        const res = await listProcessAudit(claim.id, { limit: 1 });
        const e = Array.isArray(res?.data) ? res.data[0] : null;
        if (!e) return null;
        return {
            actor: e.actor_name || e.actor_email || (e.share_token_id ? 'Link público' : 'Sistema'),
            action: e.action,
            timestamp: e.timestamp,
            metadata: e.metadata || {},
        };
    }
    const a = (claim.activities || [])[0];
    if (!a) return null;
    return { actor: a.user, text: a.action, when: a.date };
}
