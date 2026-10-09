import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Files,
  Library,
  LineChart,
  MessagesSquare,
  PackageOpen,
  ScrollText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "@/lib/design/navigation";

// Icônes Lucide des entrées de navigation (CLAUDE.md §7 : Lucide ou pictogrammes
// EODA, jamais ARASAAC ni SantéBD). Toujours accompagnées de leur libellé : visible
// quand il y a la place, accessible et en infobulle sinon — jamais d'icône seule.
// `Record` exhaustif : une clé ajoutée sans icône ne compile pas.
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  structures: Building2,
  review: ClipboardCheck,
  agenda: CalendarDays,
  library: Library,
  journal: ScrollText,
  commercial: LineChart,
  prospects: Users,
  devis: FileText,
  catalogue: BookOpen,
  documents: Files,
  deliverables: PackageOpen,
  progress: TrendingUp,
  messages: MessagesSquare,
};
