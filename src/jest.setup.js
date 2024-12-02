global.markdownit = jest.fn(() => ({
  render: jest.fn((text) => `<p>${text}</p>`), // Mock the render method
}));

global.mermaid = {
  initialize: jest.fn(),
  init: jest.fn(),
};
