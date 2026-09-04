import { supabase } from './supabaseClient';

export function subscribeToApplications(
  userId: string,
  onChange: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE' }) => void
) {
  // Channel name must be unique per subscription. A fixed topic re-subscribed
  // during React 18/19 StrictMode's mount -> unmount -> remount cycle throws
  // "tried to subscribe multiple times".
  const channel = supabase
    .channel(`applications-changes-${userId}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Deliberately does NOT pass the row. In supabase-js v2, payload.new
        // is `{}` (not null) for DELETE and payload.old is `{}` for INSERT,
        // so a `payload.new ?? payload.old` contract silently yields empty
        // objects. The only consumer invalidates the cache anyway.
        onChange({ type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE' });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
