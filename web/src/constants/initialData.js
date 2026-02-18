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
        shareToken: '77c8-4a92-b8a1'
    }
];

export const INITIAL_USERS = [
    { id: 1, name: 'Gestor ArquivoSeg', email: 'contato@arquivoseg.com.br', role: 'ADMIN', status: 'Ativo', company: 'ArquivoSeg' },
    { id: 2, name: 'Ricardo Silva', email: 'ricardo@corretora.com', role: 'CORRETOR', status: 'Ativo', company: 'Silva Seguros' },
    { id: 3, name: 'Ana Souza', email: 'ana.souza@allianz.com', role: 'PERITO', status: 'Ativo', company: 'Allianz' },
];
