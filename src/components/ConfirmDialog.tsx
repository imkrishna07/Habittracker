import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ConfirmDialogProps {
  habitName: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ habitName, onCancel, onConfirm }: ConfirmDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <header className="modal-header">
          <div>
            <p className="modal-eyebrow">REMOVE HABIT</p>
            <h2 id="delete-title">Delete this habit?</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close confirmation" onClick={onCancel}><X size={17} /></button>
        </header>
        <p className="confirm-copy"><strong>{habitName}</strong> and its completion history will be permanently removed.</p>
        <footer className="modal-actions">
          <button className="button button-quiet" type="button" autoFocus onClick={onCancel}>Cancel</button>
          <button className="button button-danger" type="button" onClick={onConfirm}>Delete habit</button>
        </footer>
      </section>
    </div>
  )
}
