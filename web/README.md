# ArquivoSeg Web Portal 🛡️

Uma plataforma ultra-premium e segura para gestão de sinistros, focada em conformidade (SLA Art. 86) e integridade de dados para grandes seguradoras (ex: Tokio Marine).

## 🚀 Visão Geral
O **ArquivoSeg** foi desenvolvido para resolver a fragmentação na coleta de documentos de sinistros, garantindo que peritos, analistas e gestores tenham uma única fonte de verdade auditável e resiliente.

### Principais Diferenciais:
- **Resiliência Operacional**: Gestão automática de suspensão de prazos (SLA) conforme Lei 15.040.
- **Segurança de Dados**: Trilha de auditoria (Audit Trail) de visualização e classificação de sensibilidade (AES-256 simulation).
- **UX Premium**: Interface baseada em Glassmorphism com fontes modernas (Outfit/Inter).
- **Multi-Stakeholder**: Portais de acesso restrito via tokens seguros.

## 🛠️ Stack Tecnológica
- **Vite** + **React** (Performance e Hot Reloading)
- **Tailwind CSS** (Design System Customizado via Tokens)
- **Lucide React** (Iconografia consistente)
- **Framer Motion** (Micro-animações e transições suaves)
- **React Router 6** (Navegação baseada em rotas protegidas)

## 📂 Arquitetura do Projeto
```text
/
├── public/          # Atributos estáticos
├── src/
│   ├── components/  # Componentes reutilizáveis (Badge, Layout, etc.)
│   ├── constants/   # Design Tokens e Dados Iniciais
│   ├── context/     # Gerenciamento de Estado (Global Claims Context)
│   ├── pages/       # Telas do sistema
│   └── services/    # Lógica de persistência e chamadas de API
├── index.html       # Entry Point
└── tailwind.config  # Configuração de Cores e Tipografias Branding
```

## ⚙️ Instalação e Desenvolvimento
1. Clone o repositório.
2. Certifique-se de estar na pasta raiz (onde reside o `package.json`).
3. Instale as dependências: `npm install`
4. Inicie o servidor de desenvolvimento: `npm run dev`

## ☁️ Deployment (AWS Amplify)
Este repositório está otimizado para **AWS Amplify**. 
Certifique-se de configurar a **Build Settings** conforme o arquivo `amplify.yml` incluído:
- **Base Directory**: `dist`
- **Build Command**: `npm run build`

---
Copyright © 2026 ArquivoSeg. Todos os direitos reservados.
