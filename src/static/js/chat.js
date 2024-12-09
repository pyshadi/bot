// chat.js
import { UserMessage, AiMessage } from "./messages.js";
import { FileHandler } from "./file_handler.js";
import { Controls } from "./controls.js";
import { SearchHandler } from "./search_handler.js";
import { DiagramHandler } from "./diagram_handler.js";

export class Chat {
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

    this.searchHandler = new SearchHandler(this);
    this.diagramHandler = new DiagramHandler(this);

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

      // Store original user input as raw data
      userMessageContainer.setAttribute("data-raw-text", userInput);

      userMessageContainer.appendChild(
        userMessage.renderWithEditButton(() =>
          this.enableEditing(userMessageContainer)
        )
      );
      this.messagesContainer.appendChild(userMessageContainer);

      const aiMessageContainer = this.createMessageContainer();
      this.messagesContainer.appendChild(aiMessageContainer);

      // Fetch AI response
      this.fetchAIResponse(userInput, aiMessageContainer);
    }

    inputBox.value = "";
    this.scrollToBottom();
  }

  fetchAIResponse(userInput, aiMessageElement) {
    aiMessageElement.classList.add("ai-message");

    // Add a loading spinner while the response is being fetched
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
        aiMessageElement.innerHTML = ""; // Clear spinner

        const rawResponse = data.response;
        this.rawResponses.push(rawResponse);

        // Store the raw response for exact reconstruction
        aiMessageElement
          .closest(".message-container")
          .setAttribute("data-raw-text", rawResponse);

        // Process the response to extract diagrams and text
        const { diagrams, remainingText } =
          this.diagramHandler.extractMermaidDiagramsAndText(rawResponse);

        // Create the AI message using the processed text
        const aiMessage = new AiMessage(remainingText);

        // Render diagrams in the AI message container
        diagrams.forEach((diagram) => {
          this.diagramHandler.renderMermaidDiagram(aiMessageElement, diagram);
        });

        // Render the remaining text as part of the AI message
        aiMessageElement.appendChild(aiMessage.render());

        // Syntax highlighting for code blocks
        Prism.highlightAll();

        // Add copy buttons to code blocks within the message
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
      const wrapper = codeBlock.closest("pre");

      // Ensure the wrapper has the appropriate class and position
      wrapper.classList.add("code-block-wrapper");
      wrapper.style.position = "relative";

      // Copy Button
      const copyButton = document.createElement("button");
      copyButton.className = "copy-button";

      const copyIcon = document.createElement("i");
      copyIcon.className = "fas fa-copy";
      copyButton.appendChild(copyIcon);

      copyButton.onclick = () => {
        navigator.clipboard
          .writeText(codeBlock.textContent)
          .then(() => {
            copyIcon.className = "fas fa-check"; // Change icon to checkmark
            setTimeout(() => (copyIcon.className = "fas fa-copy"), 2000); // Revert icon after 2 seconds
          })
          .catch((err) => {
            console.error("Error copying to clipboard:", err);
          });
      };

      // Always append the Copy button
      wrapper.appendChild(copyButton);

      // Only add Run/Show Code button for Python code blocks
      if (codeBlock.classList.contains("language-python")) {
        const runButton = document.createElement("button");
        runButton.className = "run-code-button";

        const runIcon = document.createElement("i");
        runIcon.className = "fas fa-play";
        runButton.appendChild(runIcon);

        runButton.onclick = async () => {
          try {
            const messageContainer = runButton.closest(".message-container");
            const allCodeBlocks =
              messageContainer.querySelectorAll("pre > code");

            // Combine all code blocks in the same message
            let combinedCode = "";
            allCodeBlocks.forEach((block) => {
              combinedCode += block.textContent + "\n";
            });

            // Toggle between showing code and output
            const isShowingOutput =
              codeBlock.classList.contains("showing-output");
            if (isShowingOutput) {
              codeBlock.textContent = codeBlock.dataset.originalCode;
              codeBlock.classList.remove("showing-output");
              runButton.innerHTML = `<i class="fas fa-play"></i>`; // Change to Run icon
              Prism.highlightAll(); // Reapply syntax highlighting
              return;
            }

            if (!combinedCode.trim()) {
              alert("No code to execute.");
              return;
            }

            // Save the original code for toggling back
            codeBlock.dataset.originalCode = codeBlock.textContent;

            // Send code to backend for execution
            const response = await fetch("/run-python/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: combinedCode }),
            });

            const result = await response.json();

            if (result.error) {
              codeBlock.textContent = `Error: ${result.error}`;
            } else {
              codeBlock.textContent = result.output || "No output.";
            }

            codeBlock.classList.add("showing-output");
            runButton.innerHTML = `<i class="fas fa-code"></i>`; // Change to Show Code icon
          } catch (error) {
            console.error("Error running code:", error);
            alert("Failed to execute the code.");
          }
        };

        // Append the Run button to the wrapper
        wrapper.appendChild(runButton);
      }
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

      searchInput = document.createElement("input");
      searchInput.id = "searchInput";
      searchInput.type = "text";
      searchInput.placeholder = "Search chat...";
      searchInput.className = "search-input";

      buttonGroup.appendChild(searchInput);

      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const query = searchInput.value.trim().toLowerCase();

          if (query === this.searchHandler.lastSearchQuery) {
            this.searchHandler.nextMatch();
          } else {
            this.searchHandler.lastSearchQuery = query;
            this.searchHandler.executeSearch(query);
          }
        }
      });

      searchInput.addEventListener("blur", () => {
        this.searchHandler.clearHighlights();
        this.searchHandler.lastSearchQuery = null;
        searchInput.remove();
      });

      searchInput.focus();
    }
  }

  loadChatHistory(fileContent) {
    console.log("Loading chat history...");

    FileHandler.clearChat(this.messagesContainer);

    const lines = fileContent.split("\n");
    let currentSpeaker = null;
    let currentMessageText = "";

    const finalizeMessage = () => {
      if (!currentSpeaker || !currentMessageText.trim()) return;

      const trimmedMessage = currentMessageText; // Do not trim here if you want to preserve indentation
      const container = this.createMessageContainer();
      container.setAttribute("data-raw-text", trimmedMessage);

      if (currentSpeaker === "User") {
        const userMessage = new UserMessage(trimmedMessage);
        container.appendChild(
          userMessage.renderWithEditButton(() => this.enableEditing(container))
        );
      } else if (currentSpeaker === "AI") {
        const { diagrams, remainingText } =
          this.diagramHandler.extractMermaidDiagramsAndText(trimmedMessage);
        const aiMessage = new AiMessage(remainingText);

        diagrams.forEach((diagram) => {
          this.diagramHandler.renderMermaidDiagram(container, diagram);
        });

        container.appendChild(aiMessage.render());
        Prism.highlightAll();
        this.addCopyButtons(container);
      }

      this.messagesContainer.appendChild(container);
      currentMessageText = "";
      currentSpeaker = null;
    };

    for (const line of lines) {
      // Do not trim leading spaces!
      // Just remove a trailing carriage return if needed.
      const processedLine = line.replace(/\r$/, "");

      if (!processedLine && currentSpeaker) {
        // If it's just an empty line, you can decide how to handle it.
        // For code, empty lines might be important, so consider adding it as is.
        currentMessageText += "\n";
        continue;
      }

      if (processedLine.startsWith("User:")) {
        finalizeMessage();
        currentSpeaker = "User";
        currentMessageText = processedLine
          .replace("User:", "")
          .replace(/^\s+/, "");
      } else if (processedLine.startsWith("AI:")) {
        finalizeMessage();
        currentSpeaker = "AI";
        currentMessageText = processedLine
          .replace("AI:", "")
          .replace(/^\s+/, "");
      } else {
        currentMessageText += "\n" + processedLine;
      }
    }

    finalizeMessage();
    console.log("Chat history loaded successfully.");
    this.scrollToBottom();
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

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}

export default Chat;