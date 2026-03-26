import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

export default function useAutoSave() {
  const saveToStorage = useStore(s => s.saveToStorage);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      saveToStorage();
    }, 2000);

    return () => clearInterval(timer.current);
  }, [saveToStorage]);
}
