"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { sendBatchFiles } from "@/utils/fileTransfer";
import { generateIdentity } from "@/utils/nameGenerator";
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../utils/translation';


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

const IconLightning = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconCloud = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;

type Lang = 'vi' | 'en';
type Theme = 'light' | 'dark';

// --- CONFIG ---
type QueueItem = { id: string; targetId: string; peerName: string; files: FileList; };
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_COUNT = 500;

export default function Home() {
    const [isMounted, setIsMounted] = useState(false);


    const [lang, setLang] = useState<Lang>('vi');
    const [theme, setTheme] = useState<Theme>('light');


    const [username, setUsername] = useState("");
    const [roomId, setRoomId] = useState("AUTO_DETECT");


    const [showManualModal, setShowManualModal] = useState(false);
    const [manualInput, setManualInput] = useState("");
    const [showShareModal, setShowShareModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Connection Error State
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isCheckingLink, setIsCheckingLink] = useState(false);

    // File Transfer State
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeTask, setActiveTask] = useState<QueueItem | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ name: string, pct: number } | null>(null);


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
        peers, getPeerInstance, downloadProgress, rejectIncomingFile, isFileRejected,
        incomingQueues, notifyQueueAdd, notifyQueueRemove, rejectIncomingQueue, rejectedQueueId, resetRejectedQueue,
        actualRoomId, checkRoomExists, connectionTypes
    } = useWebRTC(roomId, username);

    // --- HELPER TRANSLATION ---
    const text = t[lang];

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
                (fName, pct) => setUploadProgress({ name: fName, pct: Math.round(pct) }),
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

    const addToQueue = (targetId: string, peerName: string) => {
        if (!selectedFiles?.length) return alert(text.noFile);

        if (selectedFiles.length > MAX_FILE_COUNT) return alert(text.tooManyFiles);
        for (let i = 0; i < selectedFiles.length; i++) {
            if (selectedFiles[i].size > MAX_FILE_SIZE) return alert(`${text.fileTooBig} ${selectedFiles[i].name}`);
        }

        const newTask = {
            id: Math.random().toString(36).substr(2, 9),
            targetId,
            peerName,
            files: selectedFiles
        };
        setQueue(prev => [...prev, newTask]);
        notifyQueueAdd(targetId, selectedFiles);
        setSelectedFiles(null);
    };

    const getPeerState = (peerId: string) => {
        const isSending = activeTask?.targetId === peerId;
        const isReceiving = downloadProgress?.peerId === peerId;
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
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setSelectedFiles(e.dataTransfer.files);
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


    // --- ERROR SCREEN ---
    if (isCheckingLink || joinError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-gray-100 font-sans transition-colors">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center shadow-xl max-w-sm w-full mx-4">
                    <div className="animate-spin text-3xl mb-4 text-blue-500">⏳</div>
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
                <div className="pointer-events-auto">
                    <div
                        onClick={() => setShowManualModal(true)}
                        className="flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-zinc-800 cursor-pointer hover:shadow-md hover:scale-105 transition-all"
                    >
                        <div className={`w-2.5 h-2.5 rounded-full ${roomId === 'AUTO_DETECT' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-500 shadow-[0_0_10px_#3b82f6]'}`}></div>
                        <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{roomId === "AUTO_DETECT" ? text.lanMode : roomId}</span>
                    </div>
                    <div className="mt-2 ml-2 flex flex-col gap-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-bold tracking-wide">{username}</span>
                        {roomId !== "AUTO_DETECT" && (
                            <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 font-bold hover:underline text-left">
                                <IconQr /> {text.showQr}
                            </button>
                        )}
                    </div>
                </div>

                {/* File Button */}
                <div className="relative pointer-events-auto group">
                    <button className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform duration-200 ${selectedFiles ? 'bg-gray-600 text-white scale-105 ring-4 ring-blue-200 dark:ring-blue-900' : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700'}`}>
                        <IconFile />
                        <span>{selectedFiles ? `${selectedFiles.length} ${text.files}` : text.selectFile}</span>
                    </button>
                    <input type="file" multiple onChange={e => setSelectedFiles(e.target.files)} className="absolute inset-0 opacity-0 cursor-pointer" />
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

                        // Dynamic Styles based on Status
                        let ringClass = "border-gray-100 dark:border-zinc-700";
                        let scaleClass = "scale-100";
                        let StatusIcon = IconSmartphone;
                        let statusColor = "text-gray-500 dark:text-gray-400";

                        if (isSending) {
                            ringClass = "border-green-500 border-dashed animate-spin";
                            StatusIcon = IconArrowUp;
                            statusColor = "text-green-500";
                        }
                        else if (isReceiving) {
                            ringClass = "border-blue-500 border-dashed animate-spin";
                            StatusIcon = IconArrowDown;
                            statusColor = "text-blue-500";
                        }
                        else if (incoming) {
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
                                    className={`w-16 h-16 md:w-24 md:h-24 bg-white dark:bg-zinc-800 rounded-full shadow-lg flex items-center justify-center border-4 ${ringClass} cursor-pointer hover:scale-110 hover:shadow-xl transition-all relative z-10 group`}
                                    onClick={() => !incoming && addToQueue(peer.id, peer.name)}
                                >
                                    {incoming && (
                                        <div className="absolute -top-3 bg-orange-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-full z-20 shadow-md animate-bounce whitespace-nowrap">
                                            {text.incoming}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-center p-1 text-gray-700 dark:text-gray-200">
                                        <div className="mb-1"><StatusIcon /></div>
                                        <span className={`text-[8px] md:text-[10px] font-bold truncate max-w-[50px] md:max-w-[70px] ${statusColor}`}>{peer.name}</span>
                                    </div>

                                    {!incoming && (
                                        <div className="absolute opacity-0 group-hover:opacity-100 -bottom-8 bg-black dark:bg-white text-white dark:text-black text-[10px] px-2 py-1 rounded transition-opacity whitespace-nowrap pointer-events-none">
                                            {text.clickToSend}
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
                                            onClick={() => addToQueue(peer.id, peer.name)}
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

            {/* 1. MANUAL CONNECT MODAL */}
            {showManualModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl transform transition-all scale-100">



                        {/* Tabs */}
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-xl mb-6">
                            <button
                                onClick={() => { setRoomId("AUTO_DETECT"); setShowManualModal(false) }}
                                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${roomId === 'AUTO_DETECT' ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                            >
                                {text.autoLan}
                            </button>
                            <button className="flex-1 py-3 rounded-lg text-xs font-bold bg-transparent text-black dark:text-white cursor-default">
                                {text.roomCode}
                            </button>
                        </div>

                        {/* Auto-filled Input */}
                        <div className="mb-6 relative group">
                            <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold mb-2 uppercase tracking-wide text-center">{text.yourCode}</div>
                            <div className="relative">
                                <input
                                    value={manualInput}
                                    onChange={e => setManualInput(e.target.value.toUpperCase())}
                                    className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-700 focus:border-blue-500 rounded-2xl p-4 font-black text-center text-2xl outline-none uppercase tracking-widest text-gray-800 dark:text-white transition-all placeholder:text-gray-300"
                                    placeholder="CODE"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-zinc-600 text-xs pointer-events-none">
                                    <IconDice />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={switchToManual}
                                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                {text.joinRoom}
                            </button>
                            <button
                                onClick={() => setShowManualModal(false)}
                                className="w-full py-3 text-gray-400 text-xs font-bold hover:text-black dark:hover:text-white transition-colors"
                            >
                                {text.close}
                            </button>
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

            {/* 3. PROGRESS BAR */}
            {(activeTask || downloadProgress) && (
                <div className="fixed bottom-12 left-4 right-4 z-40 animate-in slide-in-from-bottom-5">
                    <div className="max-w-md mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-zinc-800 p-4 relative overflow-hidden">

                        {/* Progress Line */}
                        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300" style={{ width: `${activeTask ? uploadProgress?.pct : downloadProgress?.percentage}%` }}></div>

                        <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm ${activeTask ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-blue-400'}`}>
                                {activeTask ? <IconArrowUp /> : <IconArrowDown />}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate pr-2">
                                        {activeTask ? `${text.sendingTo} ${activeTask.peerName}` : text.receivingFrom}
                                    </span>
                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-900/20 px-2 py-0.5 rounded-full">
                                        {activeTask ? uploadProgress?.pct : downloadProgress?.percentage}%
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 font-medium truncate">
                                    {activeTask ? uploadProgress?.name : downloadProgress?.fileName}
                                </div>
                            </div>

                            {/* Cancel */}
                            {downloadProgress && (
                                <button
                                    onClick={() => rejectIncomingFile(downloadProgress.fileId, downloadProgress.peerId)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}