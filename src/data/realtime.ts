/**
 * "Something changed, refetch" pings.
 *
 * Database triggers send an empty broadcast on `class:<id>` whenever a class's
 * assignments, subjects or members change, and on `user:<id>` whenever that
 * person's list of classes changes. The data itself is always refetched through
 * row-level security, so a ping can never leak a row.
 */

import { supabase } from "../lib/supabase";

/**
 * Calls `load` now and again on every ping. Returns the unsubscribe function.
 * Callers guard against out-of-order results themselves.
 */
export function watchTopic(topic: string, load: () => void): () => void {
  const channel = supabase
    .channel(topic)
    .on("broadcast", { event: "changed" }, () => load())
    .subscribe((status) => {
      // A reconnect may have missed pings; catch up.
      if (status === "SUBSCRIBED") load();
    });

  load();

  return () => {
    void supabase.removeChannel(channel);
  };
}
