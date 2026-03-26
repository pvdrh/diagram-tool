import { useEffect } from 'react';
import useStore from '../store/useStore';

export default function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      const state = useStore.getState();

      // Ignore when typing in inputs
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      // Allow undo/redo even in editor
      const isCodemirror = e.target.closest('.cm-editor');

      // Escape: close modal or deselect
      if (e.key === 'Escape') {
        if (state.modal) {
          state.closeModal();
        } else if (state.contextMenu) {
          state.hideContextMenu();
        } else {
          state.clearSelection();
        }
        return;
      }

      // Don't intercept regular typing in inputs (except for Ctrl combos)
      if (isInput && !e.ctrlKey && !e.metaKey) return;
      // Don't intercept CodeMirror undo/redo
      if (isCodemirror && (e.key === 'z' || e.key === 'y') && (e.ctrlKey || e.metaKey)) return;

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (state.editMode) state.undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (state.editMode) state.redo();
        return;
      }

      // Ctrl+D: Duplicate selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (state.editMode) {
          for (const id of state.selectedTableIds) {
            state.duplicateTable(id);
          }
        }
        return;
      }

      // Ctrl+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInput) {
        e.preventDefault();
        state.selectAll();
        return;
      }

      // Delete: delete selected
      if (e.key === 'Delete' && !isInput) {
        if (!state.editMode) return;
        if (state.selectedRelationshipId) {
          state.deleteRelationship(state.selectedRelationshipId);
        } else if (state.selectedTableIds.length > 0) {
          const hasRels = state.selectedTableIds.some(tid =>
            state.relationships.some(r => r.fromTableId === tid || r.toTableId === tid)
          );
          if (hasRels) {
            state.openModal('confirm', {
              message: `Delete ${state.selectedTableIds.length} selected table(s) and their relationships?`,
              onConfirm: () => {
                for (const tid of [...state.selectedTableIds]) {
                  state.deleteTable(tid);
                }
              },
            });
          } else {
            for (const tid of [...state.selectedTableIds]) {
              state.deleteTable(tid);
            }
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
