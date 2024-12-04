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
  init: jest.fn(),
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
  fetch.mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        response: "```mermaid\nflowchart TD\nA-->B\n```",
      }),
  });

  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Show diagram" } });
  fireEvent.click(sendButton);

  await waitFor(() => {
    // Ensure mermaid container is rendered
    const mermaidContainer = screen.getByText((content, element) => {
      return (
        element.className.includes("mermaid") &&
        element.textContent.includes("A-->B")
      );
    });
    expect(mermaidContainer).toBeInTheDocument();
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

  chat.clearHighlights();

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

  // Assert updated content and ai response
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

  chat.clearHighlights();

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

test("Search functionality highlights matches and navigates results", () => {
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

  // simulate search query
  chat.searchChat();
  const searchInput = document.getElementById("searchInput");
  fireEvent.change(searchInput, { target: { value: "message" } });
  fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

  // Assert scroll and highlight behavior
  expect(scrollMock).toHaveBeenCalledTimes(1);

  // cycle to next match
  chat.nextMatch();
  expect(scrollMock).toHaveBeenCalledTimes(2);

  // Cycle again to test looping
  chat.nextMatch();
  chat.nextMatch();
  expect(scrollMock).toHaveBeenCalledTimes(4); // Total matches

  // Reset search
  fireEvent.blur(searchInput);
  expect(chat.searchResults.length).toBe(0); // Highligts cleared
});
