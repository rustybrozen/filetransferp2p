import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import { RateLimiterMemory } from "rate-limiter-flexible";

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
const port = parseInt(process.env.PORT || "3010", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- CONFIG RATE LIMIT ---
// Limit 1: Chống Spam kết nối (Theo IP) - Tối đa 20 connect/phút
const rateLimiterConnection = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

// Limit 2: Chống Spam tín hiệu (Theo Socket ID) - Tối đa 15 signal/giây
// WebRTC handshake khá tốn request nên để 15 là an toàn
const rateLimiterSignal = new RateLimiterMemory({
  points: 15,
  duration: 1,
});

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
      methods: ["GET", "POST"],
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
      const ipAddress = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor;
      if (typeof ipAddress === "string") {
        return ipAddress.split(",")[0].trim();
      }
    }
    return socket.handshake.address || "unknown_ip";
  };

  io.on("connection", async (socket) => {
    const ip = getClientIp(socket);
    try {
      await rateLimiterConnection.consume(ip);
    } catch {
      socket.disconnect(true);
      return;
    }

    const checkLimit = async () => {
      try {
        await rateLimiterSignal.consume(socket.id);
        return true;
      } catch {
        socket.emit("error-message", "Bạn thao tác quá nhanh! Vui lòng chờ.");
        return false;
      }
    };
    socket.on(
      "join-room",
      async ({
        roomId,
        name,
        deviceId,
      }: {
        roomId: string;
        name: string;
        deviceId: string;
      }) => {
        if (!(await checkLimit())) return;
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
      }
    );

    // 2. Signaling (WebRTC handshake)
socket.on("signal", async (data: SignalData) => {
      if (!(await checkLimit())) return; // Chặn nếu spam
      io.to(data.to).emit("signal", { from: data.from, signal: data.signal });
    });

    // 3. Queue Logic
socket.on("queue-add", async ({ to, files }: { to: string; files: string[] }) => {
      if (!(await checkLimit())) return;
      io.to(to).emit("queue-add", { from: socket.id, files });
    });
    socket.on("queue-remove", ({ to }: { to: string }) => {
      io.to(to).emit("queue-remove", { from: socket.id });
    });

socket.on("queue-reject", async ({ to }: { to: string }) => {
      if (!(await checkLimit())) return;
      io.to(to).emit("queue-reject", { from: socket.id });
    });

socket.on("transfer-accept", async ({ to }: { to: string }) => {
      if (!(await checkLimit())) return;
      io.to(to).emit("transfer-accept", { from: socket.id });
    });

    socket.on(
      "transfer-cancel",
      ({ to, fileId }: { to: string; fileId: string }) => {
        io.to(to).emit("transfer-cancel", { from: socket.id, fileId });
      }
    );
socket.on("check-room-availability", async (roomId: string, callback: (exists: boolean) => void) => {
        if (!(await checkLimit())) return; 
        const room = io.sockets.adapter.rooms.get(roomId);
        const exists = room && room.size > 0;
        callback(!!exists);
    });

    
socket.on("disconnect", () => {
      
      rateLimiterSignal.delete(socket.id); 

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
