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
  metadata: {
    fileId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  writer: WritableStreamDefaultWriter;
  receivedSize: number;
}

export type IncomingQueueItem = {
  peerId: string;
  files: string[];
};

type PeerConnectionStatus = {
  local: "p2p" | "relay" | null;
  remote: "p2p" | "relay" | null;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

export const useWebRTC = (roomId: string, userName: string) => {
  const [peers, setPeers] = useState<User[]>([]);
  const [downloadProgress, setDownloadProgress] =
    useState<TransferProgress | null>(null);
  const [incomingQueues, setIncomingQueues] = useState<IncomingQueueItem[]>([]);
  const [rejectedQueueId, setRejectedQueueId] = useState<string | null>(null);
  const [actualRoomId, setActualRoomId] = useState(roomId);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
  const incomingFiles = useRef<Map<string, IncomingFile>>(new Map());
  const isInitiated = useRef(false);
  const rejectedFileIds = useRef<Set<string>>(new Set());
  const myDeviceId = useRef(getDeviceId());
  const [connectionTypes, setConnectionTypes] = useState<{
    [key: string]: "p2p" | "relay";
  }>({});
  const connStatusRef = useRef<{ [key: string]: PeerConnectionStatus }>({});
  const chunkTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const updateDisplayStatus = (peerId: string) => {
    const status = connStatusRef.current[peerId];
    if (!status) return;

    const finalType =
      status.local === "relay" || status.remote === "relay" ? "relay" : "p2p";

    setConnectionTypes((prev) => {
      if (prev[peerId] === finalType) return prev;
      return { ...prev, [peerId]: finalType };
    });
  };
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

  const rejectIncomingFile = useCallback(
    (fileId: string, peerId: string, reason = "Người dùng từ chối") => {
      const file = incomingFiles.current.get(fileId);
      if (file) {
        file.writer.abort(reason).catch(() => { });
        cleanUpFile(fileId);

        const peer = peersRef.current[peerId];
        if (peer) peer.send(JSON.stringify({ type: "reject", fileId }));
      }
    },
    []
  );

  const handleDataStream = async (data: Buffer, fromPeerId: string) => {
    const dataStr = data.toString();

    if (dataStr.startsWith('{"type":')) {
      try {
        const msg = JSON.parse(dataStr);
        if (msg.type === "cancel") {
            // Gọi hàm hủy bên phía người nhận ngay lập tức
            rejectIncomingFile(msg.fileId, fromPeerId, "Người gửi đã hủy");
            return; 
        }
        if (msg.type === "conn-update") {
          if (!connStatusRef.current[fromPeerId])
            connStatusRef.current[fromPeerId] = { local: null, remote: null };

          connStatusRef.current[fromPeerId].remote = msg.status;

          updateDisplayStatus(fromPeerId);
          return; // Dừng xử lý, không coi là file
        }
        if (msg.type === "metadata") {
          const streamSaver = (await import("streamsaver")).default;
          const fileStream = streamSaver.createWriteStream(msg.fileName, {
            size: msg.fileSize,
          });
          const writer = fileStream.getWriter();

          incomingFiles.current.set(msg.fileId, {
            metadata: msg,
            writer,
            receivedSize: 0,
          });
          setDownloadProgress({
            fileName: msg.fileName,
            percentage: 0,
            peerId: fromPeerId,
            fileId: msg.fileId,
          });

          const timeout = setTimeout(
            () =>
              rejectIncomingFile(msg.fileId, fromPeerId, "Hết thời gian chờ"),
            30000
          );
          chunkTimeouts.current.set(msg.fileId, timeout);
        } else if (msg.type === "end") {
          const file = incomingFiles.current.get(msg.fileId);
          if (file) {
            await file.writer.close();
            cleanUpFile(msg.fileId);
            setIncomingQueues((prev) =>
              prev.filter((q) => q.peerId !== fromPeerId)
            );
          }
        } else if (msg.type === "reject" || msg.type === "error") {
          rejectedFileIds.current.add(msg.fileId);
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const activeFileId = Array.from(incomingFiles.current.keys()).pop();
    if (activeFileId) {
      if (!incomingFiles.current.has(activeFileId)) return;

      if (chunkTimeouts.current.has(activeFileId)) {
        clearTimeout(chunkTimeouts.current.get(activeFileId)!);
      }
      chunkTimeouts.current.set(
        activeFileId,
        setTimeout(() => {
          rejectIncomingFile(activeFileId, fromPeerId, "Mất kết nối quá lâu");
        }, 30000)
      );

      const file = incomingFiles.current.get(activeFileId);
      if (file) {
        try {
          const uint8array = new Uint8Array(data);
          await file.writer.write(uint8array);

          file.receivedSize += uint8array.byteLength;
          const percent = Math.round(
            (file.receivedSize / file.metadata.fileSize) * 100
          );
          setDownloadProgress({
            fileName: file.metadata.fileName,
            percentage: percent,
            peerId: fromPeerId,
            fileId: activeFileId,
          });
        } catch {
          file.writer.abort("Lỗi ghi file").catch(() => { });
          cleanUpFile(activeFileId);

          const peer = peersRef.current[fromPeerId];
          if (peer) {
            peer.send(
              JSON.stringify({
                type: "error",
                fileId: activeFileId,
                reason: "Lỗi ghi file",
              })
            );
          }
        }
      }
    }
  };

  const notifyQueueAdd = (targetId: string, files: FileList) => {
    const fileNames = Array.from(files).map((f) => f.name);
    socketRef.current?.emit("queue-add", { to: targetId, files: fileNames });
  };

  const notifyQueueRemove = (targetId: string) => {
    socketRef.current?.emit("queue-remove", { to: targetId });
  };

  const rejectIncomingQueue = (senderId: string) => {
    setIncomingQueues((prev) => prev.filter((q) => q.peerId !== senderId));
    socketRef.current?.emit("queue-reject", { to: senderId });
  };

  const resetRejectedQueue = () => setRejectedQueueId(null);

  const checkRoomExists = (idToCheck: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        const tempSocket = io(SOCKET_URL);
        tempSocket.emit(
          "check-room-availability",
          idToCheck,
          (exists: boolean) => {
            tempSocket.disconnect();
            resolve(exists);
          }
        );
        return;
      }
      socketRef.current.emit(
        "check-room-availability",
        idToCheck,
        (exists: boolean) => {
          resolve(exists);
        }
      );
    });
  };

  const getPeerInstance = (id: string) => {
    return peersRef.current[id];
  };

  // Thêm đoạn này vào trong hook useWebRTC
  const checkConnectionType = async (peer: Peer.Instance, peerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativePeer = peer as any;
    if (!nativePeer || !nativePeer._pc) return;

    try {
      const stats = await nativePeer._pc.getStats();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activeCandidatePair: any = null;

      // Tìm candidate đang active
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.forEach((report: any) => {
        if (report.type === "transport" && report.selectedCandidatePairId) {
          activeCandidatePair = stats.get(report.selectedCandidatePairId);
        }
      });

      // Fallback
      if (!activeCandidatePair) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stats.forEach((report: any) => {
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded" &&
            report.selected
          ) {
            activeCandidatePair = report;
          }
        });
      }

      if (activeCandidatePair) {
        const remoteCandidate = stats.get(
          activeCandidatePair.remoteCandidateId
        );
        if (remoteCandidate) {
          const localType =
            remoteCandidate.candidateType === "relay" ? "relay" : "p2p";

          // 1. Lưu Local Status
          if (!connStatusRef.current[peerId])
            connStatusRef.current[peerId] = { local: null, remote: null };
          connStatusRef.current[peerId].local = localType;

          // 2. Gửi thông tin này cho bạn mình biết
          // Gửi qua kênh Data Channel (vì lúc này đã kết nối rồi)
          try {
            peer.send(
              JSON.stringify({
                type: "conn-update",
                status: localType,
              })
            );
          } catch { }

          updateDisplayStatus(peerId);
        }
      }
    } catch (err) {
      console.error("Check stats error:", err);
    }
  };
  const createPeer = (targetId: string, myId: string, initiator: boolean) => {
    // Trong hàm createPeer
    const peer = new Peer({
      initiator,
      trickle: false, // Giữ false cho mạng LAN ổn định
      config: {
        iceTransportPolicy: "all",
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          {
            urls: "turn:192.9.175.71:3478",
            username: "admin",
            credential: "admin123",
          },
        ],
      },
    });
    peer.on("connect", () => {
      // Check ngay khi kết nối
      checkConnectionType(peer, targetId);
      setTimeout(() => checkConnectionType(peer, targetId), 2000);
      setTimeout(() => checkConnectionType(peer, targetId), 5000);

      // Check lại sau 2s cho chắc (vì đôi khi nó đổi đường)
      setTimeout(() => checkConnectionType(peer, targetId), 2000);
    });
    peer.on("signal", (s) =>
      socketRef.current?.emit("signal", { to: targetId, from: myId, signal: s })
    );
    peer.on("data", (d) => handleDataStream(d, targetId));
    peer.on("close", () => {
      incomingFiles.current.forEach((f) => {
        try {
          f.writer.abort("Ngắt kết nối");
        } catch (e) { }
      });
      incomingFiles.current.clear();
      chunkTimeouts.current.forEach((t) => clearTimeout(t));
      chunkTimeouts.current.clear();
      setDownloadProgress(null);
    });


    peer.on("error", () => {
   

      alert("Kết nối bị ngắt đột ngột!");
  
      incomingFiles.current.forEach((f, fileId) => cleanUpFile(fileId));
    });
    return peer;
  };

  useEffect(() => {
    if (!userName || isInitiated.current) return;
    isInitiated.current = true;

    const socket = io(SOCKET_URL, { reconnection: true, forceNew: true });
    socketRef.current = socket;

    socket.on("connect", () =>
      socket.emit("join-room", {
        roomId,
        name: userName,
        deviceId: myDeviceId.current,
      })
    );
    socket.on("room-assigned", (id) => setActualRoomId(id));

    socket.on("existing-users", (users: User[]) => {
      const uniquePeers = users.filter(
        (u) => u.deviceId !== myDeviceId.current
      );
      uniquePeers.forEach((u) => {
        if (!peersRef.current[u.id])
          peersRef.current[u.id] = createPeer(u.id, socket.id!, true);
      });
      setPeers(uniquePeers);
    });

    socket.on("user-joined", (u: User) => {
      if (u.deviceId === myDeviceId.current) return;
      setPeers((p) => (p.find((x) => x.id === u.id) ? p : [...p, u]));
    });

    socket.on("user-left", (id) => {
      peersRef.current[id]?.destroy();
      delete peersRef.current[id];
      setPeers((p) => p.filter((x) => x.id !== id));
      setIncomingQueues((prev) => prev.filter((q) => q.peerId !== id));
    });

    socket.on("signal", ({ from, signal }) => {
      const p = peersRef.current[from];
      if (p) p.signal(signal);
      else {
        const newP = createPeer(from, socket.id!, false);
        peersRef.current[from] = newP;
        newP.signal(signal);
      }
    });

    socket.on("queue-add", ({ from, files }) => {
      setIncomingQueues((prev) => {
        const exists = prev.find((q) => q.peerId === from);
        if (exists) return prev;
        return [...prev, { peerId: from, files }];
      });
    });
    socket.on("queue-remove", ({ from }) =>
      setIncomingQueues((prev) => prev.filter((q) => q.peerId !== from))
    );
    socket.on("queue-reject", ({ from }) => setRejectedQueueId(from));
    

    return () => {
      socket.disconnect();
      socketRef.current = null;
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
      isInitiated.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

const cancelOutgoingFile = useCallback((fileId: string, targetPeerId?: string) => { 
    rejectedFileIds.current.add(fileId);
    

    if (targetPeerId && socketRef.current) {
        socketRef.current.emit("transfer-cancel", { to: targetPeerId, fileId });
    }
}, []);

  return {
    peers,
    cancelOutgoingFile,
    getPeerInstance,
    downloadProgress,
    rejectIncomingFile,
    isFileRejected,
    incomingQueues,
    notifyQueueAdd,
    notifyQueueRemove,
    rejectIncomingQueue,
    rejectedQueueId,
    resetRejectedQueue,
    actualRoomId,
    checkRoomExists,
    connectionTypes,
  };
};
