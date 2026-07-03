import Link from "next/link";
import { resetPassword } from "./actions";

export default async function RedefinirPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token && error !== "token") {
    return (
      <main className="auth-box">
        <h1>Link inválido</h1>
        <p className="muted">
          Este link de redefinição não é válido. <Link href="/esqueci">Peça um novo</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-box">
      <h1>Criar nova senha</h1>
      <form action={resetPassword} className="card" style={{ marginTop: 16 }}>
        <input type="hidden" name="token" value={token ?? ""} />
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="password">Nova senha (mín. 8 caracteres)</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Salvar nova senha
        </button>
        {error === "senha" && <p className="error">A senha precisa ter pelo menos 8 caracteres.</p>}
        {error === "token" && (
          <p className="error">
            Link expirado ou já usado. <Link href="/esqueci">Peça um novo</Link>.
          </p>
        )}
      </form>
    </main>
  );
}
