import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { CompareTray } from "@/components/layout/CompareTray";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { Toaster } from "@/components/ui/Toaster";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { CatalogProvider } from "@/lib/catalog-context";
import { listProducts } from "@/lib/products/queries";
import { GrowthProvider } from "@/lib/growth/GrowthProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VeggieVan — Bringing Fresh Vegetables Home Every Morning",
  description:
    "Pre-order fresh vegetables in Dhaka between 8:00 PM and 11:59 PM. Sourced overnight at Karwan Bazar and delivered to your door from 7:00 AM across Uttara, Mirpur, Bashundhara, Khilgaon, and Dhanmondi.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const products = await listProducts();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans">
        <SessionProviderWrapper>
          <GrowthProvider>
            <CatalogProvider products={products}>
              <Header />
              <main className="min-h-[calc(100vh-240px)]">{children}</main>
              <Footer />
              <CartDrawer />
              <CompareTray />
              <SearchCommand />
              <Toaster />
            </CatalogProvider>
          </GrowthProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
