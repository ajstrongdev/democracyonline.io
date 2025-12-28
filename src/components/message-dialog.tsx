import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type MessageVariant = 'default' | 'destructive'

export interface MessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  title: string
  description?: React.ReactNode

  confirmText?: string
  cancelText?: string

  onConfirm?: () => void
  onCancel?: () => void

  variant?: MessageVariant

  confirmAriaLabel?: string
  cancelAriaLabel?: string

  contentClassName?: string
}

export function MessageDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  confirmAriaLabel,
  cancelAriaLabel,
  contentClassName,
}: MessageDialogProps) {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={['sm:max-w-[520px]', contentClassName]
          .filter(Boolean)
          .join(' ')}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-left leading-relaxed">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-2">
          <AlertDialogCancel
            onClick={handleCancel}
            aria-label={cancelAriaLabel || 'Cancel'}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            aria-label={confirmAriaLabel || 'Confirm'}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive/20 dark:focus:ring-destructive/40'
                : undefined
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
