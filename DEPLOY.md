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

3. **Opcional – painel admin:** para restringir `/admin` a certos emails, adicionar:
   - `NEXT_PUBLIC_ADMIN_EMAILS` = lista de emails separados por vírgula (ex.: `admin@mardelux.pt,outro@email.pt`). Quem não estiver na lista vê "Acesso reservado ao administrador".

4. **Importante – marcações cliente mais rápidas:** para que a secção "Próximas marcações" na área do cliente carregue sem demora, configurar o Firebase Admin (API server-side):
   - Ir a [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → **Generate new private key**
   - Do JSON descarregado, copiar `project_id`, `client_email` e `private_key` para estas variáveis:
   - `FIREBASE_ADMIN_PROJECT_ID` = valor de `project_id` (ou usar `NEXT_PUBLIC_FIREBASE_PROJECT_ID` que já tens)
   - `FIREBASE_ADMIN_CLIENT_EMAIL` = valor de `client_email`
   - `FIREBASE_ADMIN_PRIVATE_KEY` = valor de `private_key` (copiar tal qual, incluindo `-----BEGIN...-----`)
   - Sem isto, a app usa Firestore directo do browser (mais lento); com isto, as marcações são buscadas pelo servidor (API) e respondem muito mais rápido.

5. Guardar. Os valores ficam em segredo e não aparecem no repositório.

**Firestore:** A app guarda o horário de funcionamento em `config/horario` (campos `startHour`, `endHour`, `bufferMinutes`). Se usares regras de segurança no Firestore, permite leitura/escrita a esta coleção para utilizadores autenticados (ou apenas admin).

6. **Importante – Cloud Firestore API:** Se vires o erro "Cloud Firestore API has not been used... or it is disabled", ativa a API em [Google Cloud Console → Cloud Firestore API](https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=mardelux-app) (Enable). Ou cria a base de dados em Firebase Console → Firestore Database → Create database.

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

## 4. Páginas lentas / erros 500 (Próximas marcações, Admin)

Se **Próximas marcações** e as **páginas de Admin** demoram muito a carregar (ou dão erro 500), quase sempre falta configurar o **Firebase Admin** na Vercel:

1. **Vercel** → teu projeto → **Settings** → **Environment Variables**
2. Confirmar que estas 3 variáveis existem para **Production**:
   - `FIREBASE_ADMIN_PROJECT_ID` 
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`

3. Para obter os valores:
   - [Firebase Console](https://console.firebase.google.com) → selecionar projeto **mardelux-app** → ⚙️ Project Settings
   - **Service Accounts** → **Generate new private key**
   - Abrir o JSON descarregado e copiar:
     - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
     - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
     - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (copiar completo, incluindo `-----BEGIN...-----` e `-----END...-----`)

4. **Importante:** na Vercel, ao colar `FIREBASE_ADMIN_PRIVATE_KEY`, o valor pode ter quebras de linha. Se der erro, tenta colar o JSON inteiro e depois editar para conter só o `private_key` com `\n` entre linhas (a Vercel aceita assim).

5. Depois de guardar as variáveis, fazer **Redeploy** (Deployments → ⋮ → Redeploy).

---

## 5. Desenvolvimento local

Copiar `.env.local.example` para `.env.local` e preencher com os valores do Firebase (ou a nova chave após regenerar). Não commitar `.env.local`.
