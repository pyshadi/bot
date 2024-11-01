# Chat Application with LLaMA Integration

This project is a simple chat application that interacts with the LLaMA language model via a web interface. The application uses **FastAPI** to create an API for sending user input to the LLaMA model and receiving AI-generated responses. **Prism.js** is integrated into the front end to highlight code syntax, enhancing readability in AI-generated code snippets.

## Features

- **User Messaging Interface**: Enables users to send text messages to the AI.
- **AI Response Formatting**: Displays AI responses with support for code blocks.
- **Syntax Highlighting**: Utilizes Prism.js to highlight syntax in Python code blocks.
- **Message Editing**: Users can edit previous messages and get revised AI responses.

## Prerequisites

- Python 3.8+
- FastAPI
- Uvicorn
- Prism.js (included via CDN)

## Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/chat-app-llama.git
   cd chat-app-llama
   ```
