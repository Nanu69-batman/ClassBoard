type EmptyStateProps = {
  title: string;
  message: string;
};

/** Shown instead of a list when there is nothing to show. Never an error state. */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__message">{message}</p>
    </div>
  );
}
