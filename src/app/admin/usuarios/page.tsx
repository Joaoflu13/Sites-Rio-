import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import Topbar from "@/components/Topbar";
import { createUser, resetUserPassword, setUserStatus } from "./actions";

const MSG: Record<string, { ok: boolean; text: string }> = {
  criado: { ok: true, text: "Conta criada." },
  status: { ok: true, text: "Status atualizado." },
  senha: { ok: true, text: "Senha redefinida." },
};
const ERR: Record<string, string> = {
  nome: "Informe o nome.",
  email: "E-mail inválido.",
  senha: "A senha precisa ter pelo menos 8 caracteres.",
  existe: "Já existe conta com esse e-mail.",
  proprio: "Você não pode suspender a própria conta.",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const { ok, error } = await searchParams;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <Topbar />
      <main className="page">
        <h1>Usuários da equipe</h1>
        {ok && MSG[ok] && <p className="ok">{MSG[ok].text}</p>}
        {error && <p className="error">{ERR[error] ?? "Não foi possível concluir."}</p>}

        <section className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Adicionar membro</h2>
          <form action={createUser} className="filters">
            <div>
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" required minLength={2} />
            </div>
            <div>
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="password">Senha inicial</label>
              <input id="password" name="password" type="text" required minLength={8} />
            </div>
            <div>
              <label htmlFor="role">Papel</label>
              <select id="role" name="role" defaultValue="MEMBER">
                <option value="MEMBER">Membro</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="actions">
              <button className="btn" type="submit">
                Criar
              </button>
            </div>
          </form>
        </section>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "ADMIN" ? "Admin" : "Membro"}</td>
                  <td>{u.status === "ACTIVE" ? "Ativo" : "Suspenso"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {u.id !== session.user.userId && (
                        <form action={setUserStatus}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                          />
                          <button className="btn btn--ghost btn--sm" type="submit">
                            {u.status === "ACTIVE" ? "Suspender" : "Reativar"}
                          </button>
                        </form>
                      )}
                      <form action={resetUserPassword} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="password"
                          type="text"
                          placeholder="nova senha"
                          minLength={8}
                          required
                          style={{ width: 130, padding: "4px 8px" }}
                        />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          Redefinir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
