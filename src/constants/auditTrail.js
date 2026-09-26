// Vocabulário da trilha de auditoria do sinistro (components/ClaimAuditTrail).
//
// Os códigos vêm de process-manager/internal/domain/audit/model.go. Código que
// não está aqui aparece cru na trilha: um evento novo do servidor não pode
// sumir só porque o front ainda não tem frase para ele.

import { parseFolderFromFileName } from '../api/files';

// Agrupados como o filtro "Tipo de ação" mostra.
export const ACTION_GROUPS = [
    {
        label: 'Sinistro',
        actions: {
            'process.created': 'Sinistro criado',
            'process.updated': 'Dados do sinistro atualizados',
            'process.status_changed': 'Status alterado',
            'process.deleted': 'Sinistro arquivado',
            'process.deadline_started': 'Prazo regulatório iniciado',
            'process.deadline_adjusted': 'Prazo ajustado',
            'checklist_item.added': 'Item incluído no checklist',
            'checklist_item.removed': 'Item removido do checklist',
        },
    },
    {
        label: 'Documentos',
        actions: {
            'file.uploaded': 'Documento enviado',
            'file.downloaded': 'Documento baixado',
            'file.deleted': 'Documento excluído',
        },
    },
    {
        label: 'Decks',
        actions: {
            'deck.created': 'Deck criado',
            'deck.files_changed': 'Arquivos do deck alterados',
            'deck.task_attached': 'Tarefa juntada ao deck',
            'deck.task_detached': 'Tarefa retirada do deck',
            'deck.submitted': 'Deck enviado para análise',
            'deck.analyzed': 'Deck analisado',
            'deck.downloaded': 'Arquivos do deck baixados',
        },
    },
    {
        label: 'Comentários',
        actions: {
            'comment.created': 'Comentário registrado',
            'comment.updated': 'Comentário editado',
            'comment.deleted': 'Comentário removido',
        },
    },
    {
        label: 'Links e acessos',
        actions: {
            'share.created': 'Link de compartilhamento criado',
            'share.revoked': 'Link de compartilhamento revogado',
            'share.accessed': 'Link público acessado',
            'share.internal_accessed': 'Link interno acessado',
            'canary.pinged': 'Documento rastreado aberto',
        },
    },
];

const LABELS = Object.assign({}, ...ACTION_GROUPS.map((g) => g.actions));

export function actionLabel(code) {
    return LABELS[code] || code;
}

const STATUS_LABELS = {
    ready: 'Aberto', open: 'Aberto', ongoing: 'Em análise', review: 'Em revisão', done: 'Concluído', archived: 'Arquivado',
};
const DEADLINE_FIELDS = { start_at: 'Início', due_at: 'Vencimento' };

function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR');
}

function fileName(meta) {
    const raw = meta.file_name ?? meta.fileName ?? meta.nome ?? null;
    return raw ? parseFolderFromFileName(raw).name : null;
}

function deckCode(meta) {
    return meta.codigo ?? meta.deck_code ?? meta.code ?? null;
}

/**
 * O que dá para dizer do recurso a partir do metadata do evento. Devolve
 * { subject, detail, note }: subject é o alvo em destaque (arquivo, deck),
 * detail o "de → para", note um texto livre (justificativa, motivo).
 * Qualquer um pode faltar — o metadata é o que o handler quis gravar.
 */
