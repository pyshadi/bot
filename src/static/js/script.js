// initialize markdown-it and mermaid globally
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

class ChatApp {
  constructor(config = {}) {
    // Configuration parameters with defaults
    this.apiURL = config.apiURL || "http://127.0.0.1:8000/chat/";
    this.model = config.model || "llama3.1";
    this.inputBoxId = config.inputBoxId || "inputBox";
    this.messagesContainerId = config.messagesContainerId || "messages";
    this.editingMessageElement = null; // Track element being edited
    this.saveEditTimeout = null; // Variable for debouncing
    this.rawResponses = []; // Array to store raw AI responses

    // Initialize event listeners
    this.initEventListeners();
  }

  initEventListeners() {
    const inputBox = document.getElementById(this.inputBoxId);
    if (inputBox) {
      inputBox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault(); // Prevents the default newline insertion
          this.sendMessage();
        }
      });
    }
  
    // Add event listener for the Send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.addEventListener("click", () => this.sendMessage());
    }
  
    // Add event listeners for Save and Clear buttons
    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
      saveButton.addEventListener("click", () => this.saveChat());
    }
  
    const clearButton = document.getElementById("clearButton");
    if (clearButton) {
      clearButton.addEventListener("click", () => this.clearChat());
    }
  }
  
  sendMessage() {
    const input = document.getElementById(this.inputBoxId);
    const user_input = input.value.trim();

    if (!user_input) return;

    if (this.editingMessageElement) {
      this.updateUserMessage(user_input);
      this.removeSubsequentMessages(this.editingMessageElement);

      let aiMessageElement = this.editingMessageElement.nextElementSibling;
      if (
        !aiMessageElement ||
        !aiMessageElement.classList.contains("ai-message")
      ) {
        aiMessageElement = this.displayMessage("...", "ai-message");
      }
      this.fetchAIResponse(user_input, aiMessageElement);
      this.editingMessageElement = null;
    } else {
      this.displayMessage(user_input, "user-message", true); // Directly display the user message
      const aiMessageElement = this.displayMessage("...", "ai-message");
      this.fetchAIResponse(user_input, aiMessageElement);
    }
    input.value = "";
  }

  extractMermaidDiagramsAndText(response) {
    const mermaidCodeRegex = /(?:```mermaid\n([\s\S]*?)```|(?:^|\n)(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)[\s\S]*?(?=\n\S|\n$))/g;
    let match;
    const diagrams = [];
    let remainingText = response;

    // Extract Mermaid diagrams
    while ((match = mermaidCodeRegex.exec(response)) !== null) {
      const diagram = (match[1] || match[0]).trim(); // get matched diagram code
      diagrams.push(diagram);

      // remove diagram from the remaining text
      remainingText = remainingText.replace(match[0], "").trim();
    }

    console.log("Extracted diagrams:", diagrams);
    console.log("Remaining text:", remainingText);

    return { diagrams, remainingText };
  }

  fetchAIResponse(user_input, aiMessageElement) {
    fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, user_input: user_input.trim() }),
    })
      .then((response) => response.json())
      .then((data) => {
        aiMessageElement.innerHTML = ""; // Clear previous content
  
        const rawResponse = data.response; // Store raw response
        this.rawResponses.push(rawResponse); // Save raw response for saving later
  
        const { diagrams, remainingText } = this.extractMermaidDiagramsAndText(
          rawResponse
        );
  
        // Render text as Markdown
        if (remainingText) {
          const textContainer = document.createElement("div");
          textContainer.className = "markdown-text";
          textContainer.innerHTML = md.render(remainingText); // Render Markdown
          aiMessageElement.appendChild(textContainer);
        }
  
        // Render Mermaid diagrams
        diagrams.forEach((diagram, index) => {
          const mermaidContainer = document.createElement("div");
          mermaidContainer.className = "mermaid";
          mermaidContainer.textContent = diagram;
          aiMessageElement.appendChild(mermaidContainer);
  
          try {
            mermaid.init(undefined, mermaidContainer);
          } catch (error) {
            console.error(
              `Mermaid rendering failed for diagram ${index + 1}:`,
              error
            );
            const errorElement = document.createElement("p");
            errorElement.textContent = `Failed to render Mermaid diagram ${
              index + 1
            }. Check the syntax.`;
            aiMessageElement.appendChild(errorElement);
          }
        });
  
        Prism.highlightAll(); // Apply syntax highlighting
      })
      .catch((error) => {
        console.error("Error fetching AI response:", error);
        aiMessageElement.textContent =
          "There was an error processing your request.";
      });
  }

  displayMessage(content, className, isUser = false) {
    const messagesList = document.getElementById(this.messagesContainerId);
  
    const messageContainer = document.createElement("div");
    messageContainer.className = "message-container";
  
    if (isUser) {
      const userContainer = document.createElement("div");
      userContainer.className = "user-message-container";
  
      const message = document.createElement("div");
      message.className = `message user-message`;
      message.innerHTML = md.render(content); // Render Markdown
  
      const editButton = document.createElement("button");
      editButton.className = "edit-button";
      editButton.textContent = "Edit";
      editButton.onclick = () => this.enableEditing(messageContainer);
  
      userContainer.appendChild(editButton);
      userContainer.appendChild(message);
  
      messageContainer.appendChild(userContainer);
    } else {
      const aiContainer = document.createElement("div");
      aiContainer.className = "ai-message-container";
  
      const message = document.createElement("div");
      message.className = `message ai-message`;
      message.innerHTML = md.render(content); // Render Markdown
  
      aiContainer.appendChild(message);
  
      messageContainer.appendChild(aiContainer);
    }
  
    messagesList.appendChild(messageContainer);
    messagesList.scrollTop = messagesList.scrollHeight;
  
    return messageContainer;
  }

  enableEditing(messageContainer) {
    this.editingMessageElement = messageContainer;
    const messageContent = messageContainer.querySelector(".user-message");
    const currentText = messageContent.textContent;
  
    const textarea = document.createElement("textarea");
    textarea.value = currentText;
    textarea.className = "editable-textarea";
    textarea.rows = currentText.split('\n').length || 1; // Adjust rows based on content
  
    // Store the original message content
    textarea.originalMessageContent = messageContent;
  
    textarea.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // Prevent adding a new line
        this.saveEdit(textarea);
      }
    };
    textarea.onblur = () => this.cancelEdit(textarea); // Call cancelEdit on blur
  
    messageContent.replaceWith(textarea);
    textarea.focus();
  }
  
  cancelEdit(textareaElement) {
    if (textareaElement && textareaElement.originalMessageContent) {
      textareaElement.replaceWith(textareaElement.originalMessageContent);
    }
    this.editingMessageElement = null;
  }
  
  saveEdit(textareaElement) {
    clearTimeout(this.saveEditTimeout); // Clear pending executions
  
    // Prevent blur handler from triggering
    textareaElement.onblur = null;
  
    this.saveEditTimeout = setTimeout(() => {
      const newText = textareaElement.value.trim(); // Trim whitespace
  
      if (newText && this.editingMessageElement) {
        const messageContent = document.createElement("div");
        messageContent.className = "message user-message";
        messageContent.innerHTML = md.render(newText); // Render Markdown
  
        try {
          textareaElement.parentNode.replaceChild(messageContent, textareaElement);
        } catch (error) {
          console.error("Error replacing textarea:", error);
          return;
        }
  
        this.removeSubsequentMessages(this.editingMessageElement);
  
        let aiMessage = this.editingMessageElement.nextElementSibling;
        if (!aiMessage || !aiMessage.querySelector('.ai-message')) {
          aiMessage = this.displayMessage("...", "ai-message");
        }
  
        this.fetchAIResponse(newText, aiMessage);
      }
  
      this.editingMessageElement = null; // Clear editing reference
    }, 10); // Delay to avoid DOM conflicts
  }
  
  
  updateUserMessage(newText) {
    const inputElement =
      this.editingMessageElement.querySelector(".editable-input");

    const messageContent = document.createElement("div");
    messageContent.className = "message user-message";
    messageContent.textContent = newText;

    inputElement.replaceWith(messageContent);
  }

  removeSubsequentMessages(messageContainer) {
    const messagesList = document.getElementById(this.messagesContainerId);
    let currentMessage = messageContainer.nextElementSibling;

    while (currentMessage) {
      const nextMessage = currentMessage.nextElementSibling;
      messagesList.removeChild(currentMessage);
      currentMessage = nextMessage;
    }
  }

  saveChat() {
    const messagesContainer = document.getElementById(this.messagesContainerId);
    let chatContent = "";
    let aiResponseIndex = 0; // Track raw AI responses
  
    messagesContainer
      .querySelectorAll(".message-container")
      .forEach((container, index) => {
        if (index % 2 === 0) {
          // User message
          const userMessageElement = container.querySelector(".user-message");
          const userMessage = userMessageElement
            ? userMessageElement.textContent.trim()
            : "";
          chatContent += `User: ${userMessage}\n`;
        } else {
          // AI message
          const rawAIResponse = this.rawResponses[aiResponseIndex++] || "";
          chatContent += `AI (Raw Response): ${rawAIResponse}\n`;
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
  

  clearChat() {
    const messagesContainer = document.getElementById(this.messagesContainerId);
    messagesContainer.innerHTML = ""; // Clear all messages
  }
}

// Usage :
const chatApp = new ChatApp({
  apiURL: "http://127.0.0.1:8000/chat/",
  model: "llama3.1",
  inputBoxId: "inputBox",
  messagesContainerId: "messages",
});
