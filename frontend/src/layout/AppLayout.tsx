import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { SidebarProvider } from './SidebarProvider';
import { Topbar } from './Topbar';

/** Signed-in shell: collapsible sidebar (sheet on mobile), top bar, page content. */
export const AppLayout = () => (
  <SidebarProvider>
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  </SidebarProvider>
);
