import { supabase } from './supabaseClient';

export function subscribeToApplications(
  userId: string,
  onChange: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE' }) => void
) {
  // Channel name must be unique per subscription. A fixed topic re-subscribed
  // during React 18/19 StrictMode's mount -> unmount -> remount cycle throws
  // "tried to subscribe multiple times". `crypto.randomUUID()` would also
  // work but only exists in secure contexts (HTTPS/localhost) — it's
  // undefined when testing over a plain-HTTP LAN address, which throws here
  // and (with no error boundary yet) blanks the whole app.
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(`applications-changes-${userId}-${uniqueSuffix}`)
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
