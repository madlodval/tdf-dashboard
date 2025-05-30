var u = Object.defineProperty;
var _ = (i, e, t) => e in i ? u(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var s = (i, e, t) => (_(i, typeof e != "symbol" ? e + "" : e, t), t);
import { isBusinessDay as p } from "lightweight-charts";
class d {
  constructor(e, t) {
    s(this, "_source");
    s(this, "_x", null);
    s(this, "_options");
    this._source = e, this._options = t;
  }
  visible() {
    return this._options.showLabel;
  }
  coordinate() {
    return this._x ?? 0;
  }
  tickVisible() {
    return this._options.showLabel;
  }
  textColor() {
    return this._options.labelTextColor;
  }
  backColor() {
    return this._options.labelBackgroundColor;
  }
}
class f extends d {
  update() {
    const e = this._source.chart.timeScale();
    this._x = e.timeToCoordinate(this._source.time);
  }
  text() {
    return this._options.timeLabelFormatter(this._source.time, this._options.locale);
  }
}
var l;
const w = {
  //* Define the default values for all the primitive options.
  color: "#000000",
  width: 1,
  labelBackgroundColor: "#000000",
  labelTextColor: "#ffffff",
  showLabel: !1,
  locale: ((l = navigator.languages) == null ? void 0 : l[0]) || navigator.language || "en-US",
  timeLabelFormatter: (i, e) => {
    if (typeof i == "string")
      return i;
    const t = p(i) ? new Date(i.year, i.month, i.day) : new Date(i * 1e3), o = h(t.toLocaleDateString(e, { weekday: "short" })), n = h(
      t.toLocaleDateString(e, { month: "short" }).replace(/\./g, "")
    ), r = t.getDate(), a = t.getFullYear().toString().slice(-2);
    return `${o} ${r} ${n} '${a}`;
  }
};
function h(i) {
  return i.charAt(0).toUpperCase() + i.slice(1);
}
function x(i) {
  return Math.floor(i * 0.5);
}
function m(i, e, t = 1, o) {
  const n = Math.round(e * i), r = o ? t : Math.round(t * e), a = x(r);
  return { position: n - a, length: r };
}
class g {
  constructor(e, t) {
    s(this, "_x", null);
    s(this, "_options");
    this._x = e, this._options = t;
  }
  draw(e) {
    e.useBitmapCoordinateSpace((t) => {
      if (this._x === null)
        return;
      const o = t.context, n = m(
        this._x,
        t.horizontalPixelRatio,
        this._options.width
      );
      o.fillStyle = this._options.color, o.fillRect(
        n.position,
        0,
        n.length,
        t.bitmapSize.height
      );
    });
  }
}
class V {
  constructor(e, t) {
    s(this, "_source");
    s(this, "_x", null);
    s(this, "_options");
    this._source = e, this._options = t;
  }
  update() {
    const e = this._source.chart.timeScale();
    this._x = e.timeToCoordinate(this._source.time);
  }
  renderer() {
    return new g(
      this._x,
      this._options
    );
  }
}
function c(i) {
  if (i === void 0)
    throw new Error("Value is undefined");
  return i;
}
class b {
  constructor() {
    s(this, "_chart");
    s(this, "_series");
    s(this, "_requestUpdate");
  }
  requestUpdate() {
    this._requestUpdate && this._requestUpdate();
  }
  attached({
    chart: e,
    series: t,
    requestUpdate: o
  }) {
    this._chart = e, this._series = t, this._series.subscribeDataChanged(this._fireDataUpdated), this._requestUpdate = o, this.requestUpdate();
  }
  detached() {
    this._chart = void 0, this._series = void 0, this._requestUpdate = void 0;
  }
  get chart() {
    return c(this._chart);
  }
  get series() {
    return c(this._series);
  }
  _fireDataUpdated(e) {
    this.dataUpdated && this.dataUpdated(e);
  }
}
class S extends b {
  constructor(t, o = {}) {
    super();
    s(this, "_options");
    s(this, "_time");
    s(this, "_paneViews");
    s(this, "_timeAxisViews");
    this._time = t, this._options = {
      ...w,
      ...o
    }, this._paneViews = [new V(this, this._options)], this._timeAxisViews = [
      new f(this, this._options)
    ];
  }
  updateAllViews() {
    this._paneViews.forEach((t) => t.update()), this._timeAxisViews.forEach((t) => t.update());
  }
  timeAxisViews() {
    return this._timeAxisViews;
  }
  paneViews() {
    return this._paneViews;
  }
  get options() {
    return this._options;
  }
  applyOptions(t) {
    this._options = { ...this._options, ...t }, this.requestUpdate();
  }
  get time() {
    return this._time;
  }
}
export {
  S as VLine
};
