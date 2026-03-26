import { useState, useCallback } from 'react';
import useStore from '../store/useStore';

export default function Sidebar() {
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const projects = useStore(s => s.projects);
  const activeProjectId = useStore(s => s.activeProjectId);
  const createProject = useStore(s => s.createProject);
  const switchProject = useStore(s => s.switchProject);
  const renameProject = useStore(s => s.renameProject);
  const deleteProject = useStore(s => s.deleteProject);
  const openModal = useStore(s => s.openModal);
  const editMode = useStore(s => s.editMode);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleStartRename = useCallback((id, name) => {
    setEditingId(id);
    setEditName(name);
  }, []);

  const handleRename = useCallback(() => {
    if (editingId && editName.trim()) {
      renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  }, [editingId, editName, renameProject]);

  const handleDelete = useCallback((id, name) => {
    openModal('confirm', {
      message: `Delete project "${name}"?`,
      onConfirm: () => deleteProject(id),
    });
  }, [deleteProject, openModal]);

  if (!sidebarOpen) return null;

  return (
    <div className="w-60 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Projects
        </span>
        <button
          className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
          onClick={() => createProject()}
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {projects.map(p => (
          <div
            key={p.id}
            className={`flex items-center gap-1 px-3 py-1.5 mx-1 rounded cursor-pointer group ${
              p.id === activeProjectId
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => p.id !== activeProjectId && switchProject(p.id)}
          >
            {editingId === p.id ? (
              <input
                autoFocus
                className="flex-1 text-sm bg-transparent border-b border-blue-400 outline-none"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <span className="flex-1 text-sm truncate">{p.name}</span>
            )}
            {editMode && (
              <div className={`${p.id === activeProjectId ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5`}>
                <button
                  className="text-xs p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(p.id, p.name);
                  }}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  className="text-xs p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id, p.name);
                  }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
