import useStore from '../../store/useStore';

export default function ConfirmDialog({ message, onConfirm }) {
  const closeModal = useStore(s => s.closeModal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[400px] p-5"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm text-gray-700 dark:text-gray-200 mb-5">
          {message || 'Are you sure?'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
            onClick={() => {
              onConfirm?.();
              closeModal();
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
