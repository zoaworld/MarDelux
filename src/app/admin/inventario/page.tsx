import { redirect } from "next/navigation";

export default function AdminInventarioRedirect() {
  redirect("/admin/operacional?tab=inventario");
}
