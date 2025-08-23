from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from beanie import PydanticObjectId
from typing import List
from huggingface_hub import InferenceClient

from app.models.message import Message, MessageCreate, MessageOut
from app.models.conversation import Conversation
from app.models.user import User
from app.routes.user import get_current_user
from app.core.response import Response
from app.core.config import settings
from app.rag.rag_module import rag as rag_instance

route = APIRouter(
    prefix="/messages",
    tags=["Messages"]
)

HUGGING_FACE_API_KEY = settings.HUGGING_FACE_API_KEY
HUGGING_FACE_MODEL_ID = settings.HUGGING_FACE_MODEL_ID

print("HUGGING_FACE_API_KEY: ", HUGGING_FACE_API_KEY, " - ",
      "HUGGING_FACE_MODEL_ID: ", HUGGING_FACE_MODEL_ID)

client = InferenceClient(
    model=HUGGING_FACE_MODEL_ID,
    token=HUGGING_FACE_API_KEY
)

raw_client = InferenceClient(
    model=HUGGING_FACE_MODEL_ID,
    token=HUGGING_FACE_API_KEY
)


@route.get("/conversation/{conversation_id}/ids", response_model=Response[List[PydanticObjectId]])
async def get_message_ids_in_conversation(conversation_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """
    Get a list of IDs of all messages in a specific conversation.
    """
    conversation = await Conversation.find_one(Conversation.id == conversation_id, Conversation.user.id == current_user.id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Conversation not found or you don't have permission")

    messages = await Message.find(Message.conversation.id == conversation_id).project(Message).to_list()
    message_ids = [msg.id for msg in messages]
    return Response(data=message_ids)


@route.get("/conversation/{conversation_id}", response_model=Response[List[MessageOut]])
async def get_messages_in_conversation(conversation_id: PydanticObjectId, skip: int = 0, limit: int = 100, current_user: User = Depends(get_current_user)):
    """
    Get a list of messages of a specific conversation with pagination.
    """
    conversation = await Conversation.find_one(Conversation.id == conversation_id, Conversation.user.id == current_user.id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Conversation not found or you don't have permission")

    messages = await Message.find(Message.conversation.id == conversation_id).sort(+Message.created_at).skip(skip).limit(limit).to_list()
    return Response(data=messages)


@route.get("/{message_id}", response_model=Response[MessageOut])
async def get_message(message_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """
    Get details of a specific message.
    """
    message = await Message.get(message_id, fetch_links=True)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.conversation.user.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have permission to access this message")

    return Response(data=message)


@route.post("/", status_code=status.HTTP_201_CREATED, response_model=Response[MessageOut])
async def create_message_with_rag(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    """
    Create a new message in a conversation.
    """
    global rag
    conversation = await Conversation.find_one(Conversation.id == message_data.conversation_id, Conversation.user.id == current_user.id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Conversation not found or you don't have permission")

    new_user_message = Message(**message_data.model_dump(
        exclude={"conversation_id"}), conversation=conversation.id, sender_type="User")
    await new_user_message.insert()

    rag_context = rag_instance.generate_prompt(message_data.content)

    try:
        completion = client.chat.completions.create(
            model=client.model,
            messages=[
                {"role": "user", "content": rag_context}
            ],
        )
        chatbot_response_content = completion.choices[0].message.content
    except Exception as e:
        # Xử lý lỗi nếu việc gọi API Hugging Face thất bại
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to get response from chatbot: {e}")

    new_bot_message = Message(conversation=conversation.id,
                              sender_type="Bot",
                              content="RAG + fine-tuned models : " + chatbot_response_content)
    await new_bot_message.insert()

    await conversation.update_last_updated()

    return Response(status_code=status.HTTP_201_CREATED, message="Message created successfully with bot response", data=new_bot_message)


@route.post("/raw/", status_code=status.HTTP_201_CREATED, response_model=Response[MessageOut])
async def create_raw_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    """ Create a new raw message in a conversation without RAG processing.
    """
    conversation = await Conversation.find_one(
        Conversation.id == message_data.conversation_id,
        Conversation.user.id == current_user.id
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or you don't have permission"
        )

    try:
        completion = client.chat.completions.create(
            model=client.model,
            messages=[
                {"role": "user", "content": message_data.content}
            ],
        )
        chatbot_response_content = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get response from chatbot: {e}"
        )

    new_bot_message = Message(
        conversation=conversation.id,
        sender_type="Bot",
        content="fine-tuned models : " + chatbot_response_content
    )
    await new_bot_message.insert()
    await conversation.update_last_updated()
    return Response(
        status_code=status.HTTP_201_CREATED,
        message="Raw message created successfully with bot response",
        data=new_bot_message
    )


# FIX: add leading slash
@route.post("/raw-model/", status_code=status.HTTP_201_CREATED, response_model=Response[MessageOut])
async def create_raw_message_with_model(
    message_data: MessageCreate,
    # FIX: pass the dependency callable
    current_user: User = Depends(get_current_user)
):
    """ Create a new raw message using the 'raw_client' model. """
    conversation = await Conversation.find_one(
        Conversation.id == message_data.conversation_id,
        Conversation.user.id == current_user.id
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or you don't have permission"
        )

    try:
        completion = raw_client.chat.completions.create(
            model=raw_client.model,
            messages=[
                {"role": "user", "content": message_data.content}
            ],
        )
        chatbot_response_content = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get response from chatbot: {e}"
        )

    new_bot_message = Message(
        conversation=conversation.id,
        sender_type="Bot",
        content="raw-model : " + chatbot_response_content
    )
    await new_bot_message.insert()
    await conversation.update_last_updated()
    return Response(
        status_code=status.HTTP_201_CREATED,
        message="Raw message created successfully with raw bot response",
        data=new_bot_message
    )


@route.delete("/{message_id}", response_model=Response)
async def delete_message(message_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """
    Delete a specific message.
    """
    message = await Message.get(message_id, fetch_links=True)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.conversation.user.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have permission to delete this message")

    await message.delete()
    return Response(message="Message deleted successfully")
