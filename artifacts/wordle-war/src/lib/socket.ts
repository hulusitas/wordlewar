import { io, Socket } from "socket.io-client";

const socket: Socket = io(window.location.origin, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
});

export default socket;
