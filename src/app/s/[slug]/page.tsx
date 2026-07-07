import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { demoSlug, slugSuffix } from "@/lib/slug";
import { themeFor, OFFER } from "@/lib/themes";
import { formatPhone, whatsappUrl } from "@/lib/leads";

// Site público do estabelecimento (demo automática; vira o site "de verdade"
// quando o admin publica). Montado 100% a partir do banco — custo zero por site.

async function resolveBusiness(slug: string) {
  // 1) slug personalizado/vendido (linha DemoSite)
  const demo = await prisma.demoSite.findUnique({
    where: { slug },
    include: { business: { include: { cnae: true } } },
  });
  if (demo) return { business: demo.business, demo };

  // 2) slug determinístico: sufixo = 6 últimos dígitos do CNPJ
  const suffix = slugSuffix(slug);
  if (!suffix) return null;
  const candidates = await prisma.business.findMany({
    where: { cnpj: { endsWith: suffix } },
    include: { cnae: true, demoSite: true },
    take: 20,
  });
  const business = candidates.find((b) => demoSlug(b) === slug);
  if (!business) return null;
  return { business, demo: business.demoSite ?? null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await resolveBusiness(slug);
  if (!found) return { title: "Site não encontrado" };
  const name = found.business.displayName || found.business.razaoSocial;
  const published = found.demo?.published ?? false;
  return {
    title: `${name} — ${found.business.bairro}, Rio de Janeiro`,
    description: `${name}: ${found.business.cnae.label} em ${found.business.bairro}, Rio de Janeiro. Fale conosco pelo WhatsApp.`,
    robots: published ? undefined : { index: false, follow: false },
  };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await resolveBusiness(slug);
  if (!found) notFound();

  const { business: b, demo } = found;
  const theme = themeFor(b.cnae.group);
  const name = b.displayName || b.razaoSocial || "Estabelecimento";
  const published = demo?.published ?? false;

  const phone = demo?.whatsapp || b.phone1 || b.phone2;
  const wa = phone ? whatsappUrl(phone) : null;
  const waWithMsg = wa
    ? `${wa}?text=${encodeURIComponent(`Olá! Vi o site de vocês e queria mais informações 😊`)}`
    : null;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    `${b.street}, ${b.bairro}, Rio de Janeiro`
  )}`;
  const instagram = demo?.instagram || b.socialUrl;
  const headline = demo?.headline || theme.tagline;
  const about = demo?.about || theme.about(name, b.bairro);
  const hours = demo?.hours || "Seg–Sáb, consulte os horários pelo WhatsApp";
  const salesWa = process.env.SALES_WHATSAPP
    ? `https://wa.me/55${process.env.SALES_WHATSAPP.replace(/\D/g, "")}`
    : null;

  const cta = waWithMsg ? (
    <a className="site-cta" style={{ background: "#fff", color: theme.accent }} href={waWithMsg}>
      💬 {theme.ctaLabel}
    </a>
  ) : b.phone1 ? (
    <a className="site-cta" style={{ background: "#fff", color: theme.accent }} href={`tel:+55${b.phone1}`}>
      📞 Ligue: {formatPhone(b.phone1)}
    </a>
  ) : (
    <a className="site-cta" style={{ background: "#fff", color: theme.accent }} href={mapsUrl}>
      📍 Como chegar
    </a>
  );

  return (
    <div className="site" style={{ ["--site-accent" as string]: theme.accent }}>
      {/* Hero */}
      <header className="site-hero" style={{ background: theme.heroBg }}>
        <div className="site-hero__icon" aria-hidden>
          {theme.icon}
        </div>
        <h1>{name}</h1>
        <p className="site-hero__tagline">{headline}</p>
        <p className="site-hero__where">
          {b.cnae.label} · {b.bairro}, Rio de Janeiro
        </p>
        {cta}
      </header>

      {/* Sobre */}
      <section className="site-section">
        <h2>Sobre nós</h2>
        <p>{about}</p>
      </section>

      {/* Destaques */}
      <section className="site-section site-section--soft" style={{ background: theme.soft }}>
        <h2>Por que escolher a gente</h2>
        <div className="site-highlights">
          {theme.highlights.map((h) => (
            <div className="site-highlight" key={h.title}>
              <div className="site-highlight__icon" aria-hidden>
                {h.icon}
              </div>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contato / onde estamos */}
      <section className="site-section">
        <h2>Onde estamos</h2>
        <p>
          {b.street ? `${b.street} — ` : ""}
          {b.bairro}, Rio de Janeiro
          {b.cep && ` · CEP ${b.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}`}
        </p>
        <p>
          <strong>Horário:</strong> {hours}
        </p>
        <div className="site-contact-buttons">
          {waWithMsg && (
            <a
              className="site-btn"
              style={{ background: theme.accent, color: theme.accentText }}
              href={waWithMsg}
            >
              💬 WhatsApp
            </a>
          )}
          {b.phone1 && (
            <a className="site-btn site-btn--ghost" href={`tel:+55${b.phone1}`}>
              📞 {formatPhone(b.phone1)}
            </a>
          )}
          <a className="site-btn site-btn--ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            📍 Ver no mapa
          </a>
          {instagram && (
            <a className="site-btn site-btn--ghost" href={instagram} target="_blank" rel="noopener noreferrer">
              📸 Instagram
            </a>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <p>
          © {new Date().getFullYear()} {name} · {b.bairro}, Rio de Janeiro
        </p>
      </footer>

      {/* Faixa de demonstração (some quando o site é publicado/vendido) */}
      {!published && (
        <div className="site-demo-bar">
          <span>
            🚀 Este site é uma <strong>demonstração</strong> criada para {name}. Ative por{" "}
            <strong>{OFFER.setup}</strong> + <strong>{OFFER.monthly}</strong>.
          </span>
          {salesWa ? (
            <a href={`${salesWa}?text=${encodeURIComponent(`Quero ativar o site ${slug}`)}`}>
              Quero meu site →
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
