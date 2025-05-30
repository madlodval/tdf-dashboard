import {
	IChartApi,
	ISeriesApi,
	SeriesOptionsMap,
} from 'lightweight-charts';
import { AnchoredTextOptions } from './options';

export interface AnchoredTextDataSource {
	chart: IChartApi;
	series: ISeriesApi<keyof SeriesOptionsMap>;
	options: AnchoredTextOptions;
}
