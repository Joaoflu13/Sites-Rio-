// Ícones do site demo (SVG via lucide-react) — substituem os emojis, que mudam
// de cara em cada celular. Tema referencia por nome (src/lib/themes.ts).
import {
  Bath, Bike, Bone, CalendarCheck, CircleCheck, Clock, Dumbbell, Flame, Handshake, Heart,
  HeartHandshake, MapPin, MessageCircle, PawPrint, Scissors, ShoppingBag, Sparkles, Star,
  Stethoscope, Tag, Target, Timer, Utensils, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ThemeIcon } from "@/lib/themes";

const ICONS: Record<ThemeIcon, LucideIcon> = {
  utensils: Utensils, flame: Flame, bike: Bike, star: Star, sparkles: Sparkles,
  calendar: CalendarCheck, scissors: Scissors, stethoscope: Stethoscope,
  "heart-handshake": HeartHandshake, "map-pin": MapPin, dumbbell: Dumbbell, clock: Clock,
  target: Target, paw: PawPrint, bath: Bath, bone: Bone, heart: Heart, bag: ShoppingBag,
  tag: Tag, message: MessageCircle, handshake: Handshake, wrench: Wrench, check: CircleCheck,
  timer: Timer,
};

export function ThemeIconSvg({ name, size = 24 }: { name: ThemeIcon; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
