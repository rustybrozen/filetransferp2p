import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";

// --- TYPES (Để chung vào đây cho gọn hoặc import từ file types của ông) ---
export interface User {
  id: string;
  name: string;
  roomId: string;
  deviceId: string;
}

export interface SignalData {
  to: string;
  from: string;
  signal: unknown;
}

// --- CONFIG NEXT.JS ---
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- LOGIC SOCKET SERVER ---
app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    // Vì chạy chung 1 domain/port nên cors cấu hình đơn giản hơn
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    },
    pingTimeout: 2000,
    pingInterval: 2000,
  });

  const users = new Map<string, User>();

  // 🔥 Hàm lấy IP chuẩn (Đã fix lỗi TypeScript)
  const getClientIp = (socket: Socket) => {
    const headers = socket.handshake.headers;
    const xForwardedFor = headers["x-forwarded-for"];

    if (xForwardedFor) {
        const ipAddress = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
        if (typeof ipAddress === 'string') {
            return ipAddress.split(',')[0].trim();
        }
    }
    return socket.handshake.address || "unknown_ip";
  };

  io.on("connection", (socket) => {
    console.log(`📡 New connection: ${socket.id}`);

    // 1. Join Room
    socket.on("join-room", ({ roomId, name, deviceId }: { roomId: string; name: string; deviceId: string }) => {
        let targetRoom = roomId;
        
        // Logic Auto Detect LAN
        if (roomId === "AUTO_DETECT") {
          const ip = getClientIp(socket);
          targetRoom = `LAN_${ip.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }
  
        // Lưu User
        const newUser: User = {
          id: socket.id,
          name,
          roomId: targetRoom,
          deviceId,
        };
  
        users.set(socket.id, newUser);
        socket.join(targetRoom);
        socket.emit("room-assigned", targetRoom);
  
        // Gửi danh sách user cũ cho người mới
        const otherUsersInRoom = Array.from(users.values()).filter(
          (user) => user.roomId === targetRoom && user.id !== socket.id
        );
        socket.emit("existing-users", otherUsersInRoom);
        
        // Báo cho người cũ biết có người mới
        socket.to(targetRoom).emit("user-joined", newUser);
    });

    // 2. Signaling (WebRTC handshake)
    socket.on("signal", (data: SignalData) => {
      io.to(data.to).emit("signal", { from: data.from, signal: data.signal });
    });

    // 3. Queue Logic
socket.on("queue-add", ({ to, files }: { to: string; files: string[] }) => {
      io.to(to).emit("queue-add", { from: socket.id, files });
    });

    socket.on("queue-remove", ({ to }: { to: string }) => {
      io.to(to).emit("queue-remove", { from: socket.id });
    });

    // 🔥 MỚI: Sự kiện chấp nhận file
    socket.on("queue-accept", ({ to }: { to: string }) => {
      io.to(to).emit("queue-accept", { from: socket.id });
    });

    socket.on("queue-reject", ({ to }: { to: string }) => {
      io.to(to).emit("queue-reject", { from: socket.id });
    });

    // 4. Check Room
    socket.on("check-room-availability", (roomId: string, callback: (exists: boolean) => void) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const exists = room && room.size > 0;
        callback(!!exists);
    });

    // 5. Disconnect
    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (user) {
        socket.to(user.roomId).emit("user-left", socket.id);
        users.delete(socket.id);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO is running on the same port!`);
  });
});