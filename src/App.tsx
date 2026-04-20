import React, { useState, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  FileCode, 
  Play, 
  Terminal as TerminalIcon, 
  MessageSquare, 
  Files, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Trash2,
  Send,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  Smartphone,
  MoreVertical,
  Edit2,
  Download,
  Eye,
  Image as ImageIcon,
  Settings,
  Sparkles,
  Command as CommandIcon,
  Sidebar as SidebarIcon,
  ChevronLeft,
  History,
  Bot,
  Code2,
  Globe,
  List,
  SquareTerminal,
  ArrowLeft,
  FileJson,
  FileText,
  FolderPlus,
  FilePlus,
  Upload,
  Atom,
  Folder,
  FileArchive,
  Github
} from 'lucide-react';
import { 
  SiJavascript, 
  SiTypescript, 
  SiReact, 
  SiHtml5, 
  SiCss, 
  SiMarkdown, 
  SiJson, 
  SiPython, 
  SiTailwindcss, 
  SiEslint, 
  SiBabel, 
  SiNodedotjs,
  SiVite,
  SiPostcss
} from 'react-icons/si';
import { FaJava } from 'react-icons/fa';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileItem, Message, Project } from './types';
import { chatWithAura, chatWithAuraStream } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import Terminal from './components/Terminal';
import Dashboard from './components/Dashboard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { saveProjectMetadata, syncProjectFiles, loadProjectFiles } from './services/firebaseService';
import FirebaseLogin from './components/FirebaseLogin';
import { io, Socket } from 'socket.io-client';
import { QRCodeCanvas } from 'qrcode.react';

const MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'SUPERPOWER' },
  { id: 'gemini-3-pro-preview', name: 'Power' },
  { id: 'gemini-3-flash-preview', name: 'Economy' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'small' },
];

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (fileName === 'package.json') return <SiNodedotjs className="w-4 h-4 text-[#339933]" />;
  if (fileName.includes('tailwind')) return <SiTailwindcss className="w-4 h-4 text-[#06B6D4]" />;
  if (fileName.includes('babel')) return <SiBabel className="w-4 h-4 text-[#F9DC3E]" />;
  if (fileName.includes('eslint')) return <SiEslint className="w-4 h-4 text-[#4B32C3]" />;
  if (fileName.includes('vite')) return <SiVite className="w-4 h-4 text-[#646CFF]" />;
  if (fileName.includes('postcss')) return <SiPostcss className="w-4 h-4 text-[#DD3A0A]" />;
  
  switch (ext) {
    case 'js':
      return <SiJavascript className="w-4 h-4 text-[#F7DF1E]" />;
    case 'jsx':
      return <SiReact className="w-4 h-4 text-[#61DAFB]" />;
    case 'ts':
      return <SiTypescript className="w-4 h-4 text-[#3178C6]" />;
    case 'tsx':
      return <SiReact className="w-4 h-4 text-[#61DAFB]" />;
    case 'json':
      return <SiJson className="w-4 h-4 text-[#000000] dark:text-white" />;
    case 'html':
      return <SiHtml5 className="w-4 h-4 text-[#E34F26]" />;
    case 'css':
      return <SiCss className="w-4 h-4 text-[#1572B6]" />;
    case 'md':
      return <SiMarkdown className="w-4 h-4 text-[#000000] dark:text-white" />;
    case 'py':
      return <SiPython className="w-4 h-4 text-[#3776AB]" />;
    case 'java':
      return <FaJava className="w-4 h-4 text-[#007396]" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    default:
      return <FileCode className="w-4 h-4 text-zinc-400" />;
  }
};

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: FileItem;
}

const buildFileTree = (files: FileItem[]): FileNode[] => {
  const root: FileNode[] = [];
  files.forEach(file => {
    const parts = file.name.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;
      let node = currentLevel.find(n => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast ? 'file' : 'folder',
          children: isLast ? undefined : [],
          file: isLast ? file : undefined
        };
        currentLevel.push(node);
      }
      if (!isLast) {
        if (!node.children) node.children = [];
        currentLevel = node.children;
      }
    });
  });
  
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => {
      if (node.children) sortNodes(node.children);
    });
  };
  
  sortNodes(root);
  return root;
};

const INITIAL_BASIC_FILES: FileItem[] = [
  {
    name: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aura Basic Web</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to Aura Studio</h1>
        <p>This is a basic HTML project. Start editing to see changes!</p>
        <div id="status">JavaScript is loading...</div>
    </div>
    <script src="main.js"></script>
</body>
</html>`
  },
  {
    name: 'style.css',
    language: 'css',
    content: `body {
    font-family: -apple-system, system-ui, sans-serif;
    background: #f0f2f5;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}
.container {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    text-align: center;
}`
  },
  {
    name: 'main.js',
    language: 'javascript',
    content: `document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('status');
    status.innerText = 'JavaScript is active! 🚀';
    console.log('Hello from Aura Basic Project');
});`
  }
];

const INITIAL_REACT_FILES: FileItem[] = [
  {
    name: 'App.tsx',
    language: 'typescript',
    content: `import React, { useState } from 'react';
import { Sparkles, Code2, Zap } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight">Vite + React</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-medium">Modern Project</p>
          </div>
        </div>

        <p className="text-zinc-400 mb-8 leading-relaxed">
          Welcome to your interactive React project. State management and Lucide icons are ready to use.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
            <Code2 className="w-5 h-5 text-indigo-400 mb-2" />
            <span className="text-sm font-medium">HMR Ready</span>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
            <Zap className="w-5 h-5 text-yellow-500 mb-2" />
            <span className="text-sm font-medium">Super Fast</span>
          </div>
        </div>

        <button 
          onClick={() => setCount(c => c + 1)}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}`
  },
  {
    name: 'main.tsx',
    language: 'typescript',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
  },
  {
    name: 'index.css',
    language: 'css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  display: flex;
  place-content: center;
  min-width: 320px;
  min-height: 100vh;
}
`
  }
];

const INITIAL_FULLSTACK_FILES: FileItem[] = [
  {
    name: 'server.ts',
    language: 'typescript',
    content: `import express from 'express';
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/data', (req, res) => {
  res.json({ message: "Hello from the Python/Fullstack backend!", items: [1, 2, 3] });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`
  },
  {
    name: 'src/App.tsx',
    language: 'typescript',
    content: `import React, { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Fullstack Project</h1>
      <p className="mt-4">Connectivity to backend API:</p>
      <pre className="bg-zinc-100 p-4 mt-4 rounded">
        {JSON.stringify(data, null, 2) || 'Loading...'}
      </pre>
    </div>
  );
}`
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{
  "name": "aura-fullstack",
  "scripts": {
    "start": "tsx server.ts",
    "dev": "tsx server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "tsx": "^4.7.1"
  }
}`
  }
];

const INITIAL_EXPO_FILES: FileItem[] = [
  {
    name: 'App.js',
    language: 'javascript',
    content: `import React from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
import Terminal from './Terminal';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.dotRed} />
        <View style={styles.dotYellow} />
        <View style={styles.dotGreen} />
      </View>
      <Terminal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    height: 40,
    backgroundColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 8,
  },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f56' },
  dotYellow: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffbd2e' },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#27c93f' },
});`
  },
  {
    name: 'Terminal.js',
    language: 'javascript',
    content: `import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Platform } from 'react-native';

