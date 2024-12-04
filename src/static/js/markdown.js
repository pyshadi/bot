// markdown.js
export const md = (() => {
  try {
    if (window.markdownit) {
      return window.markdownit({
        highlight: function (str, lang) {
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
    } else {
      throw new Error("Markdown-It library is not loaded.");
    }
  } catch (error) {
    console.error("Error initializing Markdown-It:", error);
    return null; // Return null if initialization fails
  }
})();

export const mermaid = (() => {
  try {
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false });
      return window.mermaid;
    } else {
      throw new Error("Mermaid library is not loaded.");
    }
  } catch (error) {
    console.error("Error initializing Mermaid:", error);
    return null; // Return null if initialization fails
  }
})();
