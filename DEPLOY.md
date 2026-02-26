# Deploy MarDelux (Vercel + Firebase)

## 1. Segurança: chave Firebase exposta

Se a chave da API Firebase esteve no código e foi enviada para o GitHub:

1. **Regenerar a chave no Google Cloud**
   - Ir a [Google Cloud Console](https://console.cloud.google.com) → projeto **mardelux-app** → APIs & Services → Credentials.
   - Abrir a API key que estava exposta → **Regenerate key** (ou criar uma nova e apagar a antiga).
   - Opcional: em “Application restrictions” limitar por HTTP referrer (ex.: `https://mardelux.pt/*`, `https://*.vercel.app/*`).

2. **Nunca voltar a colocar a chave no código.** Usar apenas variáveis de ambiente (ver abaixo).

---

## 2. Variáveis de ambiente na Vercel

No projeto Vercel (mar-delux):

1. **Settings** → **Environment Variables**.
2. Adicionar cada variável para **Production** (e Preview se quiser):

| Nome | Valor |
|------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (nova chave após regenerar) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `mardelux-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `mardelux-app` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `mardelux-app.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `440285677582` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:440285677582:web:54f863260c74cbd39a145f` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-LYHW7PNT8Y` |

3. Guardar. Os valores ficam em segredo e não aparecem no repositório.

---

## 3. Corrigir o 404 em produção

O 404 em **www.mardelux.pt** costuma acontecer quando:

- O deploy em produção foi feito a partir de um commit antigo (ex.: “first commit” em vez do código atual), ou
- O build falhou e a Vercel serviu uma página de falha.

**Passos:**

1. Confirmar que o código em produção está atualizado:
   - No GitHub, branch **main** deve ter o último commit (com fluxo de agendamento, Auth, etc.).
   - Se não tiver, fazer `git push origin main` a partir do teu projeto local.

2. Na Vercel:
   - **Deployments** → escolher o último deployment → **Redeploy** (ou fazer um novo push para `main` para disparar um deploy novo).
   - Garantir que o deploy é feito a partir da branch **main** e que o **Build Command** é `npm run build` (ou o que a Vercel detetar para Next.js).

3. Depois de configurar as variáveis de ambiente (secção 2), fazer um **Redeploy** para o build usar as novas chaves.

Após isto, **www.mardelux.pt** deve servir a aplicação Next.js em vez de 404.

---

## 4. Desenvolvimento local

Copiar `.env.local.example` para `.env.local` e preencher com os valores do Firebase (ou a nova chave após regenerar). Não commitar `.env.local`.
