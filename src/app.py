import logging
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from ollama._client import AsyncClient
from ollama._types import Message
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import List, Dict
from pathlib import Path
from typing import Optional
import ast
import io
from contextlib import redirect_stdout, redirect_stderr
import asyncio
from threading import Lock


# Pydantic models
class CodeExecutionRequest(BaseModel):
    session_id: str
    blocks: List[str]

class CodeExecutionResponse(BaseModel):
    output: str
    error: Optional[str] = None

class CodeAnalysisRequest(BaseModel):
    code: str

class CodeAnalysisResponse(BaseModel):
    pure_definition: bool
    executable: bool



logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# LLaMA client
client = AsyncClient(host="http://127.0.0.1:11434")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Memory store for conversation history
conversation_histories: Dict[str, List[Message]] = {}

# Execution contexts per session
execution_contexts: Dict[str, Dict] = {}
session_namespaces: Dict[str, Dict] = {}
session_locks: Dict[str, asyncio.Lock] = {}

limiter = Limiter(key_func=get_remote_address)

# CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limit error handler
@app.middleware("http")
async def rate_limit_exceeded_handler(request: Request, call_next):
    try:
        return await call_next(request)
    except RateLimitExceeded as e:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )

# Pydantic models for request and response
class ChatRequest(BaseModel):
    session_id: str
    model: str
    user_input: str

class ChatResponse(BaseModel):
    response: str

SUPPORTED_MODELS = ["llama3.1", "llama3"]
MAX_INPUT_LENGTH = 10000

@app.get("/")
async def read_index():
    static_dir = Path("static")
    index_file = static_dir / "index.html"
    if not index_file.exists():
        logger.error("Index file not found in the static directory.")
        raise HTTPException(status_code=404, detail="The requested resource could not be found.")
    return FileResponse(index_file)

@app.post("/chat/", response_model=ChatResponse)
@limiter.limit("5/minute")
async def chat(request: Request, body: ChatRequest):
    try:
        if body.model not in SUPPORTED_MODELS:
            raise HTTPException(status_code=400, detail="Unsupported model name.")
        
        if not body.user_input.strip():
            raise HTTPException(status_code=400, detail="User input cannot be empty.")
        
        if len(body.user_input) > MAX_INPUT_LENGTH:
            raise HTTPException(status_code=413, detail="Input is too large.")

        # Retrieve / initialize conversation history for the session
        if body.session_id not in conversation_histories:
            conversation_histories[body.session_id] = []

        # Add user message to conversation history
        conversation_histories[body.session_id].append(
            Message(content=body.user_input, role="user")
        )

        try:
            result = await client.chat(
                model=body.model,
                messages=conversation_histories[body.session_id]
            )
        except Exception as e:
            logger.error(f"Error while calling client.chat: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to process the chat request.")


        # response content
        chat_response = result.get('message', {}).get('content', "No response generated.")

        conversation_histories[body.session_id].append(
            Message(content=chat_response, role="assistant")
        )

        return ChatResponse(response=chat_response)

    except HTTPException as e:
        logger.error(f"HTTP Exception: {e.detail}")
        raise e
    except Exception as e:
        logger.exception("An error occurred while processing the chat request.")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later."
        )

@app.post("/run-python/", response_model=CodeExecutionResponse)
async def run_python_code(body: CodeExecutionRequest):
    session_id = body.session_id
    blocks = body.blocks

    # Initialize namespace and lock if not present
    if session_id not in session_namespaces:
        session_namespaces[session_id] = {}
    if session_id not in session_locks:
        session_locks[session_id] = asyncio.Lock()

    namespace = session_namespaces[session_id]
    lock = session_locks[session_id]

    output = ""
    error = ""

    async with lock:
        for block in blocks:
            f_stdout = io.StringIO()
            f_stderr = io.StringIO()
            try:
                # Execute the code block within the session's namespace
                with redirect_stdout(f_stdout), redirect_stderr(f_stderr):
                    exec(block, namespace)
                # Accumulate stdout
                output += f_stdout.getvalue()
                # Accumulate stderr
                error += f_stderr.getvalue()
            except Exception as e:
                # Accumulate exception message
                error += str(e)
                break  # Stop executing further blocks on exception

    # Set error to None if no errors occurred
    combined_error = error if error else None

    return CodeExecutionResponse(output=output, error=combined_error)

@app.post("/analyze-code-block/", response_model=CodeAnalysisResponse)
async def analyze_code_block(body: CodeAnalysisRequest):
    """
    Analyze the provided Python code to classify it as a pure definition or executable block.
    """
    try:
        code = body.code
        tree = ast.parse(code)

        # Check if all top-level nodes are pure definitions (FunctionDef, ClassDef, Import)
        is_pure_definition = all(
            isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.Import, ast.ImportFrom))
            for node in tree.body
        )

        # Check if there are any executable statements at the top level
        has_executable = any(
            isinstance(node, (ast.Expr, ast.Assign, ast.Call, ast.AugAssign, ast.Return))
            for node in tree.body
        )

        return CodeAnalysisResponse(pure_definition=is_pure_definition, executable=has_executable)

    except SyntaxError as e:
        logger.error(f"SyntaxError while analyzing code: {e}")
        raise HTTPException(status_code=400, detail="The provided code is invalid.")
    except Exception as e:
        logger.error(f"Unexpected error while analyzing code: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while analyzing the code.")

