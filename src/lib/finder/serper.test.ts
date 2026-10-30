import { describe, expect, it } from "vitest";
import { serperResults } from "./serper";

describe("serperResults", () => {
  it("põe o site do painel do Google na frente dos orgânicos", () => {
    const r = serperResults({
      organic: [{ link: "https://cnpj.biz/1", title: "PADARIA ESTRELA" }],
      knowledgeGraph: { title: "Padaria Estrela", website: "https://padariaestrela.com.br" },
    });
    expect(r.map((x) => x.url)).toEqual(["https://padariaestrela.com.br", "https://cnpj.biz/1"]);
    expect(r[0].title).toBe("Padaria Estrela");
  });

  it("não duplica quando o site já está nos orgânicos; tolera resposta vazia", () => {
    const r = serperResults({
      organic: [{ link: "https://padariaestrela.com.br", title: "Padaria Estrela" }],
      knowledgeGraph: { website: "https://padariaestrela.com.br" },
    });
    expect(r).toHaveLength(1);
    expect(serperResults({})).toEqual([]);
  });
});
