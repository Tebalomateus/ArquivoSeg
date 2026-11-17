// Modelos para um tipo de sinistro novo no editor do backoffice.

export const NEW_TEMPLATE = `type: novo_tipo
title: "Título do Tipo de Sinistro"
version: "2026.11"
# Cada etapa (stage) vira uma etapa do sinistro, na ordem; cada item, um
# documento pedido nela. "required: false" deixa o item fora do que inicia o
# prazo; omitido, vale true.
stages:
  - id: etapa_1
    title: "Etapa 1"
    items:
      - id: item_1
        label: "Descrição do item"
        required: true
      - id: item_2
        label: "Descrição do item"
        required: false
`;

// Igual a seguros/scripts/checklists-seed/padrao.yaml (e ao padrão embutido da
// abertura, ArquivoSeg src/constants/claimTypes.js) — mantenha os três iguais.
export const PADRAO_TEMPLATE = `
type: padrao
title: "Padrão"
version: "2026.11"
stages:
  - id: causa
    title: "Causa"
    items:
      - id: apolice
        label: "Apólice de Seguro"
      - id: aviso_sinistro
        label: "Aviso de Sinistro"
      - id: identificacao_segurado
        label: "Documentos de Identificação do Segurado"
      - id: procuracao
        label: "Procuração / Carta de Preposto"
        required: false
      - id: boletim_ocorrencia
        label: "Boletim de Ocorrência"
      - id: fotos_local
        label: "Fotos do Local"
      - id: laudo_tecnico
        label: "Laudo Técnico / Pericial"
        required: false
  - id: prejuizo
    title: "Prejuízo"
    items:
      - id: planilha_prejuizos
        label: "Planilha de Prejuízos"
      - id: notas_fiscais
        label: "Notas Fiscais dos Bens"
      - id: orcamentos
        label: "Orçamentos de Reparo (3x)"
  - id: liquidacao
    title: "Liquidação"
    items:
      - id: dados_bancarios
        label: "Dados Bancários do Segurado"
      - id: termo_quitacao
        label: "Termo de Quitação / Recibo de Indenização"
`;

export const TEMPLATES = {
    padrao: { yaml: PADRAO_TEMPLATE.trimStart(), type: 'padrao' },
};
