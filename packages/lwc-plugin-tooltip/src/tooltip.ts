import { TooltipCrosshairLineData, TooltipDataSource } from './data-source';
import { defaultOptions, TooltipPrimitiveOptions } from './options';
import { TooltipPaneView } from './pane-view';
import { PluginBase } from './plugin-base';

export class Tooltip
	extends PluginBase
	implements TooltipDataSource
{
	_options: TooltipPrimitiveOptions;
	_element: HTMLElement | string;
	_paneViews: TooltipPaneView[];
	_data: TooltipCrosshairLineData = {
		x: 0,
		visible: false,
		color: 'rgba(0, 0, 0, 0.2)',
		topMargin: 0,
	};

	constructor(
		element: HTMLElement | string,
		options: Partial<TooltipPrimitiveOptions>
	) {
		super();
		if (typeof element === 'string') {
			element = document.getElementById(element) as HTMLElement;
		}
		this._element = element;
		this._options = {
			...defaultOptions,
			...options,
		};
		this._paneViews = [new TooltipPaneView(this._data)];
	}

	updateAllViews() {
		//* Use this method to update any data required by the
		//* views to draw.
		this._paneViews.forEach(pw => pw.update());
	}

	paneViews() {
		//* rendering on the main chart pane
		return this._paneViews;
	}

	public get options(): TooltipPrimitiveOptions {
		return this._options;
	}

	applyOptions(options: Partial<TooltipPrimitiveOptions>) {
		this._options = { ...this._options, ...options };
		this.requestUpdate();
	}

	public get element(): HTMLElement {
		return this._element as HTMLElement;
	}

	public get data(): TooltipCrosshairLineData {
		return this._data;
	}
}
