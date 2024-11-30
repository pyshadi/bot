from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from ollama._client import AsyncClient
from ollama._types import Message
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from pathlib import Path

# Initialize the FastAPI app
app = FastAPI()
client = AsyncClient(host="http://127.0.0.1:11434")  # your LLaMA model server
app.mount("/static", StaticFiles(directory="static"), name="static")

# Memory store for conversation history
conversation_histories: Dict[str, List[Message]] = {}

class ChatRequest(BaseModel):
    session_id: str
    model: str
    user_input: str

class ChatResponse(BaseModel):
    response: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_index():
    static_dir = Path("static")
    index_file = static_dir / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Index file not found.")
    return FileResponse(index_file)

@app.post("/chat/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Retrieve or initialize the conversation history for the session
        if request.session_id not in conversation_histories:
            conversation_histories[request.session_id] = []

        # Add the user's message to the conversation history
        conversation_histories[request.session_id].append(
            Message(content=request.user_input, role="user")
        )

        # Send the conversation history to the LLaMA server
        result = await client.chat(
            model=request.model,
            messages=conversation_histories[request.session_id]
        )

        # Extract the response content
        chat_response = result.get('message', {}).get('content', "No response generated.")

        # Add the model's response to the conversation history
        conversation_histories[request.session_id].append(
            Message(content=chat_response, role="assistant")
        )

        return ChatResponse(response=chat_response)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
