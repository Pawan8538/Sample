export type MessageType = 'text' | 'image'
export type ModelType = 'gemini-1.5-flash-latest' | 'gemini-1.0-pro-vision'

export interface User {
  id: string
  auth0_id: string
  email: string
  name: string | null
  picture_url: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
  archived: boolean
  last_active: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  content: string
  type: MessageType
  model_used: ModelType | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface GeneratedImage {
  id: string
  message_id: string
  prompt: string
  image_url: string
  created_at: string
}

// Database schema type
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Conversation, 'id' | 'created_at' | 'updated_at'>>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at' | 'updated_at'>>
      }
      generated_images: {
        Row: GeneratedImage
        Insert: Omit<GeneratedImage, 'id' | 'created_at'>
        Update: never // Generated images are immutable
      }
    }
  }
} 