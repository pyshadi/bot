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

# Test rate limiting
def test_chat_rate_limit(client):
    time.sleep(60)
    for _ in range(6):  # Send more than 5 requests in minute
        response = client.post("/chat/", json=mock_chat_request)
        time.sleep(1)
    assert response.status_code == 429  # Too many Requests