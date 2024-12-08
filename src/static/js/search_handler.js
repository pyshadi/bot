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

    // Clear previous highlights before starting a new search
    this.clearHighlights();

    this.searchResults = [];
    this.currentMatchIndex = -1;
    this.lastSearchQuery = searchQuery;

    const messages = this.chat.messagesContainer.querySelectorAll(".message");
    const regex = new RegExp(`(${searchQuery})`, "gi");

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
        const text = node.nodeValue;
        let match;
        while ((match = regex.exec(text)) !== null) {
          this.searchResults.push({
            message,
            nodePath: this.getNodePath(node, message),
            start: match.index,
            length: match[1].length,
          });
        }
      });
    });

    const searchInput = document.getElementById("searchInput");
    if (this.searchResults.length > 0) {
      // Remove "search-error" class if matches found
      if (searchInput) {
        searchInput.classList.remove("search-error");
      }

      this.currentMatchIndex = 0;
      this.highlightCurrentMatch();
      this.scrollToMatch();
    } else {
      // Add "search-error" class if no matches found
      if (searchInput) {
        searchInput.classList.add("search-error");
      }
    }
  }

  highlightCurrentMatch() {
    if (
      this.currentMatchIndex < 0 ||
      this.currentMatchIndex >= this.searchResults.length
    )
      return;

    // Always clear all highlights before highlighting the current match
    this.clearHighlights();

    const { message, nodePath, start, length } =
      this.searchResults[this.currentMatchIndex];

    // After clearing, the message should be in its original state
    const node = this.getNodeFromPath(message, nodePath);
    if (!node) return;

    const text = node.nodeValue;
    const before = text.slice(0, start);
    const matchText = text.slice(start, start + length);
    const after = text.slice(start + length);

    const highlightSpan = document.createElement("span");
    highlightSpan.classList.add("highlight");
    highlightSpan.textContent = matchText;

    const parent = node.parentNode;
    parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(highlightSpan, node);
    parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
  }

  nextMatch() {
    if (this.searchResults.length > 0) {
      this.currentMatchIndex =
        (this.currentMatchIndex + 1) % this.searchResults.length;
      this.highlightCurrentMatch();
      this.scrollToMatch();
    }
  }

  scrollToMatch() {
    if (
      this.currentMatchIndex >= 0 &&
      this.currentMatchIndex < this.searchResults.length
    ) {
      const { message, nodePath } = this.searchResults[this.currentMatchIndex];
      const node = this.getNodeFromPath(message, nodePath);
      if (node && node.parentNode) {
        node.parentNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  clearHighlights() {
    const messages = this.chat.messagesContainer.querySelectorAll(".message");
    messages.forEach((message) => {
      if (message.dataset.originalContent) {
        message.innerHTML = message.dataset.originalContent;
      }
    });
  }

  // Return a path of child indices from the message element down to the node
  getNodePath(node, stopElement) {
    const path = [];
    let current = node;
    while (current && current !== stopElement) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      path.unshift(index);
      current = parent;
    }
    return path;
  }

  getNodeFromPath(root, path) {
    let current = root;
    for (let i = 0; i < path.length; i++) {
      if (!current.childNodes[path[i]]) return null;
      current = current.childNodes[path[i]];
    }
    return current.nodeType === Node.TEXT_NODE ? current : null;
  }
}
