let editingMessageElement = null; // track element being edited

function sendMessage() {
  const input = document.getElementById("inputBox");
  const user_input = input.value.trim();

  if (!user_input) return;

  if (editingMessageElement) {
    updateUserMessage(user_input);
    removeSubsequentMessages(editingMessageElement);

    let aiMessageElement = editingMessageElement.nextElementSibling;
    if (
      !aiMessageElement ||
      !aiMessageElement.classList.contains("ai-message")
    ) {
      aiMessageElement = displayMessage("...", "ai-message");
    }
    fetchAIResponse(user_input, aiMessageElement);
    editingMessageElement = null;
  } else {
    const userMessageContainer = displayMessage(user_input, "user-message", true);
    const aiMessageElement = displayMessage("...", "ai-message");
    fetchAIResponse(user_input, aiMessageElement);
  }
  input.value = "";
}

document.getElementById("inputBox").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

function fetchAIResponse(user_input, aiMessageElement) {
  fetch("http://127.0.0.1:8000/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "llama3.1", user_input: user_input }),
  })
    .then((response) => response.json())
    .then((data) => {
      aiMessageElement.innerHTML = ""; // clear previous content
      formatResponse(data.response).forEach((element) => {
        aiMessageElement.appendChild(element);
      });
      Prism.highlightAll(); // Apply syntax highlighting
    })
    .catch((error) => {
      console.error("Error:", error);
      aiMessageElement.textContent = "There was an error processing your request.";
    });
}

function formatResponse(response) {
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = response.split(codeBlockRegex);
  const elements = [];

  parts.forEach((part, index) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "block"; // Ensure each part is on its own line

    if (index % 2 === 0) {
      // Text section
      wrapper.textContent = part;
      wrapper.className = "text-block";
    } else {
      // Code section
      const codeContainer = document.createElement("pre");
      const codeElement = document.createElement("code");
      codeElement.className = "language-python";
      codeElement.innerHTML = escapeHTML(part);
      codeContainer.appendChild(codeElement);
      wrapper.appendChild(codeContainer);
      wrapper.className = "code-block";
    }
    elements.push(wrapper);
  });

  return elements;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayMessage(content, className, isUser = false) {
  const messagesList = document.getElementById("messages");

  const messageContainer = document.createElement("div");
  messageContainer.className = "message-container";

  if (isUser) {
    const userContainer = document.createElement("div");
    userContainer.className = "user-message-container";

    const message = document.createElement("div");
    message.className = `message user-message`;
    message.textContent = content;

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.textContent = "Edit";
    editButton.onclick = () => enableEditing(messageContainer);

    userContainer.appendChild(editButton);
    userContainer.appendChild(message);

    messageContainer.appendChild(userContainer);
  } else {
    const message = document.createElement("div");
    message.className = `message ${className}`;
    formatResponse(content).forEach((element) => {
      message.appendChild(element);
    });
    messageContainer.appendChild(message);
  }

  messagesList.appendChild(messageContainer);
  messagesList.scrollTop = messagesList.scrollHeight;

  return messageContainer;
}

function enableEditing(messageContainer) {
  editingMessageElement = messageContainer;
  const messageContent = messageContainer.querySelector(".user-message");
  const currentText = messageContent.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentText;
  input.className = "editable-input";
  input.onblur = () => saveEdit(input);
  input.onkeypress = (e) => {
    if (e.key === "Enter") saveEdit(input);
  };

  messageContent.replaceWith(input);
  input.focus();
}

function saveEdit(inputElement) {
  const newText = inputElement.value.trim();

  if (newText && editingMessageElement) {
    updateUserMessage(newText);
    removeSubsequentMessages(editingMessageElement);

    let aiMessage = editingMessageElement.nextElementSibling;
    if (!aiMessage || !aiMessage.classList.contains("ai-message")) {
      aiMessage = displayMessage("...", "ai-message");
    }

    fetchAIResponse(newText, aiMessage);
  }

  editingMessageElement = null;
}

function updateUserMessage(newText) {
  const inputElement = editingMessageElement.querySelector(".editable-input");

  const messageContent = document.createElement("div");
  messageContent.className = "message user-message";
  messageContent.textContent = newText;

  inputElement.replaceWith(messageContent);
}

function removeSubsequentMessages(messageContainer) {
  const messagesList = document.getElementById("messages");
  let currentMessage = messageContainer.nextElementSibling;

  while (currentMessage) {
    const nextMessage = currentMessage.nextElementSibling;
    messagesList.removeChild(currentMessage);
    currentMessage = nextMessage;
  }
}

function saveChat() {
  const messagesContainer = document.getElementById("messages");
  let chatContent = "";

  // Loop through all .message-container elements in order
  messagesContainer.querySelectorAll(".message-container").forEach((container, index) => {
    let messageText = "";

    if (index % 2 === 0) {
      // User message
      const userMessageElement = container.querySelector(".user-message");
      if (userMessageElement) {
        messageText = userMessageElement.textContent.trim();
      } else {
        messageText = container.textContent.trim(); // Fallback
      }
      chatContent += "User: " + messageText + "\n";
    } else {
      // AI message
      messageText = container.textContent.trim();
      chatContent += "AI: " + messageText + "\n";
    }
  });

  console.log("Generated Chat Content:\n", chatContent); // Log to verify captured content

  // Create a Blob with the chat content and trigger download
  const blob = new Blob([chatContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "chat.txt";
  link.click();

  // Clean up URL object
  URL.revokeObjectURL(url);
}

function clearChat() {
    const messagesContainer = document.getElementById("messages");
    messagesContainer.innerHTML = ""; // Clear all messages
  }