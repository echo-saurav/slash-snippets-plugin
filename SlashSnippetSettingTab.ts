import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import SlashSnippetPlugin from "./main";

export default class SlashSnippetSettingTab extends PluginSettingTab {
	plugin: SlashSnippetPlugin;

	constructor(app: App, plugin: SlashSnippetPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

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
						if (value && value.length > 1) {
							new Notice("Please use one character to avoid conflict");
							text.setValue(value[0]);
						} else {
							this.plugin.settings.slashTrigger = value;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Fuzzy Search")
			.setDesc("You don’t have to type the exact name." +
				"If the letters appear in the right order, it will match." +
				"Example: ‘btn’ → ‘Button’.")
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.fuzzySearch)
					.onChange(async (value) => {
						this.plugin.settings.fuzzySearch = value;
						await this.plugin.saveSettings();
					})
			});


		new Setting(containerEl)
			.setName("Highlight")
			.setDesc("Highlight matching terms of search results")
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.highlight)
					.onChange(async (value) => {
						this.plugin.settings.highlight = value;
						await this.plugin.saveSettings();
					})
			});
		new Setting(containerEl)
			.setName("Show full path of the snippet file")
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.showPath)
					.onChange(async (value) => {
						this.plugin.settings.showPath = value;
						await this.plugin.saveSettings();
					})
			});

		new Setting(containerEl)
			.setName("Show snippet content")
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.showFileContent)
					.onChange(async (value) => {
						this.plugin.settings.showFileContent = value;
						await this.plugin.saveSettings();
					})
			});


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
			.setDesc("Enable this if you don't want to insert properties values in the snippets notes")
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.ignoreProperties)
					.onChange(async (value) => {
						this.plugin.settings.ignoreProperties = value;
						await this.plugin.saveSettings();
					})
			});


		const templaterDesc = document.createDocumentFragment();
		templaterDesc.append(
			"Enable this if you want to use ",
			templaterDesc.createEl("a", {
				href: "https://github.com/SilentVoid13/Templater",
				text: "Templater"
			}),
			" files inside snippets. (To use this, you need Templater plugin enabled)"
		)
		new Setting(containerEl)
			.setName("Enable Templater plugin support")
			.setDesc(templaterDesc)
			.addToggle((enable) => {
				enable
					.setValue(this.plugin.settings.templaterSupport)
					.onChange(async (value) => {
						this.plugin.settings.templaterSupport = value;
						await this.plugin.saveSettings();
					})
			});
	}
}
