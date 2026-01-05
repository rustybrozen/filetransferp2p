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
const IconDice = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
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
    const [uploadProgress, setUploadProgress] = useState<{ name: string, pct: number, fileId: string } | null>(null);

    const [showFilesModal, setShowFilesModal] = useState(false);

    const [waitingForPeer, setWaitingForPeer] = useState<string | null>(null); // A đang chờ B (lưu ID của B)
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);


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



    // --- HELPER TRANSLATION ---
    const text = t[lang];


    useEffect(() => {
        if (acceptedPeerId && waitingForPeer === acceptedPeerId) {
            // Tìm tên peer
            const peerName = peers.find(p => p.id === acceptedPeerId)?.name || "Unknown";

            // BẮT ĐẦU GỬI THẬT
            startTransfer(acceptedPeerId, peerName, pendingFiles);

            // Reset trạng thái chờ
            setWaitingForPeer(null);
            setAcceptedPeerId(null); // Reset signal
            // Có thể clear selectedFiles ở đây nếu muốn
        }
    }, [acceptedPeerId, waitingForPeer, pendingFiles, peers, setAcceptedPeerId]);

    // 2. KHI BỊ TỪ CHỐI
    useEffect(() => {
        if (rejectedQueueId) {
            if (waitingForPeer === rejectedQueueId) {
                // Nếu đang chờ thằng này mà nó từ chối -> Tắt waiting
                setWaitingForPeer(null);
                setPendingFiles([]);
                toast.error(text.rejected); // Hoặc dùng Toast đẹp hơn
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
                    // Xóa param trên URL cho đẹp
                    window.history.replaceState({}, '', '/');
                } else {
                    setJoinError(`${text.notFound} ${roomParam}`);
                }
            });
        }
    }, [isMounted, checkRoomExists, text]);

    // --- LOGIC: AUTO FILL CODE ---
    useEffect(() => {
        if (showManualModal && !manualInput) {
            setManualInput(generateIdentity());
        }
    }, [showManualModal, manualInput]);

    // --- LOGIC: CHECK LINK ---
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

    // --- QUEUE HANDLERS ---
    useEffect(() => {
        if (rejectedQueueId) {
            setQueue(prev => prev.filter(q => q.targetId !== rejectedQueueId));
            resetRejectedQueue();
        }
    }, [rejectedQueueId, resetRejectedQueue]);

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

                (fName, pct, fileId) => setUploadProgress({ name: fName, pct: Math.round(pct), fileId }),
                (fileId) => isFileRejected(fileId)
            );
        } catch (error) {
            console.error(error);
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

    // 👇 HÀM MỚI: KHI BẤM VÀO BONG BÓNG USER
    const handleSendRequest = (targetId: string) => {
        if (selectedFiles.length === 0) return;

        // 1. Lưu tạm file và trạng thái chờ
        setPendingFiles(selectedFiles);
        setWaitingForPeer(targetId);

        // 2. Gửi tín hiệu "Xin phép" (notifyQueueAdd)
        // Lưu ý: notifyQueueAdd cần FileList, ta convert tạm hoặc sửa notifyQueueAdd nhận array
        // Hack nhanh: Tạo object giả FileList hoặc sửa notifyQueueAdd ở useWebRTC.ts (dễ nhất là sửa hook nhận array)
        // Nhưng ở đây ta cứ truyền metadata thôi
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

    const switchToManual = () => {
        if (manualInput.trim()) {
            setRoomId(manualInput.toUpperCase());
            setShowManualModal(false);
        }
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
            // 👇 SỬA ĐOẠN NÀY:
            // 1. Dùng Array.from để chuyển FileList -> Array
            const droppedFiles = Array.from(e.dataTransfer.files);

            // 2. Nối vào danh sách cũ (để không bị mất file đã chọn trước đó)
            setSelectedFiles(prev => [...prev, ...droppedFiles]);
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
            toast.error(text.roomNotExists); // Hoặc làm UI báo lỗi đẹp hơn
        }
    };


    const handleDisconnect = () => {
        setRoomId("");
    };





  

    // --- ERROR SCREEN ---
    if (isCheckingLink || joinError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-gray-100 font-sans transition-colors">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center shadow-xl max-w-sm w-full mx-4">

                    <div className="font-bold text-lg mb-2">{isCheckingLink ? text.connecting : text.error}</div>
                    {joinError && <div className="text-red-500 mb-6 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{joinError}</div>}
                    {!isCheckingLink && (
                        <button
                            onClick={() => { setJoinError(null); setRoomId("AUTO_DETECT"); }}
                            className="bg-black dark:bg-white text-white dark:text-black rounded-xl px-6 py-3 font-bold w-full hover:opacity-80 transition"
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
            className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden relative selection:bg-gray-100 transition-colors duration-300"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >


            {isDragging && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-100 flex items-center justify-center pointer-events-none transition-opacity duration-300">
                    <div className="text-white text-2xl md:text-4xl font-bold animate-bounce tracking-widest border-4 border-white border-dashed p-10 rounded-3xl flex flex-col items-center gap-4">
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
                        className="w-10 h-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white hover:scale-105 transition-all"
                        title="Tùy chọn kết nối"
                    >
                        {/* Icon Menu / Settings */}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    </button>

                    <div>
                        {/* Trạng thái phòng */}
                        <div className="flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-zinc-800">
                            <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px] ${roomId === 'AUTO_DETECT' ? 'bg-green-500 shadow-green-500' : 'bg-purple-500 shadow-purple-500'}`}></div>
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-200 tracking-widest">
                                {roomId === "AUTO_DETECT" ? text.lanMode : roomId}
                            </span>
                        </div>


                        <div className="mt-2 ml-2 flex flex-col gap-1">
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold tracking-wide">
                                {username}
                            </span>

                            {roomId !== "AUTO_DETECT" && (
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 font-bold hover:underline text-left"
                                >
                                    <IconQr /> {text.showQr}
                                </button>
                            )}
                        </div>

                    </div>
                </div>

                {/* File Button */}
                <div className="relative pointer-events-auto flex flex-col items-end gap-2">
                    {/* Nút Chọn File */}
                    <div className="relative group">
                        <button className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform duration-200 ${selectedFiles.length > 0 ? 'bg-gray-800 text-white scale-105 ring-4 ring-blue-200 dark:ring-blue-900' : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700'}`}>
                            <IconFile />
                            <span>{selectedFiles.length > 0 ? `${selectedFiles.length} ${text.files}` : text.selectFile}</span>
                        </button>

                        <input
                            type="file"
                            multiple
                            onChange={e => {
                                if (e.target.files && e.target.files.length > 0) {
                                    // Convert FileList sang Array và nối vào danh sách cũ
                                    const newFiles = Array.from(e.target.files);
                                    setSelectedFiles(prev => [...prev, ...newFiles]);

                                    // Reset value để chọn lại được chính file đó nếu muốn
                                    e.target.value = '';
                                }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>

                    {/* File Button */}
                    <div className="relative pointer-events-auto flex items-center gap-2">

                        {/* 👇 NÚT XEM DANH SÁCH (Chỉ hiện khi có file) */}
                        {selectedFiles.length > 0 && (
                            <button
                                onClick={() => setShowFilesModal(true)}
                                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform relative"
                            >
                                <IconList />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                                    {selectedFiles.length}
                                </span>
                            </button>
                        )}



                        {/* ❌ ĐÃ XÓA CÁI LIST CŨ Ở ĐÂY ĐỂ CHO VÀO MODAL */}
                    </div>
                </div>


            </div>

            {/* --- MAP VISUALIZATION (CENTER) --- */}
            <div className="flex-1 flex items-center justify-center relative overflow-visible mt-16 md:mt-0">

                {/* Decorative Rings */}
                <div className="absolute w-75 h-75 md:w-150 md:h-150 border border-gray-200 dark:border-zinc-800 rounded-full opacity-40 pointer-events-none"></div>
                <div className="absolute w-45 h-45 md:w-87.5 md:h-87.5 border border-gray-200 dark:border-zinc-800 rounded-full opacity-60 pointer-events-none"></div>

                {/* YOU (Center Node) */}
                <div className="relative z-20 w-20 h-20 md:w-28 md:h-28 bg-white dark:bg-zinc-800 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center border-4 border-gray-50 dark:border-zinc-700 transform hover:scale-105 transition-transform duration-300">
                    <div className="flex flex-col items-center text-gray-700 dark:text-gray-200">
                        <IconUser />
                        <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider">{text.you}</span>
                    </div>
                </div>

                {/* PEERS (Satellites) */}
                {peers.length === 0 ? (
                    <div className="absolute top-[65%] md:top-[60%] text-center px-6 animate-pulse pointer-events-none">
                        <div className="text-gray-400 dark:text-zinc-500 text-sm font-medium mb-1">
                            {roomId === "AUTO_DETECT" ? text.scanning : text.waiting}
                        </div>
                        <div className="text-gray-300 dark:text-zinc-600 text-xs">
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
                        const isDuplex = isSending && isReceiving;

                        const receivingFile = Object.values(downloadProgresses).find(p => p.peerId === peer.id);

                        const currentPercent = isSending
                            ? uploadProgress?.pct || 0
                            : isReceiving
                                ? receivingFile?.percentage || 0 // 👇 Lấy % từ file tìm được
                                : 0;
                        // Dynamic Styles based on Status
                        let ringClass = "border-gray-100 dark:border-zinc-700";
                        let scaleClass = "scale-100";
                        let StatusIcon = IconSmartphone;
                        let statusColor = "text-gray-500 dark:text-gray-400";
                        let cursorClass = "cursor-pointer";
                        if (isBusy) cursorClass = "cursor-wait";
                        else if (!hasFiles && !incoming) cursorClass = "cursor-not-allowed";
                        if (isDuplex) {
                            ringClass = "border-purple-500 border-double animate-pulse"; // Màu tím mộng mơ
                            StatusIcon = IconLightning; // Icon sấm sét cho ngầu
                            statusColor = "text-purple-500";
                        }
                        if (isSending) {
                            // 👇 Đã xóa 'animate-spin'
                            ringClass = "border-green-500 border-dashed";
                            StatusIcon = IconArrowUp;
                            statusColor = "text-green-500";
                        }
                        else if (isReceiving) {
                            // 👇 Đã xóa 'animate-spin'
                            ringClass = "border-blue-500 border-dashed";
                            StatusIcon = IconArrowDown;
                            statusColor = "text-blue-500";
                        }
                        else if (incoming) {
                            // Cái này rung rung (pulse) để báo hiệu thì giữ lại ok, hoặc xóa animate-pulse nếu muốn
                            ringClass = "border-orange-500 border-4 animate-pulse";
                            scaleClass = "scale-110";
                            StatusIcon = IconPackage;
                            statusColor = "text-orange-500";
                        }
                        return (
                            <div
                                key={peer.id}
                                className={`absolute flex flex-col items-center justify-center transition-all duration-700 ease-out ${scaleClass}`}
                                style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                            >
                                {/* Connection Line */}
                                <div
                                    className="absolute top-1/2 left-1/2 w-[120px] md:w-[220px] h-[1px] bg-gradient-to-l from-gray-300 dark:from-zinc-700 to-transparent -z-10 origin-left"
                                    style={{
                                        transform: `rotate(${(index / peers.length) * 360 - 90}deg) translate(-50%, -50%)`,
                                    }}
                                ></div>

                                {/* Peer Node Bubble */}
                                <div
                                    className={`
                w-16 h-16 md:w-24 md:h-24 bg-white dark:bg-zinc-800 rounded-full shadow-lg flex items-center justify-center border-4 relative z-10 transition-all
                ${ringClass} 
                
                ${/* 👇 LOGIC MỚI: Nếu không phải đang nhận file VÀ không có file để gửi -> Disable */ ''}
                ${!incoming && !hasFiles && !isReceiving && !isSending
                                            ? 'opacity-40 grayscale cursor-not-allowed' // Mờ đi
                                            : 'cursor-pointer hover:scale-110 hover:shadow-xl group' // Sáng lên
                                        }
            `}
                                    // 👇 Chỉ cho click khi có file hoặc đang có request đến
                                    onClick={() => {
                                        if (isBusy) return; // ⛔ ĐANG GỬI THÌ CẤM BẤM
                                        if (incoming) return; // Đang có request đến thì xử lý bằng nút bên dưới
                                        if (hasFiles) handleSendRequest(peer.id);
                                    }}
                                >
                                    {incoming && (
                                        <div className="absolute -top-3 bg-orange-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-full z-20 shadow-md animate-bounce whitespace-nowrap">
                                            {text.incoming}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-center p-1 text-gray-700 dark:text-gray-200">
                                        {/* Nếu đang gửi hoặc nhận thì hiện số %, còn không thì hiện Icon như cũ */}
                                        {(isSending || isReceiving) ? (
                                            <div className={`text-sm md:text-lg font-black ${statusColor} flex flex-col items-center leading-tight animate-pulse`}>
                                                {/* 👇 Nếu Duplex thì hiện 2 dòng % */}
                                                {isDuplex ? (
                                                    <>
                                                        <span className="text-[10px] text-green-500">⬆ {uploadProgress?.pct}%</span>
                                                        <span className="text-[10px] text-blue-500">⬇ {receivingFile?.percentage}%</span>
                                                    </>
                                                ) : (
                                                    <span>{currentPercent}%</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mb-1"><StatusIcon /></div>
                                        )}

                                        {/* Tên User */}
                                        <span className={`text-[8px] md:text-[10px] font-bold truncate max-w-[50px] md:max-w-[70px] ${statusColor}`}>
                                            {peer.name}
                                        </span>
                                    </div>

                                    {!incoming && (
                                        <div className="absolute opacity-0 group-hover:opacity-100 -bottom-8 bg-black dark:bg-white text-white dark:text-black text-[10px] px-2 py-1 rounded transition-opacity whitespace-nowrap pointer-events-none z-50">
                                            {hasFiles ? text.clickToSend : "Chọn file trước!"}
                                        </div>
                                    )}
                                </div>

                                {connType && !incoming && (
                                    <div className={`absolute -bottom-3 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm border ${connType === 'p2p'
                                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400'
                                        : 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-400'
                                        }`}>
                                        {connType === 'p2p' ? <IconLightning /> : <IconCloud />}
                                        <span>{connType === 'p2p' ? 'Nhanh' : 'Chậm'}</span>
                                    </div>
                                )}

                                {/* Actions */}



                                {incoming && !isReceiving && (
                                    <div className="absolute top-full mt-3 flex gap-2 z-20 animate-in fade-in slide-in-from-top-2">
                                        <button
                                            onClick={() => handleSendRequest(peer.id)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md transition-colors"
                                        >
                                            {text.receive}
                                        </button>
                                        <button

                                            onClick={() => rejectIncomingQueue(incoming.peerId)}
                                            className="bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-zinc-700 text-gray-400 hover:text-red-500 text-[10px] font-bold px-2 py-1.5 rounded-full shadow-md transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}


                            </div>
                        );
                    })
                )}
            </div>

            {/* FOOTER NOTE */}
            <div className="p-4 text-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border-t border-gray-100 dark:border-zinc-800">
                <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-bold tracking-wide">
                    {text.keepAwake}
                </p>
            </div>

            {/* --- FLOATING SETTINGS (Bottom Right) --- */}
            <div className="fixed bottom-16 right-4 flex gap-2 z-30">
                <button
                    onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')}
                    className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform font-bold text-xs"
                >
                    {lang === 'vi' ? 'VI' : 'EN'}
                </button>
                <button
                    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                    className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform"
                >
                    {theme === 'light' ? <IconMoon /> : <IconSun />}
                </button>
            </div>

            {/* --- MODALS --- */}
            {showFilesModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">
                        {/* Header Modal */}
                        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <IconFile /> {selectedFiles.length} {text.files}
                            </h3>
                            <button
                                onClick={clearAllFiles}
                                className="text-xs text-red-500 font-bold hover:underline"
                            >
                                Xóa tất cả
                            </button>
                        </div>

                        {/* List Files (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {selectedFiles.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{file.name}</div>
                                        <div className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                    <button
                                        onClick={() => removeFile(idx)}
                                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-800 text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 dark:border-zinc-700 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
                            <button
                                onClick={() => setShowFilesModal(false)}
                                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                            >
                                {text.close}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODE SELECTION MODAL (MENU) --- */}
            {showModeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 flex flex-col">
                        
                        {/* Header Modal */}
                        <div className="p-6 text-center border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                            <h2 className="font-black text-lg text-gray-800 dark:text-white tracking-wide uppercase">
                                {text.menuTitle}
                            </h2>
                            <p className="text-xs text-gray-400 font-bold mt-1">
                                {roomId === "AUTO_DETECT" ? text.lanMode : `${text.room}: ${roomId}`}
                            </p>
                        </div>

                        {/* Body Modal */}
                        <div className="p-6 space-y-3">

                            {/* CASE 1: ĐANG Ở LAN (3 NÚT) */}
                            {roomId === "AUTO_DETECT" ? (
                                <>
                                    {/* 1. Tạo Kết Nối */}
                                    <button 
                                        onClick={() => {
                                            handleCreateRoom();
                                            setShowModeModal(false);
                                        }}
                                        className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                    >
                                        <span>+</span> {text.createBtn}
                                    </button>

                                    {/* 2. Nhập Code */}
                                    <button 
                                        onClick={() => {
                                            setShowJoinInput(true);
                                            // Lưu ý: showJoinInput sẽ đè lên modal này hoặc ông render inline input ở đây
                                            // Cách đơn giản: Tắt modal này đi rồi bật modal nhập code (nếu ông tách modal nhập code ra riêng)
                                            // Hoặc: Render input ngay trong này (xem đoạn dưới)
                                        }}
                                        className="w-full py-4 bg-white dark:bg-zinc-800 text-gray-800 dark:text-white border-2 border-gray-100 dark:border-zinc-700 rounded-2xl font-bold hover:border-blue-500 transition-colors"
                                    >
                                        {text.joinBtn}
                                    </button>

                                    {/* 3. Quay lại (Đóng Menu) */}
                                    <button 
                                        onClick={() => setShowModeModal(false)}
                                        className="w-full py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold uppercase tracking-wider mt-2"
                                    >
                                        {text.backToLan}
                                    </button>
                                </>
                            ) : (
                                /* CASE 2: ĐANG KẾT NỐI PRIVATE (2 NÚT) */
                                <>
                                    {/* 1. Thoát Kết Nối */}
                                    <button 
                                        onClick={() => {
                                            setRoomId("AUTO_DETECT"); // Về LAN
                                            setShowModeModal(false);
                                            toast.success("Đã quay về mạng LAN");
                                        }}
                                        className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                    >
                                        <IconLogout /> {text.disconnectRoom}
                                    </button>

                                    {/* 2. Nhập Code Khác */}
                                    <button 
                                        onClick={() => setShowJoinInput(true)}
                                        className="w-full py-4 bg-white dark:bg-zinc-800 text-gray-800 dark:text-white border-2 border-gray-100 dark:border-zinc-700 rounded-2xl font-bold hover:border-blue-500 transition-colors"
                                    >
                                        {text.joinAnother}
                                    </button>
                                    
                                    {/* Nút đóng nhỏ (Optional) */}
                                    <button 
                                        onClick={() => setShowModeModal(false)}
                                        className="w-full py-2 text-gray-400 text-[10px] font-bold uppercase"
                                    >
                                        {text.close}
                                    </button>
                                </>
                            )}
                            
                            {/* --- PHẦN NHẬP CODE (Lồng vào trong Menu này cho tiện) --- */}
                            {showJoinInput && (
                                <div className="absolute inset-0 bg-white dark:bg-zinc-900 z-10 flex flex-col p-6 animate-in slide-in-from-right">
                                    <h3 className="font-bold mb-6 text-center text-lg">{text.joinBtn}</h3>
                                    <input 
                                        autoFocus
                                        value={joinCodeInput}
                                        onChange={e => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 5))}
                                        placeholder="XXXXX"
                                        className="w-full bg-gray-50 dark:bg-zinc-800 text-center text-3xl font-black tracking-[0.5em] py-6 rounded-2xl outline-none border-2 focus:border-blue-500 transition-all uppercase mb-4"
                                    />
                                    <div className="flex gap-3 mt-auto">
                                        <button 
                                            onClick={() => setShowJoinInput(false)}
                                            className="flex-1 py-4 text-gray-500 font-bold bg-gray-100 dark:bg-zinc-800 rounded-xl"
                                        >
                                            {text.cancel}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleJoinRoom();
                                                setShowModeModal(false); // Đóng menu luôn sau khi join
                                            }}
                                            disabled={joinCodeInput.length < 5 || isBusy}
                                            className="flex-1 bg-blue-600 text-white rounded-xl font-bold shadow-lg"
                                        >
                                            {isBusy ? "..." : "JOIN"}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}


            {/* 2. QR SHARE MODAL */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-xs shadow-2xl flex flex-col items-center text-center">
                        <h2 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">{text.scanQr}</h2>
                        <div className="bg-white p-3 rounded-2xl border-2 border-gray-100 dark:border-zinc-800 shadow-inner mb-6">
                            <QRCodeSVG value={getShareLink()} size={180} />
                        </div>
                        <div className="font-black text-2xl mb-6 text-gray-800 dark:text-white tracking-widest bg-gray-50 dark:bg-zinc-800 px-6 py-2 rounded-xl border border-gray-100 dark:border-zinc-700">
                            {actualRoomId}
                        </div>
                        <button
                            onClick={() => { navigator.clipboard.writeText(getShareLink()); setShowShareModal(false); }}
                            className="w-full bg-gray-600 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition shadow-lg hover:shadow-xl active:scale-95"
                        >
                            {text.copyLink}
                        </button>
                    </div>
                </div>
            )}

            {/* 5. WAITING MODAL (SENDER) - "Đang chờ chấp nhận..." */}
            {waitingForPeer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-sm w-full border border-gray-100 dark:border-zinc-800">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <IconLightning />
                        </div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">{text.waitingAccept}</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {text.sendingTo} <span className="font-bold text-gray-800 dark:text-gray-200">{peers.find(p => p.id === waitingForPeer)?.name}</span>
                        </p>

                        {/* List file rút gọn */}
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                            {pendingFiles.slice(0, 3).map((f, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500 border border-gray-200 dark:border-zinc-700 truncate max-w-[100px]">{f.name}</span>
                            ))}
                            {pendingFiles.length > 3 && <span className="text-[10px] text-gray-400">+{pendingFiles.length - 3}</span>}
                        </div>

                        <button
                            onClick={cancelRequest}
                            className="w-full py-3 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 dark:bg-zinc-800 dark:hover:bg-red-900/20 dark:text-gray-400 font-bold rounded-xl transition-colors"
                        >
                            {text.cancel}
                        </button>
                    </div>
                </div>
            )}

            {/* 6. INCOMING REQUEST MODAL (RECEIVER) - "Có người muốn gửi file..." */}
            {incomingQueues.length > 0 && !waitingForPeer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in zoom-in-95">
                    <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-sm border-2 border-blue-500 relative overflow-hidden">

                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>

                        <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <IconPackage />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-0.5">{text.requestTitle}</div>
                                    <h3 className="font-black text-xl text-gray-800 dark:text-white">
                                        {peers.find(p => p.id === incomingQueues[0].peerId)?.name || "Stranger"}
                                    </h3>
                                    <div className="text-xs text-gray-400">{text.wantsToSend}</div>
                                </div>
                            </div>

                            {/* Danh sách file đến */}
                            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 mb-6 max-h-[150px] overflow-y-auto border border-gray-100 dark:border-zinc-800">
                                <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                                    <span>Files</span>
                                    <span>{incomingQueues[0].files.length}</span>
                                </div>
                                <div className="space-y-2">
                                    {incomingQueues[0].files.map((fileName, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <IconFile />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{fileName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => rejectIncomingQueue(incomingQueues[0].peerId)}
                                    className="flex-1 py-3.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-red-500 dark:text-gray-400 font-bold rounded-xl transition-colors"
                                >
                                    {text.reject}
                                </button>
                                <button
                                    onClick={() => acceptIncomingRequest(incomingQueues[0].peerId)}
                                    className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                                >
                                    {text.accept}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. PROGRESS BAR */}
            {(activeTask || downloadProgresses) && (

                <div className="fixed bottom-12 left-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">

                    {/* THANH GỬI (UPLOAD) */}
                    {activeTask && uploadProgress && (
                        <div className="pointer-events-auto max-w-md mx-auto w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-lg border border-green-100 dark:border-green-900/30 p-3 relative overflow-hidden animate-in slide-in-from-bottom-5">
                            <div className="absolute top-0 left-0 h-1 bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress.pct}%` }}></div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                    <IconArrowUp />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate pr-2">
                                            {text.sendingTo} {activeTask.peerName}
                                        </span>
                                        <span className="text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                            {uploadProgress.pct}%
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">{uploadProgress.name}</div>
                                </div>
                                <button
                                    onClick={() => {
                                        // 1. Gọi logic hủy gửi
                                        cancelOutgoingFile(uploadProgress.fileId, activeTask.targetId);

                                        // 2. 👇 THÊM DÒNG NÀY: Force tắt UI ngay lập tức cho mượt
                                        setActiveTask(null);
                                        setUploadProgress(null);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* THANH NHẬN (DOWNLOAD) */}
                    {Object.values(downloadProgresses).map((progress) => (
                        <div key={progress.fileId} className="pointer-events-auto max-w-md mx-auto w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/30 p-3 relative overflow-hidden animate-in slide-in-from-bottom-5">

                            {/* Thanh % */}
                            <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${progress.percentage}%` }}></div>

                            <div className="flex items-center gap-3">
                                {/* Icon */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                    <IconArrowDown />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate pr-2">
                                            {text.receivingFrom} {peers.find(p => p.id === progress.peerId)?.name}
                                        </span>
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                            {progress.percentage}%
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">{progress.fileName}</div>
                                </div>

                                {/* Nút Hủy riêng cho từng file */}
                                <button
                                    onClick={() => rejectIncomingFile(progress.fileId, progress.peerId)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors"
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
                reverseOrder={false}
                toastOptions={{
                    className: '',
                    style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '12px',
                        padding: '16px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                    },

                    success: { style: { background: 'green' } },
                    error: { style: { background: 'red' } },
                }}
            />


        </div>
    );
}