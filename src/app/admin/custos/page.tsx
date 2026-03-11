import { redirect } from "next/navigation";

export default function AdminCustosRedirect() {
  redirect("/admin/operacional?tab=custos");
}
