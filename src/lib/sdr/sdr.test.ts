import { describe, expect, it } from "vitest";
import { dailyCap, inSendingWindow, nextStepAt, sendGapMs, startOfDayBRT } from "./schedule";
import { classifyReply, newMessageId, ourMessageIds, stripQuoted } from "./replies";
import { bookingReply, sequenceEmail } from "./templates";

const mail = (over: Partial<Parameters<typeof classifyReply>[0]>) =>
  classifyReply({ from: "dono@padaria.com.br", subject: "Re: Padaria", headers: {}, text: "", ...over });

describe("janela e ritmo", () => {
  it("só dia útil, 8h–18h de Brasília", () => {
    expect(inSendingWindow(new Date("2026-11-23T11:00:00Z"))).toBe(true); // seg 8h BRT
    expect(inSendingWindow(new Date("2026-11-23T10:59:00Z"))).toBe(false); // seg 7h59
    expect(inSendingWindow(new Date("2026-11-23T21:00:00Z"))).toBe(false); // seg 18h
    expect(inSendingWindow(new Date("2026-11-28T14:00:00Z"))).toBe(false); // sábado
  });

  it("início do dia em Brasília", () => {
    expect(startOfDayBRT(new Date("2026-11-24T02:00:00Z")).toISOString()).toBe("2026-11-23T03:00:00.000Z");
  });

  it("aquecimento 10 → 20 → 30 → máximo", () => {
    const start = new Date("2026-11-01T12:00:00Z");
    expect(dailyCap(null, start, 40)).toBe(10);
    expect(dailyCap(start, new Date("2026-11-05T12:00:00Z"), 40)).toBe(10);
    expect(dailyCap(start, new Date("2026-11-09T12:00:00Z"), 40)).toBe(20);
    expect(dailyCap(start, new Date("2026-11-16T12:00:00Z"), 40)).toBe(30);
    expect(dailyCap(start, new Date("2026-12-20T12:00:00Z"), 40)).toBe(40);
    expect(dailyCap(start, new Date("2026-12-20T12:00:00Z"), 25)).toBe(25);
    expect(dailyCap(start, new Date("2026-11-02T12:00:00Z"), 5)).toBe(5);
  });

  it("intervalo de 4 a 9 min e passos D0 → D3 → D7", () => {
    expect(sendGapMs(0)).toBe(4 * 60000);
    expect(sendGapMs(1)).toBe(9 * 60000);
    const now = new Date("2026-11-23T12:00:00Z");
    expect(nextStepAt(1, now)?.toISOString()).toBe("2026-11-26T12:00:00.000Z");
    expect(nextStepAt(2, now)?.toISOString()).toBe("2026-11-27T12:00:00.000Z");
    expect(nextStepAt(3, now)).toBeNull();
  });
});

describe("respostas", () => {
  it("tira a parte citada", () => {
    const t = "Tenho interesse sim!\n\nEm seg., 23 de nov. de 2026 às 10:00, Assistente <a@x.com> escreveu:\n> Olá, tudo bem?\n> SAIR";
    expect(stripQuoted(t)).toBe("Tenho interesse sim!");
    expect(stripQuoted("ok\n> citado\nfim")).toBe("ok\nfim");
    expect(stripQuoted("Pode ser\n\nEnviado do meu iPhone")).toBe("Pode ser");
  });

  it("SAIR e sem interesse = OPT_OUT (só no texto novo)", () => {
    expect(mail({ text: "SAIR" })).toBe("OPT_OUT");
    expect(mail({ text: "sair" })).toBe("OPT_OUT");
    expect(mail({ text: "Não temos interesse, obrigado." })).toBe("OPT_OUT");
    expect(mail({ text: "Por favor, remova meu e-mail da lista" })).toBe("OPT_OUT");
    expect(mail({ text: "Parem de enviar isso" })).toBe("OPT_OUT");
    // a palavra SAIR do rodapé citado não conta
    expect(mail({ text: "Quanto custa?\n\nOn Mon, Nov 23, 2026 Assistente wrote:\n> responder SAIR" })).toBe("HUMAN");
    // "sair" no meio da frase não é pedido de remoção
    expect(mail({ text: "Vou sair de férias, me liga dia 10" })).toBe("HUMAN");
  });

  it("não entregue e resposta automática", () => {
    expect(mail({ from: "mailer-daemon@googlemail.com" })).toBe("BOUNCE");
    expect(mail({ contentType: "multipart/report; report-type=delivery-status" })).toBe("BOUNCE");
    expect(mail({ headers: { "auto-submitted": "auto-replied" } })).toBe("AUTO_REPLY");
    expect(mail({ headers: { "auto-submitted": "no" }, text: "oi" })).toBe("HUMAN");
    expect(mail({ subject: "Resposta automática: Padaria" })).toBe("AUTO_REPLY");
    expect(mail({ subject: "Out of office" })).toBe("AUTO_REPLY");
  });

  it("interesse e perguntas = HUMAN", () => {
    expect(mail({ text: "Gostei! Quanto fica com domínio próprio?" })).toBe("HUMAN");
  });

  it("Message-ID do assistente: gera e reconhece", () => {
    const id = newMessageId("ckabc123", 2, "sitesrio-contato.com.br", "x9-Z!q");
    expect(id).toBe("<sdr.ckabc123.2.x9Zq@sitesrio-contato.com.br>");
    const raw = `References: <foo@gmail.com> ${id}\r\nIn-Reply-To: ${id}\r\n...Message-ID: <sdr.ckabc123.1.aa@sitesrio-contato.com.br>`;
    expect(ourMessageIds(raw)).toEqual([id, "<sdr.ckabc123.1.aa@sitesrio-contato.com.br>"]);
  });
});

describe("textos", () => {
  const c = {
    name: "Padaria Estrela",
    presenceClass: "NO_SITE" as const,
    websiteUrl: "",
    demoUrl: "https://x.com.br/s/padaria-estrela-000191?c=e",
    ownerName: "João",
  };

  it("1º e-mail: assistente virtual identificado, um link, saída", () => {
    const m = sequenceEmail(1, c);
    expect(m.subject).toBe("Padaria Estrela: deixei um site pronto para vocês");
    expect(m.text).toContain("Assistente virtual do João");
    expect(m.text).toContain("lidas pelo João");
    expect(m.text).toContain("responder SAIR");
    expect(m.text.match(/https?:\/\//g)).toHaveLength(1);
  });

  it("follow-ups na mesma conversa, um link cada, com saída", () => {
    for (const step of [2, 3]) {
      const m = sequenceEmail(step, c, "Padaria Estrela: deixei um site pronto para vocês");
      expect(m.subject).toBe("Re: Padaria Estrela: deixei um site pronto para vocês");
      expect(m.text.match(/https?:\/\//g)).toHaveLength(1);
      expect(m.text).toContain("responder SAIR");
      expect(m.text).toContain("Assistente virtual do João");
    }
    expect(sequenceEmail(3, c, "x").text).toContain("encerrar por aqui");
  });

  it("resposta com link da agenda", () => {
    const t = bookingReply("João", "https://cal.com/joao/15min");
    expect(t).toContain("https://cal.com/joao/15min");
    expect(t).toContain("Assistente virtual do João");
  });
});
