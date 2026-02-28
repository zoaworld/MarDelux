/**
 * Endpoint de diagnóstico – verifica se o Firebase Admin está configurado.
 * Usar só em desenvolvimento. NÃO expõe credenciais.
 */

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export async function GET() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const hasPrivateKey = !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();

  const ok = !!(adminAuth && adminDb);

  return NextResponse.json({
    firebaseAdminOk: ok,
    env: {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey,
      clientEmailPrefix: clientEmail ? clientEmail.slice(0, 30) + "..." : null,
    },
  });
}