// We use a simple iframe for web, and WebView would be used for native
const XTERM_HTML = \`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
  <style>
    body { margin: 0; padding: 0; background-color: #000; height: 100vh; overflow: hidden; }
    #terminal { height: 100%; width: 100%; padding: 5px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script>
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#000', foreground: '#00ff00' },
      fontFamily: 'monospace',
      fontSize: 14
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    window.addEventListener('resize', () => fitAddon.fit());

    // Send keystrokes to React Native
    term.onData(data => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'input', data }));
      } else {
        window.parent.postMessage(JSON.stringify({ type: 'input', data }), '*');
      }
    });

    // Receive data from React Native
    window.addEventListener('message', function(event) {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg.type === 'write') {
          term.write(msg.data);
        } else if (msg.type === 'clear') {
          term.clear();
        }
      } catch (e) {}
    });
    
    // Also listen to document for React Native WebView
    document.addEventListener('message', function(event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'write') {
          term.write(msg.data);
        }
      } catch (e) {}
    });
  </script>
</body>
</html>
\`;

export default function Terminal() {
  // By default, we connect to the host's terminal socket if possible, 
  // or fallback to a public echo server for demonstration.
  const defaultUrl = typeof window !== 'undefined' && window.location.protocol.includes('http') 
    ? \`\${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//\${window.location.host}/terminal-socket\`
    : 'wss://echo.websocket.org';

  const [serverUrl, setServerUrl] = useState(defaultUrl);
  const [isConnected, setIsConnected] = useState(false);
  const webViewRef = useRef(null);
  const wsRef = useRef(null);

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    try {
      const ws = new WebSocket(serverUrl);
      ws.onopen = () => {
        setIsConnected(true);
        sendToTerminal('\\r\\n\\x1b[32mConnected to ' + serverUrl + '\\x1b[0m\\r\\n');
      };
      ws.onmessage = (e) => {
        sendToTerminal(e.data);
      };
      ws.onclose = () => {
        setIsConnected(false);
        sendToTerminal('\\r\\n\\x1b[31mDisconnected from server\\x1b[0m\\r\\n');
      };
      ws.onerror = (e) => {
        sendToTerminal('\\r\\n\\x1b[31mConnection error\\x1b[0m\\r\\n');
      };
      wsRef.current = ws;
    } catch (err) {
      sendToTerminal('\\r\\n\\x1b[31mInvalid WebSocket URL\\x1b[0m\\r\\n');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendToTerminal = (data) => {
    const msg = JSON.stringify({ type: 'write', data });
    if (Platform.OS === 'web') {
      webViewRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(msg);
    }
  };

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent ? event.nativeEvent.data : event.data);
      if (msg.type === 'input') {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(msg.data);
        } else {
          // Local echo if not connected
          sendToTerminal(msg.data);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Auto-connect on mount
    connect();
    return () => disconnect();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (e) => {
        if (e.data && typeof e.data === 'string' && e.data.includes('"type":"input"')) {
          onMessage({ data: e.data });
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, []);

  const renderTerminal = () => {
    if (Platform.OS === 'web') {
      return (
        <iframe
          ref={webViewRef}
          srcDoc={XTERM_HTML}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          title="Terminal"
        />
      );
    }
    // For native, you would use react-native-webview
    // const { WebView } = require('react-native-webview');
    // return <WebView ref={webViewRef} source={{ html: XTERM_HTML }} onMessage={onMessage} style={styles.webview} />;
    return <View style={styles.webview}><Text style={{color:'white'}}>WebView requires native linking</Text></View>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="wss://your-server.com/term"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
        <Button 
          title={isConnected ? "Disconnect" : "Connect"} 
          onPress={isConnected ? disconnect : connect}
          color={isConnected ? "#ff4444" : "#44ff44"}
        />
      </View>
      <View style={styles.terminalContainer}>
        {renderTerminal()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e1e1e' },
  header: { flexDirection: 'row', padding: 10, backgroundColor: '#333', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#000', color: '#00ff00', padding: 8, borderRadius: 4, marginRight: 10, fontFamily: 'monospace' },
  terminalContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' }
});`
  },
  {
    name: 'app.json',
    language: 'json',
    content: `{
  "expo": {
    "name": "AuraExpoProject",
    "slug": "aura-expo-project",
    "version": "1.0.0",
    "web": {
      "bundler": "metro"
    }
  }
}`
  },
  {
    name: 'metro.config.js',
    language: 'javascript',
    content: `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = ['web.ts', 'web.tsx', 'web.js', 'web.jsx', ...config.resolver.sourceExts];
module.exports = config;`
  },
  {
    name: 'babel.config.js',
    language: 'javascript',
    content: `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};`
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{
  "name": "aura-expo-app",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~50.0.14",
    "expo-status-bar": "~1.11.1",
    "react": "18.2.0",
    "react-native": "0.73.6",
    "react-native-webview": "13.8.6"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0"
  },
  "private": true
}`
  },
  {
    name: 'app.json',
    language: 'json',
    content: `{
  "expo": {
    "name": "Aura Expo App",
    "slug": "aura-expo-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.aura.expoapp"
    },
    "extra": {
      "eas": {
        "projectId": ""
      }
    }
  }
}`
  }
];

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const [projectType, setProjectType] = useState<Project['type']>('react');
  const [files, setFiles] = useState<FileItem[]>(INITIAL_REACT_FILES);
  const [activeFile, setActiveFile] = useState<FileItem>(INITIAL_REACT_FILES[0]);
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'components']));
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [expoPreviewMode, setExpoPreviewMode] = useState<'web' | 'qr'>('web');
  const [githubToken, setGithubToken] = useState<string | null>(() => {
    try { return localStorage.getItem('github_token'); } catch (e) { return null; }
  });
  const [githubUser, setGithubUser] = useState<any | null>(() => {
    try { return JSON.parse(localStorage.getItem('github_user') || 'null'); } catch (e) { return null; }
  });
  const [isGithubDialogOpen, setIsGithubDialogOpen] = useState(false);
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [showNewRepoForm, setShowNewRepoForm] = useState(false);
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);

  // Listen for OAuth messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const { token, user } = event.data;
        setGithubToken(token);
        setGithubUser(user);
        try {
          localStorage.setItem('github_token', token);
          localStorage.setItem('github_user', JSON.stringify(user));
        } catch (e) {
          console.error('LocalStorage write failed:', e);
        }
        setMessages(prev => [...prev, { role: 'system', content: `✅ GitHub conectado como **${user.login}**.` }]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Firebase auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFbUser(user);
    });
  }, []);

  const handleGithubConnect = async () => {
    try {
      const res = await fetch('/api/auth/github/url');
      const { url } = await res.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (err) {
      console.error('Failed to get GitHub auth URL:', err);
    }
  };

  const handleGithubDisconnect = () => {
    setGithubToken(null);
    setGithubUser(null);
    try {
      localStorage.removeItem('github_token');
      localStorage.removeItem('github_user');
    } catch (e) {
      console.error('LocalStorage remove failed:', e);
    }
  };

  const fetchGithubRepos = async () => {
    if (!githubToken) return;
    setIsLoadingRepos(true);
    try {
      const res = await fetch('/api/github/repos', {
        headers: { Authorization: `token ${githubToken}` }
      });
      const data = await res.json();
      setGithubRepos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const exportToGithub = async (repoFullName: string) => {
    if (!githubToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `token ${githubToken}`
        },
        body: JSON.stringify({
          repoFullName,
          files,
          commitMessage: `Update from Aura Studio: ${new Date().toLocaleString()}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'system', content: `🚀 Proyecto exportado exitosamente a **${repoFullName}**.` }]);
        setIsGithubDialogOpen(false);
      } else {
        throw new Error(data.error || 'Failed to export');
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'system', content: `❌ Error al exportar: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'editor' | 'preview' | 'terminal'>('chat');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: '/terminal-socket',
      transports: ['websocket', 'polling'],
      query: currentProject ? { projectId: currentProject.id } : undefined
    });
    socketRef.current = socket;

    socket.on('agent:status', (data) => {
      setAgentStatus(data.status);
    });

    socket.on('agent:chunk', (data) => {
      setAgentStatus('typing');
      setStreamingMessage(prev => prev + data.content);
    });

    socket.on('agent:complete', (data) => {
      setIsLoading(false);
      setAgentStatus('idle');
      if (currentProject) {
        // Force refresh files from server after background processing is complete
        fetch(`/api/load-files?projectId=${currentProject.id}`)
          .then(res => res.json())
          .then(resData => {
            if (resData.success && resData.files) {
              setFiles(resData.files);
              const stillActive = resData.files.find((f: any) => f.name === activeFile.name);
              if (stillActive) setActiveFile(stillActive);
            }
          });
      }
    });

    socket.on('agent:error', (data) => {
      setIsLoading(false);
      setAgentStatus('idle');
      setMessages(prev => [...prev, { role: 'system', content: `Error de Aura en segundo plano: ${data.error}` }]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentProject?.id]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'typing' | 'editing' | 'verifying'>('idle');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isStitchMode, setIsStitchMode] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('modern');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [verificationRetryCount, setVerificationRetryCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile && (activeMobileTab === 'editor' || activeMobileTab === 'terminal')) {
      setActiveMobileTab('chat');
    }
  }, [isMobile, activeMobileTab]);



  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch projects
  useEffect(() => {
    if (view === 'dashboard') {
      fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
          if (data.success) setProjects(data.projects);
        })
        .catch(console.error);
    }
  }, [view]);

  const loadProject = async (project: Project) => {
    setCurrentProject(project);
    setProjectType(project.type);
    setIsLoaded(false);
    try {
      let projectFiles: FileItem[] = [];

      // Try Firebase first if logged in
      if (fbUser) {
        try {
          projectFiles = await loadProjectFiles(project.id);
        } catch (e) {
          console.error('Failed to load from Firebase:', e);
        }
      }

      // If not from Firebase or empty, try API
      if (projectFiles.length === 0) {
        const res = await fetch(`/api/load-files?projectId=${project.id}`);
        const data = await res.json();
        if (data.success && data.files && data.files.length > 0) {
          projectFiles = data.files;
        }
      }

      if (projectFiles.length > 0) {
        setFiles(projectFiles);
        setActiveFile(projectFiles[0]);
      } else {
        let initial = INITIAL_REACT_FILES;
        if (project.type === 'expo') initial = INITIAL_EXPO_FILES;
        else if (project.type === 'basic') initial = INITIAL_BASIC_FILES;
        else if (project.type === 'fullstack') initial = INITIAL_FULLSTACK_FILES;
        
        setFiles(initial);
        setActiveFile(initial[0]);
      }
      
      // Messages sync (local fallback for now)
      const savedMsgsStr = (() => {
        try { return localStorage.getItem(`aura_messages_${project.id}`); } catch (e) { return null; }
      })();
      let savedMsgs = [];
      if (savedMsgsStr) {
        try { savedMsgs = JSON.parse(savedMsgsStr); } catch (e) {}
      }
      setMessages(savedMsgs.length > 0 ? savedMsgs : [{ role: 'model', content: '¡Hola! Welcome! What would you like to build today?' }]);
      
      setView('editor');
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  const createNewFile = () => {
    setIsCreatingFile(true);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const createNewFolder = () => {
    setIsCreatingFolder(true);
    setIsCreatingFile(false);
    setNewItemName('');
  };

  const confirmCreateFile = () => {
    if (newItemName) {
      if (files.find(f => f.name === newItemName)) {
        return;
      }
      const newFile: FileItem = {
        name: newItemName,
        language: newItemName.split('.').pop() || 'typescript',
        content: ''
      };
      setFiles(prev => [...prev, newFile]);
      setActiveFile(newFile);
    }
    setIsCreatingFile(false);
    setNewItemName('');
  };

  const confirmCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const confirmRename = (oldName: string) => {
    if (newItemName && newItemName !== oldName) {
      setFiles(prev => prev.map(f => f.name === oldName ? { ...f, name: newItemName } : f));
      if (activeFile.name === oldName) setActiveFile(prev => ({ ...prev, name: newItemName }));
    }
    setRenamingFile(null);
    setNewItemName('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reject files larger than 300MB
    if (file.size > 300 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'system', content: `❌ El archivo **${file.name}** es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). El máximo es 300MB.` }]);
      return;
    }

    if (file.name.endsWith('.zip')) {
      setIsLoading(true);
      setAgentStatus('editing');
      try {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        const extractedFiles: FileItem[] = [];

        // Check for a common root directory
        const entries = Object.entries(loadedZip.files).filter(([path, zipFile]) => !zipFile.dir);
        let commonPrefix = "";
        
        if (entries.length > 0) {
          const firstPath = entries[0][0];
          const pathParts = firstPath.split('/');
          if (pathParts.length > 1) {
            const potentialPrefix = pathParts[0] + '/';
            const allMatch = entries.every(([path]) => path.startsWith(potentialPrefix));
            if (allMatch) commonPrefix = potentialPrefix;
          }
        }

        for (const [path, zipFile] of entries) {
          // Skip system/junk files
          if (
            path.includes('__MACOSX') || 
            path.includes('.DS_Store') || 
            path.includes('.git/') ||
            path.endsWith('/')
          ) continue;

          const content = await zipFile.async('string');
          const cleanName = path.slice(commonPrefix.length);
          if (!cleanName) continue;

          extractedFiles.push({
            name: cleanName,
            language: cleanName.split('.').pop() || 'typescript',
            content: content
          });
        }

        if (extractedFiles.length > 0) {
          setFiles(prev => {
            const newFiles = [...prev];
            extractedFiles.forEach(ef => {
              const idx = newFiles.findIndex(f => f.name === ef.name);
              if (idx !== -1) newFiles[idx] = ef;
              else newFiles.push(ef);
            });
            return newFiles;
          });

          // Pick a meaningful file to activate
          const mainFile = extractedFiles.find(f => 
            f.name === 'App.tsx' || 
            f.name === 'App.js' || 
            f.name === 'index.html' || 
            f.name === 'main.tsx'
          ) || extractedFiles[0];

          setActiveFile(mainFile);
          setMessages(prev => [...prev, { role: 'system', content: `📦 Se han importado **${extractedFiles.length}** archivos del ZIP correctamente.` }]);
        } else {
          setMessages(prev => [...prev, { role: 'system', content: '⚠️ El ZIP parece estar vacío o solo contiene archivos no compatibles.' }]);
        }
      } catch (err) {
        console.error('Error al procesar el ZIP:', err);
        setMessages(prev => [...prev, { role: 'system', content: '❌ Error crítico al procesar el archivo ZIP. Asegúrate de que no esté dañado.' }]);
      } finally {
        setIsLoading(false);
        setAgentStatus('idle');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newFile: FileItem = {
          name: file.name,
          language: file.name.split('.').pop() || 'typescript',
          content: content
        };
        setFiles(prev => {
          if (prev.find(f => f.name === file.name)) {
            return prev.map(f => f.name === file.name ? newFile : f);
          }
          return [...prev, newFile];
        });
        setActiveFile(newFile);
      };
      reader.readAsText(file);
    }
    // Reset input
    event.target.value = '';
  };

  const downloadAsZip = async () => {
    const zip = new JSZip();
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project-aura.zip');
  };

  const createProject = async (name: string, type: Project['type']) => {
    let initialFiles = INITIAL_REACT_FILES;
    if (type === 'expo') initialFiles = INITIAL_EXPO_FILES;
    else if (type === 'basic') initialFiles = INITIAL_BASIC_FILES;
    else if (type === 'fullstack') initialFiles = INITIAL_FULLSTACK_FILES;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, initialFiles })
      });
      const data = await res.json();
      if (data.success) {
        loadProject(data.project);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  // Sync files and messages to backend and localStorage
  useEffect(() => {
    if (!isLoaded || !currentProject) return;
    const syncData = async () => {
      try {
        const totalFilesSize = files.reduce((acc, f) => acc + f.content.length, 0);

        // Sync to Firebase if authenticated - this is fine for 300MB now
        if (fbUser) {
          await saveProjectMetadata(currentProject);
          await syncProjectFiles(currentProject.id, files);
        }

        // Fallback to localStorage - Skip if project > 5MB to avoid crash and disk full
        if (totalFilesSize < 5000000) {
          try {
            const filesJson = JSON.stringify(files);
            const messagesJson = JSON.stringify(messages);
            localStorage.setItem(`aura_messages_${currentProject.id}`, messagesJson);
            localStorage.setItem(`aura_files_${currentProject.id}`, filesJson);
          } catch (e) {
            // ignore localStorage full/blocked errors
          }
        }

        // Backend sync - Skip if > 50MB OR if Firebase handled it efficiently
        if (totalFilesSize > 50000000) {
          if (!fbUser) {
             setMessages(prev => {
                const alreadyWarned = prev.some(m => m.content.includes('⚠️ Tu proyecto es demasiado grande'));
                if (alreadyWarned) return prev;
                return [...prev, { role: 'system', content: '⚠️ Tu proyecto es demasiado grande para el almacenamiento local. Conéctate a Firebase para asegurar que tus 300MB de archivos se guarden correctamente en la nube.' }];
             });
          }
          return;
        }

        let bodyJson = '';
        try {
          bodyJson = JSON.stringify({ 
            projectId: currentProject.id, 
            files,
            messages 
          });
        } catch (e) {
          if (e instanceof Error && (e.message.includes('Invalid string length') || e.name === 'RangeError')) {
            console.error('Project too large to sync via JSON.stringify');
            return;
          }
          throw e;
        }

        await fetch('/api/save-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyJson
        });
      } catch (err) {
        console.error('Failed to sync data:', err);
      }
    };
    
    // Debounce the sync slightly
    const timeoutId = setTimeout(syncData, 1000);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [files, messages, isLoaded, currentProject, fbUser]);

  const handleFileChange = (value: string | undefined) => {
    if (!value) return;
    setFiles(prev => prev.map(f => f.name === activeFile.name ? { ...f, content: value } : f));
    setActiveFile(prev => ({ ...prev, content: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject images larger than 300MB
    if (file.size > 300 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'system', content: `❌ La imagen es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). El máximo es 300MB.` }]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      setSelectedImage({ data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (autoPrompt?: string, retryCount: number = 0, customMessages?: Message[], isHiddenPrompt?: boolean) => {
    if ((!input.trim() && !selectedImage && !autoPrompt) || (isLoading && !autoPrompt)) return;

    const lastImage = selectedImage;
    let currentMessages = customMessages || [...messages];
    
    if (!autoPrompt) {
      const userMessage: Message = { 
        role: 'user', 
        content: input,
        image: selectedImage || undefined,
        isStitch: isStitchMode,
        theme: isStitchMode ? selectedTheme : undefined
      };
      currentMessages.push(userMessage);
      setMessages(currentMessages);
      setInput('');
      setSelectedImage(null);
      setVerificationRetryCount(0);
    } else {
      const systemMessage: Message = { role: 'user', content: autoPrompt, isHidden: isHiddenPrompt };
      currentMessages.push(systemMessage);
      setMessages(currentMessages);
    }

    setIsLoading(true);
    setAgentStatus('thinking');
    setStreamingMessage('');

    let isContinuing = false;

    try {
      const stream = await chatWithAuraStream(
        currentMessages, 
        files, 
        selectedModel, 
        projectType,
        isStitchMode ? `STITCH_MODE: Enabled. Focus on rapid UI prototyping and high-end design. Theme: ${selectedTheme}` : undefined
      );
        
        let fullText = '';
        let hasFunctionCall = false;
        const fileChanges: { type: 'create' | 'edit' | 'delete', file: string }[] = [];

        for await (const chunk of stream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            setAgentStatus('editing');
            hasFunctionCall = true;
            for (const call of chunk.functionCalls) {
              if (call.name === 'write_file') {
                const { name, content, language } = call.args as any;
                setFiles(prev => {
                  const exists = prev.find(f => f.name === name);
                  if (exists) {
                    if (!fileChanges.find(fc => fc.file === name)) {
                      fileChanges.push({ type: 'edit', file: name });
                    }
                    return prev.map(f => f.name === name ? { ...f, content, language } : f);
                  }
                  if (!fileChanges.find(fc => fc.file === name)) {
                    fileChanges.push({ type: 'create', file: name });
                  }
                  return [...prev, { name, content, language }];
                });
                
                if (activeFile.name === name) {
                  setActiveFile({ name, content, language });
                }
              } else if (call.name === 'run_command') {
                const { command } = call.args as any;
                setAgentStatus('thinking');
                try {
                  const res = await fetch('/api/run-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command, projectId: currentProject?.id })
                  });
                  const data = await res.json();
                  fullText += `\n\n[Comando ejecutado: \`${command}\`]\n\`\`\`\n${data.output}\n\`\`\``;
                  setStreamingMessage(fullText);
                } catch (e) {
                  const errorMsg = e instanceof Error ? e.message : String(e);
                  fullText += `\n\n[Error al ejecutar comando \`${command}\`]: ${errorMsg}`;
                  setStreamingMessage(fullText);
                }
              } else if (call.name === 'read_url') {
                const { url } = call.args as any;
                setAgentStatus('thinking');
                try {
                  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
                  const text = await res.text();
                  fullText += `\n\n[Contenido de ${url} leído correctamente]`;
                  setStreamingMessage(fullText);
                } catch (e) {
                  fullText += `\n\n[Error al leer ${url}]`;
                  setStreamingMessage(fullText);
                }
              } else if (call.name === 'save_uploaded_image') {
                const { path: filePath } = call.args as any;
                if (lastImage) {
                  setAgentStatus('editing');
                  try {
                    const res = await fetch('/api/save-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        projectId: currentProject?.id, 
                        path: filePath, 
                        imageData: lastImage.data 
                      })
                    });
                    const data = await res.json();
                    if (data.success) {
                      fullText += `\n\n[Imagen guardada en: \`${filePath}\`]`;
                      setStreamingMessage(fullText);
                      // Add to fileChanges if needed for UI feedback
                    } else {
                        throw new Error(data.error);
                    }
                  } catch (e) {
                    fullText += `\n\n[Error al guardar imagen en \`${filePath}\`]: ${e instanceof Error ? e.message : String(e)}`;
                    setStreamingMessage(fullText);
                  }
                } else {
                  fullText += `\n\n[No se encontró ninguna imagen subida para guardar en \`${filePath}\`]`;
                  setStreamingMessage(fullText);
                }
              }
            }
          }

          if (chunk.text) {
            setAgentStatus('typing');
            fullText += chunk.text;
            setStreamingMessage(fullText);
          }
        }

        const modelResponse: Message = { 
          role: 'model', 
          content: fullText || (hasFunctionCall ? "He actualizado los archivos según lo solicitado." : "COMPLETADO"),
          fileChanges: fileChanges.length > 0 ? fileChanges : undefined,
          isStitch: isStitchMode,
          theme: isStitchMode ? selectedTheme : undefined
        };
        
        const updatedMessages = [...currentMessages, modelResponse];
        setMessages(updatedMessages);

        // Analyze if the message requires automatic continuation
        const contentText = modelResponse.content.trim();
        const openedBlocks = (contentText.match(/```/g) || []).length;
        const isCodeBlockCutOff = openedBlocks % 2 !== 0;
        // Sometimes the AI stops due to output tokens, without ending gracefully.
        const isLengthCutOff = contentText.length >= 3500 && !contentText.endsWith('.') && !contentText.endsWith('!') && !contentText.endsWith('```') && !contentText.endsWith('>');
        
        let needsContinue = false;
        let continueReason = '';
        let continuePrompt = "¿Ya acabaste? Si tu respuesta es sí, responde ÚNICAMENTE con la palabra 'COMPLETADO' (en mayúsculas y sin formato). Si tu respuesta es no, continúa editando o ejecutando herramientas para terminar.";

        if ((isCodeBlockCutOff || isLengthCutOff) && retryCount < 10) {
          needsContinue = true;
          continueReason = 'Detectada respuesta incompleta. Continuando automáticamente...';
          continuePrompt = "Continúa exactamente donde te quedaste, por favor.";
        } else if (!contentText.includes('COMPLETADO') && (hasFunctionCall || retryCount > 0) && retryCount < 10) {
          needsContinue = true;
          continueReason = 'Ejecución parcial. Consultando si la tarea está completa...';
        }

        let finalMessages = updatedMessages;
        let isFinished = false;

        if (contentText.includes('COMPLETADO')) {
           needsContinue = false;
           isFinished = true;
           // Delete the COMPLETADO message from the array to keep UI clean
           setMessages(prev => prev.filter(msg => !msg.content.includes('COMPLETADO')));
           finalMessages = updatedMessages.filter(msg => !msg.content.includes('COMPLETADO'));
        }

        if (needsContinue) {
          isContinuing = true;
          setAgentStatus('thinking');
          setStreamingMessage(continueReason);
          // Auto continue loop until COMPLETADO
          setTimeout(() => handleSendMessage(continuePrompt, retryCount + 1, finalMessages, true), 1500);
          return;
        }

        // Auto-verification logic runs when finally done (isFinished)
        if (isFinished) {
          isContinuing = true;
          setAgentStatus('verifying');
          
          try {
            const res = await fetch('/api/run-command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'npm run lint', projectId: currentProject?.id })
            });
            const data = await res.json();
            
            if (!data.success) {
              // Errors found!
              setAgentStatus('thinking');
              const errorPrompt = `He detectado errores después de los cambios. Por favor, corrígelos:\n\n\`\`\`\n${data.output}\n\`\`\``;
              // Reset retry count when fixing errors to give it more attempts
              setTimeout(() => handleSendMessage(errorPrompt, 0, finalMessages, true), 3000);
              return; 
            } else {
              // Success! No errors. We request the final summary.
              setAgentStatus('thinking');
              setStreamingMessage('Generando resumen final para el usuario...');
              const summaryPrompt = "Dile al usuario la edición que hiciste de forma clara y amigable. Resume los problemas solucionados o los archivos creados/editados. IMPORTANTE: NO uses la palabra 'COMPLETADO' de nuevo.";
              // We pass 10 as retryCount or a special flag so it doesn't trigger the loop again, 
              // but since hasFunctionCall will be false on a normal text reply, it won't loop.
              setTimeout(() => handleSendMessage(summaryPrompt, 0, finalMessages, true), 1500);
              return;
            }
          } catch (e) {
            console.error('Verification failed:', e);
            isContinuing = false; // Need to reset if it fails
          }
        }

      } catch (error: any) {
        console.error(error);
        let errorMessage = error.message || String(error);
        
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = "⚠️ Límite de cuota alcanzado. Por favor, espera un minuto antes de intentarlo de nuevo o revisa tu plan en Google AI Studio.";
        } else if (errorMessage.includes('quota')) {
          errorMessage = "⚠️ Se ha excedido la cuota de la API. Inténtalo de nuevo en unos instantes.";
        } else if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
          errorMessage = "🚫 Acceso denegado (403). Es posible que la clave de API empleada no tenga permisos para usar este modelo en concreto (algunos modelos experimentales requieren acceso anticipado) o tu región no esté soportada. Intenta seleccionar un modelo diferente (como Economy/Flash).";
        }

        setMessages(prev => [...prev, { role: 'system', content: `Error al comunicar con Aura: ${errorMessage}` }]);
      } finally {
        if (!isContinuing) {
          setIsLoading(false);
          setAgentStatus('idle');
          setStreamingMessage('');
        }
      }
  };

  const deleteFile = async (name: string) => {
    if (files.length <= 1) return;
    const newFiles = files.filter(f => f.name !== name);
    setFiles(newFiles);
    if (activeFile.name === name) {
      setActiveFile(newFiles[0]);
    }
    if (currentProject) {
      try {
        await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: currentProject.id, name })
          });
      } catch (err) {
        console.error('Failed to delete file on backend:', err);
      }
    }
  };

  const getPreviewDoc = () => {
    const htmlFile = files.find(f => f.name === 'index.html');
    if (!htmlFile) return `
      <div style="padding: 20px; font-family: sans-serif; color: #666;">
        <h3>No index.html found</h3>
        <p>Aura uses index.html as the entry point for web projects.</p>
      </div>
    `;

    let content = htmlFile.content;
    
    // Safety check for massive projects
    const totalSize = files.reduce((acc, f) => acc + (f.content?.length || 0), 0);
    if (totalSize > 2 * 1024 * 1024) { // 2MB limit for local srcDoc preview
      return `
        <div style="padding: 40px; font-family: sans-serif; text-align: center; color: #333;">
          <h2 style="color: #ef4444;">⚠️ Proyecto demasiado grande</h2>
          <p>Este proyecto excede el límite de previsualización local (2MB).</p>
          <p style="color: #666; font-size: 14px;">Intenta exportarlo a GitHub para verlo en vivo.</p>
        </div>
      `;
    }

    // Remove local link and script tags to prevent 404s, since we inject them inline
    files.forEach(f => {
      if (f.name.endsWith('.css')) {
        const regex = new RegExp(`<link[^>]*href=["']${f.name}["'][^>]*>`, 'gi');
        content = content.replace(regex, '');
      }
      if (f.name.endsWith('.js') || f.name.endsWith('.javascript')) {
        const regex = new RegExp(`<script[^>]*src=["']${f.name}["'][^>]*><\\/script>`, 'gi');
        content = content.replace(regex, '');
      }
    });

    // Inject CSS
    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const styleTags = cssFiles.map(f => `<style>${f.content}</style>`).join('\n');
    content = content.replace('</head>', `${styleTags}\n</head>`);

    // Inject JS
    const jsFiles = files.filter(f => f.name.endsWith('.js') || f.name.endsWith('.javascript'));
    const scriptTags = jsFiles.map(f => `<script>${f.content.replace(/<\/script>/gi, '<\\/script>')}</script>`).join('\n');
    content = content.replace('</body>', `${scriptTags}\n</body>`);

    return content;
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  const getSnackPostHtml = (isEmbedded: boolean = true) => {
    const snackFiles: Record<string, any> = {};
    files.forEach(f => {
      const isImage = f.content.startsWith('data:image/');
      snackFiles[f.name] = {
        type: isImage ? 'ASSET' : 'CODE',
        contents: f.content
      };
    });
    
    // Extract dependencies from package.json if available
    let deps = "expo,expo-status-bar,react,react-native,react-native-web,lucide-react-native";
    const pkgFile = files.find(f => f.name === 'package.json');
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const allDeps = { ...pkg.dependencies };
        deps = Object.keys(allDeps).join(',');
      } catch (e) {}
    }
    
    const action = isEmbedded ? "https://snack.expo.dev/embedded" : "https://snack.expo.dev/";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Loading Expo Snack...</title>
        <style>
          body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; background: #f8fafc; }
          .loader { border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="loader"></div>
        <form id="snack-form" action="${action}" method="POST">
          <input type="hidden" name="platform" value="web" />
          <input type="hidden" name="theme" value="light" />
          <input type="hidden" name="preview" value="true" />
          <input type="hidden" name="dependencies" value="${deps}" />
          ${isEmbedded ? '<input type="hidden" name="hideComponents" value="true" />' : ''}
          <input type="hidden" name="files" value="${escapeHtml(JSON.stringify(snackFiles))}" />
        </form>
        <script>
          document.getElementById('snack-form').submit();
        </script>
      </body>
      </html>
    `;
    return html;
  };

  const getReactNativeWebHtml = () => {
    // Safety check for massive projects
    const totalSize = files.reduce((acc, f) => acc + (f.content?.length || 0), 0);
    if (totalSize > 2 * 1024 * 1024) { // 2MB limit for local srcDoc preview
      return `
        <div style="padding: 40px; font-family: sans-serif; text-align: center; color: #333;">
          <h2 style="color: #ef4444;">⚠️ Proyecto Expo demasiado grande</h2>
          <p>La previsualización local integrada tiene un límite de 2MB.</p>
          <p style="color: #666; font-size: 14px;">Usa el modo "QR Code" para verlo en tu dispositivo real.</p>
        </div>
      `;
    }

    let filesJson = '[]';
    try {
      filesJson = JSON.stringify(files).replace(/</g, '\\u003c');
    } catch (e) {
      return `<div style="padding: 20px; color: red;">Error: No se pudo procesar el contenido del proyecto (demasiado grande).</div>`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>React Native Web Preview</title>
        <style>
          html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          #root { display: flex; flex-direction: column; }
          .error-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.95); color: #ff5555; padding: 30px; font-family: 'JetBrains Mono', monospace; z-index: 9999; overflow: auto; }
          .error-overlay h3 { color: #ff8888; margin-top: 0; font-size: 18px; border-bottom: 1px solid #444; padding-bottom: 10px; }
          .error-overlay pre { white-space: pre-wrap; word-break: break-all; background: #1a1a1a; padding: 20px; border-radius: 12px; border: 1px solid #333; margin-top: 20px; font-size: 13px; line-height: 1.5; }
          .loading-overlay { position: fixed; inset: 0; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; transition: opacity 0.5s; }
          .spinner { width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .status-text { color: #64748b; font-size: 13px; font-weight: 500; }

          /* Vector Icons Support */
          @font-face {
            font-family: 'MaterialIcons';
            src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@9.2.0/Fonts/MaterialIcons.ttf') format('truetype');
          }
          @font-face {
            font-family: 'FontAwesome';
            src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@9.2.0/Fonts/FontAwesome.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Ionicons';
            src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@9.2.0/Fonts/Ionicons.ttf') format('truetype');
          }
          @font-face {
            font-family: 'MaterialCommunityIcons';
            src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@9.2.0/Fonts/MaterialCommunityIcons.ttf') format('truetype');
          }
        </style>
        <script>
          window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('Captured Global Error:', msg, error);
            showError(error || msg, 'Runtime');
            return false;
          };
          window.addEventListener('unhandledrejection', function(event) {
            console.error('Unhandled Promise Rejection:', event.reason);
            showError(event.reason, 'Async/Promise');
          });

          function showError(err, filename) {
            const loading = document.querySelector('.loading-overlay');
            if (loading) loading.style.display = 'none';
            
            const overlay = document.createElement('div');
            overlay.className = 'error-overlay';
            const message = err.message || String(err);
            const stack = err.stack || '';
            overlay.innerHTML = '<h3>Error in ' + filename + '</h3><pre>' + message + '\\n\\n' + stack + '</pre>';
            document.body.appendChild(overlay);
          }
          
          function updateStatus(text) {
            const status = document.querySelector('.status-text');
            if (status) status.textContent = text;
            console.log('[Preview Status]:', text);
          }
        </script>
      </head>
      <body>
        <div id="root"></div>
        <div class="loading-overlay">
          <div class="spinner"></div>
          <div class="status-text">Iniciando Expo Preview...</div>
        </div>

        <script type="module">
          updateStatus('Cargando dependencias React Native Web...');
          
          import * as React from 'https://esm.sh/react@18.2.0';
          import * as ReactDOM from 'https://esm.sh/react-dom@18.2.0';
          import * as ReactDOMClient from 'https://esm.sh/react-dom@18.2.0/client';
          import * as ReactNative from 'https://esm.sh/react-native-web@0.19.12';
          import * as lucide from 'https://esm.sh/lucide-react';
          
          window.React = React;
          window.ReactDOM = ReactDOM;
          window.ReactDOMClient = ReactDOMClient;
          window.ReactNative = ReactNative;
          window.lucide = lucide;
          
          const API_HOST = '${window.location.origin}';
          
          // Babel Helpers Mock
          window._interopRequireDefault = function(obj) {
            return obj && obj.__esModule ? obj : { default: obj };
          };

          window.process = { env: { NODE_ENV: 'development' } };
          const files = ${filesJson};
          
          updateStatus('Transpilando archivos (Babel Server)...');
          for (const file of files) {
            if (file.language === 'javascript' || file.language === 'typescript' || file.name.endsWith('.js') || file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
              try {
                const res = await fetch(API_HOST + '/api/transpile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: file.content, filename: file.name })
                });
                const data = await res.json();
                if (data.success) {
                  file.transpiled = data.code;
                } else {
                  console.warn('Transpilation failed for ' + file.name + ':', data.error);
                }
              } catch (e) {
                console.error('Failed to reach transpiler at ' + API_HOST + ':', e);
              }
            }
          }

          const modules = {};
          
          function customRequire(name) {
            if (name === 'react') return window.React;
            if (name === 'react-dom') return window.ReactDOM;
            if (name === 'react-native' || name === 'react-native-web') return window.ReactNative;
            if (name === 'lucide-react-native' || name === 'lucide-react') return window.lucide;
            if (name === 'expo') return { registerRootComponent: (App) => { window._RootApp = App; } };
            
            // @babel/runtime helpers
            if (name === '@babel/runtime/helpers/interopRequireDefault') {
              return { default: window._interopRequireDefault };
            }

            // Mock common Expo/Native components
            if (name === 'expo-status-bar') {
              return { StatusBar: () => null };
            }
            if (name === 'expo-constants') {
              return { default: { manifest: {}, deviceName: 'Browser', expoVersion: '52.0.0', platform: { web: {} } } };
            }
            if (name === 'expo-font') {
              return { useFonts: () => [true], loadAsync: () => Promise.resolve() };
            }
            if (name === 'expo-asset') {
              return { Asset: { fromModule: (m) => ({ uri: typeof m === 'string' ? m : '' }) } };
            }
            if (name === 'expo-linking') {
              return { openURL: (url) => window.open(url, '_blank'), createURL: () => '/' };
            }
            if (name === 'expo-linear-gradient') {
               const { View } = window.ReactNative;
               return { LinearGradient: ({ colors, children, style }) => React.createElement(View, { style: [{ background: 'linear-gradient(' + colors.join(',') + ')' }, style] }, children) };
            }
            if (name === 'react-native-reanimated') {
              const { View, Text, Image, ScrollView } = window.ReactNative;
              return {
                default: { View, Text, Image, ScrollView },
                useSharedValue: (v) => ({ value: v }),
                useAnimatedStyle: (fn) => fn(),
                withSpring: (v) => v,
                withTiming: (v) => v,
                runOnJS: (fn) => fn,
                FadeIn: { duration: () => ({ delay: () => ({ springify: () => {} }) }) },
                FadeOut: { duration: () => {} }
              };
            }
            if (name === 'react-native-gesture-handler') {
              const { View } = window.ReactNative;
              return {
                GestureHandlerRootView: ({ children, style }) => React.createElement(View, { style: [{ flex: 1 }, style] }, children),
                PanGestureHandler: ({ children }) => children,
                TapGestureHandler: ({ children }) => children,
                State: {}
              };
            }
            if (name === 'react-native-safe-area-context') {
              const { View } = window.ReactNative;
              return {
                SafeAreaProvider: ({ children }) => children,
                SafeAreaView: View,
                useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
              };
            }
            if (name.includes('react-native-vector-icons')) {
              const { Text } = window.ReactNative;
              return {
                default: (props) => React.createElement(Text, { 
                  ...props, 
                  style: [{ fontFamily: name.split('/').pop(), fontSize: props.size || 20, color: props.color || '#000' }, props.style] 
                }, String.fromCharCode(65)) // Mock icon character
              };
            }

            // Handle relative imports with Extension Priority (.web.js/tsx)
            let baseName = name.replace(/^\\.\\//, '').replace(/\\.jsx?$/, '').replace(/\\.tsx?$/, '');
            
            const extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'];
            let file;

            for (const ext of extensions) {
              const testName = baseName + ext;
              file = files.find(f => f.name === testName || f.name === './' + testName);
              if (file) break;
            }

            if (!file) {
              file = files.find(f => {
                let fName = f.name.replace(/\\.jsx?$/, '').replace(/\\.tsx?$/, '');
                return fName === baseName || f.name === baseName;
              });
            }
            
            if (!file) {
              const parts = baseName.split('/');
              const importBaseName = parts[parts.length - 1];
              file = files.find(f => {
                let fBaseName = f.name.split('/').pop().replace(/\\.jsx?$/, '').replace(/\\.tsx?$/, '');
                return fBaseName === importBaseName;
              });
            }
            
            if (file) {
              // Handle assets/images
              if (file.language === 'plaintext' && (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.svg'))) {
                return file.content; // Should be base64 if handled by server
              }

              if (modules[file.name]) return modules[file.name].exports;
              
              const module = { exports: {} };
              modules[file.name] = module;
              
              try {
                updateStatus('Ejecutando ' + file.name + '...');
                const codeToRun = file.transpiled || file.content;
                // Use async function to allow await customRequire
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const fn = new AsyncFunction('require', 'module', 'exports', 'React', 'ReactNative', codeToRun);
                await fn(customRequire, module, module.exports, window.React, window.ReactNative);
                return module.exports;
              } catch (err) {
                console.error('Error executing ' + file.name + ':', err);
                showError(err, file.name);
                throw err;
              }
            }

            // External Libraries via ESM.sh
            if (!name.startsWith('.') && !name.startsWith('/') && !modules[name]) {
              try {
                updateStatus('Buscando librería externa: ' + name + '...');
                const lib = await import('https://esm.sh/' + name);
                return lib;
              } catch (e) {
                console.warn('Library ' + name + ' not found on esm.sh, falling back to mocks.');
              }
            }
            
            throw new Error('Módulo no encontrado: ' + name + '. Aura ha intentado cargarlo desde esm.sh pero no ha tenido éxito.');
          }

          try {
            updateStatus('Iniciando Aplicación...');
            let entryFile = files.find(f => f.name === 'index.js' || f.name === 'index.ts' || f.name === 'AppEntry.js');
            if (!entryFile) entryFile = files.find(f => f.name === 'App.js' || f.name === 'App.tsx');

            if (!entryFile) {
              document.getElementById('root').innerHTML = '<div style="padding: 20px; color: #666; font-family: sans-serif; text-align: center;"><h3>Error de Inicio</h3><p>No se encontró punto de entrada (index.js o App.js)</p></div>';
              document.querySelector('.loading-overlay').style.display = 'none';
            } else {
              await customRequire(entryFile.name);
              const App = window._RootApp || (await customRequire('App.js')); // Fallback
              
              const { AppRegistry } = window.ReactNative;
              AppRegistry.registerComponent('main', () => App.default || App);
              AppRegistry.runApplication('main', {
                initialProps: {},
                rootTag: document.getElementById('root')
              });
              
              setTimeout(() => {
                const loading = document.querySelector('.loading-overlay');
                if (loading) loading.style.opacity = '0';
                setTimeout(() => { if (loading) loading.style.display = 'none'; }, 500);
              }, 100);
            }
          } catch (err) {
            console.error('Bootstrap error:', err);
            showError(err, 'Bootstrap');
          }
        </script>
      </body>
      </html>
    `;
  };

  const openInNewTab = (isExpoGo: boolean = false) => {
    if (projectType === 'expo') {
      const html = isExpoGo ? getSnackPostHtml(false) : getReactNativeWebHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      return;
    }
    const html = getPreviewDoc();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = node.file && activeFile?.name === node.file.name;
      
      if (node.type === 'folder') {
        return (
          <div key={node.path} className="flex flex-col">
            <div 
              onClick={() => toggleFolder(node.path)}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer hover:bg-zinc-100/50 text-zinc-600 transition-all duration-150"
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              <div className="flex items-center justify-center w-4 h-4">
                {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-400" /> : <ChevronRight className="w-3 h-3 text-zinc-400" />}
              </div>
              <Folder className="w-4 h-4 text-indigo-400 fill-indigo-400/10" />
              <span className="text-sm font-medium truncate select-none">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className="flex flex-col">
                {renderTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <div 
          key={node.path}
          onClick={() => node.file && setActiveFile(node.file)}
          className={cn(
            "group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150",
            isSelected 
              ? 'bg-zinc-100 text-zinc-900 border border-zinc-200/50' 
              : 'hover:bg-zinc-50 text-zinc-600'
          )}
          style={{ paddingLeft: `${depth * 12 + 28}px` }}
        >
          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <div className="flex-shrink-0">
              {getFileIcon(node.name)}
            </div>
            {renamingFile === node.path ? (
              <Input 
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="h-6 text-xs py-0 px-1 focus-visible:ring-1 focus-visible:ring-indigo-500"
                onBlur={() => confirmRename(node.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename(node.path);
                  if (e.key === 'Escape') setRenamingFile(null);
                }}
              />
            ) : (
              <span className={cn(
                "text-sm truncate select-none",
                isSelected ? "font-medium" : "font-normal"
              )}>{node.name}</span>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger 
              render={
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-900 transition-all rounded-md"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              }
            />
            <DropdownMenuContent className="bg-white border-zinc-200 text-zinc-800 w-40 shadow-lg" align="end">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-500">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-100" />
              <DropdownMenuItem className="text-xs focus:bg-zinc-100" onClick={() => {
                setRenamingFile(node.path);
                setNewItemName(node.path.split('/').pop() || '');
              }}>
                <Edit2 className="w-3.5 h-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              {node.file && (
                <DropdownMenuItem className="text-xs focus:bg-zinc-100" onClick={() => {
                  const blob = new Blob([node.file!.content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = node.name;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-3.5 h-3.5 mr-2" /> Download
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-100" />
              <DropdownMenuItem 
                className="text-xs text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={() => {
                  setFiles(prev => prev.filter(f => f.name !== node.path));
                  if (activeFile?.name === node.path && files.length > 1) {
                    setActiveFile(files.find(f => f.name !== node.path)!);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    });
  };

  if (view === 'dashboard') {
    return <Dashboard projects={projects} onCreateProject={createProject} onLoadProject={loadProject} />;
  }

  return (
    <TooltipProvider>
      <div className="h-screen w-full bg-white text-zinc-900 font-sans overflow-hidden flex flex-col selection:bg-blue-500/30">
        {/* Header */}
        <header className="h-14 border-b border-zinc-200 flex items-center justify-between px-4 md:px-6 bg-zinc-50 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-8 w-8 text-zinc-500 hover:bg-zinc-200"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <SidebarIcon className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="gap-2 text-zinc-600 hover:text-zinc-900">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Separator orientation="vertical" className="h-6 bg-zinc-200" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-black rounded-xl flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-sm md:text-base tracking-tight text-zinc-900 leading-none truncate max-w-[150px]">{currentProject?.name || 'Aura Studio'}</h1>
                <p className="text-[9px] md:text-[10px] text-zinc-500 font-medium mt-1 uppercase tracking-widest">{projectType} Project</p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-6 bg-zinc-200 hidden md:block" />
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 h-8 px-3">File</Button>
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 h-8 px-3">Edit</Button>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 bg-white rounded-full px-2 md:px-3 py-1 border border-zinc-200 shadow-sm">
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden xs:block">Type</span>
              <Select 
                value={projectType} 
                onValueChange={(v: Project['type']) => {
                  setProjectType(v);
                  let initial = INITIAL_REACT_FILES;
                  if (v === 'expo') initial = INITIAL_EXPO_FILES;
                  else if (v === 'basic') initial = INITIAL_BASIC_FILES;
                  else if (v === 'fullstack') initial = INITIAL_FULLSTACK_FILES;
                  
                  setFiles(initial);
                  setActiveFile(initial[0]);
                  setMessages([{ role: 'model', content: `Switched to ${v} project. What would you like to build?` }]);
                }}
              >
                <SelectTrigger className="h-5 md:h-6 w-[100px] md:w-[130px] text-[9px] md:text-[10px] bg-transparent border-none focus:ring-0 p-0 shadow-none text-zinc-700">
                  <SelectValue placeholder="Project Type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-200 text-zinc-800">
                  <SelectItem value="react" className="text-[10px] focus:bg-zinc-100 focus:text-zinc-900">React / Vite</SelectItem>
                  <SelectItem value="basic" className="text-[10px] focus:bg-zinc-100 focus:text-zinc-900">Basic Web</SelectItem>
                  <SelectItem value="fullstack" className="text-[10px] focus:bg-zinc-100 focus:text-zinc-900">Fullstack</SelectItem>
                  <SelectItem value="expo" className="text-[10px] focus:bg-zinc-100 focus:text-zinc-900">Expo (Mobile)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-full px-2 md:px-3 py-1 border border-zinc-200 shadow-sm">
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden xs:block">Model</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-5 md:h-6 w-[100px] md:w-[130px] text-[9px] md:text-[10px] bg-transparent border-none focus:ring-0 p-0 shadow-none text-zinc-700">
                  <span className="truncate">
                    {MODELS.find(m => m.id === selectedModel)?.name || 'Model'}
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-200 text-zinc-800">
                  {MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id} className="text-[10px] focus:bg-zinc-100 focus:text-zinc-900">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <Tooltip>
                <TooltipTrigger 
                  render={
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 md:h-9 px-3 md:px-4 bg-black hover:bg-zinc-800 text-white border-none shadow-sm transition-all active:scale-95"
                      onClick={() => setPreviewKey(k => k + 1)}
                    >
                      <Play className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2 fill-current" />
                      <span className="hidden md:inline">Deploy</span>
                    </Button>
                  }
                />
                <TooltipContent>Run Application</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex relative overflow-hidden">
          {/* Sidebar - Mobile Overlay */}
          {isMobile && isSidebarOpen && (
            <div 
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <ResizablePanelGroup orientation={isMobile ? "vertical" : "horizontal"} className="flex-1">
            {/* Sidebar */}
            <ResizablePanel 
              defaultSize={18} 
              minSize={isMobile ? 0 : 12} 
              maxSize={25} 
              className={cn(
                "bg-zinc-50 border-r border-zinc-200 transition-all duration-300 z-50",
                isMobile && !isSidebarOpen ? "hidden" : "block",
                isMobile && "absolute inset-y-0 left-0 w-64 shadow-2xl"
              )}
            >
            <div className="flex flex-col h-full bg-[#F9FAFB]">
              <div className="p-4 flex items-center justify-between border-b border-zinc-100 bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-zinc-800">Library</span>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-zinc-600 border-zinc-200 shadow-none bg-zinc-50/50">
                  <List className="w-4 h-4" />
                  <span className="text-xs font-medium">File tree</span>
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {(isCreatingFile || isCreatingFolder) && (
                    <div className="px-3 py-2 bg-white border border-indigo-200 rounded-md shadow-sm mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        {isCreatingFile ? <FilePlus className="w-3.5 h-3.5 text-indigo-500" /> : <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          {isCreatingFile ? 'New File' : 'New Folder'}
                        </span>
                      </div>
                      <Input 
                        autoFocus
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={isCreatingFile ? "filename.tsx" : "folder name"}
                        className="h-7 text-xs mb-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (isCreatingFile) confirmCreateFile();
                            else confirmCreateFolder();
                          }
                          if (e.key === 'Escape') {
                            setIsCreatingFile(false);
                            setIsCreatingFolder(false);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={isCreatingFile ? confirmCreateFile : confirmCreateFolder}>Create</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1" onClick={() => { setIsCreatingFile(false); setIsCreatingFolder(false); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {renderTree(fileTree)}
                </div>
              </ScrollArea>
              
              <div className="p-3 border-t border-zinc-100 bg-white grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[10px] px-1 border-zinc-200 shadow-none hover:bg-zinc-50" onClick={createNewFile}>
                  <FilePlus className="w-3.5 h-3.5 text-zinc-500" />
                  New file
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[10px] px-1 border-zinc-200 shadow-none hover:bg-zinc-50" onClick={createNewFolder}>
                  <FolderPlus className="w-3.5 h-3.5 text-zinc-500" />
                  New folder
                </Button>
                <div className="relative">
                  <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 text-[10px] px-1 border-zinc-200 shadow-none hover:bg-zinc-50" onClick={() => document.getElementById('sidebar-upload')?.click()}>
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    Upload
                  </Button>
                  <input 
                    id="sidebar-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
              
              <div className="px-3 pb-3 bg-white flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-9 gap-2 text-[10px] border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50 shadow-none"
                  onClick={downloadAsZip}
                >
                  <FileArchive className="w-4 h-4" />
                  Download ZIP
                </Button>
                {githubToken ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-9 gap-2 text-[10px] border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-none"
                    onClick={() => {
                      setIsGithubDialogOpen(true);
                      fetchGithubRepos();
                    }}
                  >
                    <Github className="w-4 h-4" />
                    Export to GitHub
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-9 gap-2 text-[10px] border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-none"
                    onClick={handleGithubConnect}
                  >
                    <Github className="w-4 h-4" />
                    Connect GitHub
                  </Button>
                )}
              </div>
              
              <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 space-y-3">
                <FirebaseLogin />
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white border border-zinc-200 shadow-sm relative group">
                  {githubUser ? (
                    <>
                      <img src={githubUser.avatar_url} className="w-8 h-8 rounded-full border border-zinc-200 shadow-sm" alt="Avatar" referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">{githubUser.name || githubUser.login}</p>
                        <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1 font-medium">
                          <Github className="w-2.5 h-2.5" />
                          GitHub Connected
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleGithubDisconnect(); }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Disconnect GitHub"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                        CE
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">Cecilia Elizalde</p>
                        <p className="text-[10px] text-zinc-500 truncate">Free Plan</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className={cn("w-[1px] bg-zinc-200 hover:bg-zinc-300 transition-colors", isMobile && "hidden")} />

          {/* Editor & Preview Area */}
          <ResizablePanel 
            defaultSize={isMobile ? 100 : 52} 
            minSize={isMobile ? 0 : 30}
            className={cn(
              isMobile && activeMobileTab !== 'editor' && activeMobileTab !== 'terminal' ? 'hidden' : 'block',
              isMobile && (activeMobileTab === 'editor' || activeMobileTab === 'terminal') && 'absolute inset-0 z-10 bg-white'
            )}
          >
            <ResizablePanelGroup orientation="vertical">
              {(!isMobile || activeMobileTab === 'editor') && (
                <ResizablePanel defaultSize={isTerminalOpen ? 72 : 100} minSize={20}>
                  <div className="h-full flex flex-col bg-white">
                    <div className="h-11 bg-zinc-50 flex items-center px-4 border-b border-zinc-200 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-t-xl border-t border-x border-zinc-200 text-xs font-medium text-zinc-900 shadow-sm relative top-[1px]">
                          <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                          {activeFile.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-zinc-200 text-zinc-500 font-mono bg-white">
                          {activeFile.language.toUpperCase()}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger 
                            render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 hidden md:flex text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200" 
                                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                              >
                                <SquareTerminal className="w-4 h-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>Toggle Terminal</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="flex-1 relative">
                      {activeFile.content.startsWith('data:image/') ? (
                        <div className="h-full flex items-center justify-center bg-zinc-50 p-8">
                          <div className="max-w-full max-h-full p-4 bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden flex flex-col items-center gap-4">
                            <img src={activeFile.content} className="max-w-full max-h-[70vh] object-contain shadow-sm rounded-lg" alt={activeFile.name} />
                            <p className="text-zinc-500 text-xs font-mono">{activeFile.name}</p>
                          </div>
                        </div>
                      ) : (
                        <Editor
                          height="100%"
                          theme="light"
                          language={activeFile.language}
                          value={activeFile.content}
                          onChange={handleFileChange}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', monospace",
                            lineNumbers: 'on',
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            readOnly: false,
                            automaticLayout: true,
                            padding: { top: 20 },
                            cursorBlinking: 'smooth',
                            smoothScrolling: true,
                            contextmenu: true,
                            renderLineHighlight: 'all',
                            lineHeight: 1.6
                          }}
                        />
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              )}

              {!isMobile && isTerminalOpen && (
                <ResizableHandle className="h-[1px] bg-zinc-200 hover:bg-zinc-300 transition-colors" />
              )}

              {/* Terminal */}
              {((!isMobile && isTerminalOpen) || (isMobile && activeMobileTab === 'terminal')) && (
                <ResizablePanel defaultSize={isMobile ? 100 : 28} minSize={8}>
                  <div className="h-full flex flex-col bg-zinc-950">
                    <div className="h-9 bg-zinc-900 flex items-center px-4 border-b border-zinc-800 justify-between">
                      <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        <TerminalIcon className="w-3.5 h-3.5" />
                        System Console
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 hidden md:flex text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-sm" 
                          onClick={() => setIsTerminalOpen(false)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 relative">
                      <Terminal projectId={currentProject?.id} />
                    </div>
                  </div>
                </ResizablePanel>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className={cn("w-[1px] bg-zinc-200 hover:bg-zinc-300 transition-colors", isMobile && "hidden")} />

          {/* Chat & Preview Sidebar */}
          <ResizablePanel 
            defaultSize={isMobile ? 100 : 30} 
            minSize={isMobile ? 0 : 20}
            className={cn(
              isMobile && activeMobileTab !== 'chat' && activeMobileTab !== 'preview' ? 'hidden' : 'block',
              isMobile && (activeMobileTab === 'chat' || activeMobileTab === 'preview') && 'absolute inset-0 z-10 bg-white'
            )}
          >
            <Tabs 
              value={activeMobileTab} 
              onValueChange={(v) => setActiveMobileTab(v as any)}
              className="h-full flex flex-col bg-zinc-50"
            >
              <div className={cn("px-4 pt-4", isMobile && "hidden")}>
                <TabsList className="w-full bg-zinc-200/50 p-1 rounded-xl h-11">
                  <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm text-xs font-medium transition-all text-zinc-500">
                    <MessageSquare className="w-3.5 h-3.5 mr-2" />
                    Aura Chat
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm text-xs font-medium transition-all text-zinc-500">
                    <Eye className="w-3.5 h-3.5 mr-2" />
                    Live View
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden bg-[#F8F9FA]">
                {/* Mobile Chat Header */}
                {isMobile && (
                  <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-2 bg-white shrink-0">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="text-zinc-500"><ChevronLeft className="w-5 h-5" /></Button>
                      <Button variant="ghost" size="icon" className="text-zinc-500"><History className="w-5 h-5" /></Button>
                    </div>
                    <div className="flex items-center gap-2 font-medium text-zinc-800">
                      <Bot className="w-5 h-5 text-indigo-500" />
                      Agent
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="text-zinc-500"><MessageSquare className="w-5 h-5" /></Button>
                      <Button variant="ghost" size="icon" className="text-zinc-500"><MoreVertical className="w-5 h-5" /></Button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                  <div className="space-y-6 max-w-2xl mx-auto flex flex-col">
                    <AnimatePresence initial={false}>
                      {messages.filter(msg => msg.role !== 'model' || !msg.content.includes('COMPLETADO'))
                               .filter(msg => !msg.isHidden)
                               .map((msg, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex flex-col w-full",
                            msg.role === 'user' ? 'items-end' : 'items-start'
                          )}
                        >
                          {msg.role === 'user' ? (
                            <div className="flex flex-col items-end gap-1 max-w-[85%]">
                              {msg.image && (
                                <div className="mb-2 rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                                  <img 
                                    src={`data:${msg.image.mimeType};base64,${msg.image.data}`} 
                                    alt="User uploaded" 
                                    className="max-h-60 object-contain bg-white"
                                  />
                                </div>
                              )}
                              <div className={cn(
                                "px-4 py-2.5 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed shadow-sm break-words break-all whitespace-pre-wrap min-w-0",
                                msg.isStitch ? "bg-indigo-600 text-white" : "bg-[#E9F0FE] text-[#001D35]"
                              )}>
                                {msg.content}
                              </div>
                              <span className="text-[11px] text-zinc-400 mr-1">Just now</span>
                            </div>
                          ) : (
                            <div className="flex gap-3 w-full max-w-[95%] relative">
                              <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 border border-zinc-200 mt-1 shadow-sm">
                                <Bot className="w-4 h-4 text-zinc-600" />
                              </div>
                              <div className="flex-1 flex flex-col gap-2 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer hover:text-zinc-700">
                                  <Sparkles className={cn("w-4 h-4", msg.isStitch && "text-indigo-600")} />
                                  <span className={cn(msg.isStitch && "font-semibold text-indigo-900")}>
                                    {msg.isStitch ? `Stitch Mode (${msg.theme})` : 'Aura Agent'}
                                  </span>
                                  <ChevronDown className="w-4 h-4 ml-auto" />
                                </div>
                                <div className="text-[15px] text-zinc-800 leading-relaxed prose prose-sm max-w-none prose-zinc break-words">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>

                                {msg.fileChanges && msg.fileChanges.length > 0 && (
                                  <div className="mt-2 border border-zinc-200 rounded-lg bg-white overflow-hidden shadow-sm">
                                    <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-600 flex items-center gap-2">
                                      <Files className="w-3.5 h-3.5" />
                                      Action history
                                    </div>
                                    <div className="p-2 flex flex-col gap-1">
                                      {msg.fileChanges.map((change, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 px-2 py-1.5 rounded-md hover:bg-zinc-50">
                                          {change.type === 'create' ? (
                                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                                          ) : change.type === 'edit' ? (
                                            <Edit2 className="w-3.5 h-3.5 text-green-600" />
                                          ) : (
                                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                          )}
                                          <span>
                                            {change.type === 'create' ? 'Created' : change.type === 'edit' ? 'Edited' : 'Deleted'} {change.file}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                      {isLoading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col w-full items-start"
                        >
                          <div className="flex gap-3 w-full max-w-[95%]">
                            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 border border-zinc-200 mt-1 shadow-sm">
                              <Bot className="w-4 h-4 text-zinc-600" />
                            </div>
                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                              <div className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer hover:text-zinc-700">
                                <Sparkles className="w-4 h-4" />
                                <span>
                                  {agentStatus === 'thinking' ? 'Pensando...' : 
                                   agentStatus === 'editing' ? 'Editando archivos...' : 
                                   agentStatus === 'verifying' ? 'Verificando código...' :
                                   'Escribiendo...'}
                                </span>
                                <ChevronDown className="w-4 h-4 ml-auto" />
                              </div>
                              <div className="text-[15px] text-zinc-800 leading-relaxed prose prose-sm max-w-none prose-zinc break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {streamingMessage}
                                </ReactMarkdown>
                                {agentStatus === 'typing' && <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-400 animate-pulse align-middle" />}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>
                </div>
                
                <div className="p-4 bg-[#F8F9FA]">
                  <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-3 flex flex-col gap-3">
                    {selectedImage && (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-200 group">
                        <img 
                          src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                          className="w-full h-full object-cover"
                        />
                        <button 
                          onClick={() => setSelectedImage(null)}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <input 
                      placeholder="Make, test, iterate..." 
                      className="bg-transparent border-none outline-none text-zinc-800 placeholder:text-zinc-400 text-[15px] w-full"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button 
                          className="text-zinc-500 hover:text-zinc-700 relative"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          <ImageIcon className="w-5 h-5" />
                          <input 
                            id="image-upload"
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                          />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="text-zinc-500 hover:text-zinc-700 outline-none transition-transform active:scale-90">
                            <Plus className="w-5 h-5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 p-2 bg-white border-zinc-200 shadow-xl rounded-xl">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 py-1">
                                Aura Features
                              </DropdownMenuLabel>
                            </DropdownMenuGroup>
                            <div className="flex items-center justify-between px-2 py-2.5 hover:bg-zinc-50 rounded-lg transition-colors cursor-default">
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-zinc-800">Stitch Mode</span>
                                <span className="text-[10px] text-zinc-500">High-end UI prototyping</span>
                              </div>
                              <Switch 
                                checked={isStitchMode} 
                                onCheckedChange={setIsStitchMode}
                                className="scale-75 data-[state=checked]:bg-indigo-600"
                              />
                            </div>
                            
                            {isStitchMode && (
                              <>
                                <DropdownMenuSeparator className="my-1 bg-zinc-100" />
                                <div className="px-2 py-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block">Theme</span>
                                  <div className="grid grid-cols-2 gap-1">
                                    {['modern', 'minimal', 'brutalist', 'playful', 'dark'].map(t => (
                                      <button
                                        key={t}
                                        onClick={() => setSelectedTheme(t)}
                                        className={cn(
                                          "px-2 py-1.5 text-[10px] rounded-md border transition-all capitalize",
                                          selectedTheme === t 
                                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium" 
                                            : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200"
                                        )}
                                      >
                                        {t}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <label className="flex items-center gap-1.5 text-sm text-zinc-500 cursor-pointer">
                          <input type="checkbox" className="rounded border-zinc-300 text-blue-500 focus:ring-blue-500 w-4 h-4" />
                          Plan
                        </label>
                        
                        <div className="flex items-center gap-2 border-l border-zinc-200 pl-3 ml-1">
                          {isStitchMode && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 animate-in fade-in zoom-in duration-200">
                              <span className="text-[9px] font-bold uppercase tracking-wider">Stitch</span>
                              <span className="text-[9px] font-medium opacity-70 capitalize">{selectedTheme}</span>
                            </div>
                          )}
                        </div>

                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger className="h-7 text-xs bg-zinc-100 border-none rounded-md px-2 text-zinc-700 w-auto gap-1 shadow-none">
                            <span className="truncate">
                              {MODELS.find(m => m.id === selectedModel)?.name || 'Model'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <button 
                        className="h-8 w-8 bg-[#2563EB] hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 m-0 bg-white relative overflow-hidden">
                <div className="absolute inset-0 flex flex-col">
                  <div className="h-10 bg-[#F8F9FB] border-b border-slate-200 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1 text-[10px] text-slate-500 font-mono w-full max-w-md truncate">
                      https://aura-preview.local/index.html
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {projectType === 'expo' && (
                        <div className="flex items-center bg-white border border-slate-200 rounded-md p-0.5 mr-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                              "h-6 px-2 text-[9px] font-bold uppercase tracking-wider transition-all",
                              expoPreviewMode === 'web' ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                            onClick={() => setExpoPreviewMode('web')}
                          >
                            Web
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                              "h-6 px-2 text-[9px] font-bold uppercase tracking-wider transition-all",
                              expoPreviewMode === 'qr' ? "bg-[#5F33E1] text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                            onClick={() => setExpoPreviewMode('qr')}
                          >
                            QR
                          </Button>
                        </div>
                      )}
                      {projectType === 'expo' && (
                        <Tooltip>
                          <TooltipTrigger 
                            render={
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                onClick={() => openInNewTab(true)}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                          <TooltipContent>Open in Expo Go (QR Code)</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger 
                          render={
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-slate-400 hover:text-slate-600"
                              onClick={() => openInNewTab(false)}
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>{projectType === 'expo' ? 'Open in Expo Snack' : 'Open in New Tab'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger 
                          render={
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-slate-400 hover:text-slate-600"
                              onClick={() => setPreviewKey(k => k + 1)}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>Reload Preview</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex-1 bg-white">
                    {projectType === 'expo' ? (
                      expoPreviewMode === 'qr' ? (
                        <div className="h-full flex flex-col items-center justify-center bg-white p-6 text-center overflow-y-auto">
                          <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-zinc-100 flex flex-col items-center gap-6 max-w-[340px] w-full animate-in fade-in zoom-in duration-500">
                            <div className="w-14 h-14 bg-[#5F33E1] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-1">
                              <Smartphone className="w-7 h-7 text-white" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Ver en tu Móvil</h3>
                              <p className="text-xs text-zinc-500 leading-relaxed px-4">
                                Escanea este código con la cámara o la app <strong>Expo Go</strong> para probar tu aplicación en tiempo real.
                              </p>
                            </div>
                            
                            <div className="p-4 bg-zinc-50 rounded-2xl border-4 border-white shadow-inner">
                              <QRCodeCanvas 
                                value={`${window.location.origin}/api/expo-snack/${currentProject?.id}`} 
                                size={180}
                                level="H"
                                includeMargin={false}
                              />
                            </div>

                            <div className="w-full pt-4 border-t border-zinc-100 flex flex-col gap-2">
                              <Button 
                                variant="outline"
                                className="w-full border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-xl h-10 text-xs font-semibold transition-all active:scale-95"
                                onClick={() => openInNewTab(true)}
                              >
                                Abrir en Expo Snack
                              </Button>
                              <p className="text-[10px] text-zinc-400 mt-1 font-medium italic">
                                Sincronizando con Snack SDK 50
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-8 flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                            Preview Server Online
                          </div>
                        </div>
                      ) : (
                        <iframe 
                          key={`${previewKey}-${expoPreviewMode}`}
                          title="Aura Expo Preview"
                          className="w-full h-full border-none"
                          srcDoc={getReactNativeWebHtml()}
                          allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
                          sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
                        />
                      )
                    ) : (
                      <iframe 
                        key={previewKey}
                        title="Aura Preview"
                        className="w-full h-full border-none"
                        srcDoc={getPreviewDoc()}
                      />
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <div className="h-14 bg-white border-t border-zinc-200 flex items-center justify-around px-2 shrink-0 pb-[env(safe-area-inset-bottom)] z-50">
            <Button variant="ghost" size="icon" onClick={() => setActiveMobileTab('editor')} className={activeMobileTab === 'editor' ? 'text-blue-600 bg-blue-50' : 'text-zinc-400'}><Code2 className="w-6 h-6" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveMobileTab('terminal')} className={activeMobileTab === 'terminal' ? 'text-blue-600 bg-blue-50' : 'text-zinc-400'}><SquareTerminal className="w-6 h-6" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveMobileTab('chat')} className={activeMobileTab === 'chat' ? 'text-blue-600 bg-blue-50' : 'text-zinc-400'}><Bot className="w-6 h-6" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveMobileTab('preview')} className={activeMobileTab === 'preview' ? 'text-blue-600 bg-blue-50' : 'text-zinc-400'}><Globe className="w-6 h-6" /></Button>
          </div>
        )}

        {/* GitHub Export Dialog */}
        <AnimatePresence>
          {isGithubDialogOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsGithubDialogOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-100 flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
                      <Github className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Export to GitHub</h2>
                      <p className="text-xs text-zinc-500 font-medium">Sync your project with a repository</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsGithubDialogOpen(false)} className="rounded-full hover:bg-zinc-200">
                    <X className="w-5 h-5 text-zinc-400" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {showNewRepoForm ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-1">Repository Name</label>
                        <Input 
                          placeholder="my-awesome-project" 
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                          className="rounded-xl border-zinc-200 focus:ring-black h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-1">Description (Optional)</label>
                        <Input 
                          placeholder="A brief description..." 
                          value={repoDescription}
                          onChange={(e) => setRepoDescription(e.target.value)}
                          className="rounded-xl border-zinc-200 focus:ring-black h-11"
                        />
                      </div>
                      <div className="flex items-center gap-3 px-1">
                        <input 
                          type="checkbox" 
                          id="private-repo" 
                          checked={isPrivateRepo}
                          onChange={(e) => setIsPrivateRepo(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black"
                        />
                        <label htmlFor="private-repo" className="text-sm text-zinc-600 font-medium">Private Repository</label>
                      </div>
                      <div className="pt-2 flex flex-col gap-2">
                        <Button 
                          className="w-full bg-black hover:bg-zinc-800 text-white rounded-xl h-11 font-bold shadow-lg"
                          disabled={!newRepoName || isLoading}
                          onClick={async () => {
                            setIsLoading(true);
                            try {
                              const res = await fetch('/api/github/create-repo', {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `token ${githubToken}`
                                },
                                body: JSON.stringify({ name: newRepoName, description: repoDescription, private: isPrivateRepo })
                              });
                              const data = await res.json();
                              if (data.full_name) {
                                await exportToGithub(data.full_name);
                                setShowNewRepoForm(false);
                                setNewRepoName('');
                                setRepoDescription('');
                              } else {
                                throw new Error(data.message || 'Failed to create repo');
                              }
                            } catch (err: any) {
                              setMessages(prev => [...prev, { role: 'system', content: `❌ Error: ${err.message}` }]);
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create & Export"}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowNewRepoForm(false)} className="text-zinc-500 rounded-xl h-11">Back to list</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Your Repositories</label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-indigo-600 font-bold hover:text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg"
                          onClick={() => setShowNewRepoForm(true)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> New Repo
                        </Button>
                      </div>
                      
                      {isLoadingRepos ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <p className="text-xs font-medium">Fetching repositories...</p>
                        </div>
                      ) : githubRepos.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {githubRepos.map(repo => (
                            <button 
                              key={repo.id}
                              disabled={isLoading}
                              onClick={() => exportToGithub(repo.full_name)}
                              className="group w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/30 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all text-left"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-white border border-zinc-200 rounded-xl flex items-center justify-center shadow-sm shrink-0 group-hover:border-indigo-100 transition-colors">
                                  <Code2 className="w-5 h-5 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-zinc-900 truncate">{repo.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-zinc-400 font-medium">Owner: {repo.owner.login}</span>
                                    {repo.private && <span className="text-[9px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter">Private</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                <ArrowLeft className="w-4 h-4 text-indigo-600 rotate-180" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                          <Github className="w-12 h-12 mb-4 opacity-10" />
                          <p className="text-sm font-medium">No repositories found.</p>
                          <Button variant="link" onClick={() => setShowNewRepoForm(true)} className="text-indigo-600 font-bold mt-1">Create your first one</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                   Connected as {githubUser?.login} • Repo limit: {githubRepos.length}/100
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
