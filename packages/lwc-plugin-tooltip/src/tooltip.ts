import { CrosshairMode, Time } from 'lightweight-charts';
import { TooltipCrosshairLineData, TooltipDataSource	 } from './data-source';
import { defaultOptions, TooltipPrimitiveOptions } from './options';
import { TooltipPaneView } from './pane-view';
import { PluginBase } from './plugin-base';
import { TooltipElement } from './element';
import { convertTime, formattedDateAndTime } from './helpers/time';
import { SeriesAttachedParameter, MouseEventParams } from 'lightweight-charts';
import { ensureDefined } from './helpers/assertions';

export class TooltipPrimitive
	extends PluginBase
	implements TooltipDataSource
{
	private _options: TooltipPrimitiveOptions;
	private _tooltip: TooltipElement | undefined = undefined;
	private _paneViews: TooltipPaneView[];
	private _data: TooltipCrosshairLineData = {
		x: 0,
		visible: false,
		color: 'rgba(0, 0, 0, 0.2)',
		topMargin: 0,
	};

	constructor(
		options: Partial<TooltipPrimitiveOptions>
	) {
		super();
		this._options = {
			...defaultOptions,
			...options,
		};
		this._paneViews = [new TooltipPaneView(this._data)];
	}

	public attached(params: SeriesAttachedParameter<Time>): void {
		super.attached(params); // Llama a la lógica base
		this._setCrosshairMode();
		this.chart.subscribeCrosshairMove(this._moveHandler);
		this._createTooltipElement();
	}


	updateAllViews() {
		//* Use this method to update any data required by the
		//* views to draw.
		this._paneViews.forEach(pw => pw.update(this._data));
	}

	paneViews() {
		//* rendering on the main chart pane
		return this._paneViews;
	}

	applyOptions(options: Partial<TooltipPrimitiveOptions>) {
		this._options = {
			...this._options,
			...options,
		};
		if (this._tooltip) {
			this._tooltip.applyOptions({ ...this._options.tooltip });
		}
	}

	setData(data: Partial<TooltipCrosshairLineData>) {
		this._data = {
			...this._data,
			...data
		};
		this.updateAllViews();
		this.requestUpdate();
	}

	currentColor() {
		return this._options.lineColor;
	}

	get data() {
		return this._data;
	}

	get options() {
		return this._options;
	}

	get tooltip() {
		return ensureDefined(this._tooltip);
	}

	private _setCrosshairMode() {
		const chart = this.chart;
		if (!chart) {
			throw new Error(
				'Unable to change crosshair mode because the chart instance is undefined'
			);
		}
		chart.applyOptions({
			crosshair: {
				mode: CrosshairMode.Magnet,
				vertLine: {
					visible: false,
					labelVisible: false,
				},
				horzLine: {
					visible: false,
					labelVisible: false,
				}
			},
		});
	}

	private _moveHandler = (param: MouseEventParams) => this._onMouseMove(param);

	private _hideTooltip() {
		if (!this._tooltip) return;
		this._tooltip.updateTooltipContent({
			title: '',
			price: '',
			date: '',
			time: '',
		});
		this._tooltip.updatePosition({
			paneX: 0,
			paneY: 0,
			visible: false,
		});
	}

	private _hideCrosshair() {
		this._hideTooltip();
		this.setData({
			x: 0,
			visible: false,
			color: this.currentColor(),
			topMargin: 0,
		});
	}

	private _onMouseMove(param: MouseEventParams) {
		const chart = this.chart;
		const series = this.series;
		const logical = param.logical;
		if (!logical || !chart || !series) {
			this._hideCrosshair();
			return;
		}
		const data = param.seriesData.get(series);
		if (!data) {
			this._hideCrosshair();
			return;
		}
		const price = this._options.priceExtractor(data, logical);
		const coordinate = chart.timeScale().logicalToCoordinate(logical);
		const [date, time] = formattedDateAndTime(param.time ? convertTime(param.time) : undefined);
		if (this._tooltip) {
			const tooltipOptions = this._tooltip.options();
			const topMargin = tooltipOptions.followMode == 'top' ? tooltipOptions.topOffset + 10 : 0;
			this.setData({
				x: coordinate ?? 0,
				visible: coordinate !== null,
				color: this.currentColor(),
				topMargin,
			});
			this._tooltip.updateTooltipContent({
				price,
				date,
				time,
			});
			this._tooltip.updatePosition({
				paneX: param.point?.x ?? 0,
				paneY: param.point?.y ?? 0,
				visible: true,
			});
		}
	}

	private _createTooltipElement() {
		const chart = this.chart;
		if (!chart)
			throw new Error('Unable to create Tooltip element. Chart not attached');
		this._tooltip = new TooltipElement(chart, {
			...this._options.tooltip,
		});
	}
}
