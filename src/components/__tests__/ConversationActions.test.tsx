import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationActions from '../ConversationActions'

// Mock tRPC hooks using module-level variables
jest.mock('@/lib/trpc', () => {
  const mockDeleteMutation = jest.fn()
  const mockUtilsInvalidate = jest.fn()
  return {
    __esModule: true,
    trpc: {
      chat: {
        delete: {
          useMutation: (opts: any) => ({
            mutateAsync: async (args: any) => {
              try {
                const result = await mockDeleteMutation(args)
                if (opts && opts.onSuccess) opts.onSuccess(result)
                return result
              } catch (err) {
                if (opts && opts.onError) opts.onError(err)
                throw err
              }
            },
            isLoading: false,
          }),
        },
      },
      useUtils: () => ({
        chat: {
          getAll: {
            invalidate: mockUtilsInvalidate,
          },
        },
      }),
    },
    // Export mocks for test access
    __mocks: {
      mockDeleteMutation,
      mockUtilsInvalidate,
    },
  }
})

const { __mocks } = require('@/lib/trpc')
const mockDeleteMutation = __mocks.mockDeleteMutation

describe('ConversationActions', () => {
  const mockConversation = {
    id: '123',
    title: 'Test Conversation',
    user_id: 'user123',
    created_at: '2024-03-15T00:00:00Z',
    updated_at: '2024-03-15T00:00:00Z',
    archived: false,
    last_active: '2024-03-15T00:00:00Z',
  }

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    window.confirm = jest.fn(() => true)
  })

  it('renders delete button', () => {
    render(
      <ConversationActions
        conversation={mockConversation}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls delete mutation and shows success message, then calls onClose', async () => {
    mockDeleteMutation.mockResolvedValueOnce({ success: true })
    render(
      <ConversationActions
        conversation={mockConversation}
        onClose={mockOnClose}
      />
    )
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await userEvent.click(deleteButton)
    expect(mockDeleteMutation).toHaveBeenCalledWith({ id: mockConversation.id })
    expect(await screen.findByText('Conversation deleted successfully')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    }, { timeout: 1500 })
  })

  it('does not call delete mutation if confirm is false', async () => {
    window.confirm = jest.fn(() => false)
    render(
      <ConversationActions
        conversation={mockConversation}
        onClose={mockOnClose}
      />
    )
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await userEvent.click(deleteButton)
    expect(window.confirm).toHaveBeenCalled()
    expect(mockDeleteMutation).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('shows error message when deletion fails', async () => {
    mockDeleteMutation.mockRejectedValueOnce(new Error('Failed to delete conversation'))
    render(
      <ConversationActions
        conversation={mockConversation}
        onClose={mockOnClose}
      />
    )
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await userEvent.click(deleteButton)
    expect(await screen.findByText('Failed to delete conversation')).toBeInTheDocument()
    expect(mockOnClose).not.toHaveBeenCalled()
  })
}) 