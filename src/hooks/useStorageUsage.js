import { useCallback, useEffect, useState } from 'react';
import { getStorageUsage } from '../api/storage';
import { mockGetStorageUsage } from '../api/mockStorage';
import { isMockEnabled } from '../api/client';
import { useClaims } from '../context/ClaimsContext';

/**
 * O uso de armazenamento do tenant (GET /storage/usage), para o card do
 * dashboard e a página do admin.
 *
 * `forbidden` separa o 403 do erro comum: quem não tem processo.listar não
 * deve ver um aviso de falha, e sim nada — quem usa o hook some com o bloco.
 */
export function useStorageUsage() {
    const mock = isMockEnabled();
    const { claims } = useClaims();
    const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });

    // No mock o uso é derivado dos sinistros da demo; fora dele a lista de
    // sinistros não entra na conta e não deve disparar nova busca.
    const mockClaims = mock ? claims : null;

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const res = mock ? await mockGetStorageUsage(mockClaims || []) : await getStorageUsage();
            setState({ data: res?.data ?? null, loading: false, error: null, forbidden: false });
        } catch (err) {
            if (err?.status === 403) setState({ data: null, loading: false, error: null, forbidden: true });
            else setState({ data: null, loading: false, error: err, forbidden: false });
        }
    }, [mock, mockClaims]);

    useEffect(() => { load(); }, [load]);

    return { ...state, reload: load };
}
