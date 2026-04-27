export const INITIAL_CLAIMS = [
    {
        id: '1',
        number: '2024-001',
        title: 'Incêndio Depósito Norte',
        insurer: 'Porto Seguro',
        insuredName: 'XYZ Logística Ltda',
        status: 'Em Análise',
        progress: 72,
        date: '02/01/2026',
        lastModified: '08/01/2026',
        isComplex: false,
        deadline: {
            totalDays: 30,
            remainingDays: 18,
            isSuspended: false,
            suspensionCount: 0,
            lastUpdated: Date.now(),
            history: [{ date: '02/01/2026', action: 'Início do prazo de 30 dias.' }]
        },
        activities: [],
        folders: [
            { id: 'f1-1', name: 'Causa', category: 'causa', completion: 80, documents: [], checklist: [] },
            { id: 'f2-1', name: 'Prejuízo', category: 'prejuizo', completion: 60, documents: [], checklist: [] },
            { id: 'f3-1', name: 'Liquidação', category: 'liquidacao', completion: 0, documents: [], checklist: [] },
            { id: 'f4-1', name: 'Gerencial', category: 'gerencial', completion: 100, private: true, documents: [], checklist: [] }
        ],
        shareToken: '77c8-4a92-b8a1',
        broker: 'Silva Seguros'
    }
];

export const INITIAL_USERS = [
    { id: 1, name: 'Carlos Sato', email: 'sato@arquivoseg.com.br', role: 'ADMIN', status: 'Ativo', company: 'ArquivoSeg' },
    { id: 2, name: 'Ricardo Silva', email: 'ricardo@corretora.com', role: 'CORRETOR', status: 'Ativo', company: 'Silva Seguros' },
    { id: 3, name: 'Ana Souza', email: 'ana.souza@allianz.com', role: 'PERITO', status: 'Ativo', company: 'Allianz' },
    { id: 4, name: 'Maria Costa', email: 'analista@arquivoseg.com.br', role: 'ANALISTA', status: 'Ativo', company: 'ArquivoSeg' },
];

export const INITIAL_CLIENTS = [
    { id: 'c1', name: 'Porto Seguro', type: 'SEGURADORA', billingMethod: 'Boleto Mensal', status: 'Adimplente', contact: 'ana@portoseguro.com' },
    { id: 'c2', name: 'Silva Seguros', type: 'CORRETORA', billingMethod: 'PIX', status: 'Adimplente', contact: 'ricardo@corretora.com' },
    { id: 'c3', name: 'PwC Auditoria', type: 'AUDITORIA', billingMethod: 'Cartão Corporativo', status: 'Atenção', contact: 'contato@pwc.com' },
];

export const INITIAL_LINKS = [
    { id: 'l1', token: '77c8-4a92-b8a1', claimNumber: '2024-001', createdBy: 'Carlos Sato', createdAt: '02/01/2026', views: 45, status: 'Ativo' },
    { id: 'l2', token: '99a1-4b22-c8x1', claimNumber: '2024-001', createdBy: 'Ricardo Silva', createdAt: '05/01/2026', views: 12, status: 'Ativo' },
];
