import { supabase } from './supabaseClient';

/**
 * Lightweight realtime signalling over Supabase broadcast channels.
 *
 * RLS keeps the sales/table_messages tables unreadable for anonymous
 * customers (and postgres_changes silent for header-authenticated staff
 * sessions), so live updates are propagated by explicit broadcasts:
 *
 *  - `haang-shop:{shopId}`     — staff devices listen here; any order change
 *                                triggers a throttled refetch.
 *  - `public_order:{tableId}`  — the customer QR page of one table listens
 *                                here for order changes and chat messages.
 */

const sendOnChannel = (topic: string, event: string, payload: any) => {
  try {
    // Reuse an already-joined channel with this topic if the app owns one
    // (subscribing twice to the same topic throws in supabase-js).
    const channels = (supabase.getChannels?.() || []) as any[];
    const existing = channels.find((c: any) => c.topic === `realtime:${topic}`);
    if (existing && existing.state === 'joined') {
      existing.send({ type: 'broadcast', event, payload });
      return;
    }
    const ch = supabase.channel(topic);
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        Promise.resolve(ch.send({ type: 'broadcast', event, payload }))
          .then(() => { supabase.removeChannel(ch); }, () => { supabase.removeChannel(ch); });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        supabase.removeChannel(ch);
      }
    });
  } catch { /* realtime is best-effort */ }
};

/** Tell every staff device of this shop that order data changed. */
export const notifyShopDataChanged = (shopId?: string | null) => {
  if (!shopId) return;
  sendOnChannel(`haang-shop:${shopId}`, 'data_changed', { at: Date.now() });
};

/** Tell the customer QR page of a table that its order changed. */
export const notifyTableOrderChanged = (tableId?: string | null) => {
  if (!tableId) return;
  sendOnChannel(`public_order:${tableId}`, 'table_update', { tableId });
};

/** Deliver a chat message to the customer QR page of a table. */
export const sendTableChatBroadcast = (tableId: string, message: { id: string; sender: 'staff' | 'customer'; message: string; type: string; createdAt: number }) => {
  sendOnChannel(`public_order:${tableId}`, 'chat_message', { tableId, ...message });
};
