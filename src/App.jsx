import { useEffect } from 'react';
import useStore from './store/useStore';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Layout from './components/Layout';
import SQLGeneratorModal from './components/Modals/SQLGeneratorModal';
import ConfirmDialog from './components/Modals/ConfirmDialog';
import UnlockModal from './components/Modals/UnlockModal';
import SetPasswordModal from './components/Modals/SetPasswordModal';
import ChangePasswordModal from './components/Modals/ChangePasswordModal';
import useAutoSave from './hooks/useAutoSave';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';

export default function App() {
  const darkMode = useStore(s => s.darkMode);
  const modal = useStore(s => s.modal);
  const editMode = useStore(s => s.editMode);
  const initialize = useStore(s => s.initialize);
  const checkAuth = useStore(s => s.checkAuth);

  useEffect(() => {
    initialize();
    checkAuth();
  }, [initialize, checkAuth]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useAutoSave();
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <Toolbar />
      {!editMode && (
        <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-1 text-center flex-shrink-0">
          🔒 View-only mode
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Layout />
      </div>
      {modal?.type === 'sql' && <SQLGeneratorModal />}
      {modal?.type === 'confirm' && (
        <ConfirmDialog
          message={modal.data?.message}
          onConfirm={modal.data?.onConfirm}
        />
      )}
      {modal?.type === 'unlock' && <UnlockModal />}
      {modal?.type === 'setPassword' && <SetPasswordModal />}
      {modal?.type === 'changePassword' && <ChangePasswordModal />}
    </div>
  );
}
