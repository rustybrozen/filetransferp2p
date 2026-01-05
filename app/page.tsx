"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { sendBatchFiles } from "@/utils/fileTransfer";
import { generateIdentity } from "@/utils/nameGenerator";
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../utils/translation';
import toast, { Toaster } from 'react-hot-toast';


const IconFile = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const IconQr = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>;
const IconUser = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IconSmartphone = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const IconArrowUp = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
const IconArrowDown = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
const IconPackage = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
const IconSun = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconMoon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const IconLogout = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const IconLightning = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconCloud = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;
// Thêm Icon List
const IconList = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
type Lang = 'vi' | 'en';
type Theme = 'light' | 'dark';

// --- CONFIG ---
type QueueItem = { id: string; targetId: string; peerName: string; files: File[]; };
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_COUNT = 100;

const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export default function Home() {
    const [isMounted, setIsMounted] = useState(false);


    const [lang, setLang] = useState<Lang>('vi');
    const [theme, setTheme] = useState<Theme>('light');


    const [username, setUsername] = useState("");
    const [roomId, setRoomId] = useState("AUTO_DETECT");

    const [showJoinInput, setShowJoinInput] = useState(false);
    const [joinCodeInput, setJoinCodeInput] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualInput, setManualInput] = useState("");
    const [showShareModal, setShowShareModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showModeModal, setShowModeModal] = useState(false);

    // Connection Error State
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isCheckingLink, setIsCheckingLink] = useState(false);

    // File Transfer State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeTask, setActiveTask] = useState<QueueItem | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ name: string, pct: number, fileId: string, current: number, total: number } | null>(null);

    const [showFilesModal, setShowFilesModal] = useState(false);

    const [waitingForPeer, setWaitingForPeer] = useState<string | null>(null); // A đang chờ B (lưu ID của B)
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    useEffect(() => {
        const handleOffline = () => {
            // Khi mất mạng: Báo lỗi đỏ, rung máy (nếu có thể), chặn thao tác
            toast.error("Mất kết nối mạng! Quá trình truyền file có thể bị gián đoạn.", {
                duration: 5000,
            });
        };

        const handleOnline = () => {
            // Khi có mạng lại: Báo xanh, nhắc user kiểm tra
            toast.success("Đã có mạng trở lại. Nếu tiến trình bị đứng, hãy tải lại trang.", {
                duration: 5000,
            });

            // Pro tip: Có thể thử reconnect socket ở đây nếu muốn
            // if (!socketRef.current?.connected) socketRef.current?.connect();
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);
    // --- INIT ---
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            // Init User
            const stored = localStorage.getItem("p2p_username");
            setUsername(stored || generateIdentity());

            // Init Theme
            const storedTheme = localStorage.getItem("p2p_theme") as Theme;
            if (storedTheme) setTheme(storedTheme);
            else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');

            // Init Lang
            const storedLang = localStorage.getItem("p2p_lang") as Lang;
            if (storedLang) setLang(storedLang);
        }
    }, []);

    // Update DOM for Theme
    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem("p2p_theme", theme);
    }, [theme]);

    // Save Lang
    useEffect(() => {
        localStorage.setItem("p2p_lang", lang);
    }, [lang]);

    const {
        peers, getPeerInstance, downloadProgresses, rejectIncomingFile, isFileRejected,
        incomingQueues, notifyQueueAdd, notifyQueueRemove, rejectIncomingQueue, rejectedQueueId, resetRejectedQueue,
        actualRoomId, checkRoomExists, connectionTypes, cancelOutgoingFile, acceptIncomingRequest,
        acceptedPeerId,
        setAcceptedPeerId
    } = useWebRTC(roomId, username);



    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (navigator as any).wakeLock.request('screen');
                console.log('Screen Wake Lock active');
            }
        } catch {

        }
    };


    const text = t[lang];
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {

            const isBusy = activeTask || Object.keys(downloadProgresses).length > 0;

            if (isBusy) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [activeTask, downloadProgresses]);

    useEffect(() => {
        if (acceptedPeerId && waitingForPeer === acceptedPeerId) {
            // Tìm tên peer
            const peerName = peers.find(p => p.id === acceptedPeerId)?.name || "Unknown";


            startTransfer(acceptedPeerId, peerName, pendingFiles);


            setWaitingForPeer(null);
            setAcceptedPeerId(null);

        }
    }, [acceptedPeerId, waitingForPeer, pendingFiles, peers, setAcceptedPeerId]);

    // 2. KHI BỊ TỪ CHỐI
    useEffect(() => {
        if (rejectedQueueId) {
            if (waitingForPeer === rejectedQueueId) {

                setWaitingForPeer(null);
                setPendingFiles([]);
                toast.error(text.rejected);
            }
            resetRejectedQueue();
        }
    }, [rejectedQueueId, waitingForPeer, resetRejectedQueue, text]);

    useEffect(() => {
        if (!isMounted || hasCheckedLink.current) return;
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room");

        if (roomParam) {
            hasCheckedLink.current = true;
            setIsCheckingLink(true);
            checkRoomExists(roomParam).then((exists) => {
                setIsCheckingLink(false);
                if (exists) {
                    setRoomId(roomParam);

                    window.history.replaceState({}, '', '/');
                } else {
                    setJoinError(`${text.notFound} ${roomParam}`);
                }
            });
        }
    }, [isMounted, checkRoomExists, text]);


    useEffect(() => {
        if (showManualModal && !manualInput) {
            setManualInput(generateIdentity());
        }
    }, [showManualModal, manualInput]);


    const hasCheckedLink = useRef(false);
    useEffect(() => {
        if (!isMounted || hasCheckedLink.current) return;
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room");
        if (roomParam) {
            hasCheckedLink.current = true;
            setIsCheckingLink(true);
            checkRoomExists(roomParam).then((exists) => {
                setIsCheckingLink(false);
                if (exists) {
                    setRoomId(roomParam);
                    window.history.replaceState({}, '', '/');
                } else {
                    setJoinError(`${text.notFound} ${roomParam}`);
                }
            });
        }
    }, [isMounted, checkRoomExists, text]);


    useEffect(() => {
        if (rejectedQueueId) {
            setQueue(prev => prev.filter(q => q.targetId !== rejectedQueueId));
            resetRejectedQueue();
        }
    }, [rejectedQueueId, resetRejectedQueue]);
    useEffect(() => {
        if (activeTask || Object.keys(downloadProgresses).length > 0) {
            requestWakeLock();
        }

    }, [activeTask, downloadProgresses]);


    const filterDuplicates = (newFiles: File[], currentFiles: File[]) => {
        const unique = newFiles.filter(nf =>
            !currentFiles.some(cf =>
                cf.name === nf.name &&
                cf.size === nf.size &&
                cf.lastModified === nf.lastModified
            )
        );

        if (unique.length < newFiles.length) {
            toast('Loại các file trùng lặp!');
        }

        return unique;
    };

    const processQueue = useCallback(async () => {
        if (activeTask || queue.length === 0) return;
        const currentTask = queue[0];
        setActiveTask(currentTask);
        setQueue(prev => prev.slice(1));
        notifyQueueRemove(currentTask.targetId);

        const peer = getPeerInstance(currentTask.targetId);
        if (!peer) { setActiveTask(null); return; }

        try {
            await sendBatchFiles(
                peer,
                currentTask.files,
                // 👇 SỬA DÒNG NÀY: Hứng thêm current, total
                (fName, pct, fileId, current, total) => setUploadProgress({
                    name: fName,
                    pct: Math.round(pct),
                    fileId,
                    current, // Lưu vào state
                    total    // Lưu vào state
                }),
                (fileId) => isFileRejected(fileId)
            );

            toast.success(`Đã gửi ${currentTask.files.length} file cho ${currentTask.peerName}!`);
        } catch (error) {

            toast.error("Có lỗi xảy ra khi gửi file!");
        } finally {
            setActiveTask(null);
            setUploadProgress(null);
        }
    }, [activeTask, queue, getPeerInstance, isFileRejected, notifyQueueRemove]);

    useEffect(() => { processQueue(); }, [processQueue]);

    const startTransfer = (targetId: string, peerName: string, filesToTransfer: File[]) => {
        const newTask = {
            id: Math.random().toString(36).substr(2, 9),
            targetId,
            peerName,
            files: filesToTransfer
        };
        setQueue(prev => [...prev, newTask]);
        // setSelectedFiles([]); // Tùy ông muốn clear hay không
    };


    const handleSendRequest = (targetId: string) => {
        if (selectedFiles.length === 0) return;


        setPendingFiles(selectedFiles);
        setWaitingForPeer(targetId);
        const dt = new DataTransfer();
        selectedFiles.forEach(f => dt.items.add(f));
        notifyQueueAdd(targetId, dt.files);
    };

    // Hủy yêu cầu khi đang chờ
    const cancelRequest = () => {
        if (waitingForPeer) {
            notifyQueueRemove(waitingForPeer); // Gửi tin hủy
            setWaitingForPeer(null);
            setPendingFiles([]);
        }
    };

    const getPeerState = (peerId: string) => {
        const isSending = activeTask?.targetId === peerId;
        const isReceiving = Object.values(downloadProgresses).some(p => p.peerId === peerId);
        const incoming = incomingQueues.find(q => q.peerId === peerId);
        return { isSending, isReceiving, incoming };
    };



    const getShareLink = () => typeof window !== 'undefined' ? `${window.location.origin}?room=${actualRoomId}` : '';

    // --- DRAG & DROP ---
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (!e.relatedTarget) setIsDragging(false); };
    // [page.tsx] - Tìm hàm handleDrop

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const uniqueFiles = filterDuplicates(droppedFiles, selectedFiles);
            setSelectedFiles(prev => [...prev, ...uniqueFiles]);
        }
    };


    const getPosition = (index: number, total: number) => {
        if (typeof window === 'undefined') return { x: 0, y: 0 };
        const isMobile = window.innerWidth < 768;
        const radius = isMobile ? 120 : 220;
        const angle = (index / total) * 2 * Math.PI - (Math.PI / 2);
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    };


    if (!isMounted) return null;
    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Hàm xóa tất cả
    const clearAllFiles = () => {
        setSelectedFiles([]);
    };


    // --- ACTIONS ---

    // 1. TẠO PHÒNG MỚI
    const handleCreateRoom = async () => {
        setIsBusy(true);
        let newCode = "";
        let isExist = true;

        // Loop để chắc chắn không trùng (dù tỉ lệ trùng thấp)
        while (isExist) {
            newCode = generateRoomCode();
            isExist = await checkRoomExists(newCode);
        }

        setRoomId(newCode);
        setIsBusy(false);
        setShowShareModal(true); // Auto hiện QR
    };

    // 2. NHẬP CODE (JOIN)
    const handleJoinRoom = async () => {
        if (!joinCodeInput || joinCodeInput.length < 5) return;
        setIsBusy(true);

        const code = joinCodeInput.toUpperCase();
        const exists = await checkRoomExists(code);

        setIsBusy(false);

        if (exists) {
            setRoomId(code);
            setShowJoinInput(false);
        } else {
            toast.error(text.roomNotExists);
        }
    };










    // --- MÀN HÌNH ERROR / CHECKING ---
    if (isCheckingLink || joinError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-200 font-sans">
                <div className="bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-800 max-w-sm w-full mx-4">
                    <div className="font-bold text-lg mb-2">{isCheckingLink ? text.connecting : text.error}</div>
                    {joinError && <div className="text-red-400 mb-6 text-sm bg-red-900/10 p-2 rounded border border-red-900/20">{joinError}</div>}
                    {!isCheckingLink && (
                        <button
                            onClick={() => { setJoinError(null); setRoomId("AUTO_DETECT"); }}
                            className="bg-white text-black rounded-xl px-6 py-3 font-bold w-full hover:bg-zinc-200 transition-colors"
                        >
                            {text.home}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-zinc-950 text-zinc-200 font-sans flex flex-col overflow-hidden relative selection:bg-zinc-700"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* DRAG OVERLAY */}
            {isDragging && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="text-white text-2xl font-bold border-2 border-white border-dashed p-10 rounded-2xl flex flex-col items-center gap-4">
                        <IconArrowDown />
                        {text.dropHere}
                    </div>
                </div>
            )}

            {/* HEADER BAR */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-between items-start pointer-events-none">
                {/* Room Info */}
                <div className="pointer-events-auto flex items-start gap-2">
                    <button
                        onClick={() => setShowModeModal(true)}
                        className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
                        title="Menu"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    </button>

                    <div>
                        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                            <div className={`w-2 h-2 rounded-full ${roomId === 'AUTO_DETECT' ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>
                            <span className="font-bold text-sm text-zinc-300 tracking-wider">
                                {roomId === "AUTO_DETECT" ? text.lanMode : roomId}
                            </span>
                        </div>

                        <div className="mt-2 ml-2 flex flex-col gap-1">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wide">
                                {username}
                            </span>
                            {roomId !== "AUTO_DETECT" && (
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white font-bold hover:underline"
                                >
                                    <IconQr /> {text.showQr}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* File Button */}
                <div className="relative pointer-events-auto flex flex-col items-end gap-2">
                    <div className="relative group">
                        <button className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border transition-all ${selectedFiles.length > 0 ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}>
                            <IconFile />
                            <span>{selectedFiles.length > 0 ? `${selectedFiles.length} ${text.files}` : text.selectFile}</span>
                        </button>

                        <input
                            type="file"
                            multiple
                            onChange={e => {
                                if (e.target.files && e.target.files.length > 0) {
                                    const newFiles = Array.from(e.target.files);


                                    const uniqueFiles = filterDuplicates(newFiles, selectedFiles);

                                    setSelectedFiles(prev => [...prev, ...uniqueFiles]);
                                    e.target.value = '';
                                }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>

                    {selectedFiles.length > 0 && (
                        <button
                            onClick={() => setShowFilesModal(true)}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400 hover:text-white transition-colors relative"
                        >
                            <IconList />
                        </button>
                    )}
                </div>
            </div>

            {/* --- MAP VISUALIZATION (CENTER) --- */}
            <div className="flex-1 flex items-center justify-center relative mt-16 md:mt-0">

                {/* Cleaned up decorative rings (Deleted) */}

                {/* YOU (Center Node) */}
                <div className="relative z-20 w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-lg">
                    <div className="flex flex-col items-center text-zinc-400">
                        <IconUser />

                    </div>
                </div>

                {/* PEERS (Satellites) */}
                {peers.length === 0 ? (
                    <div className="absolute top-[65%] text-center px-6 pointer-events-none">
                        <div className="text-zinc-500 text-sm font-medium mb-1 animate-pulse">
                            {roomId === "AUTO_DETECT" ? text.scanning : text.waiting}
                        </div>
                        <div className="text-zinc-700 text-xs">
                            {text.openOther}
                        </div>
                    </div>
                ) : (
                    peers.map((peer, index) => {
                        const pos = getPosition(index, peers.length);
                        const { isSending, isReceiving, incoming } = getPeerState(peer.id);
                        const connType = connectionTypes[peer.id];
                        const hasFiles = selectedFiles.length > 0;
                        const isBusy = isSending || isReceiving;
                        const receivingFile = Object.values(downloadProgresses).find(p => p.peerId === peer.id);

                        const currentPercent = isSending
                            ? uploadProgress?.pct || 0
                            : isReceiving
                                ? receivingFile?.percentage || 0
                                : 0;

                        // Tính radius để vẽ line cho khớp với vị trí bong bóng
                        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                        const radius = isMobile ? 120 : 220; // Phải khớp với số trong hàm getPosition

                        // UI Logic: Grayscale/Zinc Theme
                        let ringClass = "border-zinc-800";
                        let StatusIcon = IconSmartphone;
                        let statusColor = "text-zinc-500";
                        let cursorClass = "cursor-pointer";

                        if (isBusy) {
                            cursorClass = "cursor-wait";
                            ringClass = "border-zinc-600 border-dashed";
                        } else if (!hasFiles && !incoming) {
                            cursorClass = "cursor-not-allowed opacity-50";
                        }

                        if (isSending) {
                            StatusIcon = IconArrowUp;
                            statusColor = "text-white";
                        } else if (isReceiving) {
                            StatusIcon = IconArrowDown;
                            statusColor = "text-white";
                        } else if (incoming) {
                            ringClass = "border-white border-double";
                            StatusIcon = IconPackage;
                            statusColor = "text-white";
                        }

                        return (
                            <div key={peer.id} className="absolute inset-0 pointer-events-none">

                                {/* 1. CONNECTION LINE (Vẽ từ tâm màn hình ra) */}
                                <div
                                    className="absolute top-1/2 left-1/2 h-[1px] bg-gradient-to-l from-zinc-700 to-transparent -z-10 origin-left"
                                    style={{
                                        width: `${radius}px`, // Dài bằng bán kính
                                        transform: `rotate(${(index / peers.length) * 360 - 90}deg)`, // Chỉ xoay góc
                                    }}
                                ></div>

                                {/* 2. PEER NODE (Dịch chuyển đến vị trí vệ tinh) */}
                                <div
                                    className="absolute top-1/2 left-1/2 flex flex-col items-center justify-center transition-all duration-500 pointer-events-auto"
                                    style={{
                                        // Dịch chuyển X, Y rồi lùi lại 50% để tâm bong bóng trùng khớp điểm nối line
                                        transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`
                                    }}
                                >
                                    {/* Peer Node Bubble (Giữ nguyên code UI của ông) */}
                                    <div
                                        className={`
                                        w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-2 relative z-10 transition-all
                                        ${ringClass} ${cursorClass} hover:bg-zinc-800
                                    `}
                                        onClick={() => {
                                            if (isBusy || incoming) return;
                                            if (hasFiles) handleSendRequest(peer.id);
                                        }}
                                    >
                                        {incoming && (
                                            <div className="absolute -top-3 bg-white text-black text-[9px] font-bold px-2 py-0.5 rounded-full z-20 border border-zinc-200">
                                                {text.incoming}
                                            </div>
                                        )}

                                        <div className="flex flex-col items-center p-1">
                                            {(isSending || isReceiving) ? (
                                                <div className={`text-sm font-bold ${statusColor} flex flex-col items-center leading-tight`}>
                                                    <span>{currentPercent}%</span>
                                                </div>
                                            ) : (
                                                <div className={`mb-1 ${statusColor}`}><StatusIcon /></div>
                                            )}

                                            <span className="text-[9px] font-bold truncate max-w-[60px] text-zinc-400">
                                                {peer.name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Connection Type Label */}
                                    {connType && !incoming && connType === 'p2p' && (
                                        <div className="absolute -bottom-4 bg-zinc-950 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded text-[8px] font-bold uppercase">
                                            FAST
                                        </div>
                                    )}

                                    {/* Action Buttons for Incoming */}
                                    {incoming && !isReceiving && (
                                        <div className="absolute top-full mt-2 flex gap-2 z-20">
                                            <button
                                                onClick={() => handleSendRequest(peer.id)} // Chỗ này ông đang gọi handleSendRequest, coi chừng nhầm với acceptIncomingRequest nhé
                                                className="bg-white hover:bg-zinc-200 text-black text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm"
                                            >
                                                {text.receive}
                                            </button>
                                            <button
                                                onClick={() => rejectIncomingQueue(incoming.peerId)}
                                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold px-2 py-1.5 rounded-full"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* FOOTER NOTE */}
            <div className="p-4 text-center border-t border-zinc-900">
                <p className="text-[10px] text-zinc-600 font-bold tracking-wide uppercase">
                    {text.keepAwake}
                </p>
            </div>

            {/* --- FLOATING SETTINGS (Lang Only - Removed Theme Toggle) --- */}
            <div className="fixed bottom-16 right-4 z-30">
                <button
                    onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')}
                    className="w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white font-bold text-xs hover:border-zinc-600 transition-colors"
                >
                    {lang === 'vi' ? 'VI' : 'EN'}
                </button>
            </div>

            {/* --- MODALS --- */}

            {/* 1. FILE LIST MODAL */}
            {showFilesModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-sm border border-zinc-800 flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <IconFile /> {selectedFiles.length} {text.files}
                            </h3>
                            <button onClick={clearAllFiles} className="text-xs text-red-400 hover:text-red-300 font-bold">
                                Xóa hết
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {selectedFiles.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-zinc-300 truncate">{file.name}</div>
                                        <div className="text-xs text-zinc-600">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                    <button onClick={() => removeFile(idx)} className="text-zinc-500 hover:text-red-400">✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-zinc-800">
                            <button
                                onClick={() => setShowFilesModal(false)}
                                className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                            >
                                {text.close}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MODE MENU MODAL */}
            {showModeModal && (
                <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-800 overflow-hidden flex flex-col">
                        <div className="p-6 text-center border-b border-zinc-800 bg-zinc-950">
                            <h2 className="font-bold text-lg text-white uppercase tracking-wider">{text.menuTitle}</h2>
                            <p className="text-xs text-zinc-500 font-bold mt-1">
                                {roomId === "AUTO_DETECT" ? text.lanMode : `${text.room}: ${roomId}`}
                            </p>
                        </div>

                        <div className="p-6 space-y-3">
                            {roomId === "AUTO_DETECT" ? (
                                <>
                                    <button
                                        onClick={() => { handleCreateRoom(); setShowModeModal(false); }}
                                        className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>+</span> {text.createBtn}
                                    </button>
                                    <button
                                        onClick={() => setShowJoinInput(true)}
                                        className="w-full py-4 bg-zinc-800 text-white border border-zinc-700 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                                    >
                                        {text.joinBtn}
                                    </button>
                                    <button onClick={() => setShowModeModal(false)} className="w-full py-3 text-zinc-500 hover:text-white text-xs font-bold uppercase mt-2">
                                        {text.backToLan}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setRoomId("AUTO_DETECT");
                                            setShowModeModal(false);
                                            toast.success("Đã về LAN");
                                        }}
                                        className="w-full py-4 bg-red-900/30 text-red-200 border border-red-900/50 rounded-xl font-bold hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <IconLogout /> {text.disconnectRoom}
                                    </button>
                                    <button onClick={() => setShowJoinInput(true)} className="w-full py-4 bg-zinc-800 text-white border border-zinc-700 rounded-xl font-bold hover:bg-zinc-700">
                                        {text.joinAnother}
                                    </button>
                                    <button onClick={() => setShowModeModal(false)} className="w-full py-2 text-zinc-500 text-[10px] font-bold uppercase">
                                        {text.close}
                                    </button>
                                </>
                            )}

                            {/* JOIN INPUT OVERLAY */}
                            {showJoinInput && (
                                <div className="absolute inset-0 bg-zinc-900 z-10 flex flex-col p-6">
                                    <h3 className="font-bold mb-6 text-center text-lg text-white">{text.joinBtn}</h3>
                                    <input
                                        autoFocus
                                        value={joinCodeInput}
                                        onChange={e => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 5))}
                                        placeholder="XXXXX"
                                        className="w-full bg-zinc-950 text-white text-center text-3xl font-black tracking-[0.5em] py-6 rounded-xl outline-none border border-zinc-700 focus:border-white transition-colors uppercase mb-4 placeholder-zinc-800"
                                    />
                                    <div className="flex gap-3 mt-auto">
                                        <button onClick={() => setShowJoinInput(false)} className="flex-1 py-4 text-zinc-400 font-bold bg-zinc-800 rounded-xl hover:text-white">
                                            {text.cancel}
                                        </button>
                                        <button
                                            onClick={() => { handleJoinRoom(); setShowModeModal(false); }}
                                            disabled={joinCodeInput.length < 5 || isBusy}
                                            className="flex-1 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 disabled:opacity-50"
                                        >
                                            JOIN
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. QR SHARE MODAL */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-xs border border-zinc-800 flex flex-col items-center text-center">
                        <h2 className="font-bold text-lg mb-4 text-white">{text.scanQr}</h2>
                        <div className="bg-white p-2 rounded-xl mb-6">
                            <QRCodeSVG value={getShareLink()} size={160} />
                        </div>
                        <div className="font-black text-2xl mb-6 text-white tracking-widest bg-zinc-950 px-6 py-2 rounded-lg border border-zinc-800">
                            {actualRoomId}
                        </div>
                        <button
                            onClick={() => { navigator.clipboard.writeText(getShareLink()); setShowShareModal(false); }}
                            className="w-full bg-zinc-800 text-white py-3 rounded-xl font-bold hover:bg-zinc-700 border border-zinc-700"
                        >
                            {text.copyLink}
                        </button>
                    </div>
                </div>
            )}

            {/* 4. WAITING MODAL */}
            {waitingForPeer && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 p-8 rounded-2xl flex flex-col items-center text-center max-w-sm w-full border border-zinc-800">
                        <div className="w-16 h-16 bg-zinc-800 text-zinc-200 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
                            <IconLightning />
                        </div>
                        <h3 className="font-bold text-lg text-white mb-2">{text.waitingAccept}</h3>
                        <p className="text-sm text-zinc-500 mb-6">
                            {text.sendingTo} <span className="font-bold text-zinc-300">{peers.find(p => p.id === waitingForPeer)?.name}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                            {pendingFiles.slice(0, 3).map((f, i) => (
                                <span key={i} className="text-[10px] bg-zinc-950 px-2 py-1 rounded text-zinc-400 border border-zinc-800 truncate max-w-[100px]">{f.name}</span>
                            ))}
                        </div>
                        <button
                            onClick={cancelRequest}
                            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold rounded-xl transition-colors"
                        >
                            {text.cancel}
                        </button>
                    </div>
                </div>
            )}

            {/* 5. INCOMING REQUEST MODAL */}
            {incomingQueues.length > 0 && !waitingForPeer && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm border border-zinc-700 relative">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-white text-black rounded-xl flex items-center justify-center">
                                <IconPackage />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">{text.requestTitle}</div>
                                <h3 className="font-black text-xl text-white">
                                    {peers.find(p => p.id === incomingQueues[0].peerId)?.name || "Stranger"}
                                </h3>
                                <div className="text-xs text-zinc-400">{text.wantsToSend}</div>
                            </div>
                        </div>

                        <div className="bg-zinc-950 rounded-xl p-4 mb-6 max-h-[150px] overflow-y-auto border border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-600 mb-2 uppercase flex justify-between">
                                <span>Files</span>
                                <span>{incomingQueues[0].files.length}</span>
                            </div>
                            <div className="space-y-2">
                                {incomingQueues[0].files.map((fileName, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <IconFile />
                                        <span className="text-xs font-bold text-zinc-300 truncate">{fileName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => rejectIncomingQueue(incomingQueues[0].peerId)}
                                className="flex-1 py-3 bg-zinc-800 text-zinc-400 hover:text-white font-bold rounded-xl transition-colors"
                            >
                                {text.reject}
                            </button>
                            <button
                                onClick={() => acceptIncomingRequest(incomingQueues[0].peerId)}
                                className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                            >
                                {text.accept}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. PROGRESS BAR (Gray Scale) */}
            {(activeTask || downloadProgresses) && (
                <div className="fixed bottom-12 left-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">

                    {activeTask && uploadProgress && (
                        <div className="pointer-events-auto max-w-md mx-auto w-full bg-zinc-900 rounded-xl border border-zinc-800 p-3 relative overflow-hidden animate-in slide-in-from-bottom-5">

                            {/* Background Progress Bar */}
                            <div className="absolute top-0 left-0 bottom-0 bg-zinc-800 transition-all duration-300" style={{ width: `${uploadProgress.pct}%` }}></div>

                            <div className="relative flex items-center gap-3">
                                {/* Icon */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-zinc-950 text-white border border-zinc-800">
                                    <IconArrowUp />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-xs text-white truncate pr-2">
                                            {text.sendingTo} {activeTask.peerName}


                                            {uploadProgress?.total && uploadProgress.total > 1 && (
                                                <span className="ml-1 text-[10px] text-zinc-400 font-normal">
                                                    ({uploadProgress.current}/{uploadProgress.total})
                                                </span>
                                            )}
                                        </span>

                                        <span className="text-[10px] font-black text-white bg-black/50 px-1.5 py-0.5 rounded">
                                            {uploadProgress.pct}%
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate">{uploadProgress.name}</div>
                                </div>


                                <button
                                    onClick={() => {
                                        cancelOutgoingFile(uploadProgress.fileId, activeTask.targetId);
                                        setActiveTask(null);
                                        setUploadProgress(null);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* DOWNLOAD */}
                    {Object.values(downloadProgresses).map((progress) => (
                        <div key={progress.fileId} className="pointer-events-auto max-w-md mx-auto w-full bg-zinc-900 rounded-xl border border-zinc-800 p-3 relative overflow-hidden">
                            <div className="absolute top-0 left-0 bottom-0 bg-zinc-700 transition-all duration-300" style={{ width: `${progress.percentage}%` }}></div>
                            <div className="relative flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white text-black">
                                    <IconArrowDown />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-xs text-white truncate pr-2">
                                            {text.receivingFrom} {peers.find(p => p.id === progress.peerId)?.name}
                                        </span>
                                        <span className="text-[10px] font-black text-white bg-black/50 px-1.5 py-0.5 rounded">
                                            {progress.percentage}%
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate">{progress.fileName}</div>
                                </div>
                                <button
                                    onClick={() => rejectIncomingFile(progress.fileId, progress.peerId)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Toaster
                position="bottom-center"
                toastOptions={{
                    style: {
                        background: '#18181b',
                        color: '#fff',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '14px',
                    },
                }}
            />
        </div>
    );
}