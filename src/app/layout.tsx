import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "@/styles/tokens.css";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "./SiteHeader";

const bricolage = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DemoQuizApp",
  description: "Take quizzes and see where you rank.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
