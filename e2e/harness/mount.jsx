// Monta um componente do app sozinho, dentro da página que o dev server já
// serve — o equivalente, sem dependência nova, a um teste de componente.
//
// Existe para o componente que ainda não tem casa: a trilha de auditoria entra
// na aba Auditoria do sinistro em outro commit, e até lá o spec precisa de um
// lugar para montá-la. Não é rota do app nem entra no build: o Vite só serve
// este arquivo porque o spec pede pelo caminho (ver e2e/fixtures/mount.js).
import { createRoot } from 'react-dom/client';
import ClaimAuditTrail from '../../src/components/ClaimAuditTrail.jsx';

const COMPONENTS = { ClaimAuditTrail };

export function mount(name, props) {
    const Component = COMPONENTS[name];
    if (!Component) throw new Error(`harness: componente desconhecido ${name}`);
    const app = document.getElementById('root');
    if (app) app.style.display = 'none';
    const host = document.createElement('div');
    host.id = 'harness';
    host.style.cssText = 'min-height:100vh;background:#F8FAFC;padding:24px 16px;';
    const inner = document.createElement('div');
    inner.style.cssText = 'max-width:880px;margin:0 auto;';
    host.appendChild(inner);
    document.body.appendChild(host);
    createRoot(inner).render(<Component {...props} />);
}
