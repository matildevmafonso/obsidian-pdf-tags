# PDF Tags

Tag your PDF files in [Obsidian](https://obsidian.md) and find them in graph view, search, and the tag pane.

## The problem

PDFs have no frontmatter, so Obsidian has no way to index tags for them. PDF Tags solves this by creating a hidden companion Markdown file for each tagged PDF. Obsidian indexes the companion file, so your PDF tags show up everywhere tags are expected — graph view, search, the tag pane, and `tag:` queries.

## Features

- Tag button injected directly into the PDF viewer toolbar
- Add and remove tags from a popover — with autocomplete from your existing vault tags
- Tags appear in graph view, search results, and the tag pane
- Companion files stay in sync when PDFs are renamed or deleted
- Companion folder is hidden from the file explorer

## Usage

1. Open any PDF in Obsidian
2. Click the tag icon in the PDF toolbar (top right)
3. Type a tag name and press Enter, or click a suggestion from your existing vault tags
4. To remove a tag, click the × on the tag chip

## How it works

When you tag a PDF, the plugin creates a small Markdown file in a `_pdf-tags/` folder inside your vault. That file contains the tags as frontmatter and a backlink to the PDF. Obsidian's metadata cache picks up the tags from this file and treats them like any other tags in your vault.

The `_pdf-tags/` folder is hidden from the file explorer via CSS injection. It is **not** excluded from Obsidian's index, so tags remain discoverable everywhere.

## Settings

| Setting | Default | Description |
|---|---|---|
| Companion folder | `_pdf-tags` | Vault-relative folder where companion files are stored |

## Installation

### Community plugins (recommended)

1. Open Obsidian Settings → Community plugins
2. Search for **PDF Tags**
3. Install and enable

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/obsidian-pdf-tags/`
3. Enable the plugin in Obsidian Settings → Community plugins
