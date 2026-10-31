import Peer from "simple-peer";
import { FileHeader, FileEnd } from "@/types/transfer";

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFER = 1024 * 1024;
const BUFFER_LOW_THRESHOLD = 256 * 1024;

interface PeerWithChannel {
  _channel?: RTCDataChannel;
}


export const sendFile = async (
  peer: Peer.Instance,
  file: File,
  onProgress: (p: number, fileId: string) => void,
  isCancelled: (fileId: string) => boolean
) => {
  const fileId = Math.random().toString(36).substring(7);

  if (peer.destroyed) throw new Error("Connection lost before start");

  const header: FileHeader = {
    type: "metadata",
    fileId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  };

  try {
    peer.send(JSON.stringify(header));
  } catch {
    throw new Error("Failed to send header: Peer closed");
  }

  const encoder = new TextEncoder();
  const fileIdBytes = encoder.encode(fileId);
  const headerLen = 2 + fileIdBytes.length;

  let offset = 0;
  let lastReportedPercent = -1;

  return new Promise<void>((resolve, reject) => {
    let inFlight = false;

    const readChunk = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        if (isCancelled(fileId)) {
          reject(new Error("Cancelled by sender"));
          return;
        }

        const channel = (peer as unknown as PeerWithChannel)._channel;
        if (peer.destroyed || !channel) {
          reject(new Error("Connection lost (Peer destroyed)"));
          return;
        }

        if (channel.bufferedAmount > MAX_BUFFER) {
          channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;
          let resumed = false;
          const resume = () => {
            if (resumed) return;
            resumed = true;
            channel.removeEventListener("bufferedamountlow", resume);
            clearTimeout(fallbackTimer);
            inFlight = false;
            readChunk();
          };
          const fallbackTimer = setTimeout(resume, 100);
          channel.addEventListener("bufferedamountlow", resume, { once: true });
          return;
        }

        if (offset < file.size) {
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const rawBuffer = await slice.arrayBuffer();

          if (peer.destroyed || isCancelled(fileId)) {
            try {
              peer.send(JSON.stringify({ type: "cancel", fileId }));
            } catch {

            }
            reject(new Error("Transfer cancelled"));
            return;
          }

          const packet = new Uint8Array(headerLen + rawBuffer.byteLength);
          packet[0] = 0x01;
          packet[1] = fileIdBytes.length;
          packet.set(fileIdBytes, 2);
          packet.set(new Uint8Array(rawBuffer), headerLen);

          try {
            peer.send(packet.buffer);
            offset += rawBuffer.byteLength;
            const currentPercent = Math.min(100, Math.round((offset / file.size) * 100));
            if (currentPercent !== lastReportedPercent || offset >= file.size) {
              lastReportedPercent = currentPercent;
              onProgress(currentPercent, fileId);
            }

            inFlight = false;
            readChunk();
          } catch {
            reject(new Error("Send failed (Connection lost)"));
          }
        } else {
          try {
            const endSignal: FileEnd = { type: "end", fileId };
            peer.send(JSON.stringify(endSignal));
            resolve();
          } catch {
            resolve();
          }
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error("File read error"));
      }
    };

    readChunk();
  });
};


export const sendBatchFiles = async (
  peer: Peer.Instance,
  files: FileList | File[],
  onProgress: (fileName: string, percent: number, fileId: string, current: number, total: number) => void,
  isCancelled: (fileId: string) => boolean
) => {
  const fileArray = Array.from(files);
  const total = fileArray.length;
  for (let i = 0; i < total; i++) {
    try {
      const file = fileArray[i];

      await sendFile(
        peer,
        file,
        (percent, fileId) => {
          onProgress(file.name, percent, fileId, i + 1, total);
        },
        isCancelled
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      if (
        errorMessage === "Transfer cancelled" ||
        errorMessage === "Cancelled by sender"
      ) {
        throw err;
      }
      console.error("File send error:", err);
    }
  }
};


