import Peer from "simple-peer";
import { FileHeader, FileEnd } from "@/types/transfer";

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFER = 1024 * 1024;

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

    let offset = 0;

    return new Promise<void>((resolve, reject) => {
        const readChunk = () => {



            if (isCancelled(fileId)) {
                reject(new Error("Cancelled by sender"));
                return;
            }


            // Ép kiểu (peer as any) vì _channel là property nội bộ
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (peer.destroyed || !(peer as any)._channel) {
                reject(new Error("Connection lost (Peer destroyed)"));
                return;
            }


            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((peer as any)._channel.bufferedAmount > MAX_BUFFER) {
                console.log("Network congested, waiting...");
                setTimeout(readChunk, 50);
                return;
            }
            // ----------------------------------------------------

            if (offset < file.size) {
                const slice = file.slice(offset, offset + CHUNK_SIZE);
                const reader = new FileReader();

                reader.onload = (e) => {
                    // Check lại phát nữa trước khi send cho chắc
                    if (peer.destroyed || isCancelled(fileId)) {
            
                        return;
                    }

                    const buffer = e.target?.result as ArrayBuffer;
                    try {
                        peer.send(buffer);
                        offset += buffer.byteLength;
                        onProgress((offset / file.size) * 100, fileId);
                  
                        readChunk(); // Loop tiếp
                    } catch {
                        reject(new Error("Send failed (Connection lost)"));
                    }
                };

                reader.onerror = () => reject(new Error("File read error"));
                reader.readAsArrayBuffer(slice);
            } else {
                // Gửi xong -> Gửi tín hiệu End
                try {
                    const endSignal: FileEnd = { type: "end", fileId };
                    peer.send(JSON.stringify(endSignal));
                    resolve();
                } catch {

                    resolve();
                }
            }
        };

        readChunk();
    });
};

// Hàm batch giữ nguyên
export const sendBatchFiles = async (
    peer: Peer.Instance,
    files: FileList | File[],
    onProgress: (fileName: string, percent: number, fileId: string) => void,
    isCancelled: (fileId: string) => boolean
) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      await sendFile(
      peer,
      file,
      (percent, fileId) => { // <--- NHẬN fileId Ở ĐÂY
        onProgress(file.name, percent, fileId); // <--- TRUYỀN RA NGOÀI
      },
      isCancelled
    );
    }
};
