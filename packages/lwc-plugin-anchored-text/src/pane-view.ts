import { IPrimitivePaneView } from 'lightweight-charts';
import { AnchoredTextPaneRenderer } from './pane-renderer';
import { AnchoredTextOptions } from './options';

export class AnchoredTextPaneView implements IPrimitivePaneView {
	_data: AnchoredTextOptions;

	constructor(data: AnchoredTextOptions) {
		this._data = data;
	}

	update() {
	}

	renderer() {
		return new AnchoredTextPaneRenderer(this._data);
	}
}
