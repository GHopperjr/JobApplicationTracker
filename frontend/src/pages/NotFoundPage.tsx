import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-center">
      <p className="text-sm text-slate-900">Page not found.</p>
      <Link to={ROUTES.applications} className="text-sm text-slate-600 underline hover:text-slate-900">
        Back to Applications
      </Link>
    </div>
  );
}
