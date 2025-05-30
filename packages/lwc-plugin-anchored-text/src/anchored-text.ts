import { AnchoredTextDataSource } from './data-source';
import { AnchoredTextOptions, defaultOptions } from './options';
import { AnchoredTextPaneView } from './pane-view';
import { PluginBase } from './plugin-base';

export class AnchoredText
	extends PluginBase
	implements AnchoredTextDataSource
{
	_options: AnchoredTextOptions;
	_paneViews: AnchoredTextPaneView[];

	constructor(
		options: Partial<AnchoredTextOptions> = {}
	) {
		super();
		this._options = { ...defaultOptions, ...options };
		this._paneViews = [new AnchoredTextPaneView(this._options)];
	}

	updateAllViews() {
		this._paneViews.forEach(pw => pw.update());
	}

	paneViews() {
		return this._paneViews;
	}

	public get options(): AnchoredTextOptions {
		return this._options;
	}

	applyOptions(options: Partial<AnchoredTextOptions>) {
		this._options = { ...this._options, ...options };
		this.requestUpdate();
	}

	public get textWidth(): number {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return 0;
		
		ctx.font = this._options.font;
		return ctx.measureText(this._options.text).width;
	}
}
