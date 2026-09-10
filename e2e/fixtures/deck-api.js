import zlib from 'node:zlib';
import { expect } from '@playwright/test';
import { signIn } from './session.js';

/**
 * A stateful stand-in for the process/file/deck side of the API, installed as a
 * Playwright route — the same idea as fixtures/iam-api.js, for the other half of
 * the app.
 *
 * It holds the board the way the server does (in the process's metadata, one
 * reconciled `{ decks, taskStatus, taskReturns }` per response) and it applies
 * the same invariants the Go domain applies, because the board is where the
 * front's optimistic update and the server's answer are supposed to agree:
 *
 *   - a task belongs to at most one deck; attaching moves it
 *   - a deck with no tasks left is discarded
 *   - a deck cannot be sent empty, and only a pendente deck can be sent
 *   - analysis splits the deck: what was returned goes back to pendente with a
 *     reason, what was kept turns atendido
 *
 * The zip download is a real store-method archive built here, so a spec can
 * assert the bytes the browser saved are the bytes the server sent — the
 * front's job is to not corrupt them (see api/client.js download()).
 *
 * With E2E_LIVE=1 nothing is installed and the specs hit the real backend.
 */

export const PROCESS_ID = '11111111-1111-4111-8111-111111111111';
export const ACCOUNT_ID = 'u-perito';

// Só o que as telas sob teste consultam. Um conjunto menor é o ponto: o botão de
// baixar o deck inteiro tem de sumir quando `deck.baixarArquivos` sai daqui.
export const DEFAULT_PERMISSIONS = [
    'processo.listar',
    'processo.ver',
    'arquivo.listar',
    'arquivo.subir',
    'arquivo.baixar',
    'checklist.atualizarEstado',
    'deck.listar',
    'deck.criar',
    'deck.anexarArquivo',
    'deck.anexarTarefa',
    'deck.desanexarTarefa',
    'deck.removerArquivo',
    'deck.enviar',
    'deck.analisar',
    'deck.baixarArquivos',
    'compartilhamento.criar',
];

const STATUS = { PENDENTE: 'pendente', ENVIADO: 'enviado', ATENDIDO: 'atendido' };
export const DEFAULT_RETURN_REASON = 'Documento não comprova a tarefa. Reenvie.';

export function initialState() {
    return {
        permissions: [...DEFAULT_PERMISSIONS],
        process: {
            id: PROCESS_ID,
            title: 'Sinistro E2E',
            status: 'open',
            created_at: '2026-08-01T12:00:00Z',
            updated_at: '2026-08-01T12:00:00Z',
            assigned_to: null,
            created_by: null,
            claim_type: null,
            metadata: {
                number: 'E2E-0001',
                insurer: 'Allianz',
                insuredName: 'Cliente de Teste',
                progress: 0,
                folders: [
                    {
                        id: 'causa', name: 'Causa', category: 'causa', completion: 0,
                        checklist: [
                            { id: 'bo', name: 'Boletim de ocorrência', received: false },
                            { id: 'laudo', name: 'Laudo pericial', received: false },
                        ],
                    },
                    {
                        id: 'prejuizo', name: 'Prejuízo', category: 'prejuizo', completion: 0,
                        checklist: [
                            { id: 'orcamento', name: 'Orçamento de reparo', received: false },
                        ],
                    },
                ],
            },
        },
        // file_versions, as the upload handler returns them.
        files: [],
        // share_tokens, como POST /files/:id/shares devolve.
        shares: [],
        board: { decks: [], seq: 0, taskStatus: {}, taskReturns: {} },
        // Injeções de falha: o caminho de erro do download só existe como
        // resposta do servidor, não há como provocá-lo pela interface.
        failUpload: null,   // { status, code, message }
        failArchive: null,  // { status, code, message }
        // Atraso, em ms, da resposta de /me/permissions. As permissões e o
        // processo viajam em paralelo: quando as permissões chegam depois, o
        // board monta sem saber ainda o que o usuário pode. Sem poder forçar
        // essa ordem, o teste só pega o bug quando a corrida sai mal.
        slowPermissions: 0,
        requests: [],
        nextId: 1,
    };
}

