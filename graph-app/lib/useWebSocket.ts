"use client";
import { useEffect } from "react";

export function useWebSocket(url: string, onRefresh: () => void, onClustersUpdated?: () => void): void {
  useEffect(() => {
    let ws: WebSocket;
    let closed = false;

    function connect() {
      ws = new WebSocket(url);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type: string };
          if (msg.type === "refresh") onRefresh();
          else if (msg.type === "clusters_updated") onClustersUpdated?.();
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
