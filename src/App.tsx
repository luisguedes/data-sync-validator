import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute, PublicRoute, SetupRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import Connections from "@/pages/Connections";
import Templates from "@/pages/Templates";
import Conferences from "@/pages/Conferences";
import ConferenceExecution from "@/pages/ConferenceExecution";
import ClientConference from "@/pages/ClientConference";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppSettingsProvider>
          <NotificationProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              
              {/* Setup route */}
              <Route
                path="/setup"
                element={
                  <SetupRoute>
                    <Setup />
                  </SetupRoute>
                }
              />

              {/* Protected routes with layout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/connections"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Connections />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/templates"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Templates />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/conferences"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Conferences />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/conferences/new"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard /> {/* Placeholder - will be replaced */}
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/conferences/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard /> {/* Placeholder - will be replaced */}
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Settings route */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Reports route */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Reports />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requireAdmin>
                    <AppLayout>
                      <Dashboard /> {/* Placeholder - will be replaced */}
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Public client route - no auth required */}
              <Route path="/client/:token" element={<ClientConference />} />

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </NotificationProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
