import { Time } from 'lightweight-charts';
import { VLineTimeAxisView } from './axis-view';
import { VLineDataSource } from './data-source';
import { VLineOptions, defaultOptions } from './options';
import { VLinePaneView } from './pane-view';
import { PluginBase } from './plugin-base';

export class VLine
  extends PluginBase
  implements VLineDataSource
{
  _options: VLineOptions;
  _time: Time;
  _paneViews: VLinePaneView[];
  _timeAxisViews: VLineTimeAxisView[];

  constructor(
    time: Time,
    options: Partial<VLineOptions> = {}
  ) {
    super();
    this._time = time;
    this._options = {
      ...defaultOptions,
      ...options,
    };
    this._paneViews = [new VLinePaneView(this, this._options)];
    this._timeAxisViews = [
      new VLineTimeAxisView(this, this._options),
    ];
  }

  updateAllViews() {
    this._paneViews.forEach(pw => pw.update());
    this._timeAxisViews.forEach(pw => pw.update());
  }

  timeAxisViews() {
    return this._timeAxisViews;
  }

  paneViews() {
    return this._paneViews;
  }

  public get options(): VLineOptions {
    return this._options;
  }

  applyOptions(options: Partial<VLineOptions>) {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  public get time(): Time {
    return this._time;
  }
}
