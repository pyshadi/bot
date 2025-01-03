import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import time

# Dynamically add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app import app

# Fixture for TestClient
@pytest.fixture
def client():
    return TestClient(app)

# Mock data
mock_chat_request = {
    "session_id": "test-session",
    "model": "llama3.1",
    "user_input": "Hello!",
}

### Tests ###

# Test root endpoint
def test_read_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

# Test valid /chat/ endpoint request
def test_chat_endpoint_success(client):
    response = client.post("/chat/", json=mock_chat_request)
    assert response.status_code == 200
    assert "response" in response.json()

# Test invalid session_id
def test_chat_invalid_session_id(client):
    invalid_request = {
        "model": "llama3.1",
        "user_input": "Hello!",
    }  # missing session_id
    response = client.post("/chat/", json=invalid_request)
    assert response.status_code == 422  # missing fields

# Test unsupported model name
def test_chat_unsupported_model(client):
    unsupported_model_request = {
        "session_id": "test-session",
        "model": "unknown-model",
        "user_input": "Hello!",
    }
    response = client.post("/chat/", json=unsupported_model_request)
    assert response.status_code == 400

# Test empty user_input
def test_chat_empty_input(client):
    empty_input_request = {
        "session_id": "test-session",
        "model": "llama3.1",
        "user_input": "",
    }
    response = client.post("/chat/", json=empty_input_request)
    assert response.status_code == 400

# Test large input
def test_chat_large_input(client):
    large_input = "A" * 10001  # max input size is 10,000 characters
    large_input_request = {
        "session_id": "test-session",
        "model": "llama3.1",
        "user_input": large_input,
    }
    response = client.post("/chat/", json=large_input_request)
    assert response.status_code == 413  # Payload Too Large

# Test index.html
def test_static_index(client):
    response = client.get("/static/index.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

# Test non existent file
def test_static_nonexistent(client):
    response = client.get("/static/nonexistent-file.js")
    assert response.status_code == 404  # File not found

# Test /run-python/ endpoint with valid Python code
def test_run_python_valid_code(client):
    valid_code_request = {
        "blocks": ["print('Hello, World!')"]
    }
    response = client.post("/run-python/", json=valid_code_request)
    assert response.status_code == 200
    assert response.json()["output"] == "Hello, World!\n"

# Test /run-python/ endpoint with invalid Python code
def test_run_python_invalid_code(client):
    invalid_code_request = {
        "blocks": ["print('Hello)"]
    }
    response = client.post("/run-python/", json=invalid_code_request)
    assert response.status_code == 200
    assert "error" in response.json()

# Test /run-python/ endpoint with execution timeout
def test_run_python_timeout(client):
    timeout_code_request = {
        "blocks": ["while True: pass"]
    }
    response = client.post("/run-python/", json=timeout_code_request)
    assert response.status_code == 200
    assert response.json()["error"] == "Code execution timed out."

# Test /analyze-code-block/ endpoint with pure definition
def test_analyze_code_pure_definition(client):
    pure_definition_request = {
        "code": "def foo(): pass\nclass Bar: pass"
    }
    response = client.post("/analyze-code-block/", json=pure_definition_request)
    assert response.status_code == 200
    assert response.json()["pure_definition"] is True
    assert response.json()["executable"] is False

# Test /analyze-code-block/ endpoint with executable code
def test_analyze_code_executable(client):
    executable_code_request = {
        "code": "x = 42\nprint(x)"
    }
    response = client.post("/analyze-code-block/", json=executable_code_request)
    assert response.status_code == 200
    assert response.json()["pure_definition"] is False
    assert response.json()["executable"] is True

# Test /analyze-code-block/ endpoint with invalid syntax
def test_analyze_code_invalid_syntax(client):
    invalid_code_request = {
        "code": "def foo( pass"
    }
    response = client.post("/analyze-code-block/", json=invalid_code_request)
    assert response.status_code == 400
    assert "detail" in response.json()
    
# Test rate limiting
def test_chat_rate_limit(client):
    time.sleep(60)
    for _ in range(6):  # Send more than 5 requests in minute
        response = client.post("/chat/", json=mock_chat_request)
        time.sleep(1)
    assert response.status_code == 429  # Too many Requests