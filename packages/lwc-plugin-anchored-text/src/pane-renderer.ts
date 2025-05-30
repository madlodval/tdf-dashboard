import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer } from 'lightweight-charts';
import { AnchoredTextOptions } from './options';

export class AnchoredTextPaneRenderer implements IPrimitivePaneRenderer {
	_data: AnchoredTextOptions;

	constructor(data: AnchoredTextOptions) {
		this._data = data;
	}

	draw(target: CanvasRenderingTarget2D) {
		target.useMediaCoordinateSpace(scope => {
			const ctx = scope.context;
			ctx.font = this._data.font;
			const textWidth = ctx.measureText(this._data.text).width;
			const horzMargin = 20;
			let x = horzMargin + this._data.offsetX;
			const width = scope.mediaSize.width;
			const height = scope.mediaSize.height;
			switch (this._data.horzAlign) {
				case 'right': {
					x = width - horzMargin - textWidth;
					break;
				}
				case 'middle': {
					x = width / 2 - textWidth / 2;
					break;
				}
			}
			const vertMargin = 10;
			const lineHeight = this._data.lineHeight;
			let y = vertMargin + lineHeight + this._data.offsetY;
			switch (this._data.vertAlign) {
				case 'middle': {
					y = height / 2 + lineHeight / 2;
					break;
				}
				case 'bottom': {
					y = height - vertMargin;
					break;
				}
			}
			ctx.fillStyle = this._data.color;
			ctx.fillText(this._data.text, x, y);
		})
	}
}
