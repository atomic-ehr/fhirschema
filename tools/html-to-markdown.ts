#!/usr/bin/env bun

import { parseArgs } from "util";
import TurndownService from "turndown";
import * as fs from "fs";
import * as path from "path";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    url: {
      type: "string",
    },
    output: {
      type: "string",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (values.help || !values.url) {
  console.log(`
Usage: bun tools/html-to-markdown.ts --url <URL> [--output <filename>]

Options:
  --url     URL to fetch and convert
  --output  Output filename (default: derived from URL)
  --help    Show this help message

Example:
  bun tools/html-to-markdown.ts --url https://build.fhir.org/profiling.html
  bun tools/html-to-markdown.ts --url https://example.com/page.html --output custom-name.md
`);
  process.exit(0);
}

async function fetchAndConvert(url: string, outputPath?: string) {
  console.log(`Fetching ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes`);

    // Initialize Turndown with custom options
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    // Add custom rules for better FHIR documentation handling
    turndownService.addRule("preserveCodeBlocks", {
      filter: ["pre"],
      replacement: function(content, node) {
        const element = node as HTMLElement;
        const codeElement = element.querySelector("code");
        const language = codeElement?.className?.match(/language-(\w+)/)?.[1] || "";
        const code = codeElement?.textContent || element.textContent || "";
        return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      }
    });

    // Convert HTML to Markdown
    console.log("Converting to markdown...");
    const markdown = turndownService.turndown(html);

    // Determine output filename
    let filename = outputPath;
    if (!filename) {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const baseName = path.basename(pathname, path.extname(pathname)) || "index";
      filename = `${baseName}.md`;
    }

    // Ensure spec directory exists
    const specDir = path.join(process.cwd(), "spec");
    if (!fs.existsSync(specDir)) {
      fs.mkdirSync(specDir, { recursive: true });
    }

    const fullPath = path.join(specDir, filename);

    // Write markdown to file
    fs.writeFileSync(fullPath, markdown);
    console.log(`✅ Saved to ${fullPath}`);
    console.log(`📄 File size: ${(markdown.length / 1024).toFixed(2)} KB`);

    return fullPath;
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the tool
fetchAndConvert(values.url!, values.output);