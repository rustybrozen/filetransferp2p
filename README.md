# File Transfer P2P

A lightweight browser-based peer-to-peer file transfer tool powered by WebRTC and Socket.IO. Transfer files directly between devices on the same local network or across the internet with zero server-side file storage.

## Features

- Local network auto-discovery based on IP
- Room code and QR code sharing for cross-network pairing
- Direct P2P streaming using WebRTC DataChannel
- Chunked file transfer with backpressure flow control
- Memory-efficient disk streaming for large files
- Drag-and-drop file transfer directly onto peer nodes
- Real-time text note sharing
- Responsive radar interface for desktop and mobile

## Tech Stack

- Framework: Next.js (App Router), React 19, TypeScript, TailwindCSS
- P2P and Networking: WebRTC (simple-peer), Socket.IO
- State Management: Zustand

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) in your browser.

### 3. Production Build

```bash
npm run build
npm start
```

## Configuration (Optional)

To enable relay connections across restrictive NATs or firewalls, specify TURN credentials in a `.env.local` file:

```env
PORT=3010
TURN_URL=turn:your-turn-server.com:3478
TURN_SECRET=your-turn-secret-key
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
