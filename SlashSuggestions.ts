import {Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile} from "obsidian";
import SlashSnippetPlugin, {SuggestionObject} from "./main";

export default class SlashSuggestions extends EditorSuggest<SuggestionObject> {
	private plugin: SlashSnippetPlugin;

	constructor(app: SlashSnippetPlugin) {
		super(app.app);
		this.plugin = app;
	}

	fuzzyMatch(text: string, query: string) {
		let t = 0, q = 0;
		let positions: number[] = []
		text = text.toLowerCase();
		query = query.toLowerCase();


		while (t < text.length && q < query.length) {
			if (text[t] === query[q]) {
				q++
				if (this.plugin.settings.highlight) {
					positions.push(t);
				}
			}
			if (text[t] === query[q]) q++;
			t++;
		}


		if (q === query.length) {
			// return position if highlight enabled
			if (this.plugin.settings.highlight) {
				return positions;
			} else {
				return [];
			}

		} else {
			return false
		}
	}

	getAllSnippets(query: string) {
		if (query.startsWith(" ")) {
			return []
		}
		const snippetFiles: SuggestionObject[] = [];

		// if nothing is query yet
		if (query == "" && this.plugin.lastSnippetFiles.length > 0) {
			return this.plugin.lastSnippetFiles;
		}


		for (let i = 0; i < this.plugin.snippetFiles.length; i++) {
			const file = this.plugin.snippetFiles[i];
			let score = 0;

			if (this.plugin.settings.fuzzySearch) {
				let positions = this.fuzzyMatch(file.name, query);
				// if fuzzy math start with query then have higher score match
				if (file.name.startsWith(query)) {
					score = 5;
				} else {
					score = 1;
				}

				if (positions) {
					snippetFiles.push({
						filePath: file.path,
						positions: positions,
						score: score
					});
				}

			} else {
				if (file.name.toLowerCase().contains(query.toLowerCase())) {
					score = 1;
					snippetFiles.push({
						filePath: file.path,
						positions: [],
						score: score
					})

				}
			}
		}

		snippetFiles.sort((a, b) => b.score - a.score);
		return snippetFiles;

	}

	getSuggestions(context: EditorSuggestContext): SuggestionObject[] | Promise<SuggestionObject[]> {
		return this.getAllSnippets(context.query)
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const currentLine = editor.getLine(cursor.line).slice(0, cursor.ch);

		if (!currentLine.contains(this.plugin.settings.slashTrigger)) {
			return null;
		}

		const queryStart = currentLine.lastIndexOf(this.plugin.settings.slashTrigger);
		const query = currentLine.slice(queryStart + 1, currentLine.length);
		return {
			start: {
				...cursor,
				ch: queryStart,
			},
			end: cursor,
			query: query
		};

	}

	private removeFrontmatter(content: string) {
		if (!content) {
			return "";
		}
		if (!this.plugin.settings.ignoreProperties) {
			return content;
		}
		if (content.startsWith("---")) {
			return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
		}
		return content;
	}

	public async selectSuggestion(result: SuggestionObject, evt: MouseEvent) {
		const file = this.plugin.app.vault.getFileByPath(result.filePath);
		if (!file) return
		const fileContent = await this.plugin.app.vault.cachedRead(file);
		let snippetContent = this.removeFrontmatter(fileContent);
		// replace with past text selection
		if (this.plugin.selectedText) {
			snippetContent = snippetContent.replace("$textSelection", this.plugin.selectedText);
		} else {
			snippetContent = snippetContent.replace("$textSelection", "");
		}
		this.plugin.selectedText = "";

		this.context?.editor.replaceRange(
			snippetContent,
			this.context.start,
			this.context.end
		);

		if (this.plugin.settings.templaterSupport) {
			await this.plugin.runTemplaterReplace();
		}

		this.updateLastUsedSnippet(result);
		this.close();
	}

	updateLastUsedSnippet(snippet: SuggestionObject) {
		// remove if already exist
		this.plugin.lastSnippetFiles.map(lastSnippet => {
			if (snippet.filePath === lastSnippet.filePath) {
				this.plugin.lastSnippetFiles.remove(lastSnippet);
			}
		})
		// insert at top
		this.plugin.lastSnippetFiles.unshift(snippet);
	}

	buildHighlighted(text: string, positions: number[]) {
		let out = "";

		for (let i = 0; i < text.length; i++) {
			if (positions.includes(i)) {
				out += `<b class="slash-fuzzy-match">${text[i]}</b>`;
			} else {
				out += text[i];
			}
		}

		return out;
	}

	// Renders each suggestion item.
	async renderSuggestion(suggestion: SuggestionObject, el: HTMLElement) {
		const file = this.plugin.app.vault.getFileByPath(suggestion.filePath);
		if (!file) return
		const fileContent = await this.plugin.app.vault.cachedRead(file);

		const pos = suggestion.positions;

		// highlight match
		if (this.plugin.settings.highlight && pos) {
			const title = el.createEl("div");
			title.innerHTML = this.buildHighlighted(file.basename, pos);

		} else {
			el.createEl("div", {text: file.basename});
		}

		// show path
		if (this.plugin.settings.showPath) {
			el.createEl("small", {cls: "slash-path", text: suggestion.filePath});
		}

		// show file content
		if (this.plugin.settings.showFileContent) {
			el.createDiv({cls: "slash-file"})
				.createEl("small", {cls: "slash-file-content", text: fileContent.trim()});
		}

		if (this.plugin.selectedText && fileContent.contains("$textSelection")) {
			const maxLength = 20;
			let insertText = ""

			if (this.plugin.selectedText.length > maxLength) {
				insertText = `${this.plugin.selectedText.substring(0, maxLength).trim()}...`;
			} else {
				insertText = this.plugin.selectedText.substring(0, 10).trim();
			}

			el.createEl('small', {text: insertText, cls: "insert_text"});
		}
	}

	public unload(): void {
	}
}
