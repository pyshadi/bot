// Initialize markdown-it and mermaid globally
const md = window.markdownit({
  highlight: function (str, lang) {
    if (lang && Prism.languages[lang]) {
      try {
        return Prism.highlight(str, Prism.languages[lang], lang);
      } catch (__) {}
    }
    return ""; // default escaping
  },
});
mermaid.initialize({ startOnLoad: false }); // prevent render on load

class Message {
  constructor(content, className) {
    this.content = content;
    this.className = className;
  }

  render() {
    const message = document.createElement("div");
    message.className = `message ${this.className}`;
    message.innerHTML = md.render(this.content); // Render Markdown
    return message;
  }
}

class UserMessage extends Message {
  constructor(content) {
    super(content, "user-message");
  }

  renderWithEditButton(editHandler) {
    const userContainer = document.createElement("div");
    userContainer.className = "user-message-container";

    const messageElement = this.render();

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.textContent = "Edit";
    editButton.onclick = editHandler;

    userContainer.appendChild(editButton);
    userContainer.appendChild(messageElement);

    return userContainer;
  }
}

class AiMessage extends Message {
  constructor(content) {
    super(content, "ai-message");
  }
}

class FileHandler {
  static async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // Read as text for .txt and similar files
      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject("Error reading text file.");
        reader.readAsText(file);
      }
      // Read as binary and use libraries for PDF, Word, etc.
      else if (file.name.endsWith(".pdf")) {
        reader.onload = async () => {
          try {
            const pdfjsLib = window["pdfjs-dist/build/pdf"];
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";
            const pdf = await pdfjsLib.getDocument(reader.result).promise;
            const text = await FileHandler.extractPDFText(pdf);
            resolve(text);
          } catch (error) {
            reject("Error reading PDF file.");
          }
        };
        reader.onerror = () => reject("Error reading binary file.");
        reader.readAsArrayBuffer(file);
      } else {
        reject("Unsupported file type.");
      }
    });
  }

  static async extractPDFText(pdf) {
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return text.trim();
  }

  static saveChat(rawResponses, messagesContainer) {
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
          const rawAIResponse = rawResponses[aiResponseIndex++] || "";
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

  static clearChat(messagesContainer) {
    messagesContainer.innerHTML = ""; // clear all messages
  }
}

class Controls {
  constructor(chatApp) {
    this.chatApp = chatApp;
  }

  addEventListeners() {
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.addEventListener("click", () => this.chatApp.sendMessage());
    }

    const inputBox = document.getElementById(this.chatApp.inputBoxId);
    if (inputBox) {
      inputBox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault(); // prevents the default newline insertion
          this.chatApp.sendMessage();
        }
      });
    }

    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
      saveButton.addEventListener("click", () =>
        FileHandler.saveChat(
          this.chatApp.rawResponses,
          this.chatApp.messagesContainer
        )
      );
    }

    const clearButton = document.getElementById("clearButton");
    if (clearButton) {
      clearButton.addEventListener("click", () =>
        FileHandler.clearChat(this.chatApp.messagesContainer)
      );
    }
  }
}

