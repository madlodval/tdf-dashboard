export interface AnchoredTextOptions {
	vertAlign: 'top' | 'middle' | 'bottom';
	horzAlign: 'left' | 'middle' | 'right';
	text: string;
	lineHeight: number;
	offsetX: number;
	offsetY: number;
	font: string;
	color: string;
}

export const defaultOptions: AnchoredTextOptions = {
	vertAlign: 'top',
	horzAlign: 'left',
	text: '',
	lineHeight: 12,
	offsetX: 0,
	offsetY: 0,
	font: '12px Arial',
	color: '#000000'
};

