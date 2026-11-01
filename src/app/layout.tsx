import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getCurrentUser } from "@/lib/session";
import { SiteHeader } from "@/features/site/SiteHeader";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DemoQuizApp",
  description: "Take quizzes and see where you rank.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // loaded here so the header itself stays a plain view
  const user = await getCurrentUser();

  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>
          <SiteHeader user={user} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
