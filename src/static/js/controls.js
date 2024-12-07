import { FileHandler } from "./file_handler.js";

export class Controls {
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
          event.preventDefault();
          this.chatApp.sendMessage();
        }
      });

      // Drag & Drop event listeners
      inputBox.addEventListener("dragenter", (event) => {
        event.preventDefault();
        inputBox.classList.add("drag-over");
      });

      inputBox.addEventListener("dragover", (event) => {
        event.preventDefault();
        inputBox.classList.add("drag-over");
      });

      inputBox.addEventListener("dragleave", (event) => {
        event.preventDefault();
        inputBox.classList.remove("drag-over");
      });

      inputBox.addEventListener("drop", async (event) => {
        event.preventDefault();
        inputBox.classList.remove("drag-over");
        const files = event.dataTransfer.files;

        if (files && files.length > 0) {
          try {
            const fileContent = await FileHandler.readFile(files[0]);
            inputBox.value = fileContent;
          } catch (error) {
            alert(error);
          }
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
