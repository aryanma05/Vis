import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { LocaleProvider, LocaleTransition } from "@/components/LocaleProvider";
import { makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import MobileNav from "@/components/MobileNav";
import CommandPalette from "@/components/nav/CommandPalette";
import HomeLogo from "@/components/nav/HomeLogo";
import { MotionPrefs } from "@/components/settings/display-prefs";
import SettingsDialog from "@/components/settings/SettingsDialog";
import Sidebar from "@/components/Sidebar";
import SiteFooter from "@/components/SiteFooter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toast";
import { isAdmin } from "@/lib/admin";
import { displayPrefsScript } from "@/lib/display-prefs";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

// Geist: en ren grotesk som ligger nær Aeonik (som er en betalt font). Se README for
// hvordan man bytter til Aeonik med lisens.
const sans = Geist({ variable: "--font-geist", subsets: ["latin", "latin-ext"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = makeT(locale);
  const title = t("Vis – prosjektene dine, vist frem");
  const description = t(SITE_DESCRIPTION);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: "%s · Vis" },
    description,
    applicationName: SITE_NAME,
    openGraph: { type: "website", siteName: SITE_NAME, locale: locale === "en" ? "en_GB" : "nb_NO", title, description },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060b1d" },
    { media: "(prefers-color-scheme: light)", color: "#eef0f5" },
  ],
};

// Setter temaet og visningsvalgene (innstillingene) før siden tegnes, så den ikke blinker.
const themeScript = `try{var t=localStorage.getItem("vis-theme");document.documentElement.dataset.theme=t==="dark"||t==="light"||t==="midnight"?t:"midnight"}catch(e){document.documentElement.dataset.theme="midnight"}${displayPrefsScript}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
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
      lang={locale === "en" ? "en" : "nb"}
      data-theme="midnight"
      className={`${sans.variable} min-h-screen antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <LocaleProvider locale={locale}>
        <ThemeProvider>
        <MotionPrefs>
          <a
            href="#innhold"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
          >
            {t("Hopp til innholdet")}
          </a>
          <HomeLogo />
          <Sidebar user={navUser} />
          <MobileNav user={navUser} />
          <LocaleTransition>
            <div id="innhold">{children}</div>
          </LocaleTransition>
          <SiteFooter />
          <Analytics />
          <CommandPalette loggedIn={Boolean(user)} username={user?.username ?? null} />
          <SettingsDialog loggedIn={Boolean(user)} />
          <Toaster />
        </MotionPrefs>
        </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
