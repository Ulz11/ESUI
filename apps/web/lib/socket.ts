"use client";

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "./auth-store";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "ws://localhost:8000";

let socket: Socket | null = null;
let lastToken: string | null = null;

/** Returns a singleton Socket.io client bound to the current bearer token.
 *  When the token changes the previous connection is torn down and reopened. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    lastToken = null;
    return null;
  }
  if (socket && lastToken === token) return socket;
  if (socket) socket.disconnect();
  socket = io(WS_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 800,
  });
  lastToken = token;
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastToken = null;
}
