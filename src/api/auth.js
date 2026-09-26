import { setToken } from './client';

export function logoutSession() {
    setToken(null);
}

const DESTINATION_KEY = 'arquivoseg_destino';

/**
 * Onde a pessoa estava indo quando o login a interrompeu.
 *
 * Vive no sessionStorage, e não no state da rota, porque o login de verdade sai
 * do app: o navegador vai para o Zitadel e volta em /callback com a página
 * recarregada do zero. Qualquer coisa guardada em memória — ou no state que o
 * <Navigate> carrega — não sobrevive a essa volta.
 *
 * Só caminhos internos entram. Um destino vindo de fora com host próprio faria
 * o login virar um redirecionador aberto: o link leva ao domínio certo, a
 * pessoa digita a senha e cai em outro lugar.
 */
export function rememberDestination(path) {
    if (typeof path !== 'string') return;
    // "//outro.host" e "https://outro.host" são absolutos para o navegador.
    if (!path.startsWith('/') || path.startsWith('//')) return;
    // Voltar para o próprio login, ou para a volta do OIDC, é um laço.
    if (/^\/(login|callback|signup)(\/|\?|$)/.test(path)) return;
    try { sessionStorage.setItem(DESTINATION_KEY, path); } catch { /* sem storage, cai no padrão */ }
}

/** Lê e consome: um destino guardado vale para uma entrada só. */
export function takeDestination() {
    try {
        const path = sessionStorage.getItem(DESTINATION_KEY);
        sessionStorage.removeItem(DESTINATION_KEY);
        return path || null;
    } catch {
        return null;
    }
}

export function actorLabelFromDbId(dbId, fallback = '—') {
    if (!dbId) return fallback;
    return `Usuário ${String(dbId).slice(0, 8)}`;
}
