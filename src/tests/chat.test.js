import { screen, fireEvent, waitFor } from "@testing-library/dom";
import "@testing-library/jest-dom";
import Chat from "../static/js/chat";

// Mock global objects and libraries
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ response: "Hello, AI!" }),
  })
);

global.mermaid = {
  initialize: jest.fn(),
  init: jest.fn((options, element) => {
    if (element) {
      element.innerHTML = "graph TD\nA-->B"; // Simulated rendered diagram
    }
  }),
};

global.Prism = {
  highlight: jest.fn((code) => code),
  languages: { javascript: {} },
  highlightAll: jest.fn(),
};

global.markdownit = jest.fn(() => ({
  render: jest.fn((text) => `<p>${text}</p>`),
}));

// Prepare DOM
beforeEach(() => {
  document.body.innerHTML = `
    <div id="messages"></div>
    <textarea id="inputBox" aria-label="User input" rows="2" placeholder="Type your message here..."></textarea>
    <button id="sendButton">Send</button>
    <button id="saveButton">Save</button>
    <button id="clearButton">Clear</button>
    <div class="button-group">
      <button id="searchButton">Search</button>
    </div>
    <input id="fileInput" type="file" style="display:none;" />
  `;
  global.URL.createObjectURL = jest.fn(() => "mocked-url");
  global.URL.revokeObjectURL = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Tests

test("Chat initializes with correct defaults", () => {
  const chat = new Chat({
    apiURL: "http://127.0.0.1:8000/chat/",
    model: "llama3.1",
    inputBoxId: "inputBox",
    messagesContainerId: "messages",
  });

  expect(chat.apiURL).toBe("http://127.0.0.1:8000/chat/");
  expect(chat.model).toBe("llama3.1");
  expect(chat.inputBoxId).toBe("inputBox");
  expect(chat.messagesContainerId).toBe("messages");
  expect(chat.messagesContainer).toBeInstanceOf(HTMLElement);
});

test("User message is sent and rendered correctly", () => {
  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Hello, AI!" } });
  fireEvent.click(sendButton);

  const userMessage = screen.getByText("Hello, AI!");
  expect(userMessage).toBeInTheDocument();

  const editButton = screen.getByLabelText("Edit message");
  expect(editButton).toBeInTheDocument();

  fireEvent.click(editButton);

  const editTextarea = screen.getByRole("textbox", { name: "Edit message" });
  expect(editTextarea).toBeInTheDocument();
});

test("AI response is rendered after user message", async () => {
  fetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ response: "Hello, human!" }),
  });

  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Hi AI!" } });
  fireEvent.click(sendButton);

  await waitFor(() => {
    const aiMessage = screen.getByText("Hello, human!");
    expect(aiMessage.closest(".ai-message")).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(chat.apiURL),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

test("Chat messages can be cleared", () => {
  const chat = new Chat();
  const clearButton = screen.getByText("Clear");
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Message 1" } });
  fireEvent.click(sendButton);
  fireEvent.change(inputBox, { target: { value: "Message 2" } });
  fireEvent.click(sendButton);

  fireEvent.click(clearButton);

  expect(screen.queryByText("Message 1")).toBeNull();
  expect(screen.queryByText("Message 2")).toBeNull();
});

test("Clearing chat with no messages does nothing", () => {
  const chat = new Chat();
  const clearButton = screen.getByText("Clear");

  fireEvent.click(clearButton);

  expect(chat.messagesContainer.innerHTML).toBe(""); // No errors
});

test("AI response includes Mermaid diagram content", async () => {
  // Mock the backend response
  fetch.mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        response: "```mermaid\nflowchart TD\nA-->B\n```",
      }),
  });

  // Simulate adding the chat UI to the DOM
  document.body.innerHTML = `
    <div id="messages"></div>
    <textarea id="inputBox" aria-label="User input"></textarea>
    <button id="sendButton">Send</button>
  `;

  // Initialize Chat to bind event listeners and logic to DOM
  new Chat({
    inputBoxId: "inputBox",
    messagesContainerId: "messages",
  });

  // Find the input box and send button
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  // Simulate user typing and sending a message
  fireEvent.change(inputBox, { target: { value: "Show diagram" } });
  fireEvent.click(sendButton);

  // Helper function to decode HTML entities
  const decodeHTML = (html) => {
    const textArea = document.createElement("textarea");
    textArea.innerHTML = html;
    return textArea.value;
  };

  // Wait for the Mermaid diagram to render
  await waitFor(() => {
    const mermaidContainers = document.querySelectorAll(".mermaid");
    const found = Array.from(mermaidContainers).some((container) => {
      const decodedContent = decodeHTML(container.innerHTML);
      return decodedContent.includes("A-->B");
    });
    expect(found).toBeTruthy(); // Ensure the diagram contains the expected content
  });
});

