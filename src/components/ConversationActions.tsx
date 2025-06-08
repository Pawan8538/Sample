import React, { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { Conversation } from '@/types/database'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ConversationActionsProps {
  conversation: Conversation
  onClose: () => void
}

export default function ConversationActions({ conversation, onClose }: ConversationActionsProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const utils = trpc.useUtils()
  const router = useRouter()

  const { mutateAsync: deleteConversation, isLoading } = trpc.chat.delete.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await utils.chat.getAll.cancel()
      
      // Snapshot the previous value
      const previousConversations = utils.chat.getAll.getData()
      
      // Optimistically update the cache
      utils.chat.getAll.setData(undefined, (old) => {
        if (!old) return []
        return old.filter(conv => conv.id !== conversation.id)
      })
      
      return { previousConversations }
    },
    onSuccess: async () => {
      try {
        // Show success message
        setSuccess('Conversation deleted successfully')
        
        // Close the dialog
        onClose()
        
        // Invalidate and refetch
        await utils.chat.getAll.invalidate()
      } catch (error) {
        console.error('Error during cleanup after deletion:', error)
        setError('Conversation was deleted but there was an error updating the UI')
      }
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        utils.chat.getAll.setData(undefined, context.previousConversations)
      }
      console.error('Delete conversation error:', error)
      setError(error.message || 'Failed to delete conversation')
    }
  })

  const handleDelete = useCallback(async () => {
    if (!conversation.id) {
      setError('Invalid conversation ID')
      return
    }

    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      setError(null)
      setSuccess(null)
      try {
        console.log('Attempting to delete conversation:', conversation.id)
        await deleteConversation({ id: conversation.id })
      } catch (error) {
        console.error('Delete conversation error:', error)
        // Error handled in mutation
      }
    }
  }, [conversation.id, deleteConversation])

  return (
    <div className="p-3 bg-black/90 rounded-lg shadow-lg border border-secondary">
      <div className="d-flex flex-column gap-2">
        {isLoading && (
          <div className="d-flex justify-content-center align-items-center gap-2">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-light">Deleting...</span>
          </div>
        )}
        <button
          className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
          onClick={handleDelete}
          disabled={isLoading}
        >
          <Trash2 size={16} />
          Delete
        </button>
        {error && (
          <div className="alert alert-danger mt-2 py-1 px-2" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success mt-2 py-1 px-2" role="alert">
            {success}
          </div>
        )}
      </div>
    </div>
  )
} 