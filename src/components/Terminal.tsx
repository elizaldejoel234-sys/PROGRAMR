import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

interface Props {
  projectId?: string;
}

export default function Terminal({ projectId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#18181b', // zinc-900
        foreground: '#f4f4f5', // zinc-100
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);

    // Monkey-patch _renderService to prevent 'dimensions' error on dispose
    // xterm.js leaks a requestAnimationFrame in Viewport that accesses dimensions
    // after the terminal is disposed, causing an Uncaught TypeError.
    const core = (term as any)._core;
    if (core && core._renderService) {
      const renderService = core._renderService;
      const originalGetDimensions = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(renderService), 'dimensions')?.get;
      
      if (originalGetDimensions) {
        Object.defineProperty(renderService, 'dimensions', {
          get: function() {
            if (!this._renderer || !this._renderer.value) {
              return {
                css: { canvas: { width: 0, height: 0 }, cell: { width: 0, height: 0 } },
                device: { canvas: { width: 0, height: 0 }, cell: { width: 0, height: 0 }, char: { width: 0, height: 0, left: 0, top: 0 } }
              };
            }
            return originalGetDimensions.call(this);
          }
        });
      }
    }

    // Initial fit with a slight delay to ensure DOM is ready
    const fitTimeout = setTimeout(() => {
      try {
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0) {
          // Check if core and renderService exist to prevent dimensions error
          if ((term as any)._core && (term as any)._core._renderService && (term as any)._core._renderService.dimensions) {
            fitAddon.fit();
          }
        }
      } catch (e) {
        console.warn('Initial fit failed', e);
      }
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect Socket.IO
    const socket = io(window.location.origin, {
      path: '/terminal-socket',
      transports: ['websocket', 'polling'],
      query: projectId ? { projectId } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      term.writeln('Connected to terminal...');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO error:', error);
      term.writeln('\r\n\x1b[31mTerminal connection error. Check console for details.\x1b[0m');
    });

    socket.on('data', (data) => {
      term.write(data);
    });

    socket.on('disconnect', () => {
      term.writeln('\nTerminal disconnected.');
    });

    // Handle terminal input
    term.onData((data) => {
      if (socket.connected) {
        socket.emit('data', data);
      }
    });

    // Handle resize using ResizeObserver for better panel resize detection
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0) {
          if ((term as any)._core && (term as any)._core._renderService && (term as any)._core._renderService.dimensions) {
            fitAddon.fit();
          }
        }
      } catch (e) {
        console.warn('Fit failed during resize', e);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      clearTimeout(fitTimeout);
      resizeObserver.disconnect();
      socket.disconnect();
      term.dispose();
    };
  }, [projectId]);

  return (
    <div className="w-full h-full bg-zinc-900 p-2 overflow-hidden">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
