interface CompareButtonProps {
  onClick: () => void
  loading: boolean
}

export function CompareButton({ onClick, loading }: CompareButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 20px",
        backgroundColor: loading ? "#6b7280" : "#0d9488",
        color: "white",
        border: "none",
        borderRadius: "9999px",
        fontSize: "14px",
        fontWeight: 600,
        fontFamily: "system-ui, -apple-system, sans-serif",
        cursor: loading ? "wait" : "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "all 0.2s ease"
      }}>
      {loading ? (
        <>
          <Spinner />
          Comparing...
        </>
      ) : (
        <>
          <PriceIcon />
          Compare Prices
        </>
      )}
    </button>
  )
}

function PriceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
