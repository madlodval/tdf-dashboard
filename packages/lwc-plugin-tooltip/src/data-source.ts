import {
	IChartApi,
	ISeriesApi,
	SeriesOptionsMap,
} from 'lightweight-charts';
import { TooltipPrimitiveOptions } from './options';


export interface TooltipCrosshairLineData {
	x: number;
	visible: boolean;
	color: string;
	topMargin: number;
}

export interface TooltipDataSource {
	chart: IChartApi;
	series: ISeriesApi<keyof SeriesOptionsMap>;
	options: TooltipPrimitiveOptions;
	element: HTMLElement | string;
	data: TooltipCrosshairLineData;
}
