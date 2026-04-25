import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
  query,
  limit,
  where,
  orderBy
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export let isQuotaExceeded = false;

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errString = String(error);
  if (errString.includes('resource-exhausted') || errString.includes('Quota limit exceeded') || errString.includes('quota')) {
    isQuotaExceeded = true;
    try {
      import('firebase/firestore').then(({ disableNetwork }) => {
         disableNetwork(db).catch(console.error);
      });
    } catch(e) {}
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

export interface FileItem {
  name: string;
  content: string;
  language: string;
  storagePath?: string;
  size?: number;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  image?: { data: string; mimeType: string };
  isStitch?: boolean;
  theme?: string;
  createdAt?: any;
  index?: number;
  ownerId?: string;
}

export const syncProjectFiles = async (projectId: string, files: FileItem[]) => {
  if (!auth.currentUser || isQuotaExceeded) return;

  const filesRef = collection(db, 'projects', projectId, 'files');
  const filesPath = `projects/${projectId}/files`;
  
  // Strategy: 
  // 1. Process files in chunks to avoid Firestore 10MB batch limit and 500 ops limit
  // 2. Parallelize Storage uploads with a limit to avoid browser memory issues
  
  // Fetch existing files to identify deleted ones
  let existingFilesSnapshot;
  try {
    existingFilesSnapshot = await getDocs(query(filesRef, where('ownerId', '==', auth.currentUser.uid)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, filesPath);
    return;
  }
  
  const existingFileIds = new Set(existingFilesSnapshot.docs.map(d => d.id));
  const newFileIds = new Set();
  
  const CHUNK_SIZE = 100;
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    // We'll collect storage uploads to run them before committing the batch
    const storageUploads: Promise<void>[] = [];

    for (const file of chunk) {
      const fileId = btoa(file.name).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
      const fileDoc = doc(filesRef, fileId);
      newFileIds.add(fileId);
      
      // Threshold: If content is > 400KB, it MUST go to Storage
      // Firestore total doc size is 1MB, but serialization overhead is a thing.
      if (file.content.length > 400000) {
        const storagePath = `projects/${projectId}/files/${fileId}`;
        const storageRef = ref(storage, storagePath);
        
        // Upload to Storage (collect promise)
        const blob = new Blob([file.content], { type: 'text/plain' });
        storageUploads.push(uploadBytes(storageRef, blob).then(() => {}));
        
        batch.set(fileDoc, {
          name: file.name,
          language: file.language,
          storagePath,
          size: file.content.length,
          ownerId: auth.currentUser.uid,
          updatedAt: Timestamp.now()
        });
      } else {
        batch.set(fileDoc, {
          name: file.name,
          language: file.language,
          content: file.content,
          size: file.content.length,
          ownerId: auth.currentUser.uid,
          updatedAt: Timestamp.now()
        });
      }
    }

    // Run storage uploads for this chunk
    if (storageUploads.length > 0) {
      try {
        await Promise.all(storageUploads);
      } catch (error) {
        console.error('Storage Upload Error:', error);
      }
    }

    // Commit Firestore batch for this chunk
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, filesPath);
    }
  }

  // Delete files that no longer exist
  const filesToDelete = Array.from(existingFileIds).filter(id => !newFileIds.has(id));
  if (filesToDelete.length > 0) {
    for (let i = 0; i < filesToDelete.length; i += CHUNK_SIZE) {
      const chunk = filesToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const fileId of chunk) {
        batch.delete(doc(filesRef, fileId as string));
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, filesPath);
      }
    }
  }
};

