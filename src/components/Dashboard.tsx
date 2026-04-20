import React, { useState } from 'react';
import { Project } from '../types';
import { FolderKanban, Plus, LayoutGrid, Clock, Globe, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardProps {
  projects: Project[];
  onCreateProject: (name: string, type: Project['type']) => void;
  onLoadProject: (project: Project) => void;
}

export default function Dashboard({ projects, onCreateProject, onLoadProject }: DashboardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Project['type']>('react');

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateProject(newName, newType);
    setIsCreating(false);
    setNewName('');
  };

  return (
    <div className="w-full h-screen bg-zinc-50 flex flex-col overflow-y-auto">
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center shadow-sm">
            <FolderKanban className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-zinc-900">Aura Projects</h1>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">Recent Projects</h2>
            <p className="text-zinc-500 mt-1">Continue working on your previous projects or start a new one.</p>
          </div>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {isCreating && (
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm mb-8 flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Project Name</label>
              <Input 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder="e.g., My Awesome App" 
                autoFocus
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Project Type</label>
              <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">React / Vite (Moderno)</SelectItem>
                  <SelectItem value="basic">HTML / CSS / JS (Básico)</SelectItem>
                  <SelectItem value="fullstack">Fullstack (Next.js / DB)</SelectItem>
                  <SelectItem value="expo">Mobile App (Expo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        )}

        {projects.length === 0 && !isCreating ? (
          <div className="text-center py-20 bg-white rounded-xl border border-zinc-200 border-dashed">
            <LayoutGrid className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900">No projects yet</h3>
            <p className="text-zinc-500 mt-1 mb-6">Create your first project to get started with Aura.</p>
            <Button onClick={() => setIsCreating(true)} variant="outline">Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div 
                key={project.id} 
                onClick={() => onLoadProject(project)}
                className="bg-white p-5 rounded-xl border border-zinc-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    {project.type === 'expo' ? (
                      <Smartphone className="w-5 h-5 text-zinc-600 group-hover:text-blue-600" />
                    ) : project.type === 'fullstack' ? (
                      <LayoutGrid className="w-5 h-5 text-zinc-600 group-hover:text-blue-600" />
                    ) : (
                      <Globe className="w-5 h-5 text-zinc-600 group-hover:text-blue-600" />
                    )}
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-zinc-100 text-zinc-600 rounded-full uppercase tracking-wider">
                    {project.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1 truncate">{project.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-auto pt-4">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
