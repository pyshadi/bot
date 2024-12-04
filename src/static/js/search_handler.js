// search_handler.js
export class SearchHandler {
    constructor(chat) {
      this.chat = chat;
      this.searchResults = [];
      this.currentMatchIndex = -1;
      this.lastSearchQuery = null;
    }
  
    executeSearch(searchQuery) {
      if (!searchQuery) return;
  
      const messages = this.chat.messagesContainer.querySelectorAll(".message");
  
      this.searchResults = [];
      this.currentMatchIndex = -1;
  
      messages.forEach((message) => {
        if (!message.dataset.originalContent) {
          message.dataset.originalContent = message.innerHTML;
        }
        message.innerHTML = message.dataset.originalContent;
  
        const textNodes = [];
        const findTextNodes = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            node.childNodes.forEach(findTextNodes);
          }
        };
        findTextNodes(message);
  
        textNodes.forEach((node) => {
          const regex = new RegExp(`(${searchQuery})`, "gi");
          const text = node.nodeValue;
          if (regex.test(text)) {
            const wrapper = document.createElement("span");
            wrapper.innerHTML = text.replace(
              regex,
              `<span class="highlight">$1</span>`
            );
            node.parentNode.replaceChild(wrapper, node);
            this.searchResults.push(wrapper);
          }
        });
      });
  
      if (this.searchResults.length > 0) {
        this.currentMatchIndex = 0;
        this.scrollToMatch();
      }
    }
  
    highlightText(node, searchQuery) {
        const regex = new RegExp(`(${searchQuery})`, "gi");
        const text = node.nodeValue;
        if (regex.test(text)) {
          const wrapper = document.createElement("span");
          wrapper.innerHTML = text.replace(
            regex,
            `<span class="highlight">$1</span>`
          );
          node.parentNode.replaceChild(wrapper, node);
          return wrapper; // Return the wrapper for further processing
        }
        return null;
      }
    nextMatch() {
      if (this.searchResults.length > 0) {
        this.currentMatchIndex =
          (this.currentMatchIndex + 1) % this.searchResults.length;
        this.scrollToMatch();
      }
    }
  
    scrollToMatch() {
      if (
        this.currentMatchIndex >= 0 &&
        this.currentMatchIndex < this.searchResults.length
      ) {
        const match = this.searchResults[this.currentMatchIndex];
        match.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  
    clearHighlights() {
      const messages = this.chat.messagesContainer.querySelectorAll(".message");
  
      messages.forEach((message) => {
        if (message.dataset.originalContent) {
          message.innerHTML = message.dataset.originalContent;
        }
      });
  
      this.searchResults = [];
      this.currentMatchIndex = -1;
    }
  }
  