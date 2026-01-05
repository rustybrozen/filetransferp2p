// types/transfer.ts
export interface FileHeader {
  type: 'metadata';
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface FileEnd {
  type: 'end';
  fileId: string;
}

export interface TextNote {
  type: 'text-note';
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
}
