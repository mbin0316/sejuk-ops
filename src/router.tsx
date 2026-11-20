import { createBrowserRouter, Navigate } from 'react-router'
import { DesktopShell } from './components/DesktopShell.tsx'
import { RequireRole } from './components/RequireRole.tsx'
import { TechShell } from './components/TechShell.tsx'
import { AssistantPage } from './pages/desk/AssistantPage.tsx'
import { NewOrderPage } from './pages/desk/NewOrderPage.tsx'
import { OrderDetailPage } from './pages/desk/OrderDetailPage.tsx'
import { OrdersPage } from './pages/desk/OrdersPage.tsx'
import { OverviewPage } from './pages/desk/OverviewPage.tsx'
import { ReviewPage } from './pages/desk/ReviewPage.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { JobPage } from './pages/tech/JobPage.tsx'
import { JobsPage } from './pages/tech/JobsPage.tsx'
import { ProfilePage } from './pages/tech/ProfilePage.tsx'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    // Desktop app shared by admin and manager; nav and pages are filtered by role.
    element: (
      <RequireRole roles={['admin', 'manager']}>
        <DesktopShell />
      </RequireRole>
    ),
    children: [
      { path: '/orders', element: <OrdersPage /> },
      { path: '/orders/new', element: <RequireRole roles={['admin']}><NewOrderPage /></RequireRole> },
      { path: '/orders/:id', element: <OrderDetailPage /> },
      { path: '/overview', element: <OverviewPage /> },
      { path: '/review', element: <RequireRole roles={['manager']}><ReviewPage /></RequireRole> },
      { path: '/assistant', element: <AssistantPage /> },
    ],
  },
  {
    path: '/tech',
    element: (
      <RequireRole roles={['technician']}>
        <TechShell />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="jobs" replace /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