export function describeEvent(event) {
    const meta = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    const out = { subject: null, detail: null, note: null };
    const [kind] = String(event?.action || '').split('.');

    switch (event?.action) {
        case 'process.status_changed': {
            const from = meta.old_status ?? meta.from;
            const to = meta.new_status ?? meta.to;
            if (from || to) out.detail = `${STATUS_LABELS[from] || from || '—'} → ${STATUS_LABELS[to] || to || '—'}`;
            break;
        }
        case 'process.deadline_adjusted': {
            const field = DEADLINE_FIELDS[meta.field] || null;
            out.subject = field;
            if (meta.from !== undefined || meta.to !== undefined) out.detail = `${fmtDate(meta.from)} → ${fmtDate(meta.to)}`;
            out.note = meta.justification || null;
            break;
        }
        case 'process.deadline_started': {
            const start = meta.start_at ?? meta.to;
            if (start) out.detail = `a partir de ${fmtDate(start)}`;
            if (meta.due_at) out.detail = `${out.detail ? `${out.detail}, ` : ''}vence em ${fmtDate(meta.due_at)}`;
            if (meta.source === 'auto' || meta.start_source === 'auto') out.note = 'Checklist obrigatório completo.';
            break;
        }
        case 'checklist_item.added':
        case 'checklist_item.removed':
            out.subject = meta.label ?? meta.name ?? meta.item_key ?? null;
            out.note = meta.reason || null;
            break;
        // A análise é o único evento de decisão do deck: aprovar e devolver
        // são o mesmo deck.analyzed, e o que foi devolvido vem em devolvidas.
        case 'deck.analyzed': {
            out.subject = deckCode(meta);
            const devolvidas = Array.isArray(meta.devolvidas) ? meta.devolvidas.length : null;
            if (devolvidas) out.detail = `${devolvidas} ${devolvidas === 1 ? 'tarefa devolvida' : 'tarefas devolvidas'}`;
            else if (devolvidas === 0) out.detail = 'tudo aceito';
            out.note = meta.motivo || meta.reason || null;
            break;
        }
        case 'comment.created':
        case 'comment.updated':
            out.note = meta.body || meta.excerpt || null;
            break;
        case 'share.created':
            out.subject = fileName(meta) || meta.label || null;
            if (meta.expires_at) out.detail = `expira em ${fmtDate(meta.expires_at)}`;
            break;
        default:
            if (kind === 'file' || kind === 'share' || kind === 'canary') out.subject = fileName(meta);
            if (kind === 'deck') out.subject = deckCode(meta);
    }

    if (kind === 'file' && meta.version > 1) out.detail = out.detail || `versão ${meta.version}`;
    if (event?.action === 'deck.downloaded' && Array.isArray(meta.arquivos)) {
        out.detail = `${meta.arquivos.length} ${meta.arquivos.length === 1 ? 'arquivo' : 'arquivos'}`;
    }
    // O IP é coluna do log (ip_address no evento), não metadata.
    if ((event?.action === 'share.accessed' || event?.action === 'canary.pinged') && event.ip_address) {
        out.detail = `IP ${event.ip_address}`;
    }
    if (event?.action === 'deck.submitted' && Array.isArray(meta.tarefas)) {
        out.detail = `${meta.tarefas.length} ${meta.tarefas.length === 1 ? 'tarefa' : 'tarefas'}`;
    }
    if (event?.action === 'deck.created' && Array.isArray(meta.tarefa_ids)) {
        out.detail = `${meta.tarefa_ids.length} ${meta.tarefa_ids.length === 1 ? 'tarefa' : 'tarefas'}`;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Pessoas e cores
// ---------------------------------------------------------------------------

export const EXTERNAL_ACTOR = 'externo';

// Doze tons com contraste de pelo menos 3:1 sobre branco (o mínimo para
// elemento gráfico), escolhidos para não se confundirem entre si nem com o
// cinza neutro do acesso externo. A cor nunca é a única pista: o nome da
// pessoa está em toda linha e na legenda.
export const ACTOR_PALETTE = [
    '#2563eb', // azul
    '#c026d3', // magenta
    '#ea580c', // laranja
    '#0d9488', // verde-azulado
    '#7c3aed', // violeta
    '#dc2626', // vermelho
    '#a16207', // mostarda
    '#0891b2', // ciano
    '#db2777', // rosa
    '#4d7c0f', // oliva
    '#4f46e5', // anil
    '#b45309', // âmbar
];
export const EXTERNAL_COLOR = '#64748b';

export function actorKey(event) {
    return event?.actor_user_id || EXTERNAL_ACTOR;
}

export function actorName(event) {
    if (!event?.actor_user_id) return 'Acesso externo';
    return event.actor_name || event.actor_email || `Usuário ${String(event.actor_user_id).slice(0, 8)}`;
}

// FNV-1a: estável entre sessões e navegadores, que é o que faz a mesma pessoa
// ter a mesma cor amanhã.
function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Dá a cor de `key` sem mexer nas que já foram dadas. A preferida sai do hash
 * do id; se outra pessoa já está com ela, pega o próximo tom livre. `taken` é o
 * Map key→cor da tela, que só cresce — carregar mais eventos nunca troca a cor
 * de quem já estava lá.
 */
export function assignColor(key, taken) {
    if (taken.has(key)) return taken.get(key);
    if (key === EXTERNAL_ACTOR) {
        taken.set(key, EXTERNAL_COLOR);
        return EXTERNAL_COLOR;
    }
    const used = new Set(taken.values());
    const start = hash(String(key)) % ACTOR_PALETTE.length;
    let color = ACTOR_PALETTE[start];
    for (let i = 0; i < ACTOR_PALETTE.length; i++) {
        const c = ACTOR_PALETTE[(start + i) % ACTOR_PALETTE.length];
        if (!used.has(c)) { color = c; break; }
    }
    taken.set(key, color);
    return color;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
    : null;

export function relativeTime(iso, now = Date.now()) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = (t - now) / 1000;
    const abs = Math.abs(diff);
    if (abs < 45) return 'agora há pouco';
    if (!rtf) return absoluteTime(iso);
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
    return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export function absoluteTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
