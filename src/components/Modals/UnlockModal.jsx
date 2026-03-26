import { useState, useCallback } from 'react';
import useStore from '../../store/useStore';

export default function UnlockModal() {
  const closeModal = useStore(s => s.closeModal);
  const tryUnlock = useStore(s => s.tryUnlock);

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    const ok = await tryUnlock(password);
    setLoading(false);
    if (ok) {
      closeModal();
    } else {
      setError('Sai mật khẩu');
      setPassword('');
    }
  }, [password, tryUnlock, closeModal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[360px] p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-1">🔓Unlock Your Power</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter the password to enable edit mode
        </p>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mật khẩu..."
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-red-500 text-xs mt-1.5">{error}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={closeModal}
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Đang kiểm tra...' : 'Mở khoá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
