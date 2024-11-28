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

    // Initialize event listeners
    this.initEventListeners();
  }

  initEventListeners() {
    const inputBox = document.getElementById(this.inputBoxId);
    if (inputBox) {
      inputBox.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
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
      body: JSON.stringify({ model: this.model, user_input: user_input }),
    })
      .then((response) => response.json())
      .then((data) => {
        aiMessageElement.innerHTML = ""; // Clear previous content

        const { diagrams, remainingText } = this.extractMermaidDiagramsAndText(
          data.response
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
      message.textContent = content;

      const editButton = document.createElement("button");
      editButton.className = "edit-button";
      editButton.textContent = "Edit";
      editButton.onclick = () => this.enableEditing(messageContainer);

      userContainer.appendChild(editButton);
      userContainer.appendChild(message);

      messageContainer.appendChild(userContainer);
    } else {
      const message = document.createElement("div");
      message.className = `message ${className}`;
      message.innerHTML = md.render(content); // Render Markdown
      messageContainer.appendChild(message);
    }

    messagesList.appendChild(messageContainer);
    messagesList.scrollTop = messagesList.scrollHeight;

    return messageContainer;
  }

  enableEditing(messageContainer) {
    this.editingMessageElement = messageContainer;
    const messageContent = messageContainer.querySelector(".user-message");
    const currentText = messageContent.textContent;

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.className = "editable-input";
    input.onblur = () => this.saveEdit(input);
    input.onkeypress = (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // prevent the default form submission behavior
        this.saveEdit(input); // Trigger saveEdit explicitly
      }
    };

    messageContent.replaceWith(input);
    input.focus();
  }

  saveEdit(inputElement) {
    clearTimeout(this.saveEditTimeout); // clear pending executions

    this.saveEditTimeout = setTimeout(() => {
      const newText = inputElement.value.trim();

      if (newText && this.editingMessageElement) {
        if (!inputElement.parentNode) {
          console.warn("Input element is no longer part of the DOM.");
          this.editingMessageElement = null; // Reset editing state
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

        this.removeSubsequentMessages(this.editingMessageElement);

        let aiMessage = this.editingMessageElement.nextElementSibling;
        if (
          !aiMessage ||
          !aiMessage.classList.contains("ai-message")
        ) {
          aiMessage = this.displayMessage("...", "ai-message");
        }

        this.fetchAIResponse(newText, aiMessage);
      }

      this.editingMessageElement = null; // Clear editing reference
    }, 10); // Delay 10ms to avoid DOM conflicts
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

    messagesContainer
      .querySelectorAll(".message-container")
      .forEach((container, index) => {
        let messageText = "";

        if (index % 2 === 0) {
          const userMessageElement =
            container.querySelector(".user-message");
          messageText = userMessageElement
            ? userMessageElement.textContent.trim()
            : container.textContent.trim();
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
