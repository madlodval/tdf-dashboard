import {
	IChartApi,
	ISeriesApi,
	SeriesOptionsMap,
} from 'lightweight-charts';
import { TooltipPrimitiveOptions } from './options';
import { TooltipElement } from './element';


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
	tooltip: TooltipElement;
	data: TooltipCrosshairLineData;
}
