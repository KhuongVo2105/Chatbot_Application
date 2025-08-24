import { Message, MessageSimple } from "@/types/message";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { create } from "domain";

type CreateAllResult = {
  rag: Message;
  raw: Message;
  rawModel: Message;
};

export const messageApi = createApi({
  reducerPath: "messageApi",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    prepareHeaders: (headers) => {
      const token = sessionStorage.getItem("access_token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Message"],
  endpoints: (builder) => ({
    /**
     * Get message ids in conversation
     */
    getMessageIds: builder.query<string[], string>({
      query: (conversationId) => ({
        url: `/messages/conversation/${conversationId}/ids`,
        method: "GET",
      }),
      providesTags: ["Message"],
      transformResponse: (response: any) => {
        return response.data;
      },
    }),

    /**
     * Get messages in conversation
     */
    getMessages: builder.query<Message[], string>({
      query: (conversationId) => ({
        url: `/messages/conversation/${conversationId}`,
        method: "GET",
      }),
      providesTags: ["Message"],
      transformResponse: (response: any) => {
        return response.data.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversation,
          role: msg.sender_type === "User" ? "user" : "ai",
          content: msg.content,
          createdAt: new Date(msg.created_at),
        }));
      },
    }),

    getMessage: builder.query<Message, string>({
      query: (messageId) => ({
        url: `/messages/${messageId}`,
        method: "GET",
      }),
      providesTags: ["Message"],
      transformResponse: (response: any) => {
        const msg = response.data;
        return {
          id: msg.id,
          conversationId: msg.conversation,
          role: msg.sender_type === "User" ? "user" : "ai",
          content: msg.content,
          createdAt: new Date(msg.created_at),
        };
      },
    }),

    createMessage: builder.mutation<CreateAllResult, MessageSimple>({
      // use queryFn to perform multiple requests
      queryFn: async (body, { signal }, _extraOptions, baseQuery) => {
        const payload = {
          conversation_id: body.conversationId,
          // backend ignores sender_type on some routes; harmless to send
          sender_type: body.role === "user" ? "User" : "Bot",
          content: body.content,
        };

        const requests = [
          baseQuery({ url: "/messages/", method: "POST", body: payload, signal }),          // rag
          baseQuery({ url: "/messages/raw/", method: "POST", body: payload, signal }),      // raw
          baseQuery({ url: "/messages/raw-model/", method: "POST", body: payload, signal }),// rawModel
        ] as const;

        const [ragRes, rawRes, rawModelRes] = await Promise.all(requests);

        // bubble the first error encountered
        if ("error" in ragRes && ragRes.error) return { error: ragRes.error };
        if ("error" in rawRes && rawRes.error) return { error: rawRes.error };
        if ("error" in rawModelRes && rawModelRes.error) return { error: rawModelRes.error };

        const toMessage = (resp: any): Message => {
          const msg = resp.data;
          return {
            id: msg.id,
            conversationId: msg.conversation,
            role: msg.sender_type === "User" ? "user" : "ai",
            content: msg.content,
            createdAt: new Date(msg.created_at),
          };
        };

        const data: CreateAllResult = {
          rag: toMessage((ragRes as any).data),
          raw: toMessage((rawRes as any).data),
          rawModel: toMessage((rawModelRes as any).data),
        };

        return { data };
      },
      invalidatesTags: ["Message"],
    }),

    deleteMessage: builder.mutation<void, string>({
      query: (messageId) => ({
        url: `/messages/${messageId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Message"],
    }),
  }),
});

export const {
  useGetMessageIdsQuery,
  useGetMessagesQuery,
  useCreateMessageMutation,
  useDeleteMessageMutation,
  useGetMessageQuery,
} = messageApi;