// Chat class
class Chat {
  constructor(config = {}) {
    this.apiURL = config.apiURL || "http://127.0.0.1:8000/chat/";
    this.model = config.model || "llama3.1";
    this.inputBoxId = config.inputBoxId || "inputBox";
    this.messagesContainerId = config.messagesContainerId || "messages";
    this.messagesContainer = document.getElementById(this.messagesContainerId);
    this.editingMessageElement = null; // Track element being edited
    this.rawResponses = []; // Array to store raw AI responses
    this.controls = new Controls(this);

    // Initialize controls
    this.controls.addEventListeners();

    // Add attach button handler
    const attachButton = document.getElementById("attachButton");
    const fileInput = document.getElementById("fileInput");

    if (attachButton && fileInput) {
      attachButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (event) =>
        this.handleFileUpload(event)
      );
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fileText = await FileHandler.readFile(file);
      console.log("File content:", fileText);

      const userMessage = new UserMessage(fileText);
      const userMessageContainer = this.createMessageContainer();
      userMessageContainer.appendChild(
        userMessage.renderWithEditButton(() =>
          this.enableEditing(userMessageContainer)
        )
      );
      this.messagesContainer.appendChild(userMessageContainer);

      const aiMessageContainer = this.createMessageContainer();
      this.messagesContainer.appendChild(aiMessageContainer);

      this.fetchAIResponse(fileText, aiMessageContainer);
    } catch (error) {
      console.error("Error handling file upload:", error);
      alert("Failed to process the file: " + error);
    }
  }

  sendMessage() {
    const inputBox = document.getElementById(this.inputBoxId);
    const userInput = inputBox.value.trim();

    if (!userInput) return;

    if (this.editingMessageElement) {
      this.updateUserMessage(userInput);
      this.editingMessageElement = null;
    } else {
      const userMessage = new UserMessage(userInput);
      const userMessageContainer = this.createMessageContainer();
      userMessageContainer.appendChild(
        userMessage.renderWithEditButton(() =>
          this.enableEditing(userMessageContainer)
        )
      );
      this.messagesContainer.appendChild(userMessageContainer);

      const aiMessageContainer = this.createMessageContainer();
      this.messagesContainer.appendChild(aiMessageContainer);

      this.fetchAIResponse(userInput, aiMessageContainer);
    }

    inputBox.value = "";
    this.scrollToBottom();
  }

  fetchAIResponse(userInput, aiMessageElement) {
    console.log("Fetching AI response...");

    aiMessageElement.classList.add("ai-message");

    // Add the spinner as the loading indicator
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    aiMessageElement.appendChild(spinner);
    console.log("Spinner added:", spinner);

    fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, user_input: userInput.trim() }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("AI response received, clearing spinner...");
        aiMessageElement.innerHTML = ""; // Clear spinner

        const rawResponse = data.response; // Save raw response

        // Update or append the raw response in the array
        const messageIndex = Array.from(
          this.messagesContainer.children
        ).indexOf(aiMessageElement);
        const aiIndex = Math.floor(messageIndex / 2);

        // Replace the existing raw response if it exists, or add a new one
        this.rawResponses[aiIndex] = rawResponse;

        const { diagrams, remainingText } =
          this.extractMermaidDiagramsAndText(rawResponse);

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
            console.log(`Initializing Mermaid diagram ${index + 1}`);
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
        aiMessageElement.innerHTML =
          "There was an error processing your request.";
      });
  }

  createMessageContainer() {
    const container = document.createElement("div");
    container.className = "message-container";
    return container;
  }

  enableEditing(messageContainer) {
    console.log("Enabling editing for message container:", messageContainer);

    this.editingMessageElement = messageContainer;
    const messageContent = messageContainer.querySelector(".user-message");
    if (!messageContent) {
      console.error("No user message found in the container.");
      return;
    }

    const currentText = messageContent.textContent;
    console.log("Current text in the message:", currentText);

    const textarea = document.createElement("textarea");
    textarea.value = currentText;
    textarea.className = "editable-textarea";
    textarea.rows = currentText.split("\n").length;

    // Store the original text for restoring on cancel
    textarea.dataset.originalText = currentText;

    console.log("Replacing message content with textarea:", textarea);

    try {
      messageContent.replaceWith(textarea);
    } catch (error) {
      console.error("Error replacing message content with textarea:", error);
      return;
    }

    textarea.focus();
    console.log("Textarea focused for editing.");

    // Handle saving on Enter and canceling on blur
    textarea.onkeydown = (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // Prevent new line
        console.log("Enter pressed, saving edit...");
        this.saveEdit(textarea, messageContainer);
      }
    };

    textarea.onblur = () => {
      console.log("Textarea lost focus, canceling edit...");
      this.cancelEdit(textarea, messageContainer);
    };
  }

  saveEdit(textarea, messageContainer) {
    console.log("Saving edited message...");

    const newText = textarea.value.trim();
    console.log("New text entered by user:", newText);

    if (!newText) {
      console.error("New text is empty, aborting save.");
      return;
    }

    try {
      // Create a new UserMessage instance
      const userMessage = new UserMessage(newText);

      // Render the updated user message with the edit button
      const userMessageElement = userMessage.renderWithEditButton(() => {
        console.log("Edit button clicked, re-enabling editing...");
        this.enableEditing(messageContainer);
      });

      console.log(
        "Replacing textarea with new user message element:",
        userMessageElement
      );

      // Debug: Check messageContainer before update
      console.log(
        "Before replacing container content:",
        messageContainer.innerHTML
      );

      // Replace the message container's content with the new user message
      messageContainer.innerHTML = ""; // Clear existing content
      messageContainer.appendChild(userMessageElement);

      // Debug: Check messageContainer after update
      console.log(
        "After replacing container content:",
        messageContainer.innerHTML
      );

      console.log("Message container updated successfully.");

      // Update the AI response
      this.removeSubsequentMessages(messageContainer); // Remove old AI responses

      // Ensure there's a placeholder AI response to update
      let aiMessage = messageContainer.nextElementSibling;
      if (!aiMessage || !aiMessage.querySelector(".ai-message")) {
        aiMessage = this.createMessageContainer();
        aiMessage.classList.add("ai-message-container");
        this.messagesContainer.appendChild(aiMessage);
      }

      console.log("Fetching new AI response for updated message...");
      this.fetchAIResponse(newText, aiMessage);
    } catch (error) {
      console.error(
        "Error replacing textarea with new message element:",
        error
      );
    }

    // Clear the editing reference
    this.editingMessageElement = null;
  }

  cancelEdit(textarea, messageContainer) {
    console.log("Canceling edit and restoring original message...");

    // Retrieve the original text
    const originalText = textarea.dataset.originalText;
    console.log("Original text to restore:", originalText);

    const userMessage = new UserMessage(originalText);
    const originalMessageElement = userMessage.renderWithEditButton(() => {
      console.log("Edit button clicked, re-enabling editing...");
      this.enableEditing(messageContainer);
    });

    messageContainer.innerHTML = ""; // Clear existing content
    messageContainer.appendChild(originalMessageElement);

    this.editingMessageElement = null; // Clear editing reference
    console.log("Edit canceled and message restored.");
  }

  removeSubsequentMessages(messageContainer) {
    console.log(
      "Removing subsequent messages for container:",
      messageContainer
    );

    const messagesList = document.getElementById(this.messagesContainerId);
    let currentMessage = messageContainer.nextElementSibling;

    while (currentMessage) {
      console.log("Removing message:", currentMessage);
      const nextMessage = currentMessage.nextElementSibling;
      messagesList.removeChild(currentMessage);
      currentMessage = nextMessage;
    }

    console.log("Subsequent messages removed successfully.");
  }

  extractMermaidDiagramsAndText(response) {
    const mermaidCodeRegex =
      /(?:```mermaid\n([\s\S]*?)```|(?:^|\n)(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)[\s\S]*?(?=\n\S|\n$))/g;
    const diagrams = [];
    let remainingText = response;

    let match;
    while ((match = mermaidCodeRegex.exec(response)) !== null) {
      diagrams.push(match[1] || match[0].trim());
      remainingText = remainingText.replace(match[0], "").trim();
    }

    return { diagrams, remainingText };
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}

// Initialize the ChatApp
const chatApp = new Chat({
  apiURL: "http://127.0.0.1:8000/chat/",
  model: "llama3.1",
  inputBoxId: "inputBox",
  messagesContainerId: "messages",
});
