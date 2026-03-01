interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
      <svg
        className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-sm text-red-700 flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 text-lg leading-none">
          &times;
        </button>
      )}
    </div>
  )
}
