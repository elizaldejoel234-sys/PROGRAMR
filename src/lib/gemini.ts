import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];
import { FileItem, Project } from "../types";

console.log("API Key present:", !!process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getSystemPrompt = (projectType: Project['type']) => {
  const basePrompt = `You are Aura, an advanced AI software engineer and product designer. 
You have access to a virtual file system. You can read and write files.
When the user asks you to create or edit code, use the 'write_file' tool.
You also have access to 'googleSearch' for real-time information and 'read_url' to fetch content from specific websites.
You can save images provided by the user in the chat using the 'save_uploaded_image' tool.
Always provide the FULL content of the file when using 'write_file'.

CRITICAL INSTRUCTION: When a user asks you to build or modify something, you MUST complete the ENTIRE task in one go. Do NOT stop halfway. Do NOT ask "Should I continue?" or "Would you like me to do the next part?". Use the 'write_file' tool as many times as necessary to finish the complete request before you finish your response.

DESIGN PHILOSOPHY:
- Craftsmanship over Defaults: Never use generic purple/blue gradients or default shadows.
- Intentional Variation: Create rhythm through variation in padding, margins, and font usage.
- Mood First: Decide the mood (bold, minimal, warm, technical, playful) and let that drive every decision.
- Purposeful Animation: Use transitions and micro-animations to reinforce hierarchy.

STITCH MODE CAPABILITIES:
- Rapid UI Prototyping: Generate high-fidelity UI components quickly.
- Visual Ideation: Act as a creative partner for design exploration.
- Design-to-Code: Convert visual descriptions or images into polished code.

STITCH MODE THEMES:
- Modern: Clean, high-contrast, using Inter or similar sans-serif fonts. Focus on clarity and professional feel.
- Minimal: Extreme simplicity, lots of whitespace, subtle borders, monochromatic or very limited palette.
- Brutalist: Bold, raw, experimental. Large typography, unconventional layouts, high-impact colors.
- Playful: Rounded corners, vibrant colors, friendly typography, micro-interactions, and soft shadows.
- Dark: Sophisticated dark theme using deep grays (not pure black), glowing accents, and high legibility.

If you are creating a new feature or project, DO NOT just put everything in one file. Create multiple files for better structure and flexibility (e.g., separate HTML, CSS, JS files, or separate components).
Always explain what you are doing in your text response. Even if you use tools, finish your response with a summary of what was accomplished to ensure the user knows you have finished the task.`;

  if (projectType === 'expo') {
    return `${basePrompt}
Current project context: A React Native application using Expo.
You should write React Native code. The main entry point is 'App.js'.
Create separate files for components, styles, or utilities to keep the code modular.
Use standard React Native components (View, Text, StyleSheet, etc.).
Do not use HTML tags like <div> or <p>.

APP ICONS:
If the user provides an image and asks to set it as the app icon:
1. Use the 'save_uploaded_image' tool with path 'assets/icon.png'.
2. Ensure 'app.json' reflects this path in the "icon" property.`;
  }

  if (projectType === 'react') {
    return `${basePrompt}
Current project context: A modern React application using Vite and TypeScript.
You should use React components (Functional components with hooks). 
Tailwind CSS is used for styling.
The main entry point is 'src/main.tsx' and the root component is 'src/App.tsx'.`;
  }

  if (projectType === 'fullstack') {
    return `${basePrompt}
Current project context: A full-stack application with an Express server and a React frontend.
The server entry point is 'server.ts'. 
The frontend is in 'src/' and entry point is 'src/main.tsx'.
You can add API routes in 'server.ts' and call them from the React app.`;
  }

  return `${basePrompt}
Current project context: A basic web application (HTML, CSS, JS).
You should prefer using Tailwind CSS via CDN in index.html for styling, but also create separate JavaScript files (e.g., script.js) and CSS files (e.g., styles.css) for better organization.
The main entry point is 'index.html'.`;
};

export const write_file_tool = {
  name: "write_file",
  description: "Create or update a file in the virtual file system.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "The name of the file (e.g., 'index.html', 'styles.css', 'App.js').",
      },
      content: {
        type: Type.STRING,
        description: "The full content of the file.",
      },
      language: {
        type: Type.STRING,
        description: "The programming language (e.g., 'html', 'css', 'javascript').",
      },
    },
    required: ["name", "content", "language"],
  },
};

export const read_url_tool = {
  name: "read_url",
  description: "Read the content of a URL to get information from the web.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The URL to read.",
      },
    },
    required: ["url"],
  },
};

