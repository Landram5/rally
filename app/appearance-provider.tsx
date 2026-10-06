'use client';
import {ThemeProvider} from 'next-themes';
export default function AppearanceProvider({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" storageKey="rally-appearance" defaultTheme="light" enableSystem disableTransitionOnChange>{children}</ThemeProvider>;}
