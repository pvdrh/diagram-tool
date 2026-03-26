import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

export default function useAutoSave() {
  const saveToStorage = useStore(s => s.saveToStorage);
  const activeProjectId = useStore(s => s.activeProjectId);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      if (activeProjectId) {
        saveToStorage();
      }
    }, 2000);

    return () => clearInterval(timer.current);
  }, [saveToStorage, activeProjectId]);
}
