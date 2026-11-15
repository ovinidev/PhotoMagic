import { useState } from 'react'
import { Button } from '@renderer/shared/components/ui/button'
import { SESSION_COPY } from '../copy'

/** `Encerrar evento` (RF16): closes the TV and forgets the unprinted round; main pushes the idle state. */
export function EndEventButton() {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const end = async () => {
    setPending(true)
    setFailed(false)
    try {
      await window.fotomagica.event.end()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {SESSION_COPY.endError}
        </p>
      ) : null}
      <Button variant="ghost" disabled={pending} onClick={() => void end()}>
        {pending ? SESSION_COPY.ending : SESSION_COPY.end}
      </Button>
    </div>
  )
}
