import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import { getDeviceId } from "@/utils/nameGenerator";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

// --- TYPES ---
export interface User { 
    id: string; 
    name: string; 
    deviceId: string; 
}

export interface TransferState { 
    type: 'upload' | 'download'; 
    peerId: string; 
    fileId: string; 
    fileName: string; 
    percent: number; 
}

export interface IncomingRequest { 
    peerId: string; 
    files: string[]; 
}

export const useWebRTC = (roomId: string, userName: string) => {
    // --- STATE QUẢN LÝ ---
    const [peers, setPeers] = useState<User[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());
    
    // Trạng thái truyền file (Upload/Download) để hiện UI
    const [transferProgress, setTransferProgress] = useState<Map<string, TransferState>>(new Map()); 
    
    // Queue: Yêu cầu nhận file từ người khác
    const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
    
    // Queue: Danh sách người đã đồng ý nhận file (để trigger gửi)
    const [acceptedQueuePeerIds, setAcceptedQueuePeerIds] = useState<string[]>([]);

    const [actualRoomId, setActualRoomId] = useState(roomId);
    
    // Loại kết nối: P2P hay Relay
    const [connectionTypes, setConnectionTypes] = useState<{ [key: string]: "p2p" | "relay" }>({});

    // --- REFS (Lưu trữ nội bộ không render) ---
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
    
    // Lưu các file đang nhận (Stream Writer)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomingFiles = useRef<Map<string, { writer: any; metadata: any; received: number }>>(new Map());
    const chunkTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
    
    // Lưu danh sách fileId bị hủy (để Sender check)
    const cancelledFileIds = useRef<Set<string>>(new Set());
    
    // Lưu trạng thái kết nối thô để tính toán P2P/Relay
    const connStatusRef = useRef<{ [key: string]: { local: string | null; remote: string | null } }>({});

    // --- HELPER: CẬP NHẬT PROGRESS UI ---
    const updateProgress = useCallback((peerId: string, state: TransferState | null) => {
        setTransferProgress(prev => {
            const newMap = new Map(prev);
            if (state) newMap.set(peerId, state);
            else newMap.delete(peerId);
            return newMap;
        });
    }, []);

    // --- HELPER: CLEANUP FILE ---
    const cleanupIncomingFile = useCallback((fileId: string) => {
        if (chunkTimeouts.current.has(fileId)) {
            clearTimeout(chunkTimeouts.current.get(fileId)!);
            chunkTimeouts.current.delete(fileId);
        }
        incomingFiles.current.delete(fileId);
    }, []);

    // --- LOGIC: CHECK P2P / RELAY ---
    const updateDisplayStatus = (peerId: string) => {
        const status = connStatusRef.current[peerId];
        if (!status) return;
        // Chỉ cần 1 bên là Relay -> hiện Relay. Cả 2 P2P -> hiện P2P.
        const finalType = (status.local === 'relay' || status.remote === 'relay') ? 'relay' : 'p2p';
        
        setConnectionTypes(prev => {
            if (prev[peerId] === finalType) return prev;
            return { ...prev, [peerId]: finalType };
        });
    };

    const checkConnectionType = async (peer: Peer.Instance, peerId: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nativePeer = peer as any;
        if (!nativePeer || !nativePeer._pc) return;

        try {
            const stats = await nativePeer._pc.getStats();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let activeCandidatePair: any = null;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stats.forEach((report: any) => {
                if (report.type === 'transport' && report.selectedCandidatePairId) {
                    activeCandidatePair = stats.get(report.selectedCandidatePairId);
                }
            });

            if (!activeCandidatePair) {
                // Fallback
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stats.forEach((report: any) => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.selected) {
                        activeCandidatePair = report;
                    }
                });
            }

            if (activeCandidatePair) {
                const remoteCandidate = stats.get(activeCandidatePair.remoteCandidateId);
                if (remoteCandidate) {
                    const localType = remoteCandidate.candidateType === 'relay' ? 'relay' : 'p2p';
                    
                    if (!connStatusRef.current[peerId]) connStatusRef.current[peerId] = { local: null, remote: null };
                    connStatusRef.current[peerId].local = localType;

                    // Gửi info cho bạn
                    try {
                        peer.send(JSON.stringify({ type: 'conn-update', status: localType }));
                    } catch {}
                    
                    updateDisplayStatus(peerId);
                }
            }
        } catch (err) {
            console.error("Stats check error", err);
        }
    };

    // --- HANDLER: NHẬN DỮ LIỆU (DATA STREAM) ---
    const handleDataStream = async (data: Buffer, fromPeerId: string) => {
        const dataStr = data.toString();

        // 1. Xử lý Metadata / Control Signals (JSON)
        if (dataStr.startsWith('{"type":')) {
            try {
                const msg = JSON.parse(dataStr);
                
                // Cập nhật trạng thái mạng từ bạn
                if (msg.type === "conn-update") {
                    if (!connStatusRef.current[fromPeerId]) connStatusRef.current[fromPeerId] = { local: null, remote: null };
                    connStatusRef.current[fromPeerId].remote = msg.status;
                    updateDisplayStatus(fromPeerId);
                    return;
                }
                
                // Nhận metadata -> Tạo file stream để ghi
                if (msg.type === "metadata") {
                    const streamSaver = (await import("streamsaver")).default;
                    const fileStream = streamSaver.createWriteStream(msg.fileName, { size: msg.fileSize });
                    const writer = fileStream.getWriter();

                    incomingFiles.current.set(msg.fileId, { writer, metadata: msg, received: 0 });
                    
                    updateProgress(fromPeerId, { 
                        type: 'download', peerId: fromPeerId, fileId: msg.fileId, 
                        fileName: msg.fileName, percent: 0 
                    });

                    // Set timeout an toàn
                    chunkTimeouts.current.set(msg.fileId, setTimeout(() => {
                        writer.abort("Timeout");
                        cleanupIncomingFile(msg.fileId);
                        updateProgress(fromPeerId, null);
                    }, 30000));
                } 
                
                // Nhận lệnh Cancel từ người gửi
                else if (msg.type === "cancel") {
                    const f = incomingFiles.current.get(msg.fileId);
                    if (f) {
                        f.writer.abort("Sender cancelled").catch(() => {});
                        cleanupIncomingFile(msg.fileId);
                        updateProgress(fromPeerId, null);
                    }
                }
                
                // Nhận lệnh End -> Xong file
                else if (msg.type === "end") {
                    const f = incomingFiles.current.get(msg.fileId);
                    if (f) {
                        await f.writer.close();
                        cleanupIncomingFile(msg.fileId);
                        // Giữ UI 100% 1 lúc cho đẹp
                        setTimeout(() => updateProgress(fromPeerId, null), 1000);
                    }
                }

            } catch (e) { console.error(e); }
            return;
        }

        // 2. Xử lý Binary Data (Chunk File)
        const activeFileEntry = Array.from(incomingFiles.current.entries()).pop(); 
        if (!activeFileEntry) return;
        const [fileId, fileData] = activeFileEntry;

        // Reset timeout vì mạng còn sống
        if (chunkTimeouts.current.has(fileId)) {
            clearTimeout(chunkTimeouts.current.get(fileId)!);
            chunkTimeouts.current.set(fileId, setTimeout(() => {
                fileData.writer.abort("Timeout");
                cleanupIncomingFile(fileId);
                updateProgress(fromPeerId, null);
            }, 30000));
        }

        try {
            const uint8 = new Uint8Array(data);
            await fileData.writer.write(uint8);
            fileData.received += uint8.byteLength;
            
            const pct = Math.round((fileData.received / fileData.metadata.fileSize) * 100);
            
            updateProgress(fromPeerId, {
                type: 'download', peerId: fromPeerId, fileId,
                fileName: fileData.metadata.fileName, percent: pct
            });

        } catch (err) {
            console.error("Write error", err);
            cleanupIncomingFile(fileId);
            updateProgress(fromPeerId, null);
        }
    };

    // --- SOCKET ACTIONS ---
    const requestSendFile = (targetId: string, fileNames: string[]) => {
        socketRef.current?.emit("queue-add", { to: targetId, files: fileNames });
    };

    const acceptRequest = (senderId: string) => {
        setIncomingRequests(prev => prev.filter(r => r.peerId !== senderId));
        socketRef.current?.emit("queue-accept", { to: senderId });
    };

    const rejectRequest = (senderId: string) => {
        setIncomingRequests(prev => prev.filter(r => r.peerId !== senderId));
        socketRef.current?.emit("queue-reject", { to: senderId });
    };

    const cancelTransfer = (fileId: string) => {
        // Đánh dấu file này đã bị hủy (để Sender check trong loop)
        cancelledFileIds.current.add(fileId);
    };

    const isCancelled = (fileId: string) => cancelledFileIds.current.has(fileId);

    // --- CREATE PEER ---
    const createPeer = (targetId: string, myId: string, initiator: boolean) => {
        const peer = new Peer({
            initiator,
            trickle: false, 
            config: {
                iceTransportPolicy: "all",
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:global.stun.twilio.com:3478" },
                    // 🔥 TURN Server của bro
                    { urls: "turn:192.9.175.71:3478", username: "admin", credential: "admin123" },
                ],
            },
        });

        peer.on("connect", () => {
            setConnectedPeers(prev => new Set(prev).add(targetId));
            checkConnectionType(peer, targetId);
            setTimeout(() => checkConnectionType(peer, targetId), 2000);
        });

        peer.on("signal", (s) => socketRef.current?.emit("signal", { to: targetId, from: myId, signal: s }));
        peer.on("data", (d) => handleDataStream(d, targetId));
        
        const handleClose = () => {
            setConnectedPeers(prev => { const s = new Set(prev); s.delete(targetId); return s; });
            updateProgress(targetId, null);
            incomingFiles.current.forEach(f => { try{f.writer.abort("Connection closed")}catch{} });
            incomingFiles.current.clear();
        };

        peer.on("close", handleClose);
        peer.on("error", handleClose);

        return peer;
    };

    // --- MAIN EFFECT ---
    useEffect(() => {
        if (!userName) return;
        const socket = io(SOCKET_URL!, { reconnection: true, forceNew: true });
        socketRef.current = socket;

        socket.on("connect", () => {
             socket.emit("join-room", { roomId, name: userName, deviceId: getDeviceId() });
        });

        socket.on("room-assigned", (id) => setActualRoomId(id));
        
        socket.on("existing-users", (users: User[]) => {
            const unique = users.filter(u => u.deviceId !== getDeviceId());
            unique.forEach(u => {
                if(!peersRef.current[u.id]) peersRef.current[u.id] = createPeer(u.id, socket.id!, true);
            });
            setPeers(unique);
        });

        socket.on("user-joined", (u: User) => {
            if (u.deviceId === getDeviceId()) return;
            setPeers(p => p.find(x => x.id === u.id) ? p : [...p, u]);
        });

        socket.on("user-left", (id) => {
            peersRef.current[id]?.destroy();
            delete peersRef.current[id];
            setPeers(p => p.filter(u => u.id !== id));
            setConnectedPeers(prev => { const s = new Set(prev); s.delete(id); return s; });
            setIncomingRequests(prev => prev.filter(r => r.peerId !== id));
            // updateProgress(id, null); // Có thể comment dòng này nếu muốn giữ lịch sử
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

        // --- QUEUE EVENTS ---
        socket.on("queue-add", ({ from, files }) => {
            setIncomingRequests(prev => {
                if (prev.find(r => r.peerId === from)) return prev;
                return [...prev, { peerId: from, files }];
            });
        });

        socket.on("queue-accept", ({ from }) => {
            setAcceptedQueuePeerIds(prev => [...prev, from]);
        });

        socket.on("queue-reject", ({ from }) => {
            alert("Người dùng đã từ chối nhận file.");
            // Xóa khỏi danh sách chờ (nếu có)
            setAcceptedQueuePeerIds(prev => prev.filter(id => id !== from));
        });

        socket.on("queue-remove", ({from}) => {
             setIncomingRequests(prev => prev.filter(r => r.peerId !== from));
        });

        return () => {
            socket.disconnect();
            Object.values(peersRef.current).forEach(p => p.destroy());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, userName]);

    const getPeer = (id: string) => peersRef.current[id];

    // Helper: Reset danh sách đã accept sau khi gửi xong
    const resetAccepted = (id: string) => setAcceptedQueuePeerIds(prev => prev.filter(p => p !== id));
    
    // Helper: Update progress thủ công (cho Sender dùng)
    const setUploadProgressLocal = (peerId: string, state: TransferState | null) => {
        updateProgress(peerId, state);
    };

    const checkRoomExists = (idToCheck: string): Promise<boolean> => {
        return new Promise((resolve) => {
             // Logic check room đơn giản qua socket tạm
             const tempSocket = io(SOCKET_URL!);
             tempSocket.emit("check-room-availability", idToCheck, (exists: boolean) => {
                tempSocket.disconnect();
                resolve(exists);
             });
        });
    };

    return {
        peers,
        connectedPeers,
        actualRoomId,
        incomingRequests,
        acceptedQueuePeerIds,
        transferProgress,
        connectionTypes,
        getPeer,
        requestSendFile,
        acceptRequest,
        rejectRequest,
        cancelTransfer,
        isCancelled,
        resetAccepted,
        checkRoomExists,
        setUploadProgressLocal 
    };
};