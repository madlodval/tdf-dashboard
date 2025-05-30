import {
	IChartApi,
	ISeriesApi,
	SeriesOptionsMap,
	Time,
} from 'lightweight-charts';
import { VLineOptions } from './options';

export interface VLineDataSource {
	chart: IChartApi;
	series: ISeriesApi<keyof SeriesOptionsMap>;
	options: VLineOptions;
	time: Time;
}
