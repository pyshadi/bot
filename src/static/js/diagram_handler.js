export class DiagramHandler {
  constructor(chatInstance) {
    this.chatInstance = chatInstance;
  }

  extractMermaidDiagramsAndText(response) {
    let diagrams = [];
    let remainingText = response;

    // First try fenced mermaid blocks
    let match;
    const fencedRegex = /```mermaid\s+([\s\S]*?)```/g;
    while ((match = fencedRegex.exec(response)) !== null) {
      const rawDiagram = match[1].trim();
      const sanitizedDiagram = this.sanitizeMermaidDiagram(rawDiagram);
      diagrams.push(sanitizedDiagram);
      remainingText = remainingText.replace(match[0], "").trim();
    }

    // If no fenced code block found, try keyword-based regex
    if (diagrams.length === 0) {
      const diagramRegex =
        /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)([\s\S]*)/m;
      const keywordMatch = diagramRegex.exec(response);
      if (keywordMatch) {
        const rawDiagram = keywordMatch[0].trim();
        const sanitizedDiagram = this.sanitizeMermaidDiagram(rawDiagram);
        diagrams.push(sanitizedDiagram);
        remainingText = remainingText.replace(keywordMatch[0], "").trim();
      }
    }

    console.log("Extracted diagram:", diagrams);

    return { diagrams, remainingText };
  }

  sanitizeMermaidDiagram(diagram) {
    diagram = this.initialHeuristicSanitization(diagram);

    if (!this.tryParsingMermaid(diagram)) {
      console.warn("Initial parse failed. Attempting fallback corrections...");
      diagram = this.applyFallbackCorrections(diagram);

      // Try parsing again after fallback
      if (!this.tryParsingMermaid(diagram)) {
        console.error(
          "Fallback parse also failed. Using a minimal placeholder diagram."
        );
        // As a last resort, we provide a minimal valid diagram
        diagram = "graph TD\nA[Parsing error] --> B[Check your syntax]";
      }
    }

    return diagram;
  }

  initialHeuristicSanitization(diagram) {
    let lines = diagram.split("\n").map((line) => line.trim());
    while (lines.length && lines[0] === "") lines.shift();
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    diagram = lines.join("\n");

    const knownKeywords = [
      "graph",
      "flowchart",
      "sequenceDiagram",
      "classDiagram",
      "stateDiagram",
      "erDiagram",
      "journey",
      "gantt",
      "pie",
      "requirementDiagram",
      "gitGraph",
      "C4Context",
      "mindmap",
      "timeline",
      "zenuml",
    ];
    const firstLine = lines[0] || "";
    const firstWord = firstLine.split(/\s+/)[0];

    if (!knownKeywords.includes(firstWord)) {
      // If no recognized keyword, default to a simple graph
      diagram = "graph TD\n" + diagram;
    }

    // If diagram starts with graph/flowchart but no direction, add TD
    if (
      (diagram.startsWith("graph ") || diagram.startsWith("flowchart ")) &&
      !/(graph|flowchart)\s+(TD|LR|BT|RL|TB)/i.test(diagram)
    ) {
      diagram = diagram.replace(/^(graph|flowchart)(\s*)/i, "$1 TD\n");
    }

    // Remove any stray code fences
    diagram = diagram.replace(/```/g, "");

    return diagram;
  }

  tryParsingMermaid(diagram) {
    try {
      mermaid.parse(diagram);
      return true;
    } catch (e) {
      console.warn("Mermaid parse error:", e);
      return false;
    }
  }

  applyFallbackCorrections(diagram) {
    let lines = diagram.split("\n");

    // Replace unicode ellipsis with '...'
    lines = lines.map((line) => line.replace(/…/g, "..."));

    // Fix arrow labeling issues like `A --> B: What is your name?;`
    // We'll convert `A --> B: Some label;` into `A -->|Some label| B`.
    // The pattern: `[Node/ID] --> [Node/ID]: Label;`
    lines = lines.map((line) => {
      // Regex to match lines with a pattern like `A --> B: Something;`
      // Group 1: start node
      // Group 2: end node
      // Group 3: label
      const arrowLabelRegex = /^(\S+)\s*-->\s*(\S+)\s*:\s*(.+?);?$/;
      const match = line.match(arrowLabelRegex);
      if (match) {
        const startNode = match[1];
        const endNode = match[2];
        const label = match[3].trim();
        // Convert to `A -->|label| B`
        line = `${startNode} -->|${label}| ${endNode}`;
      }
      return line;
    });

    // Also fix lines where arrow labels might have had extra `>`
    // For example: `A -->|Label|>` => `A -->|Label| `
    lines = lines.map((line) => {
      return line.replace(/(\|[^|]+\|)>(\s*)/g, "$1 $2");
    });

    // Ensure spacing between nodes and arrows:
    // If there's a pattern like `]B` directly after a bracket, insert a space.
    lines = lines.map((line) => line.replace(/](\w)/g, "] $1"));

    diagram = lines.join("\n");
    return diagram;
  }

  renderMermaidDiagram(container, diagram) {
    const diagramContainer = document.createElement("div");
    diagramContainer.className = "diagram-container";

    const mermaidContainer = document.createElement("div");
    mermaidContainer.className = "mermaid";
    mermaidContainer.textContent = diagram;
    diagramContainer.appendChild(mermaidContainer);

    // Append the container to the parent before initialization
    container.appendChild(diagramContainer);

    // Safely initialize Mermaid with a delay
    setTimeout(() => {
      try {
        mermaid.init(undefined, mermaidContainer);
      } catch (error) {
        console.error("Mermaid rendering error:", error);
      }
    }, 0);

    // Add Save Button for SVG
    const saveContainer = document.createElement("div");
    saveContainer.className = "svg-button";

    const saveAsSVGButton = document.createElement("button");
    saveAsSVGButton.className = "save-svg-button";

    const saveIcon = document.createElement("i");
    saveIcon.className = "fas fa-download";
    saveAsSVGButton.appendChild(saveIcon);

    saveAsSVGButton.onclick = () =>
      this.saveMermaidAsImage(mermaidContainer, "svg");
    saveContainer.appendChild(saveAsSVGButton);
    diagramContainer.appendChild(saveContainer);
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
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "diagram.svg";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
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

  async saveMermaidAsImage(mermaidElement, format) {
    const svgElement = mermaidElement.querySelector("svg");

    if (!svgElement) {
      console.error("No SVG element found in the Mermaid container.");
      alert("No diagram found to save.");
      return;
    }

    try {
      if (format === "svg") {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "diagram.svg";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
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
}
