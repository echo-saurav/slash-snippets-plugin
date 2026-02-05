import {Plugin, TFile, debounce,} from "obsidian";
import {EditorView, ViewUpdate} from "@codemirror/view";
import SlashSnippetSettingTab from "./SlashSnippetSettingTab";
import SlashSuggestions from "./SlashSuggestions";

interface SlashSnippetSettings {
	slashTrigger: string;
	fuzzySearch: boolean;
	highlight: boolean;
	showPath: boolean;
	showFileContent: boolean;
	snippetPath: string;
	ignoreProperties: boolean;
	templaterSupport: boolean;
}

export interface SuggestionObject {
	file: TFile;
	positions: number[];
	score: number;
}

const DEFAULT_SETTINGS: SlashSnippetSettings = {
	slashTrigger: "/",
	fuzzySearch: true,
	highlight: true,
	showPath: false,
	showFileContent: false,
	snippetPath: "Snippets",
	ignoreProperties: true,
	templaterSupport: true
};


export default class SlashSnippetPlugin extends Plugin {
	settings: SlashSnippetSettings;
	selectedText: string;
	snippetFiles: TFile[] = [];
	lastSnippetFiles: SuggestionObject[] = [];

	async onload() {
		await this.loadSettings();
		this.registerEditorSuggest(new SlashSuggestions(this));
		this.addSettingTab(new SlashSnippetSettingTab(this.app, this));
		this.loadAllTemplatedFiles();
		this.listenForUpdates();

		// keep text selection updated
		const mySelectionListener = EditorView.updateListener.of((update: ViewUpdate) => {
			if (update.selectionSet) {
				const text = update.state.sliceDoc(
					update.state.selection.main.from,
					update.state.selection.main.to
				);

				if (text.length > 0) {
					this.selectedText = text;
				}
			}
		});
		this.registerEditorExtension(mySelectionListener);
	}

	loadAllTemplatedFiles() {
		const files = this.app.vault.getMarkdownFiles();
		const snippets = []

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			if (file.path.startsWith(`${this.settings.snippetPath}/`)) {
				snippets.push(file)
			}
		}

		this.snippetFiles = snippets;
	}

	listenForUpdates() {
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (file.path.startsWith(`${this.settings.snippetPath}/`)) {
				console.log('on create', file.path);
				this.snippetFiles.push(file as TFile);
			}
		}));

		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (file.path.startsWith(`${this.settings.snippetPath}/`)) {
				console.log('on delete', file.path);
				this.snippetFiles.remove(file as TFile);
			}
		}));
	}

	public async runTemplaterReplace() {
		const templaterReplaceCommandId = "templater-obsidian:replace-in-file-templater";
		const saveCommandId = "editor:save-file";

		(this.app as any).commands.executeCommandById(saveCommandId);

		const delayTemplateReplaceRun = debounce(() => {
			(this.app as any).commands.executeCommandById(templaterReplaceCommandId);
		}, 300, true)

		delayTemplateReplaceRun()

	}


	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