const ok = (body) => ({ status: 200, body });
const fail = (status, code, message) => ({ status, body: { error: { code, message, request_id: 'e2e' } } });

const now = () => new Date().toISOString();
const grupoFromKey = (key) => (key.includes('.') ? key.slice(0, key.indexOf('.')) : key);

function findDeck(state, deckId) {
    return state.board.decks.find((d) => d.id === deckId) || null;
}

/** Remove a tarefa de todo deck; deck que ficou sem tarefa nenhuma é descartado. */
function detachFromAll(board, key) {
    for (const d of board.decks) {
        const i = d.tarefaIds.indexOf(key);
        if (i >= 0) { d.tarefaIds.splice(i, 1); d.updatedAt = now(); }
    }
    board.decks = board.decks.filter((d) => d.tarefaIds.length > 0);
}

function dedupFiles(files) {
    const seen = new Set();
    const out = [];
    for (const f of files) {
        if (f.fileVerId && seen.has(f.fileVerId)) continue;
        if (f.fileVerId) seen.add(f.fileVerId);
        out.push(f);
    }
    return out;
}

function createDeck(state, { tarefaIds, arquivos }) {
    const board = state.board;
    const keys = [...new Set(tarefaIds || [])];
    if (keys.length === 0) return fail(422, 'DECK_NO_TASKS', 'Selecione ao menos uma tarefa.');
    for (const k of keys) detachFromAll(board, k);
    board.seq += 1;
    const deck = {
        id: `deck-${state.nextId++}`,
        codigo: `DECK-${String(board.seq).padStart(2, '0')}`,
        status: STATUS.PENDENTE,
        grupo: grupoFromKey(keys[0]),
        arquivos: dedupFiles(arquivos || []),
        tarefaIds: keys,
        createdBy: 'e2e',
        createdAt: now(),
        updatedAt: now(),
    };
    for (const k of keys) { board.taskStatus[k] = STATUS.PENDENTE; delete board.taskReturns[k]; }
    board.decks.push(deck);
    return ok(board);
}

function analyze(state, deck, devolvidas, motivo) {
    const board = state.board;
    if (deck.status !== STATUS.ENVIADO) return fail(422, 'DECK_NOT_SENT', 'Deck não está em análise.');
    const returned = new Set((devolvidas || []).filter((k) => deck.tarefaIds.includes(k)));
    const reason = (motivo || '').trim() || DEFAULT_RETURN_REASON;
    const kept = [];
    for (const k of deck.tarefaIds) {
        if (returned.has(k)) {
            board.taskStatus[k] = STATUS.PENDENTE;
            board.taskReturns[k] = { motivo: reason, devolvidaBy: 'e2e', devolvidaAt: now() };
        } else {
            board.taskStatus[k] = STATUS.ATENDIDO;
            delete board.taskReturns[k];
            kept.push(k);
        }
    }
    // Devolveu tudo: não sobra deck nenhum, as tarefas voltam soltas para pendente.
    if (kept.length === 0) {
        board.decks = board.decks.filter((d) => d.id !== deck.id);
        return ok(board);
    }
    deck.tarefaIds = kept;
    deck.status = STATUS.ATENDIDO;
    deck.updatedAt = now();
    return ok(board);
}

/**
 * O nome que o documento assume dentro do zip, com o mesmo desempate do servidor
 * (handler/deck_archive.go): dois arquivos de mesmo nome viram "laudo (2).pdf",
 * senão um deles sumiria calado.
 */
function archiveNames(files) {
    const used = new Map();
    return files.map((f) => {
        const name = f.nome || 'documento';
        const key = name.toLowerCase();
        const n = used.get(key) || 0;
        used.set(key, n + 1);
        if (n === 0) return name;
        const dot = name.lastIndexOf('.');
        const ext = dot > 0 ? name.slice(dot) : '';
        return `${dot > 0 ? name.slice(0, dot) : name} (${n + 1})${ext}`;
    });
}

