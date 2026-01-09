import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useConferences } from '@/hooks/useConferences';
import { useConferenceNotifications } from '@/hooks/useNotifications';
import { useNotifications } from '@/contexts/NotificationContext';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { allConferences } = useConferences();
  const notificationCenter = useNotifications();
  
  // Initialize real-time notifications with notification center integration
  useConferenceNotifications(allConferences, undefined, {
    addNotification: notificationCenter.addNotification,
    playSound: notificationCenter.playSound,
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
