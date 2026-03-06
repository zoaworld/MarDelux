/**
 * Script de migração: adiciona o campo clienteEmailLower às marcações existentes.
 * Execute com: npx tsx scripts/migrate-cliente-email-lower.ts
 *
 * Carrega .env.local automaticamente. Necessita de FIREBASE_ADMIN_PROJECT_ID,
 * FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY (ou GOOGLE_APPLICATION_CREDENTIALS).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import * as path from "path";

async function main() {
  if (getApps().length === 0) {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (keyPath) {
      const serviceAccount = require(path.resolve(keyPath)) as { project_id: string; client_email: string; private_key: string };
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      if (!projectId || !clientEmail || !rawKey) {
        console.error("Configure FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY no .env.local");
        process.exit(1);
      }
      const privateKey = rawKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
  }
  const db = getFirestore();
  const ref = db.collection("marcacoes");
  const snap = await ref.get();
  const toUpdate: Array<{ ref: DocumentReference; lower: string }> = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.clienteEmail && !data.clienteEmailLower) {
      toUpdate.push({ ref: doc.ref, lower: String(data.clienteEmail).trim().toLowerCase() });
    }
  }
  const BATCH_SIZE = 500;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { ref: docRef, lower } of toUpdate.slice(i, i + BATCH_SIZE)) {
      batch.update(docRef, { clienteEmailLower: lower });
    }
    await batch.commit();
  }
  if (toUpdate.length > 0) {
    console.log(`Migração concluída: ${toUpdate.length} marcações atualizadas com clienteEmailLower.`);
  } else {
    console.log("Nenhuma marcação precisa de migração.");
  }
}

main().catch(console.error);
