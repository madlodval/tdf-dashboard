import { LineSeries, createChart } from 'lightweight-charts';
import { generateLineData } from '../sample-data';
import { TooltipPrimitive } from '../tooltip';
import { LineData, CandlestickData, WhitespaceData } from 'lightweight-charts';

const chart = ((window as unknown as any).chart = createChart('chart', {
	autoSize: true,
}));

const lineSeries = chart.addSeries(LineSeries, {
	color: '#000000',
});
const data = generateLineData();
lineSeries.setData(data);


const primitive = new TooltipPrimitive({
	priceExtractor: (data: LineData | CandlestickData | WhitespaceData) => {
		if ('value' in data) {
			return data.value.toFixed(2);
		}
		if ('close' in data) {
			return data.close.toFixed(2);
		}
		return '';
	}
});

lineSeries.attachPrimitive(primitive);

primitive.setData({
	visible: false
});