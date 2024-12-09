# Chat Application with LLaMA Integration

This project is an AI-driven chat application that interacts with the LLaMA language model via a web interface. It provides features for interactive messaging, file handling, diagram rendering, syntax highlighting, and Python code execution. The backend is powered by FastAPI, and the frontend leverages JavaScript modules.


![UI](\bot\src\assets\screen1.png)


## Features

- **User Messaging Interface**: Send text messages to the AI.
- **AI Response Formatting**: Displays AI responses with support for code.
- **Syntax Highlighting**: Prism.js to highlight syntax in Python code blocks.
- **Message Editing**: Edit previous messages and get revised AI responses.
- **Code Execution**: Execute Python code directly in the chat.
- **File Upload**: Supports `.txt`, `.pdf`, `.docx`, and image files(ocr).
- **Search Functionality**: Search through chat history with highlighting.
- **Diagram Support**: Renders Mermaid diagrams from chat responses.
- **Session Management**: Maintains session history.
- **Save and Load Chats**: Save chat history to a file and load it backS.



## Setup Instructions


1. Clone the repository:
   ```bash
   git clone https://github.com/pyshadi/bot.git
   cd bot
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   uvicorn app:app --reload
   ```
4. Access the application via http://127.0.0.1:8000.


## API Endpoints

### Chat Interaction
##### POST /chat/
Send a message to the AI model and get a response.

##### Request
   ```json
{
  "session_id": "unique-session-id",
  "model": "llama3.1",
  "user_input": "Your message here"
}
```

##### Response
   ```json
{
  "response": "AI-generated response"
}
   ```


### Code Execution
##### POST /run-python/: 
Execute Python code and return the output or errors.

##### Request:

   ```json
{
  "code": "print('Hello, World!')"
}
   ```
##### Response:

   ```json
{
  "output": "Hello, World!",
  "error": null
}
   ```


### Acknowledgments
OpenAI: Llama models.
Mermaid.js: diagram rendering.
OCR.Space API: OCR capabilities.