/** Um zip store-method de verdade, montado à mão para não trazer dependência. */
// Toda ação destrutiva do board passa pelo diálogo comum. Confirmar é parte do
// caminho, então os testes fazem isso por aqui em vez de repetir o seletor.
export async function confirmar(page, label) {
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: label }).click();
    await expect(dialog).toHaveCount(0);
}

export function zipStore(entries) {
    const locals = [];
    const central = [];
    let offset = 0;

    for (const e of entries) {
        const name = Buffer.from(e.name, 'utf8');
        const data = Buffer.from(e.content);
        const crc = zlib.crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);   // version needed
        local.writeUInt16LE(0, 8);    // method: store
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, data);

        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0);
        cen.writeUInt16LE(20, 4);     // version made by
        cen.writeUInt16LE(20, 6);     // version needed
        cen.writeUInt16LE(0, 10);     // method: store
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(data.length, 20);
        cen.writeUInt32LE(data.length, 24);
        cen.writeUInt16LE(name.length, 28);
        cen.writeUInt32LE(offset, 42);
        central.push(cen, name);

        offset += local.length + name.length + data.length;
    }

    const dir = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(dir.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...locals, dir, end]);
}

/**
 * Coloca um deck já pronto no estado inicial, com os arquivos já enviados. Usar
 * para começar um spec de onde ele realmente é sobre — a análise e o download
 * partem de um deck que existe, e refazer o upload em cada um só adiciona
 * caminhos que outro spec já cobre.
 *
 *   installDeckApi(page, (s) => seedDeck(s, { tarefaIds: ['causa.bo'], status: 'enviado' }))
 */
export function seedDeck(state, { tarefaIds, arquivos = [{ nome: 'laudo.pdf', conteudo: 'conteúdo do laudo' }], status = STATUS.PENDENTE }) {
    const refs = arquivos.map((f) => {
        const content = Buffer.from(f.conteudo ?? f.nome);
        const fv = {
            id: `fv-${state.nextId++}`,
            file_name: f.nome,
            mime_type: 'application/pdf',
            size_bytes: content.length,
            version: 1,
            created_at: now(),
            uploaded_by: ACCOUNT_ID,
            content,
        };
        state.files.push(fv);
        return { fileVerId: fv.id, nome: fv.file_name, tamanho: fv.size_bytes };
    });

    state.board.seq += 1;
    const deck = {
        id: `deck-${state.nextId++}`,
        codigo: `DECK-${String(state.board.seq).padStart(2, '0')}`,
        status,
        grupo: grupoFromKey(tarefaIds[0]),
        arquivos: refs,
        tarefaIds: [...tarefaIds],
        createdBy: 'e2e',
        createdAt: now(),
        updatedAt: now(),
    };
    for (const k of deck.tarefaIds) state.board.taskStatus[k] = status;
    state.board.decks.push(deck);
    return deck;
}

/** Os bytes que o servidor mandaria para este deck, para o spec comparar. */
export function archiveFor(state, deckId) {
    const deck = findDeck(state, deckId);
    if (!deck) return null;
    const names = archiveNames(deck.arquivos);
    return zipStore(deck.arquivos.map((f, i) => ({
        name: names[i],
        content: state.files.find((fv) => fv.id === f.fileVerId)?.content ?? Buffer.alloc(0),
    })));
}

