import {
	App,
	Editor,
	EditorPosition,
	EditorSuggestTriggerInfo,
	Plugin,
	PluginSettingTab,
	Setting,
	EditorSuggest,
	TFile,
	EditorSuggestContext,
} from "obsidian";

interface SlashSnippetSettings {
	slashTrigger: string;
	snippetPath: string;
}

const DEFAULT_SETTINGS: SlashSnippetSettings = {
	slashTrigger: "/",
	snippetPath: "Snippets",
};


class SlashSuggestions extends EditorSuggest<TFile> {
	private plugin:SlashSnippetPlugin;

	constructor(app: SlashSnippetPlugin) {
		super(app.app);
		this.plugin = app;
	}

	getAllSnippets(query:string){

		const files = this.app.vault.getMarkdownFiles();
		const snippetFiles = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i]
			if(file.path.startsWith(this.plugin.settings.snippetPath)){
				if(file.name.toLowerCase().contains(query.toLowerCase())){
					snippetFiles.push(file)
				}
			}
		}

		return snippetFiles;

	}

	getSuggestions(context: EditorSuggestContext): TFile[] | Promise<TFile[]> {
		return this.getAllSnippets(context.query)
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const currentLine = editor.getLine(cursor.line).slice(0, cursor.ch);

		if (!currentLine.startsWith(this.plugin.settings.slashTrigger)) {
			return null;
		}

		return {
			start: {
				...cursor,
				// Starting ch of the prompt + command group
				ch: 0,
			},
			end: cursor,
			query: currentLine.slice(1,currentLine.length),
		};
	}

	public async selectSuggestion(result: TFile, evt: MouseEvent) {
		const snippetContent = await this.plugin.app.vault.read(result);

		this.context?.editor.replaceRange(
			snippetContent,
			this.context.start,
			this.context.end
		);
		this.close();
	}

	// Renders each suggestion item.
	renderSuggestion(file: TFile, el: HTMLElement) {
		el.createEl("div", { text:  file.basename});
		el.createEl("small", { text: file.path });
	}


	public unload(): void {
	}
}

export default class SlashSnippetPlugin extends Plugin {
	settings: SlashSnippetSettings;

	async onload() {
		await this.loadSettings();
		this.registerEditorSuggest(new SlashSuggestions(this));
		this.addSettingTab(new SlashSnippetSettingTab(this.app, this));
	}

	onunload() {}

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

class SlashSnippetSettingTab extends PluginSettingTab {
	plugin: SlashSnippetPlugin;

	constructor(app: App, plugin: SlashSnippetPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Slash trigger")
			.setDesc(
				"Enter a character that will trigger template insert suggestion"
			)
			.addText((text) =>
				text
					.setPlaceholder("Slash trigger")
					.setValue(this.plugin.settings.slashTrigger)
					.onChange(async (value) => {
						this.plugin.settings.slashTrigger = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Snippet path")
			.setDesc("Set a folder that has all the snippets files")
			.addText((text) =>
				text
					.setPlaceholder("Snippet path")
					.setValue(this.plugin.settings.snippetPath)
					.onChange(async (value) => {
						this.plugin.settings.snippetPath = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
