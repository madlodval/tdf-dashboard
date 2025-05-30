import { LineSeries, createChart, LineStyle } from 'lightweight-charts';
import { generateLineData } from '../sample-data';
import { VLine } from '../vline';

const chart = ((window as unknown as any).chart = createChart('chart', {
	autoSize: true,
}));

const lineSeries = chart.addSeries(LineSeries, {
	color: '#000000',
});
const data = generateLineData();
lineSeries.setData(data);

const time1 = data[data.length - 50].time;

const primitive = new VLine(time1, {
	lineStyle: LineStyle.Dashed,
});

lineSeries.attachPrimitive(primitive);
