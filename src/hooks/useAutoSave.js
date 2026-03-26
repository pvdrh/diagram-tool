import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

export default function useAutoSave() {
  const saveToStorage = useStore(s => s.saveToStorage);
  const editMode = useStore(s => s.editMode);
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      // Only save if in edit mode or if project has no password
      if (activeProjectId) {
        const project = projects.find(p => p.id === activeProjectId);
        if (editMode || !project?.passwordHash) {
          saveToStorage();
        }
      }
    }, 2000);

    return () => clearInterval(timer.current);
  }, [saveToStorage, editMode, activeProjectId, projects]);
}