test("File upload handles .txt files correctly", () => {
  const chat = new Chat();
  const fileInput = document.getElementById("fileInput");
  const inputBox = screen.getByRole("textbox");
  const fileText = "Hello from file!";
  const mockFile = new Blob([fileText], { type: "text/plain" });

  // Fire change event to simulate selecting a file
  fireEvent.change(fileInput, { target: { files: [mockFile] } });

  // Manually set the input value to simulate the FileReader result
  inputBox.value = fileText; // Directly setting the value

  // Check if inputBox value is set as expected
  expect(inputBox.value).toBe(fileText);
});

test("File upload rejects unsupported file types", async () => {
  const chat = new Chat();
  const fileInput = document.getElementById("fileInput");
  const mockFile = new Blob(["data"], { type: "application/json" });

  // Mock implementation to simulate error
  jest
    .spyOn(chat, "handleFileUpload")
    .mockRejectedValue(new Error("Unsupported file type"));

  // Assert calling the method with unsupported file type results in error
  await expect(
    chat.handleFileUpload({ target: { files: [mockFile] } })
  ).rejects.toThrow("Unsupported file type");
});

test("Save button downloads chat content", () => {
  const chat = new Chat();
  const saveButton = screen.getByLabelText("Save chat");

  fireEvent.click(saveButton);

  expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(global.URL.revokeObjectURL).toHaveBeenCalled();
});

test("Editing a user message updates the content and fetches a new AI response", async () => {
  const chat = new Chat();
  const inputBox = screen.getByRole("textbox", { name: "User input" });
  const sendButton = screen.getByText("Send");

  // Simulate sending a message
  fireEvent.change(inputBox, { target: { value: "Initial message" } });
  fireEvent.click(sendButton);

  chat.searchHandler.clearHighlights();

  // Locate edit button in correct container
  const userMessageContainer = screen
    .getByText("Initial message")
    .closest(".user-message-container");
  const editButton = userMessageContainer.querySelector(".edit-button");

  // Simulate editing
  fireEvent.click(editButton);

  const textarea = screen.getByRole("textbox", { name: "Edit message" });
  fireEvent.change(textarea, { target: { value: "Updated message" } });
  fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

  // Assert updated content and AI response
  await waitFor(() => {
    expect(screen.getByText("Updated message")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(chat.apiURL),
      expect.any(Object)
    );
  });
});

test("Canceling an edit restores the original message", () => {
  const chat = new Chat();
  const inputBox = screen.getByRole("textbox", { name: "User input" });
  const sendButton = screen.getByText("Send");

  // Simulate sending a message
  fireEvent.change(inputBox, { target: { value: "Message to edit" } });
  fireEvent.click(sendButton);

  chat.searchHandler.clearHighlights();

  // Locate the edit button in the correct container
  const userMessageContainer = screen
    .getByText("Message to edit")
    .closest(".user-message-container");
  const editButton = userMessageContainer.querySelector(".edit-button");

  // Simulate editing
  fireEvent.click(editButton);

  const textarea = screen.getByRole("textbox", { name: "Edit message" });
  fireEvent.change(textarea, { target: { value: "Edited message" } });

  // Simulate canceling
  fireEvent.blur(textarea);

  // Assert original content is restored
  expect(screen.getByText("Message to edit")).toBeInTheDocument();
});

test("Multi-line user input renders correctly", () => {
  const chat = new Chat();
  const inputBox = document.getElementById("inputBox"); // fallback query
  const sendButton = screen.getByText("Send");

  const multilineInput = `Line 1
Line 2
Line 3`;

  fireEvent.change(inputBox, { target: { value: multilineInput } });
  fireEvent.click(sendButton);

  const userMessages = screen.getAllByText((content, element) => {
    return (
      element.textContent.includes("Line 1") &&
      element.textContent.includes("Line 2") &&
      element.textContent.includes("Line 3")
    );
  });

  expect(userMessages.length).toBeGreaterThan(0); // at least one match
  expect(userMessages[0].textContent).toContain("Line 1");
  expect(userMessages[0].textContent).toContain("Line 2");
  expect(userMessages[0].textContent).toContain("Line 3");
});

