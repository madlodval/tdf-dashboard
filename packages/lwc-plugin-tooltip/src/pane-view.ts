import { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitivePaneViewZOrder } from 'lightweight-charts';
import { TooltipPaneRenderer } from './pane-renderer';
import { TooltipCrosshairLineData } from './data-source';


export class TooltipPaneView implements IPrimitivePaneView {
	_data: TooltipCrosshairLineData;

	constructor(data: TooltipCrosshairLineData) {
		this._data = data;
	}

	update(data: TooltipCrosshairLineData): void {
		this._data = data;
	}

	renderer(): IPrimitivePaneRenderer | null {
		return new TooltipPaneRenderer(this._data);
	}

	zOrder(): PrimitivePaneViewZOrder {
		return 'bottom';
	}
}
