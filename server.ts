import express from "express";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import http from "http";
import fs from "fs";
import * as babel from "@babel/core";

// Tool handlers for the background agent
const handleAgentTools = async (projectId: string, toolCalls: any[]) => {
  const projectDir = path.join(process.cwd(), 'projects', String(projectId));
  const results = [];

  for (const call of toolCalls) {
    const { name, args } = call;
    try {
      if (name === 'write_file') {
        const filePath = path.join(projectDir, args.name);
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, args.content);
        results.push({ name, result: { success: true, message: `File ${args.name} written.` } });
      } else if (name === 'run_command') {
        const envPath = `${path.join(process.cwd(), 'node_modules', '.bin')}:${process.env.PATH}`;
        // For background tasks, we run it synchronously (with a timeout) or just acknowledge
        // Here we'll do a basic sync execution for the agent
        try {
          const { execSync } = await import('child_process');
          const output = execSync(args.command, { 
            cwd: projectDir, 
            env: { ...process.env, PATH: envPath },
            encoding: 'utf-8',
            timeout: 30000 
          });
          results.push({ name, result: { success: true, output } });
        } catch (execErr: any) {
          results.push({ name, result: { success: false, output: execErr.stdout + execErr.stderr, error: execErr.message } });
        }
      }
    } catch (err: any) {
      results.push({ name, result: { success: false, error: err.message } });
    }
  }
  return results;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  const server = http.createServer(app);

  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // Projects directory
  const PROJECTS_DIR = path.join(process.cwd(), 'projects');
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/transpile", async (req, res) => {
    try {
      const { code, filename } = req.body;
      if (!code) return res.status(400).json({ error: 'Missing code' });

      let actualFilename = filename || 'file.tsx';
      const tmpDir = path.join(process.cwd(), '.tmp-transpile');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      actualFilename = path.join(tmpDir, actualFilename.replace(/\//g, '_'));
      fs.writeFileSync(actualFilename, code);

      const isReactWeb = req.body.projectType === 'react' || req.body.projectType === 'fullstack';
      
      const presets = isReactWeb ? [
        ['@babel/preset-env', { modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'classic' }],
        '@babel/preset-typescript'
      ] : [
        'babel-preset-expo'
      ];

      const plugins = isReactWeb ? [] : [
        'react-native-reanimated/plugin'
      ];

      const result = await babel.transformAsync(code, {
        filename: actualFilename,
        presets,
        plugins,
        caller: { name: 'aura-studio' },
        configFile: false,
        babelrc: false
      });

      // Cleanup
      if (fs.existsSync(actualFilename)) fs.unlinkSync(actualFilename);

      res.json({ success: true, code: result?.code });
    } catch (e: any) {
      console.error('Babel transpile error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/projects", (req, res) => {
    try {
      const projects: any[] = [];
      if (fs.existsSync(PROJECTS_DIR)) {
        const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory()) {
            const metaPath = path.join(PROJECTS_DIR, d.name, 'meta.json');
            if (fs.existsSync(metaPath)) {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              projects.push(meta);
            } else {
              projects.push({ id: d.name, name: d.name, type: 'web', updatedAt: Date.now() });
            }
          }
        }
      }
      res.json({ success: true, projects: projects.sort((a,b) => b.updatedAt - a.updatedAt) });
    } catch (e) {
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { name, type, initialFiles } = req.body;
      const id = Date.now().toString() + Math.random().toString(36).substring(7);
      const projectDir = path.join(PROJECTS_DIR, id);
      fs.mkdirSync(projectDir, { recursive: true });

      const meta = { id, name, type, updatedAt: Date.now() };
      fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta));

      if (initialFiles && Array.isArray(initialFiles)) {
        initialFiles.forEach(f => {
          const filePath = path.join(projectDir, f.name);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, f.content);
        });
      }

      res.json({ success: true, project: meta });
    } catch (e) {
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  app.get("/api/load-files", (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ success: false, error: 'Missing projectId' });
      
      const projectDir = path.join(PROJECTS_DIR, String(projectId));
      const files: any[] = [];
      let messages: any[] = [];

      const messagesPath = path.join(projectDir, 'messages.json');
      if (fs.existsSync(messagesPath)) {
        try {
          messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
        } catch (e) {
          console.error('Error parsing messages.json:', e);
        }
      }
      
      const readDirRecursive = (dir: string, baseDir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'meta.json' || entry.name === 'messages.json') continue;
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          
          if (entry.isDirectory()) {
            readDirRecursive(fullPath, baseDir);
          } else {
            const ext = path.extname(entry.name).substring(1).toLowerCase();
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
            
            let content: string;
            if (isImage) {
              const buffer = fs.readFileSync(fullPath);
              const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
              content = `data:${mimeType};base64,${buffer.toString('base64')}`;
            } else {
              content = fs.readFileSync(fullPath, 'utf-8');
            }

            const language = ext === 'js' || ext === 'jsx' ? 'javascript' : 
                             ext === 'ts' || ext === 'tsx' ? 'typescript' : 
                             ext === 'json' ? 'json' : 
                             ext === 'css' ? 'css' : 
                             ext === 'html' ? 'html' : 'plaintext';
            files.push({ name: relativePath, content, language });
          }
        }
      };
      
      readDirRecursive(projectDir, projectDir);
      res.json({ success: true, files, messages });
    } catch (error) {
      console.error('Error loading files:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/save-files", (req, res) => {
    try {
      const { projectId, files, messages } = req.body;
      if (!projectId) return res.status(400).json({ success: false, error: 'Missing projectId' });
      
      const projectDir = path.join(PROJECTS_DIR, String(projectId));
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

      if (messages && Array.isArray(messages)) {
        fs.writeFileSync(path.join(projectDir, 'messages.json'), JSON.stringify(messages));
      }

      if (Array.isArray(files)) {
        files.forEach((f: any) => {
          if (f.name && f.content !== undefined) {
            const filePath = path.join(projectDir, f.name);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            if (typeof f.content === 'string' && f.content.startsWith('data:image/')) {
              const base64Data = f.content.replace(/^data:image\/\w+;base64,/, "");
              fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            } else {
              fs.writeFileSync(filePath, f.content);
            }
          }
        });
      }
      
      const metaPath = path.join(projectDir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.updatedAt = Date.now();
        fs.writeFileSync(metaPath, JSON.stringify(meta));
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error saving files:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/save-image", (req, res) => {
    try {
      const { projectId, path: filePath, imageData } = req.body;
      if (!projectId || !filePath || !imageData) return res.status(400).json({ success: false, error: 'Missing parameters' });
      
      const projectDir = path.join(PROJECTS_DIR, String(projectId));
      const fullPath = path.join(projectDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));

      res.json({ success: true });
    } catch (error) {
      console.error('Error saving image:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/delete-file", (req, res) => {
    try {
      const { projectId, name } = req.body;
      if (!projectId || !name) return res.status(400).json({ success: false, error: 'Missing projectId or name' });
      
      const filePath = path.join(PROJECTS_DIR, String(projectId), name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/expo-snack/:projectId", (req, res) => {
    try {
      const { projectId } = req.params;
      const projectDir = path.join(PROJECTS_DIR, String(projectId));
      if (!fs.existsSync(projectDir)) {
        return res.status(404).send('Project not found');
      }

      const files: any[] = [];
      const readDirRecursive = (dir: string, baseDir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          // Skip unwanted directories and files
          if (entry.name === 'meta.json' || entry.name === 'messages.json' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          
          if (entry.isDirectory()) {
            readDirRecursive(fullPath, baseDir);
          } else {
            const ext = path.extname(entry.name).substring(1).toLowerCase();
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
            let content: string;
            
            if (isImage) {
              const buffer = fs.readFileSync(fullPath);
              const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
              content = `data:${mimeType};base64,${buffer.toString('base64')}`;
            } else {
              content = fs.readFileSync(fullPath, 'utf-8');
            }
            files.push({ name: relativePath, content });
          }
        }
      };
      readDirRecursive(projectDir, projectDir);

      const snackFiles: Record<string, any> = {};
      files.forEach(f => {
        const ext = path.extname(f.name).substring(1).toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
        const isSvg = ext === 'svg';
        
        if (isImage) {
          snackFiles[f.name] = {
            type: 'ASSET',
            contents: f.content
          };
        } else if (isSvg) {
          // SVGs can be CODE or ASSET, but Snack handles them better as CODE in some cases
          snackFiles[f.name] = {
            type: 'CODE',
            contents: f.content
          };
        } else {
          snackFiles[f.name] = {
            type: 'CODE',
            contents: f.content
          };
        }
      });

      // Default dependencies for a standard Expo project
      const defaultDeps = {
        "expo": "~52.0.0",
        "expo-status-bar": "~2.0.0",
        "react": "18.3.1",
        "react-native": "0.76.0",
        "react-native-web": "~0.19.13",
        "lucide-react-native": "*"
      };

      let finalDeps = { ...defaultDeps };
      const pkgFile = files.find(f => f.name === 'package.json');
      if (pkgFile) {
        try {
          const pkg = JSON.parse(pkgFile.content);
          if (pkg.dependencies) {
            finalDeps = { ...finalDeps, ...pkg.dependencies };
          }
        } catch (e) {}
      }

      const escapeHtml = (unsafe: string) => {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Aura - Expo Preview</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              background: #F8F9FB;
              color: #1F2937;
            }
            .content {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 24px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
              max-width: 400px;
              width: 90%;
            }
            .loader { 
              border: 3px solid #E5E7EB; 
              border-top: 3px solid #5F33E1; 
              border-radius: 50%; 
              width: 40px; 
              height: 40px; 
              animation: spin 1s linear infinite; 
              margin: 0 auto 24px; 
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h2 { margin: 0 0 12px 0; font-size: 20px; color: #111827; }
            p { margin: 0 0 24px 0; color: #6B7280; font-size: 14px; line-height: 1.5; }
            button {
              background: #5F33E1;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s;
            }
            button:hover {
              background: #4C28B5;
              transform: translateY(-1px);
            }
          </style>
        </head>
        <body>
          <div class="content">
            <div class="loader"></div>
            <h2>Conectando con Expo Snack</h2>
            <p>Estamos preparando tu aplicación para que puedas verla en tu dispositivo. Esto tardará solo un momento.</p>
            
            <form id="snack-form" action="https://snack.expo.dev/" method="POST" style="display: none;">
              <input type="hidden" name="platform" value="mydevice" />
              <input type="hidden" name="theme" value="light" />
              <input type="hidden" name="preview" value="true" />
              <input type="hidden" name="dependencies" value="${Object.keys(finalDeps).join(',')}" />
              <input type="hidden" name="files" value="${escapeHtml(JSON.stringify(snackFiles))}" />
            </form>
            
            <button onclick="document.getElementById('snack-form').submit()">Reintentar manualmente</button>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('snack-form').submit();
            }, 500);
          </script>
        </body>
        </html>
      `;
      res.send(html);
    } catch (e) {
      console.error('Error generating snack:', e);
      res.status(500).send('Error generating snack: ' + e);
    }
  });

  app.post("/api/run-command", (req, res) => {
    try {
      const { command, projectId } = req.body;
      if (!command) return res.status(400).json({ success: false, error: 'Missing command' });
      
      const cwd = projectId ? path.join(PROJECTS_DIR, String(projectId)) : process.cwd();
      if (projectId && !fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

      // Add node_modules/.bin to PATH
      const envPath = `${path.join(process.cwd(), 'node_modules', '.bin')}:${process.env.PATH}`;

      const child = spawn('bash', ['-c', command], {
        cwd,
        env: { ...process.env, PATH: envPath }
      });

      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.stderr.on('data', (data) => { output += data.toString(); });

      let responded = false;
      
      child.on('error', (err) => {
        if (!responded) {
          responded = true;
          res.json({ success: false, output: output + '\\n[Error]: ' + err.message, code: -1 });
        }
      });

      const timeoutId = setTimeout(() => {
        if (responded) return;
        responded = true;
        if (!child.killed) {
          child.kill();
        }
        res.json({ success: false, output: output + '\n[Command timed out]', code: 124 });
      }, 30000);

      child.on('close', (code) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeoutId);
        
        // Truncate output if it's too large (over 50KB) to prevent UI lag/response cutoffs
        let finalOutput = output;
        const MAX_OUTPUT = 50000;
        if (finalOutput.length > MAX_OUTPUT) {
          finalOutput = finalOutput.substring(0, MAX_OUTPUT) + '\n\n[... Output truncated due to size ...]';
        }
        
        res.json({ success: code === 0, output: finalOutput, code });
      });

    } catch (e) {
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "Missing url" });
      
      const response = await fetch(String(url));
      const text = await response.text();
      res.send(text);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // --- GitHub OAuth & API ---
  app.get("/api/auth/github/url", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
    }
    
    // Get base URL from environment or request
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/github/callback`;
    
    console.log('Generating GitHub Auth URL with redirect:', redirectUri);
    
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;
    res.json({ url });
  });

  app.get("/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    console.log('Received GitHub OAuth code, exchanging for token...');

    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured in secrets.");
      }

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/github/callback`;

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        })
      });

      const responseText = await tokenResponse.text();
      let tokenData: any;
      try {
        tokenData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse GitHub response as JSON. Body:', responseText);
        throw new Error(`GitHub returned non-JSON response: ${responseText.substring(0, 100)}...`);
      }

      if (tokenData.error) {
        console.error('GitHub Token Exchange Error:', tokenData.error_description || tokenData.error);
        return res.status(400).send(`Error de GitHub: ${tokenData.error_description || tokenData.error}`);
      }

      const token = tokenData.access_token;
      
      // Get user info to show in popup
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { 
          Authorization: `token ${token}`,
          "User-Agent": "Aura-Studio",
          "Accept": "application/json"
        }
      });
      
      const userText = await userResponse.text();
      let userData: any;
      try {
        userData = JSON.parse(userText);
      } catch (e) {
        console.error('Failed to parse GitHub user response as JSON. Body:', userText);
        throw new Error(`GitHub user API returned non-JSON response: ${userText.substring(0, 100)}...`);
      }

      if (!userResponse.ok) {
        console.error('GitHub User API Error:', userData.message || userText);
        throw new Error(`GitHub User API returned ${userResponse.status}: ${userData.message || 'Unknown error'}`);
      }

      res.send(`
        <html>
          <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#F8F9FB; color:#1F2937;">
            <div style="background:white; padding:40px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.05); text-align:center;">
              <h2 style="margin:0 0 10px 0;">¡Conectado!</h2>
              <p style="color:#6B7280; margin-bottom:20px;">Hola, ${userData.name || userData.login}. Ya puedes cerrar esta ventana.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify(userData)} }, '*');
                  setTimeout(() => window.close(), 1500);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      res.status(500).send("Error during GitHub auth: " + String(e));
    }
  });

  app.get("/api/github/repos", async (req, res) => {
    const token = req.headers.authorization?.replace("token ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: { 
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Aura-Studio"
        }
      });
      const repos = await response.json();
      res.json(repos);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/github/create-repo", async (req, res) => {
    const token = req.headers.authorization?.replace("token ", "");
    const { name, description, private: isPrivate } = req.body;
    
    if (!token || !name) return res.status(400).json({ error: "Missing parameters" });

    try {
      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { 
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Aura-Studio"
        },
        body: JSON.stringify({
          name,
          description: description || "Created with Aura Studio",
          private: isPrivate !== false, // default to private
          auto_init: true // create an initial commit with a README
        })
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || "Failed to create repo" });
      }
      res.json(data);
    } catch (e) {
      console.error('Create Repo error:', e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/github/export", async (req, res) => {
    const token = req.headers.authorization?.replace("token ", "");
    const { repoFullName, files, commitMessage } = req.body;
    
    if (!token || !repoFullName || !files) return res.status(400).json({ error: "Missing parameters" });

    try {
      const headers = {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Aura-Studio"
      };

      // 1. Get default branch
      const repoInfoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
      const repoInfo: any = await repoInfoResponse.json();
      const branch = repoInfo.default_branch || 'main';

      // 2. Get the latest commit SHA of the default branch
      const branchResponse = await fetch(`https://api.github.com/repos/${repoFullName}/branches/${branch}`, { headers });
      const branchData: any = await branchResponse.json();
      const baseTreeSha = branchData.commit.commit.tree.sha;
      const parentCommitSha = branchData.commit.sha;

      // 3. Create tree
      const tree = files.map((f: any) => ({
        path: f.name,
        mode: '100644',
        type: 'blob',
        content: f.content
      }));

      const treeResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: tree
        })
      });
      const treeData: any = await treeResponse.json();
      const newTreeSha = treeData.sha;

      // 4. Create commit
      const commitResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: commitMessage || "Update from Aura Studio",
          tree: newTreeSha,
          parents: [parentCommitSha]
        })
      });
      const commitData: any = await commitResponse.json();
      const newCommitSha = commitData.sha;

      // 5. Update ref
      const refResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitSha
        })
      });
      const refData: any = await refResponse.json();

      res.json({ success: true, sha: newCommitSha });
    } catch (e) {
      console.error('GitHub Export Error:', e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/github/import", async (req, res) => {
    const token = req.headers.authorization?.replace("token ", "");
    const { repoFullName } = req.body;
    if (!token || !repoFullName) return res.status(400).json({ error: "Missing parameters" });

    try {
      const { default: JSZip } = await import('jszip');
      
      const headers = {
        Authorization: `token ${token}`,
        "User-Agent": "Aura-Studio"
      };

      // 1. Get default branch
      const repoInfoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
      const repoInfo: any = await repoInfoResponse.json();
      const branch = repoInfo.default_branch || 'main';

      // 2. Fetch zipball
      const zipResponse = await fetch(`https://api.github.com/repos/${repoFullName}/zipball/${branch}`, { headers });
      if (!zipResponse.ok) throw new Error(`Github API returned ${zipResponse.status}`);
      
      const arrayBuffer = await zipResponse.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // 3. Create project
      const id = Date.now().toString() + Math.random().toString(36).substring(7);
      const projectDir = path.join(PROJECTS_DIR, id);
      fs.mkdirSync(projectDir, { recursive: true });

      const meta = { 
        id, 
        name: repoFullName.split('/')[1], 
        type: 'web', // Default to web, can be adjusted later
        updatedAt: Date.now(),
        githubRepo: repoFullName
      };
      
      // Save files from zip
      const entries = Object.keys(zip.files);
      if (entries.length === 0) throw new Error("Empty zipball");

      // The zipball has a root directory like owner-repo-sha/
      const rootDir = entries[0].split('/')[0] + '/';

      for (const entryPath of entries) {
        const file = zip.files[entryPath];
        if (file.dir) continue;

        // Skip root dir prefix
        const relativePath = entryPath.startsWith(rootDir) ? entryPath.substring(rootDir.length) : entryPath;
        if (!relativePath) continue;

        const content = await file.async("nodebuffer");
        const fullPath = path.join(projectDir, relativePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
      }

      // Check if it looks like an Expo project
      if (fs.existsSync(path.join(projectDir, 'app.json')) || fs.existsSync(path.join(projectDir, 'expo'))) {
        meta.type = 'expo';
      } else if (fs.existsSync(path.join(projectDir, 'server.ts')) || fs.existsSync(path.join(projectDir, 'server.js'))) {
        meta.type = 'fullstack';
      }

      fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta));
      res.json({ success: true, project: meta });
    } catch (e) {
      console.error('GitHub Import Error:', e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/github/create-repo", async (req, res) => {
    const token = req.headers.authorization?.replace("token ", "");
    const { name, description, private: isPrivate } = req.body;
    if (!token || !name) return res.status(400).json({ error: "Missing parameters" });

    try {
      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Aura-Studio"
        },
        body: JSON.stringify({ name, description, private: isPrivate, auto_init: true })
      });
      const repo = await response.json();
      if (repo.errors) return res.status(400).json(repo);
      res.json(repo);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Socket.IO Server for Terminal
  const io = new SocketIOServer(server, {
    path: '/terminal-socket',
    cors: { origin: '*' },
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('Terminal connected via Socket.IO');
    
    // Terminal Logic
    const projectId = socket.handshake.query.projectId;
    const cwd = projectId ? path.join(PROJECTS_DIR, String(projectId)) : process.cwd();
    if (projectId && !fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
    
    const shell = 'script';
    const args = ['-q', '-e', '-c', 'bash -i', '/dev/null'];
    
    // Add node_modules/.bin to PATH so 'eas' command works
    const envPath = `${path.join(process.cwd(), 'node_modules', '.bin')}:${process.env.PATH}`;
    
    const ptyProcess = spawn(shell, args, {
      env: { 
        ...process.env, 
        TERM: 'xterm-256color', 
        PATH: envPath,
        FORCE_COLOR: '1'
      },
      cwd: cwd,
    });

    ptyProcess.on('error', (err) => {
      console.error('Failed to start subprocess.', err);
      socket.emit('data', `\r\n\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
    });

    ptyProcess.stdout.on('data', (data) => {
      socket.emit('data', data.toString());
    });

    ptyProcess.stderr.on('data', (data) => {
      socket.emit('data', data.toString());
    });

    socket.on('data', (msg) => {
      ptyProcess.stdin.write(msg.toString());
    });

    socket.on('disconnect', () => {
      ptyProcess.kill();
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
