export interface FileItem {
  name: string;
  content: string;
  language: string;
  isOpen?: boolean;
}

export interface FileChange {
  type: 'create' | 'edit' | 'delete';
  file: string;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  index?: number;
  createdAt?: number;
  ownerId?: string;
  image?: {
    data: string;
    mimeType: string;
  };
  fileChanges?: FileChange[];
  isStitch?: boolean;
  theme?: string;
  isHidden?: boolean;
}

export interface TerminalLine {
  type: 'command' | 'output' | 'error';
  text: string;
}

export interface Project {
  id: string;
  name: string;
  type: 'basic' | 'react' | 'fullstack' | 'expo';
  updatedAt: number;
}
