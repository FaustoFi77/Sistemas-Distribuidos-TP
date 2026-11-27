import L from "leaflet";

let applied = false;

interface LeafletMapInternal {
  _mapPane?: HTMLElement;
  _getMapPanePos: () => L.Point;
  _onZoomTransitionEnd?: () => void;
}

interface LeafletScrollWheelInternal {
  _map?: { _mapPane?: HTMLElement };
  _performZoom?: () => void;
}

/**
 * Workaround para un bug conocido de Leaflet 1.9.4 con React 18/19:
 * si un mapa se desmonta mientras hay una transición de zoom o un timer de rueda del mouse
 * (`ScrollWheelZoom._performZoom`) pendiente, `this._mapPane` ya es `undefined` y Leaflet
 * lanza `Cannot read properties of undefined (reading '_leaflet_pos')`.
 *
 * Protege tanto a `ZoneMap` (react-leaflet) como a `DeviceMap` (`@ovenbird/react`).
 */
export function applyLeafletUnmountGuard(): void {
  if (applied || typeof window === "undefined") return;
  applied = true;

  const mapProto = L.Map.prototype as unknown as LeafletMapInternal;

  const origGetMapPanePos = mapProto._getMapPanePos;
  mapProto._getMapPanePos = function (this: LeafletMapInternal) {
    if (!this._mapPane) return L.point(0, 0);
    return origGetMapPanePos.call(this);
  };

  const origZoomEnd = mapProto._onZoomTransitionEnd;
  if (typeof origZoomEnd === "function") {
    mapProto._onZoomTransitionEnd = function (this: LeafletMapInternal) {
      if (!this._mapPane) return;
      origZoomEnd.call(this);
    };
  }

  const scrollCtor = (L.Map as unknown as { ScrollWheelZoom?: { prototype: LeafletScrollWheelInternal } })
    .ScrollWheelZoom;
  const origPerformZoom = scrollCtor?.prototype?._performZoom;
  if (scrollCtor?.prototype && typeof origPerformZoom === "function") {
    scrollCtor.prototype._performZoom = function (this: LeafletScrollWheelInternal) {
      if (!this._map?._mapPane) return;
      origPerformZoom.call(this);
    };
  }
}
