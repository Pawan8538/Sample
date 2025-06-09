import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { upsertUserFromAuth0 } from '@/lib/supabase'
import { Database } from '@/types/database'
import { eq, and } from 'drizzle-orm'

// Initialize Gemini API with proper error handling
const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "API key not configured. Please contact support.",
    });
  }

  try {
    // Get the model with proper configuration for v1 API
    const genAI = new GoogleGenerativeAI(apiKey);

    return genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest", // ✅ Correct model name
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
    
  } catch (error) {
    console.error("Error initializing Gemini API:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to initialize AI service. Please try again later.",
      cause: error,
    });
  }
};

// Define message type for Gemini API
type GeminiMessage = {
  role: "user" | "assistant";
  parts: { text: string }[];
};

// Define database message type
type DBMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image';
  model_used: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

// Helper function to check if a message belongs to a conversation window
const isWithinConversationWindow = (messageTime: Date, conversationTime: Date) => {
  const diffInMinutes = Math.abs(messageTime.getTime() - conversationTime.getTime()) / (1000 * 60)
  return diffInMinutes <= 5
}

export const chatRouter = createTRPCRouter({
  // Create a new conversation
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single();

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        });
      }

      // Create the conversation
      const { data: conversation, error: conversationError } = await ctx.supabase
        .from('conversations')
        .insert({
          title: input.title,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (conversationError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create conversation',
          cause: conversationError
        });
      }

      return conversation;
    }),

  // Get all conversations for the current user
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single();

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        });
      }

      // Get all conversations with their messages, using distinct to prevent duplicates
      const { data: conversations, error: conversationsError } = await ctx.supabase
        .from("conversations")
        .select(`
          id,
          user_id,
          title,
          created_at,
          updated_at,
          messages:messages (
            id,
            content,
            user_id,
            created_at,
            type,
            model_used
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (conversationsError) {
        console.error("Error fetching conversations:", conversationsError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch conversations",
          cause: conversationsError,
        });
      }

      // Transform the data to include message count and ensure messages are sorted
      const transformedConversations = conversations?.map(conversation => ({
        ...conversation,
        messages: (conversation.messages || []).sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
        message_count: (conversation.messages || []).length
      })) || [];

      // Remove any duplicate conversations based on ID
      const uniqueConversations = Array.from(
        new Map(transformedConversations.map(conv => [conv.id, conv])).values()
      );

      return uniqueConversations;
    }),

  // Get a single conversation by ID
  getById: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx
      
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error
      return conversation
    }),

  // Delete a conversation
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single();

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        });
      }

      // First, verify the conversation belongs to the user
      const { data: conversation, error: conversationError } = await ctx.supabase
        .from('conversations')
        .select('id')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single();

      if (conversationError || !conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found or you don't have permission to delete it",
          cause: conversationError,
        });
      }

      // Delete all messages in the conversation
      const { error: messagesError } = await ctx.supabase
        .from('messages')
        .delete()
        .eq('conversation_id', input.id);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete conversation messages",
          cause: messagesError,
        });
      }

      // Delete the conversation
      const { error: conversationDeleteError } = await ctx.supabase
        .from('conversations')
        .delete()
        .eq('id', input.id)
        .eq('user_id', user.id);

      if (conversationDeleteError) {
        console.error('Error deleting conversation:', conversationDeleteError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete conversation",
          cause: conversationDeleteError,
        });
      }

      return { success: true };
    }),

  // Send a message and get an AI response
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      let { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single();

      // If user doesn't exist, try to create them
      if (userError || !user) {
        console.log('User not found in database, attempting to create...');
        const { data: newUser, error: createError } = await ctx.supabase
          .from("users")
          .insert([{
            auth0_id: session.user.sub,
            email: session.user.email,
            name: session.user.name,
            picture_url: session.user.picture,
          }])
          .select()
          .single();

        if (createError || !newUser) {
          console.error('Failed to create user:', createError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user account. Please try logging out and back in.",
            cause: createError,
          });
        }

        user = newUser;
      }
      // @ts-ignore
      const userId = user.id;
      let conversationId = input.conversationId;
      let history: DBMessage[] = [];

      // Only fetch history if this is not a new conversation
      if (conversationId !== 'new') {
        const baseConversationId = conversationId.split('_')[0];
        
        // Get conversation history
        const { data: conversationHistory, error: historyError } = await ctx.supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", baseConversationId)
          .order("created_at", { ascending: true });

        if (historyError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch chat history",
            cause: historyError,
          });
        }

        history = conversationHistory || [];

        // Check if we should create a new conversation
        const lastMessage = history[history.length - 1];
        const shouldCreateNewConversation = lastMessage && 
          !isWithinConversationWindow(
            new Date(),
            new Date(lastMessage.created_at)
          );

        if (shouldCreateNewConversation) {
          // Create a new conversation for the new message
          const { data: newConversation, error: newConvError } = await ctx.supabase
            .from("conversations")
            .insert({
              title: input.message.slice(0, 50) || "New Chat", // Ensure title is never null
              user_id: userId,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (newConvError) {
            console.error("Error creating new conversation:", newConvError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new conversation",
              cause: newConvError,
            });
          }

          conversationId = newConversation.id;
          history = []; // Clear history for new conversation
        }
      } else {
        // Create a new conversation for new chat
        const { data: newConversation, error: newConvError } = await ctx.supabase
          .from("conversations")
          .insert({
            title: input.message.slice(0, 50) || "New Chat", // Ensure title is never null
            user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newConvError) {
          console.error("Error creating new conversation:", newConvError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create new conversation",
            cause: newConvError,
          });
        }

        conversationId = newConversation.id;
      }

      // Initialize model
      const model = getGeminiModel();

      try {
        // Save user message
        const { error: userMessageError } = await ctx.supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            content: input.message,
            type: 'text',
            model_used: 'gemini-1.5-flash-latest',
          });

        if (userMessageError) {
          console.error("Error saving user message:", userMessageError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save user message",
            cause: userMessageError,
          });
        }

        // Generate AI response
        let response;
        let retries = 3;
        let lastError;

        while (retries > 0) {
          try {
            const relevantHistory = history.filter(msg => 
              isWithinConversationWindow(
                new Date(msg.created_at),
                new Date()
              )
            );

            if (relevantHistory.length === 0) {
              response = await model.generateContent(input.message);
            } else {
              const chat = model.startChat({
                history: relevantHistory.map(msg => ({
                  role: msg.user_id === userId ? "user" : "assistant",
                  parts: [{ text: msg.content }],
                })),
              });
              response = await chat.sendMessage(input.message);
            }
            break;
          } catch (error) {
            lastError = error;
            if (error instanceof Error && 
                (error.message.includes("rate limit") || 
                 error.message.includes("429") ||
                 error.message.includes("quota"))) {
              retries--;
              if (retries > 0) {
                const delay = Math.pow(2, 3 - retries) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            throw error;
          }
        }

        if (!response) {
          throw lastError || new Error("Failed to get response after retries");
        }

        const responseText = response.response.text();

        // Save AI response
        const { error: aiMessageError } = await ctx.supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            content: responseText,
            type: 'text',
            model_used: 'gemini-1.5-flash-latest',
          });

        if (aiMessageError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save AI response",
            cause: aiMessageError,
          });
        }

        return { 
          success: true, 
          message: responseText,
          conversationId
        };
      } catch (error) {
        console.error("Error in sendMessage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process your message. Please try again.",
          cause: error,
        });
      }
    }),

  // Get messages for a conversation
  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single();

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        });
      }

      // Get messages for the conversation
      const { data: messages, error: messagesError } = await ctx.supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", input.conversationId.split('_')[0]) // Handle split conversation IDs
        .order("created_at", { ascending: true });

      if (messagesError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch messages",
          cause: messagesError,
        });
      }

      // If this is a split conversation, filter messages by time window
      if (input.conversationId.includes('_')) {
        const splitTime = parseInt(input.conversationId.split('_')[1]);
        return messages.filter(msg => {
          const msgTime = new Date(msg.created_at).getTime();
          return Math.abs(msgTime - splitTime) <= 5 * 60 * 1000; // 5 minutes in milliseconds
        });
      }

      return messages;
    }),

  // Rename a conversation
  rename: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single()

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        })
      }

      // Update the conversation title
      const { data: conversation, error: conversationError } = await ctx.supabase
        .from('conversations')
        .update({
          title: input.title,
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (conversationError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to rename conversation',
          cause: conversationError
        })
      }

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or you do not have permission to modify it'
        })
      }

      return conversation
    }),

  // Archive/Unarchive a conversation
  archive: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      archived: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx
      
      // Get user from database using auth0_id
      const { data: user, error: userError } = await ctx.supabase
        .from("users")
        .select("id")
        .eq("auth0_id", session.user.sub)
        .single()

      if (userError || !user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found in database",
          cause: userError,
        })
      }

      // Update the conversation archive status
      const { data: conversation, error: conversationError } = await ctx.supabase
        .from('conversations')
        .update({
          archived: input.archived,
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (conversationError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update conversation archive status',
          cause: conversationError
        })
      }

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or you do not have permission to modify it'
        })
      }

      return conversation
    }),
}) 