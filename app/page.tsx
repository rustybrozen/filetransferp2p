"use client";

import { useState, useEffect } from "react";
import { useWebRTC, TransferState } from "@/hooks/useWebRTC";
import { sendFile } from "@/utils/fileTransfer";
import { QRCodeSVG } from 'qrcode.react';
import { generateIdentity } from "@/utils/nameGenerator";

// --- ICONS ---
const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconX = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconFile = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const IconSmartphone = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const IconLightning = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconCloud = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;

export default function Home() {
    const [isMounted, setIsMounted] = useState(false);
    const [username, setUsername] = useState("");
    const [roomId, setRoomId] = useState("AUTO_DETECT"); 

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    
    // UI State
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [manualCode, setManualCode] = useState("");

    const {
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
    } = useWebRTC(roomId, username);

    // --- INIT ---
    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem("p2p_username");
        setUsername(stored || generateIdentity());
    }, []);

    // --- LOGIC GỬI FILE ---
    // Tự động chạy khi có người Accept
    useEffect(() => {
        const processQueue = async () => {
            if (acceptedQueuePeerIds.length > 0 && selectedFiles.length > 0) {
                const peerId = acceptedQueuePeerIds[0];
                const peer = getPeer(peerId);
                
                if (peer) {
                    try {
                        for (const file of selectedFiles) {
                            const fileId = Math.random().toString(36).substring(7);
                            
                            // Check hủy trước khi gửi
                            if (isCancelled(fileId)) continue;

                            await sendFile(
                                peer, 
                                file, 
                                fileId, 
                                (pct) => { 
                                    // Update UI phía Sender
                                    const state: TransferState = {
                                        type: 'upload',
                                        peerId,
                                        fileId,
                                        fileName: file.name,
                                        percent: pct
                                    };
                                    setUploadProgressLocal(peerId, state);
                                },
                                // Check cancel
                                () => isCancelled(fileId)
                            );
                        }
                    } catch (err) {
                        console.error("Gửi thất bại:", err);
                    } finally {
                        resetAccepted(peerId);
                        setUploadProgressLocal(peerId, null); // Xóa progress khi xong
                    }
                } else {
                    // Peer mất kết nối thì cũng reset để không kẹt
                    resetAccepted(peerId);
                }
            }
        };
        processQueue();
    }, [acceptedQueuePeerIds, selectedFiles, getPeer, isCancelled, resetAccepted, setUploadProgressLocal]);


    // --- HANDLERS ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Nút bấm vào Avatar để gửi yêu cầu
    const handleSendRequest = (targetId: string) => {
        if (selectedFiles.length === 0) return ;
        if (!connectedPeers.has(targetId)) return ;
        
        requestSendFile(targetId, selectedFiles.map(f => f.name));
       
    };

    const handleCreateRoom = () => {
        const newCode = generateIdentity().substring(0, 6).toUpperCase(); 
        setRoomId(newCode);
        setShowCreateModal(true);
    };

    const handleJoinRoom = async () => {
        if (!manualCode) return;
        const exists = await checkRoomExists(manualCode);
        if (exists) {
            setRoomId(manualCode);
            setShowJoinModal(false);
        } else {
           
        }
    };

    const handleCancel = (peerId: string, fileId: string) => {
        cancelTransfer(fileId);
        setUploadProgressLocal(peerId, null); // Clear UI ngay lập tức
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col relative overflow-hidden transition-colors selection:bg-blue-200">
            
            {/* --- HEADER --- */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20">
                <div className="flex gap-2">
                    <button onClick={handleCreateRoom} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full font-bold text-xs shadow hover:scale-105 transition">
                        Tạo Kết Nối
                    </button>
                    <button onClick={() => setShowJoinModal(true)} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-full font-bold text-xs shadow hover:bg-gray-50 transition">
                        Nhập Code
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200 dark:border-zinc-800">
                    <div className={`w-2 h-2 rounded-full ${roomId === 'AUTO_DETECT' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
                    <span className="text-xs font-bold text-gray-500">{roomId === 'AUTO_DETECT' ? 'LAN Mode' : roomId}</span>
                </div>
            </div>

            {/* --- MAIN AREA (SATELLITES) --- */}
            <div className="flex-1 flex items-center justify-center relative">
                {/* Center Node (YOU) */}
                <div className="relative z-10 w-24 h-24 bg-white dark:bg-zinc-800 rounded-full shadow-2xl flex items-center justify-center border-4 border-gray-100 dark:border-zinc-700">
                   <div className="text-center">
                       <div className="font-black text-xs text-gray-400">YOU</div>
                       <div className="text-[10px] text-gray-500 truncate max-w-[60px]">{username}</div>
                   </div>
                </div>

                {/* Orbiting Peers */}
                {peers.map((peer, i) => {
                    const isConnected = connectedPeers.has(peer.id);
                    const progress = transferProgress.get(peer.id);
                    const radius = 160; 
                    const angle = (i / peers.length) * 2 * Math.PI - Math.PI/2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <div key={peer.id} 
                            className="absolute flex flex-col items-center justify-center transition-all duration-500"
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                        >
                            <div className="relative group cursor-pointer" onClick={() => handleSendRequest(peer.id)}>
                                {/* Vòng tròn Avatar */}
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4 transition-all bg-white dark:bg-zinc-800 
                                    ${progress ? 'border-transparent' : isConnected ? 'border-green-500' : 'border-yellow-400'}`}>
                                    
                                    {/* Progress SVG Overlay */}
                                    {progress && (
                                        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                                            <circle cx="50%" cy="50%" r="36" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200 dark:text-zinc-700" />
                                            <circle cx="50%" cy="50%" r="36" stroke="currentColor" strokeWidth="4" fill="none" 
                                                className={`${progress.type === 'upload' ? 'text-blue-500' : 'text-green-500'} transition-all duration-300`}
                                                strokeDasharray="226" strokeDashoffset={226 - (226 * progress.percent) / 100} strokeLinecap="round" />
                                        </svg>
                                    )}

                                    <div className="flex flex-col items-center">
                                        <IconSmartphone />
                                        <div className="font-bold text-[10px] truncate max-w-[50px] mt-1">{peer.name}</div>
                                        
                                        {/* Status Text / Cancel Button */}
                                        <div className="text-[9px] font-bold text-gray-400 mt-1 flex items-center gap-1 z-20">
                                            {progress ? (
                                                <span onClick={(e) => { e.stopPropagation(); handleCancel(peer.id, progress.fileId); }} className="hover:text-red-500 hover:scale-125 transition">
                                                    {progress.percent}% <IconX />
                                                </span>
                                            ) : isConnected ? 'Sẵn sàng' : 'Đang chờ...'}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Badge P2P/Relay */}
                                {isConnected && connectionTypes[peer.id] && (
                                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-sm whitespace-nowrap z-10
                                        ${connectionTypes[peer.id] === 'p2p' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                        {connectionTypes[peer.id] === 'p2p' ? <span className="flex items-center gap-1"><IconLightning /> P2P</span> : <span className="flex items-center gap-1"><IconCloud /> RELAY</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- FILE TRAY (BOTTOM) --- */}
            <div className="bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 pb-8 z-30 transition-all shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">File đã chọn ({selectedFiles.length})</h3>
                    <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        <IconFile />
                        <span>Thêm File</span>
                        <input type="file" multiple onChange={handleFileSelect} className="hidden" />
                    </label>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide min-h-[80px]">
                    {selectedFiles.length === 0 && (
                        <div className="text-gray-400 text-xs italic p-4 w-full text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl flex items-center justify-center">
                            Chưa có file nào. Chọn file rồi bấm vào Avatar để gửi.
                        </div>
                    )}
                    {selectedFiles.map((file, idx) => (
                        <div key={idx} className="shrink-0 w-32 bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border border-gray-100 dark:border-zinc-700 relative group">
                            <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition">
                                <IconTrash />
                            </button>
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-2">
                                <IconFile />
                            </div>
                            <div className="text-[10px] font-bold truncate text-gray-700 dark:text-gray-300">{file.name}</div>
                            <div className="text-[9px] text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- INCOMING REQUEST MODAL --- */}
            {incomingRequests.length > 0 && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                                <IconFile />
                            </div>
                            <h3 className="font-bold text-lg">Yêu cầu nhận file</h3>
                            <p className="text-sm text-gray-500">ID: {incomingRequests[0].peerId.substr(0,5)} muốn gửi {incomingRequests[0].files.length} file</p>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 mb-6 max-h-40 overflow-y-auto">
                            <ul className="text-xs space-y-2">
                                {incomingRequests[0].files.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => rejectRequest(incomingRequests[0].peerId)} className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold text-sm transition">
                                Từ chối
                            </button>
                            <button onClick={() => acceptRequest(incomingRequests[0].peerId)} className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 transition">
                                Nhận ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CREATE QR MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-xs text-center relative animate-in zoom-in-95">
                         <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><IconX /></button>
                         <h3 className="font-bold text-xl mb-2">Mã Kết Nối</h3>
                         <div className="text-4xl font-black tracking-widest text-blue-600 mb-6 bg-blue-50 dark:bg-blue-900/20 py-4 rounded-xl border border-blue-100 dark:border-blue-900">{roomId}</div>
                         
                         <div className="bg-white p-3 rounded-xl border inline-block mb-4">
                             <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}?room=${roomId}`} size={160} />
                         </div>
                         <p className="text-xs text-gray-400 font-medium">Đưa người khác quét hoặc nhập mã trên</p>
                    </div>
                </div>
            )}

            {/* --- JOIN MODAL --- */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                     <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-xs relative animate-in zoom-in-95">
                        <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><IconX /></button>
                        <h3 className="font-bold text-xl mb-6 text-center">Nhập Mã</h3>
                        <input 
                            value={manualCode}
                            onChange={e => setManualCode(e.target.value.toUpperCase())}
                            placeholder="CODE" 
                            className="w-full text-center text-3xl font-black tracking-widest p-4 rounded-xl bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 outline-none mb-6 uppercase"
                        />
                        <button onClick={handleJoinRoom} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition">
                            Vào Phòng
                        </button>
                     </div>
                </div>
            )}
        </div>
    );
}