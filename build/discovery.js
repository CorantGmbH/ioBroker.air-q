var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var discovery_exports = {};
__export(discovery_exports, {
  tryParseAirQService: () => tryParseAirQService
});
module.exports = __toCommonJS(discovery_exports);
function tryParseAirQService(service) {
  var _a, _b, _c, _d;
  const txtDevice = (_a = service.txt) == null ? void 0 : _a.device;
  if (typeof txtDevice !== "string" || txtDevice.toLowerCase() !== "air-q") {
    return null;
  }
  const deviceId = ((_b = service.txt) == null ? void 0 : _b.id) || "";
  return {
    name: ((_c = service.txt) == null ? void 0 : _c.devicename) || service.name || "",
    id: deviceId,
    shortId: deviceId.substring(0, 5),
    address: ((_d = service.referer) == null ? void 0 : _d.address) || ""
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  tryParseAirQService
});
//# sourceMappingURL=discovery.js.map
