import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div role="status" className="bg-rose-50 px-4 py-1.5 text-center text-xs font-medium text-rose-700">
      You&rsquo;re offline. Changes won&rsquo;t be saved until your connection comes back.
    </div>
  );
}
