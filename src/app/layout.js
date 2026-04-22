import { Inter } from "next/font/google";
import "./globals.css";
import { UIProvider } from "@/contexts/UIContext";
import { DataProvider } from "@/contexts/DataContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Warehouse Center",
  description: "Kompletní řídicí centrum skladových operací — pickování, balení, sklad a materiály.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
        <UIProvider>
          <DataProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0',
                  backdropFilter: 'blur(12px)',
                },
              }}
            />
            {children}
          </DataProvider>
        </UIProvider>
      </body>
    </html>
  );
}
