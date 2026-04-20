import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  Timestamp,
  writeBatch,
  query,
  limit,
  where
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';

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
}

export const syncProjectFiles = async (projectId: string, files: FileItem[]) => {
  if (!auth.currentUser) return;

  const filesRef = collection(db, 'projects', projectId, 'files');
  
  // Strategy: 
  // 1. Process files in chunks to avoid Firestore 10MB batch limit and 500 ops limit
  // 2. Parallelize Storage uploads with a limit to avoid browser memory issues
  
  const CHUNK_SIZE = 100;
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    // We'll collect storage uploads to run them before committing the batch
    const storageUploads: Promise<void>[] = [];

    for (const file of chunk) {
      const fileId = btoa(file.name).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
      const fileDoc = doc(filesRef, fileId);
      
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
      await Promise.all(storageUploads);
    }

    // Commit Firestore batch for this chunk
    await batch.commit();
  }
};

export const loadProjectFiles = async (projectId: string): Promise<FileItem[]> => {
  if (!auth.currentUser) return [];
  const filesRef = collection(db, 'projects', projectId, 'files');
  const q = query(filesRef, where('ownerId', '==', auth.currentUser.uid));
  const snapshot = await getDocs(q);
  
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

export const saveProjectMetadata = async (project: { id: string; name: string; type: string }) => {
  if (!auth.currentUser) return;
  const projectRef = doc(db, 'projects', project.id);
  await setDoc(projectRef, {
    ...project,
    ownerId: auth.currentUser.uid,
    updatedAt: Timestamp.now()
  }, { merge: true });
};