export const run_command_tool = {
  name: "run_command",
  description: "Execute a terminal command in the project directory (e.g., npm install, ls, grep). This is a real terminal execution.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "The shell command to execute.",
      },
    },
    required: ["command"],
  },
};

export const save_uploaded_image_tool = {
  name: "save_uploaded_image",
  description: "Saves the image currently provided by the user in the chat session to a specific path in the project assets. Useful for icons, splash screens, or background images.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "The destination path where the image should be saved (e.g., 'assets/icon.png').",
      },
    },
    required: ["path"],
  },
};

const formatMessagesForGemini = (messages: any[]) => {
  return messages.map(msg => {
    const parts: any[] = [{ text: msg.content }];
    
    if (msg.image) {
      parts.push({
        inlineData: {
          data: msg.image.data,
          mimeType: msg.image.mimeType
        }
      });
    }
    
    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts
    };
  });
};

const mapModelId = (modelId: string) => {
  // Map requested models precisely to currently valid API versions
  if (modelId.includes('3.1-pro')) return 'gemini-3.1-pro-preview';
  if (modelId.includes('3-pro')) return 'gemini-3.1-pro-preview';
  if (modelId.includes('3.1-flash')) return 'gemini-3.1-flash-lite-preview';
  if (modelId.includes('3-flash')) return 'gemini-3-flash-preview';
  if (modelId.includes('2.0-flash')) return 'gemini-3-flash-preview';
  if (modelId.includes('1.5-flash')) return 'gemini-3-flash-preview';
  if (modelId.includes('1.5-pro')) return 'gemini-3.1-pro-preview';
  return modelId;
};

export async function chatWithAuraStream(messages: any[], files: FileItem[], model: string = "gemini-3-flash-preview", projectType: Project['type'] = 'react', extraInstruction?: string) {
  // Limit context size to prevent response truncation or token limits
  const MAX_FILE_SIZE_FOR_CONTEXT = 50000; // 50KB per file in context
  const fileContext = files
    .filter(f => !f.content.startsWith('data:image/')) // Don't send images as text context
    .map(f => {
      let content = f.content;
      if (content.length > MAX_FILE_SIZE_FOR_CONTEXT) {
        content = content.substring(0, MAX_FILE_SIZE_FOR_CONTEXT) + "\n\n[... File truncated due to size ...]";
      }
      return `File: ${f.name}\nContent:\n${content}`;
    })
    .join("\n\n");
    
  const formattedMessages = formatMessagesForGemini(messages);
  const actualModel = mapModelId(model);
  
  const systemPrompt = `${getSystemPrompt(projectType)}${extraInstruction ? `\n\n${extraInstruction}` : ''}\n\nCURRENT FILES:\n${fileContext}`;
  
  const stream = await ai.models.generateContentStream({
    model: actualModel,
    contents: formattedMessages,
    config: {
      systemInstruction: systemPrompt,
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [write_file_tool, read_url_tool, run_command_tool, save_uploaded_image_tool] }
      ],
      toolConfig: { includeServerSideToolInvocations: true },
      maxOutputTokens: 8192,
      temperature: 0.7,
      safetySettings
    },
  });

  return stream;
}

export async function chatWithAura(messages: any[], files: FileItem[], model: string = "gemini-3-flash-preview", projectType: Project['type'] = 'react', extraInstruction?: string) {
  // Limit context size to prevent response truncation or token limits
  const MAX_FILE_SIZE_FOR_CONTEXT = 50000; // 50KB per file in context
  const fileContext = files
    .filter(f => !f.content.startsWith('data:image/'))
    .map(f => {
      let content = f.content;
      if (content.length > MAX_FILE_SIZE_FOR_CONTEXT) {
        content = content.substring(0, MAX_FILE_SIZE_FOR_CONTEXT) + "\n\n[... File truncated due to size ...]";
      }
      return `File: ${f.name}\nContent:\n${content}`;
    })
    .join("\n\n");
    
  const formattedMessages = formatMessagesForGemini(messages);
  const actualModel = mapModelId(model);
  
  const systemPrompt = `${getSystemPrompt(projectType)}${extraInstruction ? `\n\n${extraInstruction}` : ''}\n\nCURRENT FILES:\n${fileContext}`;
  
  const response = await ai.models.generateContent({
    model: actualModel,
    contents: formattedMessages,
    config: {
      systemInstruction: systemPrompt,
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [write_file_tool, read_url_tool, run_command_tool, save_uploaded_image_tool] }
      ],
      toolConfig: { includeServerSideToolInvocations: true },
      maxOutputTokens: 8192,
      temperature: 0.7,
      safetySettings
    },
  });

  return response;
}
