import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import { getDeviceId } from "@/utils/nameGenerator";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

// --- TYPES ---
export interface User { id: string; name: string; deviceId: string; }
export interface TransferState { type: 'upload' | 'download'; peerId: string; fileId: string; fileName: string; percent: number; }
export interface IncomingRequest { peerId: string; files: string[]; }

export const useWebRTC = (roomId: string, userName: string) => {
    // --- STATE QUẢN LÝ ---
    const [peers, setPeers] = useState<User[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());
    const [transferProgress, setTransferProgress] = useState<Map<string, TransferState>>(new Map()); 
    const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
    const [acceptedQueuePeerIds, setAcceptedQueuePeerIds] = useState<string[]>([]);
    const [actualRoomId, setActualRoomId] = useState(roomId);
    const [connectionTypes, setConnectionTypes] = useState<{ [key: string]: "p2p" | "relay" }>({});

    // --- REFS ---
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomingFiles = useRef<Map<string, { writer: any; metadata: any; received: number }>>(new Map());
    const chunkTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const cancelledFileIds = useRef<Set<string>>(new Set());
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
        const finalType = (status.local === 'relay' || status.remote === 'relay') ? 'relay' : 'p2p';
        setConnectionTypes(prev => ({ ...prev, [peerId]: finalType }));
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
                    try { peer.send(JSON.stringify({ type: 'conn-update', status: localType })); } catch {}
                    updateDisplayStatus(peerId);
                }
            }
        } catch (err) { console.error(err); }
    };

    // --- HANDLER: NHẬN DỮ LIỆU ---
    const handleDataStream = async (data: Buffer, fromPeerId: string) => {
        const dataStr = data.toString();

        if (dataStr.startsWith('{"type":')) {
            try {
                const msg = JSON.parse(dataStr);
                
                if (msg.type === "conn-update") {
                    if (!connStatusRef.current[fromPeerId]) connStatusRef.current[fromPeerId] = { local: null, remote: null };
                    connStatusRef.current[fromPeerId].remote = msg.status;
                    updateDisplayStatus(fromPeerId);
                    return;
                }
                
                if (msg.type === "metadata") {
                    const streamSaver = (await import("streamsaver")).default;
                    const fileStream = streamSaver.createWriteStream(msg.fileName, { size: msg.fileSize });
                    const writer = fileStream.getWriter();

                    incomingFiles.current.set(msg.fileId, { writer, metadata: msg, received: 0 });
                    
                    updateProgress(fromPeerId, { 
                        type: 'download', peerId: fromPeerId, fileId: msg.fileId, 
                        fileName: msg.fileName, percent: 0 
                    });

                    chunkTimeouts.current.set(msg.fileId, setTimeout(() => {
                        writer.abort("Timeout");
                        cleanupIncomingFile(msg.fileId);
                        updateProgress(fromPeerId, null);
                    }, 30000));
                } 
                else if (msg.type === "cancel") {
                    const f = incomingFiles.current.get(msg.fileId);
                    if (f) {
                        f.writer.abort("Sender cancelled").catch(() => {});
                        cleanupIncomingFile(msg.fileId);
                        updateProgress(fromPeerId, null);
                    }
                }
                else if (msg.type === "end") {
                    const f = incomingFiles.current.get(msg.fileId);
                    if (f) {
                        await f.writer.close();
                        cleanupIncomingFile(msg.fileId);
                        // Delay ẩn UI để người dùng thấy 100%
                        setTimeout(() => updateProgress(fromPeerId, null), 1000);
                    }
                }
            } catch (e) { console.error(e); }
            return;
        }

        const activeFileEntry = Array.from(incomingFiles.current.entries()).pop(); 
        if (!activeFileEntry) return;
        const [fileId, fileData] = activeFileEntry;

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
            updateProgress(fromPeerId, { type: 'download', peerId: fromPeerId, fileId, fileName: fileData.metadata.fileName, percent: pct });
        } catch (err) {
            cleanupIncomingFile(fileId);
            updateProgress(fromPeerId, null);
        }
    };

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

    const cancelTransfer = (fileId: string) => cancelledFileIds.current.add(fileId);
    const isCancelled = (fileId: string) => cancelledFileIds.current.has(fileId);

    const createPeer = (targetId: string, myId: string, initiator: boolean) => {
        const peer = new Peer({
            initiator,
            trickle: false, 
            config: {
                iceTransportPolicy: "all",
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:global.stun.twilio.com:3478" },
                    // 🔥 TURN Server
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
            setIncomingRequests(prev => {
                if (prev.find(r => r.peerId === from)) return prev;
                return [...prev, { peerId: from, files }];
            });
        });

        socket.on("queue-accept", ({ from }) => setAcceptedQueuePeerIds(prev => [...prev, from]));
        socket.on("queue-reject", ({ from }) => setAcceptedQueuePeerIds(prev => prev.filter(id => id !== from)));
        socket.on("queue-remove", ({from}) => setIncomingRequests(prev => prev.filter(r => r.peerId !== from)));

        return () => {
            socket.disconnect();
            Object.values(peersRef.current).forEach(p => p.destroy());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, userName]);

    const getPeer = (id: string) => peersRef.current[id];
    const resetAccepted = (id: string) => setAcceptedQueuePeerIds(prev => prev.filter(p => p !== id));
    
    // Check room kiểu "mềm" (luôn true để user vào được, nếu ko có ai thì ngồi đợi)
    const checkRoomExists = async (idToCheck: string): Promise<boolean> => {
        return true; 
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
        setUploadProgressLocal: updateProgress
    };
};