export const loadProjectFiles = async (projectId: string): Promise<FileItem[]> => {
  if (!auth.currentUser) return [];
  const filesRef = collection(db, 'projects', projectId, 'files');
  const filesPath = `projects/${projectId}/files`;
  
  let snapshot;
  try {
    const q = query(filesRef, where('ownerId', '==', auth.currentUser.uid));
    snapshot = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, filesPath);
    return [];
  }
  
  const files: FileItem[] = [];
  
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.storagePath) {
      // Fetch from Storage if pointer exists
      try {
        const storageRef = ref(storage, data.storagePath);
        const url = await getDownloadURL(storageRef);
        const res = await fetch(url);
        const content = await res.text();
        files.push({ ...data, content } as FileItem);
      } catch (e) {
        console.error('Failed to load file from storage:', data.name, e);
        files.push({ ...data, content: '// Error loading content' } as FileItem);
      }
    } else {
      files.push(data as FileItem);
    }
  }
  
  return files;
};

export const getProjectsFromFirebase = async (): Promise<any[]> => {
  if (!auth.currentUser) return [];
  const projectsRef = collection(db, 'projects');
  const projectsPath = 'projects';
  
  try {
    const q = query(projectsRef, where('ownerId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, projectsPath);
    return [];
  }
};

export const saveProjectMetadata = async (project: { id: string; name: string; type: string }) => {
  if (!auth.currentUser || isQuotaExceeded) return;
  const projectRef = doc(db, 'projects', project.id);
  const projectPath = `projects/${project.id}`;
  
  try {
    await setDoc(projectRef, {
      ...project,
      ownerId: auth.currentUser.uid,
      updatedAt: Timestamp.now()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, projectPath);
  }
};

export const syncProjectMessages = async (projectId: string, messages: Message[]) => {
  if (!auth.currentUser || isQuotaExceeded) return;
  
  const messagesRef = collection(db, 'projects', projectId, 'messages');
  const messagesPath = `projects/${projectId}/messages`;
  
  try {
    const existingSnapshot = await getDocs(query(messagesRef, where('ownerId', '==', auth.currentUser.uid)));
    
    // Batch delete existing
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    existingSnapshot.docs.forEach(d => {
      currentChunk.push(d);
      if (currentChunk.length >= 450) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    });
    if (currentChunk.length > 0) chunks.push(currentChunk);
    
    for (const chunk of chunks) {
      const b = writeBatch(db);
      chunk.forEach(d => b.delete(d.ref));
      await b.commit();
    }
    
    // Batch set new messages
    const setChunks: Message[][] = [];
    let curSetChunk: Message[] = [];
    messages.forEach(msg => {
      curSetChunk.push(msg);
      if (curSetChunk.length >= 450) {
        setChunks.push(curSetChunk);
        curSetChunk = [];
      }
    });
    if (curSetChunk.length > 0) setChunks.push(curSetChunk);
    
    let msgIndex = 0;
    for (const chunk of setChunks) {
      const b = writeBatch(db);
      for (const msg of chunk) {
        const msgId = `msg_${String(msgIndex).padStart(6, '0')}`;
        const msgDoc = doc(messagesRef, msgId);
        
        let docData: any = {
           ...msg,
           ownerId: auth.currentUser.uid,
           index: msgIndex,
           createdAt: msg.createdAt || Timestamp.now().toMillis() + msgIndex
        };

        // Remove any undefined properties explicitly
        Object.keys(docData).forEach(key => {
          if (docData[key] === undefined) {
            delete docData[key];
          }
        });
        
        if (docData.image && docData.image.data && docData.image.data.length > 500000) {
            docData.image = { mimeType: docData.image.mimeType, data: "" };
            docData.content += '\n\n*(Note: Image removed due to storage limits)*';
        }

        b.set(msgDoc, docData);
        msgIndex++;
      }
      await b.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, messagesPath);
  }
};

export const loadProjectMessages = async (projectId: string): Promise<Message[]> => {
  if (!auth.currentUser) return [];
  const messagesRef = collection(db, 'projects', projectId, 'messages');
  const messagesPath = `projects/${projectId}/messages`;
  
  try {
    const q = query(messagesRef, where('ownerId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(d => d.data() as Message).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, messagesPath);
    return [];
  }
};

