import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { TopLoader } from "@/components/TopLoader";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export async function generateMetadata() {
  const t = await getTranslations("Header");
  return {
    title: "Muhimmak",
    description: t("pageTitle"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={locale === "ar" ? ibmPlexArabic.variable : inter.variable}
    >
      <body className="min-h-full flex flex-col">
        <TopLoader />
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}


