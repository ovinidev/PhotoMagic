import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RENDER_ERROR_COPY, RenderErrorBoundary } from './RenderErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

describe('RenderErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders its children when nothing throws', () => {
    render(<RenderErrorBoundary>ok</RenderErrorBoundary>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('shows a reload action instead of a blank window when a child throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    render(
      <RenderErrorBoundary onReload={onReload}>
        <Boom />
      </RenderErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(RENDER_ERROR_COPY.title)
    await userEvent.click(screen.getByRole('button', { name: RENDER_ERROR_COPY.reload }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
