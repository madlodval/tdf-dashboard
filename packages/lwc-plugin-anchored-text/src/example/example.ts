import { LineSeries, createChart } from 'lightweight-charts';
import { generateLineData } from '../sample-data';
import { AnchoredText } from '../anchored-text';

const chart = ((window as unknown as any).chart = createChart('chart', {
	autoSize: true,
}));

const lineSeries = chart.addSeries(LineSeries, {
	color: '#000000',
});
const data = generateLineData();
lineSeries.setData(data);

const anchoredText = new AnchoredText({
	vertAlign: 'top',
	horzAlign: 'left',
	text: 'Anchored Text',
	lineHeight: 54,
	font: 'italic bold 54px Arial',
	color: 'red',
});
chart.panes()[0].attachPrimitive(anchoredText);

// testing the requestUpdate method
setTimeout(() => {
	anchoredText.applyOptions({
		text: 'New Text',
	});
}, 2000);