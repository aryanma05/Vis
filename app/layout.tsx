import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "vis – vis frem det du lager", template: "%s – vis" },
  description: "Vis samler CV-en, prosjektene og den digitale identiteten din i én visuell profil.",
};

// Setter temaet før siden tegnes, så den ikke blinker i feil farge.
const themeScript = `try{var t=localStorage.getItem("vis-theme");document.documentElement.dataset.theme=t==="dark"||t==="light"||t==="midnight"?t:"midnight"}catch(e){document.documentElement.dataset.theme="midnight"}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const navUser = user
    ? {
        username: user.username,
        name: user.name,
        image: user.image ?? null,
        unread: await getUnreadCount(user.id),
      }
    : null;

  return (
    <html
      lang="nb"
      data-theme="midnight"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} min-h-screen antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <Sidebar user={navUser} />
          <MobileNav user={navUser} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
