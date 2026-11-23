// Fontes dos títulos do site demo, uma por tema (next/font: baixadas no build e
// servidas pelo próprio app). preload=false: o navegador só baixa a do tema em uso.
import { Fraunces, Manrope, Nunito, Oswald, Outfit, Playfair_Display } from "next/font/google";
import type { ThemeFont } from "@/lib/themes";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], preload: false });
const manrope = Manrope({ subsets: ["latin"], weight: ["700", "800"], preload: false });
const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600"], preload: false });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800"], preload: false });
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"], preload: false });

const FONTS = { fraunces, playfair, manrope, oswald, nunito, outfit };

/** font-family da fonte do tema (aplicada via --site-heading). */
export function headingFamily(font: ThemeFont): string {
  return FONTS[font].style.fontFamily;
}
