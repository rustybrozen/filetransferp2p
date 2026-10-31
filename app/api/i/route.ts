import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
const iceServers: { urls: string; username?: string; credential?: string }[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];


  const TURN_URL = process.env.TURN_URL;
  const TURN_SECRET = process.env.TURN_SECRET;

  if (TURN_URL && TURN_SECRET) {


    const unixTimeStamp = Math.floor(Date.now() / 1000) + 24 * 3600;


    const username = `${unixTimeStamp}:user_p2p`;

    const hmac = crypto.createHmac("sha1", TURN_SECRET);
    hmac.setEncoding("base64");
    hmac.write(username);
    hmac.end();
    const password = hmac.read();

    iceServers.push({
      urls: TURN_URL,
      username: username,
      credential: password as string,
    });
  }

  return NextResponse.json(iceServers);
}

