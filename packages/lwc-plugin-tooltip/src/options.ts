import { LineData, CandlestickData, WhitespaceData } from 'lightweight-charts';

export interface TooltipOptions {
	title: string;
	followMode: 'top' | 'tracking';
	/** fallback horizontal deadzone width */
	horizontalDeadzoneWidth: number;
	verticalDeadzoneHeight: number;
	verticalSpacing: number;
	/** topOffset is the vertical spacing when followMode is 'top' */
	topOffset: number;
}

export interface TooltipPrimitiveOptions {
	lineColor: string;
	tooltip?: Partial<TooltipOptions>;
	priceExtractor: <T extends LineData | CandlestickData | WhitespaceData>(data: T, logicalIndex?: number) => string;
}

export const defaultOptions: TooltipPrimitiveOptions = {
	lineColor: 'rgba(0, 0, 0, 0.2)',
	priceExtractor: (data: LineData | CandlestickData | WhitespaceData) => {
		if ((data as LineData).value !== undefined) {
			return (data as LineData).value.toFixed(2);
		}
		if ((data as CandlestickData).close !== undefined) {
			return (data as CandlestickData).close.toFixed(2);
		}
		return '';
	}
};
