import Peer from "simple-peer";
import { FileHeader, FileEnd } from "@/types/transfer";

const CHUNK_SIZE = 64 * 1024; // 64KB
const MAX_BUFFER = 1024 * 1024; // 1MB Backpressure

// --- HÀM GỬI 1 FILE ---
export const sendFile = async (
  peer: Peer.Instance,
  file: File,
  fileId: string, // 🔥 CHANGE 1: Nhận ID từ ngoài vào để đồng bộ
  onProgress: (percent: number) => void,
  isCancelled: (fileId: string) => boolean
) => {
  // Check ngay từ đầu
  if (isCancelled(fileId)) throw new Error("Cancelled by user");
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
      // 1. Check Hủy
      if (isCancelled(fileId)) {
        // 🔥 CHANGE 2: Báo cho bên kia biết là tao hủy rồi
        try {
            peer.send(JSON.stringify({ type: "cancel", fileId }));
        } catch (e) {} // Bỏ qua lỗi nếu peer đã chết
        
        reject(new Error("Cancelled by sender"));
        return;
      }

      // 2. Check Peer chết
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (peer.destroyed || !(peer as any)._channel) {
        reject(new Error("Connection lost (Peer destroyed)"));
        return;
      }

      // 3. Backpressure (Mạng chậm thì chờ)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((peer as any)._channel.bufferedAmount > MAX_BUFFER) {
        // console.log("Network congested, waiting..."); // Comment lại cho đỡ spam log
        setTimeout(readChunk, 50);
        return;
      }

      if (offset < file.size) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();

        reader.onload = (e) => {
          // Check lại phát nữa sau khi đọc file xong
          if (peer.destroyed || isCancelled(fileId)) {
             // Thử gửi cancel signal lần nữa cho chắc
             try { peer.send(JSON.stringify({ type: "cancel", fileId })); } catch{}
             reject(new Error("Transfer interrupted"));
             return;
          }

          const buffer = e.target?.result as ArrayBuffer;
          try {
            peer.send(buffer);
            offset += buffer.byteLength;
            
            // Tính phần trăm
            const percent = Math.round((offset / file.size) * 100);
            onProgress(percent);
            
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
          onProgress(100); // Đảm bảo UI hiện 100%
          resolve();
        } catch {
          // Nếu gửi end fail nghĩa là mạng đứt phút chót, coi như xong hoặc fail tùy logic
          resolve(); 
        }
      }
    };

    readChunk();
  });
};

// --- HÀM GỬI BATCH (NHIỀU FILE) ---
export const sendBatchFiles = async (
  peer: Peer.Instance,
  files: FileList | File[],
  // 🔥 CHANGE 3: Callback trả về cả ID để UI biết file nào đang chạy
  onProgress: (fileName: string, percent: number, fileId: string) => void,
  isCancelled: (fileId: string) => boolean
) => {
  const fileArray = Array.from(files);
  
  for (const file of fileArray) {
    // Tạo ID ở đây (hoặc lấy từ object nếu có quản lý queue store)
    const fileId = Math.random().toString(36).substring(7);
    
    try {
        await sendFile(
          peer,
          file,
          fileId,
          (percent) => {
            onProgress(file.name, percent, fileId);
          },
          isCancelled
        );
    } catch (err) {
        console.error(`Lỗi gửi file ${file.name}:`, err);
        // Tùy logic: Có thể continue để gửi file tiếp theo, hoặc break để dừng cả batch
        // Ở đây tôi chọn continue để lỡ 1 file lỗi không ảnh hưởng file khác
        continue; 
    }
  }
};