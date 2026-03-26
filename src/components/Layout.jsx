import { useState, useEffect, useRef } from 'react';
import DBMLEditor from './Editor/DBMLEditor';
import DiagramCanvas from './Canvas/DiagramCanvas';

export default function Layout() {
  const [leftPercent, setLeftPercent] = useState(35);
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.max(15, Math.min(70, pct)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      <div style={{ width: `${leftPercent}%` }} className="h-full overflow-hidden">
        <DBMLEditor />
      </div>
      <div
        className="w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={handleDividerMouseDown}
      />
      <div style={{ width: `${100 - leftPercent}%` }} className="h-full overflow-hidden">
        <DiagramCanvas />
      </div>
    </div>
  );
}
