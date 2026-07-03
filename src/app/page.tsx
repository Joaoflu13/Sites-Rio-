import { redirect } from "next/navigation";

// Ferramenta interna: a raiz leva direto ao login (ou à fila, se já logado).
export default function RootPage() {
  redirect("/app/leads");
}
