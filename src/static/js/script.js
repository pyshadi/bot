// initialize markdown-it
const md = window.markdownit({
  highlight: function (str, lang) {
    if (lang && Prism.languages[lang]) {
      try {
        return Prism.highlight(str, Prism.languages[lang], lang);
      } catch (__) {}
    }
    return ''; // default escaping
  },
});

mermaid.initialize({ startOnLoad: false }); // prevent render on load

let editingMessageElement = null; // Track element being edited
let saveEditTimeout; // variable for debouncing

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

function extractMermaidDiagramsAndText(response) {
  const mermaidCodeRegex = /(?:```mermaid\n([\s\S]*?)```|(?:^|\n)(sequenceDiagram|graph\s+\w+)[\s\S]*?(?=\n\S|\n$))/g;
  let match;
  const diagrams = [];
  let remainingText = response;

  // extract Mermaid diagrams
  while ((match = mermaidCodeRegex.exec(response)) !== null) {
    const diagram = (match[1] || match[0]).trim(); // Get matched diagram code
    diagrams.push(diagram);

    // remove diagram from the remaining text
    remainingText = remainingText.replace(match[0], "").trim();
  }

  console.log("Extracted diagrams:", diagrams);
  console.log("Remaining text:", remainingText);

  return { diagrams, remainingText };
}

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

      const { diagrams, remainingText } = extractMermaidDiagramsAndText(data.response);

      // text as Markdown
      if (remainingText) {
        const textContainer = document.createElement("div");
        textContainer.className = "markdown-text";
        textContainer.innerHTML = md.render(remainingText); // Render Markdown
        aiMessageElement.appendChild(textContainer);
      }

      // mermaid diagram
      diagrams.forEach((diagram, index) => {
        const mermaidContainer = document.createElement("div");
        mermaidContainer.className = "mermaid";
        mermaidContainer.textContent = diagram;
        aiMessageElement.appendChild(mermaidContainer);

        try {
          mermaid.init(undefined, mermaidContainer);
        } catch (error) {
          console.error(`Mermaid rendering failed for diagram ${index + 1}:`, error);
          const errorElement = document.createElement("p");
          errorElement.textContent = `Failed to render Mermaid diagram ${index + 1}. Check the syntax.`;
          aiMessageElement.appendChild(errorElement);
        }
      });

      Prism.highlightAll(); // Apply syntax highlighting
    })
    .catch((error) => {
      console.error("Error fetching AI response:", error);
      aiMessageElement.textContent = "There was an error processing your request.";
    });
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
    message.innerHTML = md.render(content); // render Markdown
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
    if (e.key === "Enter") {
      e.preventDefault(); // prevent default form submission behavior
      saveEdit(input); // trigger saveEdit explicitly
    }
  };
  

  messageContent.replaceWith(input);
  input.focus();
}

function saveEdit(inputElement) {
  clearTimeout(saveEditTimeout); // clear pending executions

  saveEditTimeout = setTimeout(() => {
    const newText = inputElement.value.trim();

    if (newText && editingMessageElement) {
      if (!inputElement.parentNode) {
        console.warn("Input element is no longer part of the DOM.");
        editingMessageElement = null; // reset editing state
        return;
      }

      const messageContent = document.createElement("div");
      messageContent.className = "message user-message";
      messageContent.textContent = newText;

      try {
        inputElement.parentNode.replaceChild(messageContent, inputElement);
      } catch (error) {
        console.error("Error replacing input:", error);
        return;
      }

      removeSubsequentMessages(editingMessageElement);

      let aiMessage = editingMessageElement.nextElementSibling;
      if (!aiMessage || !aiMessage.classList.contains("ai-message")) {
        aiMessage = displayMessage("...", "ai-message");
      }

      fetchAIResponse(newText, aiMessage);
    }

    editingMessageElement = null; // Clear editing reference
  }, 10); // delay 10ms to avoid DOM conflicts
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

  messagesContainer.querySelectorAll(".message-container").forEach((container, index) => {
    let messageText = "";

    if (index % 2 === 0) {
      const userMessageElement = container.querySelector(".user-message");
      messageText = userMessageElement ? userMessageElement.textContent.trim() : container.textContent.trim();
      chatContent += "User: " + messageText + "\n";
    } else {
      messageText = container.textContent.trim();
      chatContent += "AI: " + messageText + "\n";
    }
  });

  const blob = new Blob([chatContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "chat.txt";
  link.click();

  URL.revokeObjectURL(url);
}

function clearChat() {
  const messagesContainer = document.getElementById("messages");
  messagesContainer.innerHTML = ""; // clear all messages
}
