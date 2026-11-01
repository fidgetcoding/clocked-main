import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAccount } from "@/components/RequireAccount";
import Index from "./pages/Index";
import Build from "./pages/Build";
import Settings from "./pages/Settings";
import EditProfile from "./pages/EditProfile";
import History from "./pages/History";
import Onboarding from "./pages/Onboarding";
import WorkoutSession from "./pages/WorkoutSession";
import QuickSession from "./pages/QuickSession";
import FightClub from "./pages/FightClub";
import Stats from "./pages/Stats";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import AdminPortal from "./pages/AdminPortal";
import Gloves from "./pages/Gloves";
import NotFound from "./pages/NotFound";

// Lazy so the pose tracker and its page stay out of the main bundle
const PunchCheck = lazy(() => import("./pages/PunchCheck"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/workout/:id" element={<WorkoutSession />} />
            <Route path="/workout/:id/session" element={<WorkoutSession />} />
            <Route path="/admin" element={<RequireAccount><AdminPortal /></RequireAccount>} />
            <Route path="/gloves" element={<Gloves />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
