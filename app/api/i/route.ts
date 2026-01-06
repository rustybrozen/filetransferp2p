import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic'; // Quan trọng: Để không bị cache static

export async function GET() {
const iceServers: { urls: string; username?: string; credential?: string }[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];

  // 2. Thêm TURN Server riêng (Nếu có cấu hình trong .env)
  const TURN_URL = process.env.TURN_URL;
  const TURN_SECRET = process.env.TURN_SECRET;

  if (TURN_URL && TURN_SECRET) {
    // --- LOGIC SINH PASS ĐỘNG (Standard TURN REST API) ---
    
    // Tạo timestamp hết hạn (ví dụ: 86400s = 24h sau tính từ bây giờ)
    const unixTimeStamp = Math.floor(Date.now() / 1000) + 24 * 3600;
    
    // Username format chuẩn: {timestamp}:{username_tùy_ý}
    const username = `${unixTimeStamp}:user_p2p`;

    // Tạo password bằng thuật toán HMAC-SHA1
    const hmac = crypto.createHmac("sha1", TURN_SECRET);
    hmac.setEncoding("base64");
    hmac.write(username);
    hmac.end();
    const password = hmac.read();

    // Đẩy vào danh sách
    iceServers.push({
      urls: TURN_URL,
      username: username,
      credential: password as string,
    });
  }

  return NextResponse.json(iceServers);
}