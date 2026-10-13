import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import { useAuth } from "../context/useAuth";
import { SOCKET_URL } from "../config/urls";

function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"], // ✅ IMPORTANT
      withCredentials: true,
      auth: {
        token: localStorage.getItem("token"),
      },
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      newSocket.emit("join", { userId: user.id, role: user.role });
      setSocket(newSocket);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export default SocketProvider;
