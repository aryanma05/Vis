import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import CommandPalette from "@/components/nav/CommandPalette";
import Sidebar from "@/components/Sidebar";
import SiteFooter from "@/components/SiteFooter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toast";
import { isAdmin } from "@/lib/admin";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

const sans = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin", "latin-ext"], display: "swap" });
const serif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Vis – din faglige identitet på ett sted", template: "%s · Vis" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "nb_NO",
    title: "Vis – din faglige identitet på ett sted",
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#071a52" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
  ],
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
        isAdmin: isAdmin(user),
      }
    : null;

  return (
    <html
      lang="nb"
      data-theme="midnight"
      className={`${sans.variable} ${serif.variable} ${mono.variable} min-h-screen antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <a
            href="#innhold"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
          >
            Hopp til innholdet
          </a>
          <Sidebar user={navUser} />
          <MobileNav user={navUser} />
          <div id="innhold">{children}</div>
          <SiteFooter />
          <CommandPalette loggedIn={Boolean(user)} username={user?.username ?? null} />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
