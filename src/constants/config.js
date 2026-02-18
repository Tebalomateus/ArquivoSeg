/**
 * Configurações de Seguradoras, Modalidades e Regras de Negócio
 */

export const INSURERS_CONFIG = {
    'Porto Seguro': {
        id: 'porto',
        modalities: {
            'Incêndio': [
                { name: 'Laudo do Corpo de Bombeiros', folder: 'Causa', required: true },
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Fotos do Local', folder: 'Causa', required: true },
                { name: 'Planilha de Bens Danificados', folder: 'Prejuízo', required: true },
                { name: 'Notas Fiscais dos Bens', folder: 'Prejuízo', required: true },
                { name: 'Orçamentos de Reparo (3x)', folder: 'Prejuízo', required: true },
            ],
            'Roubo/Furto': [
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Manifesto de Carga', folder: 'Causa', required: true },
                { name: 'CNH do Motorista', folder: 'Causa', required: true },
                { name: 'Notas Fiscais da Carga', folder: 'Prejuízo', required: true },
                { name: 'Relatório de Rastreamento', folder: 'Causa', required: false },
            ],
            'Colisão Veicular': [
                { name: 'B.O do Acidente', folder: 'Causa', required: true },
                { name: 'CNH do Condutor', folder: 'Causa', required: true },
                { name: 'Fotos do Veículo', folder: 'Causa', required: true },
                { name: 'Orçamentos (3x)', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Allianz': {
        id: 'allianz',
        modalities: {
            'Alagamento': [
                { name: 'Laudo Técnico Municipal', folder: 'Causa', required: true },
                { name: 'Documentos do Imóvel', folder: 'Causa', required: true },
                { name: 'Fotos do Alagamento', folder: 'Causa', required: true },
                { name: 'Relatório de Máquinas Danificadas', folder: 'Prejuízo', required: true },
                { name: 'Inventário de Estoque', folder: 'Prejuízo', required: true },
            ],
            'Vendaval': [
                { name: 'Laudo Meteorológico', folder: 'Causa', required: true },
                { name: 'Fotos dos Danos', folder: 'Causa', required: true },
                { name: 'Orçamentos de Reparo', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Tokio Marine': {
        id: 'tokio',
        modalities: {
            'Responsabilidade Civil': [
                { name: 'Documentação do Reclamante', folder: 'Causa', required: true },
                { name: 'Laudo Pericial', folder: 'Causa', required: true },
                { name: 'Comprovantes de Danos', folder: 'Prejuízo', required: true },
            ],
            'Riscos Ambientais': [
                { name: 'Laudo Ambiental', folder: 'Causa', required: true },
                { name: 'Relatório de Impacto', folder: 'Causa', required: true },
                { name: 'Licenças Ambientais', folder: 'Causa', required: true },
                { name: 'Custos de Remediação', folder: 'Prejuízo', required: true },
                { name: 'Plano de Ação Corretiva', folder: 'Prejuízo', required: true },
            ],
            'D&O': [
                { name: 'Notificação/Citação', folder: 'Causa', required: true },
                { name: 'Procuração', folder: 'Causa', required: true },
                { name: 'Custos de Defesa', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Bradesco Seguros': {
        id: 'bradesco',
        modalities: {
            'Frota': [
                { name: 'B.O do Acidente', folder: 'Causa', required: true },
                { name: 'CNH do Condutor', folder: 'Causa', required: true },
                { name: 'CRLV do Veículo', folder: 'Causa', required: true },
                { name: 'Orçamentos (3x)', folder: 'Prejuízo', required: true },
            ],
            'Empresarial': [
                { name: 'Contrato Social', folder: 'Causa', required: true },
                { name: 'Laudo Pericial', folder: 'Causa', required: true },
                { name: 'Inventário de Bens', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'SulAmérica': {
        id: 'sulamerica',
        modalities: {
            'Incêndio': [
                { name: 'Laudo do Corpo de Bombeiros', folder: 'Causa', required: true },
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Planilha de Bens', folder: 'Prejuízo', required: true },
            ],
            'Equipamentos': [
                { name: 'Termo de Vistoria', folder: 'Causa', required: true },
                { name: 'Nota Fiscal do Equipamento', folder: 'Prejuízo', required: true },
                { name: 'Orçamento de Reparo/Substituição', folder: 'Prejuízo', required: true },
            ],
        }
    },
};

export const STATUS_COLORS = {
    'Aberto': 'bg-blue-100 text-blue-700',
    'Em Análise': 'bg-amber-100 text-amber-700',
    'Documentação Completa': 'bg-purple-100 text-purple-700',
    'Em Prazo': 'bg-green-100 text-green-700',
    'Concluído': 'bg-gray-100 text-gray-700',
};

export const CONFIDENTIAL_LEVELS = {
    PUBLIC: 'Público',
    GENERAL: 'Geral',
    CONFIDENTIAL: 'Confidencial',
    HIGHLY_CONFIDENTIAL: 'Altamente Confidencial'
};
