import Link from "next/link";
import { requestReset } from "./actions";

export default async function EsqueciPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="auth-box">
      <h1>Esqueci minha senha</h1>
      <p className="muted">
        Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para criar uma
        nova senha.
      </p>
      <form action={requestReset} className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Enviar link
        </button>
        {sent && (
          <p className="ok">
            Se o e-mail estiver cadastrado, o link foi enviado. Confira também o spam.
          </p>
        )}
        <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
          <Link href="/login">Voltar ao login</Link>
        </p>
      </form>
    </main>
  );
}
