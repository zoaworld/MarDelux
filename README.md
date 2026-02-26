# MarDelux

Web App Full-Stack para o estúdio de massagens **MarDelux** (exclusivo para mulheres). Production Ready.

## Stack

- **Next.js** (App Router)
- **Tailwind CSS**
- **Firebase** (Auth, Firestore, Storage)
- **Lucide React** (ícones)

## Design

- Estilo minimalista de luxo
- Cores: Fundo branco (#FFFFFF), detalhes rosa/rose gold (#b76e79), cinza suave (#F5F5F5)
- Público-alvo: feminino
- Responsivo e otimizado para mardelux.pt

## Estrutura do projeto

```
src/
├── app/              # App Router (páginas e layouts)
│   ├── admin/        # Painel de gestão
│   ├── agendar/      # Fluxo de agendamento
│   ├── cliente/      # Área do cliente
│   └── login/        # Registo/Login
├── components/       # Componentes reutilizáveis
│   └── ui/
├── lib/              # Configuração e utilitários
│   ├── firebase/     # Firebase (Auth, Firestore, Storage)
│   └── constants.ts  # Horários, buffer time, etc.
└── types/            # Tipos TypeScript
```

## Firebase

A app está configurada com o projeto Firebase **mardelux-app** (Auth, Firestore, Storage). As credenciais estão em `src/lib/firebase/config.ts`. Para produção, pode mover-se para variáveis de ambiente (ver `.env.local.example`).

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build para produção
- `npm run start` — servir build de produção
- `npm run lint` — ESLint

## Próximos passos

1. Implementar fluxo de agendamento (Serviço → Data/Hora → Confirmação)
2. Implementar Auth (registo/login) e área do cliente
3. Implementar painel admin (agenda, CRM, financeiro, configurações)
4. Integrar Stripe para pagamentos
