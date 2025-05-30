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
	ignoreProperties: boolean;
	templaterSupport: boolean;
}

const DEFAULT_SETTINGS: SlashSnippetSettings = {
	slashTrigger: "/",
	snippetPath: "Snippets",
	ignoreProperties: true,
	templaterSupport: true
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

	private removeFrontmatter(content:string){
		if(!this.plugin.settings.ignoreProperties){
			return content;
		}
		if(content.startsWith("---")){
			return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
		}
		return content;
	}

	public async selectSuggestion(result: TFile, evt: MouseEvent) {
		const fileContent = await this.plugin.app.vault.cachedRead(result);
		const snippetContent = this.removeFrontmatter(fileContent);


		await this.context?.editor.replaceRange(
			snippetContent,
			this.context.start,
			this.context.end
		);

		if(this.plugin.settings.templaterSupport){
			await this.plugin.runTemplaterReplace();
		}
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

	
	public async runTemplaterReplace(){
		const templaterReplaceCommandId = "templater-obsidian:replace-in-file-templater";
		const saveCommandId = "editor:save-file";

		(await this.app as any).commands.executeCommandById(saveCommandId);

		await this.delay(300);
		(await this.app as any).commands.executeCommandById(templaterReplaceCommandId);
		
	}
	async delay(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
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

		new Setting(containerEl)
			.setName("Ignore properties")
			.setDesc("Enable this if don't want to include properties values in the notes, its useful if you use text expansion with 'expension' value in properties")
			.addToggle((enable)=>{
				enable
				.setValue(this.plugin.settings.ignoreProperties)
				.onChange(async (value)=>{
					this.plugin.settings.ignoreProperties = value;
					await this.plugin.saveSettings();
				})
			});


		const templaterDesc = document.createDocumentFragment();
		templaterDesc.append(
			"Enable this if you want to use ",
			templaterDesc.createEl("a",{
				href:"https://github.com/SilentVoid13/Templater",
				text: "Templater"
			}),
			" files inside snippets"
		)
		new Setting(containerEl)
			.setName("Enable Templater plugin support")
			.setDesc(templaterDesc)
			.addToggle((enable)=>{
				enable
				.setValue(this.plugin.settings.templaterSupport)
				.onChange(async (value)=>{
					this.plugin.settings.templaterSupport = value;
					await this.plugin.saveSettings();
				})
			});
	}
}
