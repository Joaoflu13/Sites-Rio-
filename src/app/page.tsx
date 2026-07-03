import Link from "next/link";

// Landing provisória (M0). A versão final com preços entra no M8.
export default function LandingPage() {
  return (
    <main>
      <section className="hero">
        <h1>
          Sites <span style={{ color: "var(--accent)" }}>Rio</span>
        </h1>
        <p className="lead">
          Encontre estabelecimentos do Rio de Janeiro que ainda não têm site — e venda o seu
          trabalho para quem realmente precisa dele.
        </p>
        <div className="cta">
          <Link className="btn" href="/cadastro">
            Criar conta grátis
          </Link>
          <Link className="btn btn--ghost" href="/login">
            Entrar
          </Link>
        </div>
      </section>
    </main>
  );
}
