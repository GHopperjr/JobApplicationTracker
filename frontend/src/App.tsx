import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ROUTES } from './constants/routes';
import { ApplicationFormProvider } from './context/ApplicationFormProvider';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.applications} replace />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <ApplicationFormProvider>
              <AppShell />
            </ApplicationFormProvider>
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.applications} element={<ApplicationsPage />} />
        <Route path="/applications/:id" element={<ApplicationsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
