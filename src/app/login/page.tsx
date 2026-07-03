import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, normalizeEmail } from "@/lib/auth";
import { isLocked } from "@/lib/rateLimit";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; cadastro?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/app/leads");

  const { error, reset, cadastro } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = normalizeEmail(formData.get("email"));
    // Anti força-bruta: avisa que está bloqueado em vez do genérico "senha inválida".
    if (email && (await isLocked(`login:${email}`))) {
      redirect("/login?error=locked");
    }
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/app/leads",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        // Esta tentativa pode ter sido a que estourou o limite.
        if (email && (await isLocked(`login:${email}`))) redirect("/login?error=locked");
        redirect("/login?error=1");
      }
      throw e; // redirect() lança internamente; deixe propagar.
    }
  }

  return (
    <main className="auth-box">
      <h1>Entrar</h1>
      <p className="muted">Acesse com o e-mail e a senha da sua conta.</p>
      <form action={login} className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="voce@exemplo.com"
            required
            autoComplete="username"
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Entrar
        </button>
        {error === "locked" ? (
          <p className="error">Muitas tentativas de login. Aguarde alguns minutos e tente de novo.</p>
        ) : (
          error && <p className="error">E-mail ou senha inválidos (ou conta suspensa).</p>
        )}
        {reset && <p className="ok">Senha alterada! Entre com a nova senha.</p>}
        {cadastro && <p className="ok">Conta criada! Entre com seu e-mail e senha.</p>}
        <p style={{ marginTop: 12, marginBottom: 4, textAlign: "center" }}>
          <Link href="/cadastro">Não tem conta? Cadastre-se grátis</Link>
        </p>
        <p style={{ marginTop: 0, marginBottom: 0, textAlign: "center" }}>
          <Link href="/esqueci">Esqueci minha senha</Link>
        </p>
      </form>
    </main>
  );
}
