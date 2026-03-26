import { useState, useCallback } from 'react';
import useStore from '../../store/useStore';

function EyeIcon({ show, onClick }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" tabIndex={-1}>
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243l2.829 2.829M6.343 6.343l11.314 11.314M14.121 14.121A3 3 0 009.879 9.879"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      )}
    </button>
  );
}

export default function ChangePasswordModal() {
  const closeModal = useStore(s => s.closeModal);
  const changeProjectPassword = useStore(s => s.changeProjectPassword);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!newPw.trim()) {
      setError('New password cannot be empty');
      return;
    }
    if (newPw !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    const ok = await changeProjectPassword(oldPw, newPw);
    setLoading(false);
    if (ok) {
      closeModal();
    } else {
      setError('Incorrect old password');
      setOldPw('');
    }
  }, [oldPw, newPw, confirm, changeProjectPassword, closeModal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[400px] p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-1">🔑 Change Password</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Change the password for this project
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current password</label>
            <div className="relative">
              <input
                autoFocus
                type={showOld ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password..."
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
              />
              <EyeIcon show={showOld} onClick={() => setShowOld(v => !v)} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password..."
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <EyeIcon show={showNew} onClick={() => setShowNew(v => !v)} />
            </div>
          </div>
          <div className="mb-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm new password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter new password..."
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
              <EyeIcon show={showConfirm} onClick={() => setShowConfirm(v => !v)} />
            </div>
          </div>
          {error && (
            <p className="text-red-500 text-xs mt-1.5">{error}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newPw.trim()}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
