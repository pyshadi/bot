from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from ollama._client import AsyncClient
from ollama._types import Message
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import traceback
from fastapi.middleware.cors import CORSMiddleware



# Initialize the FastAPI app
app = FastAPI()
client = AsyncClient(host="http://127.0.0.1:11434")  # your LLaMA model server
app.mount("/static", StaticFiles(directory="static"), name="static")

class ChatRequest(BaseModel):
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
    return FileResponse("static/index.html")

@app.post("/chat/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        message = Message(content=request.user_input, role="user")
        result = await client.chat(model=request.model, messages=[message])
        # Extracting the response content
        chat_response = result.get('message', {}).get('content', "No response generated.")
        return ChatResponse(response=chat_response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test/")
async def test_endpoint():
    return {"response": "Test successful"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
