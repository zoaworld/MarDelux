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
- O build falhou e a Vercel serviu uma página de falha, ou
- O **Root Directory** ou o framework estão mal configurados na Vercel.

**Passos:**

1. **Na Vercel → Settings → General**
   - **Root Directory** deve estar **vazio** (ou `.`). Se estiver preenchido com uma pasta (ex. `app` ou `frontend`), apagar e guardar.
   - **Framework Preset** deve ser **Next.js**. Se estiver em "Other" ou outro valor, alterar para Next.js (o ficheiro `vercel.json` no projeto já força `"framework": "nextjs"`).

2. **Ver os logs do build**
   - **Deployments** → abrir o último deployment → **Building**.
   - Confirmar que o build termina com sucesso (sem erros a vermelho). Se falhar, corrigir o erro (ex.: dependências, Node version) e fazer novo deploy.

3. **Testar o URL da Vercel**
   - Abrir **mar-delux.vercel.app** (ou o URL que a Vercel atribui). Se aí funcionar mas **www.mardelux.pt** der 404, o problema é o domínio (DNS ou domínio não associado ao projeto certo).

4. **Confirmar código e redeploy**
   - No GitHub, a branch **main** deve ter o último commit (incl. `vercel.json` e código da app).
   - **Deployments** → **Redeploy** do último deployment (ou novo push para `main`).
   - Garantir que as variáveis de ambiente (secção 2) estão definidas para **Production** antes do redeploy.

Após isto, **www.mardelux.pt** (e o URL \*.vercel.app) deve servir a aplicação Next.js em vez de 404.

---

## 4. Desenvolvimento local

Copiar `.env.local.example` para `.env.local` e preencher com os valores do Firebase (ou a nova chave após regenerar). Não commitar `.env.local`.
