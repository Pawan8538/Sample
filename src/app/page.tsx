'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useUser } from '@auth0/nextjs-auth0/client'
import { useRouter } from 'next/navigation'
import ConversationsList from '@/components/ConversationsList'
import { Conversation, Message } from '@/types/database'

export default function Home() {
  const { user, isLoading: isAuthLoading } = useUser()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ text: string; isUser: boolean }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConversations, setShowConversations] = useState(false)
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const utils = trpc.useUtils()
  
  const { mutateAsync: sendMessage } = trpc.chat.sendMessage.useMutation({
    onSuccess: async (result) => {
      // Invalidate relevant queries
      await Promise.all([
        utils.chat.getAll.invalidate(),
        utils.chat.getMessages.invalidate({ conversationId: result.conversationId })
      ])
    }
  })

  const { mutateAsync: createChat } = trpc.chat.create.useMutation({
    onSuccess: async () => {
      await utils.chat.getAll.invalidate()
    }
  })

  // Optimize message loading with proper caching
  const { data: conversationMessages, isLoading: isLoadingMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: currentConversation?.id ?? '' },
    { 
      enabled: !!currentConversation?.id,
      staleTime: 1000 * 60, // Cache for 1 minute
      cacheTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
      refetchOnWindowFocus: false // Don't refetch on window focus
    }
  )

  // Memoize message transformation
  const transformMessages = useCallback((messages: Message[]) => {
    return messages.map((msg: Message) => ({
      text: msg.content,
      isUser: user?.sub && msg.user_id && msg.user_id.toString() === user.sub.toString()
    }))
  }, [user?.sub])

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationMessages && currentConversation) {
      const newMessages = transformMessages(conversationMessages)
      // @ts-ignore
      setMessages(newMessages)
    } else if (!currentConversation) {
      setMessages([])
    }
  }, [conversationMessages, currentConversation, transformMessages])

  // Optimize scroll behavior
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleNewChat = useCallback(() => {
    setCurrentConversation(null)
    setMessages([])
    setShowConversations(false)
  }, [])

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation)
    setShowConversations(false)
  }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      router.push('/api/auth/login')
      return
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage || isLoading) {
      return
    }

    // Optimistically update UI
    const newUserMessage = { text: trimmedMessage, isUser: true }
    setMessages(prev => [...prev, newUserMessage])
    setMessage('')
    setIsLoading(true)

    try {
      const result = await sendMessage({
        conversationId: currentConversation?.id || 'new',
        message: trimmedMessage
      })

      if (result.conversationId && result.conversationId !== currentConversation?.id) {
        const newConversation = {
          id: result.conversationId,
          title: trimmedMessage.slice(0, 50),
          user_id: user.sub,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          archived: false,
          last_active: new Date().toISOString()
        }
        // @ts-ignore
        setCurrentConversation(newConversation)
      }

      if (result.message) {
        setMessages(prev => [...prev, { text: result.message, isUser: false }])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      setMessages(prev => [...prev, { text: `Error: ${errorMessage}`, isUser: false }])
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '100vh' }}>
        <h2 className="mb-4">Welcome to ChatGPT Clone</h2>
        <a href="/api/auth/login" className="btn btn-primary btn-lg">
          Sign Up / Login
        </a>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column min-vh-100 bg-black text-white">
      {/* Chat Header (Mobile) */}
      <header className="bg-black border-bottom border-secondary py-3 px-3 d-flex justify-content-between align-items-center shadow-sm position-fixed top-0 start-0 end-0" style={{ 
        zIndex: 1000,
        height: '64px'
      }}>
        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn btn-link text-white p-0 d-flex align-items-center justify-content-center"
            onClick={() => setShowConversations(!showConversations)}
            style={{ 
              width: '40px', 
              height: '40px',
              backgroundColor: 'var(--chat-bg)',
              borderRadius: '8px',
              transition: 'background-color 0.2s ease',
              padding: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--message-bg-ai)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--chat-bg)'}
          >
            <div style={{ 
              width: '24px', 
              height: '18px', 
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <span style={{ 
                display: 'block',
                width: '100%',
                height: '2px',
                backgroundColor: 'var(--foreground)',
                borderRadius: '1px'
              }}></span>
              <span style={{ 
                display: 'block',
                width: '100%',
                height: '2px',
                backgroundColor: 'var(--foreground)',
                borderRadius: '1px'
              }}></span>
              <span style={{ 
                display: 'block',
                width: '100%',
                height: '2px',
                backgroundColor: 'var(--foreground)',
                borderRadius: '1px'
              }}></span>
            </div>
          </button>
          <div className="d-flex flex-column" style={{ minWidth: 0 }}>
            <h1 className="h5 m-0 fw-bold text-white text-truncate" style={{ maxWidth: '150px' }}>
              ChatGPT Clone
            </h1>
            <small className="text-white opacity-75 text-truncate" style={{ maxWidth: '150px' }}>
              Welcome, {user?.name || user?.email?.split('@')[0] || 'User'}
            </small>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {user ? (
            <>
              {user.picture && (
                <img
                  src={user.picture}
                  alt="Profile" 
                  className="rounded-circle border border-secondary" 
                  style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                />
              )}
              <a href="/api/auth/logout" className="btn btn-outline-light btn-sm px-3">
                Logout
              </a>
            </>
          ) : (
            <a href="/api/auth/login" className="btn btn-outline-light btn-sm">
              Login
            </a>
          )}
        </div>
      </header>

      {/* Add margin for fixed header */}
      <div style={{ height: '64px' }}></div>

      {/* Main Content */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Conversations Sidebar (Mobile Overlay) */}
        <div 
          className={`position-fixed h-100 ${showConversations ? 'd-block' : 'd-none'}`}
          style={{ 
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 998,
            top: '64px',
            left: 0,
            opacity: showConversations ? 1 : 0,
            transition: 'opacity 0.15s ease',
            willChange: 'opacity, transform',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowConversations(false)}
        >
          <div 
            className="h-100" 
            style={{ 
              width: '85%',
              maxWidth: '320px',
              backgroundColor: '#1a1a1a',
              boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
              transform: showConversations ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.15s ease',
              willChange: 'transform'
            }}
            onClick={e => e.stopPropagation()}
          >
            <ConversationsList
              onSelectConversation={handleSelectConversation}
              currentConversationId={currentConversation?.id}
              onNewChat={handleNewChat}
            />
          </div>
        </div>

        {/* Chat Area */}
        <div className="d-flex flex-column flex-grow-1 bg-black">
          {/* Chat Messages */}
          <div 
            className="flex-grow-1 overflow-auto p-3" 
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              marginBottom: '80px'
            }}
          >
            {messages.map((msg, index) =>{
              return (
              <div
                key={index}
                className={`d-flex mb-3 ${msg.isUser ? 'justify-content-end' : 'justify-content-start'}`}
                style={{
                  width: '100%',
                  padding: '0 1rem'
                }}
              >
                <div
                  className={`p-3 rounded-3 ${
                    msg.isUser 
                      ? 'bg-primary text-white' 
                      : 'bg-dark text-white'
                  }`}
                  style={{ 
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5',
                    backgroundColor: msg.isUser ? 'var(--primary)' : 'var(--dark)',
                    color: 'var(--white)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    marginLeft: msg.isUser ? 'auto' : '0',
                    marginRight: msg.isUser ? '0' : 'auto'
                  }}
                >
                  {msg.text}
                </div>
              </div>
            )})}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input (Fixed at Bottom) */}
          <form 
            onSubmit={handleSend} 
            className="d-flex gap-2 p-3 border-top border-secondary bg-black" 
            style={{ 
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '80px',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              zIndex: 997,
              boxShadow: '0 -2px 10px rgba(0,0,0,0.3)'
            }}
          >
            <input
              type="text"
              className="form-control form-control-lg bg-black text-white"
              placeholder="Type a message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={isLoading}
              style={{ 
                borderRadius: '24px',
                borderColor: 'var(--input-border)',
                paddingLeft: '16px',
                paddingRight: '16px',
                height: '48px'
              }}
            />
            <button 
              type="submit" 
              className="btn btn-primary d-flex align-items-center justify-content-center" 
              disabled={isLoading || !message.trim()}
              style={{ 
                borderRadius: '24px',
                minWidth: '48px',
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--message-bg-user)',
                border: 'none',
                padding: 0
              }}
            >
              {isLoading ? (
                <span className="spinner-border spinner-border-sm text-white" role="status">
                  <span className="visually-hidden">Sending...</span>
                </span>
              ) : (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  fill="currentColor" 
                  className="bi bi-search text-white" 
                  viewBox="0 0 16 16"
                  style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.5))' }}
                >
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

