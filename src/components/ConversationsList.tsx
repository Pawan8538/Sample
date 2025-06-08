import React, { useState, useMemo, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { formatDistanceToNow, format } from 'date-fns'
import { Conversation } from '@/types/database'
import { Trash2, Archive, ArchiveRestore, MoreVertical } from 'lucide-react'
import ConversationActions from './ConversationActions'

type SortOption = 'newest' | 'oldest' | 'title' | 'lastActive'
type ArchiveStatus = 'all' | 'active' | 'archived'

interface ConversationWithMessages extends Conversation {
  messages: Array<{
    id: string;
    content: string;
    created_at: string;
  }>;
  message_count: number;
}

interface ConversationsListProps {
  onSelectConversation: (conversation: Conversation) => void
  currentConversationId?: string
  onNewChat: () => void
}

export default function ConversationsList({ 
  onSelectConversation, 
  currentConversationId,
  onNewChat 
}: ConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [archiveFilter, setArchiveFilter] = useState<ArchiveStatus>('active')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 })
  // @ts-ignore
  const { data: conversations, isLoading } = trpc.chat.getAll.useQuery<ConversationWithMessages[]>(undefined, {
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  })
  const { mutateAsync: deleteConversation } = trpc.chat.delete.useMutation({
    onSuccess: () => {
      utils.chat.getAll.invalidate()
    }
  })
  const { mutateAsync: archiveConversation } = trpc.chat.archive.useMutation({
    onSuccess: () => {
      utils.chat.getAll.invalidate()
    }
  })
  const utils = trpc.useUtils()

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    if (!conversations) return []

    // First, ensure we have unique conversations by ID
    const uniqueConversations = Array.from(
      new Map(conversations.map(conv => [conv.id, conv])).values()
    )

    // Then apply filters
    let filtered = uniqueConversations.filter(conv => {
      const matchesSearch = searchQuery === '' || 
        conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.messages?.some(msg => 
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
        )

      const matchesArchive = archiveFilter === 'all' || 
        // @ts-ignore
        (archiveFilter === 'archived' && conv.archived) ||
        // @ts-ignore
        (archiveFilter === 'active' && !conv.archived)

      return matchesSearch && matchesArchive
    })

    // Sort conversations
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'oldest':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'lastActive':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [conversations, searchQuery, sortBy, archiveFilter])

  // Function to format conversation time
  const formatConversationTime = (date: string) => {
    const conversationDate = new Date(date)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - conversationDate.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 24 * 60) {
      return format(conversationDate, 'h:mm a')
    } else {
      return format(conversationDate, 'MMM d, h:mm a')
    }
  }

  const handleConversationSelect = (conversation: ConversationWithMessages) => {
    if (conversation.archived) {
      if (window.confirm('This conversation is archived. Would you like to unarchive it?')) {
        // @ts-ignore
        archiveConversation.mutate({ id: conversation.id, archived: false })
      }
      return
    }
    onSelectConversation(conversation)
  }

  const handleShowActions = (conversation: Conversation, event: React.MouseEvent) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setActionPosition({ x: rect.left, y: rect.bottom })
    setSelectedConversation(conversation)
    setShowActions(true)
  }

  const handleCloseActions = () => {
    setShowActions(false)
    setSelectedConversation(null)
  }

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showActions && !(e.target as Element).closest('.conversation-actions')) {
        setShowActions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActions])

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-3">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading conversations...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black/80 text-white" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header with New Chat Button and Search */}
      <div className="p-3 border-bottom border-secondary" style={{
        backgroundColor: 'var(--background)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
        flexShrink: 0
      }}>
        <div className="d-flex flex-column gap-2">
          <button
            onClick={onNewChat}
            className="btn w-100 d-flex align-items-center justify-content-center gap-2 py-2 text-white"
            style={{ 
              borderRadius: '8px',
              backgroundColor: 'var(--chat-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              height: '48px'
            }}
          >
            <i className="bi bi-plus-lg text-white"></i>
            <span>New Chat</span>
          </button>

          {/* Search Bar */}
          <div className="position-relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="form-control bg-dark text-white border-secondary"
              style={{ borderRadius: '8px', paddingLeft: '2.5rem' }}
            />
            <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-white-50"></i>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-link text-white-50 p-0 d-flex align-items-center gap-2"
            style={{ fontSize: '0.875rem' }}
          >
            <i className={`bi bi-chevron-${showFilters ? 'up' : 'down'}`}></i>
            <span>Filters</span>
          </button>

          {/* Filters */}
          {showFilters && (
            <div className="d-flex flex-column gap-2 p-2 bg-dark rounded" style={{ marginTop: '0.5rem' }}>
              {/* Sort Options */}
              <div className="d-flex flex-column gap-1">
                <label className="text-white-50 small">Sort by:</label>
                <div className="btn-group w-100">
                  {(['newest', 'oldest', 'title'] as SortOption[]).map((option) => (
                    <button
                      key={option}
                      className={`btn btn-sm ${sortBy === option ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setSortBy(option)}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Archive Filter */}
              <div className="d-flex flex-column gap-1">
                <label className="text-white-50 small">Show:</label>
                <div className="btn-group w-100">
                  {(['all', 'active', 'archived'] as ArchiveStatus[]).map((status) => (
                    <button
                      key={status}
                      className={`btn btn-sm ${archiveFilter === status ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setArchiveFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      
      <div className="flex-1 overflow-y-auto" style={{ 
        height: 'calc(100vh - 180px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-color) transparent'
      }}>
        <div className="p-2 space-y-2">
          {filteredAndSortedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`relative group rounded-lg p-3 cursor-pointer transition-colors
                ${currentConversationId === conversation.id 
                  ? 'bg-white/20' 
                  : 'hover:bg-white/10'
                }
                @ts-ignore
                ${(conversation as any).archived ? 'opacity-60' : ''}
              onClick={() => handleConversationSelect(conversation)}
            >
              <div className="conversation-item d-flex align-items-center justify-content-between p-2 rounded mb-2">
                <div 
                  className="d-flex align-items-center flex-grow-1"
                  onClick={() => handleConversationSelect(conversation)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex flex-column">
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-truncate" style={{ maxWidth: '200px' }}>
                        {conversation.title || 'New Chat'}
                      </span>
                      <button
                        className="btn btn-link btn-sm p-0 text-light"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShowActions(conversation, e)
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    <small className="text-muted">
                      {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
                    </small>
                  </div>
                </div>
              </div>

              {/* Conversation Actions */}
              {showActions && selectedConversation?.id === conversation.id && (
                <div 
                  className="conversation-actions absolute right-0 top-full mt-1 z-50"
                  style={{ minWidth: '200px' }}
                >
                  <ConversationActions
                    conversation={conversation}
                    onClose={handleCloseActions}
                  />
                </div>
              )}
            </div>
          ))}
          
          {filteredAndSortedConversations.length === 0 && !isLoading && (
            <div className="text-center text-gray-400 py-4">
              {searchQuery ? 'No conversations found' : 'No conversations yet. Start a new chat!'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 