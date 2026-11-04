import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import { RequireAccount } from "@/components/RequireAccount";
import Index from "./pages/Index";
const Build = lazy(() => import("./pages/Build"));
const Settings = lazy(() => import("./pages/Settings"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const History = lazy(() => import("./pages/History"));
import Onboarding from "./pages/Onboarding";
const WorkoutSession = lazy(() => import("./pages/WorkoutSession"));
const QuickSession = lazy(() => import("./pages/QuickSession"));
const FightClub = lazy(() => import("./pages/FightClub"));
const Stats = lazy(() => import("./pages/Stats"));
const Profile = lazy(() => import("./pages/Profile"));
import Auth from "./pages/Auth";
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const Gloves = lazy(() => import("./pages/Gloves"));
import NotFound from "./pages/NotFound";

// Lazy so the pose tracker and its page stay out of the main bundle
const PunchCheck = lazy(() => import("./pages/PunchCheck"));
// Dev only: the camera-angle lab. A production build drops this branch, page and all.
const AngleLab = import.meta.env.DEV ? lazy(() => import("./pages/AngleLab")) : null;

// Offline, React Query would otherwise park a save without a word: nothing for guests, whose saves
// are local, and for accounts a pile of duplicates once the connection comes back.
const queryClient = new QueryClient({ defaultOptions: { mutations: { networkMode: "always" } } });

const App = () => (
  <AppErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<div role="status" className="min-h-screen bg-background p-6 text-foreground">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/build" element={<Build />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/history" element={<History />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/fight-club" element={<FightClub />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/quick-session" element={<QuickSession />} />
            <Route
              path="/punch-check"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <PunchCheck />
                </Suspense>
              }
            />
            {AngleLab && (
              <Route
                path="/lab/angles"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <AngleLab />
                  </Suspense>
                }
              />
            )}
            <Route path="/workout/:id" element={<WorkoutSession />} />
            <Route path="/workout/:id/session" element={<WorkoutSession />} />
            <Route path="/admin" element={<RequireAccount><AdminPortal /></RequireAccount>} />
            <Route path="/gloves" element={<Gloves />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
