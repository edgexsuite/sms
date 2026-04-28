import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Check, CheckCheck, User, MessageCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'staff' | 'parent' | 'student';
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatInterfaceProps {
  schoolId: string;
  currentUserId: string;
  currentUserType: 'staff' | 'parent' | 'student';
  targetUserId: string;
  targetUserType: 'staff' | 'parent' | 'student';
  studentId: string;
  targetName: string;
  targetPhoto?: string;
}

export default function ChatInterface({
  schoolId,
  currentUserId,
  currentUserType,
  targetUserId,
  targetUserType,
  studentId,
  targetName,
  targetPhoto
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel(`chat_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${studentId}`
        },
        (payload) => {
          const msg = payload.new as Message;
          // Only add if it belongs to this conversation
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === targetUserId) ||
            (msg.sender_id === targetUserId && msg.receiver_id === currentUserId)
          ) {
            setMessages(prev => [...prev, msg]);
            if (msg.receiver_id === currentUserId) {
              markAsRead(msg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, targetUserId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    setFetchError('');
    try {
      // Use .in() on both sender/receiver instead of nested and() inside or()
      // which can fail silently in some Supabase versions.
      // Combined with student_id filter this correctly scopes to this 1:1 conversation.
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .in('sender_id', [currentUserId, targetUserId])
        .in('receiver_id', [currentUserId, targetUserId])
        .order('created_at', { ascending: true });

      if (error) {
        // Surface the real error so RLS / permission issues are visible
        setFetchError(error.message || 'Failed to load messages');
        return;
      }
      setMessages(data || []);

      // Mark unread messages as read
      const unreadIds = (data || [])
        .filter(m => m.receiver_id === currentUserId && !m.is_read)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setFetchError(err?.message || 'Unexpected error loading messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('id', id);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const msgContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          school_id: schoolId,
          sender_id: currentUserId,
          sender_type: currentUserType,
          receiver_id: targetUserId,
          receiver_type: targetUserType,
          student_id: studentId,
          message: msgContent
        }]);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error sending message:', err);
      const detail = err?.message || err?.details || JSON.stringify(err);
      alert(`Failed to send message:\n${detail}`);
      setNewMessage(msgContent);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#efe7dd] rounded-2xl overflow-hidden border border-gray-200 shadow-xl relative">
      {/* Chat Header */}
      <div className="bg-[#075e54] text-white p-4 flex items-center gap-3 shadow-md z-10">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border border-white/10">
          {targetPhoto ? (
            <img src={targetPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{targetName}</p>
          <p className="text-[10px] text-emerald-100 uppercase tracking-widest font-black">
            {targetUserType === 'staff' ? 'Class Teacher' : 'Parent'}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth custom-scrollbar"
        style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/678/HD-wallpaper-whatsapp-background-whatsapp-texture.jpg")', backgroundSize: '400px' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-white/70 backdrop-blur-sm rounded-3xl p-8 m-4 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="font-bold text-sm text-red-600">Could not load messages</p>
            <p className="text-xs mt-1 text-gray-500 max-w-xs">{fetchError}</p>
            <p className="text-[10px] mt-3 text-gray-400 max-w-xs leading-relaxed">
              If this says "permission denied", run the SQL fix in Supabase → SQL Editor (see setup guide).
            </p>
            <button onClick={fetchMessages} className="mt-4 text-xs font-bold text-emerald-600 hover:underline">
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white/50 backdrop-blur-sm rounded-3xl p-8 m-4 text-center">
            <MessageCircle className="w-12 h-12 text-emerald-200 mb-3" />
            <p className="font-bold text-sm">Start a conversation</p>
            <p className="text-xs mt-1">Discuss student progress or queries here.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === currentUserId;
            const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString();
            
            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="bg-sky-100 text-sky-700 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                      {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
                <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl shadow-sm relative group transition-all",
                    isMe 
                      ? "bg-[#dcf8c6] rounded-tr-none text-gray-800" 
                      : "bg-white rounded-tl-none text-gray-800"
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] text-gray-400 font-bold">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        msg.is_read ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                    {/* Bubble Tail Replacement (CS-ish) */}
                    <div className={cn(
                      "absolute top-0 w-2 h-2",
                      isMe ? "-right-1 bg-[#dcf8c6]" : "-left-1 bg-white",
                      "clip-path-triangle"
                    )} />
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="bg-[#f0f2f5] p-3 flex items-center gap-2 border-t border-gray-200">
        <div className="flex-1 relative">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="w-full bg-white border-none rounded-2xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 resize-none max-h-32"
          />
        </div>
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg",
            newMessage.trim() ? "bg-[#075e54] text-white scale-100" : "bg-gray-300 text-gray-500 scale-90"
          )}
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </form>

      <style>{`
        .clip-path-triangle {
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