function handle(state, method, seg, body) {
    const [a, b, c, d, e] = seg;

    if (a === 'me' && b === 'permissions' && method === 'GET') {
        return ok({
            data: {
                user_id: ACCOUNT_ID,
                is_admin: false,
                permissions: state.permissions,
                policy_version: state.nextId,
            },
        });
    }

    // Um arquivo por vez, fora do deck: o download pede a URL assinada em JSON
    // (o front não segue o 302 — ver api/files.js) e o compartilhamento cria um
    // token. A "URL assinada" é uma data URL com os bytes: o <a download> que o
    // front cria navega por fora da interceptação do Playwright, então não há
    // como servi-la por page.route.
    if (a === 'files' && b && c === 'download' && method === 'GET') {
        const fv = state.files.find((x) => x.id === b);
        if (!fv) return fail(404, 'FILE_NOT_FOUND', 'file not found');
        return ok({ url: `data:${fv.mime_type || 'application/octet-stream'};base64,${fv.content.toString('base64')}` });
    }
    if (a === 'files' && b && c === 'shares' && method === 'POST') {
        const fv = state.files.find((x) => x.id === b);
        if (!fv) return fail(404, 'FILE_NOT_FOUND', 'file not found');
        const st = {
            id: `share-${state.nextId++}`,
            token: `tok-${fv.id}-${state.nextId++}`,
            file_ver_id: fv.id,
            label: body?.label ?? null,
            expires_at: body?.expires_at ?? null,
            revoked: false,
            created_by: ACCOUNT_ID,
            created_at: now(),
        };
        state.shares.push(st);
        return { status: 201, body: st };
    }

    if (a !== 'processes') return null;

    if (!b && method === 'GET') return ok({ data: [state.process], total: 1 });
    if (b !== state.process.id) return null;

    if (!c && method === 'GET') return ok(state.process);
    if (!c && method === 'PATCH') {
        // O front sincroniza metadata em background; guardar é o bastante, e
        // devolver o processo inteiro é o que o servidor faz.
        if (body?.metadata) state.process.metadata = { ...state.process.metadata, ...body.metadata };
        state.process.updated_at = now();
        return ok(state.process);
    }

    if (c === 'files' && method === 'GET') {
        return ok({ data: state.files.map(({ content, ...fv }) => fv), total: state.files.length });
    }
    if (c === 'files' && method === 'POST') {
        if (state.failUpload) {
            return fail(state.failUpload.status, state.failUpload.code, state.failUpload.message);
        }
        const fv = {
            id: `fv-${state.nextId++}`,
            file_name: body.fileName,
            mime_type: body.contentType || 'application/octet-stream',
            size_bytes: body.content.length,
            version: 1,
            created_at: now(),
            uploaded_by: ACCOUNT_ID,
            content: body.content,
        };
        state.files.push(fv);
        const { content, ...view } = fv;
        return ok(view);
    }

    if (c !== 'decks') return null;
    if (!d && method === 'GET') return ok(state.board);
    if (!d && method === 'POST') return createDeck(state, body || {});

    const deck = findDeck(state, d);
    if (!deck) return fail(404, 'DECK_NOT_FOUND', 'deck not found');

    if (e === 'arquivos.zip' && method === 'GET') {
        if (state.failArchive) {
            return fail(state.failArchive.status, state.failArchive.code, state.failArchive.message);
        }
        if (deck.arquivos.length === 0) {
            return fail(422, 'DECK_NO_FILES', 'this deck has no files to download');
        }
        return {
            status: 200,
            binary: archiveFor(state, deck.id),
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${deck.codigo}.zip"`,
                'X-Content-Type-Options': 'nosniff',
            },
        };
    }

    if (e === 'arquivos' && method === 'POST') {
        deck.arquivos = dedupFiles([...deck.arquivos, ...(body?.arquivos || [])]);
        deck.updatedAt = now();
        return ok(state.board);
    }
    if (seg[4] === 'arquivos' && seg[5] && method === 'DELETE') {
        deck.arquivos = deck.arquivos.filter((f) => f.fileVerId !== decodeURIComponent(seg[5]));
        deck.updatedAt = now();
        return ok(state.board);
    }

    if (e === 'tarefas' && method === 'POST') {
        if (deck.status !== STATUS.PENDENTE) {
            return fail(422, 'DECK_NOT_PENDING', 'Só é possível juntar tarefas a um deck pendente.');
        }
        for (const k of [...new Set(body?.tarefaIds || [])]) {
            detachFromAll(state.board, k);
            if (!deck.tarefaIds.includes(k)) deck.tarefaIds.push(k);
            state.board.taskStatus[k] = STATUS.PENDENTE;
            delete state.board.taskReturns[k];
        }
        deck.updatedAt = now();
        return ok(state.board);
    }
    if (seg[4] === 'tarefas' && seg[5] && method === 'DELETE') {
        const key = decodeURIComponent(seg[5]);
        deck.tarefaIds = deck.tarefaIds.filter((k) => k !== key);
        state.board.taskStatus[key] = STATUS.PENDENTE;
        if (deck.tarefaIds.length === 0) {
            state.board.decks = state.board.decks.filter((x) => x.id !== deck.id);
        }
        return ok(state.board);
    }

    if (e === 'enviar' && method === 'POST') {
        if (deck.status !== STATUS.PENDENTE) return fail(422, 'DECK_NOT_PENDING', 'Deck não está pendente.');
        if (deck.arquivos.length === 0) return fail(422, 'DECK_NO_FILES', 'Anexe ao menos um arquivo antes de enviar.');
        deck.status = STATUS.ENVIADO;
        deck.updatedAt = now();
        for (const k of deck.tarefaIds) state.board.taskStatus[k] = STATUS.ENVIADO;
        return ok(state.board);
    }

    if (e === 'analise' && method === 'POST') {
        return analyze(state, deck, body?.devolvidas, body?.motivo);
    }

    return null;
}