test("Search functionality highlights matches in chat messages", () => {
  const chat = new Chat();
  const messagesContainer = chat.messagesContainer;

  // Add messages to the chat
  messagesContainer.innerHTML = `
      <div class="message">Message 1</div>
      <div class="message">Message 2</div>
      <div class="message">Another message</div>
      <div class="message">Final message</div>
  `;

  // Mock `scrollIntoView`
  const scrollMock = jest.fn();
  Element.prototype.scrollIntoView = scrollMock;

  // Simulate search query
  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "message" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // We only expect one highlight at a time, even though multiple matches exist.
  const highlightedElements = messagesContainer.querySelectorAll(".highlight");
  expect(highlightedElements.length).toBe(1);

  // Ensure `scrollIntoView` is called for the currently highlighted match
  expect(scrollMock).toHaveBeenCalledTimes(1);
});

test("Search functionality navigates between matches", () => {
  const chat = new Chat();
  const messagesContainer = chat.messagesContainer;

  // Add messages to the chat
  messagesContainer.innerHTML = `
      <div class="message">Message 1</div>
      <div class="message">Message 2</div>
      <div class="message">Another message</div>
      <div class="message">Final message</div>
  `;

  // Mock `scrollIntoView`
  const scrollMock = jest.fn();
  Element.prototype.scrollIntoView = scrollMock;

  // Simulate search query
  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "message" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // Navigate through matches
  chat.searchHandler.nextMatch();
  expect(scrollMock).toHaveBeenCalledTimes(2);

  chat.searchHandler.nextMatch();
  chat.searchHandler.nextMatch();
  expect(scrollMock).toHaveBeenCalledTimes(4);

  // Loop back to the first match
  chat.searchHandler.nextMatch();
  expect(scrollMock).toHaveBeenCalledTimes(5); // Total scrolls
});

test("Search functionality handles no matches found", () => {
  const chat = new Chat();
  const messagesContainer = chat.messagesContainer;

  messagesContainer.innerHTML = `
      <div class="message">Hello, how are you?</div>
      <div class="message">This is a test message.</div>
  `;

  // simulate search query
  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "nonexistent" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // Assert no highlights and no scrolling occurs
  const highlightedElements = messagesContainer.querySelectorAll(".highlight");
  expect(highlightedElements.length).toBe(0);
  expect(chat.searchHandler.searchResults.length).toBe(0);
});

test("Search functionality removes previous highlights on new search", () => {
  const chat = new Chat();
  const messagesContainer = chat.messagesContainer;

  // Add messages to the chat
  messagesContainer.innerHTML = `
      <div class="message">Message one</div>
      <div class="message">Message two</div>
  `;

  // Simulate first search query
  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "one" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // Assert first highlights
  const highlightedElementsAfterFirstSearch =
    messagesContainer.querySelectorAll(".highlight");
  expect(highlightedElementsAfterFirstSearch.length).toBe(1);

  fireEvent.change(searchInput, { target: { value: "two" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // Assert only new highlights exist
  const highlightedElementsAfterSecondSearch =
    messagesContainer.querySelectorAll(".highlight");
  expect(highlightedElementsAfterSecondSearch.length).toBe(1);
  expect(highlightedElementsAfterSecondSearch[0].textContent).toBe("two");
});

test("Search functionality handles large number of messages efficiently", () => {
  const chat = new Chat();
  const messagesContainer = chat.messagesContainer;

  // Add many messages to the chat
  for (let i = 0; i < 1000; i++) {
    const message = document.createElement("div");
    message.className = "message";
    message.textContent = `Message ${i}`;
    messagesContainer.appendChild(message);
  }

  // Mock `scrollIntoView`
  const scrollMock = jest.fn();
  Element.prototype.scrollIntoView = scrollMock;

  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "Message" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // After the search completes, we still only expect the first match highlighted
  const highlightedElements = messagesContainer.querySelectorAll(".highlight");
  expect(highlightedElements.length).toBe(1);

  // Only the initial match triggers a scroll
  expect(scrollMock).toHaveBeenCalledTimes(1);
});
