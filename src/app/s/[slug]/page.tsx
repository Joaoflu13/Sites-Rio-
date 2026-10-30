import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, MessageCircle, Navigation, Phone, Camera, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { demoSlug, slugSuffix } from "@/lib/slug";
import { themeFor, OFFER, photoUrl, siteVariant } from "@/lib/themes";
import { formatPhone, whatsappUrl } from "@/lib/leads";
import { bairroDe, bairroEm, bairroPublic } from "@/lib/bairros";
import { publicCnaeLabel } from "@/lib/cnae";
import { headingFamily } from "./fonts";
import { ThemeIconSvg } from "./icons";

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
  const b = found.business;
  const name = b.displayName || b.razaoSocial;
  const segment = publicCnaeLabel(b.cnaeCode, b.cnae.label);
  const published = found.demo?.published ?? false;
  return {
    title: `${name} — ${segment} ${bairroEm(b.bairro)}, Rio de Janeiro`,
    description: `${name}: ${segment.toLowerCase()} ${bairroEm(b.bairro)}, Rio de Janeiro. Fale conosco pelo WhatsApp.`,
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
  const segment = publicCnaeLabel(b.cnaeCode, b.cnae.label);
  const bairro = bairroPublic(b.bairro);
  const em = bairroEm(b.bairro);
  const variant = siteVariant(b.cnpj, theme.photos.length);
  const photo = theme.photos.length ? photoUrl(theme.photos[variant.photo], 1600) : null;
  // foto por cima do gradiente: se a imagem não carregar, o gradiente aparece
  const photoBg = photo ? `url("${photo}") center / cover no-repeat, ${theme.heroBg}` : theme.heroBg;

  const phone = demo?.whatsapp || b.phone1 || b.phone2;
  // WhatsApp só em celular (fixo vira botão de ligar); o número do admin vem primeiro
  const wa = whatsappUrl(demo?.whatsapp ?? "", b.phone1, b.phone2);
  const callPhone = b.phone1 || b.phone2;
  const waWithMsg = wa
    ? `${wa}?text=${encodeURIComponent(`Olá! Vi o site de vocês e queria mais informações 😊`)}`
    : null;
  const address = `${b.street ? `${b.street}, ` : ""}${bairro}, Rio de Janeiro`;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;
  const instagram = demo?.instagram || b.socialUrl;
  const headline = demo?.headline || theme.tagline;
  const about = demo?.about || theme.about({ name, em, de: bairroDe(b.bairro), bairro });
  const hours = demo?.hours || "Seg–Sáb, consulte os horários pelo WhatsApp";
  const cep = b.cep ? b.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "";
  const salesWa = process.env.SALES_WHATSAPP
    ? `https://wa.me/55${process.env.SALES_WHATSAPP.replace(/\D/g, "")}`
    : null;

  // Ação principal: WhatsApp > telefone > mapa (nem todo CNPJ tem celular).
  const primary = waWithMsg
    ? { href: waWithMsg, label: theme.ctaLabel, icon: <MessageCircle size={20} aria-hidden /> }
    : callPhone
      ? { href: `tel:+55${callPhone}`, label: `Ligue: ${formatPhone(callPhone)}`, icon: <Phone size={20} aria-hidden /> }
      : { href: mapsUrl, label: "Como chegar", icon: <Navigation size={20} aria-hidden /> };

  const vars = {
    "--site-accent": theme.accent,
    "--site-accent-text": theme.accentText,
    "--site-dark": theme.dark,
    "--site-soft": theme.soft,
    "--site-heading": headingFamily(theme.font),
  } as React.CSSProperties;

  return (
    <div className={`site${theme.uppercase ? " site--upper" : ""}${published ? "" : " site--demo"}`} style={vars}>
      <header className="site-nav">
        <a className="site-nav__brand" href="#inicio">
          <span className="site-nav__logo">
            <ThemeIconSvg name={theme.icon} size={18} />
          </span>
          <span>{name}</span>
        </a>
        <nav className="site-nav__links" aria-label="Seções">
          <a href="#sobre">Sobre</a>
          <a href="#destaques">Diferenciais</a>
          <a href="#contato">Contato</a>
        </nav>
        <a className="site-btn site-btn--primary site-btn--sm" href={primary.href}>
          {primary.icon}
          <span className="site-nav__cta-label">{waWithMsg ? "WhatsApp" : primary.label}</span>
        </a>
      </header>

      {/* Hero: duas variações estáveis por CNPJ (foto de fundo ou foto ao lado) */}
      <section id="inicio" className={`site-hero site-hero--${variant.layout}`}>
        {variant.layout === "cover" && (
          <>
            <div className="site-hero__photo" style={{ background: photoBg }} aria-hidden />
            <div className="site-hero__shade" aria-hidden />
          </>
        )}
        <div className="site-hero__inner">
          <div className="site-hero__text">
            <p className="site-eyebrow">
              {segment} {em}
            </p>
            <h1>{name}</h1>
            <p className="site-hero__tagline">{headline}</p>
            <div className="site-hero__actions">
              <a className="site-btn site-btn--primary site-btn--lg" href={primary.href}>
                {primary.icon}
                {primary.label}
              </a>
              <a className="site-btn site-btn--outline site-btn--lg" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin size={20} aria-hidden />
                Como chegar
              </a>
            </div>
          </div>
          {variant.layout === "split" && (
            <div className="site-hero__figure" style={{ background: photoBg }} aria-hidden />
          )}
        </div>
      </section>

      <section id="sobre" className="site-section">
        <div className="site-container site-about">
          <div>
            <p className="site-kicker">Sobre nós</p>
            <h2>Conheça {name}</h2>
            <p className="site-lead">{about}</p>
          </div>
          <ul className="site-facts">
            <li>
              <MapPin size={20} aria-hidden />
              <span>
                <strong>Endereço</strong>
                {address}
                {cep && ` · CEP ${cep}`}
              </span>
            </li>
            <li>
              <Clock size={20} aria-hidden />
              <span>
                <strong>Horário</strong>
                {hours}
              </span>
            </li>
            {phone && (
              <li>
                <Phone size={20} aria-hidden />
                <span>
                  <strong>Telefone</strong>
                  {formatPhone(phone)}
                </span>
              </li>
            )}
          </ul>
        </div>
      </section>

      <section id="destaques" className="site-section site-section--soft">
        <div className="site-container">
          <p className="site-kicker">Diferenciais</p>
          <h2>Por que escolher a gente</h2>
          <div className="site-highlights">
            {theme.highlights.map((h) => (
              <div className="site-highlight" key={h.title}>
                <div className="site-highlight__icon">
                  <ThemeIconSvg name={h.icon} />
                </div>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-band">
        <div className="site-container site-band__inner">
          <div>
            <h2>Vamos conversar?</h2>
            <p>Tire suas dúvidas e fale direto com a gente — atendimento rápido e sem complicação.</p>
          </div>
          <a className="site-btn site-btn--light site-btn--lg" href={primary.href}>
            {primary.icon}
            {primary.label}
          </a>
        </div>
      </section>

      <section id="contato" className="site-section">
        <div className="site-container site-contact">
          <div>
            <p className="site-kicker">Contato</p>
            <h2>Onde estamos</h2>
            <p className="site-lead">
              {address}
              {cep && ` · CEP ${cep}`}
            </p>
            <p>
              <strong>Horário:</strong> {hours}
            </p>
            <div className="site-contact__buttons">
              {waWithMsg && (
                <a className="site-btn site-btn--primary" href={waWithMsg}>
                  <MessageCircle size={18} aria-hidden /> WhatsApp
                </a>
              )}
              {callPhone && (
                <a className="site-btn site-btn--ghost" href={`tel:+55${callPhone}`}>
                  <Phone size={18} aria-hidden /> {formatPhone(callPhone)}
                </a>
              )}
              <a className="site-btn site-btn--ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation size={18} aria-hidden /> Rotas
              </a>
              {instagram && (
                <a className="site-btn site-btn--ghost" href={instagram} target="_blank" rel="noopener noreferrer">
                  <Camera size={18} aria-hidden /> Instagram
                </a>
              )}
            </div>
          </div>
          <iframe
            className="site-map"
            title={`Mapa: ${name}`}
            src={mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      <footer className="site-footer">
        <p>
          © {new Date().getFullYear()} {name} · {segment} {em}, Rio de Janeiro
        </p>
      </footer>

      {waWithMsg && (
        <a className="site-float-wa" href={waWithMsg} aria-label="Conversar no WhatsApp">
          <MessageCircle size={28} aria-hidden />
        </a>
      )}

      {/* Faixa de demonstração (some quando o site é publicado/vendido) */}
      {!published && (
        <div className="site-demo-bar">
          <Sparkles size={16} aria-hidden />
          <span className="site-demo-bar__long">
            Este site é uma <strong>demonstração</strong> criada para {name}. Ative por{" "}
            <strong>{OFFER.setup}</strong> + <strong>{OFFER.monthly}</strong>.
          </span>
          <span className="site-demo-bar__short">
            Demo · <strong>{OFFER.setup}</strong> + {OFFER.monthly}
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
