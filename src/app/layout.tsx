import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
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
        <NextTopLoader
          color="#4F46E5"
          height={3}
          showSpinner={false}
        />
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