/**
 * Lê o suficiente de um corpo multipart: o nome do arquivo e os bytes. É um
 * parser de um campo só porque o upload manda um só — `fd.append('file', …)`.
 */
function parseUpload(buffer) {
    const raw = buffer.toString('latin1');
    const nameMatch = /filename="([^"]*)"/.exec(raw);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(raw);
    const start = raw.indexOf('\r\n\r\n');
    const boundary = /^--[^\r\n]+/.exec(raw)?.[0];
    if (start < 0 || !boundary) return null;
    const end = raw.indexOf(`\r\n${boundary}`, start + 4);
    return {
        fileName: nameMatch ? nameMatch[1] : 'arquivo',
        contentType: typeMatch ? typeMatch[1].trim() : null,
        content: Buffer.from(raw.slice(start + 4, end < 0 ? raw.length : end), 'latin1'),
    };
}

export async function installDeckApi(page, mutate) {
    const state = initialState();
    if (mutate) mutate(state);
    if (process.env.E2E_LIVE === '1') return state;

    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const seg = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
        const contentType = request.headers()['content-type'] || '';

        let body = null;
        if (contentType.startsWith('multipart/form-data')) {
            body = parseUpload(request.postDataBuffer() || Buffer.alloc(0));
        } else {
            try { body = request.postData() ? JSON.parse(request.postData()) : null; } catch { body = null; }
        }
        state.requests.push({
            method: request.method(),
            path: url.pathname + url.search,
            body,
            // Guardado porque o download do zip não pode ser um <a href> simples:
            // um link sai sem cabeçalho nenhum e volta 401.
            authorization: request.headers().authorization || null,
        });

        if (state.slowPermissions && seg[0] === 'me' && seg[1] === 'permissions') {
            await new Promise((resolve) => setTimeout(resolve, state.slowPermissions));
        }

        // O que não está modelado (auditoria, comentários, compartilhamentos)
        // responde vazio: um 404 aqui viraria banner de erro sem relação nenhuma
        // com o que está sob teste.
        const res = handle(state, request.method(), seg, body) || ok({ data: [], total: 0 });

        if (res.binary) {
            await route.fulfill({ status: res.status, headers: res.headers, body: res.binary });
            return;
        }
        await route.fulfill({
            status: res.status,
            contentType: 'application/json',
            body: res.body === null ? '' : JSON.stringify(res.body),
        });
    });

    return state;
}

/**
 * Assina a sessão, instala a API falsa e abre o sinistro no board — a primeira
 * linha de todo spec de deck. Devolve o estado para as asserções do lado do
 * servidor ("o deck ficou com dois arquivos" vale mais do que "a tela mostrou
 * dois").
 */
export async function openBoard(page, { persona = 'contributor', mutate } = {}) {
    await signIn(page, persona, { token: 'e2e-token' });
    const state = await installDeckApi(page, mutate);
    await page.goto(`/app/sinistros/${PROCESS_ID}`);
    await expect(page.getByRole('heading', { name: 'Relação de documentos' })).toBeVisible();
    return state;
}

/** A chave de tarefa que o board monta: `${pastaId}.${itemId}`. */
export const TASK = {
    bo: 'causa.bo',
    laudo: 'causa.laudo',
    orcamento: 'prejuizo.orcamento',
};
