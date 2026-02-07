import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile
} from "obsidian";
import SlashSnippetPlugin, {SuggestionObject} from "./main";

export default class SlashSuggestions extends EditorSuggest<SuggestionObject> {
	private plugin: SlashSnippetPlugin;
	private DEFAULT_SCORE = 1;
	private START_WITH_SCORE = 2;


	getAllSnippets(query: string) {
		if (query.startsWith(" ")) {
			return []
		}

		// if nothing is query yet
		if (query == "") {
			return this.getLastUsedSnippetFiles();

		}

		// search rank
		const snippetFiles: SuggestionObject[] = [];

		for (let i = 0; i < this.plugin.snippetFiles.length; i++) {
			const file = this.plugin.snippetFiles[i];
			let score = 0;

			if (this.plugin.settings.fuzzySearch) {
				let positions = this.fuzzyMatch(file.name, query);
				// if fuzzy math start with query then have higher score match
				if (file.name.startsWith(query)) {
					score = this.START_WITH_SCORE;
				} else {
					score = this.DEFAULT_SCORE;
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
					score = this.DEFAULT_SCORE;
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

	public async selectSuggestion(suggestion: SuggestionObject, evt: MouseEvent) {
		const file = this.plugin.app.vault.getFileByPath(suggestion.filePath);
		if (!file) return
		const fileContent = await this.plugin.app.vault.cachedRead(file);
		let snippetContent = this.removeFrontmatter(fileContent);

		const textSelectionPos = snippetContent.indexOf(this.plugin.settings.textSelectionString);
		console.log(`textSelectionPos ${textSelectionPos}`);

		// cursor position hop
		const cursorTextPos = snippetContent.indexOf(this.plugin.settings.cursorPositionString);
		// remove cursor text
		if (cursorTextPos) {
			snippetContent = snippetContent.replace(this.plugin.settings.cursorPositionString, "")
		}

		// replace with past text selection
		if (this.plugin.selectedText) {
			snippetContent = snippetContent.replace(this.plugin.settings.textSelectionString, this.plugin.selectedText);
		} else {
			snippetContent = snippetContent.replace(this.plugin.settings.textSelectionString, "");
		}
		this.plugin.selectedText = "";
		//
		this.context?.editor.replaceRange(
			snippetContent,
			this.context.start,
			this.context.end
		);

		if (cursorTextPos && cursorTextPos >0) {
			this.context?.editor.setCursor({
				line: this.context?.start.line,
				ch: this.context?.start.ch + cursorTextPos
			});
		}else if(textSelectionPos){
			this.context?.editor.setCursor({
				line: this.context?.start.line,
				ch: this.context?.start.ch + textSelectionPos
			});
		}


		// run templater
		if (this.plugin.settings.templaterSupport) {
			await this.plugin.runTemplaterReplace();
		}

		// update last used timestamp
		localStorage.setItem(suggestion.filePath, String(Date.now()));
		this.close();
	}

	getLastUsedSnippetFiles(): SuggestionObject[] {
		const snippets: SuggestionObject[] = [];

		this.plugin.snippetFiles.map(snippet => {
			const timestamp = localStorage.getItem(snippet.path);
			const suggestionObject = {
				filePath: snippet.path,
				positions: [],
				score: timestamp ? Number(timestamp) : 0,
			}
			snippets.push(suggestionObject);
		});

		snippets.sort((a, b) => b.score - a.score);
		return snippets;
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

		if (this.plugin.settings.showSelectedText &&
			this.plugin.selectedText &&
			fileContent.contains(this.plugin.settings.textSelectionString)) {

			let insertText = ""

			if (this.plugin.selectedText.length > this.plugin.settings.maxSelectedTextLength) {
				insertText = `${this.plugin.selectedText.substring(0, this.plugin.settings.maxSelectedTextLength).trim()}...`;
			} else {
				insertText = this.plugin.selectedText.substring(0, 10).trim();
			}

			el.createEl('small', {text: insertText, cls: "insert_text"});
		}

	}

	constructor(app: SlashSnippetPlugin) {
		super(app.app);
		this.plugin = app;
	}

	public unload(): void {
	}

}
