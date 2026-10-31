import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "@/styles/tokens.css";
import "./globals.css";
import { Providers } from "./providers";
import { getCurrentUser } from "@/lib/session";
import { SiteHeader } from "@/features/site/SiteHeader";

const bricolage = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DemoQuizApp",
  description: "Take quizzes and see where you rank.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // loaded here so the header itself stays a plain view
  const user = await getCurrentUser();

  return (
    <html lang="en" className={bricolage.variable}>
      <body>
        <Providers>
          <SiteHeader user={user} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
