export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <aside className="fixed left-0 top-0 h-full w-56 border-r border-[#eee] bg-white p-4">
        <span className="text-lg font-semibold text-[#b76e79]">MarDelux Admin</span>
        <nav className="mt-6 flex flex-col gap-2 text-sm text-[#666]">
          <a href="/admin">Agenda</a>
          <a href="/admin/crm">CRM</a>
          <a href="/admin/financeiro">Financeiro</a>
          <a href="/admin/configuracoes">Configurações</a>
        </nav>
      </aside>
      <main className="pl-56 p-8">{children}</main>
    </div>
  );
}
