// Initialize markdown-it and mermaid globally
const md = window.markdownit({
  highlight: function (str, lang) {
    //console.log("Highlighting code block:", { str, lang }); // Debug log
    if (lang && Prism.languages[lang]) {
      try {
        return Prism.highlight(str, Prism.languages[lang], lang);
      } catch (error) {
        console.error("Error highlighting code block:", error);
      }
    } else {
      console.warn("Language not found or unsupported:", lang);
    }
    return ""; // Return empty if no highlighting
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
    editButton.setAttribute("aria-label", "Edit message");
    editButton.className = "edit-button";

    // Create and append edit icon
    const editIcon = document.createElement("i");
    editIcon.className = "fas fa-edit"; // Font Awesome edit icon class
    editButton.appendChild(editIcon);

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

      // Validate file type
      if (![".txt", ".docx", ".pdf"].some((ext) => file.name.endsWith(ext))) {
        reject(
          "Unsupported file type. Please upload .txt, .pdf, or .docx files."
        );
        return;
      }

      // Handle .txt files
      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(`Error reading text file: ${file.name}`);
        reader.readAsText(file);
      }

      // Handle .docx files
      else if (file.name.endsWith(".docx")) {
        reader.onload = async () => {
          try {
            const result = await mammoth.extractRawText({
              arrayBuffer: reader.result,
            });

            resolve(result.value); // Extracted text
          } catch (error) {
            alert("Failed to process the file: " + error.message);
            reject(`Error reading Word file (${file.name}): ${error.message}`);
          }
        };
        reader.onerror = () =>
          reject(`Error reading binary file: ${file.name}`);
        reader.readAsArrayBuffer(file);
      }

      // Handle .pdf files
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
            reject(`Error reading PDF file (${file.name}): ${error.message}`);
          }
        };
        reader.onerror = () =>
          reject(`Error reading binary file: ${file.name}`);
        reader.readAsArrayBuffer(file);
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

  static saveChat(messagesContainer) {
    let chatContent = "";

    // Loop through all message containers and capture their content
    messagesContainer
      .querySelectorAll(".message-container")
      .forEach((container) => {
        const userMessageElement = container.querySelector(".user-message");
        const aiMessageElement = container.querySelector(".ai-message");

        if (userMessageElement) {
          const userText = userMessageElement.textContent.trim();
          chatContent += `User: ${userText}\n`;
        }

        if (aiMessageElement) {
          const aiText = aiMessageElement.textContent.trim();
          chatContent += `AI: ${aiText}\n`;
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
      saveButton.setAttribute("aria-label", "Save chat");
      saveButton.addEventListener("click", () =>
        FileHandler.saveChat(this.chatApp.messagesContainer)
      );
    }

    const clearButton = document.getElementById("clearButton");
    if (clearButton) {
      clearButton.addEventListener("click", () =>
        FileHandler.clearChat(this.chatApp.messagesContainer)
      );
    }

    const searchButton = document.getElementById("searchButton");
    if (searchButton) {
      searchButton.addEventListener("click", () => this.chatApp.searchChat());
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
    this.sessionId = this.generateSessionId();
    this.searchResults = []; // Array to store matching elements
    this.currentMatchIndex = -1; // Index of the current match

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

  generateSessionId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fileText = await FileHandler.readFile(file);
      console.log("File content:", fileText);

      // Insert the file content into the user input text area
      const inputBox = document.getElementById(this.inputBoxId);
      inputBox.value = fileText; // Set the file content in the input box

      // Optionally focus the input box so the user can see and edit the content
      inputBox.focus();
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

    const spinner = document.createElement("div");
    spinner.className = "spinner";
    aiMessageElement.appendChild(spinner);

    fetch(this.apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: this.sessionId,
        model: this.model,
        user_input: userInput.trim(),
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        aiMessageElement.innerHTML = ""; // clear spinner

        const rawResponse = data.response; // Save raw response
        this.rawResponses.push(rawResponse);

        const { diagrams, remainingText } =
          this.extractMermaidDiagramsAndText(rawResponse);
        const aiMessage = new AiMessage(rawResponse);

        diagrams.forEach((diagram) => {
          const diagramContainer = document.createElement("div");
          diagramContainer.className = "diagram-container";

          const mermaidContainer = document.createElement("div");
          mermaidContainer.className = "mermaid";
          mermaidContainer.textContent = diagram;
          diagramContainer.appendChild(mermaidContainer);

          mermaid.init(undefined, mermaidContainer);

          // Add Save Button for SVG
          const saveContainer = document.createElement("div");
          saveContainer.className = "svg-button";

          const saveAsSVGButton = document.createElement("button");
          saveAsSVGButton.className = "save-svg-button"; // Updated class for styling

          // Add Font Awesome download icon
          const saveIcon = document.createElement("i");
          saveIcon.className = "fas fa-download"; // Font Awesome download icon class
          saveAsSVGButton.appendChild(saveIcon);

          saveAsSVGButton.onclick = () =>
            this.saveMermaidAsImage(mermaidContainer, "svg");
          saveContainer.appendChild(saveAsSVGButton);

          diagramContainer.appendChild(saveContainer);
          aiMessageElement.appendChild(diagramContainer);
        });

        aiMessageElement.appendChild(aiMessage.render());
        Prism.highlightAll(); // Apply syntax highlighting

        // Add copy button to code blocks
        this.addCopyButtons(aiMessageElement);
      })
      .catch((error) => {
        console.error("Error fetching AI response:", error);
        aiMessageElement.innerHTML =
          "There was an error processing your request.";
      });
  }

  addCopyButtons(parentElement) {
    const codeBlocks = parentElement.querySelectorAll("pre > code");

    codeBlocks.forEach((codeBlock) => {
      const copyButton = document.createElement("button");
      copyButton.className = "copy-button";

      const icon = document.createElement("i");
      icon.className = "fas fa-copy"; // Font Awesome icon class for copy
      copyButton.appendChild(icon);

      copyButton.onclick = () => {
        navigator.clipboard
          .writeText(codeBlock.textContent)
          .then(() => {
            icon.className = "fas fa-check"; // Change icon to a checkmark
            setTimeout(() => (icon.className = "fas fa-copy"), 2000); // Reset to copy icon
          })
          .catch((err) => {
            console.error("Error copying to clipboard:", err);
          });
      };

      const wrapper = codeBlock.closest("pre");
      wrapper.classList.add("code-block-wrapper");

      // Add relative positioning to the wrapper
      wrapper.style.position = "relative";
      wrapper.appendChild(copyButton);

      // Update the position of the button within the wrapper
      const updateButtonPosition = () => {
        const wrapperRect = wrapper.getBoundingClientRect();
        const scrollOffset = wrapper.scrollLeft; // Horizontal scroll offset of the wrapper

        copyButton.style.top = `8px`; // Fixed distance from the top of the wrapper
        copyButton.style.right = `${8 - scrollOffset}px`; // Adjust for the horizontal scroll
      };

      // Update the button's position initially and on wrapper scroll
      wrapper.addEventListener("scroll", updateButtonPosition);
      updateButtonPosition();
    });
  }

  async saveMermaidAsImage(mermaidElement, format) {
    const svgElement = mermaidElement.querySelector("svg");

    if (!svgElement) {
      console.error("No SVG element found in the Mermaid container.");
      alert("No diagram found to save.");
      return;
    }

    try {
      if (format === "svg") {
        // Serialize the SVG to a string
        const svgData = new XMLSerializer().serializeToString(svgElement);

        // Create a Blob from the SVG data
        const blob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });

        // Create a temporary link element to trigger the download
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "diagram.svg";
        link.style.display = "none"; // Hide the link
        document.body.appendChild(link); // Append to body

        // Trigger download
        link.click();

        // Clean up URL object and remove temporary link
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);

        console.log("SVG successfully saved.");
      } else {
        console.error(`Unsupported format: ${format}`);
        alert("Unsupported format. Currently, only SVG format is supported.");
      }
    } catch (error) {
      console.error("Error saving SVG:", error);
      alert("Failed to save the diagram as SVG. Please try again.");
    }
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
    textarea.setAttribute("aria-label", "Edit message");
    textarea.value = currentText;
    textarea.className = "editable-textarea";
    textarea.rows = currentText.split("\n").length;

    // Store the original text
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

    // Saving on Enter and canceling on blur
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
    const newText = textarea.value.trim();

    if (!newText) {
      console.error("New text is empty, aborting save.");
      return;
    }

    const userMessage = new UserMessage(newText);
    const userMessageElement = userMessage.renderWithEditButton(() => {
      this.enableEditing(messageContainer);
    });

    messageContainer.innerHTML = "";
    messageContainer.appendChild(userMessageElement);

    this.removeSubsequentMessages(messageContainer);

    let aiMessage = messageContainer.nextElementSibling;
    if (!aiMessage || !aiMessage.querySelector(".ai-message")) {
      aiMessage = this.createMessageContainer();
      aiMessage.classList.add("ai-message-container");
      this.messagesContainer.appendChild(aiMessage);
    }

    // Fetch updated AI response for the new message
    this.fetchAIResponse(newText, aiMessage);

    // clear editing reference
    this.editingMessageElement = null;
  }

  searchChat() {
    let searchInput = document.getElementById("searchInput");

    if (!searchInput) {
      const buttonGroup = document.querySelector(".button-group");

      // Create the search input dynamically
      searchInput = document.createElement("input");
      searchInput.id = "searchInput";
      searchInput.type = "text";
      searchInput.placeholder = "Search chat...";
      searchInput.className = "search-input";

      buttonGroup.appendChild(searchInput);

      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault(); // Prevent form submission

          const query = searchInput.value.trim().toLowerCase();

          // query hasn't changed, cycle to the next match
          if (query === this.lastSearchQuery) {
            this.nextMatch();
          } else {
            this.lastSearchQuery = query;
            this.executeSearch(query);
          }
        }
      });

      // blur event clears highlights and reset last query
      searchInput.addEventListener("blur", () => {
        this.clearHighlights();
        this.lastSearchQuery = null;
        searchInput.remove();
      });

      searchInput.focus();
    }
  }

  executeSearch(searchQuery) {
    if (!searchQuery) {
      return; // Do nothing for an empty query
    }

    const messages = this.messagesContainer.querySelectorAll(".message");

    this.searchResults = [];
    this.currentMatchIndex = -1;

    messages.forEach((message) => {
      // If no original content is stored, save it
      if (!message.dataset.originalContent) {
        message.dataset.originalContent = message.innerHTML;
      }

      // Reset content to its original HTML
      message.innerHTML = message.dataset.originalContent;

      const textContent = message.textContent.toLowerCase();

      if (textContent.includes(searchQuery)) {
        // highlight the matching text
        const regex = new RegExp(`(${searchQuery})`, "gi");
        const highlightedContent = message.textContent.replace(
          regex,
          `<span class="highlight">$1</span>`
        );

        message.innerHTML = highlightedContent;

        this.searchResults.push(message);
      }
    });

    // If matches are found, move to the first match
    if (this.searchResults.length > 0) {
      this.currentMatchIndex = 0;
      this.scrollToMatch();
    }
  }

  nextMatch() {
    if (this.searchResults.length === 0) {
      return;
    }

    // Move to the next match, wrapping around to the first
    this.currentMatchIndex =
      (this.currentMatchIndex + 1) % this.searchResults.length;
    this.scrollToMatch();
  }

  scrollToMatch() {
    console.log("scrollToMatch called", this.currentMatchIndex);
    if (
      this.currentMatchIndex >= 0 &&
      this.currentMatchIndex < this.searchResults.length
    ) {
      const match = this.searchResults[this.currentMatchIndex];
      match.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  clearHighlights() {
    const messages = this.messagesContainer.querySelectorAll(".message");

    // Restore original content of each message
    messages.forEach((message) => {
      if (message.dataset.originalContent) {
        message.innerHTML = message.dataset.originalContent;
      }
    });

    // Reset search results and state
    this.searchResults = [];
    this.currentMatchIndex = -1;
  }

  cancelEdit(textarea, messageContainer) {
    console.log("Canceling edit and restoring original message...");

    // Retrieve the original text
    const originalText = textarea.dataset.originalText;
    const userMessage = new UserMessage(originalText);
    const originalMessageElement = userMessage.renderWithEditButton(() => {
      console.log("Edit button clicked");
      this.enableEditing(messageContainer);
    });

    messageContainer.innerHTML = ""; // clear existing content
    messageContainer.appendChild(originalMessageElement);

    this.editingMessageElement = null; // clear editing reference
    console.log("Edit canceled and message restored.");
  }

  removeSubsequentMessages(messageContainer) {
    console.log("Removing subsequent messages");
    const messagesList = document.getElementById(this.messagesContainerId);
    let currentMessage = messageContainer.nextElementSibling;

    while (currentMessage) {
      console.log("Removing message:", currentMessage);
      const nextMessage = currentMessage.nextElementSibling;
      messagesList.removeChild(currentMessage);
      currentMessage = nextMessage;
    }

    console.log("Subsequent messages removed.");
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

export default Chat; // testing
