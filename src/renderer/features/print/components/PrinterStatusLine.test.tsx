import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PrinterStatus } from '@shared/ipc'
import { stubBridge } from '@renderer/test/bridge'
import { PrinterStatusLine } from './PrinterStatusLine'

describe('PrinterStatusLine (PRD §6.3, RNF10)', () => {
  it('shows the state main reports, and follows its changes', async () => {
    const { pushPrinter } = stubBridge()
    render(<PrinterStatusLine />)
    expect(await screen.findByText('Impressora pronta')).toBeInTheDocument()
    act(() => pushPrinter({ kind: 'no-ribbon' }))
    expect(screen.getByText('Impressora sem ribbon')).toBeInTheDocument()
    expect(screen.getByTestId('printer-status')).toHaveAttribute('data-kind', 'no-ribbon')
  })

  it.each([
    [{ kind: 'offline' }, 'Impressora desligada'],
    [{ kind: 'no-paper' }, 'Impressora sem papel'],
    [{ kind: 'not-found' }, 'Impressora DS-RX1 não encontrada'],
    [{ kind: 'paused' }, 'A fila da impressora está pausada no Windows'],
  ] as Array<[PrinterStatus, string]>)('%o reads %s', async (status, text) => {
    stubBridge({ printer: { getStatus: () => Promise.resolve(status) } })
    render(<PrinterStatusLine />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('says the driver did not report, instead of guessing, with the technical reason', async () => {
    stubBridge({ printer: { getStatus: () => Promise.resolve<PrinterStatus>({ kind: 'unknown', detail: 'print helper exited (1)' }) } })
    render(<PrinterStatusLine />)
    expect(await screen.findByText('O driver não informou papel nem ribbon')).toBeInTheDocument()
    expect(screen.getByText('Detalhe técnico: print helper exited (1)')).toBeInTheDocument()
  })
})
