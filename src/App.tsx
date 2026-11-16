import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MarketingProvider } from '@/lib/marketing/store';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import Index from '@/pages/Index';
import Planner from '@/pages/marketing/Planner';
import AIWorkspace from '@/pages/marketing/AIWorkspace';
import ContentCalendar from '@/pages/marketing/ContentCalendar';
import ContentLibrary from '@/pages/marketing/ContentLibrary';
import { ProductionQueue, Analytics, Products, SystemLogs } from '@/pages/marketing/Operations';
import Settings from '@/pages/marketing/Settings';

export default function App() {
  return <ThemeProvider attribute="class" defaultTheme="dark" storageKey="yahia-marketing-theme" enableSystem={false}>
    <TooltipProvider><Toaster richColors position="bottom-right" /><MarketingProvider><BrowserRouter><Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/ai" element={<AIWorkspace />} />
        <Route path="/calendar" element={<ContentCalendar />} />
        <Route path="/library" element={<ContentLibrary />} />
        <Route path="/queue" element={<ProductionQueue />} />
        <Route path="/approvals" element={<ContentLibrary approvals />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/products" element={<Products />} />
        <Route path="/logs" element={<SystemLogs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<div className="rounded-2xl border bg-card p-12 text-center"><h1 className="text-2xl font-semibold">This page hasn’t taken root.</h1><p className="mt-3 text-muted-foreground">Head back to your marketing workspace.</p><Link className="mt-6 inline-block text-primary" to="/">Return to overview →</Link></div>} />
      </Route>
    </Routes></BrowserRouter></MarketingProvider></TooltipProvider>
  </ThemeProvider>;
}
