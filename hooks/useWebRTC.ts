import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import { getDeviceId } from "@/utils/nameGenerator";

export interface User { 
  id: string; 
  name: string; 
  deviceId: string;
}

export type TransferProgress = { 
  fileName: string; 
  percentage: number; 
  peerId: string; 
  fileId: string; 
};

interface IncomingFile {
  metadata: { fileId: string; fileName: string; fileSize: number; fileType: string; };
  writer: WritableStreamDefaultWriter;
  receivedSize: number;
}

export type IncomingQueueItem = {
    peerId: string;
    files: string[];
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

export const useWebRTC = (roomId: string, userName: string) => {
  const [peers, setPeers] = useState<User[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);
  const [incomingQueues, setIncomingQueues] = useState<IncomingQueueItem[]>([]);
  const [rejectedQueueId, setRejectedQueueId] = useState<string | null>(null);
  const [actualRoomId, setActualRoomId] = useState(roomId);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
  const incomingFiles = useRef<Map<string, IncomingFile>>(new Map());
  const isInitiated = useRef(false);
  const rejectedFileIds = useRef<Set<string>>(new Set());
  const myDeviceId = useRef(getDeviceId());
  
  const chunkTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const isFileRejected = (fileId: string) => {
      return rejectedFileIds.current.has(fileId);
  };

  const cleanUpFile = (fileId: string) => {
      if (chunkTimeouts.current.has(fileId)) {
          clearTimeout(chunkTimeouts.current.get(fileId)!);
          chunkTimeouts.current.delete(fileId);
      }
      incomingFiles.current.delete(fileId);
      setDownloadProgress(null);
  };

  const rejectIncomingFile = useCallback((fileId: string, peerId: string, reason = "Người dùng từ chối") => {
      const file = incomingFiles.current.get(fileId);
      if (file) {
          file.writer.abort(reason).catch(() => {});
          cleanUpFile(fileId);
          
          const peer = peersRef.current[peerId];
          if (peer) peer.send(JSON.stringify({ type: 'reject', fileId }));
      }
  }, []);

  const handleDataStream = async (data: Buffer, fromPeerId: string) => {
    const dataStr = data.toString();

    if (dataStr.startsWith('{"type":')) {
      try {
        const msg = JSON.parse(dataStr);
        
        if (msg.type === "metadata") {
          const streamSaver = (await import('streamsaver')).default; 
          const fileStream = streamSaver.createWriteStream(msg.fileName, { size: msg.fileSize });
          const writer = fileStream.getWriter();

          incomingFiles.current.set(msg.fileId, { metadata: msg, writer, receivedSize: 0 });
          setDownloadProgress({ fileName: msg.fileName, percentage: 0, peerId: fromPeerId, fileId: msg.fileId });
          
          const timeout = setTimeout(() => rejectIncomingFile(msg.fileId, fromPeerId, "Hết thời gian chờ"), 30000);
          chunkTimeouts.current.set(msg.fileId, timeout);

        } else if (msg.type === "end") {
          const file = incomingFiles.current.get(msg.fileId);
          if (file) {
            await file.writer.close();
            cleanUpFile(msg.fileId);
            setIncomingQueues(prev => prev.filter(q => q.peerId !== fromPeerId));
          }
        
        } else if (msg.type === "reject" || msg.type === "error") {
            rejectedFileIds.current.add(msg.fileId);
        }

      } catch (e) { console.error(e); }
      return;
    }

    const activeFileId = Array.from(incomingFiles.current.keys()).pop();
    if (activeFileId) {
       if (!incomingFiles.current.has(activeFileId)) return;

       if (chunkTimeouts.current.has(activeFileId)) {
           clearTimeout(chunkTimeouts.current.get(activeFileId)!);
       }
       chunkTimeouts.current.set(activeFileId, setTimeout(() => {
           rejectIncomingFile(activeFileId, fromPeerId, "Mất kết nối quá lâu");
       }, 30000));

      const file = incomingFiles.current.get(activeFileId);
      if (file) {
        try {
            const uint8array = new Uint8Array(data);
            await file.writer.write(uint8array); 
            
            file.receivedSize += uint8array.byteLength;
            const percent = Math.round((file.receivedSize / file.metadata.fileSize) * 100);
            setDownloadProgress({ 
                fileName: file.metadata.fileName, 
                percentage: percent, 
                peerId: fromPeerId, 
                fileId: activeFileId 
            });
        } catch (err) {
            file.writer.abort("Lỗi ghi file").catch(() => {});
            cleanUpFile(activeFileId);

            const peer = peersRef.current[fromPeerId];
            if (peer) {
                peer.send(JSON.stringify({ type: 'error', fileId: activeFileId, reason: 'Lỗi ghi file' }));
            }
        }
      }
    }
  };

  const notifyQueueAdd = (targetId: string, files: FileList) => {
      const fileNames = Array.from(files).map(f => f.name);
      socketRef.current?.emit('queue-add', { to: targetId, files: fileNames });
  };

  const notifyQueueRemove = (targetId: string) => {
      socketRef.current?.emit('queue-remove', { to: targetId });
  };

  const rejectIncomingQueue = (senderId: string) => {
      setIncomingQueues(prev => prev.filter(q => q.peerId !== senderId));
      socketRef.current?.emit('queue-reject', { to: senderId });
  };

  const resetRejectedQueue = () => setRejectedQueueId(null);

  const checkRoomExists = (idToCheck: string): Promise<boolean> => {
      return new Promise((resolve) => {
          if (!socketRef.current) {
               const tempSocket = io(SOCKET_URL);
               tempSocket.emit('check-room-availability', idToCheck, (exists: boolean) => {
                   tempSocket.disconnect();
                   resolve(exists);
               });
               return;
          }
          socketRef.current.emit('check-room-availability', idToCheck, (exists: boolean) => {
              resolve(exists);
          });
      });
  };

  const getPeerInstance = (id: string) => {
      return peersRef.current[id];
  };

  const createPeer = (targetId: string, myId: string, initiator: boolean) => {
    const peer = new Peer({ 
        initiator, 
        trickle: false,
        config: { 
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }, 
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });
    peer.on("signal", s => socketRef.current?.emit("signal", { to: targetId, from: myId, signal: s }));
    peer.on("data", d => handleDataStream(d, targetId));
    peer.on("close", () => {
       incomingFiles.current.forEach(f => { try{f.writer.abort("Ngắt kết nối")}catch(e){} });
       incomingFiles.current.clear();
       chunkTimeouts.current.forEach(t => clearTimeout(t));
       chunkTimeouts.current.clear();
       setDownloadProgress(null);
    });
    return peer;
  };

  useEffect(() => {
     if (!userName || isInitiated.current) return;
     isInitiated.current = true;
     
     const socket = io(SOCKET_URL, { reconnection: true, forceNew: true });
     socketRef.current = socket;

     socket.on("connect", () => socket.emit("join-room", { roomId, name: userName, deviceId: myDeviceId.current }));
     socket.on("room-assigned", (id) => setActualRoomId(id));
     
     socket.on("existing-users", (users: User[]) => {
         const uniquePeers = users.filter(u => u.deviceId !== myDeviceId.current);
         uniquePeers.forEach(u => { if(!peersRef.current[u.id]) peersRef.current[u.id] = createPeer(u.id, socket.id!, true); });
         setPeers(uniquePeers);
     });
     
     socket.on("user-joined", (u: User) => {
         if (u.deviceId === myDeviceId.current) return;
         setPeers(p => p.find(x => x.id === u.id) ? p : [...p, u]);
     });
     
     socket.on("user-left", id => {
         peersRef.current[id]?.destroy(); delete peersRef.current[id];
         setPeers(p => p.filter(x => x.id !== id));
         setIncomingQueues(prev => prev.filter(q => q.peerId !== id));
     });
     
     socket.on("signal", ({ from, signal }) => {
         const p = peersRef.current[from];
         if(p) p.signal(signal);
         else { const newP = createPeer(from, socket.id!, false); peersRef.current[from] = newP; newP.signal(signal); }
     });

     socket.on('queue-add', ({ from, files }) => {
         setIncomingQueues(prev => {
             const exists = prev.find(q => q.peerId === from);
             if (exists) return prev;
             return [...prev, { peerId: from, files }];
         });
     });
     socket.on('queue-remove', ({ from }) => setIncomingQueues(prev => prev.filter(q => q.peerId !== from)));
     socket.on('queue-reject', ({ from }) => setRejectedQueueId(from));

     return () => {
       socket.disconnect(); socketRef.current = null;
       Object.values(peersRef.current).forEach(p => p.destroy()); peersRef.current = {}; isInitiated.current = false;
     };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  return { 
      peers, getPeerInstance, downloadProgress, rejectIncomingFile, isFileRejected,
      incomingQueues, notifyQueueAdd, notifyQueueRemove, rejectIncomingQueue, rejectedQueueId, resetRejectedQueue,
      actualRoomId, checkRoomExists 
  };
};