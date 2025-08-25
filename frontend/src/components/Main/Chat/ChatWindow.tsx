'use client'
import React, { useEffect, useRef, useState } from 'react'
import PromptInput from './PromptInput'
import { Message } from '@/types/message'
import { useTranslations } from 'next-intl'
import { useCreateMessageMutation, useGetMessagesQuery } from '@/store/api/messageApi'
import { toast } from 'react-toastify'
import MessageBubble from './MessageBubble'
import { nanoid } from '@reduxjs/toolkit'
import TypingIndicator from './TypingIndicator'
import { useCreateConversationMutation } from '@/store/api/conversationApi'

interface ChatWindowProps {
    setIsLoading: (isLoading: boolean) => void
    currentConversation: string
    onConversationCreated: (conversationId: string) => void;
}

type LocalMessage = Message & {
    clientId?: string,
    pending?: boolean,
}

const ChatWindow = ({ setIsLoading, currentConversation, onConversationCreated }: ChatWindowProps) => {
    const t = useTranslations('chat')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const prevConversationRef = useRef<string>(currentConversation)

    const [messages, setMessages] = useState<LocalMessage[]>([])
    const [isBotTyping, setIsBotTyping] = useState(false)

    const [createConversation] = useCreateConversationMutation();
    const [createMessage] = useCreateMessageMutation();

    const {
        data: fetchedMessages,
        isLoading: isFetchingMessages,
        error: fetchError,
        isSuccess: isFetchSuccess,
        isError: isFetchError,
        refetch: refetchMessages,
    } = useGetMessagesQuery(currentConversation, {
        skip: !currentConversation,
    });

    useEffect(() => {
        if (prevConversationRef.current !== currentConversation) {
            setMessages([]);
            setIsBotTyping(false);
            prevConversationRef.current = currentConversation;
        }
    }, [currentConversation]);

    // update global spinner only when fetching conversation messages (not during create)
    useEffect(() => {
        setIsLoading(isFetchingMessages);
    }, [isFetchingMessages, setIsLoading]);

    // Sync fetchedMessages incrementally: keep existing + append new ones (e.g., bot reply)
    useEffect(() => {
        if (isFetchSuccess) {
            if (fetchedMessages && fetchedMessages.length > 0) {
                setMessages(prev => {
                    const cleaned = prev.filter(m => {
                        if (m.pending && m.role === 'user') {
                            const similar = fetchedMessages.find(fm =>
                                fm.role === 'user' &&
                                fm.content === m.content &&
                                Math.abs(fm.createdAt.getTime() - m.createdAt.getTime()) < 5000
                            );
                            if (similar) return false
                        }
                        return true
                    });

                    const existingIds = new Set(cleaned.map(m => m.id));
                    const toAdd = fetchedMessages
                        .filter(fm => !existingIds.has(fm.id))
                        .map(fm => ({ ...fm } as LocalMessage));

                    const merged: LocalMessage[] = [...cleaned, ...toAdd];

                    merged.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

                    return merged;
                });
                // If bot message arrived, hide typing indicator
                const hasBotInFetched = fetchedMessages.some(m => m.role === 'ai');
                if (hasBotInFetched) {
                    setIsBotTyping(false);
                }
            }
        } else {
            setMessages([])
            setIsBotTyping(false)
        }

    }, [isFetchSuccess, fetchedMessages]);

    useEffect(() => {
        if (isFetchError) {
            console.error("Lỗi khi fetch messages:", fetchError);
            toast.error(t('get.failure'));
        }
    }, [isFetchError, fetchError, t]);

    // auto scroll down on message list change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isBotTyping]);

    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;

        let conversationIdToUse = currentConversation;
        const clientTempId = nanoid();

        try {
            if (!conversationIdToUse) {
                setIsLoading(true);
                const newConversation = await createConversation({ title: content.substring(0, 20) + "..." }).unwrap();
                conversationIdToUse = newConversation.id;
                onConversationCreated(conversationIdToUse);
                toast.success(t('conversation_created_success'));
                setIsLoading(false);
            }

            const newUserMessage: LocalMessage = {
                id: clientTempId,
                conversationId: conversationIdToUse,
                role: "user",
                content: content,
                createdAt: new Date(),
                clientId: clientTempId,
                pending: true,
            };

            setMessages(prev => [...prev, newUserMessage].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
            setIsBotTyping(true);

            const serverMsg = await createMessage({
                conversationId: conversationIdToUse,
                role: "user",
                content: content,
            }).unwrap();

            const { rag } = serverMsg;

            setMessages(prev => {
                const updated = prev.filter(m => !(m.pending && m.clientId === clientTempId));

                // Only add if not already present
                [rag].forEach(msg => {
                    if (!updated.some(m => m.id === msg.id)) {
                        updated.push({ ...msg } as LocalMessage);
                    }
                });

                updated.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                return updated;
            });
            setIsBotTyping(false);
            refetchMessages();

        } catch (error) {
            console.error("Lỗi khi gửi tin nhắn hoặc tạo cuộc trò chuyện:", error);
            toast.error(t('send.failure'));

            setMessages(prev => prev.filter(m => !(m.pending && m.clientId === clientTempId)));
        } finally {
            setIsLoading(false);
            setIsBotTyping(false);
        }
    };

    return (
        <div className="flex flex-grow flex-col items-center justify-end p-4">

            <div className="flex-grow w-full overflow-y-auto">
                {isFetchingMessages ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <p>{t('loading_messages_message')}</p>
                    </div>
                ) : (
                    <>
                        {messages.length > 0 ? (
                            messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    role={message.role}
                                    content={message.content}
                                />
                            ))
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                <h1 className="font-bold text-3xl mb-2">{t('welcome_title')}</h1>
                                <h1 className="font-light text-xl text-gray-600">
                                    {currentConversation ? currentConversation : t('no_conversation_selected')}
                                </h1>
                            </div>
                        )}
                        {isBotTyping && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            <div className="w-[70%]">
                <PromptInput onSendMessage={handleSendMessage} />
            </div>
        </div>
    )
}

export default ChatWindow
