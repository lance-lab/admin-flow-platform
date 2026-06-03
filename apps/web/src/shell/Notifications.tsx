import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type NotificationType = 'success' | 'error';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

interface NotificationsContextValue {
  notify: (input: { type: NotificationType; message: string }) => void;
  confirm: (input: { title: string; message: string; confirmLabel: string; cancelLabel: string }) => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const notify = useCallback((input: { type: NotificationType; message: string }) => {
    const id = Date.now() + Math.random();
    setNotifications((current) => [...current, { id, ...input }]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, 4200);
  }, []);

  const confirm = useCallback(
    (input: { title: string; message: string; confirmLabel: string; cancelLabel: string }) =>
      new Promise<boolean>((resolve) => {
        setConfirmation({ ...input, resolve });
      }),
    []
  );

  function resolveConfirmation(confirmed: boolean) {
    confirmation?.resolve(confirmed);
    setConfirmation(null);
  }

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="notification-stack" role="status" aria-live="polite">
        {notifications.map((notification) => (
          <div className={`notification ${notification.type}`} key={notification.id}>
            {notification.message}
          </div>
        ))}
      </div>
      {confirmation ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              resolveConfirmation(false);
            }
          }}
        >
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="confirm-actions">
              <button className="icon-text-button" type="button" onClick={() => resolveConfirmation(false)}>
                {confirmation.cancelLabel}
              </button>
              <button className="danger-button" type="button" onClick={() => resolveConfirmation(true)}>
                {confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used inside NotificationsProvider');
  }

  return context;
}
