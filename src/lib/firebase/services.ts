import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./config";
import type { Servico } from "@/types";

const COLLECTION = "servicos";

export async function getServicos(): Promise<Servico[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTION),
    where("ativo", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nome: data.nome ?? "",
      descricao: data.descricao,
      duracaoMinutos: data.duracaoMinutos ?? 60,
      preco: data.preco ?? 0,
      ativo: data.ativo ?? true,
    } as Servico;
  });
}

export async function getServicoById(id: string): Promise<Servico | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    nome: data.nome ?? "",
    descricao: data.descricao,
    duracaoMinutos: data.duracaoMinutos ?? 60,
    preco: data.preco ?? 0,
    ativo: data.ativo ?? true,
  } as Servico;
}
